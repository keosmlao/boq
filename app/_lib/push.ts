/**
 * Push notifications via Firebase Admin (FCM). Gracefully no-ops until a service
 * account is configured, so the app builds/runs without push.
 *
 * Configure ONE of (server env):
 *   FIREBASE_SERVICE_ACCOUNT_JSON = '<the whole service-account JSON>'
 *   FIREBASE_SERVICE_ACCOUNT      = /absolute/path/to/serviceAccount.json
 */
import fs from "fs";
import { query } from "@/_lib/db";

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let messaging: any = null;
let initTried = false;

async function getMessaging(): Promise<any> {
  if (messaging) return messaging;
  if (initTried) return null;
  initTried = true;
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ? process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      : process.env.FIREBASE_SERVICE_ACCOUNT
        ? fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT, "utf8")
        : null;
    if (!raw) return null; // push not configured yet
    const cred = JSON.parse(raw);
    const admin = (await import("firebase-admin")).default;
    const app = admin.apps.length ? admin.app() : admin.initializeApp({ credential: admin.credential.cert(cred) });
    messaging = admin.messaging(app);
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
    if (!employeeCode) return;
    const m = await getMessaging();
    if (!m) return;
    await ensureTable();
    const r = await query(`SELECT token FROM odg_device_token WHERE employee_code = $1`, [String(employeeCode)]);
    const tokens = (r.rows as any[]).map((x) => x.token).filter(Boolean);
    if (!tokens.length) return;
    const res = await m.sendEachForMulticast({ tokens, notification: { title, body }, data });
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
