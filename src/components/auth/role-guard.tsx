"use client";

import type { MembershipRole } from "@/types/database";
import { useRBAC } from "@/hooks/use-rbac";

interface RoleGuardProps {
  allowedRoles: MembershipRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children, fallback = null }: RoleGuardProps) {
  const { role, isSystemAdmin } = useRBAC();
  if (isSystemAdmin || allowedRoles.includes(role)) return <>{children}</>;
  return <>{fallback}</>;
}
