"use client";

import type { GlobalOrgFinancials } from "@/types/database";

const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function ProfitCell({ value }: { value: number }) {
    const formatted = fmt.format(value);
    if (value > 0) return <span className="font-mono text-emerald-400">{formatted}</span>;
    if (value < 0) return <span className="font-mono text-red-400">{formatted}</span>;
    return <span className="font-mono text-zinc-500">{formatted}</span>;
}

interface Props {
    data: GlobalOrgFinancials[];
}

export function GlobalFinancialsTable({ data }: Props) {
    if (data.length === 0) {
        return (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 py-12 text-center text-sm text-zinc-500">
                No organizations found.
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table">
                    <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/80">
                            <th className="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                                Organization
                            </th>
                            <th className="py-3 px-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                                Slug
                            </th>
                            <th className="py-3 px-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                                Revenue
                            </th>
                            <th className="py-3 px-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                                Expenses
                            </th>
                            <th className="py-3 px-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                                Net P&amp;L
                            </th>
                            <th className="py-3 px-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                                Transactions
                            </th>
                            <th className="py-3 pl-3 pr-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                                Members
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                        {data.map((row) => (
                            <tr
                                key={row.org_id}
                                className="transition-colors hover:bg-zinc-800/30"
                            >
                                <td className="py-3 pl-4 pr-3 font-medium text-zinc-200">
                                    {row.org_name}
                                </td>
                                <td className="py-3 px-3 font-mono text-xs text-zinc-500">
                                    {row.org_slug}
                                </td>
                                <td className="py-3 px-3 text-right font-mono text-xs text-emerald-400">
                                    {fmt.format(Number(row.total_income))}
                                </td>
                                <td className="py-3 px-3 text-right font-mono text-xs text-red-400">
                                    {fmt.format(Number(row.total_expense))}
                                </td>
                                <td className="py-3 px-3 text-right text-xs">
                                    <ProfitCell value={Number(row.net_profit)} />
                                </td>
                                <td className="py-3 px-3 text-right text-xs text-zinc-400 tabular-nums">
                                    {Number(row.transaction_count).toLocaleString()}
                                </td>
                                <td className="py-3 pl-3 pr-4 text-right text-xs text-zinc-400 tabular-nums">
                                    {Number(row.member_count).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
