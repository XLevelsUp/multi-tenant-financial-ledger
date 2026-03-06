-- ============================================================================
-- PHASE 2: DOUBLE-ENTRY LEDGER ENGINE
-- ============================================================================
-- Implements Chart of Accounts, Transactions, and Journal Lines with:
-- - Strict zero-sum enforcement via atomic PL/pgSQL RPC
-- - Immutability trigger for posted transactions
-- - Full RLS tenant isolation
-- ============================================================================

-- 1. ENUMS
-- ----------------------------------------------------------------------------
CREATE TYPE account_type AS ENUM (
  'asset', 'liability', 'equity', 'revenue', 'expense'
);

CREATE TYPE journal_entry_type AS ENUM ('debit', 'credit');

CREATE TYPE transaction_status AS ENUM ('draft', 'posted');

-- 2. TABLES
-- ----------------------------------------------------------------------------

-- Chart of Accounts: Every organization maintains its own account structure.
CREATE TABLE accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  code            TEXT NOT NULL,
  type            account_type NOT NULL,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

-- Transactions: The header record for a double-entry journal entry.
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  description     TEXT NOT NULL,
  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  status          transaction_status NOT NULL DEFAULT 'draft',
  created_by      UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Journal Lines: The individual debit/credit legs of a transaction.
-- amount is ALWAYS positive; direction is encoded by `type`.
CREATE TABLE journal_lines (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount          NUMERIC(20, 4) NOT NULL CONSTRAINT positive_amount CHECK (amount > 0),
  type            journal_entry_type NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX idx_accounts_organization_id ON accounts(organization_id);
CREATE INDEX idx_transactions_org_date ON transactions(organization_id, entry_date DESC);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_journal_lines_transaction_id ON journal_lines(transaction_id);
CREATE INDEX idx_journal_lines_account_id ON journal_lines(account_id);
CREATE INDEX idx_journal_lines_organization_id ON journal_lines(organization_id);

-- 4. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines  ENABLE ROW LEVEL SECURITY;

-- ---- ACCOUNTS ----
CREATE POLICY "accounts_select_member"
  ON accounts FOR SELECT
  USING (organization_id IN (SELECT get_active_organizations()));

CREATE POLICY "accounts_insert_member"
  ON accounts FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_active_organizations()));

CREATE POLICY "accounts_update_member"
  ON accounts FOR UPDATE
  USING (organization_id IN (SELECT get_active_organizations()))
  WITH CHECK (organization_id IN (SELECT get_active_organizations()));

-- ---- TRANSACTIONS ----
CREATE POLICY "transactions_select_member"
  ON transactions FOR SELECT
  USING (organization_id IN (SELECT get_active_organizations()));

CREATE POLICY "transactions_insert_member"
  ON transactions FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_active_organizations()));

CREATE POLICY "transactions_update_member"
  ON transactions FOR UPDATE
  USING (organization_id IN (SELECT get_active_organizations()))
  WITH CHECK (organization_id IN (SELECT get_active_organizations()));

-- ---- JOURNAL LINES ----
CREATE POLICY "journal_lines_select_member"
  ON journal_lines FOR SELECT
  USING (organization_id IN (SELECT get_active_organizations()));

CREATE POLICY "journal_lines_insert_member"
  ON journal_lines FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_active_organizations()));

-- 5. IMMUTABILITY TRIGGER
-- ----------------------------------------------------------------------------
-- Prevents any modification or deletion of posted transactions and their lines.
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
    -- Direct modification of the transactions table
    v_status := COALESCE(OLD.status, 'draft'::transaction_status);
  ELSIF TG_TABLE_NAME = 'journal_lines' THEN
    -- Modification of a journal line — look up its parent transaction status
    SELECT status INTO v_status
    FROM transactions
    WHERE id = OLD.transaction_id;
  END IF;

  IF v_status = 'posted' THEN
    RAISE EXCEPTION 'Cannot modify or delete a posted transaction. Create a reversal entry instead.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN OLD;
END;
$$;

-- Attach immutability trigger to transactions
CREATE TRIGGER immutable_posted_transactions
  BEFORE UPDATE OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_posted_modification();

-- Attach immutability trigger to journal_lines
CREATE TRIGGER immutable_posted_journal_lines
  BEFORE UPDATE OR DELETE ON journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION prevent_posted_modification();

-- 6. ATOMIC RECORD TRANSACTION RPC
-- ============================================================================
-- Records a complete, balanced double-entry transaction atomically.
-- Enforces zero-sum: SUM(debits) must equal SUM(credits).
-- Input p_lines JSON shape: [{account_id, amount, type, description}]
-- ============================================================================
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
  v_transaction_id  UUID;
  v_total_debits    NUMERIC(20, 4) := 0;
  v_total_credits   NUMERIC(20, 4) := 0;
  v_line            JSONB;
  v_amount          NUMERIC(20, 4);
  v_line_type       TEXT;
  v_account_id      UUID;
  v_line_desc       TEXT;
  v_status          transaction_status;
BEGIN
  -- 1. Authorization: Verify caller is a member of the target organization
  IF p_organization_id NOT IN (SELECT get_active_organizations()) THEN
    RAISE EXCEPTION 'Access denied: not a member of organization %', p_organization_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Validate status enum
  BEGIN
    v_status := p_status::transaction_status;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid status value: %. Must be draft or posted.', p_status
      USING ERRCODE = 'P0003';
  END;

  -- 3. Validate lines exist
  IF p_lines IS NULL OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'A transaction requires at least 2 journal lines.'
      USING ERRCODE = 'P0004';
  END IF;

  -- 4. Parse lines and calculate debit/credit totals
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_amount      := (v_line->>'amount')::NUMERIC(20, 4);
    v_line_type   := v_line->>'type';
    v_account_id  := (v_line->>'account_id')::UUID;
    v_line_desc   := v_line->>'description';

    -- Validate amount is positive
    IF v_amount <= 0 THEN
      RAISE EXCEPTION 'Journal line amount must be positive, got: %', v_amount
        USING ERRCODE = 'P0005';
    END IF;

    -- Validate type
    IF v_line_type NOT IN ('debit', 'credit') THEN
      RAISE EXCEPTION 'Journal line type must be debit or credit, got: %', v_line_type
        USING ERRCODE = 'P0006';
    END IF;

    -- Accumulate totals
    IF v_line_type = 'debit' THEN
      v_total_debits := v_total_debits + v_amount;
    ELSE
      v_total_credits := v_total_credits + v_amount;
    END IF;
  END LOOP;

  -- 5. Zero-sum enforcement: Debits MUST equal Credits
  IF v_total_debits <> v_total_credits THEN
    RAISE EXCEPTION 'Journal entries do not balance: debits=% credits=%',
      v_total_debits, v_total_credits
      USING ERRCODE = 'P0007';
  END IF;

  -- 6. Insert the transaction header
  INSERT INTO transactions (
    organization_id,
    description,
    entry_date,
    status,
    created_by
  )
  VALUES (
    p_organization_id,
    p_description,
    p_entry_date,
    v_status,
    auth.uid()
  )
  RETURNING id INTO v_transaction_id;

  -- 7. Insert all journal lines atomically
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO journal_lines (
      organization_id,
      transaction_id,
      account_id,
      amount,
      type,
      description
    )
    VALUES (
      p_organization_id,
      v_transaction_id,
      (v_line->>'account_id')::UUID,
      (v_line->>'amount')::NUMERIC(20, 4),
      (v_line->>'type')::journal_entry_type,
      v_line->>'description'
    );
  END LOOP;

  -- 8. Return the new transaction ID
  RETURN v_transaction_id;
END;
$$;

-- 7. DEFAULT CHART OF ACCOUNTS SEEDER
-- ============================================================================
-- Call this after creating an organization to seed a standard CoA.
-- Usage: SELECT seed_default_chart_of_accounts('your-org-id-here');
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_default_chart_of_accounts(p_organization_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO accounts (organization_id, code, name, type) VALUES
    -- Assets
    (p_organization_id, '1000', 'Cash',                     'asset'),
    (p_organization_id, '1100', 'Accounts Receivable',       'asset'),
    (p_organization_id, '1200', 'Inventory',                 'asset'),
    (p_organization_id, '1500', 'Equipment',                 'asset'),
    -- Liabilities
    (p_organization_id, '2000', 'Accounts Payable',          'liability'),
    (p_organization_id, '2100', 'Accrued Expenses',          'liability'),
    (p_organization_id, '2500', 'Long-Term Debt',            'liability'),
    -- Equity
    (p_organization_id, '3000', 'Owner''s Equity',           'equity'),
    (p_organization_id, '3100', 'Retained Earnings',         'equity'),
    -- Revenue
    (p_organization_id, '4000', 'Sales Revenue',             'revenue'),
    (p_organization_id, '4100', 'Service Revenue',           'revenue'),
    -- Expenses
    (p_organization_id, '5000', 'Cost of Goods Sold',        'expense'),
    (p_organization_id, '5100', 'Salaries Expense',          'expense'),
    (p_organization_id, '5200', 'Rent Expense',              'expense'),
    (p_organization_id, '5300', 'Utilities Expense',         'expense'),
    (p_organization_id, '5400', 'Depreciation Expense',      'expense')
  ON CONFLICT (organization_id, code) DO NOTHING;
END;
$$;
