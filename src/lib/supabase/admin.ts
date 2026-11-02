import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase with the secret (service role) key, for creating accounts that need no email
 * confirmation. Null when the key is not set — then sign-up falls back to the normal flow.
 */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
