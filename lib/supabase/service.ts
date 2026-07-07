import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for use outside request context (background
 * jobs, the instrumentation watchdog). Bypasses RLS entirely — never expose
 * to the browser or use in code reachable from client components.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
