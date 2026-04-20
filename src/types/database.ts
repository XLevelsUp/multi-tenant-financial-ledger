// ============================================================================
// DATABASE TYPES - Multi-Tenant Financial Ledger
// ============================================================================
// Follows Supabase CLI type generation patterns.
// These types mirror the PostgreSQL schema exactly.
// ============================================================================

// Phase 1 enums
export type MembershipRole = "owner" | "admin" | "member";

// Phase 2 enums
export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type JournalEntryType = "debit" | "credit";
export type TransactionStatus = "draft" | "posted";

// Phase 4 enums
export type PeriodStatus = "open" | "closed";

export interface Database {
  public: {
    Tables: {
      // ── Phase 5 Tables ────────────────────────────────────────────────────
      audit_log: {
        Row: {
          id: string;
          organization_id: string | null;
          table_name: string;
          operation: "INSERT" | "UPDATE" | "DELETE";
          row_id: string | null;
          old_data: Record<string, unknown> | null;
          new_data: Record<string, unknown> | null;
          changed_by: string | null;
          changed_at: string;
        };
        Insert: never; // Written only by SECURITY DEFINER trigger
        Update: never;
        Relationships: [];
      };
      // ── Phase 4 Tables ────────────────────────────────────────────────────
      accounting_periods: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          start_date: string;
          end_date: string;
          status: PeriodStatus;
          closed_at: string | null;
          closed_by: string | null;
          closing_transaction_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          start_date: string;
          end_date: string;
          status?: PeriodStatus;
          closed_at?: string | null;
          closed_by?: string | null;
          closing_transaction_id?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          start_date?: string;
          end_date?: string;
          status?: PeriodStatus;
          closed_at?: string | null;
          closed_by?: string | null;
          closing_transaction_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "accounting_periods_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      // ── Phase 1 Tables ────────────────────────────────────────────────────
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
          is_system_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          is_system_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          is_system_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: MembershipRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: MembershipRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: MembershipRole;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      ledger_entries: {
        Row: {
          id: string;
          organization_id: string;
          amount: number;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          amount: number;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          amount?: number;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_entries_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      // ── Phase 2 Tables ────────────────────────────────────────────────────
      accounts: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          code: string;
          type: AccountType;
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          code: string;
          type: AccountType;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          code?: string;
          type?: AccountType;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accounts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      transactions: {
        Row: {
          id: string;
          organization_id: string;
          description: string;
          entry_date: string; // ISO date string
          status: TransactionStatus;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          description: string;
          entry_date: string;
          status?: TransactionStatus;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          description?: string;
          entry_date?: string;
          status?: TransactionStatus;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      journal_lines: {
        Row: {
          id: string;
          organization_id: string;
          transaction_id: string;
          account_id: string;
          amount: number; // Always positive; direction from `type`
          type: JournalEntryType;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          transaction_id: string;
          account_id: string;
          amount: number;
          type: JournalEntryType;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          transaction_id?: string;
          account_id?: string;
          amount?: number;
          type?: JournalEntryType;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journal_lines_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journal_lines_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journal_lines_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      global_org_financials: {
        Row: {
          org_id: string;
          org_name: string;
          org_slug: string;
          total_income: number;
          total_expense: number;
          net_profit: number;
          transaction_count: number;
          member_count: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_active_organizations: {
        Args: Record<string, never>;
        Returns: string[];
      };
      is_current_user_system_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      record_transaction: {
        Args: {
          p_organization_id: string;
          p_description: string;
          p_entry_date: string;
          p_status: string;
          p_lines: RecordTransactionLineInput[];
        };
        Returns: string; // transaction UUID
      };
      seed_default_chart_of_accounts: {
        Args: {
          p_organization_id: string;
        };
        Returns: void;
      };
      get_account_balances: {
        Args: {
          p_org_id: string;
          p_start_date?: string | null;
          p_end_date?: string | null;
        };
        Returns: AccountBalanceRow[];
      };
      close_accounting_period: {
        Args: {
          p_period_id: string;
          p_retained_earnings_account_id: string;
        };
        Returns: string | null; // closing transaction UUID or null if no I/S activity
      };
      update_draft_transaction: {
        Args: {
          p_tx_id: string;
          p_org_id: string;
          p_description: string;
          p_entry_date: string;
          p_status: string;
          p_lines: RecordTransactionLineInput[];
        };
        Returns: string; // updated transaction UUID
      };
    };
    Enums: {
      membership_role: MembershipRole;
      account_type: AccountType;
      journal_entry_type: JournalEntryType;
      transaction_status: TransactionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

// ============================================================================
// TYPE HELPERS
// ============================================================================

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

// ============================================================================
// CONVENIENCE ALIASES — Phase 1
// ============================================================================

export type Organization = Tables<"organizations">;
export type Profile = Tables<"profiles">;
export type Membership = Tables<"memberships">;
export type LedgerEntry = Tables<"ledger_entries">;

export type OrganizationInsert = TablesInsert<"organizations">;
export type MembershipInsert = TablesInsert<"memberships">;
export type LedgerEntryInsert = TablesInsert<"ledger_entries">;

// ============================================================================
// CONVENIENCE ALIASES — Phase 2
// ============================================================================

export type Account = Tables<"accounts">;
export type Transaction = Tables<"transactions">;
export type JournalLine = Tables<"journal_lines">;

export type AccountInsert = TablesInsert<"accounts">;
export type TransactionInsert = TablesInsert<"transactions">;
export type JournalLineInsert = TablesInsert<"journal_lines">;

// RPC payload shape for record_transaction p_lines JSONB
export interface RecordTransactionLineInput {
  account_id: string;
  amount: string; // String decimal to avoid float drift, coerced in DB
  type: JournalEntryType;
  description?: string;
}

// Rich transaction row joined with journal lines and creator profile
export interface TransactionWithLines extends Transaction {
  journal_lines: (JournalLine & { account: Pick<Account, "id" | "name" | "code" | "type"> })[];
  creator: Pick<Profile, "id" | "full_name" | "email"> | null;
  total_debits: number;
  total_credits: number;
}

// ============================================================================
// CONVENIENCE ALIASES — Phase 3
// ============================================================================

// Return row type of the get_account_balances RPC
export interface AccountBalanceRow {
  account_id: string;
  account_name: string;
  account_code: string;
  account_type: AccountType;
  total_debits: number;
  total_credits: number;
  net_balance: number;
}

// ============================================================================
// CONVENIENCE ALIASES — Phase 4
// ============================================================================

export type AccountingPeriod = Tables<"accounting_periods">;
export type AccountingPeriodInsert = TablesInsert<"accounting_periods">;

// ============================================================================
// CONVENIENCE ALIASES — Phase 5
// ============================================================================

export type AuditLog = Tables<"audit_log">;

// ============================================================================
// CONVENIENCE ALIASES — Phase 6 (Super Admin)
// ============================================================================

export type GlobalOrgFinancials =
  Database["public"]["Views"]["global_org_financials"]["Row"];

export interface GlobalTransaction {
  id: string;
  organization_id: string;
  description: string;
  entry_date: string;
  status: TransactionStatus;
  created_at: string;
  organization: { id: string; name: string; slug: string } | null;
  total_debits: number;
  total_credits: number;
}
