import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AccountsClient } from "@/components/accounts/accounts-client";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ org_slug: string }> }): Promise<Metadata> {
    const { org_slug } = await params;
    return { title: `Chart of Accounts — ${org_slug}` };
}

export default async function AccountsPage({ params }: { params: Promise<{ org_slug: string }> }) {
    const { org_slug } = await params;
    const supabase = await createClient();

    const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("slug", org_slug)
        .single();

    if (!org) notFound();

    const admin = createAdminClient();
    const { data: accounts } = await admin
        .from("accounts")
        .select("*")
        .eq("organization_id", org.id)
        .order("code", { ascending: true });

    return (
        <AccountsClient
            accounts={accounts ?? []}
            organizationId={org.id}
            orgSlug={org_slug}
        />
    );
}
