import "server-only";

/**
 * Lao GPS Tracker — Open API v1 client (read-only).
 *
 * The GPS platform is the authority on what a vehicle IS: plate, IMEI, model,
 * whether it is active and where it was last seen. The company car register had
 * tracker ids typed into the plate column, so this app reads the vehicles from
 * the source instead of a second-hand copy.
 *
 * Credentials are the same web-portal ones, taken from the environment:
 *
 *     LAOGPS_USERNAME=...
 *     LAOGPS_PASSWORD=...
 *     LAOGPS_BASE_URL=https://gps.laogpstracker.com/api2/public/openapi/v1   (optional)
 *
 * The token is a 12-hour JWT; it is cached in-process and re-fetched shortly
 * before it expires. Every endpoint here is read-only — the API cannot write.
 */

const BASE_URL = process.env.LAOGPS_BASE_URL || "https://gps.laogpstracker.com/api2/public/openapi/v1";

export type GpsVehicle = {
  vehicle_id: number;
  imei: string | null;
  name: string | null;
  plate: string | null;
  province: string | null;
  car_model: string | null;
  category: string | null;
  device_model: string | null;
  active: boolean;
  last_seen_at: string | null;
  last_position: { latitude: number | null; longitude: number | null } | null;
};

export type GpsPosition = {
  vehicle_id: number;
  imei: string | null;
  plate: string | null;
  name: string | null;
  time: string | null;
  latitude: number | null;
  longitude: number | null;
  speed_kmh: number | null;
  engine_on: boolean;
  address: string | null;
  source: string | null;
};

export class GpsNotConfiguredError extends Error {
  constructor() {
    super("LAOGPS_USERNAME / LAOGPS_PASSWORD ບໍ່ໄດ້ຕັ້ງຄ່າໃນ .env");
    this.name = "GpsNotConfiguredError";
  }
}

export function gpsConfigured(): boolean {
  return !!(process.env.LAOGPS_USERNAME && process.env.LAOGPS_PASSWORD);
}

/** Token cache — shared by every request this process serves. */
const globalForGps = globalThis as unknown as { __laogpsToken?: { token: string; expiresAt: number } };

async function getToken(): Promise<string> {
  if (!gpsConfigured()) throw new GpsNotConfiguredError();

  const hit = globalForGps.__laogpsToken;
  // Refresh a minute early so a request never races the expiry.
  if (hit && hit.expiresAt - 60_000 > Date.now()) return hit.token;

  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.LAOGPS_USERNAME,
      password: process.env.LAOGPS_PASSWORD,
    }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success || !body?.data?.token) {
    throw new Error(body?.error?.message || body?.error?.code || `GPS login failed (${res.status})`);
  }
  const token = String(body.data.token);
  const expiresAt = body.data.expires_at ? new Date(body.data.expires_at).getTime() : Date.now() + 11 * 3600_000;
  globalForGps.__laogpsToken = { token, expiresAt };
  return token;
}

async function gpsGet<T>(path: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (res.status === 401) {
    // Token rejected (expired early / secret rotated) — drop it and try once more.
    globalForGps.__laogpsToken = undefined;
    const retryToken = await getToken();
    const retry = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${retryToken}` },
      cache: "no-store",
    });
    const retryBody = await retry.json().catch(() => null);
    if (!retry.ok || !retryBody?.success) {
      throw new Error(retryBody?.error?.message || retryBody?.error?.code || `GPS request failed (${retry.status})`);
    }
    return retryBody.data as T;
  }
  if (!res.ok || !body?.success) {
    throw new Error(body?.error?.message || body?.error?.code || `GPS request failed (${res.status})`);
  }
  return body.data as T;
}

/** Every vehicle on the account (cap 2000 per the API). */
export async function listGpsVehicles(opts: { activeOnly?: boolean } = {}): Promise<GpsVehicle[]> {
  const data = await gpsGet<GpsVehicle[]>(`/vehicles?active_only=${opts.activeOnly ? "true" : "false"}&limit=2000&offset=0`);
  return Array.isArray(data) ? data : [];
}

/** Latest position of every vehicle — one call for the whole account. */
export async function listGpsPositions(opts: { activeOnly?: boolean } = {}): Promise<GpsPosition[]> {
  const data = await gpsGet<GpsPosition[]>(`/positions?active_only=${opts.activeOnly ? "true" : "false"}`);
  return Array.isArray(data) ? data : [];
}

export type GpsTrackPoint = {
  time: string;
  latitude: number | null;
  longitude: number | null;
  speed_kmh: number | null;
  engine_on: boolean;
  mileage_km: number | null;
  address: string | null;
  fuel_percent: number | null;
};

export type GpsHistory = {
  vehicle: GpsVehicle;
  from: string;
  to: string;
  summary: {
    points: number;
    trips: number;
    distance_km: number;
    max_speed_kmh: number;
    drive_hours: number;
    idle_hours: number;
    parked_hours: number;
    overspeed_count: number;
  };
  fuel: {
    used_litre: number | null;
    used_percent: number | null;
    method: string | null;
    reason: string | null;
    tank_litre: number | null;
  };
  points?: GpsTrackPoint[];
};

/**
 * Point-level track for one vehicle. `from`/`to` are plain dates (interpreted in
 * Asia/Vientiane by the platform); the API caps a range at 31 days.
 */
export async function getGpsHistory(
  id: string,
  from: string,
  to: string,
  opts: { includePoints?: boolean; limit?: number } = {},
): Promise<GpsHistory> {
  const include = opts.includePoints === false ? "false" : "true";
  const limit = Math.min(Math.max(Number(opts.limit) || 5000, 100), 20000);
  return gpsGet<GpsHistory>(
    `/vehicles/${encodeURIComponent(id)}/history?from=${from}&to=${to}&include_points=${include}&limit=${limit}`,
  );
}

export type GpsFuel = {
  vehicle_id: number;
  plate: string | null;
  name: string | null;
  distance_km: number | null;
  drive_hours: number | null;
  idle_hours: number | null;
  /** THE authoritative figure — never recompute it from raw samples. */
  fuel_used_litre: number | null;
  fuel_used_percent: number | null;
  /** Sensor-model multi-day ranges only; preferred over the single pass there. */
  fuel_used_litre_daily_sum: number | null;
  fuel_method: string | null;
  fuel_reason: string | null;
  tank_litre: number | null;
  km_per_litre: number | null;
  sample_count: number | null;
  daily?: Array<{ day: string; distance_km: number | null; fuel_used_litre: number | null }>;
};

/** Computed fuel for one vehicle. Max 31 days per the API. */
export async function getGpsFuel(id: string, from: string, to: string, daily = true): Promise<GpsFuel> {
  return gpsGet<GpsFuel>(`/vehicles/${encodeURIComponent(id)}/fuel?from=${from}&to=${to}&daily=${daily ? "true" : "false"}`);
}

export type GpsBehaviour = {
  vehicle_id: number;
  plate: string | null;
  safety_score: number | null;
  eco_score: number | null;
  overspeed_count: number | null;
  dashcam_event_count: number | null;
  long_idle_hours: number | null;
  long_idle_sessions: number | null;
  redlight_hours: number | null;
  trips: number | null;
  distance_km: number | null;
  drive_hours: number | null;
  avg_speed_kmh: number | null;
  max_speed_kmh: number | null;
  parked_hours: number | null;
  has_camera: boolean;
};

/**
 * Driver behaviour for one vehicle. Wide ranges are computed in the background:
 * the API answers 202 with `data: null`, so a null result here means
 * "ask again in a few seconds", not "no data".
 */
export async function getGpsBehaviour(id: string, from: string, to: string): Promise<GpsBehaviour | null> {
  return gpsGet<GpsBehaviour | null>(`/vehicles/${encodeURIComponent(id)}/driver-behaviour?from=${from}&to=${to}`);
}
