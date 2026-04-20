"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Return Type ─────────────────────────────────────────────────────────────

export type ProvisionTenantResult =
    | { success: true; email: string; password: string; orgName: string; orgSlug: string }
    | { success: false; error: string };

// ─── Validation Schema ────────────────────────────────────────────────────────

const ProvisionTenantSchema = z.object({
    orgName: z.string().min(2).max(100),
    adminEmail: z.string().email(),
    adminPassword: z.string().min(12).max(128),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 48);
}

// ─── Server Action ────────────────────────────────────────────────────────────

export async function provisionTenantAction(data: {
    orgName: string;
    adminEmail: string;
    adminPassword: string;
}): Promise<ProvisionTenantResult> {

    // Step 1: Validate inputs
    const parsed = ProvisionTenantSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
    }
    const { orgName, adminEmail, adminPassword } = parsed.data;

    // Step 2: Verify the caller is authenticated (user client respects RLS/Auth)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return { success: false, error: "Not authenticated." };
    }

    // Step 3: Verify caller is a system admin.
    // Query via admin client directly — the is_current_user_system_admin() RPC
    // reads auth.uid() from the DB session context, which is not set when
    // running under the service role. Direct profile query is authoritative.
    const admin = createAdminClient();
    const { data: callerProfile, error: profileError } = await admin
        .from("profiles")
        .select("is_system_admin")
        .eq("id", user.id)
        .single();

    if (profileError || !callerProfile?.is_system_admin) {
        return { success: false, error: "Insufficient privileges." };
    }

    // Step 4: Generate and validate the slug
    const slug = slugify(orgName);
    if (!slug) {
        return { success: false, error: "Cannot generate a valid slug from that organization name." };
    }

    const { data: existingOrg } = await admin
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

    if (existingOrg) {
        return {
            success: false,
            error: `An organization with the slug "${slug}" already exists. Try a different name.`,
        };
    }

    // Step 5: Create the auth user via the Admin API.
    // email_confirm: true bypasses the email confirmation flow — the admin
    // delivers credentials out-of-band. The handle_new_user trigger fires
    // synchronously (PostgreSQL FOR EACH ROW), so the profiles row is
    // guaranteed to exist by the time this await resolves.
    const { data: newAuthUser, error: createUserError } = await admin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
    });

    if (createUserError || !newAuthUser.user) {
        return {
            success: false,
            error: createUserError?.message ?? "Failed to create user account.",
        };
    }

    const newUserId = newAuthUser.user.id;

    // Step 6: Create the organization.
    // On failure, roll back the auth user to prevent orphaned accounts.
    const { data: org, error: orgError } = await admin
        .from("organizations")
        .insert({ name: orgName.trim(), slug })
        .select()
        .single();

    if (orgError || !org) {
        console.error("[provisioning] Failed to create organization:", orgError);
        await admin.auth.admin.deleteUser(newUserId);
        return { success: false, error: "Failed to create organization. The user account has been rolled back." };
    }

    // Step 7: Create the owner membership.
    // On failure, delete org first (cascades any partial memberships), then the user.
    const { error: membershipError } = await admin
        .from("memberships")
        .insert({
            organization_id: org.id,
            user_id: newUserId,
            role: "owner",
        });

    if (membershipError) {
        console.error("[provisioning] Failed to create membership:", membershipError);
        await admin.from("organizations").delete().eq("id", org.id);
        await admin.auth.admin.deleteUser(newUserId);
        return { success: false, error: "Failed to bind user to organization. All changes have been rolled back." };
    }

    // Step 8: Return the provisioned credentials for the admin to copy.
    // This is the only time the plaintext password is available.
    return {
        success: true,
        email: adminEmail,
        password: adminPassword,
        orgName: orgName.trim(),
        orgSlug: slug,
    };
}
