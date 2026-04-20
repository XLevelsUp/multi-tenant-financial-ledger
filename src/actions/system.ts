"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GlobalOrgFinancials, GlobalTransaction, TransactionStatus, JournalEntryType, AccountType } from "@/types/database";

// ============================================================================
// AUTH GUARD
// ============================================================================

async function assertSystemAdmin(): Promise<void> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated.");

    const admin = createAdminClient();
    const { data: profile } = await admin
        .from("profiles")
        .select("is_system_admin")
        .eq("id", user.id)
        .single();

    if (!profile?.is_system_admin) throw new Error("Insufficient privileges.");
}

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface GlobalFinancialsResult {
    data: GlobalOrgFinancials[];
    platformIncome: number;
    platformExpense: number;
    platformProfit: number;
    orgCount: number;
}

export interface GlobalLedgerResult {
    data: GlobalTransaction[];
    count: number;
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * getGlobalFinancials
 * Fetches the global_org_financials view for the Super Admin command center.
 * Returns per-org P&L rows plus pre-computed platform-level aggregates.
 */
export async function getGlobalFinancials(): Promise<
    { success: true } & GlobalFinancialsResult | { success: false; error: string }
> {
    try {
        await assertSystemAdmin();
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
        .from("global_org_financials")
        .select("*")
        .order("net_profit", { ascending: false });

    if (error) {
        console.error("[getGlobalFinancials]", error);
        return { success: false, error: error.message };
    }

    const rows = (data ?? []) as GlobalOrgFinancials[];
    const platformIncome  = rows.reduce((s, r) => s + Number(r.total_income),  0);
    const platformExpense = rows.reduce((s, r) => s + Number(r.total_expense), 0);
    const platformProfit  = platformIncome - platformExpense;

    return {
        success: true,
        data: rows,
        platformIncome,
        platformExpense,
        platformProfit,
        orgCount: rows.length,
    };
}

/**
 * getGlobalLedger
 * Fetches a paginated cross-tenant transaction list for the Super Admin auditor.
 * Returns transactions enriched with organization name and debit/credit totals.
 */
export async function getGlobalLedger(
    limit = 100,
    offset = 0
): Promise<{ success: true } & GlobalLedgerResult | { success: false; error: string }> {
    try {
        await assertSystemAdmin();
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }

    const admin = createAdminClient();
    const { data, error, count } = await admin
        .from("transactions")
        .select(
            `
            *,
            organization:organizations ( id, name, slug ),
            journal_lines (
                id, amount, type, description,
                account:accounts ( id, name, code, type )
            )
            `,
            { count: "exact" }
        )
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error("[getGlobalLedger]", error);
        return { success: false, error: error.message };
    }

    const enriched: GlobalTransaction[] = (data ?? []).map((tx) => {
        const lines = (tx.journal_lines ?? []) as {
            type: JournalEntryType;
            amount: number;
        }[];
        const total_debits = lines
            .filter((l) => l.type === "debit")
            .reduce((s, l) => s + Number(l.amount), 0);
        const total_credits = lines
            .filter((l) => l.type === "credit")
            .reduce((s, l) => s + Number(l.amount), 0);
        return {
            id: tx.id as string,
            organization_id: tx.organization_id as string,
            description: tx.description as string,
            entry_date: tx.entry_date as string,
            status: tx.status as TransactionStatus,
            created_at: tx.created_at as string,
            organization: tx.organization as { id: string; name: string; slug: string } | null,
            total_debits,
            total_credits,
        };
    });

    return { success: true, data: enriched, count: count ?? 0 };
}
