import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarContent } from "@/components/sidebar-content";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { Organization, Membership } from "@/types/database";

interface OrgWithRole extends Organization {
    role: Membership["role"];
}

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch organizations with roles + system admin flag in parallel
    const [{ data: memberships }, { data: profile }] = await Promise.all([
        supabase.from("memberships").select("role, organizations(*)").eq("user_id", user.id),
        supabase.from("profiles").select("is_system_admin").eq("id", user.id).single(),
    ]);

    const isSystemAdmin = profile?.is_system_admin ?? false;

    const organizations: OrgWithRole[] =
        memberships
            ?.filter((m) => m.organizations)
            .map((m) => ({
                ...(m.organizations as unknown as Organization),
                role: m.role,
            })) ?? [];

    const userEmail = user.email ?? "user@example.com";
    const userInitials = userEmail
        .split("@")[0]
        .substring(0, 2)
        .toUpperCase();

    return (
        <div className="flex h-screen bg-zinc-950">
            {/* Desktop Sidebar */}
            <aside className="hidden w-64 shrink-0 border-r border-zinc-800 bg-zinc-950 lg:block">
                <SidebarContent
                    organizations={organizations}
                    userEmail={userEmail}
                    userInitials={userInitials}
                    isSystemAdmin={isSystemAdmin}
                />
            </aside>

            {/* Mobile Sidebar */}
            <Sheet>
                <div className="flex h-14 items-center border-b border-zinc-800 px-4 lg:hidden">
                    <SheetTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-zinc-400 hover:text-zinc-100"
                            aria-label="Open navigation menu"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                                <line x1="4" x2="20" y1="12" y2="12" />
                                <line x1="4" x2="20" y1="6" y2="6" />
                                <line x1="4" x2="20" y1="18" y2="18" />
                            </svg>
                        </Button>
                    </SheetTrigger>
                    <span className="ml-2 text-sm font-semibold text-zinc-100">
                        FinLedger
                    </span>
                </div>
                <SheetContent
                    side="left"
                    className="w-64 border-zinc-800 bg-zinc-950 p-0"
                >
                    <SidebarContent
                        organizations={organizations}
                        userEmail={userEmail}
                        userInitials={userInitials}
                        isSystemAdmin={isSystemAdmin}
                    />
                </SheetContent>
            </Sheet>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-7xl p-6">{children}</div>
            </main>
        </div>
    );
}
