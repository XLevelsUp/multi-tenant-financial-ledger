-- ============================================================================
-- PHASE 3: FINANCIAL REPORTING ENGINE
-- ============================================================================
-- Adds the `get_account_balances` PL/pgSQL aggregation RPC that powers
-- Trial Balance, Income Statement, and Balance Sheet reports.
-- Normal balance rules applied per account_type:
--   asset, expense    → net = SUM(debits) - SUM(credits)
--   liability, equity, revenue → net = SUM(credits) - SUM(debits)
-- ============================================================================

-- 1. FINANCIAL AGGREGATION RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION get_account_balances(
  p_org_id     UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date   DATE DEFAULT NULL
)
RETURNS TABLE (
  account_id   UUID,
  account_name TEXT,
  account_code TEXT,
  account_type account_type,
  total_debits  NUMERIC(20, 4),
  total_credits NUMERIC(20, 4),
  net_balance   NUMERIC(20, 4)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorization: caller must be a member of the target org
  IF p_org_id NOT IN (SELECT get_active_organizations()) THEN
    RAISE EXCEPTION 'Access denied: not a member of organization %', p_org_id
      USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT
    a.id                                                      AS account_id,
    a.name                                                    AS account_name,
    a.code                                                    AS account_code,
    a.type                                                    AS account_type,
    COALESCE(SUM(jl.amount) FILTER (WHERE jl.type = 'debit'),  0)::NUMERIC(20,4)  AS total_debits,
    COALESCE(SUM(jl.amount) FILTER (WHERE jl.type = 'credit'), 0)::NUMERIC(20,4)  AS total_credits,
    CASE
      WHEN a.type IN ('asset', 'expense') THEN
        COALESCE(SUM(jl.amount) FILTER (WHERE jl.type = 'debit'),  0) -
        COALESCE(SUM(jl.amount) FILTER (WHERE jl.type = 'credit'), 0)
      ELSE
        COALESCE(SUM(jl.amount) FILTER (WHERE jl.type = 'credit'), 0) -
        COALESCE(SUM(jl.amount) FILTER (WHERE jl.type = 'debit'),  0)
    END::NUMERIC(20,4)                                        AS net_balance
  FROM  accounts a
  LEFT JOIN journal_lines jl
         ON jl.account_id = a.id
        AND jl.organization_id = p_org_id
  LEFT JOIN transactions t
         ON t.id = jl.transaction_id
        AND t.status = 'posted'
        AND (p_start_date IS NULL OR t.entry_date >= p_start_date)
        AND (p_end_date   IS NULL OR t.entry_date <= p_end_date)
  WHERE a.organization_id = p_org_id
    AND a.is_active = TRUE
  GROUP BY a.id, a.name, a.code, a.type
  ORDER BY a.code;
END;
$$;

-- Grant execute to authenticated users (RLS check is inside the function)
GRANT EXECUTE ON FUNCTION get_account_balances(UUID, DATE, DATE) TO authenticated;
