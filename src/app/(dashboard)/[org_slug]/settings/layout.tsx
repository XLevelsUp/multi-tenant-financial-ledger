import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsNav } from "@/components/settings/settings-nav";
import type { MembershipRole } from "@/types/database";

interface SettingsLayoutProps {
    children: React.ReactNode;
    params: Promise<{ org_slug: string }>;
}

export default async function SettingsLayout({ children, params }: SettingsLayoutProps) {
    const { org_slug } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Resolve org
    const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("slug", org_slug)
        .single();

    if (!org) redirect(`/${org_slug}`);

    // RBAC: fetch caller's role
    const { data: membership } = await createAdminClient()
        .from("memberships")
        .select("role")
        .eq("organization_id", org.id)
        .eq("user_id", user.id)
        .single();

    const role = (membership?.role ?? "member") as MembershipRole;

    // Members cannot access Settings
    if (role === "member") {
        redirect(`/${org_slug}/ledger`);
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            {/* Settings Header */}
            <div className="border-b border-zinc-800 pb-5">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Settings</h1>
                <p className="mt-1 text-sm text-zinc-400">
                    Manage <span className="font-medium text-zinc-200">{org.name}</span> — you are an <span className="font-medium text-zinc-200 capitalize">{role}</span>
                </p>
            </div>

            <div className="flex flex-col gap-8 md:flex-row">
                {/* Secondary Nav */}
                <aside className="w-full shrink-0 md:w-48">
                    <SettingsNav orgSlug={org_slug} callerRole={role} />
                </aside>

                {/* Page Content */}
                <main className="min-w-0 flex-1">
                    {children}
                </main>
            </div>
        </div>
    );
}
