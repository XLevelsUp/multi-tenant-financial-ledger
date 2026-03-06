"use client";

import { useState, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { createTransactionAction } from "@/actions/ledger";
import type { Account, JournalEntryType } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

interface JournalLineForm {
    id: string;
    account_id: string;
    amount: string;
    type: JournalEntryType;
    description: string;
}

type SimpleMode = "expense" | "income" | "transfer";

const SIMPLE_MODES: { id: SimpleMode; label: string; icon: string; hint: string }[] = [
    { id: "expense", label: "Expense", icon: "↑", hint: "Money going OUT (salary, rent, bills)" },
    { id: "income", label: "Income", icon: "↓", hint: "Money coming IN (sales, payments received)" },
    { id: "transfer", label: "Transfer", icon: "⇄", hint: "Move money between accounts" },
];

function generateId() { return Math.random().toString(36).slice(2, 10); }
const emptyLine = (): JournalLineForm => ({ id: generateId(), account_id: "", amount: "", type: "debit", description: "" });

interface Props {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    organizationId: string;
    orgSlug: string;
    accounts: Account[];
}

// ── Account selector used in both modes ──────────────────────────────────────

function AccountSelect({
    id,
    value,
    onChange,
    accounts,
    label,
    placeholder,
    filterType,
    excludeId,
}: {
    id: string;
    value: string;
    onChange: (v: string) => void;
    accounts: Account[];
    label: string;
    placeholder: string;
    filterType?: Account["type"][];
    excludeId?: string;
}) {
    const typeOrder = ["asset", "liability", "equity", "revenue", "expense"] as const;
    const typeLabels: Record<string, string> = {
        asset: "Assets", liability: "Liabilities", equity: "Equity",
        revenue: "Revenue", expense: "Expenses",
    };
    const filtered = accounts.filter(
        (a) => (!filterType || filterType.includes(a.type)) && a.id !== excludeId
    );
    const byType = filtered.reduce<Record<string, Account[]>>((acc, a) => {
        acc[a.type] = [...(acc[a.type] ?? []), a];
        return acc;
    }, {});

    return (
        <div className="space-y-1.5">
            <Label htmlFor={id} className="text-zinc-300 text-xs">{label} <span className="text-red-400">*</span></Label>
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

// ── Main Dialog ───────────────────────────────────────────────────────────────

export function NewTransactionDialog({ open, onOpenChange, organizationId, orgSlug, accounts }: Props) {
    const router = useRouter();

    // Shared state
    const [isSimple, setIsSimple] = useState(true);
    const [description, setDescription] = useState("");
    const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
    const [status, setStatus] = useState<"draft" | "posted">("draft");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Simple mode state
    const [simpleType, setSimpleType] = useState<SimpleMode>("expense");
    const [primaryAccountId, setPrimaryAccountId] = useState("");    // expense/income/source account
    const [offsetAccountId, setOffsetAccountId] = useState("");      // payment/receipt/destination account
    const [simpleAmount, setSimpleAmount] = useState("");

    // Advanced mode state
    const [lines, setLines] = useState<JournalLineForm[]>([emptyLine(), emptyLine()]);

    // ── Balance calculator (advanced mode) ──────────────────────────────────
    const { totalDebits, totalCredits, isBalanced } = (() => {
        const d = lines.filter(l => l.type === "debit").reduce((s, l) => s + (isNaN(parseFloat(l.amount)) ? 0 : Math.round(parseFloat(l.amount) * 10000)), 0);
        const c = lines.filter(l => l.type === "credit").reduce((s, l) => s + (isNaN(parseFloat(l.amount)) ? 0 : Math.round(parseFloat(l.amount) * 10000)), 0);
        return { totalDebits: d / 10000, totalCredits: c / 10000, isBalanced: d > 0 && d === c };
    })();

    const simpleValid = !!primaryAccountId && !!offsetAccountId && !!simpleAmount && parseFloat(simpleAmount) > 0;

    const updateLine = useCallback((id: string, field: keyof JournalLineForm, value: string) => {
        setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
    }, []);

    const reset = () => {
        setDescription(""); setEntryDate(new Date().toISOString().split("T")[0]);
        setStatus("draft"); setError(null);
        setPrimaryAccountId(""); setOffsetAccountId(""); setSimpleAmount("");
        setLines([emptyLine(), emptyLine()]);
    };

    // ── Build journal lines from simple mode ────────────────────────────────
    function buildSimpleLines(): { account_id: string; amount: string; type: JournalEntryType; description?: string }[] {
        const amt = simpleAmount;
        if (simpleType === "expense") {
            // Paying an expense: DEBIT expense account, CREDIT cash/bank
            return [
                { account_id: primaryAccountId, amount: amt, type: "debit" },
                { account_id: offsetAccountId, amount: amt, type: "credit" },
            ];
        } else if (simpleType === "income") {
            // Receiving income: DEBIT cash/bank, CREDIT revenue account
            return [
                { account_id: offsetAccountId, amount: amt, type: "debit" },
                { account_id: primaryAccountId, amount: amt, type: "credit" },
            ];
        } else {
            // Transfer: DEBIT destination, CREDIT source
            return [
                { account_id: offsetAccountId, amount: amt, type: "debit" },
                { account_id: primaryAccountId, amount: amt, type: "credit" },
            ];
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (isSimple && !simpleValid) return;
        if (!isSimple && !isBalanced) return;
        setSubmitting(true); setError(null);

        const linesToSend = isSimple
            ? buildSimpleLines()
            : lines.map(l => ({ account_id: l.account_id, amount: l.amount, type: l.type, description: l.description || undefined }));

        const result = await createTransactionAction({
            organization_id: organizationId,
            description,
            entry_date: entryDate,
            status,
            lines: linesToSend,
        });
        setSubmitting(false);
        if (!result.success) { setError(result.error); return; }
        reset(); onOpenChange(false); router.refresh();
    }

    // ── Account filter hints per simple mode ─────────────────────────────────
    const primaryConfig = {
        expense: { label: "Expense Account", placeholder: "e.g. Salary Expense, Rent", filterType: ["expense"] as Account["type"][] },
        income: { label: "Revenue Account", placeholder: "e.g. Service Revenue", filterType: ["revenue"] as Account["type"][] },
        transfer: { label: "Source Account", placeholder: "e.g. Checking Account", filterType: ["asset"] as Account["type"][] },
    }[simpleType];

    const offsetConfig = {
        expense: { label: "Paid From (Account)", placeholder: "e.g. Cash, Bank Checking", filterType: ["asset", "liability"] as Account["type"][] },
        income: { label: "Received Into (Account)", placeholder: "e.g. Cash, Bank Checking", filterType: ["asset"] as Account["type"][] },
        transfer: { label: "Destination Account", placeholder: "e.g. Savings Account", filterType: ["asset"] as Account["type"][] },
    }[simpleType];

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
            <DialogContent className="border-zinc-800 bg-zinc-900 max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-zinc-100">New Journal Entry</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Record a financial transaction. Simple mode auto-handles the double-entry for you.
                    </DialogDescription>
                </DialogHeader>

                {/* Mode toggle */}
                <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 p-1 w-fit">
                    <button
                        type="button"
                        onClick={() => setIsSimple(true)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${isSimple ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
                    >
                        ✦ Simple
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsSimple(false)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${!isSimple ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
                    >
                        ⊞ Advanced (Dr/Cr)
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Shared header fields */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="sm:col-span-2 space-y-1.5">
                            <Label htmlFor="description" className="text-zinc-300 text-xs">Description <span className="text-red-400">*</span></Label>
                            <Input
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={isSimple && simpleType === "expense" ? "Salary for March 2025" : "Payment of rent for March"}
                                required
                                className="border-zinc-700 bg-zinc-800/50 text-zinc-50 placeholder:text-zinc-500 focus-visible:ring-indigo-500 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="entry-date" className="text-zinc-300 text-xs">Date <span className="text-red-400">*</span></Label>
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

                    {/* ── SIMPLE MODE ─────────────────────────────────────────────────────── */}
                    {isSimple && (
                        <div className="space-y-5">
                            {/* Transaction type pills */}
                            <div className="space-y-2">
                                <Label className="text-zinc-300 text-xs">Transaction Type <span className="text-red-400">*</span></Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {SIMPLE_MODES.map((m) => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => { setSimpleType(m.id); setPrimaryAccountId(""); setOffsetAccountId(""); }}
                                            className={`flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-all ${simpleType === m.id
                                                ? "border-indigo-500 bg-indigo-500/10"
                                                : "border-zinc-800 bg-zinc-800/30 hover:border-zinc-700"
                                                }`}
                                        >
                                            <span className={`text-base leading-none ${simpleType === m.id ? "text-indigo-400" : "text-zinc-500"}`}>{m.icon}</span>
                                            <span className={`text-xs font-semibold ${simpleType === m.id ? "text-zinc-100" : "text-zinc-400"}`}>{m.label}</span>
                                            <span className="text-[10px] text-zinc-600 leading-tight">{m.hint}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Primary account */}
                            <AccountSelect
                                id="primary-account"
                                value={primaryAccountId}
                                onChange={setPrimaryAccountId}
                                accounts={accounts}
                                label={primaryConfig.label}
                                placeholder={primaryConfig.placeholder}
                                filterType={primaryConfig.filterType}
                            />

                            {/* Amount */}
                            <div className="space-y-1.5">
                                <Label htmlFor="simple-amount" className="text-zinc-300 text-xs">Amount <span className="text-red-400">*</span></Label>
                                <Input
                                    id="simple-amount"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={simpleAmount}
                                    onChange={(e) => setSimpleAmount(e.target.value)}
                                    placeholder="0.00"
                                    required
                                    className="border-zinc-700 bg-zinc-800/50 text-zinc-50 placeholder:text-zinc-600 focus-visible:ring-indigo-500 text-sm"
                                />
                            </div>

                            {/* Offset account */}
                            <AccountSelect
                                id="offset-account"
                                value={offsetAccountId}
                                onChange={setOffsetAccountId}
                                accounts={accounts}
                                label={offsetConfig.label}
                                placeholder={offsetConfig.placeholder}
                                filterType={offsetConfig.filterType}
                                excludeId={primaryAccountId}
                            />

                            {/* Auto-entry preview */}
                            {primaryAccountId && offsetAccountId && simpleAmount && parseFloat(simpleAmount) > 0 && (() => {
                                const primary = accounts.find(a => a.id === primaryAccountId);
                                const offset = accounts.find(a => a.id === offsetAccountId);
                                const builtLines = buildSimpleLines();
                                const getLabel = (accountId: string) => {
                                    const a = accounts.find(x => x.id === accountId);
                                    return a ? `${a.code} — ${a.name}` : "—";
                                };
                                return (
                                    <div className="rounded-lg border border-zinc-700/50 bg-zinc-950/50 p-3 space-y-1.5">
                                        <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Journal Entry Preview</p>
                                        {builtLines.map((l, i) => (
                                            <div key={i} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${l.type === "debit" ? "border-blue-500/30 bg-blue-500/10 text-blue-400" : "border-violet-500/30 bg-violet-500/10 text-violet-400"}`}>
                                                        {l.type === "debit" ? "Dr" : "Cr"}
                                                    </Badge>
                                                    <span className="text-zinc-300">{getLabel(l.account_id)}</span>
                                                </div>
                                                <span className="font-mono text-zinc-200">{parseFloat(simpleAmount).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* ── ADVANCED MODE ───────────────────────────────────────────────────── */}
                    {!isSimple && (
                        <div className="space-y-2">
                            <div className="grid grid-cols-12 gap-2 px-1">
                                <span className="col-span-4 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Account</span>
                                <span className="col-span-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Type</span>
                                <span className="col-span-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Amount</span>
                                <span className="col-span-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Memo</span>
                                <span className="col-span-1" />
                            </div>

                            <div className="space-y-1.5">
                                {lines.map((line, idx) => (
                                    <div key={line.id} className="grid grid-cols-12 gap-2 items-center rounded-lg border border-zinc-800/70 bg-zinc-800/20 px-2 py-2">
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
                                                    const typeLabels: Record<string, string> = { asset: "Assets", liability: "Liabilities", equity: "Equity", revenue: "Revenue", expense: "Expenses" };
                                                    const group = accounts.filter(a => a.type === type);
                                                    return group.length ? (
                                                        <optgroup key={type} label={typeLabels[type]}>
                                                            {group.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                                        </optgroup>
                                                    ) : null;
                                                })}
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <div className="flex rounded-md border border-zinc-700 overflow-hidden">
                                                {(["debit", "credit"] as const).map((t) => (
                                                    <button key={t} type="button" onClick={() => updateLine(line.id, "type", t)}
                                                        className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${line.type === t ? t === "debit" ? "bg-blue-600/80 text-white" : "bg-violet-600/80 text-white" : "bg-transparent text-zinc-500 hover:text-zinc-300"}`}>
                                                        {t === "debit" ? "Dr" : "Cr"}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="col-span-3">
                                            <Input type="number" step="0.0001" min="0.0001" value={line.amount}
                                                onChange={(e) => updateLine(line.id, "amount", e.target.value)}
                                                placeholder="0.00" required aria-label={`Amount for line ${idx + 1}`}
                                                className="border-zinc-700 bg-zinc-800/50 text-zinc-50 placeholder:text-zinc-600 focus-visible:ring-indigo-500 text-xs h-8" />
                                        </div>
                                        <div className="col-span-2">
                                            <Input value={line.description} onChange={(e) => updateLine(line.id, "description", e.target.value)}
                                                placeholder="Optional" aria-label={`Memo for line ${idx + 1}`}
                                                className="border-zinc-700 bg-zinc-800/50 text-zinc-500 placeholder:text-zinc-600 focus-visible:ring-indigo-500 text-xs h-8" />
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                            <button type="button" onClick={() => setLines(prev => prev.length > 2 ? prev.filter(l => l.id !== line.id) : prev)}
                                                disabled={lines.length <= 2} aria-label="Remove line"
                                                className="rounded p-1 text-zinc-600 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Button type="button" variant="ghost" size="sm" onClick={() => setLines(prev => [...prev, emptyLine()])}
                                className="text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 text-xs">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 h-3.5 w-3.5" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" /></svg>
                                Add Line
                            </Button>

                            {/* Balance indicator */}
                            <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                                <div className="flex items-center gap-6 text-sm">
                                    <div><span className="text-xs text-zinc-500 mr-1.5">Dr</span><span className="font-mono font-medium text-blue-400">{totalDebits.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></div>
                                    <div><span className="text-xs text-zinc-500 mr-1.5">Cr</span><span className="font-mono font-medium text-violet-400">{totalCredits.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></div>
                                </div>
                                <Badge variant="outline" className={isBalanced ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}>
                                    {isBalanced ? "✓ Balanced" : "Unbalanced"}
                                </Badge>
                            </div>
                        </div>
                    )}

                    {/* Status toggle */}
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-400">Save as:</span>
                        <div className="flex items-center rounded-md border border-zinc-700 overflow-hidden">
                            {(["draft", "posted"] as const).map((s) => (
                                <button key={s} type="button" onClick={() => setStatus(s)}
                                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${status === s ? s === "posted" ? "bg-emerald-600 text-white" : "bg-zinc-700 text-zinc-100" : "bg-transparent text-zinc-400 hover:text-zinc-200"}`}>
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                            ))}
                        </div>
                        {status === "posted" && <span className="text-[11px] text-amber-400">⚠ Posted entries are immutable</span>}
                    </div>

                    {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">{error}</div>}

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => { reset(); onOpenChange(false); }} className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800">Cancel</Button>
                        <Button type="submit" disabled={submitting || (isSimple ? !simpleValid : !isBalanced)}
                            className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700 disabled:opacity-50">
                            {submitting ? "Recording…" : status === "posted" ? "Post Transaction" : "Save Draft"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
