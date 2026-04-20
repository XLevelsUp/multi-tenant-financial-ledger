import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OrgClientProvider } from "@/providers/org-provider";
import type { MembershipRole } from "@/types/database";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org_slug: string }>;
}) {
  const { org_slug } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const [{ data: org }, { data: profile }] = await Promise.all([
    supabase.from("organizations").select("id").eq("slug", org_slug).single(),
    admin.from("profiles").select("is_system_admin").eq("id", user.id).single(),
  ]);

  if (!org) redirect("/");

  const isSystemAdmin = profile?.is_system_admin ?? false;
  let role: MembershipRole = "member";

  if (!isSystemAdmin) {
    const { data: membership } = await admin
      .from("memberships")
      .select("role")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .single();
    role = (membership?.role ?? "member") as MembershipRole;
  }

  return (
    <OrgClientProvider role={role} isSystemAdmin={isSystemAdmin}>
      {children}
    </OrgClientProvider>
  );
}
