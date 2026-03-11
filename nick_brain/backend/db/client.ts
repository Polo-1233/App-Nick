/**
 * R90 Backend — Supabase Client Factory
 *
 * Use the service role key for all server-side operations.
 * This bypasses RLS — callers are responsible for enforcing user ownership.
 *
 * Environment variables (required):
 *   SUPABASE_URL          — your project URL (https://xxx.supabase.co)
 *   SUPABASE_SERVICE_KEY  — service role key (never expose client-side)
 */

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppClient = SupabaseClient;

/**
 * Create a server-side Supabase client using the service role key.
 * Call once per request; do not share across requests.
 */
export function createServerClient(
  url?: string,
  serviceKey?: string
): AppClient {
  const supabaseUrl = url ?? process.env["SUPABASE_URL"];
  const supabaseKey = serviceKey ?? process.env["SUPABASE_SERVICE_KEY"];

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables"
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Resolve the app-level user.id from a Supabase auth JWT uid.
 * Returns null if the user doesn't exist.
 */
export async function resolveUserId(
  client: AppClient,
  authUid: string
): Promise<string | null> {
  const { data, error } = await client
    .from("users")
    .select("id")
    .eq("auth_user_id", authUid)
    .single();

  if (error || !data) return null;
  return (data as { id: string }).id;
}
