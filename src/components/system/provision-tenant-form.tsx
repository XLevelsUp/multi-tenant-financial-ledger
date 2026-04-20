"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { provisionTenantAction } from "@/actions/provisioning";
import type { ProvisionTenantResult } from "@/actions/provisioning";

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
    orgName: z
        .string()
        .min(2, "Must be at least 2 characters")
        .max(100, "Must be 100 characters or fewer"),
    adminEmail: z.string().email("Enter a valid email address"),
    adminPassword: z
        .string()
        .min(12, "Must be at least 12 characters")
        .max(128, "Must be 128 characters or fewer"),
});

type FormValues = z.infer<typeof schema>;

// ─── Password Generator ───────────────────────────────────────────────────────

function generatePassword(): string {
    const alpha =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => alpha[b % alpha.length]).join("");
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProvisionTenantForm() {
    const [serverError, setServerError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [successData, setSuccessData] = useState<{
        email: string;
        password: string;
        orgName: string;
        orgSlug: string;
    } | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
        setValue,
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { orgName: "", adminEmail: "", adminPassword: "" },
    });

    async function onSubmit(data: FormValues) {
        setServerError(null);
        const result: ProvisionTenantResult = await provisionTenantAction(data);
        if (!result.success) {
            setServerError(result.error);
            return;
        }
        setSuccessData({
            email: result.email,
            password: result.password,
            orgName: result.orgName,
            orgSlug: result.orgSlug,
        });
    }

    function handleProvisionAnother() {
        setSuccessData(null);
        setServerError(null);
        setShowPassword(false);
        reset();
    }

    // ── Success Panel ─────────────────────────────────────────────────────────

    if (successData) {
        return (
            <div className="space-y-4">
                {/* Success banner */}
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4 shrink-0 text-emerald-400"
                            aria-hidden="true"
                        >
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <p className="text-sm font-medium text-emerald-400">
                            Tenant provisioned successfully.
                        </p>
                    </div>
                </div>

                {/* Details card */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-5">
                    {/* Organization details */}
                    <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                            Organization
                        </p>
                        <div className="rounded-lg bg-zinc-800/60 px-4 py-3 space-y-1.5">
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-xs text-zinc-400">Name</span>
                                <span className="font-mono text-sm text-zinc-100">
                                    {successData.orgName}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-xs text-zinc-400">Slug</span>
                                <span className="font-mono text-sm text-zinc-100">
                                    {successData.orgSlug}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Credentials */}
                    <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                            Login Credentials
                        </p>
                        <div className="rounded-lg bg-zinc-800/60 px-4 py-3 space-y-1.5">
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-xs text-zinc-400">Email</span>
                                <span className="font-mono text-sm text-zinc-100 select-all">
                                    {successData.email}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-xs text-zinc-400">Password</span>
                                <span className="font-mono text-sm text-zinc-100 select-all">
                                    {successData.password}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Warning */}
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 flex items-start gap-2">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400"
                            aria-hidden="true"
                        >
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" x2="12" y1="9" y2="13" />
                            <line x1="12" x2="12.01" y1="17" y2="17" />
                        </svg>
                        <p className="text-xs text-red-400 leading-relaxed">
                            This password will not be shown again. Copy and securely deliver it to
                            the tenant before navigating away.
                        </p>
                    </div>
                </div>

                {/* Reset action */}
                <div className="flex justify-end">
                    <Button
                        variant="outline"
                        onClick={handleProvisionAnother}
                        className="border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100 text-sm"
                    >
                        Provision Another Tenant
                    </Button>
                </div>
            </div>
        );
    }

    // ── Form ──────────────────────────────────────────────────────────────────

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-5">

                {/* Organization Name */}
                <div className="space-y-1.5">
                    <Label htmlFor="orgName" className="text-zinc-300 text-sm">
                        Organization Name
                    </Label>
                    <Input
                        id="orgName"
                        {...register("orgName")}
                        placeholder="Acme Financial Partners"
                        className="border-zinc-700 bg-zinc-800/50 text-zinc-50 text-sm focus-visible:ring-indigo-500"
                    />
                    {errors.orgName && (
                        <p className="text-xs text-red-400">{errors.orgName.message}</p>
                    )}
                </div>

                {/* Admin Email */}
                <div className="space-y-1.5">
                    <Label htmlFor="adminEmail" className="text-zinc-300 text-sm">
                        Admin Email
                    </Label>
                    <Input
                        id="adminEmail"
                        type="email"
                        {...register("adminEmail")}
                        placeholder="admin@acme.com"
                        className="border-zinc-700 bg-zinc-800/50 text-zinc-50 text-sm focus-visible:ring-indigo-500"
                    />
                    {errors.adminEmail && (
                        <p className="text-xs text-red-400">{errors.adminEmail.message}</p>
                    )}
                </div>

                {/* Admin Password */}
                <div className="space-y-1.5">
                    <Label htmlFor="adminPassword" className="text-zinc-300 text-sm">
                        Admin Password
                    </Label>
                    <div className="relative">
                        <Input
                            id="adminPassword"
                            type={showPassword ? "text" : "password"}
                            {...register("adminPassword")}
                            placeholder="Min. 12 characters"
                            className="border-zinc-700 bg-zinc-800/50 text-zinc-50 text-sm focus-visible:ring-indigo-500 pr-[4.5rem] font-mono"
                        />
                        {/* Toggle visibility + generate buttons */}
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                            {/* Show / hide */}
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-700/50 hover:text-zinc-300"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? (
                                    // EyeOff
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                        <line x1="1" x2="23" y1="1" y2="23" />
                                    </svg>
                                ) : (
                                    // Eye
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                )}
                            </button>
                            {/* Generate random password */}
                            <button
                                type="button"
                                onClick={() =>
                                    setValue("adminPassword", generatePassword(), {
                                        shouldValidate: true,
                                    })
                                }
                                className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-700/50 hover:text-zinc-300"
                                aria-label="Auto-generate a secure password"
                                title="Auto-generate password"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                                    <polyline points="23 4 23 10 17 10" />
                                    <polyline points="1 20 1 14 7 14" />
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    {errors.adminPassword && (
                        <p className="text-xs text-red-400">{errors.adminPassword.message}</p>
                    )}
                    <p className="text-xs text-zinc-600">
                        Use the generate button to create a strong random password.
                    </p>
                </div>

                {/* Server error */}
                {serverError && (
                    <div
                        className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
                        role="alert"
                    >
                        {serverError}
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                    <p className="text-xs text-zinc-600 leading-relaxed max-w-xs">
                        The new owner can log in immediately. No email confirmation is required.
                    </p>
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700 disabled:opacity-40 text-sm shrink-0"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center gap-2">
                                <svg
                                    className="h-3.5 w-3.5 animate-spin"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                    />
                                </svg>
                                Provisioning…
                            </span>
                        ) : (
                            "Provision Tenant"
                        )}
                    </Button>
                </div>
            </div>
        </form>
    );
}
