"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AccountType } from "@/types/database";

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const CreateAccountSchema = z.object({
    organization_id: z.string().uuid(),
    name: z.string().min(1, "Name is required").max(200),
    code: z.string().min(1, "Code is required").max(20).regex(/^[\w-]+$/, "Code must be alphanumeric"),
    type: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
    description: z.string().max(500).optional(),
});

const UpdateAccountSchema = z.object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    name: z.string().min(1).max(200).optional(),
    code: z.string().min(1).max(20).regex(/^[\w-]+$/).optional(),
    description: z.string().max(500).optional(),
    is_active: z.boolean().optional(),
});

export type AccountActionResult =
    | { success: true }
    | { success: false; error: string };

// ── Server Actions ────────────────────────────────────────────────────────────

export async function createAccount(
    input: z.infer<typeof CreateAccountSchema>
): Promise<AccountActionResult> {
    const parsed = CreateAccountSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    // Auth check via user client
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const admin = createAdminClient();
    const { error } = await admin
        .from("accounts")
        .insert({
            organization_id: parsed.data.organization_id,
            name: parsed.data.name,
            code: parsed.data.code,
            type: parsed.data.type as AccountType,
            description: parsed.data.description ?? null,
        });

    if (error) {
        if (error.code === "23505") {
            return { success: false, error: `Account code "${parsed.data.code}" already exists in this organization.` };
        }
        console.error("createAccount error:", error);
        return { success: false, error: "Failed to create account." };
    }

    revalidatePath(`/${parsed.data.organization_id}/accounts`);
    return { success: true };
}

export async function updateAccount(
    input: z.infer<typeof UpdateAccountSchema>
): Promise<AccountActionResult> {
    const parsed = UpdateAccountSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const admin = createAdminClient();

    // Prevent type changes if journal lines exist
    const { data: existing } = await admin
        .from("accounts")
        .select("type")
        .eq("id", parsed.data.id)
        .single();

    if (!existing) return { success: false, error: "Account not found." };

    const { error } = await admin
        .from("accounts")
        .update({
            ...(parsed.data.name !== undefined && { name: parsed.data.name }),
            ...(parsed.data.code !== undefined && { code: parsed.data.code }),
            ...(parsed.data.description !== undefined && { description: parsed.data.description }),
            ...(parsed.data.is_active !== undefined && { is_active: parsed.data.is_active }),
        })
        .eq("id", parsed.data.id)
        .eq("organization_id", parsed.data.organization_id);

    if (error) {
        if (error.code === "23505") {
            return { success: false, error: `Account code "${parsed.data.code}" already exists.` };
        }
        console.error("updateAccount error:", error);
        return { success: false, error: "Failed to update account." };
    }

    revalidatePath(`/${parsed.data.organization_id}/accounts`);
    return { success: true };
}

export async function deleteAccount(
    accountId: string,
    organizationId: string
): Promise<AccountActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const admin = createAdminClient();
    const { error } = await admin
        .from("accounts")
        .delete()
        .eq("id", accountId)
        .eq("organization_id", organizationId);

    if (error) {
        // Postgres FK violation: journal_lines reference this account
        if (error.code === "23503") {
            return {
                success: false,
                error: "Cannot delete this account — it has existing journal entries. Deactivate it instead.",
            };
        }
        console.error("deleteAccount error:", error);
        return { success: false, error: "Failed to delete account." };
    }

    revalidatePath(`/${organizationId}/accounts`);
    return { success: true };
}
