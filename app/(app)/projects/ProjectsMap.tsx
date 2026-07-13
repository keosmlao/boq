"use client";

/**
 * Projects map view — plots every project that has coordinates as a pin.
 *
 * Coordinates come from the summary rows as legacy "lat,lng" strings
 * (`project_lg`, falling back to `office_lg`). Loaded client-side only
 * (Leaflet needs `window`), so ProjectsClient imports this with ssr:false.
 */
import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapPin } from "lucide-react";
import { Card } from "../_components/ui";

/**
 * Leaflet paints its popup chrome with its own stylesheet (hard white). Re-point
 * that chrome at the design tokens so popups follow light/dark like every other
 * surface. Scoped to this map only.
 */
const POPUP_THEME_CSS = `
.odg-map .leaflet-popup-content-wrapper,
.odg-map .leaflet-popup-tip {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-lg);
}
.odg-map .leaflet-popup-close-button { color: var(--text-mute); }
`;

const ICON_BASE = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images";
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${ICON_BASE}/marker-icon-2x.png`,
  iconUrl: `${ICON_BASE}/marker-icon.png`,
  shadowUrl: `${ICON_BASE}/marker-shadow.png`,
});

const LAOS_CENTER: [number, number] = [17.9757, 102.6331];

function toNum(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

/** Parse a legacy "lat,lng" string into a coordinate tuple. */
function parseLatLng(raw: unknown): [number, number] | null {
  if (!raw) return null;
  const [latRaw, lngRaw] = String(raw).split(",").map((s) => s.trim());
  const lat = toNum(latRaw);
  const lng = toNum(lngRaw);
  if (lat === null || lng === null) return null;
  return [lat, lng];
}

type Pin = {
  id: string;
  name: string;
  status: string;
  customer: string;
  place: string;
  pos: [number, number];
};

/** Auto-fit the map viewport to all pins once they're known. */
function FitBounds({ pins }: { pins: Pin[] }) {
  const map = useMap();
  useEffect(() => {
    if (!pins.length) return;
    if (pins.length === 1) {
      map.setView(pins[0].pos, 14);
      return;
    }
    map.fitBounds(L.latLngBounds(pins.map((p) => p.pos)), { padding: [40, 40] });
  }, [pins, map]);
  return null;
}

export default function ProjectsMap({
  rows,
  onOpen,
  t,
}: {
  rows: any[];
  onOpen: (id: string) => void;
  t: (k: string, f?: string) => string;
}) {
  const pins = useMemo<Pin[]>(() => {
    return rows
      .map((r) => {
        const pos = parseLatLng(r.project_lg) || parseLatLng(r.office_lg);
        if (!pos) return null;
        return {
          id: String(r.id),
          name: r.project_name || t("projects.noName", "(ບໍ່ມີຊື່)"),
          status: r.project_status || "-",
          customer: r.customer_name || r.sml_code || "",
          place: [r.village_name, r.district_name, r.province_name].filter(Boolean).join(", "),
          pos,
        } as Pin;
      })
      .filter(Boolean) as Pin[];
  }, [rows, t]);

  const missing = rows.length - pins.length;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-2.5 text-[11px] font-medium text-[var(--text-soft)]">
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={13} className="text-[var(--brand)]" />
          {pins.length} {t("projects.map.onMap", "ໂຄງການມີພິກັດ")}
        </span>
        {missing > 0 && (
          <span className="text-[var(--warning)]">
            {missing} {t("projects.map.noCoords", "ບໍ່ມີພິກັດ")}
          </span>
        )}
      </div>
      <style>{POPUP_THEME_CSS}</style>
      <MapContainer className="odg-map" center={LAOS_CENTER} zoom={6} style={{ height: 560, width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds pins={pins} />
        {pins.map((p) => (
          <Marker key={p.id} position={p.pos}>
            <Popup>
              <div className="space-y-1.5 min-w-[160px]">
                <div className="text-[13px] font-bold leading-tight text-[var(--text)]">{p.name}</div>
                {p.customer && <div className="text-[11px] text-[var(--text-soft)]">{p.customer}</div>}
                <div className="text-[11px] text-[var(--text-soft)]">{p.status}</div>
                {p.place && <div className="text-[11px] text-[var(--text-mute)]">{p.place}</div>}
                <button
                  onClick={() => onOpen(p.id)}
                  className="mt-1 inline-flex h-7 cursor-pointer items-center rounded-md bg-[var(--brand)] px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[var(--brand-hover)]"
                >
                  {t("projects.map.open", "ເປີດໂຄງການ")}
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </Card>
  );
}
