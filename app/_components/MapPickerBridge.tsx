"use client";

import { useEffect } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";

type Props = {
  onReady?: (map: LeafletMap) => void;
  onClick?: (lat: number, lng: number) => void;
  flyTo?: { lat: number; lng: number; zoom?: number } | null;
};

/**
 * Child component rendered inside <MapContainer>. Uses react-leaflet hooks
 * (`useMap`, `useMapEvents`) so the parent doesn't need to wrestle with refs.
 */
export default function MapPickerBridge({ onReady, onClick, flyTo }: Props) {
  const map = useMap();

  useEffect(() => {
    if (map && onReady) onReady(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    if (map && flyTo) {
      map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom ?? map.getZoom(), { duration: 0.5 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo?.lat, flyTo?.lng, flyTo?.zoom]);

  useMapEvents({
    click(e) {
      onClick?.(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}
