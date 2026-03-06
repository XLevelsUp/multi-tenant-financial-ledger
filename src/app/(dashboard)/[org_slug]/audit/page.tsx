import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuditLog } from "@/actions/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuditLogClient } from "@/components/audit/audit-log-client";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ org_slug: string }> }): Promise<Metadata> {
    const { org_slug } = await params;
    return { title: `Audit Log — ${org_slug}` };
}

export default async function AuditPage({
    params,
    searchParams,
}: {
    params: Promise<{ org_slug: string }>;
    searchParams: Promise<{ page?: string; table?: string; op?: string }>;
}) {
    const { org_slug } = await params;
    const { page: pageStr, table: tableFilter, op: opFilter } = await searchParams;
    const page = Math.max(1, parseInt(pageStr ?? "1", 10));

    const supabase = await createClient();
    const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("slug", org_slug)
        .single();

    if (!org) notFound();

    const { data, count } = await getAuditLog(org.id, {
        tableFilter: tableFilter ?? undefined,
        operationFilter: (opFilter as "INSERT" | "UPDATE" | "DELETE") ?? undefined,
        page,
        pageSize: 50,
    });

    return (
        <AuditLogClient
            logs={data}
            count={count}
            page={page}
            orgSlug={org_slug}
            organizationId={org.id}
            tableFilter={tableFilter}
            opFilter={opFilter as "INSERT" | "UPDATE" | "DELETE" | undefined}
        />
    );
}
