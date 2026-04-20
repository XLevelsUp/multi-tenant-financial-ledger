"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Account, TransactionWithLines, RecordTransactionLineInput } from "@/types/database";

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

/**
 * Validates a currency amount string.
 * - Must be a valid number string
 * - Must be positive
 * - Clamped to 4 decimal places max
 * Uses string→integer arithmetic to prevent floating-point drift.
 */
const AmountSchema = z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,4})?$/, "Amount must be a positive number with up to 4 decimal places")
    .refine((v) => parseFloat(v) > 0, "Amount must be greater than 0");

const JournalLineSchema = z.object({
    account_id: z.string().uuid("Invalid account ID"),
    amount: AmountSchema,
    type: z.enum(["debit", "credit"]),
    description: z.string().max(500).optional(),
});

const CreateTransactionSchema = z.object({
    organization_id: z.string().uuid("Invalid organization ID"),
    description: z.string().min(1, "Description is required").max(500),
    entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
    status: z.enum(["draft", "posted"]),
    lines: z
        .array(JournalLineSchema)
        .min(2, "A transaction requires at least 2 journal lines")
        .refine(
            (lines) => {
                // Integer arithmetic balance check: multiply by 10000 to avoid float drift
                const totalDebits = lines
                    .filter((l) => l.type === "debit")
                    .reduce((sum, l) => sum + Math.round(parseFloat(l.amount) * 10000), 0);
                const totalCredits = lines
                    .filter((l) => l.type === "credit")
                    .reduce((sum, l) => sum + Math.round(parseFloat(l.amount) * 10000), 0);
                return totalDebits === totalCredits;
            },
            { message: "Journal entries do not balance: total debits must equal total credits" }
        ),
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
export type CreateTransactionResult =
    | { success: true; transactionId: string }
    | { success: false; error: string; fieldErrors?: Record<string, string[]> };

const UpdateTransactionSchema = z.object({
    tx_id: z.string().uuid("Invalid transaction ID"),
    org_id: z.string().uuid("Invalid organization ID"),
    description: z.string().min(1, "Description is required").max(500),
    entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
    status: z.enum(["draft", "posted"]),
    lines: z
        .array(JournalLineSchema)
        .min(2, "A transaction requires at least 2 journal lines")
        .refine(
            (lines) => {
                const totalDebits = lines
                    .filter((l) => l.type === "debit")
                    .reduce((sum, l) => sum + Math.round(parseFloat(l.amount) * 10000), 0);
                const totalCredits = lines
                    .filter((l) => l.type === "credit")
                    .reduce((sum, l) => sum + Math.round(parseFloat(l.amount) * 10000), 0);
                return totalDebits === totalCredits;
            },
            { message: "Journal entries do not balance: total debits must equal total credits" }
        ),
});

export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>;
export type UpdateTransactionResult =
    | { success: true; transactionId: string }
    | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * createTransactionAction
 * Validates input with Zod, then calls the atomic record_transaction RPC.
 * The RPC enforces zero-sum balance server-side as a second line of defense.
 */
export async function createTransactionAction(
    input: CreateTransactionInput,
    orgSlug?: string
): Promise<CreateTransactionResult> {
    // 1. Validate with Zod
    const parsed = CreateTransactionSchema.safeParse(input);
    if (!parsed.success) {
        const fieldErrors: Record<string, string[]> = {};
        parsed.error.issues.forEach((issue) => {
            const key = issue.path.join(".");
            fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
        });
        return {
            success: false,
            error: parsed.error.issues[0]?.message ?? "Validation failed",
            fieldErrors,
        };
    }

    const { organization_id, description, entry_date, status, lines } = parsed.data;

    const supabase = await createClient();

    // 2. Verify authenticated
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    // 3. Build RPC payload — amounts as strings for precision
    const rpcLines: RecordTransactionLineInput[] = lines.map((line) => ({
        account_id: line.account_id,
        amount: line.amount,
        type: line.type,
        description: line.description,
    }));

    // 4. Call the atomic PL/pgSQL RPC
    const { data: transactionId, error } = await supabase.rpc("record_transaction", {
        p_organization_id: organization_id,
        p_description: description,
        p_entry_date: entry_date,
        p_status: status,
        p_lines: rpcLines as unknown as never, // JSONB
    });

    if (error) {
        console.error("[record_transaction RPC error]", error);
        // Surface the real Postgres/Supabase error so users can diagnose
        const raw = error.message ?? "";
        const msg = raw.includes("do not balance")
            ? "Journal entries do not balance. Debits must equal Credits."
            : raw.includes("Access denied") || raw.includes("not a member")
                ? "Access denied — you are not a member of this organization."
                : raw.includes("Cannot modify") || raw.includes("immutable")
                    ? "Cannot modify a posted (immutable) transaction."
                    : raw.includes("closed accounting period")
                        ? "Cannot post to a closed accounting period. Use a date in an open period."
                        : raw.includes("Could not find the function")
                            ? "Database function not found — have you run all SQL migrations (001-006)?"
                            : raw || "Failed to record transaction. Please try again.";
        return { success: false, error: msg };
    }

    // 5. Revalidate the ledger page cache (use slug-based path)
    revalidatePath(`/${orgSlug ?? organization_id}/ledger`);

    return { success: true, transactionId: transactionId as string };
}

/**
 * getOrganizationAccounts
 * Fetches the chart of accounts for an organization, ordered by code.
 */
export async function getOrganizationAccounts(
    organizationId: string
): Promise<Account[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("code", { ascending: true });

    if (error) {
        console.error("Failed to fetch accounts:", error);
        return [];
    }

    return data ?? [];
}

/**
 * getTransactions
 * Fetches paginated transactions with journal lines and account info.
 * Supabase RLS ensures only org-authorized data is returned.
 */
export async function getTransactions(
    organizationId: string,
    page = 1,
    pageSize = 25
): Promise<{ data: TransactionWithLines[]; count: number }> {
    const supabase = await createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
        .from("transactions")
        .select(
            `
      *,
      journal_lines (
        *,
        account:accounts ( id, name, code, type )
      ),
      creator:profiles!transactions_created_by_fkey ( id, full_name, email )
    `,
            { count: "exact" }
        )
        .eq("organization_id", organizationId)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to);

    if (error) {
        console.error("Failed to fetch transactions:", error);
        return { data: [], count: 0 };
    }

    // Compute debit/credit totals per transaction
    const enriched = (data ?? []).map((tx) => {
        const lines = tx.journal_lines ?? [];
        const total_debits = lines
            .filter((l: { type: string }) => l.type === "debit")
            .reduce((sum: number, l: { amount: number }) => sum + Number(l.amount), 0);
        const total_credits = lines
            .filter((l: { type: string }) => l.type === "credit")
            .reduce((sum: number, l: { amount: number }) => sum + Number(l.amount), 0);
        return { ...tx, total_debits, total_credits };
    });

    return { data: enriched as TransactionWithLines[], count: count ?? 0 };
}

/**
 * getTransactionById
 * Fetches a single transaction with its journal lines and account info.
 * Returns null if the transaction does not exist or belongs to a different org.
 */
export async function getTransactionById(
    txId: string,
    orgId: string
): Promise<TransactionWithLines | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("transactions")
        .select(
            `
            *,
            journal_lines (
                *,
                account:accounts ( id, name, code, type )
            ),
            creator:profiles!transactions_created_by_fkey ( id, full_name, email )
            `
        )
        .eq("id", txId)
        .eq("organization_id", orgId)
        .single();

    if (error || !data) {
        console.error("Failed to fetch transaction:", error);
        return null;
    }

    const lines = data.journal_lines ?? [];
    const total_debits = lines
        .filter((l: { type: string }) => l.type === "debit")
        .reduce((sum: number, l: { amount: number }) => sum + Number(l.amount), 0);
    const total_credits = lines
        .filter((l: { type: string }) => l.type === "credit")
        .reduce((sum: number, l: { amount: number }) => sum + Number(l.amount), 0);

    return { ...data, total_debits, total_credits } as TransactionWithLines;
}

/**
 * updateTransactionAction
 * Validates the payload with Zod, then calls the atomic update_draft_transaction RPC.
 * On success revalidates the ledger list and the edit page path.
 */
export async function updateTransactionAction(
    input: UpdateTransactionInput,
    orgSlug: string
): Promise<UpdateTransactionResult> {
    const parsed = UpdateTransactionSchema.safeParse(input);
    if (!parsed.success) {
        const fieldErrors: Record<string, string[]> = {};
        parsed.error.issues.forEach((issue) => {
            const key = issue.path.join(".");
            fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
        });
        return {
            success: false,
            error: parsed.error.issues[0]?.message ?? "Validation failed",
            fieldErrors,
        };
    }

    const { tx_id, org_id, description, entry_date, status, lines } = parsed.data;

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const rpcLines: RecordTransactionLineInput[] = lines.map((line) => ({
        account_id: line.account_id,
        amount: line.amount,
        type: line.type,
        description: line.description,
    }));

    const { data: transactionId, error } = await supabase.rpc("update_draft_transaction", {
        p_tx_id: tx_id,
        p_org_id: org_id,
        p_description: description,
        p_entry_date: entry_date,
        p_status: status,
        p_lines: rpcLines as unknown as never,
    });

    if (error) {
        console.error("[update_draft_transaction RPC error]", error);
        const raw = error.message ?? "";
        const msg = raw.includes("do not balance")
            ? "Journal entries do not balance. Debits must equal Credits."
            : raw.includes("Access denied") || raw.includes("not a member")
                ? "Access denied — you are not a member of this organization."
                : raw.includes("Cannot edit a posted")
                    ? "Cannot edit a posted transaction. Create a reversal entry instead."
                    : raw.includes("closed accounting period") || raw.includes("closed period")
                        ? "Cannot post to a closed accounting period. Use a date in an open period."
                        : raw.includes("not found or inactive")
                            ? "One or more selected accounts is inactive or not found."
                            : raw.includes("not found in this organization")
                                ? "Transaction not found."
                                : raw || "Failed to update transaction. Please try again.";
        return { success: false, error: msg };
    }

    revalidatePath(`/${orgSlug}/ledger`);
    revalidatePath(`/${orgSlug}/ledger/${tx_id}/edit`);

    return { success: true, transactionId: transactionId as string };
}
