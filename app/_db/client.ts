/**
 * Typed Drizzle client for the rebuilt `pm.*` schema.
 *
 * Reuses the existing pg Pool from app/_lib/db.ts so the app keeps ONE
 * connection pool (no double pools). The raw `query()` / `withTransaction()`
 * helpers there remain available for legacy code during the cut-over.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "@/_lib/db";
import * as schema from "./schema";

export const db = drizzle(pool, { schema });

export type DB = typeof db;
export { schema };
