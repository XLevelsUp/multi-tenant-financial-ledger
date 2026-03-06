"use client";

import type { AccountBalanceRow, AccountType } from "@/types/database";

const TYPE_SECTION_LABELS: Partial<Record<AccountType, string>> = {
    asset: "Assets",
    liability: "Liabilities",
    equity: "Equity",
    revenue: "Revenue",
    expense: "Expenses",
};

const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(v);

function colorForBalance(v: number): string {
    if (v > 0) return "text-emerald-400";
    if (v < 0) return "text-red-400";
    return "text-zinc-400";
}

interface ReportTableProps {
    rows: AccountBalanceRow[];
    /** If true, groups rows by account_type with subtotals */
    grouped?: boolean;
    /** Which type sections to show (defaults to all present) */
    typeSections?: AccountType[];
    title: string;
}

export function ReportTable({ rows, grouped = false, typeSections, title }: ReportTableProps) {
    if (!rows.length) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 py-14 text-center">
                <p className="text-sm text-zinc-400">No data for the selected period.</p>
                <p className="text-xs text-zinc-600">Make sure you have posted transactions and a seeded Chart of Accounts.</p>
            </div>
        );
    }

    const grandTotalDebits = rows.reduce((s, r) => s + Number(r.total_debits), 0);
    const grandTotalCredits = rows.reduce((s, r) => s + Number(r.total_credits), 0);
    const grandNetBalance = rows.reduce((s, r) => s + Number(r.net_balance), 0);

    if (!grouped) {
        return (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                <div className="border-b border-zinc-800 bg-zinc-900/80 px-4 py-3">
                    <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" role="table">
                        <thead>
                            <tr className="border-b border-zinc-800/50">
                                <th className="py-2.5 pl-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 w-20">Code</th>
                                <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Account</th>
                                <th className="py-2.5 pr-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Debit</th>
                                <th className="py-2.5 pr-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Credit</th>
                                <th className="py-2.5 pr-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/40">
                            {rows.map((row) => (
                                <tr key={row.account_id} className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="py-2.5 pl-4 font-mono text-xs text-zinc-500">{row.account_code}</td>
                                    <td className="py-2.5 pr-4 text-zinc-300">{row.account_name}</td>
                                    <td className="py-2.5 pr-4 text-right font-mono text-xs text-blue-400">{fmt(Number(row.total_debits))}</td>
                                    <td className="py-2.5 pr-4 text-right font-mono text-xs text-violet-400">{fmt(Number(row.total_credits))}</td>
                                    <td className={`py-2.5 pr-4 text-right font-mono text-xs font-medium ${colorForBalance(Number(row.net_balance))}`}>
                                        {fmt(Number(row.net_balance))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-zinc-700 bg-zinc-900/60">
                                <td colSpan={2} className="py-3 pl-4 text-xs font-semibold text-zinc-300 uppercase tracking-wider">Total</td>
                                <td className="py-3 pr-4 text-right font-mono text-sm font-semibold text-blue-300">{fmt(grandTotalDebits)}</td>
                                <td className="py-3 pr-4 text-right font-mono text-sm font-semibold text-violet-300">{fmt(grandTotalCredits)}</td>
                                <td className={`py-3 pr-4 text-right font-mono text-sm font-bold ${colorForBalance(grandNetBalance)}`}>{fmt(grandNetBalance)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    }

    // Grouped by account type with subtotals
    const typeOrder: AccountType[] = typeSections ?? ["asset", "liability", "equity", "revenue", "expense"];
    const byType = rows.reduce<Record<string, AccountBalanceRow[]>>(
        (acc, r) => { acc[r.account_type] = [...(acc[r.account_type] ?? []), r]; return acc; },
        {}
    );

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                <div className="border-b border-zinc-800 bg-zinc-900/80 px-4 py-3">
                    <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" role="table">
                        <thead>
                            <tr className="border-b border-zinc-800/50">
                                <th className="py-2.5 pl-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 w-20">Code</th>
                                <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Account</th>
                                <th className="py-2.5 pr-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Debit</th>
                                <th className="py-2.5 pr-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Credit</th>
                                <th className="py-2.5 pr-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {typeOrder.map((type) => {
                                const group = byType[type];
                                if (!group?.length) return null;
                                const subtotalDebits = group.reduce((s, r) => s + Number(r.total_debits), 0);
                                const subtotalCredits = group.reduce((s, r) => s + Number(r.total_credits), 0);
                                const subtotalNet = group.reduce((s, r) => s + Number(r.net_balance), 0);
                                return (
                                    <>
                                        <tr key={`header-${type}`} className="border-t border-zinc-800/50 bg-zinc-900/40">
                                            <td colSpan={5} className="py-2 pl-4 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                                                {TYPE_SECTION_LABELS[type] ?? type}
                                            </td>
                                        </tr>
                                        {group.map((row) => (
                                            <tr key={row.account_id} className="border-t border-zinc-800/30 hover:bg-zinc-800/20 transition-colors">
                                                <td className="py-2.5 pl-6 font-mono text-xs text-zinc-500">{row.account_code}</td>
                                                <td className="py-2.5 pr-4 text-zinc-300">{row.account_name}</td>
                                                <td className="py-2.5 pr-4 text-right font-mono text-xs text-blue-400">{fmt(Number(row.total_debits))}</td>
                                                <td className="py-2.5 pr-4 text-right font-mono text-xs text-violet-400">{fmt(Number(row.total_credits))}</td>
                                                <td className={`py-2.5 pr-4 text-right font-mono text-xs font-medium ${colorForBalance(Number(row.net_balance))}`}>{fmt(Number(row.net_balance))}</td>
                                            </tr>
                                        ))}
                                        <tr key={`sub-${type}`} className="border-t border-zinc-700/50 bg-zinc-800/20">
                                            <td colSpan={2} className="py-2 pl-4 text-xs font-semibold text-zinc-400">
                                                Total {TYPE_SECTION_LABELS[type] ?? type}
                                            </td>
                                            <td className="py-2 pr-4 text-right font-mono text-xs font-semibold text-blue-300">{fmt(subtotalDebits)}</td>
                                            <td className="py-2 pr-4 text-right font-mono text-xs font-semibold text-violet-300">{fmt(subtotalCredits)}</td>
                                            <td className={`py-2 pr-4 text-right font-mono text-xs font-bold ${colorForBalance(subtotalNet)}`}>{fmt(subtotalNet)}</td>
                                        </tr>
                                    </>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-zinc-700 bg-zinc-900/60">
                                <td colSpan={2} className="py-3 pl-4 text-xs font-bold text-zinc-200 uppercase tracking-wider">Grand Total</td>
                                <td className="py-3 pr-4 text-right font-mono text-sm font-bold text-blue-200">{fmt(grandTotalDebits)}</td>
                                <td className="py-3 pr-4 text-right font-mono text-sm font-bold text-violet-200">{fmt(grandTotalCredits)}</td>
                                <td className={`py-3 pr-4 text-right font-mono text-sm font-bold ${colorForBalance(grandNetBalance)}`}>{fmt(grandNetBalance)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
