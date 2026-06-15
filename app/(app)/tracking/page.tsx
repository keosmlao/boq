"use client";

/** Live craftsman tracking map — latest position per craftsman (managers only). */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Page, Card } from "../_components/ui";
import { MapPin, RefreshCw } from "lucide-react";

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
const ago = (v: unknown) => {
  if (!v) return "";
  const mins = Math.floor((Date.now() - new Date(String(v)).getTime()) / 60000);
  if (mins < 1) return "ຫາก่อน";
  if (mins < 60) return `${mins} ນາທີກ່ອນ`;
  return `${Math.floor(mins / 60)} ຊມ ກ່ອນ`;
};

export default function TrackingPage() {
  const [pts, setPts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const r = await fetch("/api/tracking", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      setPts(Array.isArray(j?.data) ? j.data.filter((p: any) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))) : []);
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

  return (
    <Page max="max-w-none">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-[var(--theme-text)]">ຕິດຕາມຊ່າງ</h1>
        <button onClick={load} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> รีเฟรช
        </button>
      </div>

      <Card className="overflow-hidden p-0">
        <div style={{ height: "62vh", width: "100%" }}>
          <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {pts.map((p, i) => (
              <Marker key={i} position={[Number(p.lat), Number(p.lng)]}>
                <Popup>
                  <b>{p.name}</b>
                  <br />
                  {p.work_no ? `ໃບງານ: ${p.work_no}` : "—"}
                  <br />
                  ອັບເດດ: {fmt(p.updated_at)}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </Card>

      <div className="mt-4 space-y-2">
        {pts.length === 0 && !loading && (
          <p className="py-6 text-center text-sm text-[var(--theme-text-mute)]">ຍັງບໍ່ມີຊ່າງສົ່ງຕຳແໜ່ງ (ຕ້ອງ check-in ແລະ ເປີດ tracking ໃນແອັບ)</p>
        )}
        {pts.map((p, i) => (
          <Card key={i} className="flex items-center gap-3 p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <MapPin size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-[var(--theme-text)]">{p.name}</div>
              <div className="text-[11.5px] text-[var(--theme-text-mute)]">{p.work_no ? `ໃບງານ ${p.work_no} · ` : ""}{ago(p.updated_at)}</div>
            </div>
            <a
              href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11.5px] font-semibold text-emerald-600 hover:underline"
            >
              {Number(p.lat).toFixed(5)}, {Number(p.lng).toFixed(5)}
            </a>
          </Card>
        ))}
      </div>
    </Page>
  );
}
