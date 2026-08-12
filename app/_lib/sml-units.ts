import { query } from "@/_lib/db";
import { cached } from "@/_lib/cache";

/**
 * Unit of measure, with SML as the single source of truth.
 *
 * A BOQ line, a request line and the stock balance each carry their own unit
 * string, and they do not always agree (a line typed as ມ້ວນ against stock kept
 * in ຊິ້ນ, for example). Subtracting those numbers from each other produces a
 * shortfall that looks precise and is wrong, so:
 *
 *   1. the item master (ic_inventory) decides what an item's unit IS, and
 *   2. any figure carrying a different unit is FLAGGED, never silently mixed.
 */

const UNIT_TTL = 5 * 60 * 1000;

/** Normalised comparison form — trims, lowercases, ignores spaces and dots. */
export const unitKey = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s.]+/g, "");

/** Two unit strings mean the same thing (or one side is simply unknown). */
export const sameUnit = (a: unknown, b: unknown) => {
  const ka = unitKey(a);
  const kb = unitKey(b);
  return !ka || !kb || ka === kb;
};

/**
 * item_code → the master unit from SML's ic_inventory. Cached for five minutes;
 * an unreadable/absent column yields an empty map, and callers then fall back to
 * whatever unit their own row carries.
 */
export async function getSmlUnits(codes: string[]): Promise<Map<string, string>> {
  const wanted = [...new Set(codes.map((c) => String(c || "").trim()).filter(Boolean))];
  const map = new Map<string, string>();
  if (!wanted.length) return map;

  const all = await cached("ic:units", UNIT_TTL, async () => {
    try {
      const r = await query(
        `SELECT trim(code) AS code,
                NULLIF(trim(COALESCE(unit_standard, '')), '') AS unit
           FROM ic_inventory
          WHERE NULLIF(trim(COALESCE(unit_standard, '')), '') IS NOT NULL`,
      );
      return r.rows as Array<{ code: string; unit: string }>;
    } catch (e) {
      console.error("getSmlUnits:", (e as Error).message);
      return [] as Array<{ code: string; unit: string }>;
    }
  });

  const byCode = new Map(all.map((r) => [String(r.code).trim(), String(r.unit).trim()]));
  for (const code of wanted) {
    const unit = byCode.get(code);
    if (unit) map.set(code, unit);
  }
  return map;
}
