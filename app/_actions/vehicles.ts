"use server";

/**
 * ລົດຊ່າງ — which vehicle each craftsman team drives.
 *
 * The list is read from the DATABASE (`app_car_vehicles`, the company register).
 * The Lao GPS Tracker API is used only where the database has nothing to say:
 * the live column on the list (last report / engine / speed, matched by IMEI)
 * and the per-vehicle route, fuel and driver scores on the detail page.
 *
 * Written by this app, and nothing else:
 *   - odg_tech_vehicle  — which vehicles count as craftsman vehicles
 *   - odg_technicians   — which craftsman holds which vehicle
 *
 * Vehicles are keyed by IMEI wherever it exists: the IMEI belongs to the device
 * and survives re-registration, so a marking made today still points at the same
 * vehicle after either system renumbers anything.
 */

import { query } from "@/_lib/db";
import { requirePermission } from "@/_lib/server-auth";
import { cached, invalidate } from "@/_lib/cache";
import { byText, paginate, type PageQuery, type Paged } from "@/_lib/paging";
import { logActivity } from "./chatter";
import { ensureTechVehicleSchema } from "@/_lib/schemas/tech-vehicle";
import {
  getGpsBehaviour,
  getGpsFuel,
  getGpsHistory,
  gpsConfigured,
  listGpsPositions,
  listGpsVehicles,
  type GpsBehaviour,
  type GpsFuel,
  type GpsHistory,
} from "@/_lib/laogps";

type Fail = { success: false; message: string };
const fail = (message: string): Fail => ({ success: false, message });

/** The GPS platform is polled at most this often; positions move, identity does not. */
const LIST_TTL = 30 * 1000;

export type VehicleRow = {
  /** Stable key: the device IMEI when present, else the platform vehicle id. */
  key: string;
  vehicle_id: string;
  imei: string;
  plate: string;
  name: string;
  car_model: string;
  category: string;
  device_model: string;
  active: boolean;
  /** Live-ish state from the GPS platform. */
  last_seen_at: string | null;
  speed_kmh: number | null;
  engine_on: boolean;
  address: string;
  /** Craftsmen currently holding this vehicle — normally one, occasionally more. */
  drivers: Array<{ roworder: number; code: string; name: string; phone: string | null }>;
  /** Marked as a ລົດຊ່າງ (or implicitly one, because a craftsman drives it). */
  is_tech: boolean;
};

/** Craftsman assignments, keyed the same way as the GPS vehicles. */
async function loadAssignments(): Promise<Map<string, VehicleRow["drivers"]>> {
  const map = new Map<string, VehicleRow["drivers"]>();
  try {
    const r = await query(
      `SELECT roworder, COALESCE(code, '') AS code, COALESCE(name_1, '') AS name, phone,
              NULLIF(trim(COALESCE(vehicle_id, '')), '') AS vehicle_key
         FROM odg_technicians
        WHERE NULLIF(trim(COALESCE(vehicle_id, '')), '') IS NOT NULL`,
    );
    for (const row of r.rows as any[]) {
      const key = String(row.vehicle_key);
      map.set(key, [
        ...(map.get(key) || []),
        { roworder: Number(row.roworder), code: String(row.code || ""), name: String(row.name || ""), phone: row.phone ?? null },
      ]);
    }
  } catch (e) {
    console.error("loadAssignments:", (e as Error).message);
  }
  return map;
}

/** The vehicle keys this office has marked as craftsman vehicles. */
async function loadMarked(): Promise<Set<string>> {
  await ensureTechVehicleSchema();
  const r = await query(`SELECT vehicle_id FROM odg_tech_vehicle`);
  return new Set((r.rows as any[]).map((x) => String(x.vehicle_id)));
}

/**
 * The company car register — the fallback source, used whenever the GPS
 * platform is unreachable or not configured. Its plate column is known to
 * contain tracker ids on some rows, which is exactly why GPS is preferred; the
 * IMEI column is read separately so the two never merge into one field.
 */
async function loadFromCarRegister(): Promise<VehicleRow[]> {
  const [marked, assignments] = await Promise.all([loadMarked(), loadAssignments()]);
  const r = await query(
    `SELECT v.id::text            AS id,
            COALESCE(v.plate_no, '') AS plate_no,
            COALESCE(v.name, '')     AS name,
            COALESCE(v.status, '')   AS status,
            COALESCE(vt.name, '')    AS type_name,
            COALESCE(v.gps_imei, '') AS gps_imei
       FROM app_car_vehicles v
       LEFT JOIN app_car_vehicle_types vt ON vt.id = v.vehicle_type_id
      ORDER BY v.plate_no`,
  );
  return (r.rows as any[]).map((row) => {
    const vehicleId = String(row.id);
    const imei = String(row.gps_imei || "").trim();
    const key = imei || vehicleId;
    const drivers = assignments.get(key) || assignments.get(vehicleId) || [];
    return {
      key,
      vehicle_id: vehicleId,
      imei,
      plate: String(row.plate_no || "").trim(),
      name: String(row.name || "").trim(),
      car_model: String(row.type_name || "").trim(),
      category: "",
      device_model: "",
      // The register's own status stands in for the GPS "active" flag.
      active: String(row.status || "").toLowerCase() !== "inactive",
      last_seen_at: null,
      speed_kmh: null,
      engine_on: false,
      address: "",
      drivers,
      is_tech: marked.has(key) || marked.has(vehicleId) || drivers.length > 0,
    };
  });
}

/**
 * The GPS fleet, joined to this app's markings and assignments. Cached briefly
 * so paging and tab switching do not hit the GPS platform repeatedly.
 */
async function loadFromGps(): Promise<VehicleRow[]> {
  {
    const [vehicles, positions, marked, assignments] = await Promise.all([
      listGpsVehicles({ activeOnly: false }),
      // Positions are a bonus: if that call fails the list must still render.
      listGpsPositions({ activeOnly: false }).catch(() => []),
      loadMarked(),
      loadAssignments(),
    ]);

    const posByVehicle = new Map(positions.map((p) => [String(p.vehicle_id), p] as const));

    return vehicles.map((v) => {
      const vehicleId = String(v.vehicle_id);
      const imei = String(v.imei || "").trim();
      const key = imei || vehicleId;
      const pos = posByVehicle.get(vehicleId);
      // Assignments may reference either key — accept both, so an assignment
      // made before the IMEI was known is not silently lost.
      const drivers = assignments.get(key) || assignments.get(vehicleId) || [];
      return {
        key,
        vehicle_id: vehicleId,
        imei,
        plate: String(v.plate || "").trim(),
        name: String(v.name || "").trim(),
        car_model: String(v.car_model || "").trim(),
        category: String(v.category || "").trim(),
        device_model: String(v.device_model || "").trim(),
        active: !!v.active,
        last_seen_at: pos?.time ?? v.last_seen_at ?? null,
        speed_kmh: pos?.speed_kmh ?? null,
        engine_on: !!pos?.engine_on,
        address: String(pos?.address || ""),
        drivers,
        // A vehicle a craftsman already drives counts as one even if nobody
        // remembered to mark it — the assignment is the stronger signal.
        is_tech: marked.has(key) || marked.has(vehicleId) || drivers.length > 0,
      };
    });
  }
}

/** Which register the rows on screen actually came from. */
export type VehicleSource = "gps" | "car";

/**
 * The fleet, from the DATABASE.
 *
 * `app_car_vehicles` is the register this company maintains and is the source
 * of the list. When the GPS platform is configured its live state (last report,
 * engine, speed) is layered on top by IMEI — an enrichment, never a dependency:
 * if the platform is unreachable the list is exactly as complete as before,
 * only without the live column.
 */
async function loadFleet(): Promise<{ rows: VehicleRow[]; source: VehicleSource; live: boolean; note: string }> {
  return cached("vehicles:list", LIST_TTL, async () => {
    const rows = await loadFromCarRegister();
    if (!gpsConfigured()) return { rows, source: "car" as const, live: false, note: "" };

    try {
      const positions = await listGpsPositions({ activeOnly: false });
      const byImei = new Map(
        positions.filter((p) => p.imei).map((p) => [String(p.imei).trim(), p] as const),
      );
      const enriched = rows.map((v) => {
        const p = v.imei ? byImei.get(v.imei) : undefined;
        if (!p) return v;
        return {
          ...v,
          last_seen_at: p.time ?? v.last_seen_at,
          speed_kmh: p.speed_kmh ?? null,
          engine_on: !!p.engine_on,
          address: String(p.address || ""),
        };
      });
      return { rows: enriched, source: "car" as const, live: true, note: "" };
    } catch (e) {
      // The list is the database's answer either way; GPS only adds the live column.
      console.error("loadFleet: GPS enrichment skipped:", (e as Error).message);
      return { rows, source: "car" as const, live: false, note: "" };
    }
  });
}

/** Kept for the callers that only need the rows. */
async function loadVehicles(): Promise<VehicleRow[]> {
  return (await loadFleet()).rows;
}

/** One page of the vehicle list. */
export async function getVehiclesPage(
  params: PageQuery = {},
): Promise<{ success: true; data: Paged<VehicleRow> & { source: VehicleSource; live: boolean; note: string } } | Fail> {
  try {
    await requirePermission("tech-teams", "view");
    const { rows: all, source, live, note } = await loadFleet();
    // The page is about ລົດຊ່າງ, so the fleet at large is only visible on the
    // "not yet marked" tab — where vehicles get marked in.
    const unmarkedCount = all.filter((v) => !v.is_tech).length;
    const base = params.tab === "unmarked" ? all.filter((v) => !v.is_tech) : all.filter((v) => v.is_tech);
    const page = paginate(base, { ...params, tab: params.tab === "unmarked" ? "all" : params.tab }, {
      search: (v, kw) =>
        `${v.plate} ${v.name} ${v.car_model} ${v.category} ${v.imei} ${v.drivers.map((d) => `${d.name} ${d.code}`).join(" ")}`
          .toLowerCase()
          .includes(kw),
      tabs: {
        assigned: (v) => v.drivers.length > 0,
        free: (v) => v.drivers.length === 0,
        // Deactivated on the platform — worth knowing before dispatching it.
        inactive: (v) => !v.active,
      },
      sorters: {
        plate: byText((v) => v.plate || v.name),
        name: byText((v) => v.name),
        car_model: byText((v) => v.car_model),
        last_seen_at: (a: any, b: any) =>
          new Date(a.last_seen_at || 0).getTime() - new Date(b.last_seen_at || 0).getTime(),
        drivers: (a: any, b: any) => a.drivers.length - b.drivers.length,
      },
      defaultSort: "plate",
      defaultDir: "asc",
    });
    return { success: true, data: { ...page, counts: { ...page.counts, unmarked: unmarkedCount }, source, live, note } };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/**
 * Mark vehicles as ລົດຊ່າງ (or take the mark off). Only this app's own list is
 * touched; the GPS platform is read-only.
 */
export async function setTechVehicles(vehicleKeys: string[], isTech: boolean): Promise<{ success: true } | Fail> {
  try {
    const user = await requirePermission("tech-teams", "edit");
    await ensureTechVehicleSchema();
    const keys = [...new Set((vehicleKeys || []).map((v) => String(v || "").trim()).filter(Boolean))];
    if (!keys.length) return fail("ກະລຸນາເລືອກລົດ");

    if (isTech) {
      await query(
        `INSERT INTO odg_tech_vehicle (vehicle_id, marked_by)
         SELECT unnest($1::text[]), $2
         ON CONFLICT (vehicle_id) DO NOTHING`,
        [keys, (user?.name || user?.username || "") || null],
      );
    } else {
      await query(`DELETE FROM odg_tech_vehicle WHERE vehicle_id = ANY($1::text[])`, [keys]);
    }
    invalidate("vehicles:");
    await logActivity("vehicle", keys.join(", "), isTech ? "ໝາຍເປັນລົດຊ່າງ" : "ເອົາອອກຈາກລົດຊ່າງ", `${keys.length} ຄັນ`);
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/**
 * Live positions of the craftsman vehicles only — for the tracking map, which
 * shows where the teams' vehicles are alongside where the craftsmen are.
 */
export async function getTechVehiclePositions(): Promise<
  { success: true; data: Array<{ key: string; plate: string; name: string; lat: number; lng: number; time: string | null; speed_kmh: number | null; engine_on: boolean; address: string; drivers: string[] }> } | Fail
> {
  try {
    await requirePermission("tech-teams", "view");
    if (!gpsConfigured()) return fail("ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ LAOGPS_USERNAME / LAOGPS_PASSWORD ໃນ .env");
    const [fleet, positions] = await Promise.all([loadVehicles(), listGpsPositions({ activeOnly: true })]);
    const posByVehicle = new Map(positions.map((p) => [String(p.vehicle_id), p] as const));

    const data = fleet
      .filter((v) => v.is_tech)
      .map((v) => {
        const p = posByVehicle.get(v.vehicle_id);
        const lat = Number(p?.latitude);
        const lng = Number(p?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          key: v.key,
          plate: v.plate || v.name,
          name: v.name,
          lat,
          lng,
          time: p?.time ?? null,
          speed_kmh: p?.speed_kmh ?? null,
          engine_on: !!p?.engine_on,
          address: String(p?.address || ""),
          drivers: v.drivers.map((d) => d.name || d.code),
        };
      })
      .filter(Boolean) as any[];
    return { success: true, data };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export type VehicleDetail = {
  vehicle: VehicleRow;
  from: string;
  to: string;
  summary: GpsHistory["summary"] | null;
  fuel: GpsFuel | null;
  behaviour: GpsBehaviour | null;
  /** Down-sampled track for the map — never the full 20k points. */
  track: Array<{ lat: number; lng: number; time: string; speed_kmh: number | null }>;
  /** true when driver behaviour is still being computed (API answered 202). */
  behaviour_pending: boolean;
};

/**
 * Everything the GPS platform knows about one craftsman vehicle for a date
 * range: distance and hours, the authoritative fuel figure, the driver scores,
 * and a track thin enough to draw.
 */
export async function getVehicleDetail(
  vehicleKey: string,
  from: string,
  to: string,
): Promise<{ success: true; data: VehicleDetail } | Fail> {
  try {
    await requirePermission("tech-teams", "view");
    // Track, fuel and driver scores exist only on the GPS platform — the car
    // register cannot answer any of them.
    if (!gpsConfigured()) return fail("ໜ້ານີ້ຕ້ອງຕໍ່ກັບ GPS ກ່ອນ (ຕັ້ງ LAOGPS_USERNAME / LAOGPS_PASSWORD ໃນ .env)");
    const day = /^\d{4}-\d{2}-\d{2}$/;
    if (!day.test(from) || !day.test(to)) return fail("ວັນທີບໍ່ຖືກຕ້ອງ");

    const fleet = await loadVehicles();
    const vehicle = fleet.find((v) => v.key === vehicleKey || v.vehicle_id === vehicleKey);
    if (!vehicle) return fail("ບໍ່ພົບລົດຄັນນີ້ໃນລະບົບ GPS");

    // The platform accepts the vehicle_id or the IMEI; the id is the cheaper key.
    const id = vehicle.vehicle_id;
    const [history, fuel, behaviour] = await Promise.all([
      getGpsHistory(id, from, to, { includePoints: true, limit: 5000 }).catch((e) => {
        console.error("getVehicleDetail history:", (e as Error).message);
        return null;
      }),
      getGpsFuel(id, from, to, true).catch((e) => {
        console.error("getVehicleDetail fuel:", (e as Error).message);
        return null;
      }),
      getGpsBehaviour(id, from, to).catch((e) => {
        console.error("getVehicleDetail behaviour:", (e as Error).message);
        return null;
      }),
    ]);

    // Draw at most ~800 points: a day of tracking is thousands, and the shape of
    // the route survives thinning far better than the browser survives 5,000.
    const points = (history?.points || []).filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)));
    const step = Math.max(1, Math.ceil(points.length / 800));
    const track = points
      .filter((_, i) => i % step === 0)
      .map((p) => ({ lat: Number(p.latitude), lng: Number(p.longitude), time: p.time, speed_kmh: p.speed_kmh }));

    return {
      success: true,
      data: {
        vehicle,
        from,
        to,
        summary: history?.summary ?? null,
        fuel,
        behaviour,
        track,
        behaviour_pending: behaviour === null,
      },
    };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/**
 * Correct a vehicle's name / plate in the register.
 *
 * This writes to `app_car_vehicles`, which the car system owns — deliberately,
 * because the fix belongs at the source: patching a display name only here
 * would leave the car system still showing the wrong one. Only the two fields
 * this office actually corrects are touched; everything else on the row (type,
 * department, mileage, documents) is left to the car system.
 */
export async function updateVehicleInfo(
  vehicleId: string,
  body: { name?: string; plate_no?: string },
): Promise<{ success: true } | Fail> {
  try {
    await requirePermission("tech-teams", "edit");
    const id = String(vehicleId || "").trim();
    if (!id) return fail("ບໍ່ພົບລົດ");

    const name = body.name === undefined ? null : String(body.name).trim();
    const plate = body.plate_no === undefined ? null : String(body.plate_no).trim();
    if (name === null && plate === null) return fail("ບໍ່ມີຫຍັງໃຫ້ແກ້");
    if (plate !== null && !plate) return fail("ທະບຽນຫວ່າງບໍ່ໄດ້");

    const r = await query(
      `UPDATE app_car_vehicles
          SET name     = COALESCE($2, name),
              plate_no = COALESCE($3, plate_no)
        WHERE id::text = $1
        RETURNING plate_no, name`,
      [id, name, plate],
    );
    if (!r.rowCount) return fail("ບໍ່ພົບລົດຄັນນີ້ໃນທະບຽນ");

    invalidate("vehicles:");
    await logActivity("vehicle", id, "ແກ້ໄຂຂໍ້ມູນລົດ", `${r.rows[0]?.plate_no || ""} · ${r.rows[0]?.name || ""}`);
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Technicians, for the assign dialog — with the vehicle each already holds. */
export async function getTechniciansForAssign(): Promise<
  { success: true; data: Array<{ roworder: number; code: string; name: string; vehicle_id: string | null; vehicle_plate: string | null }> } | Fail
> {
  try {
    await requirePermission("tech-teams", "view");
    const r = await query(
      `SELECT roworder, COALESCE(code, '') AS code, COALESCE(name_1, '') AS name,
              NULLIF(trim(COALESCE(vehicle_id, '')), '') AS vehicle_id,
              NULLIF(trim(COALESCE(vehicle_plate, '')), '') AS vehicle_plate
         FROM odg_technicians
        ORDER BY name_1`,
    );
    return { success: true, data: r.rows as any[] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/**
 * Give a vehicle to a craftsman, or take it back (`vehicleKey: null`).
 * The plate and name are copied onto the technician row so dispatch screens can
 * show them without calling the GPS platform.
 */
export async function assignVehicle(
  technicianRoworder: number | string,
  vehicleKey: string | null,
): Promise<{ success: true } | Fail> {
  try {
    await requirePermission("tech-teams", "edit");
    const roworder = Number(technicianRoworder);
    if (!Number.isFinite(roworder)) return fail("ຊ່າງບໍ່ຖືກຕ້ອງ");

    let plate: string | null = null;
    let name: string | null = null;
    if (vehicleKey) {
      const fleet = await loadVehicles();
      const v = fleet.find((x) => x.key === String(vehicleKey) || x.vehicle_id === String(vehicleKey));
      if (!v) return fail("ບໍ່ພົບລົດຄັນນີ້ໃນລະບົບ GPS");
      plate = v.plate || null;
      name = v.name || v.car_model || null;
    }

    const r = await query(
      `UPDATE odg_technicians
          SET vehicle_id = $2, vehicle_plate = $3, vehicle_name = $4
        WHERE roworder = $1
        RETURNING name_1`,
      [roworder, vehicleKey ? String(vehicleKey) : null, plate, name],
    );
    if (!r.rowCount) return fail("ບໍ່ພົບຊ່າງ");

    invalidate("vehicles:");
    await logActivity(
      "vehicle",
      String(vehicleKey || roworder),
      vehicleKey ? "ມອບລົດໃຫ້ຊ່າງ" : "ຖອນລົດຄືນ",
      `${r.rows[0]?.name_1 || roworder}${plate ? ` · ${plate}` : ""}`,
    );
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}
