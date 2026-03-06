"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CreatePeriodDialog } from "@/components/periods/create-period-dialog";
import { ClosePeriodDialog } from "@/components/periods/close-period-dialog";
import type { AccountingPeriod } from "@/types/database";

interface EquityAccount { id: string; name: string; code: string; }

interface PeriodsClientProps {
    periods: AccountingPeriod[];
    equityAccounts: EquityAccount[];
    organizationId: string;
    orgSlug: string;
}

function formatDateRange(start: string, end: string) {
    const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${fmt(start)} — ${fmt(end)}`;
}

function daysSince(dateStr: string) {
    const diff = Date.now() - new Date(dateStr + "T00:00:00").getTime();
    return Math.floor(diff / 86400000);
}

export function PeriodsClient({ periods, equityAccounts, organizationId, orgSlug }: PeriodsClientProps) {
    const [createOpen, setCreateOpen] = useState(false);
    const [closePeriod, setClosePeriod] = useState<AccountingPeriod | null>(null);

    const openPeriods = periods.filter((p) => p.status === "open");
    const closedPeriods = periods.filter((p) => p.status === "closed");

    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Accounting Periods</h1>
                    <p className="mt-1 text-sm text-zinc-400">
                        {openPeriods.length} open · {closedPeriods.length} closed
                    </p>
                </div>
                <button
                    onClick={() => setCreateOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-violet-700 transition-all"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" />
                    </svg>
                    New Period
                </button>
            </div>

            {/* Hard-close info banner */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300/80">
                <strong className="text-amber-300">Hard Close</strong> — Closing a period permanently locks its date range. Any transaction backdated into a closed period will be rejected at the database level.
            </div>

            {/* Open Periods */}
            {openPeriods.length > 0 && (
                <section>
                    <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Open Periods</h2>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                        <table className="w-full text-sm" role="table">
                            <thead>
                                <tr className="border-b border-zinc-800/50">
                                    <th className="py-2.5 pl-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Period</th>
                                    <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 hidden sm:table-cell">Dates</th>
                                    <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 hidden md:table-cell">Days Open</th>
                                    <th className="py-2.5 pr-4 text-center text-xs font-medium uppercase tracking-wider text-zinc-500 w-20">Status</th>
                                    <th className="py-2.5 pr-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 w-24">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/40">
                                {openPeriods.map((p) => (
                                    <tr key={p.id} className="hover:bg-zinc-800/20 transition-colors">
                                        <td className="py-3 pl-4 font-medium text-zinc-200">{p.name}</td>
                                        <td className="py-3 pr-4 text-zinc-400 text-xs hidden sm:table-cell">{formatDateRange(p.start_date, p.end_date)}</td>
                                        <td className="py-3 pr-4 text-zinc-500 text-xs hidden md:table-cell">{daysSince(p.start_date)}d</td>
                                        <td className="py-3 pr-4 text-center">
                                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0">Open</Badge>
                                        </td>
                                        <td className="py-3 pr-4 text-right">
                                            <button
                                                onClick={() => setClosePeriod(p)}
                                                className="rounded px-2.5 py-1 text-[11px] font-medium text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 transition-colors"
                                            >
                                                Hard Close
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* Closed Periods */}
            {closedPeriods.length > 0 && (
                <section>
                    <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Closed Periods</h2>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                        <table className="w-full text-sm" role="table">
                            <thead>
                                <tr className="border-b border-zinc-800/50">
                                    <th className="py-2.5 pl-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Period</th>
                                    <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 hidden sm:table-cell">Dates</th>
                                    <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 hidden md:table-cell">Closed On</th>
                                    <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 hidden lg:table-cell">Closing TX</th>
                                    <th className="py-2.5 pr-4 text-center text-xs font-medium uppercase tracking-wider text-zinc-500 w-20">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/40">
                                {closedPeriods.map((p) => (
                                    <tr key={p.id} className="opacity-75 hover:opacity-100 transition-opacity">
                                        <td className="py-3 pl-4 font-medium text-zinc-300">{p.name}</td>
                                        <td className="py-3 pr-4 text-zinc-500 text-xs hidden sm:table-cell">{formatDateRange(p.start_date, p.end_date)}</td>
                                        <td className="py-3 pr-4 text-zinc-500 text-xs hidden md:table-cell">
                                            {p.closed_at ? new Date(p.closed_at).toLocaleDateString("en-US") : "—"}
                                        </td>
                                        <td className="py-3 pr-4 text-zinc-600 font-mono text-[10px] hidden lg:table-cell">
                                            {p.closing_transaction_id ? `${p.closing_transaction_id.slice(0, 8)}…` : "None"}
                                        </td>
                                        <td className="py-3 pr-4 text-center">
                                            <Badge variant="outline" className="border-zinc-700 bg-zinc-800/30 text-zinc-500 text-[10px] px-1.5 py-0">Closed</Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {periods.length === 0 && (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-16 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-zinc-500" aria-hidden="true">
                            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
                        </svg>
                    </div>
                    <p className="text-sm font-medium text-zinc-300">No accounting periods yet</p>
                    <p className="text-xs text-zinc-500">Create your first period to enable time-bound ledger control.</p>
                </div>
            )}

            {/* Dialogs */}
            <CreatePeriodDialog open={createOpen} onOpenChange={setCreateOpen} organizationId={organizationId} />
            {closePeriod && (
                <ClosePeriodDialog
                    open={!!closePeriod}
                    onOpenChange={(v) => { if (!v) setClosePeriod(null); }}
                    period={closePeriod}
                    equityAccounts={equityAccounts}
                    orgSlug={orgSlug}
                />
            )}
        </>
    );
}
