"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { updateTransactionAction } from "@/actions/ledger";
import type { Account, TransactionWithLines, JournalEntryType } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

interface JournalLineForm {
    id: string;
    account_id: string;
    amount: string;
    type: JournalEntryType;
    description: string;
}

function generateId() { return Math.random().toString(36).slice(2, 10); }

export interface TransactionFormProps {
    initialData: TransactionWithLines;
    accounts: Account[];
    orgSlug: string;
    organizationId: string;
}

// ── Account selector ──────────────────────────────────────────────────────────

function AccountSelect({
    id,
    value,
    onChange,
    accounts,
    label,
    placeholder,
}: {
    id: string;
    value: string;
    onChange: (v: string) => void;
    accounts: Account[];
    label: string;
    placeholder: string;
}) {
    const typeOrder = ["asset", "liability", "equity", "revenue", "expense"] as const;
    const typeLabels: Record<string, string> = {
        asset: "Assets", liability: "Liabilities", equity: "Equity",
        revenue: "Revenue", expense: "Expenses",
    };
    const byType = accounts.reduce<Record<string, Account[]>>((acc, a) => {
        acc[a.type] = [...(acc[a.type] ?? []), a];
        return acc;
    }, {});

    return (
        <div className="space-y-1.5">
            <Label htmlFor={id} className="text-zinc-300 text-xs">
                {label} <span className="text-red-400">*</span>
            </Label>
            <select
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
                <option value="" disabled>{placeholder}</option>
                {typeOrder.map((type) =>
                    byType[type]?.length ? (
                        <optgroup key={type} label={typeLabels[type]}>
                            {byType[type].map((a) => (
                                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                            ))}
                        </optgroup>
                    ) : null
                )}
            </select>
        </div>
    );
}

// ── Main Form ─────────────────────────────────────────────────────────────────

export function TransactionForm({ initialData, accounts, orgSlug, organizationId }: TransactionFormProps) {
    const router = useRouter();

    const [description, setDescription] = useState(initialData.description);
    const [entryDate, setEntryDate] = useState(initialData.entry_date);
    const [status, setStatus] = useState<"draft" | "posted">(initialData.status);
    const [lines, setLines] = useState<JournalLineForm[]>(() =>
        initialData.journal_lines.map((l) => ({
            id: generateId(),
            account_id: l.account_id,
            amount: String(l.amount),
            type: l.type,
            description: l.description ?? "",
        }))
    );
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Balance calculator ────────────────────────────────────────────────────
    const { totalDebits, totalCredits, isBalanced } = (() => {
        const d = lines.filter(l => l.type === "debit").reduce((s, l) => s + (isNaN(parseFloat(l.amount)) ? 0 : Math.round(parseFloat(l.amount) * 10000)), 0);
        const c = lines.filter(l => l.type === "credit").reduce((s, l) => s + (isNaN(parseFloat(l.amount)) ? 0 : Math.round(parseFloat(l.amount) * 10000)), 0);
        return { totalDebits: d / 10000, totalCredits: c / 10000, isBalanced: d > 0 && d === c };
    })();

    const updateLine = useCallback((id: string, field: keyof JournalLineForm, value: string) => {
        setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!isBalanced) return;
        setSubmitting(true);
        setError(null);

        const result = await updateTransactionAction(
            {
                tx_id: initialData.id,
                org_id: organizationId,
                description,
                entry_date: entryDate,
                status,
                lines: lines.map((l) => ({
                    account_id: l.account_id,
                    amount: l.amount,
                    type: l.type,
                    description: l.description || undefined,
                })),
            },
            orgSlug
        );

        setSubmitting(false);
        if (!result.success) {
            setError(result.error);
            return;
        }

        router.push(`/${orgSlug}/ledger`);
    }

    const createdBy = initialData.creator?.full_name ?? initialData.creator?.email ?? "Unknown";
    const createdAt = new Date(initialData.created_at).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Edit Transaction</h1>
                <p className="mt-1 text-sm text-zinc-400">
                    Modify the journal entry. Only draft transactions can be edited.
                </p>
            </div>

            {/* Creator metadata */}
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2.5 text-xs text-zinc-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                    <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
                </svg>
                <span>
                    Created by <span className="text-zinc-300 font-medium">{createdBy}</span> on {createdAt}
                </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Header fields */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
                    <h2 className="text-sm font-medium text-zinc-300">Transaction Details</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="sm:col-span-2 space-y-1.5">
                            <Label htmlFor="description" className="text-zinc-300 text-xs">
                                Description <span className="text-red-400">*</span>
                            </Label>
                            <Input
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe the transaction"
                                required
                                className="border-zinc-700 bg-zinc-800/50 text-zinc-50 placeholder:text-zinc-500 focus-visible:ring-indigo-500 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="entry-date" className="text-zinc-300 text-xs">
                                Date <span className="text-red-400">*</span>
                            </Label>
                            <Input
                                id="entry-date"
                                type="date"
                                value={entryDate}
                                onChange={(e) => setEntryDate(e.target.value)}
                                required
                                className="border-zinc-700 bg-zinc-800/50 text-zinc-50 focus-visible:ring-indigo-500 text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Journal lines */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
                    <h2 className="text-sm font-medium text-zinc-300">Journal Lines</h2>

                    <div className="grid grid-cols-12 gap-2 px-1">
                        <span className="col-span-4 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Account</span>
                        <span className="col-span-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Type</span>
                        <span className="col-span-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Amount</span>
                        <span className="col-span-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Memo</span>
                        <span className="col-span-1" />
                    </div>

                    <div className="space-y-1.5">
                        {lines.map((line, idx) => (
                            <div
                                key={line.id}
                                className="grid grid-cols-12 gap-2 items-center rounded-lg border border-zinc-800/70 bg-zinc-800/20 px-2 py-2"
                            >
                                <div className="col-span-4">
                                    <select
                                        value={line.account_id}
                                        onChange={(e) => updateLine(line.id, "account_id", e.target.value)}
                                        required
                                        aria-label={`Account for line ${idx + 1}`}
                                        className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="" disabled>Select account…</option>
                                        {(["asset", "liability", "equity", "revenue", "expense"] as const).map((type) => {
                                            const typeLabels: Record<string, string> = {
                                                asset: "Assets", liability: "Liabilities", equity: "Equity",
                                                revenue: "Revenue", expense: "Expenses",
                                            };
                                            const group = accounts.filter(a => a.type === type);
                                            return group.length ? (
                                                <optgroup key={type} label={typeLabels[type]}>
                                                    {group.map(a => (
                                                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                                                    ))}
                                                </optgroup>
                                            ) : null;
                                        })}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <div className="flex rounded-md border border-zinc-700 overflow-hidden">
                                        {(["debit", "credit"] as const).map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => updateLine(line.id, "type", t)}
                                                className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
                                                    line.type === t
                                                        ? t === "debit"
                                                            ? "bg-blue-600/80 text-white"
                                                            : "bg-violet-600/80 text-white"
                                                        : "bg-transparent text-zinc-500 hover:text-zinc-300"
                                                }`}
                                            >
                                                {t === "debit" ? "Dr" : "Cr"}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="col-span-3">
                                    <Input
                                        type="number"
                                        step="0.0001"
                                        min="0.0001"
                                        value={line.amount}
                                        onChange={(e) => updateLine(line.id, "amount", e.target.value)}
                                        placeholder="0.00"
                                        required
                                        aria-label={`Amount for line ${idx + 1}`}
                                        className="border-zinc-700 bg-zinc-800/50 text-zinc-50 placeholder:text-zinc-600 focus-visible:ring-indigo-500 text-xs h-8"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <Input
                                        value={line.description}
                                        onChange={(e) => updateLine(line.id, "description", e.target.value)}
                                        placeholder="Optional"
                                        aria-label={`Memo for line ${idx + 1}`}
                                        className="border-zinc-700 bg-zinc-800/50 text-zinc-500 placeholder:text-zinc-600 focus-visible:ring-indigo-500 text-xs h-8"
                                    />
                                </div>
                                <div className="col-span-1 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setLines(prev => prev.length > 2 ? prev.filter(l => l.id !== line.id) : prev)}
                                        disabled={lines.length <= 2}
                                        aria-label="Remove line"
                                        className="rounded p-1 text-zinc-600 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                                            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setLines(prev => [...prev, { id: generateId(), account_id: "", amount: "", type: "debit", description: "" }])}
                        className="text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 text-xs"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 h-3.5 w-3.5" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" />
                        </svg>
                        Add Line
                    </Button>

                    {/* Balance indicator */}
                    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                        <div className="flex items-center gap-6 text-sm">
                            <div>
                                <span className="text-xs text-zinc-500 mr-1.5">Dr</span>
                                <span className="font-mono font-medium text-blue-400">
                                    {totalDebits.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div>
                                <span className="text-xs text-zinc-500 mr-1.5">Cr</span>
                                <span className="font-mono font-medium text-violet-400">
                                    {totalCredits.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                        <Badge
                            variant="outline"
                            className={isBalanced
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                : "border-red-500/30 bg-red-500/10 text-red-400"
                            }
                        >
                            {isBalanced ? "✓ Balanced" : "Unbalanced"}
                        </Badge>
                    </div>
                </div>

                {/* Status + actions */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-400">Status:</span>
                        <div className="flex items-center rounded-md border border-zinc-700 overflow-hidden">
                            {(["draft", "posted"] as const).map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setStatus(s)}
                                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                        status === s
                                            ? s === "posted"
                                                ? "bg-emerald-600 text-white"
                                                : "bg-zinc-700 text-zinc-100"
                                            : "bg-transparent text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {status === "posted" && (
                        <p className="text-[11px] text-amber-400">
                            ⚠ Posting is permanent — this transaction cannot be edited after posting.
                        </p>
                    )}

                    {error && (
                        <div
                            className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => router.push(`/${orgSlug}/ledger`)}
                            className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={submitting || !isBalanced}
                            className="bg-linear-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700 disabled:opacity-50"
                        >
                            {submitting
                                ? "Saving…"
                                : status === "posted"
                                    ? "Post Transaction"
                                    : "Save Draft"
                            }
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}
