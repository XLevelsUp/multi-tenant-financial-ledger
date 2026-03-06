"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { CreateAccountDialog } from "@/components/accounts/create-account-dialog";
import { updateAccount, deleteAccount } from "@/actions/accounts";
import type { Account, AccountType } from "@/types/database";

const TYPE_COLORS: Record<AccountType, string> = {
    asset: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    liability: "border-orange-500/30 bg-orange-500/10 text-orange-400",
    equity: "border-violet-500/30 bg-violet-500/10 text-violet-400",
    revenue: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    expense: "border-red-500/30 bg-red-500/10 text-red-400",
};

interface AccountsClientProps {
    accounts: Account[];
    organizationId: string;
    orgSlug: string;
}

export function AccountsClient({ accounts, organizationId, orgSlug }: AccountsClientProps) {
    const router = useRouter();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const grouped = accounts.reduce<Record<AccountType, Account[]>>(
        (acc, a) => { acc[a.type] = [...(acc[a.type] ?? []), a]; return acc; },
        {} as Record<AccountType, Account[]>
    );
    const typeOrder: AccountType[] = ["asset", "liability", "equity", "revenue", "expense"];

    async function handleToggleActive(account: Account) {
        setTogglingId(account.id);
        setActionError(null);
        const result = await updateAccount({ id: account.id, organization_id: organizationId, is_active: !account.is_active });
        setTogglingId(null);
        if (!result.success) { setActionError(result.error); return; }
        router.refresh();
    }

    async function handleDelete(account: Account) {
        if (!confirm(`Delete account "${account.code} — ${account.name}"? This cannot be undone.`)) return;
        setDeletingId(account.id);
        setActionError(null);
        const result = await deleteAccount(account.id, organizationId);
        setDeletingId(null);
        if (!result.success) { setActionError(result.error); return; }
        router.refresh();
    }

    return (
        <>
            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Chart of Accounts</h1>
                    <p className="mt-1 text-sm text-zinc-400">{accounts.length} account{accounts.length !== 1 ? "s" : ""}</p>
                </div>
                <button
                    onClick={() => setDialogOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-violet-700 transition-all"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" />
                    </svg>
                    New Account
                </button>
            </div>

            {actionError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
                    {actionError}
                    <button onClick={() => setActionError(null)} className="ml-3 underline text-xs">dismiss</button>
                </div>
            )}

            {/* Accounts table grouped by type */}
            <div className="space-y-6">
                {typeOrder.map((type) => {
                    const group = grouped[type];
                    if (!group?.length) return null;
                    return (
                        <div key={type} className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                            <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-4 py-2.5">
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize ${TYPE_COLORS[type]}`}>{type}</Badge>
                                <span className="text-xs text-zinc-500">{group.length} account{group.length !== 1 ? "s" : ""}</span>
                            </div>
                            <table className="w-full text-sm" role="table">
                                <thead>
                                    <tr className="border-b border-zinc-800/50">
                                        <th className="py-2.5 pl-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 w-24">Code</th>
                                        <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Name</th>
                                        <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 hidden md:table-cell">Description</th>
                                        <th className="py-2.5 pr-4 text-center text-xs font-medium uppercase tracking-wider text-zinc-500 w-20">Status</th>
                                        <th className="py-2.5 pr-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/50">
                                    {group.map((account) => (
                                        <tr key={account.id} className={`transition-colors hover:bg-zinc-800/20 ${!account.is_active ? "opacity-50" : ""}`}>
                                            <td className="py-3 pl-4 pr-2 font-mono text-xs text-zinc-400">{account.code}</td>
                                            <td className="py-3 pr-4 text-zinc-200 font-medium">{account.name}</td>
                                            <td className="py-3 pr-4 text-zinc-500 text-xs hidden md:table-cell truncate max-w-xs">{account.description ?? "—"}</td>
                                            <td className="py-3 pr-4 text-center">
                                                <Badge variant="outline" className={account.is_active
                                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0"
                                                    : "border-zinc-700 bg-zinc-800/30 text-zinc-500 text-[10px] px-1.5 py-0"
                                                }>
                                                    {account.is_active ? "Active" : "Inactive"}
                                                </Badge>
                                            </td>
                                            <td className="py-3 pr-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleToggleActive(account)}
                                                        disabled={togglingId === account.id}
                                                        aria-label={account.is_active ? "Deactivate account" : "Activate account"}
                                                        className="rounded px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors disabled:opacity-50"
                                                    >
                                                        {togglingId === account.id ? "…" : account.is_active ? "Deactivate" : "Activate"}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(account)}
                                                        disabled={deletingId === account.id}
                                                        aria-label="Delete account"
                                                        className="rounded px-2 py-1 text-[11px] text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                                    >
                                                        {deletingId === account.id ? "…" : "Delete"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                })}

                {accounts.length === 0 && (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 py-16 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-zinc-500" aria-hidden="true">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                                <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-zinc-300">No accounts yet</p>
                        <p className="text-xs text-zinc-500">Click &ldquo;New Account&rdquo; or seed a default Chart of Accounts.</p>
                    </div>
                )}
            </div>

            <CreateAccountDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                organizationId={organizationId}
            />
        </>
    );
}
