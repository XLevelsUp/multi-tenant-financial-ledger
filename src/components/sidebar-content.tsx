"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { OrgSwitcher } from "@/components/org-switcher";
import type { Organization, Membership } from "@/types/database";

interface OrgWithRole extends Organization {
    role: Membership["role"];
}

interface SidebarContentProps {
    organizations: OrgWithRole[];
    userEmail: string;
    userInitials: string;
}

const navItems = [
    {
        label: "Dashboard",
        segment: "",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" />
                <rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" />
            </svg>
        ),
    },
    {
        label: "Ledger",
        segment: "/ledger",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
            </svg>
        ),
    },
    {
        label: "Accounts",
        segment: "/accounts",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        ),
    },
    {
        label: "Periods",
        segment: "/periods",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
            </svg>
        ),
    },
    {
        label: "Reports",
        segment: "/reports",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m7 11 4-4 4 4 6-6" />
            </svg>
        ),
    },
    {
        label: "Audit",
        segment: "/audit",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
        ),
    },
    {
        label: "Settings",
        segment: "/settings",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
            </svg>
        ),
    },
];

export function SidebarContent({
    organizations,
    userEmail,
    userInitials,
}: SidebarContentProps) {
    const params = useParams();
    const pathname = usePathname();
    const orgSlug = params.org_slug as string | undefined;

    return (
        <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-14 items-center gap-2 px-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-white" aria-hidden="true">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                </div>
                <span className="text-sm font-semibold tracking-tight text-zinc-100">
                    FinLedger
                </span>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Org Switcher */}
            <div className="p-3">
                <OrgSwitcher organizations={organizations} />
            </div>

            <Separator className="bg-zinc-800" />

            {/* Navigation */}
            <nav className="flex-1 space-y-1 p-3" aria-label="Main navigation">
                {navItems.map((item) => {
                    const href = orgSlug ? `/${orgSlug}${item.segment}` : "#";
                    const isActive = orgSlug
                        ? item.segment === ""
                            ? pathname === `/${orgSlug}`
                            : pathname.startsWith(`/${orgSlug}${item.segment}`)
                        : false;

                    return (
                        <Link
                            key={item.label}
                            href={href}
                            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${isActive
                                ? "bg-indigo-500/10 text-indigo-300"
                                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
                                }`}
                            aria-current={isActive ? "page" : undefined}
                        >
                            {item.icon}
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <Separator className="bg-zinc-800" />

            {/* User */}
            <div className="p-3">
                <div className="flex items-center gap-3 rounded-md px-3 py-2">
                    <Avatar className="h-8 w-8 border border-zinc-700">
                        <AvatarFallback className="bg-zinc-800 text-xs text-zinc-300">
                            {userInitials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-medium text-zinc-200">
                            {userEmail}
                        </p>
                    </div>
                </div>
                <form action="/auth/signout" method="post" className="mt-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50"
                        type="submit"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4" aria-hidden="true">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" x2="9" y1="12" y2="12" />
                        </svg>
                        Sign Out
                    </Button>
                </form>
            </div>
        </div>
    );
}
