"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MembershipRole } from "@/types/database";

export type MemberActionResult =
    | { success: true }
    | { success: false; error: string };

// ── Shared privilege check ────────────────────────────────────────────────────

async function getCallerRole(organizationId: string, userId: string): Promise<MembershipRole | null> {
    const admin = createAdminClient();
    const { data } = await admin
        .from("memberships")
        .select("role")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .single();
    return (data?.role as MembershipRole) ?? null;
}

// ── updateMemberRoleAction ────────────────────────────────────────────────────

export async function updateMemberRoleAction(
    membershipId: string,
    organizationId: string,
    newRole: MembershipRole,
    orgSlug: string
): Promise<MemberActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const callerRole = await getCallerRole(organizationId, user.id);
    if (!callerRole || !["owner", "admin"].includes(callerRole)) {
        return { success: false, error: "Insufficient permissions." };
    }

    // Only owners can assign/change to owner role
    if (newRole === "owner" && callerRole !== "owner") {
        return { success: false, error: "Only an owner can transfer the owner role." };
    }

    const admin = createAdminClient();

    // Fetch the target membership to check target role
    const { data: target } = await admin
        .from("memberships")
        .select("role, user_id")
        .eq("id", membershipId)
        .eq("organization_id", organizationId)
        .single();

    if (!target) return { success: false, error: "Membership not found." };

    // Admins cannot modify other admins or owners
    if (callerRole === "admin" && target.role !== "member") {
        return { success: false, error: "Admins can only change the role of regular members." };
    }

    // Cannot change your own role
    if (target.user_id === user.id) {
        return { success: false, error: "You cannot change your own role." };
    }

    const { error } = await admin
        .from("memberships")
        .update({ role: newRole })
        .eq("id", membershipId)
        .eq("organization_id", organizationId);

    if (error) {
        if (error.message?.includes("last owner")) {
            return { success: false, error: "Cannot demote the last owner. Transfer ownership first." };
        }
        console.error("updateMemberRoleAction error:", error);
        return { success: false, error: "Failed to update role." };
    }

    revalidatePath(`/${orgSlug}/settings/members`);
    return { success: true };
}

// ── removeMemberAction ───────────────────────────────────────────────────────

export async function removeMemberAction(
    membershipId: string,
    organizationId: string,
    orgSlug: string
): Promise<MemberActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const callerRole = await getCallerRole(organizationId, user.id);
    if (!callerRole || !["owner", "admin"].includes(callerRole)) {
        return { success: false, error: "Insufficient permissions." };
    }

    const admin = createAdminClient();

    // Get target to enforce permission rules
    const { data: target } = await admin
        .from("memberships")
        .select("role, user_id")
        .eq("id", membershipId)
        .eq("organization_id", organizationId)
        .single();

    if (!target) return { success: false, error: "Membership not found." };

    // Cannot remove yourself
    if (target.user_id === user.id) {
        return { success: false, error: "You cannot remove yourself from the organization." };
    }

    // Admins cannot remove owners or other admins
    if (callerRole === "admin" && target.role !== "member") {
        return { success: false, error: "Admins can only remove regular members." };
    }

    // Only owners can remove other owners
    if (target.role === "owner" && callerRole !== "owner") {
        return { success: false, error: "Only an owner can remove another owner." };
    }

    const { error } = await admin
        .from("memberships")
        .delete()
        .eq("id", membershipId)
        .eq("organization_id", organizationId);

    if (error) {
        // Catch the last-owner guard (ERRCODE P0030)
        if (error.message?.includes("last owner") || error.code === "P0030") {
            return {
                success: false,
                error: "Cannot remove the last owner of the organization. Transfer ownership to another member first.",
            };
        }
        console.error("removeMemberAction error:", error);
        return { success: false, error: "Failed to remove member." };
    }

    revalidatePath(`/${orgSlug}/settings/members`);
    return { success: true };
}
