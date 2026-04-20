import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTransactionById, getOrganizationAccounts } from "@/actions/ledger";
import { TransactionForm } from "@/components/ledger/transaction-form";
import type { Metadata } from "next";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ org_slug: string; tx_id: string }>;
}): Promise<Metadata> {
    const { org_slug } = await params;
    return { title: `Edit Transaction — ${org_slug}` };
}

export default async function EditTransactionPage({
    params,
}: {
    params: Promise<{ org_slug: string; tx_id: string }>;
}) {
    const { org_slug, tx_id } = await params;

    const supabase = await createClient();

    // Resolve org slug → id (RLS prevents cross-tenant access)
    const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("slug", org_slug)
        .single();

    if (!org) notFound();

    // Parallel fetch of the transaction and chart of accounts
    const [tx, accounts] = await Promise.all([
        getTransactionById(tx_id, org.id),
        getOrganizationAccounts(org.id),
    ]);

    // 404 if transaction doesn't exist or belongs to a different org
    if (!tx) notFound();

    // Redirect posted transactions — they cannot be edited
    if (tx.status === "posted") redirect(`/${org_slug}/ledger`);

    return (
        <div className="space-y-6">
            <TransactionForm
                initialData={tx}
                accounts={accounts}
                orgSlug={org_slug}
                organizationId={org.id}
            />
        </div>
    );
}
