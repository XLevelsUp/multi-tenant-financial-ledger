"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateOrganizationAction } from "@/actions/settings";
import type { MembershipRole } from "@/types/database";

const schema = z.object({
    name: z.string().min(2, "Must be at least 2 characters").max(100),
    slug: z
        .string()
        .min(2, "Must be at least 2 characters")
        .max(48)
        .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
});

type FormValues = z.infer<typeof schema>;

interface GeneralSettingsFormProps {
    organization: { id: string; name: string; slug: string; created_at: string };
    callerRole: string;
}

export function GeneralSettingsForm({ organization, callerRole }: GeneralSettingsFormProps) {
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const isOwner = callerRole === "owner";

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting, isDirty },
        watch,
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: organization.name, slug: organization.slug },
    });

    const slugValue = watch("slug");

    async function onSubmit(data: FormValues) {
        setServerError(null);
        setSuccess(false);
        const result = await updateOrganizationAction({
            organization_id: organization.id,
            name: data.name,
            slug: data.slug,
            current_slug: organization.slug,
        });
        if (!result.success) { setServerError(result.error); return; }
        setSuccess(true);
        if (result.slugChanged) {
            router.push(`/${result.newSlug}/settings`);
        } else {
            router.refresh();
        }
    }

    return (
        <div className="space-y-8">
            {/* Main form card */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-5">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    <div className="space-y-1.5">
                        <Label htmlFor="org-name" className="text-zinc-300 text-sm">Organization Name</Label>
                        <Input
                            id="org-name"
                            {...register("name")}
                            className="border-zinc-700 bg-zinc-800/50 text-zinc-50 text-sm focus-visible:ring-indigo-500"
                            placeholder="Acme Corp"
                        />
                        {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="org-slug" className="text-zinc-300 text-sm">
                            URL Slug
                            {!isOwner && <span className="ml-2 text-[10px] text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">Owner only</span>}
                        </Label>
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-500 text-sm select-none">your-domain.com/</span>
                            <Input
                                id="org-slug"
                                {...register("slug")}
                                disabled={!isOwner}
                                className="border-zinc-700 bg-zinc-800/50 text-zinc-50 text-sm focus-visible:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                                placeholder="acme-corp"
                            />
                        </div>
                        {errors.slug && <p className="text-xs text-red-400">{errors.slug.message}</p>}
                        {isOwner && slugValue !== organization.slug && (
                            <p className="text-xs text-amber-400 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" />
                                </svg>
                                Changing the slug will redirect all existing links.
                            </p>
                        )}
                    </div>

                    {serverError && (
                        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
                            {serverError}
                        </div>
                    )}

                    {success && !serverError && (
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                            ✓ Settings saved successfully.
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                        <p className="text-xs text-zinc-600">
                            Created {new Date(organization.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </p>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !isDirty}
                            className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700 disabled:opacity-40 text-sm"
                        >
                            {isSubmitting ? "Saving…" : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </div>

            {/* Danger Zone */}
            {isOwner && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 space-y-3">
                    <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                        Deleting an organization is permanent and cannot be undone. All transactions, journal lines, accounts,
                        and accounting periods will be permanently removed. This action requires owner-level access.
                    </p>
                    <Button
                        variant="outline"
                        disabled
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs opacity-50 cursor-not-allowed"
                    >
                        Delete Organization — Coming Soon
                    </Button>
                </div>
            )}
        </div>
    );
}
