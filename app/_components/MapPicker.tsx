"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import L, { type LatLngExpression, type Map as LeafletMap, type Marker as LeafletMarker } from "leaflet";
import { Crosshair, MapPin, Search, X } from "lucide-react";

// Fix Leaflet default marker icon paths under Next/Webpack — point to CDN.
const ICON_BASE = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete ((L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl);
L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${ICON_BASE}/marker-icon-2x.png`,
  iconUrl: `${ICON_BASE}/marker-icon.png`,
  shadowUrl: `${ICON_BASE}/marker-shadow.png`,
});

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const MapBridge = dynamic(() => import("./MapPickerBridge"), { ssr: false });

type LatLng = { lat: number | string; lng: number | string };

type Props = {
  value?: LatLng | null;
  onChange?: (v: { lat: number; lng: number }) => void;
  placeholder?: string;
  zoom?: number;
  disabled?: boolean;
  height?: number | string;
};

const LAOS_CENTER: LatLngExpression = [17.9757, 102.6331];

function toNumber(n: unknown): number | null {
  const v = typeof n === "string" ? parseFloat(n) : (n as number);
  return Number.isFinite(v) ? (v as number) : null;
}

function asLatLng(v?: LatLng | null): LatLngExpression | null {
  if (!v) return null;
  const lat = toNumber(v.lat);
  const lng = toNumber(v.lng);
  if (lat === null || lng === null) return null;
  return [lat, lng];
}

export default function MapPicker({
  value,
  onChange,
  placeholder = "ຄົ້ນຫາສະຖານທີ່...",
  zoom = 13,
  disabled = false,
  height = 360,
}: Props) {
  const initial = asLatLng(value) || LAOS_CENTER;
  const [marker, setMarker] = useState<LatLngExpression | null>(asLatLng(value));
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [showResults, setShowResults] = useState(false);

  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  // Sync external value updates into the marker
  useEffect(() => {
    const next = asLatLng(value);
    setMarker(next);
    if (next) {
      const [lat, lng] = next as [number, number];
      setFlyTarget({ lat, lng });
    }
  }, [value?.lat, value?.lng]);

  const emit = useCallback(
    (lat: number, lng: number) => {
      setMarker([lat, lng]);
      onChange?.({ lat, lng });
    },
    [onChange],
  );

  const handleMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;
  }, []);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (disabled) return;
      emit(lat, lng);
    },
    [disabled, emit],
  );

  const goToMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        emit(latitude, longitude);
        setFlyTarget({ lat: latitude, lng: longitude, zoom: 16 });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [emit]);

  // Nominatim search (free OSM geocoder, no API key)
  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", trimmed);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "6");
      url.searchParams.set("addressdetails", "0");
      const res = await fetch(url.toString(), {
        headers: { "Accept-Language": "lo,en" },
      });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setShowResults(true);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const onSearchKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void runSearch(query);
      }
      if (e.key === "Escape") {
        setShowResults(false);
      }
    },
    [query, runSearch],
  );

  const pickResult = useCallback(
    (r: { lat: string; lon: string }) => {
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      emit(lat, lng);
      setFlyTarget({ lat, lng, zoom: 16 });
      setShowResults(false);
      setQuery("");
    },
    [emit],
  );

  const containerHeight = typeof height === "number" ? `${height}px` : height;

  const dragHandlers = useMemo(
    () => ({
      dragend: () => {
        const m = markerRef.current;
        if (!m) return;
        const ll = m.getLatLng();
        emit(ll.lat, ll.lng);
      },
    }),
    [emit],
  );

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      {/* Search + GPS toolbar */}
      <div className="absolute left-3 right-3 top-3 z-[1000] flex items-center gap-2">
        <div className="relative flex-1">
          <div className="flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 shadow-[var(--shadow-xs)] focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[var(--brand-ring)]">
            <Search size={14} className="text-[var(--text-mute)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder={placeholder}
              disabled={disabled}
              className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)] disabled:opacity-50"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setShowResults(false);
                }}
                className="text-[var(--text-mute)] hover:text-[var(--text)]"
                aria-label="Clear"
              >
                <X size={13} />
              </button>
            )}
            {searching && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
            )}
          </div>
          {showResults && results.length > 0 && (
            <ul className="absolute left-0 right-0 top-10 max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => pickResult(r)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-[12px] text-[var(--text)] transition hover:bg-[var(--brand-tint)]"
                  >
                    <MapPin size={12} className="mt-0.5 flex-shrink-0 text-[var(--brand)]" />
                    <span className="min-w-0 flex-1 truncate">{r.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {showResults && !searching && results.length === 0 && (
            <div className="absolute left-0 right-0 top-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-mute)] shadow-[var(--shadow-lg)]">
              ບໍ່ພົບສະຖານທີ່
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={goToMyLocation}
          disabled={disabled}
          title="ໃຊ້ຕຳແໜ່ງປັດຈຸບັນ"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] shadow-[var(--shadow-xs)] transition hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand)] disabled:opacity-50"
          aria-label="My location"
        >
          <Crosshair size={14} />
        </button>
      </div>

      {/* Selected coords pill */}
      {marker && (
        <div className="absolute bottom-3 left-3 z-[1000] inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-mono text-[10.5px] text-[var(--text)] shadow-[var(--shadow-xs)]">
          <MapPin size={11} className="text-[var(--brand)]" />
          {(marker as [number, number])[0].toFixed(6)}, {(marker as [number, number])[1].toFixed(6)}
        </div>
      )}

      <div style={{ height: containerHeight }}>
        <MapContainer
          center={initial}
          zoom={zoom}
          scrollWheelZoom
          style={{ width: "100%", height: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBridge onReady={handleMapReady} onClick={handleMapClick} flyTo={flyTarget} />
          {marker && (
            <Marker
              position={marker}
              draggable={!disabled}
              ref={(r) => {
                markerRef.current = (r as unknown as LeafletMarker) || null;
              }}
              eventHandlers={dragHandlers}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
