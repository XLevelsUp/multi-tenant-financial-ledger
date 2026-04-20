"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
    {
        label: "Provisioning",
        href: "/system/provisioning",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/>
                <path d="M7 7h.01"/>
            </svg>
        ),
    },
    {
        label: "Global Dashboard",
        href: "/system/dashboard",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <rect width="7" height="9" x="3" y="3" rx="1"/>
                <rect width="7" height="5" x="14" y="3" rx="1"/>
                <rect width="7" height="9" x="14" y="12" rx="1"/>
                <rect width="7" height="5" x="3" y="16" rx="1"/>
            </svg>
        ),
    },
    {
        label: "Global Auditor",
        href: "/system/auditor",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" x2="8" y1="13" y2="13"/>
                <line x1="16" x2="8" y1="17" y2="17"/>
                <line x1="10" x2="8" y1="9" y2="9"/>
            </svg>
        ),
    },
] as const;

export function SystemNav() {
    const pathname = usePathname();

    return (
        <nav aria-label="System admin navigation">
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                System
            </p>
            <ul className="space-y-0.5">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                                    isActive
                                        ? "bg-indigo-500/10 text-indigo-300"
                                        : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                                }`}
                            >
                                <span className={isActive ? "text-indigo-400" : "text-zinc-600"}>
                                    {item.icon}
                                </span>
                                {item.label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
