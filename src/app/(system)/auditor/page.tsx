import { getGlobalLedger } from "@/actions/system";
import { GlobalAuditorTable } from "@/components/system/global-auditor-table";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Global Auditor — System Admin" };

export default async function GlobalAuditorPage() {
    const result = await getGlobalLedger(100, 0);

    if (!result.success) {
        return (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-400">
                Failed to load global ledger: {result.error}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Global Auditor</h1>
                <p className="mt-1 text-sm text-zinc-400">
                    Cross-tenant transaction ledger. Showing the {result.data.length} most recent
                    entries across all organizations ({result.count} total).
                </p>
            </div>

            <GlobalAuditorTable data={result.data} count={result.count} />
        </div>
    );
}
