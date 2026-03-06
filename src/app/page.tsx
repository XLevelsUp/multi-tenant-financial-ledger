import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Find the user's first organization to redirect to
  const { data: memberships } = await supabase
    .from("memberships")
    .select("organizations(slug)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (memberships?.organizations) {
    const org = memberships.organizations as unknown as { slug: string };
    redirect(`/${org.slug}`);
  }

  // If user has no organizations, redirect to a page where they can create one
  redirect("/getting-started");
}
