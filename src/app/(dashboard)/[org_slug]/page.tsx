import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function OrgDashboardPage({
    params,
}: {
    params: Promise<{ org_slug: string }>;
}) {
    const { org_slug } = await params;
    const supabase = await createClient();

    // Fetch the organization by slug (RLS ensures the user is a member)
    const { data: org } = await supabase
        .from("organizations")
        .select("*")
        .eq("slug", org_slug)
        .single();

    if (!org) {
        notFound();
    }

    // Fetch user's membership/role for this org
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", org.id)
        .eq("user_id", user!.id)
        .single();

    // Fetch recent ledger entries (RLS-protected)
    const { data: entries } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false })
        .limit(10);

    // Calculate summary stats
    const totalEntries = entries?.length ?? 0;
    const totalCredits =
        entries
            ?.filter((e) => e.amount > 0)
            .reduce((sum, e) => sum + Number(e.amount), 0) ?? 0;
    const totalDebits =
        entries
            ?.filter((e) => e.amount < 0)
            .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0) ?? 0;
    const netBalance = totalCredits - totalDebits;

    const stats = [
        {
            label: "Net Balance",
            value: formatCurrency(netBalance),
            color: netBalance >= 0 ? "text-emerald-400" : "text-red-400",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                    <line x1="12" x2="12" y1="2" y2="22" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
            ),
        },
        {
            label: "Total Credits",
            value: formatCurrency(totalCredits),
            color: "text-emerald-400",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    <path d="M2 17V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
                </svg>
            ),
        },
        {
            label: "Total Debits",
            value: formatCurrency(totalDebits),
            color: "text-red-400",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
            ),
        },
        {
            label: "Entries",
            value: totalEntries.toString(),
            color: "text-zinc-100",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                    <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
                    <path d="M15 3v4a2 2 0 0 0 2 2h4" />
                </svg>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
                        {org.name}
                    </h1>
                    <p className="mt-1 text-sm text-zinc-400">
                        Organization dashboard &middot;{" "}
                        <Badge
                            variant="outline"
                            className="ml-1 border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-[10px]"
                        >
                            {membership?.role ?? "member"}
                        </Badge>
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Card
                        key={stat.label}
                        className="border-zinc-800 bg-zinc-900/50 backdrop-blur-sm"
                    >
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardDescription className="text-xs font-medium text-zinc-500">
                                {stat.label}
                            </CardDescription>
                            <div className="text-zinc-500">{stat.icon}</div>
                        </CardHeader>
                        <CardContent>
                            <p className={`text-2xl font-bold tracking-tight ${stat.color}`}>
                                {stat.value}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Recent Transactions */}
            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-zinc-100">Recent Transactions</CardTitle>
                    <CardDescription className="text-zinc-500">
                        Latest ledger entries for this organization
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {entries && entries.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm" role="table">
                                <thead>
                                    <tr className="border-b border-zinc-800">
                                        <th className="pb-3 text-left font-medium text-zinc-500">
                                            Date
                                        </th>
                                        <th className="pb-3 text-left font-medium text-zinc-500">
                                            Description
                                        </th>
                                        <th className="pb-3 text-right font-medium text-zinc-500">
                                            Amount
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/50">
                                    {entries.map((entry) => (
                                        <tr
                                            key={entry.id}
                                            className="transition-colors hover:bg-zinc-800/30"
                                        >
                                            <td className="py-3 text-zinc-400">
                                                {new Date(entry.created_at).toLocaleDateString(
                                                    "en-US",
                                                    {
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric",
                                                    }
                                                )}
                                            </td>
                                            <td className="py-3 text-zinc-200">
                                                {entry.description ?? "—"}
                                            </td>
                                            <td
                                                className={`py-3 text-right font-mono font-medium ${Number(entry.amount) >= 0
                                                        ? "text-emerald-400"
                                                        : "text-red-400"
                                                    }`}
                                            >
                                                {Number(entry.amount) >= 0 ? "+" : ""}
                                                {formatCurrency(Number(entry.amount))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-zinc-500" aria-hidden="true">
                                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
                                </svg>
                            </div>
                            <p className="text-sm font-medium text-zinc-300">
                                No entries yet
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                                Ledger entries will appear here once created.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}
