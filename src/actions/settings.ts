"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Schema ────────────────────────────────────────────────────────────────────

const UpdateOrgSchema = z.object({
    organization_id: z.string().uuid(),
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    slug: z
        .string()
        .min(2, "Slug must be at least 2 characters")
        .max(48)
        .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
    current_slug: z.string(),
});

export type UpdateOrgResult =
    | { success: true; slugChanged: boolean; newSlug: string }
    | { success: false; error: string };

// ── Actions ───────────────────────────────────────────────────────────────────

export async function updateOrganizationAction(
    input: z.infer<typeof UpdateOrgSchema>
): Promise<UpdateOrgResult> {
    const parsed = UpdateOrgSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }
    const { organization_id, name, slug, current_slug } = parsed.data;

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    // Role check — must be owner or admin
    const { data: membership } = await createAdminClient()
        .from("memberships")
        .select("role")
        .eq("organization_id", organization_id)
        .eq("user_id", user.id)
        .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
        return { success: false, error: "Insufficient permissions. Only owners and admins can edit organization settings." };
    }

    const admin = createAdminClient();

    // Slug uniqueness check (if slug changed)
    if (slug !== current_slug) {
        const { data: existing } = await admin
            .from("organizations")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();
        if (existing) {
            return { success: false, error: `The slug "${slug}" is already taken.` };
        }
    }

    const { error } = await admin
        .from("organizations")
        .update({ name: name.trim(), slug })
        .eq("id", organization_id);

    if (error) {
        if (error.code === "23505") return { success: false, error: "That slug is already taken." };
        console.error("updateOrganizationAction error:", error);
        return { success: false, error: "Failed to update organization." };
    }

    revalidatePath(`/${slug}/settings`);

    // If slug changed, caller should redirect — we return info for client-side redirect
    return { success: true, slugChanged: slug !== current_slug, newSlug: slug };
}
