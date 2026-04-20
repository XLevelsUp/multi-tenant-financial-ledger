-- ============================================================================
-- PHASE 5.1 (ALT) — SYSTEM ADMIN: CENTRALIZED TENANT PROVISIONING
-- ============================================================================
-- Adds the is_system_admin flag to profiles and a helper function for
-- checking system admin status. Provisioning is done via service-role
-- Server Actions; no new RLS policies are required.
-- ============================================================================

-- Step 1: Add the is_system_admin column to profiles.
-- NOT NULL DEFAULT FALSE avoids three-valued boolean logic.
-- IF NOT EXISTS makes this idempotent (safe to re-run in dev).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Step 2: Helper function for checking system admin status.
-- Mirrors the style of is_org_admin_or_owner() from migration 006.
-- Used by future RLS policies and can be called directly in SQL.
-- Returns FALSE (not NULL) for unauthenticated callers via COALESCE.
CREATE OR REPLACE FUNCTION is_current_user_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_system_admin FROM profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

-- NOTE: No new RLS policies are added here.
-- The provisioning Server Action runs under the service role (admin client),
-- which bypasses RLS entirely. Auth enforcement is handled application-side
-- via explicit profile queries in the Server Action and system layout.

-- ============================================================================
-- MANUAL BOOTSTRAPPING REQUIRED
-- ============================================================================
-- After applying this migration, grant yourself system admin access by
-- executing the following in the Supabase SQL editor:
--
--   UPDATE profiles SET is_system_admin = TRUE WHERE email = 'your@email.com';
--
-- There is intentionally no UI for this operation. It must be a deliberate,
-- out-of-band action performed directly against the database.
-- ============================================================================
