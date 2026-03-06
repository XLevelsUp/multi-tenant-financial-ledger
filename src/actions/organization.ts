"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 48);
}

export async function createOrganization(formData: FormData) {
    // Step 1: Verify user identity using the user client (respects RLS/Auth)
    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: "You must be logged in to create an organization." };
    }

    const name = formData.get("name") as string;

    if (!name || name.trim().length < 2) {
        return { error: "Organization name must be at least 2 characters." };
    }

    const slug = slugify(name);

    if (!slug) {
        return { error: "Could not generate a valid slug from the name provided." };
    }

    // Step 2: Use admin client for DB operations (service role bypasses RLS)
    // This is safe because we already confirmed the user's identity above.
    const admin = createAdminClient();

    // Check for slug uniqueness
    const { data: existing } = await admin
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

    if (existing) {
        return {
            error: `An organization with the slug "${slug}" already exists. Please choose a different name.`,
        };
    }

    // Insert organization
    const { data: org, error: orgError } = await admin
        .from("organizations")
        .insert({ name: name.trim(), slug })
        .select()
        .single();

    if (orgError) {
        console.error("Failed to create organization:", orgError);
        return { error: "Failed to create organization. Please try again." };
    }

    // Insert owner membership
    const { error: membershipError } = await admin
        .from("memberships")
        .insert({
            organization_id: org.id,
            user_id: user.id,
            role: "owner",
        });

    if (membershipError) {
        // Rollback: delete the org if membership creation fails
        await admin.from("organizations").delete().eq("id", org.id);
        console.error("Failed to create membership:", membershipError);
        return { error: "Failed to set up organization membership. Please try again." };
    }

    redirect(`/${org.slug}`);
}
