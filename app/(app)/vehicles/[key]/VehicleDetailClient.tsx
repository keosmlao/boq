"use client";

/**
 * One craftsman vehicle, for a date range: distance and hours, the fuel the GPS
 * platform computed, the driver scores, and the route on a map.
 *
 * The fuel figure shown is `fuel_used_litre` (or the daily sum on multi-day
 * sensor ranges) — the platform's own model. The raw per-point tank readings
 * are deliberately NOT summed here: doing that over-counts by up to ~14x
 * because of refuels and sender noise.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamicImport from "next/dynamic";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  ArrowLeft,
  Car,
  Fuel,
  Gauge,
  Loader2,
  MapPin,
  RefreshCw,
  Route,
  ShieldCheck,
  Timer,
  TriangleAlert,
  User,
} from "lucide-react";
import { getVehicleDetail, type VehicleDetail } from "@/_actions/vehicles";
import { Btn, Card, Page, PageHeader, Pill, SectionHeader, Stat, inputCls, type PillTone } from "../../_components/ui";
import { useT } from "@/_lib/i18n";

const ICON_BASE = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images";
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${ICON_BASE}/marker-icon-2x.png`,
  iconUrl: `${ICON_BASE}/marker-icon.png`,
  shadowUrl: `${ICON_BASE}/marker-shadow.png`,
});

const MapContainer = dynamicImport(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamicImport(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamicImport(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamicImport(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });
const Polyline = dynamicImport(() => import("react-leaflet").then((m) => m.Polyline), { ssr: false });

const LAOS: [number, number] = [17.9757, 102.6331];
const num = (v: unknown, digits = 1) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: digits }) : "—";
};
const today = () => new Date().toISOString().slice(0, 10);

/** Score bands — the API scores 0–100, higher is better. */
const scoreTone = (v: number | null | undefined): PillTone => {
  if (v == null) return "neutral";
  return v >= 90 ? "green" : v >= 70 ? "amber" : "red";
};

/** Why the platform could not measure fuel, in plain Lao. */
const fuelReason = (reason: string | null, t: (k: string, f: string) => string) => {
  switch (reason) {
    case "NO_TANK_SIZE":
      return t("vehicles.fuelNoTank", "ຍັງບໍ່ໄດ້ຕັ້ງຂະໜາດຖັງນ້ຳມັນໃນລະບົບ GPS");
    case "NO_SENSOR_CALIBRATION":
      return t("vehicles.fuelNoCal", "ຍັງບໍ່ໄດ້ປັບທຽບເຊັນເຊີນ້ຳມັນ");
    case "NO_TANK_SIZE_AND_NO_SENSOR_CALIBRATION":
      return t("vehicles.fuelNoBoth", "ຍັງບໍ່ໄດ້ຕັ້ງຖັງ ແລະ ປັບທຽບເຊັນເຊີ");
    case "NOT_ENOUGH_SENSOR_READINGS":
      return t("vehicles.fuelFewReads", "ຄ່າອ່ານຈາກເຊັນເຊີບໍ່ພຽງພໍໃນຊ່ວງນີ້");
    case "SENSOR_READINGS_UNUSABLE":
      return t("vehicles.fuelUnusable", "ຄ່າອ່ານໃຊ້ບໍ່ໄດ້");
    default:
      return reason || "";
  }
};

export default function VehicleDetailClient({ initial }: { initial: VehicleDetail | null }) {
  const t = useT();
  const router = useRouter();
  const [data, setData] = useState<VehicleDetail | null>(initial);
  const [from, setFrom] = useState(initial?.from || today());
  const [to, setTo] = useState(initial?.to || today());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async (nextFrom = from, nextTo = to) => {
    if (!data) return;
    setLoading(true);
    setError("");
    try {
      const res: any = await getVehicleDetail(data.vehicle.key, nextFrom, nextTo);
      if (res?.success) setData(res.data);
      else setError(res?.message || t("vehicles.loadFailed", "ໂຫຼດບໍ່ສຳເລັດ"));
    } finally {
      setLoading(false);
    }
  };

  /** Driver behaviour over a wide range is computed in the background — poll once. */
  useEffect(() => {
    if (!data?.behaviour_pending) return;
    const timer = setTimeout(() => void load(), 6000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.behaviour_pending]);

  // Memoised together: `track` is a fresh array on every render otherwise, which
  // would rebuild the polyline (and re-render the map) on every keystroke.
  const track = useMemo(() => data?.track ?? [], [data]);
  const line = useMemo(() => track.map((p) => [p.lat, p.lng] as [number, number]), [track]);
  const center: [number, number] = line.length ? line[Math.floor(line.length / 2)] : LAOS;
  const multiDay = from !== to;
  // On sensor-model vehicles the per-day sum is the realistic multi-day figure.
  const fuelLitre = multiDay ? data?.fuel?.fuel_used_litre_daily_sum ?? data?.fuel?.fuel_used_litre : data?.fuel?.fuel_used_litre;

  if (!data) {
    return (
      <Page max="max-w-none">
        <Card className="p-10 text-center text-[13px] text-[var(--text-mute)]">
          {t("vehicles.notFoundOne", "ບໍ່ພົບລົດຄັນນີ້ ຫຼື ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ GPS")}
        </Card>
      </Page>
    );
  }

  const v = data.vehicle;

  return (
    <Page max="max-w-none">
      <PageHeader
        title={v.name || v.plate || v.imei}
        subtitle={[v.plate, v.car_model, v.category, v.imei ? `IMEI ${v.imei}` : ""].filter(Boolean).join(" · ")}
        badge={
          v.drivers.length ? (
            <Pill tone="green">
              <User size={11} className="mr-1 inline" />
              {v.drivers.map((d) => d.name || d.code).join(", ")}
            </Pill>
          ) : (
            <Pill tone="neutral">{t("vehicles.noDriver", "ຍັງບໍ່ມອບໝາຍ")}</Pill>
          )
        }
        actions={
          <>
            <Btn variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("common.reload", "ໂຫຼດໃໝ່")}
            </Btn>
            <Btn variant="outline" onClick={() => router.push("/vehicles")}>
              <ArrowLeft size={14} /> {t("vehicles.backToList", "ກັບໄປລາຍການລົດ")}
            </Btn>
          </>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-[12.5px] font-bold text-[var(--danger)]">
          {error}
        </div>
      )}

      {/* Date range */}
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold tracking-wider text-[var(--text-mute)]">{t("common.from", "ຈາກວັນທີ")}</span>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} w-44`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold tracking-wider text-[var(--text-mute)]">{t("common.to", "ຫາວັນທີ")}</span>
          <input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} className={`${inputCls} w-44`} />
        </label>
        <Btn variant="ink" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Route size={14} />} {t("vehicles.show", "ສະແດງ")}
        </Btn>
        <div className="ml-auto flex gap-1.5">
          <Btn
            variant="outline"
            onClick={() => {
              const d = today();
              setFrom(d);
              setTo(d);
              void load(d, d);
            }}
          >
            {t("vehicles.rangeToday", "ມື້ນີ້")}
          </Btn>
          <Btn
            variant="outline"
            onClick={() => {
              const end = today();
              const start = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
              setFrom(start);
              setTo(end);
              void load(start, end);
            }}
          >
            {t("vehicles.range7", "7 ມື້")}
          </Btn>
        </div>
      </Card>

      {/* Headline numbers */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Route size={18} />} label={t("vehicles.distance", "ໄລຍະທາງ")} value={`${num(data.summary?.distance_km)} km`} />
        <Stat icon={<Timer size={18} />} label={t("vehicles.driveHours", "ຊົ່ວໂມງແລ່ນ")} value={`${num(data.summary?.drive_hours)} ຊມ`} />
        <Stat
          icon={<Fuel size={18} />}
          label={t("vehicles.fuelUsed", "ນ້ຳມັນທີ່ໃຊ້")}
          value={fuelLitre != null ? `${num(fuelLitre, 2)} L` : "—"}
        />
        <Stat icon={<Gauge size={18} />} label={t("vehicles.maxSpeed", "ຄວາມໄວສູງສຸດ")} value={`${num(data.summary?.max_speed_kmh, 0)} km/h`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        {/* Route */}
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--border-soft)] px-5 pt-5">
            <SectionHeader icon={<MapPin size={14} />} title={t("vehicles.route", "ເສັ້ນທາງ")} tone="brand" />
          </div>
          {line.length === 0 ? (
            <p className="px-5 py-16 text-center text-[12.5px] text-[var(--text-mute)]">
              {t("vehicles.noTrack", "ບໍ່ມີຂໍ້ມູນເສັ້ນທາງໃນຊ່ວງນີ້")}
            </p>
          ) : (
            <div className="h-[460px] w-full">
              <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Polyline positions={line} pathOptions={{ color: "#2c6fb6", weight: 4, opacity: 0.85 }} />
                <Marker position={line[0]}>
                  <Popup>
                    {t("vehicles.trackStart", "ຈຸດເລີ່ມ")} · {new Date(track[0].time).toLocaleString("en-GB")}
                  </Popup>
                </Marker>
                <Marker position={line[line.length - 1]}>
                  <Popup>
                    {t("vehicles.trackEnd", "ຈຸດສຸດທ້າຍ")} · {new Date(track[track.length - 1].time).toLocaleString("en-GB")}
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          )}
          {track.length > 0 && (
            <p className="border-t border-[var(--border-soft)] px-5 py-2.5 text-[11px] text-[var(--text-mute)]">
              {t("vehicles.trackNote", "ເສັ້ນທາງຫຍໍ້ຈຸດເພື່ອໃຫ້ແຜນທີ່ໄວ")} · {track.length} {t("vehicles.points", "ຈຸດ")}
            </p>
          )}
        </Card>

        <aside className="space-y-4">
          {/* Fuel */}
          <Card className="p-4">
            <SectionHeader icon={<Fuel size={14} />} title={t("vehicles.fuel", "ນ້ຳມັນ")} tone="amber" />
            {fuelLitre == null ? (
              <p className="text-[12px] text-[var(--text-mute)]">
                {fuelReason(data.fuel?.fuel_reason ?? null, t) || t("vehicles.fuelNone", "ວັດແທກນ້ຳມັນບໍ່ໄດ້")}
              </p>
            ) : (
              <div className="space-y-2 text-[12.5px]">
                <Row label={t("vehicles.fuelUsed", "ນ້ຳມັນທີ່ໃຊ້")} value={`${num(fuelLitre, 2)} L`} strong />
                <Row label={t("vehicles.fuelMethod", "ວິທີວັດ")} value={data.fuel?.fuel_method === "sensor" ? t("vehicles.fuelSensor", "ເຊັນເຊີຖັງ") : t("vehicles.fuelRate", "ຄິດຈາກໄລຍະທາງ")} />
                {data.fuel?.tank_litre != null && <Row label={t("vehicles.tank", "ຂະໜາດຖັງ")} value={`${num(data.fuel.tank_litre, 0)} L`} />}
                {data.fuel?.km_per_litre != null && <Row label={t("vehicles.kmPerLitre", "ກມ/ລິດ")} value={num(data.fuel.km_per_litre, 1)} />}
                {multiDay && data.fuel?.fuel_used_litre_daily_sum != null && (
                  <p className="border-t border-[var(--border-soft)] pt-2 text-[10.5px] text-[var(--text-mute)]">
                    {t("vehicles.fuelDailySumNote", "ຊ່ວງຫຼາຍມື້ໃຊ້ຜົນລວມລາຍວັນ (ຈິງກວ່າ)")}
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Driver behaviour */}
          <Card className="p-4">
            <SectionHeader icon={<ShieldCheck size={14} />} title={t("vehicles.behaviour", "ພຶດຕິກຳການຂັບ")} tone="blue" />
            {data.behaviour_pending ? (
              <p className="flex items-center gap-2 text-[12px] text-[var(--text-mute)]">
                <Loader2 size={13} className="animate-spin" /> {t("vehicles.behaviourComputing", "ກຳລັງຄິດໄລ່ຢູ່ ຈະສະແດງໃນອີກບໍ່ດົນ...")}
              </p>
            ) : !data.behaviour ? (
              <p className="text-[12px] text-[var(--text-mute)]">{t("vehicles.behaviourNone", "ບໍ່ມີຂໍ້ມູນໃນຊ່ວງນີ້")}</p>
            ) : (
              <div className="space-y-2.5">
                <div className="flex gap-2">
                  <ScoreBox label={t("vehicles.safety", "ຄວາມປອດໄພ")} value={data.behaviour.safety_score} />
                  <ScoreBox label={t("vehicles.eco", "ປະຢັດນ້ຳມັນ")} value={data.behaviour.eco_score} />
                </div>
                <div className="space-y-2 border-t border-[var(--border-soft)] pt-2.5 text-[12.5px]">
                  <Row
                    label={t("vehicles.overspeed", "ຂັບເກີນຄວາມໄວ")}
                    value={`${num(data.behaviour.overspeed_count, 0)} ${t("vehicles.times", "ຄັ້ງ")}`}
                    warn={(data.behaviour.overspeed_count ?? 0) > 0}
                  />
                  <Row label={t("vehicles.trips", "ຈຳນວນທຽວ")} value={num(data.behaviour.trips, 0)} />
                  <Row label={t("vehicles.longIdle", "ຈອດຕິດເຄື່ອງດົນ")} value={`${num(data.behaviour.long_idle_hours)} ຊມ`} />
                  <Row label={t("vehicles.parked", "ຈອດດັບເຄື່ອງ")} value={`${num(data.behaviour.parked_hours)} ຊມ`} />
                  {!data.behaviour.has_camera && (
                    <p className="pt-1 text-[10.5px] text-[var(--text-mute)]">
                      <TriangleAlert size={11} className="mr-1 inline" />
                      {t("vehicles.noCamera", "ລົດຄັນນີ້ບໍ່ມີກ້ອງ — ຄິດຄະແນນຈາກຄວາມໄວຢ່າງດຽວ")}
                    </p>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Vehicle facts */}
          <Card className="p-4">
            <SectionHeader icon={<Car size={14} />} title={t("vehicles.info", "ຂໍ້ມູນລົດ")} tone="neutral" />
            <div className="space-y-2 text-[12.5px]">
              <Row label={t("vehicles.colName", "ຊື່ລົດ")} value={v.name || "—"} />
              <Row label={t("vehicles.colPlate", "ທະບຽນ")} value={v.plate || "—"} />
              <Row label="IMEI" value={v.imei || "—"} />
              <Row label={t("vehicles.deviceModel", "ອຸປະກອນ")} value={v.device_model || "—"} />
              <Row label={t("vehicles.colModel", "ລຸ້ນ / ປະເພດ")} value={[v.car_model, v.category].filter(Boolean).join(" · ") || "—"} />
              <Row label={t("vehicles.address", "ຕຳແໜ່ງລ່າສຸດ")} value={v.address || "—"} />
            </div>
          </Card>
        </aside>
      </div>
    </Page>
  );
}

function Row({ label, value, strong, warn }: { label: string; value: React.ReactNode; strong?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--text-mute)]">{label}</span>
      <span className={`tabular-nums ${warn ? "font-bold text-[var(--warning)]" : strong ? "font-black text-[var(--text)]" : "font-semibold text-[var(--text-soft)]"}`}>
        {value}
      </span>
    </div>
  );
}

function ScoreBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] p-3 text-center">
      <div className="text-[10px] font-bold tracking-wider text-[var(--text-mute)]">{label}</div>
      <div className="mt-1 flex justify-center">
        <Pill tone={scoreTone(value)}>{value == null ? "—" : Math.round(value)}</Pill>
      </div>
    </div>
  );
}
