"use client";

/**
 * Mobile head-craftsman action panel for a work order.
 *
 * Lifecycle: issue → (manager) approve → (head craftsman) accept/reject
 *          → on-site check-in (photo + GPS) → check-out (photo + GPS) = close.
 *
 * Photos are captured straight from the phone camera (<input capture>), GPS via
 * navigator.geolocation. Server actions enforce the real permission/state rules;
 * the buttons here are just the matching UX.
 */
import React, { useRef, useState } from "react";
import { CheckCircle2, XCircle, MapPin, Camera, ShieldCheck, Clock, LogIn, LogOut } from "lucide-react";
import { Card, Btn } from "../../_components/ui";
import { getV2User } from "../../../_lib/session";
import { isManager, can } from "@/_lib/permissions";
import {
  approveWorkOrder,
  respondWorkOrder,
  checkInWorkOrder,
  checkOutWorkOrder,
} from "@/_actions/workorder";

const fmtTime = (v: unknown) => (v ? new Date(String(v)).toLocaleString("en-GB") : "-");
const coord = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(6) : null;
};

type Kind = "checkin" | "checkout";

/** Read the browser device GPS once. Rejects (with a Lao message) on failure. */
function getLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("ອຸປະກອນບໍ່ຮອງຮັບ GPS"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "ກະລຸນາອະນຸຍາດການເຂົ້າເຖິງ location (GPS)"
              : "ບໍ່ສາມາດອ່ານ location ໄດ້ — ກະລຸນາເປີດ GPS",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || "");
      const comma = res.indexOf(",");
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = () => reject(new Error("ອ່ານໄຟລ໌ຮູບບໍ່ສຳເລັດ"));
    reader.readAsDataURL(file);
  });
}

export default function WorkOrderJobPanel({ wo, onChanged }: { wo: any; onChanged: () => void }) {
  const [busy, setBusy] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingKind = useRef<Kind | null>(null);

  // erp-* legacy work orders are read-only for this flow.
  if (!wo || wo.src === "erp" || String(wo.id || "").startsWith("erp-")) return null;

  const user = getV2User();
  const access = user ? { role: user.role, permissions: user.permissions } : null;
  const canApprove = can(access, "work-orders", "approve");
  const assigned = wo.assigned_username ? String(wo.assigned_username) : "";
  const canAct = !!user && (isManager(access) || !assigned || assigned === user.username);

  const approvalStatus = String(wo.approval_status || "pending");
  const acceptStatus = String(wo.accept_status || "pending");
  const hasCheckin = !!wo.checkin_at;
  const hasCheckout = !!wo.checkout_at;

  const run = async (label: string, fn: () => Promise<any>) => {
    setErr("");
    setBusy(label);
    try {
      const res = await fn();
      if (res && res.success === false) {
        setErr(res.message || "ດຳເນີນການບໍ່ສຳເລັດ");
      } else {
        onChanged();
      }
    } catch (e) {
      setErr((e as Error).message || "ເກີດຂໍ້ຜິດພາດ");
    } finally {
      setBusy("");
    }
  };

  // Check-in / check-out: open the camera, then read GPS, then submit.
  const startCheckpoint = (kind: Kind) => {
    setErr("");
    pendingKind.current = kind;
    fileRef.current?.click();
  };

  const onPhotoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    const kind = pendingKind.current;
    pendingKind.current = null;
    if (!file || !kind) return;

    setErr("");
    setBusy(kind);
    try {
      const [photoBase64, loc] = await Promise.all([fileToBase64(file), getLocation()]);
      const payload = { lat: loc.lat, lng: loc.lng, photoBase64, photoName: file.name || `${kind}.jpg` };
      const res =
        kind === "checkin"
          ? await checkInWorkOrder(String(wo.id), payload)
          : await checkOutWorkOrder(String(wo.id), payload);
      if (res && res.success === false) setErr(res.message || "ດຳເນີນການບໍ່ສຳເລັດ");
      else onChanged();
    } catch (e2) {
      setErr((e2 as Error).message || "ເກີດຂໍ້ຜິດພາດ");
    } finally {
      setBusy("");
    }
  };

  return (
    <Card className="overflow-hidden border-t-4 border-t-emerald-500 shadow-sm">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPhotoPicked}
      />

      <div className="flex items-center gap-2 border-b border-[var(--theme-border-subtle)] bg-slate-50/50 px-4 py-3">
        <ShieldCheck size={16} className="text-emerald-600" />
        <h2 className="text-[13.5px] font-bold text-[var(--theme-text)]">ສະຖານະວຽກ & ການດຳເນີນງານ</h2>
      </div>

      <div className="space-y-4 p-4">
        {/* Status timeline */}
        <div className="space-y-2">
          <Step
            done={approvalStatus === "approved"}
            rejected={approvalStatus === "rejected"}
            label="ການອະນຸມັດ"
            value={
              approvalStatus === "approved"
                ? `ອະນຸມັດໂດຍ ${wo.approver || "-"} · ${fmtTime(wo.approved_at)}`
                : approvalStatus === "rejected"
                  ? `ຖືກປະຕິເສດ ${wo.approve_note ? "· " + wo.approve_note : ""}`
                  : "ລໍຖ້າຜູ້ຈັດການອະນຸມັດ"
            }
          />
          <Step
            done={acceptStatus === "accepted"}
            rejected={acceptStatus === "rejected"}
            label="ຫົວໜ້າຊ່າງຮັບງານ"
            value={
              acceptStatus === "accepted"
                ? `ຮັບໂດຍ ${wo.accepted_by || "-"} · ${fmtTime(wo.accepted_at)}`
                : acceptStatus === "rejected"
                  ? `ປະຕິເສດ ${wo.reject_reason ? "· " + wo.reject_reason : ""}`
                  : "ລໍຖ້າຫົວໜ້າຊ່າງກົດຮັບ"
            }
          />
          <Step done={hasCheckin} label="Check-in ໜ້າງານ" value={hasCheckin ? `${fmtTime(wo.checkin_at)} · ${wo.checkin_by || ""}` : "ຍັງບໍ່ check-in"} />
          <Step done={hasCheckout} label="Check-out / ປິດງານ" value={hasCheckout ? `${fmtTime(wo.checkout_at)} · ${wo.checkout_by || ""}` : "ຍັງບໍ່ check-out"} />
        </div>

        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-700">
            {err}
          </div>
        )}

        {/* Action buttons by stage */}
        <div className="flex flex-col gap-2.5">
          {/* 1) Manager approval */}
          {approvalStatus === "pending" && canApprove && (
            <div className="grid grid-cols-2 gap-2.5">
              <Btn variant="primary" className="w-full" disabled={!!busy} onClick={() => run("approve", () => approveWorkOrder(String(wo.id), { approve: true }))}>
                <CheckCircle2 size={15} /> ອະນຸມັດ
              </Btn>
              <Btn variant="danger" className="w-full" disabled={!!busy} onClick={() => {
                const note = window.prompt("ເຫດຜົນທີ່ປະຕິເສດ (ບໍ່ບັງຄັບ)") ?? undefined;
                void run("reject-approval", () => approveWorkOrder(String(wo.id), { approve: false, note }));
              }}>
                <XCircle size={15} /> ປະຕິເສດ
              </Btn>
            </div>
          )}
          {approvalStatus === "pending" && !canApprove && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-amber-600"><Clock size={14} /> ລໍຖ້າຜູ້ຈັດການອະນຸມັດກ່ອນ</p>
          )}

          {/* 2) Head craftsman accept / reject */}
          {approvalStatus === "approved" && acceptStatus === "pending" && canAct && (
            <div className="grid grid-cols-2 gap-2.5">
              <Btn variant="primary" className="w-full" disabled={!!busy} onClick={() => run("accept", () => respondWorkOrder(String(wo.id), { accept: true }))}>
                <CheckCircle2 size={15} /> ຮັບງານ
              </Btn>
              <Btn variant="danger" className="w-full" disabled={!!busy} onClick={() => {
                const reason = window.prompt("ເຫດຜົນທີ່ປະຕິເສດ (ບໍ່ບັງຄັບ)") ?? undefined;
                void run("reject", () => respondWorkOrder(String(wo.id), { accept: false, reason }));
              }}>
                <XCircle size={15} /> ປະຕິເສດ
              </Btn>
            </div>
          )}

          {/* 3) Check-in */}
          {approvalStatus === "approved" && acceptStatus === "accepted" && !hasCheckin && canAct && (
            <Btn variant="primary" className="w-full" disabled={!!busy} onClick={() => startCheckpoint("checkin")}>
              {busy === "checkin" ? <Clock size={15} className="animate-spin" /> : <LogIn size={15} />}
              {busy === "checkin" ? "ກຳລັງບັນທຶກ..." : "Check-in (ຖ່າຍຮູບ + GPS)"}
            </Btn>
          )}

          {/* 4) Check-out / close */}
          {hasCheckin && !hasCheckout && canAct && (
            <Btn variant="primary" className="w-full" disabled={!!busy} onClick={() => startCheckpoint("checkout")}>
              {busy === "checkout" ? <Clock size={15} className="animate-spin" /> : <LogOut size={15} />}
              {busy === "checkout" ? "ກຳລັງບັນທຶກ..." : "Check-out ແລະ ປິດງານ (ຖ່າຍຮູບ + GPS)"}
            </Btn>
          )}

          {hasCheckout && (
            <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] font-bold text-emerald-700">
              <CheckCircle2 size={15} /> ປິດງານສຳເລັດ
            </p>
          )}
        </div>

        {/* Captured evidence */}
        {(hasCheckin || hasCheckout) && (
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--theme-border-subtle)] pt-3">
            <Evidence title="ກ່ອນເລີ່ມວຽກ" photo={wo.checkin_photo} lat={wo.checkin_lat} lng={wo.checkin_lng} at={wo.checkin_at} />
            <Evidence title="ຫຼັງສຳເລັດ" photo={wo.checkout_photo} lat={wo.checkout_lat} lng={wo.checkout_lng} at={wo.checkout_at} />
          </div>
        )}
      </div>
    </Card>
  );
}

function Step({ done, rejected, label, value }: { done?: boolean; rejected?: boolean; label: string; value: string }) {
  const tone = rejected ? "bg-red-500" : done ? "bg-emerald-500" : "bg-slate-300";
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${tone}`} />
      <div className="min-w-0">
        <span className="text-[12px] font-bold text-[var(--theme-text)]">{label}</span>
        <p className="text-[11.5px] text-[var(--theme-text-mute)] break-words">{value}</p>
      </div>
    </div>
  );
}

function Evidence({ title, photo, lat, lng, at }: { title: string; photo?: string; lat?: unknown; lng?: unknown; at?: unknown }) {
  if (!photo && !at) return null;
  const la = coord(lat);
  const ln = coord(lng);
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-semibold text-[var(--theme-text-mute)]">{title}</span>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <a href={photo} target="_blank" rel="noreferrer">
          <img src={photo} alt={title} className="h-32 w-full rounded-lg border border-slate-200 object-cover" />
        </a>
      ) : (
        <div className="flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-slate-300">
          <Camera size={20} />
        </div>
      )}
      {la && ln && (
        <a
          href={`https://www.google.com/maps?q=${la},${ln}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:underline"
        >
          <MapPin size={12} /> {la}, {ln}
        </a>
      )}
    </div>
  );
}
