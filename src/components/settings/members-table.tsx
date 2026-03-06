"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { updateMemberRoleAction, removeMemberAction } from "@/actions/members";
import type { MembershipRole } from "@/types/database";
import type { MemberRow } from "@/app/(dashboard)/[org_slug]/settings/members/page";

const ROLE_STYLES: Record<MembershipRole, string> = {
    owner: "border-violet-500/30 bg-violet-500/10 text-violet-400",
    admin: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    member: "border-zinc-700 bg-zinc-800/30 text-zinc-400",
};

function initials(name: string | null, email: string | null): string {
    if (name) return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
    if (email) return email.slice(0, 2).toUpperCase();
    return "??";
}

interface MembersTableProps {
    members: MemberRow[];
    callerUserId: string;
    callerRole: MembershipRole;
    organizationId: string;
    orgSlug: string;
}

export function MembersTable({ members, callerUserId, callerRole, organizationId, orgSlug }: MembersTableProps) {
    const router = useRouter();
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isOwner = callerRole === "owner";
    const isAdmin = callerRole === "admin";

    // Roles a given caller can assign to a given target
    function availableRoles(targetRole: MembershipRole): MembershipRole[] {
        if (isOwner) return ["owner", "admin", "member"];
        if (isAdmin && targetRole === "member") return ["admin", "member"];
        return [];
    }

    async function handleRoleChange(member: MemberRow, newRole: MembershipRole) {
        setPendingId(member.membershipId); setError(null);
        const result = await updateMemberRoleAction(member.membershipId, organizationId, newRole, orgSlug);
        setPendingId(null);
        if (!result.success) { setError(result.error); return; }
        router.refresh();
    }

    async function handleRemove(member: MemberRow) {
        if (!confirm(`Remove ${member.fullName ?? member.email ?? "this member"} from the organization?`)) return;
        setPendingId(member.membershipId); setError(null);
        const result = await removeMemberAction(member.membershipId, organizationId, orgSlug);
        setPendingId(null);
        if (!result.success) { setError(result.error); return; }
        router.refresh();
    }

    function canActOn(member: MemberRow): boolean {
        if (member.userId === callerUserId) return false; // can't act on self
        if (isOwner) return true; // owner can act on everyone
        if (isAdmin && member.role === "member") return true; // admin can act on members only
        return false;
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
                    {error}
                    <button onClick={() => setError(null)} className="ml-3 text-xs underline opacity-70">dismiss</button>
                </div>
            )}

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                <table className="w-full text-sm" role="table">
                    <thead>
                        <tr className="border-b border-zinc-800/50">
                            <th className="py-3 pl-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Member</th>
                            <th className="py-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 hidden sm:table-cell">Email</th>
                            <th className="py-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 w-32">Role</th>
                            <th className="py-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 hidden md:table-cell w-28">Joined</th>
                            <th className="py-3 pr-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 w-20">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                        {members.map((member) => {
                            const isPending = pendingId === member.membershipId;
                            const isSelf = member.userId === callerUserId;
                            const canAct = canActOn(member);
                            const roleOptions = availableRoles(member.role);

                            return (
                                <tr key={member.membershipId} className={`transition-colors hover:bg-zinc-800/20 ${isPending ? "opacity-50" : ""}`}>
                                    {/* Avatar + Name */}
                                    <td className="py-3 pl-4 pr-4">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8 border border-zinc-700 shrink-0">
                                                <AvatarFallback className="bg-zinc-800 text-xs text-zinc-300">
                                                    {initials(member.fullName, member.email)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-zinc-200 truncate">
                                                    {member.fullName ?? "—"}
                                                    {isSelf && <span className="ml-1.5 text-[10px] text-zinc-500">(you)</span>}
                                                </p>
                                                <p className="text-xs text-zinc-500 sm:hidden truncate">{member.email ?? "—"}</p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Email */}
                                    <td className="py-3 pr-4 text-zinc-400 text-xs hidden sm:table-cell truncate max-w-[180px]">
                                        {member.email ?? "—"}
                                    </td>

                                    {/* Role — dropdown if caller can change it */}
                                    <td className="py-3 pr-4">
                                        {canAct && roleOptions.length > 1 ? (
                                            <select
                                                value={member.role}
                                                onChange={(e) => handleRoleChange(member, e.target.value as MembershipRole)}
                                                disabled={isPending}
                                                aria-label={`Change role for ${member.fullName ?? member.email}`}
                                                className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40"
                                            >
                                                {roleOptions.map((r) => (
                                                    <option key={r} value={r} className="capitalize">{r}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <Badge
                                                variant="outline"
                                                className={`text-[10px] px-1.5 py-0 capitalize ${ROLE_STYLES[member.role]}`}
                                            >
                                                {member.role}
                                            </Badge>
                                        )}
                                    </td>

                                    {/* Joined */}
                                    <td className="py-3 pr-4 text-zinc-500 text-xs hidden md:table-cell">
                                        {new Date(member.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </td>

                                    {/* Remove */}
                                    <td className="py-3 pr-4 text-right">
                                        {canAct ? (
                                            <button
                                                onClick={() => handleRemove(member)}
                                                disabled={isPending}
                                                aria-label={`Remove ${member.fullName ?? member.email}`}
                                                className="rounded px-2 py-1 text-[11px] text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                                            >
                                                {isPending ? "…" : "Remove"}
                                            </button>
                                        ) : (
                                            <span className="text-zinc-700 text-[11px]">—</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
