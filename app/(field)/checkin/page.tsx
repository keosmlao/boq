"use client";

/**
 * Craftsman self-service check-in (ໜ້າເຊັກອິນຊ່າງ). Lists the logged-in
 * craftsman's own work orders and lets them accept → check-in → check-out, each
 * with GPS + a site photo, mirroring the mobile flow. Reached by direct URL
 * (craftsmen have no sidebar). Only the explicit attendance channel — never the
 * covert continuous GPS feed.
 */
import React, { useEffect, useState } from "react";
import { Loader2, MapPin, Camera, CheckCircle2, LogIn, LogOut, Clock, ShieldCheck } from "lucide-react";
import { getMyWorkOrders, acceptMyWorkOrder, checkInMyWorkOrder, checkOutMyWorkOrder } from "@/_actions/field-checkin";
import { useT } from "@/_lib/i18n";

const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : "");

/** Downscale a camera photo to a small JPEG data URL (keeps the payload light). */
function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const max = 1600;
        let { width, height } = img;
        if (width > max || height > max) {
          const s = Math.min(max / width, max / height);
          width = Math.round(width * s);
          height = Math.round(height * s);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no ctx"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function getGps(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("no geolocation"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
}

type Wo = any;

export default function CheckinPage() {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Wo[]>([]);
  const [me, setMe] = useState<{ name: string; manager: boolean } | null>(null);
  const [loadErr, setLoadErr] = useState("");

  const load = React.useCallback(async () => {
    const res: any = await getMyWorkOrders();
    if (res?.success === false) {
      setLoadErr(res.message || t("checkin.loadFailed", "ໂຫຼດບໍ່ສຳເລັດ"));
      setRows([]);
    } else {
      setRows(res.data || []);
      setMe({ name: res.me?.name || "", manager: !!res.me?.manager });
      setLoadErr("");
    }
  }, [t]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await load();
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [load]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center gap-2.5 text-neutral-500">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-[13px] font-semibold">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3">
        <h1 className="text-[17px] font-black tracking-tight text-neutral-900">{t("checkin.heading", "ວຽກຂອງຂ້ອຍ")}</h1>
        {me?.name && <p className="text-[12px] font-semibold text-neutral-500">{me.name}{me.manager ? " · " + t("checkin.managerView", "ຜູ້ຈັດການ (ເຫັນທັງໝົດ)") : ""}</p>}
      </div>

      {loadErr && (
        <div className="mb-3 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-rose-600">{loadErr}</div>
      )}

      {rows.length === 0 && !loadErr ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-12 text-center text-[13px] font-semibold text-neutral-400">
          {t("checkin.noJobs", "ຍັງບໍ່ມີໃບງານທີ່ມອບໝາຍໃຫ້ທ່ານ")}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((w) => (
            <WoCard key={String(w.id)} w={w} onDone={load} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function WoCard({ w, onDone, t }: { w: Wo; onDone: () => Promise<void>; t: (k: string, f?: string) => string }) {
  const [mode, setMode] = useState<null | "checkin" | "checkout">(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsErr, setGpsErr] = useState("");
  const [photo, setPhoto] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const approved = w.approval_status === "approved";
  const legacy = String(w.id).startsWith("erp-");
  const done = !!w.checkout_at;
  const inProgress = !!w.checkin_at && !w.checkout_at;
  const readyCheckin = approved && w.accept_status === "accepted" && !w.checkin_at;
  const awaitingAccept = approved && w.accept_status !== "accepted" && w.accept_status !== "rejected";
  const rejected = w.accept_status === "rejected";

  const state = done
    ? { label: t("checkin.stDone", "ສຳເລັດແລ້ວ (ລໍຖ້າກວດສອບ)"), cls: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 size={13} /> }
    : inProgress
      ? { label: t("checkin.stInProgress", "ກຳລັງເຮັດວຽກ"), cls: "bg-blue-100 text-blue-700", icon: <Clock size={13} /> }
      : readyCheckin
        ? { label: t("checkin.stReady", "ພ້ອມເຊັກອິນ"), cls: "bg-teal-100 text-teal-700", icon: <LogIn size={13} /> }
        : awaitingAccept
          ? { label: t("checkin.stAccept", "ລໍຖ້າຮັບງານ"), cls: "bg-amber-100 text-amber-700", icon: <ShieldCheck size={13} /> }
          : rejected
            ? { label: t("checkin.stRejected", "ປະຕິເສດແລ້ວ"), cls: "bg-neutral-200 text-neutral-600", icon: null }
            : { label: t("checkin.stWaitApproval", "ລໍຖ້າອະນຸມັດໃບງານ"), cls: "bg-neutral-200 text-neutral-600", icon: null };

  const resetCapture = () => { setMode(null); setCoords(null); setGpsErr(""); setPhoto(""); setNote(""); setErr(""); };

  const grabGps = async () => {
    setGpsBusy(true); setGpsErr("");
    try {
      setCoords(await getGps());
    } catch {
      setGpsErr(t("checkin.gpsFailed", "ດຶງ GPS ບໍ່ໄດ້ — ກະລຸນາເປີດ location ແລະ ອະນຸຍາດ"));
    } finally {
      setGpsBusy(false);
    }
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    try {
      setPhoto(await downscale(file));
    } catch {
      setErr(t("checkin.photoFailed", "ໂຫຼດຮູບບໍ່ໄດ້"));
    } finally {
      e.target.value = "";
    }
  };

  const accept = async () => {
    setBusy(true); setErr("");
    try {
      const res: any = await acceptMyWorkOrder(String(w.id));
      if (res?.success) await onDone();
      else setErr(res?.message || t("checkin.actionFailed", "ດຳເນີນການບໍ່ສຳເລັດ"));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!coords || !photo) return;
    setBusy(true); setErr("");
    try {
      const payload = { lat: coords.lat, lng: coords.lng, photoBase64: photo.split(",")[1] || "", note: note || undefined };
      const res: any = mode === "checkin"
        ? await checkInMyWorkOrder(String(w.id), payload)
        : await checkOutMyWorkOrder(String(w.id), payload);
      if (res?.success) { resetCapture(); await onDone(); }
      else setErr(res?.message || t("checkin.actionFailed", "ດຳເນີນການບໍ່ສຳເລັດ"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-black text-neutral-900">{w.work_no || t("checkin.job", "ໃບງານ")}</div>
          <div className="mt-0.5 truncate text-[12px] font-semibold text-neutral-600">{w.project_name || "-"}</div>
          {(w.customer || w.work_date) && (
            <div className="mt-0.5 truncate text-[11.5px] text-neutral-400">
              {[w.customer, d10(w.work_date)].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${state.cls}`}>
          {state.icon}{state.label}
        </span>
      </div>

      {legacy && (
        <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-[11.5px] font-semibold text-neutral-500">
          {t("checkin.legacyJob", "ໃບງານລະບົບເກົ່າ — ດຳເນີນການໃນລະບົບເກົ່າ")}
        </p>
      )}

      {/* Actions */}
      {!legacy && (
        <div className="mt-3">
          {awaitingAccept && (
            <button onClick={accept} disabled={busy} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-[13px] font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} {t("checkin.accept", "ຮັບງານ")}
            </button>
          )}

          {(readyCheckin || inProgress) && mode === null && (
            <button
              onClick={() => setMode(inProgress ? "checkout" : "checkin")}
              className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-bold text-white transition-colors ${inProgress ? "bg-blue-600 hover:bg-blue-700" : "bg-teal-600 hover:bg-teal-700"}`}
            >
              {inProgress ? <><LogOut size={16} /> {t("checkin.checkout", "ເຊັກເອົາ (ສຳເລັດວຽກ)")}</> : <><LogIn size={16} /> {t("checkin.checkin", "ເຊັກອິນ (ເລີ່ມວຽກ)")}</>}
            </button>
          )}

          {/* Capture panel */}
          {mode !== null && (
            <div className="mt-1 space-y-2.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="text-[12px] font-black text-neutral-800">
                {mode === "checkin" ? t("checkin.checkin", "ເຊັກອິນ (ເລີ່ມວຽກ)") : t("checkin.checkout", "ເຊັກເອົາ (ສຳເລັດວຽກ)")}
              </div>

              {/* GPS */}
              <button onClick={grabGps} disabled={gpsBusy} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white text-[12px] font-bold text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-60">
                {gpsBusy ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                {coords ? t("checkin.gpsOk", "ໄດ້ GPS ແລ້ວ") : t("checkin.getGps", "ດຶງ GPS")}
              </button>
              {coords && <div className="text-center text-[10.5px] tabular-nums text-emerald-600">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</div>}
              {gpsErr && <div className="text-center text-[11px] font-semibold text-rose-600">{gpsErr}</div>}

              {/* Photo */}
              <label className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white text-[12px] font-bold text-neutral-700 transition-colors hover:bg-neutral-100">
                <Camera size={14} /> {photo ? t("checkin.photoOk", "ຖ່າຍຮູບແລ້ວ — ຖ່າຍໃໝ່") : t("checkin.takePhoto", "ຖ່າຍຮູບໜ້າງານ")}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
              </label>
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="max-h-40 w-full rounded-lg object-cover" />
              )}

              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("checkin.notePlaceholder", "ໝາຍເຫດ (ບໍ່ບັງຄັບ)")}
                className="h-9 w-full rounded-lg border border-neutral-300 bg-white px-2.5 text-[12px] text-neutral-800 outline-none focus:border-teal-500"
              />

              {err && <div className="text-center text-[11.5px] font-semibold text-rose-600">{err}</div>}

              <div className="flex gap-2">
                <button onClick={resetCapture} disabled={busy} className="h-10 flex-1 rounded-xl border border-neutral-300 bg-white text-[12.5px] font-bold text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-60">
                  {t("common.cancel", "ຍົກເລີກ")}
                </button>
                <button
                  onClick={submit}
                  disabled={busy || !coords || !photo}
                  className="inline-flex h-10 flex-[2] items-center justify-center gap-2 rounded-xl bg-teal-600 text-[12.5px] font-bold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} {t("checkin.confirm", "ຢືນຢັນ")}
                </button>
              </div>
              {(!coords || !photo) && (
                <div className="text-center text-[10.5px] text-neutral-400">{t("checkin.needBoth", "ຕ້ອງມີ GPS ແລະ ຮູບ ກ່ອນຢືນຢັນ")}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
