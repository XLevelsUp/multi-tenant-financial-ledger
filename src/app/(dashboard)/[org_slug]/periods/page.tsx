import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PeriodsClient } from "@/components/periods/periods-client";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ org_slug: string }> }): Promise<Metadata> {
    const { org_slug } = await params;
    return { title: `Accounting Periods — ${org_slug}` };
}

export default async function PeriodsPage({ params }: { params: Promise<{ org_slug: string }> }) {
    const { org_slug } = await params;
    const supabase = await createClient();

    const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("slug", org_slug)
        .single();

    if (!org) notFound();

    const admin = createAdminClient();

    // Fetch periods + equity accounts (for RE account selection)
    const [{ data: periods }, { data: equityAccounts }] = await Promise.all([
        admin
            .from("accounting_periods")
            .select("*")
            .eq("organization_id", org.id)
            .order("start_date", { ascending: false }),
        admin
            .from("accounts")
            .select("id, name, code, type")
            .eq("organization_id", org.id)
            .eq("type", "equity")
            .eq("is_active", true)
            .order("code"),
    ]);

    return (
        <PeriodsClient
            periods={periods ?? []}
            equityAccounts={equityAccounts ?? []}
            organizationId={org.id}
            orgSlug={org_slug}
        />
    );
}
