"use server";

import { createClient } from "@/lib/supabase/server";
import type { AccountBalanceRow, AccountType } from "@/types/database";

export interface ReportResult {
    data: AccountBalanceRow[];
    startDate: string | null;
    endDate: string | null;
}

export type ReportActionResult =
    | ({ success: true } & ReportResult)
    | { success: false; error: string };

async function fetchBalances(
    organizationId: string,
    startDate: string | null,
    endDate: string | null,
    typeFilter?: AccountType[]
): Promise<ReportActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data, error } = await supabase.rpc("get_account_balances", {
        p_org_id: organizationId,
        p_start_date: startDate ?? null,
        p_end_date: endDate ?? null,
    });

    if (error) {
        console.error("get_account_balances RPC error:", error);
        return { success: false, error: "Failed to fetch financial data." };
    }

    const rows = (data ?? []) as AccountBalanceRow[];
    const filtered = typeFilter
        ? rows.filter((r) => typeFilter.includes(r.account_type))
        : rows;

    return { success: true, data: filtered, startDate, endDate };
}

/** Trial Balance: all accounts */
export async function getTrialBalance(
    organizationId: string,
    startDate: string | null = null,
    endDate: string | null = null
): Promise<ReportActionResult> {
    return fetchBalances(organizationId, startDate, endDate);
}

/** Income Statement: Revenue + Expense accounts */
export async function getIncomeStatement(
    organizationId: string,
    startDate: string | null = null,
    endDate: string | null = null
): Promise<ReportActionResult> {
    return fetchBalances(organizationId, startDate, endDate, ["revenue", "expense"]);
}

/** Balance Sheet: Asset + Liability + Equity accounts */
export async function getBalanceSheet(
    organizationId: string,
    startDate: string | null = null,
    endDate: string | null = null
): Promise<ReportActionResult> {
    return fetchBalances(organizationId, startDate, endDate, ["asset", "liability", "equity"]);
}
