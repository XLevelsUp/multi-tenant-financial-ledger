import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GeneralSettingsForm } from "@/components/settings/general-settings-form";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ org_slug: string }> }): Promise<Metadata> {
    const { org_slug } = await params;
    return { title: `General Settings — ${org_slug}` };
}

export default async function GeneralSettingsPage({ params }: { params: Promise<{ org_slug: string }> }) {
    const { org_slug } = await params;
    const supabase = await createClient();

    const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug, created_at")
        .eq("slug", org_slug)
        .single();

    if (!org) notFound();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Get caller role for the form (to restrict slug editing to owners only, for example)
    const { data: membership } = await createAdminClient()
        .from("memberships")
        .select("role")
        .eq("organization_id", org.id)
        .eq("user_id", user.id)
        .single();

    const role = membership?.role ?? "member";

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-lg font-semibold text-zinc-100">General</h2>
                <p className="text-sm text-zinc-400 mt-0.5">Update your organization&apos;s name and URL slug.</p>
            </div>

            <GeneralSettingsForm
                organization={{ id: org.id, name: org.name, slug: org.slug, created_at: org.created_at }}
                callerRole={role}
            />
        </div>
    );
}
