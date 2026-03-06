import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Supabase Admin Client — Service Role
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses the SERVICE ROLE key which bypasses Row Level Security.
 * ONLY use this in trusted server-side code (Server Actions, Route Handlers).
 * NEVER expose this client or its key to the browser.
 *
 * Security model:
 *   1. Always verify the user's identity first using `createClient()` (user client)
 *   2. Then use this admin client for the actual DB operation
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!serviceRoleKey) {
        throw new Error(
            "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local from Supabase Dashboard → Settings → API."
        );
    }

    return createClient<Database>(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
