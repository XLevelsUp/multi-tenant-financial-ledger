-- ============================================================================
-- Migration 009: Draft Edit & Posting Flow
-- Adds the update_draft_transaction RPC for atomically replacing journal lines
-- on a draft transaction and optionally promoting it to posted status.
-- ============================================================================

-- BUGFIX: prevent_posted_modification (migration 002) returned OLD unconditionally.
-- For BEFORE UPDATE triggers, returning OLD silently discards the new values,
-- making every UPDATE on transactions a no-op. Fix: return NEW for UPDATE ops.
CREATE OR REPLACE FUNCTION prevent_posted_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status transaction_status;
BEGIN
  IF TG_TABLE_NAME = 'transactions' THEN
    v_status := COALESCE(OLD.status, 'draft'::transaction_status);
  ELSIF TG_TABLE_NAME = 'journal_lines' THEN
    SELECT status INTO v_status
    FROM transactions
    WHERE id = OLD.transaction_id;
  END IF;

  IF v_status = 'posted' THEN
    RAISE EXCEPTION 'Cannot modify or delete a posted transaction. Create a reversal entry instead.'
      USING ERRCODE = 'P0001';
  END IF;

  -- DELETE triggers must return OLD; UPDATE triggers must return NEW.
  -- Returning OLD on an UPDATE silently applies the old row (no-op).
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION update_draft_transaction(
    p_tx_id       UUID,
    p_org_id      UUID,
    p_description TEXT,
    p_entry_date  DATE,
    p_status      TEXT,
    p_lines       JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_status  transaction_status;
    v_new_status       transaction_status;
    v_total_debits     NUMERIC(20, 4) := 0;
    v_total_credits    NUMERIC(20, 4) := 0;
    v_line             JSONB;
    v_amount           NUMERIC(20, 4);
    v_line_type        TEXT;
    v_account_id       UUID;
BEGIN
    -- 1. Authorization: caller must be a member of p_org_id
    IF p_org_id NOT IN (SELECT get_active_organizations()) THEN
        RAISE EXCEPTION 'Access denied: you are not a member of this organization'
            USING ERRCODE = 'P0002';
    END IF;

    -- 2. Existence + org scoping check
    SELECT status INTO v_existing_status
    FROM transactions
    WHERE id = p_tx_id
      AND organization_id = p_org_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found in this organization'
            USING ERRCODE = 'P0030';
    END IF;

    -- 3. Mutability guard: only drafts are editable
    IF v_existing_status = 'posted' THEN
        RAISE EXCEPTION 'Cannot edit a posted transaction. Create a reversal entry instead.'
            USING ERRCODE = 'P0031';
    END IF;

    -- 4. Parse and validate target status
    BEGIN
        v_new_status := p_status::transaction_status;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Invalid status value: %. Must be draft or posted.', p_status
            USING ERRCODE = 'P0003';
    END;

    -- 5. Closed accounting period guard
    IF EXISTS (
        SELECT 1
        FROM accounting_periods
        WHERE organization_id = p_org_id
          AND status = 'closed'
          AND p_entry_date BETWEEN start_date AND end_date
    ) THEN
        RAISE EXCEPTION
            'Cannot post to a closed accounting period. The entry date % falls within a closed period.',
            p_entry_date
            USING ERRCODE = 'P0011';
    END IF;

    -- 6. Line count guard
    IF p_lines IS NULL OR jsonb_array_length(p_lines) < 2 THEN
        RAISE EXCEPTION 'A transaction requires at least 2 journal lines.'
            USING ERRCODE = 'P0004';
    END IF;

    -- 7. Validate each line and accumulate balance totals
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_amount     := (v_line ->> 'amount')::NUMERIC(20, 4);
        v_line_type  := v_line ->> 'type';
        v_account_id := (v_line ->> 'account_id')::UUID;

        IF v_amount <= 0 THEN
            RAISE EXCEPTION 'Line amount must be positive, got: %', v_amount
                USING ERRCODE = 'P0005';
        END IF;

        IF v_line_type NOT IN ('debit', 'credit') THEN
            RAISE EXCEPTION 'Line type must be debit or credit, got: %', v_line_type
                USING ERRCODE = 'P0006';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM accounts
            WHERE id = v_account_id
              AND organization_id = p_org_id
              AND is_active = TRUE
        ) THEN
            RAISE EXCEPTION 'Account % not found or inactive in this organization', v_account_id
                USING ERRCODE = 'P0032';
        END IF;

        IF v_line_type = 'debit' THEN
            v_total_debits := v_total_debits + v_amount;
        ELSE
            v_total_credits := v_total_credits + v_amount;
        END IF;
    END LOOP;

    -- 8. Zero-sum enforcement
    IF v_total_debits <> v_total_credits THEN
        RAISE EXCEPTION 'Journal entries do not balance: debits=% credits=%',
            v_total_debits, v_total_credits
            USING ERRCODE = 'P0007';
    END IF;

    -- 9. DELETE old lines FIRST — parent transaction is still 'draft' here,
    --    so the prevent_posted_modification trigger on journal_lines will allow it.
    DELETE FROM journal_lines
    WHERE transaction_id = p_tx_id
      AND organization_id = p_org_id;

    -- 10. UPDATE transaction header (may flip status to 'posted')
    UPDATE transactions
    SET description = p_description,
        entry_date  = p_entry_date,
        status      = v_new_status
    WHERE id = p_tx_id;

    -- 11. INSERT new journal lines (trigger only fires on UPDATE/DELETE, not INSERT)
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO journal_lines (
            organization_id,
            transaction_id,
            account_id,
            amount,
            type,
            description
        ) VALUES (
            p_org_id,
            p_tx_id,
            (v_line ->> 'account_id')::UUID,
            (v_line ->> 'amount')::NUMERIC(20, 4),
            (v_line ->> 'type')::journal_entry_type,
            v_line ->> 'description'
        );
    END LOOP;

    RETURN p_tx_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_draft_transaction(UUID, UUID, TEXT, DATE, TEXT, JSONB) TO authenticated;
