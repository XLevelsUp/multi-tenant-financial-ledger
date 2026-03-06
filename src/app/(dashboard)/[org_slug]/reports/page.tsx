import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportsClient } from "@/components/reports/reports-client";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ org_slug: string }> }): Promise<Metadata> {
    const { org_slug } = await params;
    return { title: `Reports — ${org_slug}` };
}

export default async function ReportsPage({ params }: { params: Promise<{ org_slug: string }> }) {
    const { org_slug } = await params;
    const supabase = await createClient();

    const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("slug", org_slug)
        .single();

    if (!org) notFound();

    return <ReportsClient organizationId={org.id} orgSlug={org_slug} orgName={org.name} />;
}
