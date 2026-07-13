"use client";

/** Live craftsman tracking map — latest position per craftsman (managers only). */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Page, PageHeader, Card, Btn, SectionHeader } from "../_components/ui";
import { MapPin, Radio, RefreshCw } from "lucide-react";
import { useT } from "@/_lib/i18n";

const ICON_BASE = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${ICON_BASE}/marker-icon-2x.png`,
  iconUrl: `${ICON_BASE}/marker-icon.png`,
  shadowUrl: `${ICON_BASE}/marker-shadow.png`,
});

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

const LAOS: [number, number] = [17.9757, 102.6331];
const fmt = (v: unknown) => (v ? new Date(String(v)).toLocaleString("en-GB") : "-");
const ago = (v: unknown, t: (k: string, f: string) => string) => {
  if (!v) return "";
  const mins = Math.floor((Date.now() - new Date(String(v)).getTime()) / 60000);
  if (mins < 1) return t("tracking.justNow", "ຫາກໍ່");
  if (mins < 60) return `${mins} ${t("tracking.minutesAgo", "ນາທີກ່ອນ")}`;
  return `${Math.floor(mins / 60)} ${t("tracking.hoursAgo", "ຊມ ກ່ອນ")}`;
};

export default function TrackingPage() {
  const t = useT();
  const [pts, setPts] = useState<any[]>([]);
  const [presence, setPresence] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [tr, pr] = await Promise.all([
        fetch("/api/tracking", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/presence", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      setPts(Array.isArray(tr?.data) ? tr.data.filter((p: any) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))) : []);
      setPresence(Array.isArray(pr?.data) ? pr.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 20000); // refresh every 20s
    return () => clearInterval(t);
  }, []);

  const center: [number, number] = pts.length ? [Number(pts[0].lat), Number(pts[0].lng)] : LAOS;
  const onlineCount = presence.filter((p) => p.online).length;

  return (
    <Page max="max-w-none">
      <PageHeader
        title={t("tracking.title", "ຕິດຕາມຊ່າງ")}
        subtitle={`${t("tracking.online", "ຊ່າງອອນລາຍ")} ${onlineCount}/${presence.length}`}
        actions={
          <Btn variant="outline" onClick={load}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {t("tracking.refresh", "ໂຫຼດໃໝ່")}
          </Btn>
        }
      />

      {/* Online craftsmen */}
      <Card className="mb-4 p-4">
        <SectionHeader
          icon={<Radio size={15} />}
          tone="emerald"
          title={`${t("tracking.online", "ຊ່າງອອນລາຍ")} ${onlineCount}/${presence.length}`}
        />
        {presence.length === 0 ? (
          <p className="py-3 text-center text-xs text-[var(--text-mute)]">{t("tracking.noPresence", "ຍັງບໍ່ມີຂໍ້ມູນ (ຊ່າງຕ້ອງເປີດແອັບ)")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {presence.map((p, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${
                  p.online
                    ? "border-[var(--success-soft)] bg-[var(--success-soft)] text-[var(--success)]"
                    : "border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text-mute)]"
                }`}
                title={`${t("tracking.lastSeen", "ເຫັນລ່າສຸດ")}: ${fmt(p.last_seen)}`}
              >
                <span className={`h-2 w-2 rounded-full ${p.online ? "bg-[var(--success)]" : "bg-[var(--border-strong)]"}`} />
                {p.name}{!p.online ? ` · ${ago(p.last_seen, t)}` : ""}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <div style={{ height: "62vh", width: "100%" }}>
          <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {pts.map((p, i) => (
              <Marker key={i} position={[Number(p.lat), Number(p.lng)]}>
                <Popup>
                  <b>{p.name}</b>
                  <br />
                  {p.work_no ? `${t("tracking.workNo", "ໃບງານ")}: ${p.work_no}` : "—"}
                  <br />
                  {t("tracking.updated", "ອັບເດດ")}: {fmt(p.updated_at)}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </Card>

      <div className="mt-4 space-y-2">
        {pts.length === 0 && !loading && (
          <p className="py-6 text-center text-[13px] text-[var(--text-mute)]">
            {t("tracking.noPositions", "ຍັງບໍ່ມີຊ່າງສົ່ງຕຳແໜ່ງ (ຕ້ອງ check-in ແລະ ເປີດ tracking ໃນແອັບ)")}
          </p>
        )}
        {pts.map((p, i) => (
          <Card key={i} className="flex items-center gap-3 p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--success-soft)] text-[var(--success)]">
              <MapPin size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-[var(--text)]">{p.name}</div>
              <div className="text-[11.5px] text-[var(--text-mute)]">
                {p.work_no ? `${t("tracking.workNo", "ໃບງານ")} ${p.work_no} · ` : ""}{ago(p.updated_at, t)}
              </div>
            </div>
            <a
              href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11.5px] font-semibold tabular-nums text-[var(--brand-strong)] hover:underline"
            >
              {Number(p.lat).toFixed(5)}, {Number(p.lng).toFixed(5)}
            </a>
          </Card>
        ))}
      </div>
    </Page>
  );
}
