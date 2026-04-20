"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { NewTransactionDialog } from "@/components/ledger/new-transaction-dialog";
import type { Account, TransactionWithLines, TransactionStatus } from "@/types/database";

const statusConfig: Record<
    TransactionStatus,
    { label: string; className: string }
> = {
    draft: {
        label: "Draft",
        className: "border-zinc-600/40 bg-zinc-700/30 text-zinc-400",
    },
    posted: {
        label: "Posted",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    },
};

function formatCurrency(v: number) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    }).format(v);
}

function formatDate(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function TransactionRow({
    tx,
    orgSlug,
    canWrite,
}: {
    tx: TransactionWithLines;
    orgSlug: string;
    canWrite: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const cfg = statusConfig[tx.status];

    return (
        <>
            <tr
                className="group cursor-pointer border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30"
                onClick={() => setExpanded((v) => !v)}
                role="button"
                aria-expanded={expanded}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setExpanded((v) => !v)}
            >
                {/* Expand chevron */}
                <td className="w-8 pl-3 py-3">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`h-3.5 w-3.5 text-zinc-600 transition-transform ${expanded ? "rotate-90" : ""}`}
                        aria-hidden="true"
                    >
                        <path d="m9 18 6-6-6-6" />
                    </svg>
                </td>
                <td className="py-3 pr-4 text-xs text-zinc-400 font-mono whitespace-nowrap">
                    {formatDate(tx.entry_date)}
                </td>
                <td className="py-3 pr-4 text-sm text-zinc-200 max-w-xs truncate">
                    {tx.description}
                </td>
                <td className="py-3 pr-4">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.className}`}>
                        {cfg.label}
                    </Badge>
                </td>
                <td className="py-3 pr-4 text-right font-mono text-xs text-blue-400">
                    {formatCurrency(tx.total_debits)}
                </td>
                <td className="py-3 pr-4 text-right font-mono text-xs text-violet-400">
                    {formatCurrency(tx.total_credits)}
                </td>
                <td className="py-3 pr-3 text-right text-xs text-zinc-500">
                    {tx.creator?.full_name ?? tx.creator?.email ?? "—"}
                </td>
                <td className="py-3 pr-3 text-right">
                    {canWrite && tx.status === "draft" && (
                        <Link
                            href={`/${orgSlug}/ledger/${tx.id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:border-indigo-500/50 hover:text-indigo-300 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                            </svg>
                            Edit
                        </Link>
                    )}
                </td>
            </tr>

            {/* Expanded journal lines */}
            {expanded && (
                <tr className="border-b border-zinc-800/50 bg-zinc-900/60">
                    <td colSpan={8} className="px-8 pb-3 pt-1">
                        <div className="rounded-md border border-zinc-800 overflow-hidden">
                            <table className="w-full text-xs" role="table" aria-label="Journal lines">
                                <thead>
                                    <tr className="border-b border-zinc-800 bg-zinc-900/50">
                                        <th className="px-3 py-2 text-left font-medium text-zinc-500">Account</th>
                                        <th className="px-3 py-2 text-left font-medium text-zinc-500">Memo</th>
                                        <th className="px-3 py-2 text-right font-medium text-zinc-500">Debit</th>
                                        <th className="px-3 py-2 text-right font-medium text-zinc-500">Credit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/50">
                                    {tx.journal_lines.map((line) => (
                                        <tr key={line.id} className="hover:bg-zinc-800/20">
                                            <td className="px-3 py-2 text-zinc-300">
                                                <span className="font-mono text-zinc-500 mr-2">
                                                    {line.account?.code}
                                                </span>
                                                {line.account?.name}
                                            </td>
                                            <td className="px-3 py-2 text-zinc-500">
                                                {line.description ?? "—"}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-blue-400">
                                                {line.type === "debit" ? formatCurrency(Number(line.amount)) : ""}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-violet-400">
                                                {line.type === "credit" ? formatCurrency(Number(line.amount)) : ""}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {/* Totals row */}
                                <tfoot>
                                    <tr className="border-t border-zinc-700 bg-zinc-900/50">
                                        <td colSpan={2} className="px-3 py-2 font-medium text-zinc-400">
                                            Totals
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono font-medium text-blue-300">
                                            {formatCurrency(tx.total_debits)}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono font-medium text-violet-300">
                                            {formatCurrency(tx.total_credits)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

interface LedgerClientProps {
    transactions: TransactionWithLines[];
    count: number;
    organizationId: string;
    orgSlug: string;
    accounts: Account[];
    canWrite: boolean;
}

export function LedgerClient({
    transactions,
    count,
    organizationId,
    orgSlug,
    accounts,
    canWrite,
}: LedgerClientProps) {
    const [dialogOpen, setDialogOpen] = useState(false);

    return (
        <>
            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
                        General Ledger
                    </h1>
                    <p className="mt-1 text-sm text-zinc-400">
                        {count} transaction{count !== 1 ? "s" : ""}
                    </p>
                </div>
                {canWrite && (
                    <button
                        onClick={() => setDialogOpen(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-violet-700 transition-all"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                            aria-hidden="true"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M8 12h8" />
                            <path d="M12 8v8" />
                        </svg>
                        New Entry
                    </button>
                )}
            </div>

            {/* Transactions Table */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" role="table">
                        <thead>
                            <tr className="border-b border-zinc-800 bg-zinc-900/80">
                                <th className="w-8 pl-3" />
                                <th className="py-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                                    Date
                                </th>
                                <th className="py-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                                    Description
                                </th>
                                <th className="py-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                                    Status
                                </th>
                                <th className="py-3 pr-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                                    Dr Total
                                </th>
                                <th className="py-3 pr-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                                    Cr Total
                                </th>
                                <th className="py-3 pr-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                                    Created By
                                </th>
                                <th className="py-3 pr-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="h-5 w-5 text-zinc-500"
                                                    aria-hidden="true"
                                                >
                                                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
                                                </svg>
                                            </div>
                                            <p className="text-sm font-medium text-zinc-300">
                                                No transactions yet
                                            </p>
                                            <p className="text-xs text-zinc-500">
                                                Click &ldquo;New Entry&rdquo; to record your first journal entry.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((tx) => (
                                    <TransactionRow key={tx.id} tx={tx} orgSlug={orgSlug} canWrite={canWrite} />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <NewTransactionDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                organizationId={organizationId}
                orgSlug={orgSlug}
                accounts={accounts}
            />
        </>
    );
}
