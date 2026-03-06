"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import type { AuditLog } from "@/types/database";

const OP_STYLES = {
    INSERT: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    UPDATE: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    DELETE: "border-red-500/30 bg-red-500/10 text-red-400",
};

const TABLE_LABELS: Record<string, string> = {
    transactions: "Transactions",
    journal_lines: "Journal Lines",
    accounts: "Accounts",
    accounting_periods: "Periods",
};

const EXPORT_TYPES = [
    { id: "transactions", label: "Transactions CSV" },
    { id: "journal_lines", label: "Journal Lines CSV" },
    { id: "trial_balance", label: "Trial Balance CSV" },
    { id: "audit_log", label: "Audit Log CSV" },
];

interface AuditLogClientProps {
    logs: AuditLog[];
    count: number;
    page: number;
    orgSlug: string;
    organizationId: string;
    tableFilter?: string;
    opFilter?: "INSERT" | "UPDATE" | "DELETE";
}

function DiffViewer({ old_data, new_data, op }: { old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; op: string }) {
    const keys = new Set([...Object.keys(old_data ?? {}), ...Object.keys(new_data ?? {})]);
    const skipKeys = new Set(["organization_id", "created_at"]);

    return (
        <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
            {op !== "INSERT" && (
                <div>
                    <p className="mb-1 text-red-400 font-sans font-medium text-xs">Before</p>
                    <div className="space-y-0.5">
                        {[...keys].filter(k => !skipKeys.has(k)).map((k) => {
                            const oldVal = old_data?.[k];
                            const newVal = new_data?.[k];
                            const changed = op === "UPDATE" && JSON.stringify(oldVal) !== JSON.stringify(newVal);
                            return (
                                <div key={k} className={`flex gap-2 ${changed ? "text-red-300" : "text-zinc-500"}`}>
                                    <span className="w-32 truncate text-zinc-600">{k}:</span>
                                    <span className="flex-1 truncate">{oldVal === null ? "null" : JSON.stringify(oldVal)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {op !== "DELETE" && (
                <div className={op === "INSERT" ? "col-span-2" : ""}>
                    <p className="mb-1 text-emerald-400 font-sans font-medium text-xs">After</p>
                    <div className="space-y-0.5">
                        {[...keys].filter(k => !skipKeys.has(k)).map((k) => {
                            const oldVal = old_data?.[k];
                            const newVal = new_data?.[k];
                            const changed = op === "UPDATE" && JSON.stringify(oldVal) !== JSON.stringify(newVal);
                            return (
                                <div key={k} className={`flex gap-2 ${changed ? "text-emerald-300" : "text-zinc-500"}`}>
                                    <span className="w-32 truncate text-zinc-600">{k}:</span>
                                    <span className="flex-1 truncate">{newVal === null ? "null" : JSON.stringify(newVal)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export function AuditLogClient({
    logs, count, page, orgSlug, organizationId, tableFilter, opFilter,
}: AuditLogClientProps) {
    const router = useRouter();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [exportLoading, setExportLoading] = useState<string | null>(null);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const totalPages = Math.max(1, Math.ceil(count / 50));
    const allTables = ["transactions", "journal_lines", "accounts", "accounting_periods"];
    const allOps: Array<"INSERT" | "UPDATE" | "DELETE"> = ["INSERT", "UPDATE", "DELETE"];

    function buildHref(newPage: number, newTable?: string, newOp?: string) {
        const params = new URLSearchParams();
        if (newPage > 1) params.set("page", String(newPage));
        if (newTable) params.set("table", newTable);
        if (newOp) params.set("op", newOp);
        const qs = params.toString();
        return `/${orgSlug}/audit${qs ? "?" + qs : ""}`;
    }

    async function handleExport(type: string) {
        setExportLoading(type);
        const params = new URLSearchParams({ type });
        if (startDate) params.set("start_date", startDate);
        if (endDate) params.set("end_date", endDate);
        // Navigate to streaming API route — browser handles download
        window.location.href = `/api/export/${orgSlug}?${params.toString()}`;
        setTimeout(() => setExportLoading(null), 2000);
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Audit Log</h1>
                    <p className="mt-1 text-sm text-zinc-400">{count.toLocaleString()} event{count !== 1 ? "s" : ""} recorded</p>
                </div>

                {/* Export panel */}
                <div className="flex flex-wrap items-end gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
                    <div className="space-y-1">
                        <label className="block text-[10px] uppercase tracking-wider text-zinc-500">From</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-[10px] uppercase tracking-wider text-zinc-500">To</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {EXPORT_TYPES.map(({ id, label }) => (
                            <button key={id} onClick={() => handleExport(id)} disabled={exportLoading === id}
                                className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/50 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-indigo-500/50 hover:text-indigo-300 disabled:opacity-50 transition-colors">
                                {exportLoading === id ? (
                                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
                                    </svg>
                                )}
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <Link href={buildHref(1)} className={`rounded px-2.5 py-1 text-xs transition-colors ${!tableFilter && !opFilter ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "text-zinc-500 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700"}`}>All</Link>
                {allTables.map((t) => (
                    <Link key={t} href={buildHref(1, t, opFilter)}
                        className={`rounded px-2.5 py-1 text-xs transition-colors ${tableFilter === t ? "bg-zinc-700 text-zinc-200 border border-zinc-600" : "text-zinc-500 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700"}`}>
                        {TABLE_LABELS[t] ?? t}
                    </Link>
                ))}
                <div className="ml-2 h-4 w-px bg-zinc-800" />
                {allOps.map((op) => (
                    <Link key={op} href={buildHref(1, tableFilter, op)}
                        className={`rounded px-2.5 py-1 text-xs transition-colors border ${opFilter === op ? OP_STYLES[op] : "text-zinc-500 hover:text-zinc-200 border-zinc-800 hover:border-zinc-700"}`}>
                        {op}
                    </Link>
                ))}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                <table className="w-full text-sm" role="table">
                    <thead>
                        <tr className="border-b border-zinc-800/50">
                            <th className="py-2.5 pl-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 w-40">Timestamp</th>
                            <th className="py-2.5 pr-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 w-16">Op</th>
                            <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 w-32">Table</th>
                            <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Row ID</th>
                            <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                        {logs.length === 0 ? (
                            <tr><td colSpan={5} className="py-12 text-center text-sm text-zinc-500">No audit events match the current filter.</td></tr>
                        ) : logs.map((log) => {
                            const isExpanded = expandedId === log.id;
                            return (
                                <>
                                    <tr key={log.id} className="hover:bg-zinc-800/20 transition-colors cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : log.id)}>
                                        <td className="py-2.5 pl-4 font-mono text-[11px] text-zinc-400">
                                            {new Date(log.changed_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                        </td>
                                        <td className="py-2.5 pr-2">
                                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${OP_STYLES[log.operation]}`}>{log.operation}</Badge>
                                        </td>
                                        <td className="py-2.5 pr-4 text-zinc-400 text-xs">{TABLE_LABELS[log.table_name] ?? log.table_name}</td>
                                        <td className="py-2.5 pr-4 font-mono text-[11px] text-zinc-500">{log.row_id ? log.row_id.slice(0, 8) + "…" : "—"}</td>
                                        <td className="py-2.5 pr-4 text-zinc-600">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true">
                                                <path d="m6 9 6 6 6-6" />
                                            </svg>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr key={`${log.id}-diff`} className="bg-zinc-950/50">
                                            <td colSpan={5} className="px-4 py-3">
                                                <DiffViewer old_data={log.old_data} new_data={log.new_data} op={log.operation} />
                                            </td>
                                        </tr>
                                    )}
                                </>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center gap-2">
                    <Link href={buildHref(page - 1, tableFilter, opFilter)}
                        className={`rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors ${page <= 1 ? "pointer-events-none opacity-30" : ""}`}>
                        ← Prev
                    </Link>
                    <span className="text-xs text-zinc-500">Page {page} of {totalPages}</span>
                    <Link href={buildHref(page + 1, tableFilter, opFilter)}
                        className={`rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors ${page >= totalPages ? "pointer-events-none opacity-30" : ""}`}>
                        Next →
                    </Link>
                </div>
            )}
        </div>
    );
}
