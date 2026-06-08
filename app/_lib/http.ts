import { NextResponse } from "next/server";

export function ok(payload, init = {}) {
  return NextResponse.json(payload, { status: 200, ...init });
}

export function fail(message, status = 400, extra = {}) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...extra,
    },
    { status }
  );
}

export function serverError(error, fallbackMessage = "Internal server error") {
  console.error(error);
  return fail(error?.message || fallbackMessage, 500);
}

export function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function cleanOptionalText(value) {
  const text = cleanText(value);
  return text || null;
}

export function parseDateInput(value) {
  const text = cleanText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function formatDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function toNullableNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function isTruthyFlag(value) {
  const text = cleanText(value).toLowerCase();
  return text === "1" || text === "true" || text === "yes";
}

export function splitCoordinate(value) {
  const text = cleanText(value);
  if (!text) {
    return {
      lat: null,
      lng: null,
    };
  }

  const [latRaw, lngRaw] = text.split(",").map((part) => part.trim());
  return {
    lat: toNullableNumber(latRaw),
    lng: toNullableNumber(lngRaw),
  };
}

export function buildCoordinate(lat, lng) {
  const latNum = toNullableNumber(lat);
  const lngNum = toNullableNumber(lng);
  if (latNum === null || lngNum === null) return "";
  return `${latNum},${lngNum}`;
}
