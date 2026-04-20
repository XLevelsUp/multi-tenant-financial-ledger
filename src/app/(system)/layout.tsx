import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SystemNav } from "@/components/system/system-nav";

export default async function SystemLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Guard 1: Must be authenticated
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        redirect("/login");
    }

    // Guard 2: Must be a system admin.
    const admin = createAdminClient();
    const { data: profile } = await admin
        .from("profiles")
        .select("is_system_admin")
        .eq("id", user.id)
        .single();

    if (!profile?.is_system_admin) {
        redirect("/login");
    }

    return (
        <div className="min-h-screen bg-zinc-950">
            {/* System Admin Header */}
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-linear-to-br from-indigo-500 to-violet-600">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4 text-white"
                                aria-hidden="true"
                            >
                                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                            </svg>
                        </div>
                        <span className="text-sm font-semibold text-zinc-100">FinLedger</span>
                        <span className="text-zinc-700 select-none">/</span>
                        <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                            System Admin
                        </span>
                    </div>

                    <form action="/auth/signout" method="post">
                        <button
                            type="submit"
                            className="text-xs text-zinc-500 transition-colors hover:text-zinc-200"
                        >
                            Sign out
                        </button>
                    </form>
                </div>
            </header>

            {/* Two-column layout: sidebar + content */}
            <div className="mx-auto flex max-w-6xl px-6">
                {/* Sidebar */}
                <aside className="sticky top-14 h-[calc(100vh-3.5rem)] w-52 shrink-0 border-r border-zinc-800/60 py-8 pr-6">
                    <SystemNav />
                </aside>

                {/* Page Content */}
                <main className="min-w-0 flex-1 py-8 pl-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
