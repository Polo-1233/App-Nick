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
import type { SupabaseClient } from "@supabase/supabase-js";
export type AppClient = SupabaseClient;
/**
 * Create a server-side Supabase client using the service role key.
 * Call once per request; do not share across requests.
 */
export declare function createServerClient(url?: string, serviceKey?: string): AppClient;
/**
 * Resolve the app-level user.id from a Supabase auth JWT uid.
 * Returns null if the user doesn't exist.
 */
export declare function resolveUserId(client: AppClient, authUid: string): Promise<string | null>;
