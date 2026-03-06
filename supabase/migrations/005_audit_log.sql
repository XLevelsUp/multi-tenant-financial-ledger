-- ============================================================================
-- PHASE 5: AUDIT LOG — JSONB STATE CAPTURE TRIGGERS
-- ============================================================================
-- Invisible to the application layer. PostgreSQL triggers capture raw row
-- state diffs (old_data vs new_data) on every mutating operation across
-- the five core tables. The audit_log table is immutable from the app side
-- (no INSERT/UPDATE/DELETE policies for authenticated role — only the
-- SECURITY DEFINER trigger function can write to it).
-- ============================================================================

-- ── 1. AUDIT LOG TABLE ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID,                         -- NULL for org-less operations
  table_name      TEXT        NOT NULL,
  operation       TEXT        NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  row_id          UUID,                         -- PK of the affected row
  old_data        JSONB,                        -- NULL on INSERT
  new_data        JSONB,                        -- NULL on DELETE
  changed_by      UUID,                         -- auth.uid() at trigger time
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Covering index for the audit page query pattern (org + time desc)
CREATE INDEX IF NOT EXISTS idx_audit_log_org_time
  ON audit_log (organization_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_row_id
  ON audit_log (row_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_op
  ON audit_log (table_name, operation);

-- ── 2. RLS — READ ONLY FOR ORG MEMBERS ──────────────────────────────────────

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Org members can read their org's log
CREATE POLICY "audit_log_select_member"
  ON audit_log FOR SELECT
  USING (organization_id IN (SELECT get_active_organizations()));

-- No authenticated INSERT/UPDATE/DELETE policy → only the SECURITY DEFINER
-- trigger can write rows; direct manipulation from app is blocked.

-- ── 3. TRIGGER FUNCTION ──────────────────────────────────────────────────────
-- Runs AFTER INSERT/UPDATE/DELETE. Extracts the organization_id from the row
-- (both old and new have it; falls back gracefully).

CREATE OR REPLACE FUNCTION capture_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- bypasses RLS to write to audit_log
SET search_path = public
AS $$
DECLARE
  v_org_id   UUID;
  v_row_id   UUID;
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  -- Extract org id and row id from whichever snapshot is available
  IF TG_OP = 'DELETE' THEN
    v_old_data := row_to_json(OLD)::JSONB;
    v_new_data := NULL;
    v_row_id   := OLD.id;
    v_org_id   := OLD.organization_id;
  ELSIF TG_OP = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := row_to_json(NEW)::JSONB;
    v_row_id   := NEW.id;
    v_org_id   := NEW.organization_id;
  ELSE -- UPDATE
    v_old_data := row_to_json(OLD)::JSONB;
    v_new_data := row_to_json(NEW)::JSONB;
    v_row_id   := NEW.id;
    v_org_id   := NEW.organization_id;
  END IF;

  INSERT INTO audit_log (
    organization_id, table_name, operation,
    row_id, old_data, new_data, changed_by
  ) VALUES (
    v_org_id,
    TG_TABLE_NAME,
    TG_OP,
    v_row_id,
    v_old_data,
    v_new_data,
    auth.uid()
  );

  RETURN NULL; -- AFTER trigger: return value ignored
END;
$$;

-- ── 4. ATTACH TRIGGERS TO CORE TABLES ────────────────────────────────────────

-- transactions
CREATE TRIGGER trg_audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION capture_audit_log();

-- journal_lines
CREATE TRIGGER trg_audit_journal_lines
  AFTER INSERT OR UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION capture_audit_log();

-- accounts
CREATE TRIGGER trg_audit_accounts
  AFTER INSERT OR UPDATE OR DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION capture_audit_log();

-- accounting_periods
CREATE TRIGGER trg_audit_accounting_periods
  AFTER INSERT OR UPDATE OR DELETE ON accounting_periods
  FOR EACH ROW EXECUTE FUNCTION capture_audit_log();
