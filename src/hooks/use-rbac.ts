import { useOrgContext } from "@/providers/org-provider";
import type { MembershipRole } from "@/types/database";

export interface RBACState {
  role: MembershipRole;
  isSystemAdmin: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  canManageSettings: boolean;
}

export function useRBAC(): RBACState {
  const { role, isSystemAdmin } = useOrgContext();
  return {
    role,
    isSystemAdmin,
    isOwner: role === "owner",
    isAdmin: role === "owner" || role === "admin",
    isMember: role === "member",
    canManageSettings: role === "owner" || role === "admin" || isSystemAdmin,
  };
}
