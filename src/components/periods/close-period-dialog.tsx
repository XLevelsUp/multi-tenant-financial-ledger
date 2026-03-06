"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { closeAccountingPeriod } from "@/actions/periods";
import type { AccountingPeriod } from "@/types/database";

interface EquityAccount {
    id: string;
    name: string;
    code: string;
}

interface ClosePeriodDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    period: AccountingPeriod;
    equityAccounts: EquityAccount[];
    orgSlug: string;
}

export function ClosePeriodDialog({
    open,
    onOpenChange,
    period,
    equityAccounts,
    orgSlug,
}: ClosePeriodDialogProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [selectedAccountId, setSelectedAccountId] = useState(equityAccounts[0]?.id ?? "");

    // Suggest "Retained Earnings" as the default
    const suggestedAccount = equityAccounts.find(
        (a) => a.name.toLowerCase().includes("retained") || a.code === "3900"
    );

    function reset() { setError(null); setSuccess(null); setSelectedAccountId(equityAccounts[0]?.id ?? ""); }

    async function handleClose() {
        if (!selectedAccountId) { setError("Please select a Retained Earnings account."); return; }
        setLoading(true); setError(null);
        const result = await closeAccountingPeriod(period.id, selectedAccountId, orgSlug);
        setLoading(false);
        if (!result.success) { setError(result.error); return; }
        const msg = result.closingTransactionId
            ? `Period closed. Closing entry posted (TX: ${result.closingTransactionId.slice(0, 8)}…).`
            : "Period closed. No income statement activity — no closing entry required.";
        setSuccess(msg);
        router.refresh();
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
            <DialogContent className="border-zinc-800 bg-zinc-900 max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-zinc-100 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-amber-400" aria-hidden="true">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" />
                            </svg>
                        </span>
                        Hard Close: {period.name}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400 text-sm space-y-1 leading-relaxed">
                        This is <strong className="text-amber-300">irreversible</strong>. Closing this period will:
                        <span className="block mt-2 space-y-1">
                            <span className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">1.</span><span>Generate an automatic closing entry that zeroes all Revenue &amp; Expense accounts for <strong className="text-zinc-200">{period.name}</strong>.</span></span>
                            <span className="flex items-start gap-2"><span className="text-amber-400">2.</span><span>Post the net income (or loss) to the selected <strong className="text-zinc-200">Retained Earnings</strong> account.</span></span>
                            <span className="flex items-start gap-2"><span className="text-amber-400">3.</span><span>Permanently block any backdated entries in this period.</span></span>
                        </span>
                    </DialogDescription>
                </DialogHeader>

                {!success ? (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 px-4 py-3 text-sm text-zinc-300">
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Period</span>
                                <span className="font-medium">{period.name}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span className="text-zinc-500">Date Range</span>
                                <span className="font-mono text-xs">{period.start_date} → {period.end_date}</span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="re-account" className="text-zinc-300 text-xs">
                                Retained Earnings Account <span className="text-red-400">*</span>
                            </Label>
                            {equityAccounts.length === 0 ? (
                                <p className="text-sm text-red-400">No active equity accounts found. Create a Retained Earnings (equity) account first.</p>
                            ) : (
                                <select
                                    id="re-account"
                                    value={selectedAccountId}
                                    onChange={(e) => setSelectedAccountId(e.target.value)}
                                    className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    defaultValue={suggestedAccount?.id ?? equityAccounts[0]?.id}
                                >
                                    {equityAccounts.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.code} — {a.name}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <p className="text-xs text-zinc-500">Select the equity account to receive the net income closing entry.</p>
                        </div>

                        {error && (
                            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">{error}</div>
                        )}

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => { reset(); onOpenChange(false); }} className="text-zinc-400 hover:text-zinc-200">Cancel</Button>
                            <Button
                                onClick={handleClose}
                                disabled={loading || equityAccounts.length === 0}
                                className="bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                                {loading ? "Closing period…" : "Confirm Hard Close"}
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-300">
                            <p className="font-medium mb-1">✓ Period Successfully Closed</p>
                            <p className="text-emerald-400/80">{success}</p>
                        </div>
                        <DialogFooter>
                            <Button onClick={() => { reset(); onOpenChange(false); }} className="bg-zinc-700 text-zinc-200 hover:bg-zinc-600">Done</Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
