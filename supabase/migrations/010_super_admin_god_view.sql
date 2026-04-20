-- ============================================================================
-- Migration 010: Super Admin "God View" & Global Financial Aggregations
-- ============================================================================
-- Part A: Updates get_active_organizations() to grant system admins cross-tenant
--         access. All existing RLS policies inherit the change automatically.
-- Part B: Creates the global_org_financials view for the Super Admin dashboard.
-- ============================================================================

-- PART A: RLS MASTER KEY UPDATE
-- ============================================================================
-- Converts the function from pure SQL to plpgsql to support conditional logic.
-- System admins receive all org IDs; regular members receive only their orgs.
-- All 20+ existing RLS policies call this function — no policy changes needed.

CREATE OR REPLACE FUNCTION get_active_organizations()
RETURNS SETOF UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT COALESCE(is_system_admin, FALSE) INTO v_is_admin
  FROM profiles
  WHERE id = auth.uid();

  IF v_is_admin THEN
    -- System admin: return every organization in the platform
    RETURN QUERY SELECT id FROM organizations;
  ELSE
    -- Regular member: return only orgs this user belongs to
    RETURN QUERY SELECT organization_id FROM memberships WHERE user_id = auth.uid();
  END IF;
END;
$$;

-- PART B: GLOBAL FINANCIAL VIEW
-- ============================================================================
-- Aggregates per-organization income, expense, and net profit from all posted
-- transactions. Uses LEFT JOINs so organizations with zero activity still appear.
-- Accounting conventions:
--   total_income  = credits to revenue accounts (revenue normal balance = credit)
--   total_expense = debits  to expense accounts (expense normal balance = debit)

CREATE OR REPLACE VIEW global_org_financials AS
SELECT
  o.id                                                                              AS org_id,
  o.name                                                                            AS org_name,
  o.slug                                                                            AS org_slug,
  COALESCE(SUM(CASE WHEN a.type = 'revenue' AND jl.type = 'credit' THEN jl.amount ELSE 0 END), 0) AS total_income,
  COALESCE(SUM(CASE WHEN a.type = 'expense' AND jl.type = 'debit'  THEN jl.amount ELSE 0 END), 0) AS total_expense,
  COALESCE(SUM(CASE WHEN a.type = 'revenue' AND jl.type = 'credit' THEN jl.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN a.type = 'expense' AND jl.type = 'debit' THEN jl.amount ELSE 0 END), 0) AS net_profit,
  COUNT(DISTINCT t.id)                                                              AS transaction_count,
  (SELECT COUNT(*) FROM memberships m WHERE m.organization_id = o.id)              AS member_count
FROM organizations o
LEFT JOIN transactions  t  ON t.organization_id = o.id AND t.status = 'posted'
LEFT JOIN journal_lines jl ON jl.transaction_id = t.id
LEFT JOIN accounts      a  ON a.id = jl.account_id
GROUP BY o.id, o.name, o.slug;
