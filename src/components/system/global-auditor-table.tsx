"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { GlobalTransaction, TransactionStatus } from "@/types/database";

// ── Helpers ────────────────────────────────────────────────────────────────────

const statusConfig: Record<TransactionStatus, { label: string; className: string }> = {
    draft: {
        label: "Draft",
        className: "border-zinc-600/40 bg-zinc-700/30 text-zinc-400",
    },
    posted: {
        label: "Posted",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    },
};

const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
});

function formatDate(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

// Deterministic badge color from org name string hash
function orgBadgeClass(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
    const palette = [
        "border-blue-500/30 bg-blue-500/10 text-blue-400",
        "border-violet-500/30 bg-violet-500/10 text-violet-400",
        "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
        "border-amber-500/30 bg-amber-500/10 text-amber-400",
        "border-pink-500/30 bg-pink-500/10 text-pink-400",
        "border-teal-500/30 bg-teal-500/10 text-teal-400",
        "border-orange-500/30 bg-orange-500/10 text-orange-400",
    ];
    return palette[Math.abs(hash) % palette.length];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
    data: GlobalTransaction[];
    count: number;
}

export function GlobalAuditorTable({ data, count }: Props) {
    const [search, setSearch] = useState("");

    const filtered = search.trim()
        ? data.filter((tx) =>
              (tx.organization?.name ?? "").toLowerCase().includes(search.toLowerCase())
          )
        : data;

    return (
        <div className="space-y-3">
            {/* Search bar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
                        aria-hidden="true"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                    </svg>
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter by organization…"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
                <p className="shrink-0 text-xs text-zinc-500">
                    {filtered.length} of {count} transaction{count !== 1 ? "s" : ""}
                </p>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" role="table">
                        <thead>
                            <tr className="border-b border-zinc-800 bg-zinc-900/80">
                                <th className="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                                    Date
                                </th>
                                <th className="py-3 px-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                                    Organization
                                </th>
                                <th className="py-3 px-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                                    Description
                                </th>
                                <th className="py-3 px-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                                    Status
                                </th>
                                <th className="py-3 px-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                                    Dr Total
                                </th>
                                <th className="py-3 pl-3 pr-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                                    Cr Total
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-sm text-zinc-500">
                                        {search ? "No transactions match the filter." : "No transactions found."}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((tx) => {
                                    const cfg = statusConfig[tx.status];
                                    const orgName = tx.organization?.name ?? "Unknown";
                                    return (
                                        <tr
                                            key={tx.id}
                                            className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30"
                                        >
                                            <td className="py-3 pl-4 pr-3 font-mono text-xs text-zinc-400 whitespace-nowrap">
                                                {formatDate(tx.entry_date)}
                                            </td>
                                            <td className="py-3 px-3">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] px-1.5 py-0 ${orgBadgeClass(orgName)}`}
                                                >
                                                    {orgName}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-3 max-w-xs truncate text-zinc-200">
                                                {tx.description}
                                            </td>
                                            <td className="py-3 px-3">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] px-1.5 py-0 ${cfg.className}`}
                                                >
                                                    {cfg.label}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-3 text-right font-mono text-xs text-blue-400">
                                                {fmt.format(tx.total_debits)}
                                            </td>
                                            <td className="py-3 pl-3 pr-4 text-right font-mono text-xs text-violet-400">
                                                {fmt.format(tx.total_credits)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
