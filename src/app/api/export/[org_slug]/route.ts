import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Helpers ───────────────────────────────────────────────────────────────────

function csvEscape(val: unknown): string {
    if (val === null || val === undefined) return "";
    const s = String(val);
    // Quote fields with commas, quotes, or newlines
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

function csvRow(cells: unknown[]): string {
    return cells.map(csvEscape).join(",") + "\r\n";
}

const encoder = new TextEncoder();

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ org_slug: string }> }
) {
    const { org_slug } = await params;

    // 1. Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Resolve org + verify membership
    const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("slug", org_slug)
        .single();

    if (!org) {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // 3. Parse query params
    const url = new URL(request.url);
    const exportType = url.searchParams.get("type") ?? "transactions";
    const startDate = url.searchParams.get("start_date") ?? null;
    const endDate = url.searchParams.get("end_date") ?? null;

    const validTypes = ["transactions", "journal_lines", "trial_balance", "audit_log"];
    if (!validTypes.includes(exportType)) {
        return NextResponse.json({ error: `Invalid export type. Must be one of: ${validTypes.join(", ")}` }, { status: 400 });
    }

    const admin = createAdminClient();
    const filename = `${org_slug}_${exportType}_${new Date().toISOString().slice(0, 10)}.csv`;

    // ── 4. Build streaming ReadableStream ────────────────────────────────────────
    const stream = new ReadableStream({
        async start(controller) {
            try {
                if (exportType === "transactions") {
                    controller.enqueue(encoder.encode(csvRow([
                        "id", "description", "entry_date", "status",
                        "total_debits", "total_credits", "created_at",
                    ])));
                    let from = 0;
                    const pageSize = 500;
                    while (true) {
                        const { data, error } = await admin
                            .from("transactions")
                            .select(`*, journal_lines(amount, type)`)
                            .eq("organization_id", org.id)
                            .order("entry_date", { ascending: false })
                            .range(from, from + pageSize - 1);
                        if (error || !data || data.length === 0) break;
                        for (const tx of data) {
                            const lines = (tx.journal_lines as { amount: number; type: string }[]) ?? [];
                            const debits = lines.filter(l => l.type === "debit").reduce((s, l) => s + Number(l.amount), 0);
                            const credits = lines.filter(l => l.type === "credit").reduce((s, l) => s + Number(l.amount), 0);
                            controller.enqueue(encoder.encode(csvRow([
                                tx.id, tx.description, tx.entry_date, tx.status,
                                debits.toFixed(4), credits.toFixed(4), tx.created_at,
                            ])));
                        }
                        if (data.length < pageSize) break;
                        from += pageSize;
                    }

                } else if (exportType === "journal_lines") {
                    controller.enqueue(encoder.encode(csvRow([
                        "line_id", "transaction_id", "entry_date", "transaction_status",
                        "account_code", "account_name", "account_type",
                        "debit", "credit", "description", "created_at",
                    ])));
                    let from = 0;
                    const pageSize = 1000;
                    while (true) {
                        let query = admin
                            .from("journal_lines")
                            .select(`
                id, amount, type, description, created_at,
                transaction:transactions!journal_lines_transaction_id_fkey(id, entry_date, status, description),
                account:accounts!journal_lines_account_id_fkey(code, name, type)
              `)
                            .eq("organization_id", org.id)
                            .order("created_at", { ascending: false })
                            .range(from, from + pageSize - 1);
                        if (startDate) query = query.gte("transactions.entry_date", startDate);
                        if (endDate) query = query.lte("transactions.entry_date", endDate);
                        const { data, error } = await query;
                        if (error || !data || data.length === 0) break;
                        for (const line of data) {
                            const tx = line.transaction as { id: string; entry_date: string; status: string } | null;
                            const acc = line.account as { code: string; name: string; type: string } | null;
                            controller.enqueue(encoder.encode(csvRow([
                                line.id,
                                tx?.id ?? "",
                                tx?.entry_date ?? "",
                                tx?.status ?? "",
                                acc?.code ?? "",
                                acc?.name ?? "",
                                acc?.type ?? "",
                                line.type === "debit" ? Number(line.amount).toFixed(4) : "",
                                line.type === "credit" ? Number(line.amount).toFixed(4) : "",
                                line.description ?? "",
                                line.created_at,
                            ])));
                        }
                        if (data.length < pageSize) break;
                        from += pageSize;
                    }

                } else if (exportType === "trial_balance") {
                    controller.enqueue(encoder.encode(csvRow([
                        "account_code", "account_name", "account_type",
                        "total_debits", "total_credits", "net_balance",
                    ])));
                    const { data, error } = await supabase.rpc("get_account_balances", {
                        p_org_id: org.id,
                        p_start_date: startDate ?? null,
                        p_end_date: endDate ?? null,
                    });
                    if (!error && data) {
                        for (const row of data) {
                            controller.enqueue(encoder.encode(csvRow([
                                row.account_code, row.account_name, row.account_type,
                                Number(row.total_debits).toFixed(4),
                                Number(row.total_credits).toFixed(4),
                                Number(row.net_balance).toFixed(4),
                            ])));
                        }
                    }

                } else if (exportType === "audit_log") {
                    controller.enqueue(encoder.encode(csvRow([
                        "id", "table_name", "operation", "row_id", "changed_by", "changed_at",
                        "old_data", "new_data",
                    ])));
                    let from = 0;
                    const pageSize = 500;
                    while (true) {
                        const { data, error } = await admin
                            .from("audit_log")
                            .select("*")
                            .eq("organization_id", org.id)
                            .order("changed_at", { ascending: false })
                            .range(from, from + pageSize - 1);
                        if (error || !data || data.length === 0) break;
                        for (const row of data) {
                            controller.enqueue(encoder.encode(csvRow([
                                row.id, row.table_name, row.operation, row.row_id ?? "",
                                row.changed_by ?? "",
                                row.changed_at,
                                row.old_data ? JSON.stringify(row.old_data) : "",
                                row.new_data ? JSON.stringify(row.new_data) : "",
                            ])));
                        }
                        if (data.length < pageSize) break;
                        from += pageSize;
                    }
                }

                controller.close();
            } catch (err) {
                console.error("CSV stream error:", err);
                controller.error(err);
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    });
}
