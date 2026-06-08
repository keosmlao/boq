import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config for the rebuilt schema.
 *
 * SAFETY: `schemaFilter: ["pm"]` scopes every drizzle-kit operation to the new
 * `pm` schema only. It can NEVER generate destructive DDL for the legacy
 * `public.odg_*` tables or the external ERP tables.
 *
 * Phase 0 only runs `drizzle-kit generate` (writes SQL to ./drizzle, no DB
 * connection). Do NOT run `drizzle-kit push` against the live database — apply
 * the generated migration deliberately during the Phase 1 cut-over instead.
 *
 * dbCredentials are read from the same env vars as app/_lib/db.ts (load with
 * `node --env-file=.env` / drizzle-kit picks up process.env).
 */
export default defineConfig({
  schema: "./app/_db/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["pm"],
  dbCredentials: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ?? "postgres",
    ssl: false,
  },
});
