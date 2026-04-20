"use client";

import { createContext, useContext } from "react";
import type { MembershipRole } from "@/types/database";

interface OrgContextValue {
  role: MembershipRole;
  isSystemAdmin: boolean;
}

const OrgContext = createContext<OrgContextValue>({ role: "member", isSystemAdmin: false });

export function OrgClientProvider({
  children,
  role,
  isSystemAdmin,
}: {
  children: React.ReactNode;
  role: MembershipRole;
  isSystemAdmin: boolean;
}) {
  return (
    <OrgContext.Provider value={{ role, isSystemAdmin }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrgContext() {
  return useContext(OrgContext);
}
