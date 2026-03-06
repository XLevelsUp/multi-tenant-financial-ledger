"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MembershipRole } from "@/types/database";

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    ownerOnly?: boolean;
}

interface SettingsNavProps {
    orgSlug: string;
    callerRole: MembershipRole;
}

function Icon({ path }: { path: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
            <path d={path} />
        </svg>
    );
}

export function SettingsNav({ orgSlug, callerRole }: SettingsNavProps) {
    const pathname = usePathname();

    const navItems: NavItem[] = [
        {
            label: "General",
            href: `/${orgSlug}/settings`,
            icon: <Icon path="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
        },
        {
            label: "Members",
            href: `/${orgSlug}/settings/members`,
            icon: <Icon path="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
        },
        {
            label: "Periods",
            href: `/${orgSlug}/periods`,
            icon: <Icon path="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z" />,
        },
        {
            label: "Audit Log",
            href: `/${orgSlug}/audit`,
            icon: <Icon path="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
        },
    ];

    return (
        <nav className="flex flex-row gap-1 md:flex-col" aria-label="Settings navigation">
            {navItems.map((item) => {
                // Exact match for General settings, prefix match for others
                const isActive = item.href === `/${orgSlug}/settings`
                    ? pathname === item.href
                    : pathname.startsWith(item.href);

                return (
                    <Link
                        key={item.label}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${isActive
                                ? "bg-zinc-800 text-zinc-100"
                                : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200"
                            }`}
                    >
                        {item.icon}
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
