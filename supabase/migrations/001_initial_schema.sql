-- ============================================================================
-- PHASE 1: MULTI-TENANT FINANCIAL LEDGER - INITIAL SCHEMA
-- ============================================================================
-- This migration creates the core tables, types, functions, triggers, and
-- Row-Level Security (RLS) policies for a multi-tenant financial ledger.
-- ============================================================================

-- 1. EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CUSTOM TYPES
-- ----------------------------------------------------------------------------
CREATE TYPE membership_role AS ENUM ('owner', 'admin', 'member');

-- 3. TABLES
-- ----------------------------------------------------------------------------

-- Organizations: The top-level tenant container.
CREATE TABLE organizations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles: Extends auth.users with application-specific data.
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT,
  email      TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Memberships: Links users to organizations with a specific role.
CREATE TABLE memberships (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role            membership_role NOT NULL DEFAULT 'member',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

-- Ledger Entries: Financial transaction records, strictly tenant-isolated.
CREATE TABLE ledger_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount          NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_organization_id ON memberships(organization_id);
CREATE INDEX idx_ledger_entries_organization_id ON ledger_entries(organization_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- 5. FUNCTIONS
-- ----------------------------------------------------------------------------

-- Returns the UUIDs of organizations the currently authenticated user belongs to.
-- Used by RLS policies to enforce tenant isolation.
CREATE OR REPLACE FUNCTION get_active_organizations()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM memberships
  WHERE user_id = auth.uid();
$$;

-- Automatically creates a profile row when a new user signs up via Supabase Auth.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

-- 6. TRIGGERS
-- ----------------------------------------------------------------------------
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 7. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------

-- Enable RLS on all tables.
ALTER TABLE organizations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----
-- Users can only read their own profile.
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can only update their own profile.
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---- ORGANIZATIONS ----
-- Users can only read organizations they are a member of.
CREATE POLICY "organizations_select_member"
  ON organizations FOR SELECT
  USING (id IN (SELECT get_active_organizations()));

-- Allow authenticated users to insert new organizations (they will become owner).
CREATE POLICY "organizations_insert_authenticated"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- MEMBERSHIPS ----
-- Users can only read memberships for organizations they belong to.
CREATE POLICY "memberships_select_member"
  ON memberships FOR SELECT
  USING (organization_id IN (SELECT get_active_organizations()));

-- Allow authenticated users to insert memberships (for org creation flow).
CREATE POLICY "memberships_insert_authenticated"
  ON memberships FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- LEDGER ENTRIES ----
-- SELECT: Only entries belonging to user's active organizations.
CREATE POLICY "ledger_entries_select_member"
  ON ledger_entries FOR SELECT
  USING (organization_id IN (SELECT get_active_organizations()));

-- INSERT: Only into user's active organizations.
CREATE POLICY "ledger_entries_insert_member"
  ON ledger_entries FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_active_organizations()));

-- UPDATE: Only entries in user's active organizations.
CREATE POLICY "ledger_entries_update_member"
  ON ledger_entries FOR UPDATE
  USING (organization_id IN (SELECT get_active_organizations()))
  WITH CHECK (organization_id IN (SELECT get_active_organizations()));

-- DELETE: Only entries in user's active organizations.
CREATE POLICY "ledger_entries_delete_member"
  ON ledger_entries FOR DELETE
  USING (organization_id IN (SELECT get_active_organizations()));
