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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAccount } from "@/actions/accounts";
import type { AccountType } from "@/types/database";

const ACCOUNT_TYPES: { value: AccountType; label: string; description: string }[] = [
    { value: "asset", label: "Asset", description: "Cash, receivables, property" },
    { value: "liability", label: "Liability", description: "Payables, debt, obligations" },
    { value: "equity", label: "Equity", description: "Owner's equity, retained earnings" },
    { value: "revenue", label: "Revenue", description: "Sales, service income" },
    { value: "expense", label: "Expense", description: "Operating costs, wages" },
];

interface CreateAccountDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    organizationId: string;
}

export function CreateAccountDialog({
    open,
    onOpenChange,
    organizationId,
}: CreateAccountDialogProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [type, setType] = useState<AccountType>("asset");
    const [description, setDescription] = useState("");

    function reset() {
        setName(""); setCode(""); setType("asset"); setDescription(""); setError(null);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const result = await createAccount({ organization_id: organizationId, name, code, type, description: description || undefined });
        setLoading(false);

        if (!result.success) { setError(result.error); return; }
        reset();
        onOpenChange(false);
        router.refresh();
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
            <DialogContent className="border-zinc-800 bg-zinc-900 max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-zinc-100">Create Account</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Add a new account to your Chart of Accounts.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="acc-code" className="text-zinc-300 text-xs">Code <span className="text-red-400">*</span></Label>
                            <Input
                                id="acc-code"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="1000"
                                required
                                className="border-zinc-700 bg-zinc-800/50 text-zinc-50 placeholder:text-zinc-500 text-sm focus-visible:ring-indigo-500"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="acc-name" className="text-zinc-300 text-xs">Name <span className="text-red-400">*</span></Label>
                            <Input
                                id="acc-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Cash"
                                required
                                className="border-zinc-700 bg-zinc-800/50 text-zinc-50 placeholder:text-zinc-500 text-sm focus-visible:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-zinc-300 text-xs">Type <span className="text-red-400">*</span></Label>
                        <div className="grid grid-cols-1 gap-1.5">
                            {ACCOUNT_TYPES.map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => setType(t.value)}
                                    className={`flex items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${type === t.value
                                            ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                                            : "border-zinc-700 bg-zinc-800/30 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                                        }`}
                                >
                                    <span className="font-medium w-16">{t.label}</span>
                                    <span className="text-xs opacity-70">{t.description}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="acc-desc" className="text-zinc-300 text-xs">Description <span className="text-zinc-500">(optional)</span></Label>
                        <Input
                            id="acc-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of this account"
                            className="border-zinc-700 bg-zinc-800/50 text-zinc-50 placeholder:text-zinc-500 text-sm focus-visible:ring-indigo-500"
                        />
                    </div>

                    {error && (
                        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
                            {error}
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => { reset(); onOpenChange(false); }} className="text-zinc-400 hover:text-zinc-200">Cancel</Button>
                        <Button type="submit" disabled={loading} className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700 disabled:opacity-50">
                            {loading ? "Creating…" : "Create Account"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
