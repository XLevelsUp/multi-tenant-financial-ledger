import type { Metadata } from "next";
import { ProvisionTenantForm } from "@/components/system/provision-tenant-form";

export const metadata: Metadata = {
    title: "Provision Tenant — System Admin | FinLedger",
};

export default function ProvisioningPage() {
    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
                    Provision New Tenant
                </h1>
                <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
                    Create a new organization and its initial owner account in a single atomic
                    operation. The owner can log in immediately with the generated credentials.
                    Store the password securely before closing this page — it will not be shown again.
                </p>
            </div>

            {/* Divider */}
            <div className="border-t border-zinc-800" />

            {/* Provisioning Form */}
            <div className="max-w-xl">
                <ProvisionTenantForm />
            </div>
        </div>
    );
}
