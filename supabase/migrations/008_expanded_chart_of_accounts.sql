-- ============================================================================
-- PHASE 5.1 — EXPANDED CHART OF ACCOUNTS
-- ============================================================================
-- Adds operational expense categories required across all 4 active orgs:
--   ALUSEA         (aluminium doors & windows manufacturing)
--   Wandering Kite (photography studio)
--   Pratyagra Silks(silk saree boutique)
--   Xlevelsup      (software / IT company)
--
-- EXISTING ACCOUNTS ALREADY COVERED (no change needed):
--   5100  Salaries Expense  → covers "Salary"
--   5200  Rent Expense      → covers "Rent"
--   1500  Equipment         → covers "Equipment" (as fixed asset)
--
-- NEW ADDITIONS — see groupings below.
-- ============================================================================

-- Step 1: Replace the seed function with the full expanded account list.
-- The ON CONFLICT DO NOTHING guard makes this safe to call on any org,
-- existing or new — it only inserts accounts that are not yet present.
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_default_chart_of_accounts(p_organization_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO accounts (organization_id, code, name, type) VALUES

    -- ── ASSETS ──────────────────────────────────────────────────────────────
    (p_organization_id, '1000', 'Cash',                        'asset'),
    (p_organization_id, '1100', 'Accounts Receivable',         'asset'),
    (p_organization_id, '1200', 'Inventory',                   'asset'),
    (p_organization_id, '1300', 'Advance Payments',            'asset'),   -- NEW: advances paid to suppliers/contractors
    (p_organization_id, '1500', 'Equipment',                   'asset'),
    (p_organization_id, '1600', 'Machinery',                   'asset'),   -- NEW: factory/production machinery (ALUSEA)

    -- ── LIABILITIES ─────────────────────────────────────────────────────────
    (p_organization_id, '2000', 'Accounts Payable',            'liability'),
    (p_organization_id, '2100', 'Accrued Expenses',            'liability'),
    (p_organization_id, '2200', 'Customer Advances Received',  'liability'), -- NEW: advance payments received from clients
    (p_organization_id, '2500', 'Long-Term Debt',              'liability'),

    -- ── EQUITY ──────────────────────────────────────────────────────────────
    (p_organization_id, '3000', 'Owner''s Equity',             'equity'),
    (p_organization_id, '3100', 'Retained Earnings',           'equity'),

    -- ── REVENUE ─────────────────────────────────────────────────────────────
    (p_organization_id, '4000', 'Sales Revenue',               'revenue'),
    (p_organization_id, '4100', 'Service Revenue',             'revenue'),

    -- ── EXPENSES: Core ──────────────────────────────────────────────────────
    (p_organization_id, '5000', 'Cost of Goods Sold',          'expense'),
    (p_organization_id, '5100', 'Salaries Expense',            'expense'),  -- covers "Salary"
    (p_organization_id, '5200', 'Rent Expense',                'expense'),  -- covers "Rent"
    (p_organization_id, '5300', 'Utilities Expense',           'expense'),
    (p_organization_id, '5400', 'Depreciation Expense',        'expense'),

    -- ── EXPENSES: Labour ────────────────────────────────────────────────────
    -- General contract/daily labour; org-specific types below.
    (p_organization_id, '5500', 'Labour',                      'expense'),  -- NEW
    (p_organization_id, '5510', 'Paint Labour',                'expense'),  -- NEW (ALUSEA)
    (p_organization_id, '5520', 'Window Fitting Labour',       'expense'),  -- NEW (ALUSEA)
    (p_organization_id, '5530', 'Electrical Labour',           'expense'),  -- NEW
    (p_organization_id, '5540', 'Carpentry Labour',            'expense'),  -- NEW

    -- ── EXPENSES: Materials & Purchases ─────────────────────────────────────
    (p_organization_id, '5600', 'Paint & Materials',           'expense'),  -- NEW (ALUSEA)
    (p_organization_id, '5610', 'Interior Materials',          'expense'),  -- NEW
    (p_organization_id, '5620', 'Electrical Materials',        'expense'),  -- NEW
    (p_organization_id, '5630', 'Carpentry Materials',         'expense'),  -- NEW
    (p_organization_id, '5640', 'Saree Purchase',              'expense'),  -- NEW (Pratyagra Silks — COGS)

    -- ── EXPENSES: Operations & Facilities ───────────────────────────────────
    (p_organization_id, '5700', 'Factory Overhead',            'expense'),  -- NEW (ALUSEA)
    (p_organization_id, '5710', 'Showroom & Windows',          'expense'),  -- NEW (ALUSEA — showroom display costs)
    (p_organization_id, '5800', 'Logistics & Shipping',        'expense'),  -- NEW
    (p_organization_id, '5810', 'Marketing & Advertising',     'expense'),  -- NEW
    (p_organization_id, '5820', 'Commuting & Travel',          'expense'),  -- NEW
    (p_organization_id, '5830', 'Food & Meals',                'expense'),  -- NEW
    (p_organization_id, '5840', 'Equipment Purchase',          'expense'),  -- NEW (small equipment expensed directly)

    -- ── EXPENSES: Technology ────────────────────────────────────────────────
    (p_organization_id, '5900', 'Software Expenses',           'expense'),  -- NEW (Xlevelsup)
    (p_organization_id, '5910', 'Hardware Expenses',           'expense')   -- NEW (Xlevelsup)

  ON CONFLICT (organization_id, code) DO NOTHING;
END;
$$;

-- ============================================================================
-- Step 2: Backfill all existing organizations with the new accounts.
-- ON CONFLICT DO NOTHING guarantees zero impact on accounts that already exist.
-- Only the net-new accounts (codes not yet present) will be inserted.
-- ============================================================================
DO $$
DECLARE
  v_org_id UUID;
BEGIN
  FOR v_org_id IN SELECT id FROM organizations LOOP
    PERFORM seed_default_chart_of_accounts(v_org_id);
  END LOOP;
END;
$$;
