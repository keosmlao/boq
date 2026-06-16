/**
 * Push notifications via Firebase Admin (FCM). Gracefully no-ops until a service
 * account is configured, so the app builds/runs without push.
 *
 * Configure ONE of (server env):
 *   FIREBASE_SERVICE_ACCOUNT_JSON = '<the whole service-account JSON>'
 *   FIREBASE_SERVICE_ACCOUNT      = /absolute/path/to/serviceAccount.json
 */
import fs from "fs";
import path from "path";
import { query } from "@/_lib/db";

/**
 * Resolve the Firebase service-account JSON, in priority order:
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON  — the whole JSON in an env var
 *   2. FIREBASE_SERVICE_ACCOUNT       — an absolute path to the JSON file
 *   3. a conventional file dropped in the project (gitignored) — easiest setup:
 *        ./firebase-service-account.json  or  ./secrets/firebase-service-account.json
 * The key is NEVER committed; the file paths below are in .gitignore.
 */
function readServiceAccount(): { raw: string; source: string } | null {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return { raw: process.env.FIREBASE_SERVICE_ACCOUNT_JSON, source: "FIREBASE_SERVICE_ACCOUNT_JSON" };
  const candidates = [
    { path: process.env.FIREBASE_SERVICE_ACCOUNT, source: "FIREBASE_SERVICE_ACCOUNT" },
    { path: path.join(process.cwd(), "firebase-service-account.json"), source: "firebase-service-account.json" },
    { path: path.join(process.cwd(), "secrets", "firebase-service-account.json"), source: "secrets/firebase-service-account.json" },
  ].filter((x) => Boolean(x.path)) as { path: string; source: string }[];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p.path)) return { raw: fs.readFileSync(p.path, "utf8"), source: p.source };
    } catch {
      /* try next */
    }
  }
  return null;
}

function readClientFirebaseProjectId(): string | null {
  const candidates = [
    path.join(process.cwd(), "..", "saang_app", "android", "app", "google-services.json"),
    path.join(process.cwd(), "google-services.json"),
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const json = JSON.parse(fs.readFileSync(p, "utf8"));
      return json?.project_info?.project_id ? String(json.project_info.project_id) : null;
    } catch {
      /* try next */
    }
  }
  return null;
}

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS odg_device_token (
          token         TEXT PRIMARY KEY,
          employee_code TEXT,
          platform      TEXT,
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS odg_device_token_emp_idx ON odg_device_token(employee_code)`);
    })().catch((e) => {
      ensured = null;
      throw e;
    });
  }
  return ensured;
}

export async function registerDeviceToken(employeeCode: string, token: string, platform?: string): Promise<void> {
  await ensureTable();
  if (!token) return;
  await query(
    `INSERT INTO odg_device_token (token, employee_code, platform, updated_at)
     VALUES ($1,$2,$3, now())
     ON CONFLICT (token) DO UPDATE SET employee_code = EXCLUDED.employee_code, platform = EXCLUDED.platform, updated_at = now()`,
    [token, employeeCode || null, platform || null],
  );
}

/* ── Firebase Admin (lazy) ── */
let messaging: any = null;
let initTried = false;
let serviceAccountProjectId: string | null = null;
let serviceAccountSource: string | null = null;

async function getMessaging(): Promise<any> {
  if (messaging) return messaging;
  if (initTried) return null;
  initTried = true;
  try {
    const serviceAccount = readServiceAccount();
    if (!serviceAccount) {
      console.warn("[push] Firebase not configured — set FIREBASE_SERVICE_ACCOUNT / FIREBASE_SERVICE_ACCOUNT_JSON, or drop firebase-service-account.json in the project root. Notifications are skipped.");
      return null; // push not configured yet
    }
    const cred = JSON.parse(serviceAccount.raw);
    serviceAccountProjectId = cred?.project_id ? String(cred.project_id) : null;
    serviceAccountSource = serviceAccount.source;
    // firebase-admin v14 dropped the legacy namespaced default export
    // (admin.apps / admin.credential / admin.messaging). Use the modular API.
    const { initializeApp, getApps, getApp, cert } = await import("firebase-admin/app");
    const { getMessaging } = await import("firebase-admin/messaging");
    const app = getApps().length ? getApp() : initializeApp({ credential: cert(cred) });
    messaging = getMessaging(app);
    return messaging;
  } catch (e) {
    console.error("FCM init failed:", (e as Error).message);
    return null;
  }
}

async function sendToTokens(m: any, tokens: string[], title: string, body: string, data: Record<string, string>): Promise<void> {
  if (!tokens.length) return;
  const res = await m.sendEachForMulticast({ tokens, notification: { title, body }, data });
  const stale: string[] = [];
  res.responses.forEach((resp: any, i: number) => {
    const code = resp.error?.code || "";
    if (!resp.success && (code.includes("registration-token-not-registered") || code.includes("invalid-argument"))) stale.push(tokens[i]);
  });
  if (stale.length) await query(`DELETE FROM odg_device_token WHERE token = ANY($1::text[])`, [stale]);
}

/** Notify all managers/admins (devices registered by manager employees). No-op if unconfigured. */
export async function notifyManagers(title: string, body: string, data: Record<string, string> = {}): Promise<void> {
  try {
    const m = await getMessaging();
    if (!m) return;
    await ensureTable();
    const r = await query(`
      SELECT dt.token FROM odg_device_token dt
       WHERE dt.employee_code IN (
         SELECT employee_code FROM odg_employee WHERE lower(coalesce(app_role, '')) IN ('admin', 'manager')
       )`);
    await sendToTokens(m, (r.rows as any[]).map((x) => x.token).filter(Boolean), title, body, data);
  } catch (e) {
    console.error("notifyManagers failed:", (e as Error).message);
  }
}

/** Send a notification to every device of one craftsman (by employee_code). No-op if unconfigured. */
export async function notifyCraftsman(
  employeeCode: string | null | undefined,
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<void> {
  try {
    if (!employeeCode) {
      console.warn("[push] notifyCraftsman: no employee_code given — skipped.");
      return;
    }
    const m = await getMessaging();
    if (!m) return;
    await ensureTable();
    const r = await query(`SELECT token FROM odg_device_token WHERE employee_code = $1`, [String(employeeCode)]);
    const tokens = (r.rows as any[]).map((x) => x.token).filter(Boolean);
    if (!tokens.length) {
      console.warn(`[push] notifyCraftsman: no device token for employee_code=${employeeCode} (has the craftsman logged into the app?). Skipped.`);
      return;
    }
    const res = await m.sendEachForMulticast({ tokens, notification: { title, body }, data });
    console.log(`[push] notifyCraftsman ${employeeCode}: sent ${res.successCount}/${tokens.length}`);
    // Drop tokens FCM reports as invalid so the table stays clean.
    const stale: string[] = [];
    res.responses.forEach((resp: any, i: number) => {
      const code = resp.error?.code || "";
      if (!resp.success && (code.includes("registration-token-not-registered") || code.includes("invalid-argument"))) stale.push(tokens[i]);
    });
    if (stale.length) await query(`DELETE FROM odg_device_token WHERE token = ANY($1::text[])`, [stale]);
  } catch (e) {
    console.error("notifyCraftsman failed:", (e as Error).message);
  }
}

export type PushDevice = { employee_code: string; name: string; tokens: number; platforms: string };

/** Diagnostics for the push pipeline (admin tooling). */
export async function pushStatus(employeeCode?: string): Promise<{
  configured: boolean;
  totalTokens: number;
  craftsmanTokens?: number;
  projectId?: string | null;
  clientProjectId?: string | null;
  serviceAccountSource?: string | null;
  devices: PushDevice[];
}> {
  const configured = !!(await getMessaging());
  await ensureTable();
  const total = await query(`SELECT COUNT(*)::int AS n FROM odg_device_token`);
  // Registered devices grouped by craftsman, with a resolved display name.
  const list = await query(`
    SELECT dt.employee_code,
           COUNT(*)::int AS tokens,
           STRING_AGG(DISTINCT COALESCE(dt.platform, '?'), ', ') AS platforms,
           COALESCE(t.name_1, e.fullname_lo, dt.employee_code) AS name
      FROM odg_device_token dt
      LEFT JOIN odg_technicians t ON t.code = dt.employee_code
      LEFT JOIN odg_employee e ON e.employee_code = dt.employee_code
     WHERE dt.employee_code IS NOT NULL
     GROUP BY dt.employee_code, t.name_1, e.fullname_lo
     ORDER BY name`);
  const out = {
    configured,
    projectId: serviceAccountProjectId,
    clientProjectId: readClientFirebaseProjectId(),
    serviceAccountSource,
    totalTokens: Number(total.rows[0]?.n ?? 0),
    devices: (list.rows as any[]).map((r) => ({
      employee_code: String(r.employee_code),
      name: String(r.name || r.employee_code),
      tokens: Number(r.tokens ?? 0),
      platforms: String(r.platforms || ""),
    })) as PushDevice[],
  } as {
    configured: boolean;
    totalTokens: number;
    craftsmanTokens?: number;
    projectId?: string | null;
    clientProjectId?: string | null;
    serviceAccountSource?: string | null;
    devices: PushDevice[];
  };
  if (employeeCode) {
    const c = await query(`SELECT COUNT(*)::int AS n FROM odg_device_token WHERE employee_code = $1`, [String(employeeCode)]);
    out.craftsmanTokens = Number(c.rows[0]?.n ?? 0);
  }
  return out;
}

/** Send a test push to one craftsman; returns a human-readable result. */
export async function sendTestToCraftsman(employeeCode: string): Promise<{ ok: boolean; message: string }> {
  if (!employeeCode) return { ok: false, message: "ກະລຸນາລະບຸ employee_code" };
  const m = await getMessaging();
  if (!m) return { ok: false, message: "Firebase ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ (FIREBASE_SERVICE_ACCOUNT)" };
  await ensureTable();
  const r = await query(`SELECT token FROM odg_device_token WHERE employee_code = $1`, [String(employeeCode)]);
  const tokens = (r.rows as any[]).map((x) => x.token).filter(Boolean);
  if (!tokens.length) return { ok: false, message: `ບໍ່ມີ device token ສຳລັບ ${employeeCode} (ຊ່າງຕ້ອງ login ໃນແອັບກ່ອນ)` };
  const res = await m.sendEachForMulticast({
    tokens,
    notification: { title: "ທົດສອບການແຈ້ງເຕືອນ", body: "ນີ້ແມ່ນຂໍ້ຄວາມທົດສອບ push ຈາກລະບົບ" },
    data: { type: "test" },
  });
  return { ok: res.successCount > 0, message: `ສົ່ງ ${res.successCount}/${tokens.length} device ສຳເລັດ` };
}
