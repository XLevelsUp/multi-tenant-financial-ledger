import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTransactions, getOrganizationAccounts } from "@/actions/ledger";
import { LedgerClient } from "@/components/ledger/ledger-client";
import type { Metadata } from "next";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ org_slug: string }>;
}): Promise<Metadata> {
    const { org_slug } = await params;
    return { title: `Ledger — ${org_slug}` };
}

export default async function LedgerPage({
    params,
    searchParams,
}: {
    params: Promise<{ org_slug: string }>;
    searchParams: Promise<{ page?: string }>;
}) {
    const { org_slug } = await params;
    const { page: pageParam } = await searchParams;
    const page = Math.max(1, parseInt(pageParam ?? "1", 10));

    const supabase = await createClient();

    // Resolve org slug → id (RLS prevents cross-tenant access)
    const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("slug", org_slug)
        .single();

    if (!org) notFound();

    // Parallel fetch of transactions and chart of accounts
    const [{ data: transactions, count }, accounts] = await Promise.all([
        getTransactions(org.id, page),
        getOrganizationAccounts(org.id),
    ]);

    return (
        <div className="space-y-6">
            <LedgerClient
                transactions={transactions}
                count={count}
                organizationId={org.id}
                orgSlug={org_slug}
                accounts={accounts}
            />

            {/* Pagination (simple prev/next) */}
            {count > 25 && (
                <div className="flex items-center justify-between text-sm text-zinc-500">
                    <span>
                        Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, count)} of {count}
                    </span>
                    <div className="flex gap-2">
                        {page > 1 && (
                            <a
                                href={`/${org_slug}/ledger?page=${page - 1}`}
                                className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800 transition-colors"
                            >
                                Previous
                            </a>
                        )}
                        {page * 25 < count && (
                            <a
                                href={`/${org_slug}/ledger?page=${page + 1}`}
                                className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800 transition-colors"
                            >
                                Next
                            </a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
