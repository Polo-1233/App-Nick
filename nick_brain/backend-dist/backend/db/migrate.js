/**
 * Auto-migration runner
 *
 * Reads SQL files from backend/db/migrations/, applies them in order.
 * Uses a schema_migrations table to track which migrations have been applied.
 * Requires SUPABASE_DB_URL env var (direct postgres connection string).
 * Non-blocking: if DB URL is absent, logs and continues.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export async function runMigrations() {
    const dbUrl = process.env["SUPABASE_DB_URL"];
    if (!dbUrl) {
        console.warn("[migrate] SUPABASE_DB_URL not set — skipping auto-migrations");
        return;
    }
    let sql;
    try {
        const postgres = (await import("postgres")).default;
        sql = postgres(dbUrl, { max: 1, idle_timeout: 5 });
    }
    catch (err) {
        console.error("[migrate] Failed to connect to database:", err instanceof Error ? err.message : err);
        return;
    }
    try {
        // Ensure schema_migrations table exists
        await sql `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
        // Read migration files sorted by name
        const migrationsDir = path.join(__dirname, "migrations");
        if (!fs.existsSync(migrationsDir)) {
            console.warn("[migrate] No migrations directory found");
            await sql.end();
            return;
        }
        const files = fs.readdirSync(migrationsDir)
            .filter((f) => f.endsWith(".sql"))
            .sort();
        if (files.length === 0) {
            console.warn("[migrate] No migration files found");
            await sql.end();
            return;
        }
        // Fetch already-applied versions
        const applied = await sql `SELECT version FROM schema_migrations`;
        const appliedSet = new Set(applied.map(r => r.version));
        for (const file of files) {
            const version = file.replace(/\.sql$/, "");
            if (appliedSet.has(version)) {
                console.info(`[migrate] Already applied: ${version}`);
                continue;
            }
            const filePath = path.join(migrationsDir, file);
            const content = fs.readFileSync(filePath, "utf-8");
            try {
                await sql.unsafe(content);
                await sql `INSERT INTO schema_migrations (version) VALUES (${version})`;
                console.info(`[migrate] Applied: ${version}`);
            }
            catch (err) {
                console.error(`[migrate] Failed to apply ${version}:`, err instanceof Error ? err.message : err);
                // Stop on first failure to prevent out-of-order migrations
                break;
            }
        }
    }
    catch (err) {
        console.error("[migrate] Migration runner error:", err instanceof Error ? err.message : err);
    }
    try {
        await sql.end();
    }
    catch {
        // Connection cleanup — non-critical
    }
}
//# sourceMappingURL=migrate.js.map