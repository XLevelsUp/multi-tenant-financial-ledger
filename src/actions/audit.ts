"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AuditLog } from "@/types/database";

export interface AuditLogOptions {
    tableFilter?: string;
    operationFilter?: "INSERT" | "UPDATE" | "DELETE";
    page?: number;
    pageSize?: number;
}

export interface AuditLogResult {
    data: AuditLog[];
    count: number;
}

/** Fetch paginated audit log for an org */
export async function getAuditLog(
    organizationId: string,
    opts: AuditLogOptions = {}
): Promise<AuditLogResult> {
    const { tableFilter, operationFilter, page = 1, pageSize = 50 } = opts;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], count: 0 };

    const admin = createAdminClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = admin
        .from("audit_log")
        .select("*", { count: "exact" })
        .eq("organization_id", organizationId)
        .order("changed_at", { ascending: false })
        .range(from, to);

    if (tableFilter) query = query.eq("table_name", tableFilter);
    if (operationFilter) query = query.eq("operation", operationFilter);

    const { data, count, error } = await query;
    if (error) { console.error("getAuditLog error:", error); return { data: [], count: 0 }; }

    return { data: (data ?? []) as AuditLog[], count: count ?? 0 };
}
