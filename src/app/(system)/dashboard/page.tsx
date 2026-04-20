import { getGlobalFinancials } from "@/actions/system";
import { GlobalFinancialsTable } from "@/components/system/global-financials-table";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Global Dashboard — System Admin" };

function formatCurrency(v: number) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(v);
}

interface KpiCardProps {
    label: string;
    value: string;
    sub?: string;
    accent?: "green" | "red" | "indigo" | "default";
}

function KpiCard({ label, value, sub, accent = "default" }: KpiCardProps) {
    const accentClass = {
        green: "text-emerald-400",
        red: "text-red-400",
        indigo: "text-indigo-400",
        default: "text-zinc-50",
    }[accent];

    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${accentClass}`}>{value}</p>
            {sub && <p className="mt-1 text-xs text-zinc-600">{sub}</p>}
        </div>
    );
}

export default async function GlobalDashboardPage() {
    const result = await getGlobalFinancials();

    if (!result.success) {
        return (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-400">
                Failed to load global financials: {result.error}
            </div>
        );
    }

    const { data, platformIncome, platformExpense, platformProfit, orgCount } = result;

    return (
        <div className="space-y-8">
            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Global Dashboard</h1>
                <p className="mt-1 text-sm text-zinc-400">
                    Platform-wide financial overview across all {orgCount} organization{orgCount !== 1 ? "s" : ""}.
                </p>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <KpiCard
                    label="Total Platform Revenue"
                    value={formatCurrency(platformIncome)}
                    sub="Sum of posted revenue credits"
                    accent="green"
                />
                <KpiCard
                    label="Total Platform Expenses"
                    value={formatCurrency(platformExpense)}
                    sub="Sum of posted expense debits"
                    accent="red"
                />
                <KpiCard
                    label="Net Platform Profit"
                    value={formatCurrency(platformProfit)}
                    sub="Revenue minus expenses"
                    accent={platformProfit >= 0 ? "green" : "red"}
                />
            </div>

            {/* Secondary stat */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <KpiCard
                    label="Active Organizations"
                    value={String(orgCount)}
                    sub="Total tenants on platform"
                    accent="indigo"
                />
            </div>

            {/* Per-org financials table */}
            <div className="space-y-3">
                <h2 className="text-sm font-semibold text-zinc-300">Organization Breakdown</h2>
                <GlobalFinancialsTable data={data} />
            </div>
        </div>
    );
}
