-- ============================================================================
-- PHASE 5.5: SETTINGS RBAC — RLS HARDENING & LAST-OWNER GUARD
-- ============================================================================
-- Patches the organizations and memberships tables with strict role-based
-- RLS policies ensuring only 'owner' or 'admin' role members can mutate
-- organization settings. A BEFORE trigger prevents removing the last owner.
-- ============================================================================

-- ── Helper: check if caller is owner or admin of a given org ─────────────────

CREATE OR REPLACE FUNCTION is_org_admin_or_owner(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM memberships
    WHERE organization_id = p_org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

-- ── 1. ORGANIZATIONS — UPDATE RLS ────────────────────────────────────────────

-- Drop existing permissive update policy if present
DROP POLICY IF EXISTS "organizations_update_member"    ON organizations;
DROP POLICY IF EXISTS "organizations_update_all"       ON organizations;
DROP POLICY IF EXISTS "org_update_owner_admin"         ON organizations;

CREATE POLICY "org_update_owner_admin"
  ON organizations FOR UPDATE
  TO authenticated
  USING  (is_org_admin_or_owner(id))
  WITH CHECK (is_org_admin_or_owner(id));

-- ── 2. MEMBERSHIPS — INSERT RLS ──────────────────────────────────────────────

DROP POLICY IF EXISTS "memberships_insert_authenticated" ON memberships;
DROP POLICY IF EXISTS "memberships_insert_all"           ON memberships;
DROP POLICY IF EXISTS "memberships_insert_admin_owner"   ON memberships;

CREATE POLICY "memberships_insert_admin_owner"
  ON memberships FOR INSERT
  TO authenticated
  WITH CHECK (is_org_admin_or_owner(organization_id));

-- ── 3. MEMBERSHIPS — UPDATE RLS ──────────────────────────────────────────────

DROP POLICY IF EXISTS "memberships_update_member"      ON memberships;
DROP POLICY IF EXISTS "memberships_update_all"         ON memberships;
DROP POLICY IF EXISTS "memberships_update_admin_owner" ON memberships;

CREATE POLICY "memberships_update_admin_owner"
  ON memberships FOR UPDATE
  TO authenticated
  USING  (is_org_admin_or_owner(organization_id))
  WITH CHECK (is_org_admin_or_owner(organization_id));

-- ── 4. MEMBERSHIPS — DELETE RLS ──────────────────────────────────────────────

DROP POLICY IF EXISTS "memberships_delete_member"      ON memberships;
DROP POLICY IF EXISTS "memberships_delete_all"         ON memberships;
DROP POLICY IF EXISTS "memberships_delete_admin_owner" ON memberships;

CREATE POLICY "memberships_delete_admin_owner"
  ON memberships FOR DELETE
  TO authenticated
  USING (is_org_admin_or_owner(organization_id));

-- ── 5. LAST-OWNER GUARD TRIGGER ──────────────────────────────────────────────
-- Fires BEFORE UPDATE OR DELETE on memberships.
-- Prevents changing the role away from 'owner' or deleting a membership
-- when that member is the sole remaining owner of the organization.

CREATE OR REPLACE FUNCTION prevent_last_owner_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_org_id UUID;
  v_owner_count INTEGER;
BEGIN
  -- Determine the org and whether this impacts an owner
  IF TG_OP = 'DELETE' THEN
    v_org_id := OLD.organization_id;
    -- Only proceed if removing an owner
    IF OLD.role <> 'owner' THEN
      RETURN OLD;
    END IF;
  ELSE -- UPDATE
    v_org_id := OLD.organization_id;
    -- Only proceed if downgrading an owner to a non-owner role
    IF OLD.role <> 'owner' OR NEW.role = 'owner' THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Count remaining owners (excluding the row being modified)
  SELECT COUNT(*)
  INTO v_owner_count
  FROM memberships
  WHERE organization_id = v_org_id
    AND role = 'owner'
    AND id <> OLD.id;  -- exclude current row

  IF v_owner_count = 0 THEN
    RAISE EXCEPTION
      'Cannot remove the last owner of an organization. '
      'Transfer ownership to another member first.'
      USING ERRCODE = 'P0030';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_prevent_last_owner_removal
  BEFORE UPDATE OR DELETE ON memberships
  FOR EACH ROW EXECUTE FUNCTION prevent_last_owner_removal();
