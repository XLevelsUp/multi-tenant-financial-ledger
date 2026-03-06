"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { JournalEntryType, JournalLine } from "@/types/database";

export type ReversalResult =
    | { success: true; transactionId: string }
    | { success: false; error: string };

export async function reverseTransaction(
    transactionId: string,
    organizationId: string,
    orgSlug: string
): Promise<ReversalResult> {
    // 1. Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const admin = createAdminClient();

    // 2. Fetch the original transaction + lines
    const { data: tx, error: txError } = await admin
        .from("transactions")
        .select(`*, journal_lines(*)`)
        .eq("id", transactionId)
        .eq("organization_id", organizationId)
        .single();

    if (txError || !tx) {
        return { success: false, error: "Transaction not found." };
    }

    if (tx.status !== "posted") {
        return { success: false, error: "Only posted transactions can be reversed." };
    }

    const originalLines = (tx.journal_lines as JournalLine[]) ?? [];
    if (originalLines.length === 0) {
        return { success: false, error: "Transaction has no journal lines." };
    }

    // 3. Build reversal lines: flip debit ↔ credit
    const reversalLines = originalLines.map((line) => ({
        account_id: line.account_id,
        amount: String(line.amount),
        type: (line.type === "debit" ? "credit" : "debit") as JournalEntryType,
        description: line.description ? `Reversal: ${line.description}` : undefined,
    }));

    // 4. Call the Phase 2 record_transaction RPC
    const { data: newTxId, error: rpcError } = await supabase.rpc("record_transaction", {
        p_organization_id: organizationId,
        p_description: `Reversal of: ${tx.description} (${tx.entry_date})`,
        p_entry_date: new Date().toISOString().split("T")[0],
        p_status: "posted",
        p_lines: reversalLines as unknown as never,
    });

    if (rpcError) {
        console.error("reverseTransaction RPC error:", rpcError);
        return { success: false, error: "Failed to create reversal transaction." };
    }

    revalidatePath(`/${orgSlug}/ledger`);
    return { success: true, transactionId: newTxId as string };
}
