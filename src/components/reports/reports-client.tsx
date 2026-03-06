"use client";

import { useState, useCallback } from "react";
import { ReportTable } from "@/components/reports/report-table";
import { getTrialBalance, getIncomeStatement, getBalanceSheet } from "@/actions/reports";
import type { AccountBalanceRow } from "@/types/database";

type Tab = "trial_balance" | "income_statement" | "balance_sheet";

const TABS: { id: Tab; label: string }[] = [
    { id: "trial_balance", label: "Trial Balance" },
    { id: "income_statement", label: "Income Statement" },
    { id: "balance_sheet", label: "Balance Sheet" },
];

interface ReportsClientProps {
    organizationId: string;
    orgSlug: string;
    orgName: string;
}

export function ReportsClient({ organizationId, orgName }: ReportsClientProps) {
    const today = new Date().toISOString().split("T")[0];
    const firstOfYear = `${new Date().getFullYear()}-01-01`;

    const [activeTab, setActiveTab] = useState<Tab>("trial_balance");
    const [startDate, setStartDate] = useState(firstOfYear);
    const [endDate, setEndDate] = useState(today);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<AccountBalanceRow[] | null>(null);
    const [fetchedTab, setFetchedTab] = useState<Tab | null>(null);

    const runReport = useCallback(async (tab: Tab) => {
        setLoading(true);
        setError(null);

        const s = startDate || null;
        const e = endDate || null;

        let result;
        if (tab === "trial_balance") result = await getTrialBalance(organizationId, s, e);
        else if (tab === "income_statement") result = await getIncomeStatement(organizationId, s, e);
        else result = await getBalanceSheet(organizationId, s, e);

        setLoading(false);

        if (!result.success) { setError(result.error); return; }

        setData(result.data);
        setFetchedTab(tab);
    }, [organizationId, startDate, endDate]);

    function handleTabChange(tab: Tab) {
        setActiveTab(tab);
        setData(null);
        setFetchedTab(null);
        setError(null);
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Financial Reports</h1>
                <p className="mt-1 text-sm text-zinc-400">{orgName}</p>
            </div>

            {/* Tab Bar */}
            <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1 w-fit">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.id
                                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                                : "text-zinc-500 hover:text-zinc-200"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Date Range Filters */}
            <div className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="space-y-1.5">
                    <label htmlFor="start-date" className="block text-xs font-medium text-zinc-400">
                        From Date
                    </label>
                    <input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="end-date" className="block text-xs font-medium text-zinc-400">
                        To Date
                    </label>
                    <input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
                <button
                    onClick={() => runReport(activeTab)}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-violet-700 disabled:opacity-50 transition-all"
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Generating…
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                                <path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m7 11 4-4 4 4 6-6" />
                            </svg>
                            Run Report
                        </>
                    )}
                </button>

                {/* Quick date presets */}
                <div className="flex items-center gap-1.5 ml-auto">
                    {[
                        { label: "YTD", start: firstOfYear, end: today },
                        { label: "This Month", start: `${today.slice(0, 7)}-01`, end: today },
                        { label: "All Time", start: "", end: "" },
                    ].map((p) => (
                        <button
                            key={p.label}
                            onClick={() => { setStartDate(p.start); setEndDate(p.end); }}
                            className="rounded px-2 py-1 text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
                    {error}
                </div>
            )}

            {/* Report Output */}
            {data && fetchedTab === activeTab ? (
                <ReportTable
                    rows={data}
                    title={TABS.find((t) => t.id === activeTab)?.label ?? "Report"}
                    grouped={activeTab !== "trial_balance"}
                    typeSections={
                        activeTab === "income_statement"
                            ? ["revenue", "expense"]
                            : activeTab === "balance_sheet"
                                ? ["asset", "liability", "equity"]
                                : undefined
                    }
                />
            ) : !loading && !data ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-16 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-zinc-700" aria-hidden="true">
                        <path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m7 11 4-4 4 4 6-6" />
                    </svg>
                    <p className="text-sm text-zinc-500">Select a date range and click &ldquo;Run Report&rdquo; to generate a financial statement.</p>
                </div>
            ) : null}
        </div>
    );
}
