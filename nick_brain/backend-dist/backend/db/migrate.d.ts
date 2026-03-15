/**
 * Auto-migration runner
 *
 * Reads SQL files from backend/db/migrations/, applies them in order.
 * Uses a schema_migrations table to track which migrations have been applied.
 * Requires SUPABASE_DB_URL env var (direct postgres connection string).
 * Non-blocking: if DB URL is absent, logs and continues.
 */
export declare function runMigrations(): Promise<void>;
