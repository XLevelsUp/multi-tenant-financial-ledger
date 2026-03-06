"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createOrganization } from "@/actions/organization";
import type { Organization, Membership } from "@/types/database";

interface OrgWithRole extends Organization {
    role: Membership["role"];
}

interface OrgSwitcherProps {
    organizations: OrgWithRole[];
    collapsed?: boolean;
}

export function OrgSwitcher({ organizations, collapsed }: OrgSwitcherProps) {
    const router = useRouter();
    const params = useParams();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentSlug = params.org_slug as string | undefined;
    const currentOrg = organizations.find((o) => o.slug === currentSlug);

    async function handleCreate(formData: FormData) {
        setCreating(true);
        setError(null);
        const result = await createOrganization(formData);
        if (result?.error) {
            setError(result.error);
            setCreating(false);
        }
        // On success, the server action redirects automatically
    }

    const roleColors: Record<string, string> = {
        owner: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        admin: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
        member: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        className={`flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-left transition-colors hover:bg-zinc-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${collapsed ? "w-10 justify-center" : "w-full"
                            }`}
                        aria-label="Switch organization"
                    >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                            {currentOrg ? currentOrg.name.charAt(0).toUpperCase() : "?"}
                        </div>
                        {!collapsed && (
                            <div className="flex-1 overflow-hidden">
                                <p className="truncate text-sm font-medium text-zinc-200">
                                    {currentOrg?.name ?? "Select Organization"}
                                </p>
                            </div>
                        )}
                        {!collapsed && (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4 shrink-0 text-zinc-500"
                                aria-hidden="true"
                            >
                                <path d="m7 15 5 5 5-5" />
                                <path d="m7 9 5-5 5 5" />
                            </svg>
                        )}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className="w-64 border-zinc-800 bg-zinc-900"
                >
                    <DropdownMenuLabel className="text-xs text-zinc-500">
                        Organizations
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-zinc-800" />
                    {organizations.length === 0 ? (
                        <div className="px-2 py-3 text-center text-sm text-zinc-500">
                            No organizations yet
                        </div>
                    ) : (
                        organizations.map((org) => (
                            <DropdownMenuItem
                                key={org.id}
                                onClick={() => router.push(`/${org.slug}`)}
                                className={`flex items-center gap-2 cursor-pointer text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 ${org.slug === currentSlug ? "bg-zinc-800/60" : ""
                                    }`}
                            >
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gradient-to-br from-indigo-500/80 to-violet-600/80 text-[10px] font-bold text-white">
                                    {org.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="flex-1 truncate text-sm">{org.name}</span>
                                <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 ${roleColors[org.role] ?? roleColors.member}`}
                                >
                                    {org.role}
                                </Badge>
                            </DropdownMenuItem>
                        ))
                    )}
                    <DropdownMenuSeparator className="bg-zinc-800" />
                    <DropdownMenuItem
                        onClick={() => setDialogOpen(true)}
                        className="cursor-pointer text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mr-2 h-4 w-4"
                            aria-hidden="true"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M8 12h8" />
                            <path d="M12 8v8" />
                        </svg>
                        Create Organization
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Create Organization Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="border-zinc-800 bg-zinc-900 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-zinc-100">
                            Create Organization
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Create a new organization to manage your financial ledger.
                        </DialogDescription>
                    </DialogHeader>
                    <form action={handleCreate}>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="org-name" className="text-zinc-300">
                                    Organization Name
                                </Label>
                                <Input
                                    id="org-name"
                                    name="name"
                                    placeholder="Acme Corporation"
                                    required
                                    minLength={2}
                                    className="border-zinc-700 bg-zinc-800/50 text-zinc-50 placeholder:text-zinc-500 focus-visible:ring-indigo-500"
                                />
                            </div>
                            {error && (
                                <div
                                    className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
                                    role="alert"
                                >
                                    {error}
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setDialogOpen(false)}
                                className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={creating}
                                className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700"
                            >
                                {creating ? "Creating..." : "Create"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
