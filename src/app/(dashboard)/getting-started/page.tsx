"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrganization } from "@/actions/organization";

export default function GettingStartedPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const formData = new FormData(e.currentTarget);

        try {
            // createOrganization redirects on success, returns {error} on failure
            const result = await createOrganization(formData);
            if (result?.error) {
                setError(result.error);
            }
            // On success, redirect() inside the action throws NEXT_REDIRECT,
            // which is caught here and re-thrown so Next.js handles the navigation.
        } catch (err: unknown) {
            // NEXT_REDIRECT throws an object with {digest: "NEXT_REDIRECT;..."}
            // We need to let those propagate so Next.js performs the redirect.
            if (
                err &&
                typeof err === "object" &&
                "digest" in err &&
                typeof (err as { digest: string }).digest === "string" &&
                (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
            ) {
                // Re-throw so Next.js handles the redirect
                throw err;
            }
            setError("An unexpected error occurred. Please try again.");
            console.error("createOrganization error:", err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
            {/* Background gradient effects */}
            <div className="fixed inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
                <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
            </div>

            <Card className="w-full max-w-lg border-zinc-800 bg-zinc-900/80 backdrop-blur-xl shadow-2xl">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-7 w-7 text-white"
                            aria-hidden="true"
                        >
                            <path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14" />
                            <path d="M2 20h20" />
                            <path d="M14 12v.01" />
                        </svg>
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-zinc-50">
                        Welcome to FinLedger
                    </CardTitle>
                    <CardDescription className="text-zinc-400">
                        Create your first organization to get started with your financial ledger.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="org-name" className="text-zinc-300">
                                Organization Name
                            </Label>
                            <Input
                                id="org-name"
                                name="name"
                                placeholder="Acme Corporation"
                                required
                                minLength={2}
                                className="border-zinc-700 bg-zinc-800/50 text-zinc-50 placeholder:text-zinc-500 focus-visible:ring-indigo-500"
                            />
                            <p className="text-xs text-zinc-500">
                                This will be your workspace for managing financial records.
                            </p>
                        </div>

                        {error && (
                            <div
                                className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
                                role="alert"
                            >
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-violet-700 transition-all duration-200 disabled:opacity-60"
                        >
                            {loading ? "Creating…" : "Create Organization"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
