import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

/** Browser Supabase client, or null until keys are set in .env.local. */
export function createClient() {
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
