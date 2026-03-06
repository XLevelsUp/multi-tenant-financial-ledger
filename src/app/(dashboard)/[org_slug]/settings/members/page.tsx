import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MembersTable } from "@/components/settings/members-table";
import type { Metadata } from "next";
import type { MembershipRole } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ org_slug: string }> }): Promise<Metadata> {
    const { org_slug } = await params;
    return { title: `Members — ${org_slug}` };
}

export interface MemberRow {
    membershipId: string;
    userId: string;
    role: MembershipRole;
    fullName: string | null;
    email: string | null;
    avatarUrl: string | null;
    joinedAt: string;
}

export default async function MembersPage({ params }: { params: Promise<{ org_slug: string }> }) {
    const { org_slug } = await params;
    const supabase = await createClient();

    const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("slug", org_slug)
        .single();

    if (!org) notFound();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const admin = createAdminClient();

    // Fetch all memberships with profiles joined
    const { data: memberships } = await admin
        .from("memberships")
        .select(`
      id,
      user_id,
      role,
      created_at,
      profiles!memberships_user_id_fkey(full_name, email, avatar_url)
    `)
        .eq("organization_id", org.id)
        .order("created_at", { ascending: true });

    const { data: callerMembership } = await admin
        .from("memberships")
        .select("role")
        .eq("organization_id", org.id)
        .eq("user_id", user.id)
        .single();

    const callerRole = (callerMembership?.role ?? "member") as MembershipRole;

    const members: MemberRow[] = (memberships ?? []).map((m) => {
        const profile = m.profiles as unknown as { full_name: string | null; email: string | null; avatar_url: string | null } | null;
        return {
            membershipId: m.id,
            userId: m.user_id,
            role: m.role as MembershipRole,
            fullName: profile?.full_name ?? null,
            email: profile?.email ?? null,
            avatarUrl: profile?.avatar_url ?? null,
            joinedAt: m.created_at,
        };
    });

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-zinc-100">Members</h2>
                <p className="text-sm text-zinc-400 mt-0.5">{members.length} member{members.length !== 1 ? "s" : ""} in this organization.</p>
            </div>
            <MembersTable
                members={members}
                callerUserId={user.id}
                callerRole={callerRole}
                organizationId={org.id}
                orgSlug={org_slug}
            />
        </div>
    );
}
