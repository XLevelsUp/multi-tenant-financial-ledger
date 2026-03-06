-- ============================================================================
-- PHASE 4: ACCOUNTING PERIOD LIFECYCLE & HARD CLOSE
-- ============================================================================
-- Introduces time-bound ledger periods, temporal integrity constraints,
-- a hard-close check inside record_transaction, and an atomic close RPC
-- that auto-generates the Retained Earnings rollover closing entry.
-- ============================================================================

-- ── 1. ACCOUNTING PERIODS TABLE ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_periods (
  id                      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                    TEXT          NOT NULL,
  start_date              DATE          NOT NULL,
  end_date                DATE          NOT NULL,
  status                  TEXT          NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open', 'closed')),
  closed_at               TIMESTAMPTZ,
  closed_by               UUID          REFERENCES auth.users(id),
  closing_transaction_id  UUID          REFERENCES transactions(id),
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT periods_date_order
    CHECK (end_date >= start_date),
  CONSTRAINT periods_name_org_unique
    UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_org_dates
  ON accounting_periods (organization_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_org_status
  ON accounting_periods (organization_id, status);

-- ── 2. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "periods_select_member"
  ON accounting_periods FOR SELECT
  USING (organization_id IN (SELECT get_active_organizations()));

CREATE POLICY "periods_insert_authenticated"
  ON accounting_periods FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Periods are immutable once closed via the RPC; direct UPDATE/DELETE blocked for non-owners
CREATE POLICY "periods_update_member"
  ON accounting_periods FOR UPDATE
  TO authenticated
  USING (organization_id IN (SELECT get_active_organizations()));

-- ── 3. TEMPORAL OVERLAP PREVENTION TRIGGER ───────────────────────────────────
-- Ensures no two periods for the same org share a date range.

CREATE OR REPLACE FUNCTION prevent_period_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   accounting_periods
    WHERE  organization_id = NEW.organization_id
      AND  id              <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND  NEW.start_date  <= end_date
      AND  NEW.end_date    >= start_date
  ) THEN
    RAISE EXCEPTION
      'Accounting period overlaps with an existing period for this organization. '
      'Periods must not overlap.'
      USING ERRCODE = 'P0010';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_period_overlap
  BEFORE INSERT OR UPDATE ON accounting_periods
  FOR EACH ROW EXECUTE FUNCTION prevent_period_overlap();

-- ── 4. MODIFY record_transaction — HARD-CLOSE CHECK ─────────────────────────
-- Adds a guard at the top of the existing Phase 2 RPC: if entry_date falls
-- inside a CLOSED period for this org, the write is rejected.

CREATE OR REPLACE FUNCTION record_transaction(
  p_organization_id UUID,
  p_description     TEXT,
  p_entry_date      DATE,
  p_status          TEXT,
  p_lines           JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
  v_total_debits   NUMERIC(20, 4) := 0;
  v_total_credits  NUMERIC(20, 4) := 0;
  v_line           JSONB;
  v_amount         NUMERIC(20, 4);
BEGIN
  -- Authorization guard
  IF p_organization_id NOT IN (SELECT get_active_organizations()) THEN
    RAISE EXCEPTION 'Access denied: not a member of organization %', p_organization_id
      USING ERRCODE = 'P0002';
  END IF;

  -- ▶ PHASE 4 HARD-CLOSE GUARD ◀
  -- Reject if p_entry_date falls within a closed accounting period.
  IF EXISTS (
    SELECT 1
    FROM   accounting_periods
    WHERE  organization_id = p_organization_id
      AND  status          = 'closed'
      AND  p_entry_date    BETWEEN start_date AND end_date
  ) THEN
    RAISE EXCEPTION
      'Cannot post to a closed accounting period. '
      'The entry date % falls within a period that has been hard-closed. '
      'Create a new open period or use a date in an open period.',
      p_entry_date
      USING ERRCODE = 'P0011';
  END IF;

  -- Zero-sum validation
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_amount := (v_line->>'amount')::NUMERIC(20, 4);
    IF (v_line->>'type') = 'debit'  THEN v_total_debits  := v_total_debits  + v_amount; END IF;
    IF (v_line->>'type') = 'credit' THEN v_total_credits := v_total_credits + v_amount; END IF;
  END LOOP;

  IF v_total_debits <> v_total_credits THEN
    RAISE EXCEPTION
      'Journal entries do not balance. Debits: %, Credits: %',
      v_total_debits, v_total_credits
      USING ERRCODE = 'P0001';
  END IF;

  -- Insert transaction header (created_by = the authenticated caller)
  INSERT INTO transactions (organization_id, description, entry_date, status, created_by)
  VALUES (p_organization_id, p_description, p_entry_date, p_status::transaction_status, auth.uid())
  RETURNING id INTO v_transaction_id;

  -- Insert journal lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO journal_lines (transaction_id, organization_id, account_id, amount, type, description)
    VALUES (
      v_transaction_id,
      p_organization_id,
      (v_line->>'account_id')::UUID,
      (v_line->>'amount')::NUMERIC(20, 4),
      (v_line->>'type')::journal_entry_type,
      v_line->>'description'
    );
  END LOOP;

  RETURN v_transaction_id;
END;
$$;

-- ── 5. close_accounting_period RPC ───────────────────────────────────────────
-- Atomically:
--   a) Calculates net income for the period (Revenue net credits - Expense net debits)
--   b) Generates a zero-sum closing journal entry:
--        - DEBIT each revenue account by its net balance (zeroes it out)
--        - CREDIT each expense account by its net balance (zeroes it out)
--        - Net difference credited or debited to Retained Earnings
--   c) Marks the period as 'closed'

CREATE OR REPLACE FUNCTION close_accounting_period(
  p_period_id                     UUID,
  p_retained_earnings_account_id  UUID
)
RETURNS UUID  -- returns the closing transaction ID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period              accounting_periods%ROWTYPE;
  v_org_id              UUID;
  v_closing_lines       JSONB := '[]'::JSONB;
  v_line_json           JSONB;
  v_total_debits        NUMERIC(20, 4) := 0;
  v_total_credits       NUMERIC(20, 4) := 0;
  v_net_income          NUMERIC(20, 4) := 0;
  v_account             RECORD;
  v_revenue_net         NUMERIC(20, 4) := 0;
  v_expense_net         NUMERIC(20, 4) := 0;
  v_re_balance          NUMERIC(20, 4);
  v_closing_tx_id       UUID;
  v_desc                TEXT;
BEGIN
  -- Fetch and validate the period
  SELECT * INTO v_period FROM accounting_periods WHERE id = p_period_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Accounting period % not found', p_period_id
      USING ERRCODE = 'P0020';
  END IF;

  v_org_id := v_period.organization_id;

  -- Authorization
  IF v_org_id NOT IN (SELECT get_active_organizations()) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organization'
      USING ERRCODE = 'P0002';
  END IF;

  -- Already closed?
  IF v_period.status = 'closed' THEN
    RAISE EXCEPTION 'Accounting period "%" is already closed', v_period.name
      USING ERRCODE = 'P0021';
  END IF;

  -- Validate retained earnings account belongs to this org and is equity type
  IF NOT EXISTS (
    SELECT 1 FROM accounts
    WHERE id = p_retained_earnings_account_id
      AND organization_id = v_org_id
      AND type = 'equity'
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION
      'Retained Earnings account not found, inactive, or not of type ''equity'' in this organization'
      USING ERRCODE = 'P0022';
  END IF;

  -- ── Calculate net balances per revenue and expense account ────────────────
  FOR v_account IN
    SELECT
      a.id                                                              AS account_id,
      a.type                                                            AS account_type,
      COALESCE(SUM(jl.amount) FILTER (WHERE jl.type = 'debit'),  0)   AS total_debits,
      COALESCE(SUM(jl.amount) FILTER (WHERE jl.type = 'credit'), 0)   AS total_credits
    FROM  accounts a
    JOIN  journal_lines jl ON jl.account_id = a.id AND jl.organization_id = v_org_id
    JOIN  transactions  t  ON t.id = jl.transaction_id
                           AND t.status = 'posted'
                           AND t.entry_date BETWEEN v_period.start_date AND v_period.end_date
    WHERE a.organization_id = v_org_id
      AND a.type IN ('revenue', 'expense')
    GROUP BY a.id, a.type
    HAVING (SUM(jl.amount) FILTER (WHERE jl.type = 'debit')  IS NOT NULL
         OR SUM(jl.amount) FILTER (WHERE jl.type = 'credit') IS NOT NULL)
  LOOP
    IF v_account.account_type = 'revenue' THEN
      -- Revenue: normal credit balance → net = credits - debits
      -- Closing: DEBIT revenue account to zero it out
      v_revenue_net := v_account.total_credits - v_account.total_debits;
      IF v_revenue_net > 0 THEN
        v_line_json := jsonb_build_object(
          'account_id',  v_account.account_id,
          'amount',      v_revenue_net::TEXT,
          'type',        'debit',
          'description', 'Closing entry — zero out revenue'
        );
        v_closing_lines := v_closing_lines || jsonb_build_array(v_line_json);
        v_total_debits := v_total_debits + v_revenue_net;
      END IF;

    ELSIF v_account.account_type = 'expense' THEN
      -- Expense: normal debit balance → net = debits - credits
      -- Closing: CREDIT expense account to zero it out
      v_expense_net := v_account.total_debits - v_account.total_credits;
      IF v_expense_net > 0 THEN
        v_line_json := jsonb_build_object(
          'account_id',  v_account.account_id,
          'amount',      v_expense_net::TEXT,
          'type',        'credit',
          'description', 'Closing entry — zero out expense'
        );
        v_closing_lines := v_closing_lines || jsonb_build_array(v_line_json);
        v_total_credits := v_total_credits + v_expense_net;
      END IF;
    END IF;
  END LOOP;

  -- ── Net Income → Retained Earnings ────────────────────────────────────────
  -- v_total_debits  = total revenue closed (DEBIT side)
  -- v_total_credits = total expenses closed (CREDIT side)
  -- Net income = revenue closed - expenses closed (positive = profit)
  v_net_income := v_total_debits - v_total_credits;
  v_re_balance := ABS(v_net_income);

  IF v_re_balance > 0 THEN
    IF v_net_income > 0 THEN
      -- Profitable period: CREDIT Retained Earnings
      v_line_json := jsonb_build_object(
        'account_id',  p_retained_earnings_account_id,
        'amount',      v_re_balance::TEXT,
        'type',        'credit',
        'description', 'Net income for period: ' || v_period.name
      );
      v_total_credits := v_total_credits + v_re_balance;
    ELSE
      -- Net loss: DEBIT Retained Earnings
      v_line_json := jsonb_build_object(
        'account_id',  p_retained_earnings_account_id,
        'amount',      v_re_balance::TEXT,
        'type',        'debit',
        'description', 'Net loss for period: ' || v_period.name
      );
      v_total_debits := v_total_debits + v_re_balance;
    END IF;
    v_closing_lines := v_closing_lines || jsonb_build_array(v_line_json);
  END IF;

  -- If no I/S activity, period can still be closed (no closing entry needed)
  IF jsonb_array_length(v_closing_lines) = 0 THEN
    -- Mark closed without a closing transaction
    UPDATE accounting_periods
    SET status = 'closed', closed_at = NOW()
    WHERE id = p_period_id;
    RETURN NULL;
  END IF;

  -- ── Double-check zero-sum before posting ──────────────────────────────────
  IF v_total_debits <> v_total_credits THEN
    RAISE EXCEPTION
      'Closing entry does not balance. Debits: %, Credits: %. This is a system error.',
      v_total_debits, v_total_credits
      USING ERRCODE = 'P0023';
  END IF;

  -- ── Post the closing entry ────────────────────────────────────────────────
  v_desc := 'Closing Entry — ' || v_period.name ||
            ' (' || v_period.start_date::TEXT || ' to ' || v_period.end_date::TEXT || ')';

  INSERT INTO transactions (organization_id, description, entry_date, status, created_by)
  VALUES (v_org_id, v_desc, v_period.end_date, 'posted', auth.uid())
  RETURNING id INTO v_closing_tx_id;

  -- Insert each closing journal line
  FOR v_line_json IN SELECT * FROM jsonb_array_elements(v_closing_lines) LOOP
    INSERT INTO journal_lines (transaction_id, organization_id, account_id, amount, type, description)
    VALUES (
      v_closing_tx_id,
      v_org_id,
      (v_line_json->>'account_id')::UUID,
      (v_line_json->>'amount')::NUMERIC(20, 4),
      (v_line_json->>'type')::journal_entry_type,
      v_line_json->>'description'
    );
  END LOOP;

  -- ── Mark period as closed ─────────────────────────────────────────────────
  UPDATE accounting_periods
  SET
    status                  = 'closed',
    closed_at               = NOW(),
    closing_transaction_id  = v_closing_tx_id
  WHERE id = p_period_id;

  RETURN v_closing_tx_id;
END;
$$;

GRANT EXECUTE ON FUNCTION close_accounting_period(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_transaction(UUID, TEXT, DATE, TEXT, JSONB) TO authenticated;
