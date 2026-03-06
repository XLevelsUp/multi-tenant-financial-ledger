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
import { createAccountingPeriod } from "@/actions/periods";

interface CreatePeriodDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    organizationId: string;
}

export function CreatePeriodDialog({ open, onOpenChange, organizationId }: CreatePeriodDialogProps) {
    const router = useRouter();
    const now = new Date();
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    const defaultName = now.toLocaleString("en-US", { month: "long", year: "numeric" });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [name, setName] = useState(defaultName);
    const [startDate, setStartDate] = useState(firstOfMonth);
    const [endDate, setEndDate] = useState(lastOfMonth);

    function reset() {
        setName(defaultName); setStartDate(firstOfMonth); setEndDate(lastOfMonth); setError(null);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true); setError(null);
        const result = await createAccountingPeriod({ organization_id: organizationId, name, start_date: startDate, end_date: endDate });
        setLoading(false);
        if (!result.success) { setError(result.error); return; }
        reset(); onOpenChange(false); router.refresh();
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
            <DialogContent className="border-zinc-800 bg-zinc-900 max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-zinc-100">Create Accounting Period</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Define a time-bounded accounting period. Dates cannot overlap with existing periods.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="period-name" className="text-zinc-300 text-xs">Period Name <span className="text-red-400">*</span></Label>
                        <Input
                            id="period-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="March 2025"
                            required
                            className="border-zinc-700 bg-zinc-800/50 text-zinc-50 placeholder:text-zinc-500 text-sm focus-visible:ring-indigo-500"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="period-start" className="text-zinc-300 text-xs">Start Date <span className="text-red-400">*</span></Label>
                            <Input
                                id="period-start"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                required
                                className="border-zinc-700 bg-zinc-800/50 text-zinc-50 text-sm focus-visible:ring-indigo-500"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="period-end" className="text-zinc-300 text-xs">End Date <span className="text-red-400">*</span></Label>
                            <Input
                                id="period-end"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                required
                                className="border-zinc-700 bg-zinc-800/50 text-zinc-50 text-sm focus-visible:ring-indigo-500"
                            />
                        </div>
                    </div>
                    {error && (
                        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">{error}</div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => { reset(); onOpenChange(false); }} className="text-zinc-400 hover:text-zinc-200">Cancel</Button>
                        <Button type="submit" disabled={loading} className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700 disabled:opacity-50">
                            {loading ? "Creating…" : "Create Period"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
