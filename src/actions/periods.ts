"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { AccountingPeriod } from "@/types/database";

// ── Schemas ──────────────────────────────────────────────────────────────────

const CreatePeriodSchema = z.object({
    organization_id: z.string().uuid(),
    name: z.string().min(1, "Name is required").max(100),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date (YYYY-MM-DD)"),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date (YYYY-MM-DD)"),
}).refine((d) => d.end_date >= d.start_date, {
    message: "End date must be on or after start date",
    path: ["end_date"],
});

export type PeriodActionResult =
    | { success: true }
    | { success: false; error: string };

export type ClosePeriodResult =
    | { success: true; closingTransactionId: string | null }
    | { success: false; error: string };

// ── Server Actions ────────────────────────────────────────────────────────────

/** Fetch all periods for an org, newest first */
export async function getAccountingPeriods(
    organizationId: string
): Promise<AccountingPeriod[]> {
    const admin = createAdminClient();
    const { data } = await admin
        .from("accounting_periods")
        .select("*")
        .eq("organization_id", organizationId)
        .order("start_date", { ascending: false });
    return data ?? [];
}

/** Create a new open accounting period */
export async function createAccountingPeriod(
    input: z.infer<typeof CreatePeriodSchema>
): Promise<PeriodActionResult> {
    const parsed = CreatePeriodSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const admin = createAdminClient();
    const { error } = await admin.from("accounting_periods").insert({
        organization_id: parsed.data.organization_id,
        name: parsed.data.name,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
    });

    if (error) {
        if (error.code === "23505") {
            return { success: false, error: `A period named "${parsed.data.name}" already exists.` };
        }
        // Overlap trigger violation
        if (error.message?.includes("overlaps")) {
            return { success: false, error: "This period overlaps with an existing period. Periods must not overlap." };
        }
        console.error("createAccountingPeriod error:", error);
        return { success: false, error: "Failed to create accounting period." };
    }

    revalidatePath(`/${parsed.data.organization_id}/periods`);
    return { success: true };
}

/** Call the close_accounting_period RPC */
export async function closeAccountingPeriod(
    periodId: string,
    retainedEarningsAccountId: string,
    orgSlug: string
): Promise<ClosePeriodResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data, error } = await supabase.rpc("close_accounting_period", {
        p_period_id: periodId,
        p_retained_earnings_account_id: retainedEarningsAccountId,
    });

    if (error) {
        const msg = error.message?.includes("already closed")
            ? "This period is already closed."
            : error.message?.includes("not found") || error.message?.includes("not of type")
                ? "Retained Earnings account is invalid, inactive, or not an equity account."
                : error.message?.includes("does not balance")
                    ? "System error: closing entry did not balance. Contact support."
                    : error.message ?? "Failed to close period.";
        console.error("closeAccountingPeriod RPC error:", error);
        return { success: false, error: msg };
    }

    revalidatePath(`/${orgSlug}/periods`);
    revalidatePath(`/${orgSlug}/ledger`);
    revalidatePath(`/${orgSlug}/reports`);
    return { success: true, closingTransactionId: data as string | null };
}
