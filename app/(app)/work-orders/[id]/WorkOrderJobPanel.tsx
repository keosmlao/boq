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
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, MapPin, Camera, ShieldCheck, Clock, LogIn, LogOut, RotateCcw, Smartphone } from "lucide-react";
import { Card, Btn, SectionHeader } from "../../_components/ui";
import { getV2User } from "../../../_lib/session";
import { can } from "@/_lib/permissions";
import { useT } from "@/_lib/i18n";
import { useConfirm } from "../../_components/Confirm";
import {
  approveWorkOrder,
  respondWorkOrder,
  checkInWorkOrder,
  checkOutWorkOrder,
  closeWorkOrder,
  startWorkOrderFromErp,
} from "@/_actions/workorder";
import { resetWorkOrderRejection } from "@/_actions/workorder-reset";

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
  const router = useRouter();
  const confirm = useConfirm();
  const t = useT();
  const [busy, setBusy] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingKind = useRef<Kind | null>(null);

  if (!wo) return null;

  const user = getV2User();
  const access = user ? { role: user.role, permissions: user.permissions } : null;
  const canApprove = can(access, "work-orders", "approve");
  const isErp = wo.src === "erp" || String(wo.id || "").startsWith("erp-");

  // Legacy ERP work order: offer to mirror → v2 + approve so it enters the mobile flow.
  if (isErp) {
    if (!canApprove) return null;
    return (
      <Card className="overflow-hidden">
        <div className="px-5 pt-5">
          <SectionHeader icon={<Smartphone size={14} />} title="ສົ່ງເຂົ້າແອັບมือถือ" tone="brand" className="mb-0" />
        </div>
        <div className="space-y-3 p-5">
          <p className="text-[12.5px] text-[var(--text-mute)]">
            ໃບງານນີ້ແມ່ນລະບົບເກົ່າ (ERP). ກົດ "ມອບໝາຍ & ອະນຸມັດ" ເພື່ອสร้างสำเนาให้ช่างฮับ/check-in/out ผ่านมือถือ — ຊ່າງຈະໄດ້ຮັບການແຈ້ງเตือน.
          </p>
          {err && (
            <div className="rounded-xl border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] font-semibold text-[var(--danger)]">
              {err}
            </div>
          )}
          <Btn
            variant="go"
            className="w-full"
            disabled={!!busy}
            onClick={async () => {
              if (!(await confirm({ title: "ມອບໝາຍ & ອະນຸມັດ", message: `ສ້າງສະບັບ flow ມືถือ ແລະ ອະນຸມັດ ${wo.work_no || "ໃບງານ"}?`, confirmLabel: "ອະນຸມັດ" }))) return;
              setErr("");
              setBusy("start");
              try {
                const res: any = await startWorkOrderFromErp(String(wo.id));
                if (res?.success === false) setErr(res.message || "ດຳເນີນການບໍ່ສຳເລັດ");
                else if (res?.data?.id) router.push(`/work-orders/${res.data.id}`);
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy("");
              }
            }}
          >
            <CheckCircle2 size={15} /> {busy === "start" ? "ກຳລັງดำเนินการ..." : "ມອບໝາຍ & ອະນຸມັດ"}
          </Btn>
        </div>
      </Card>
    );
  }
  const assigned = wo.assigned_username ? String(wo.assigned_username) : "";
  const canAct = !!user && (!assigned || assigned === user.username);

  const approvalStatus = String(wo.approval_status || "pending");
  const acceptStatus = String(wo.accept_status || "pending");
  const hasCheckin = !!wo.checkin_at;
  const hasCheckout = !!wo.checkout_at;
  const hasClose = !!wo.closed_at;
  // A rejected work order (ບໍ່ອະນຸມັດ / ຊ່າງປະຕິເສດ) shows no stage buttons at all —
  // it can only move again via the reset below.
  const isRejected = approvalStatus === "rejected" || acceptStatus === "rejected";
  const resetLabel =
    approvalStatus === "rejected"
      ? t("workorders.resetToApproval", "ສົ່ງກັບໄປລໍອະນຸມັດໃໝ່")
      : t("workorders.resetToAccept", "ສົ່ງກັບໄປໃຫ້ຊ່າງຮັບງານໃໝ່");

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
    <Card className="overflow-hidden">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPhotoPicked}
      />

      <div className="px-5 pt-5">
        <SectionHeader icon={<ShieldCheck size={14} />} title="ສະຖານະວຽກ & ການດຳເນີນງານ" tone="brand" className="mb-0" />
      </div>

      <div className="space-y-4 p-5">
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
          <Step done={hasCheckin} label="ກຳລັງເຂົ້າໜ້າງານ (Check-in)" value={hasCheckin ? `${fmtTime(wo.checkin_at)} · ${wo.checkin_by || ""}` : "ຍັງບໍ່ check-in"} />
          <Step done={hasCheckout} label="ລໍຖ້າກວດສອບ (Check-out)" value={hasCheckout ? `${fmtTime(wo.checkout_at)} · ${wo.checkout_by || ""}` : "ຍັງບໍ່ check-out"} />
          <Step done={hasClose} label="ປິດງານແລ້ວ" value={hasClose ? `ປິດໂດຍ ${wo.closed_by || "-"} · ${fmtTime(wo.closed_at)}` : "ລໍຖ້າກວດສອບ & ປິດງານ"} />
        </div>

        {err && (
          <div className="rounded-xl border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-3 py-2 text-[12.5px] font-semibold text-[var(--danger)]">
            {err}
          </div>
        )}

        {/* Action buttons by stage */}
        <div className="flex flex-col gap-2.5">
          {/* 0) Rejected → send it back into the flow (otherwise a dead end).
                 approval_rejected → ລໍອະນຸມັດໃໝ່; accept_rejected → ຊ່າງຮັບງານໃໝ່. */}
          {isRejected && canApprove && (
            <Btn
              variant="ink"
              className="w-full"
              disabled={!!busy}
              onClick={async () => {
                if (
                  !(await confirm({
                    title: t("workorders.resetTitle", "ສົ່ງກັບເຂົ້າຂັ້ນຕອນໃໝ່"),
                    message: `${resetLabel} — ${wo.work_no || "ໃບງານ"}?`,
                    confirmLabel: t("workorders.resetConfirm", "ສົ່ງກັບ"),
                  }))
                )
                  return;
                const note = window.prompt(t("workorders.resetNote", "ໝາຍເຫດ (ບໍ່ບັງຄັບ)")) ?? undefined;
                void run("reset", () => resetWorkOrderRejection(String(wo.id), { note }));
              }}
            >
              {busy === "reset" ? <Clock size={15} className="animate-spin" /> : <RotateCcw size={15} />}
              {busy === "reset" ? t("common.saving", "ກຳລັງບັນທຶກ...") : resetLabel}
            </Btn>
          )}
          {isRejected && !canApprove && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-[var(--danger)]">
              <XCircle size={14} /> {t("workorders.rejectedWaitReset", "ໃບງານຖືກປະຕິເສດ — ລໍຖ້າຜູ້ຈັດການສົ່ງກັບໄປອະນຸມັດໃໝ່")}
            </p>
          )}

          {/* 1) Manager approval */}
          {approvalStatus === "pending" && canApprove && (
            <div className="grid grid-cols-2 gap-2.5">
              <Btn variant="go" className="w-full" disabled={!!busy} onClick={async () => { if (await confirm({ title: "ຢືນຢັນການອະນຸມັດ", message: `ອະນຸມັດ ${wo.work_no || "ໃບງານ"}?`, confirmLabel: "ອະນຸມັດ" })) run("approve", () => approveWorkOrder(String(wo.id), { approve: true })); }}>
                <CheckCircle2 size={15} /> ອະນຸມັດ
              </Btn>
              <Btn variant="danger-outline" className="w-full" disabled={!!busy} onClick={() => {
                const note = window.prompt("ເຫດຜົນທີ່ປະຕິເສດ (ບໍ່ບັງຄັບ)") ?? undefined;
                void run("reject-approval", () => approveWorkOrder(String(wo.id), { approve: false, note }));
              }}>
                <XCircle size={15} /> ປະຕິເສດ
              </Btn>
            </div>
          )}
          {approvalStatus === "pending" && !canApprove && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-[var(--warning)]"><Clock size={14} /> ລໍຖ້າຜູ້ຈັດການອະນຸມັດກ່ອນ</p>
          )}

          {/* 2) Head craftsman accept / reject */}
          {approvalStatus === "approved" && acceptStatus === "pending" && canAct && (
            <div className="grid grid-cols-2 gap-2.5">
              <Btn variant="go" className="w-full" disabled={!!busy} onClick={() => run("accept", () => respondWorkOrder(String(wo.id), { accept: true }))}>
                <CheckCircle2 size={15} /> ຮັບງານ
              </Btn>
              <Btn variant="danger-outline" className="w-full" disabled={!!busy} onClick={() => {
                const reason = window.prompt("ເຫດຜົນທີ່ປະຕິເສດ (ບໍ່ບັງຄັບ)") ?? undefined;
                void run("reject", () => respondWorkOrder(String(wo.id), { accept: false, reason }));
              }}>
                <XCircle size={15} /> ປະຕິເສດ
              </Btn>
            </div>
          )}

          {/* 3) Check-in */}
          {approvalStatus === "approved" && acceptStatus === "accepted" && !hasCheckin && canAct && (
            <Btn variant="ink" className="w-full" disabled={!!busy} onClick={() => startCheckpoint("checkin")}>
              {busy === "checkin" ? <Clock size={15} className="animate-spin" /> : <LogIn size={15} />}
              {busy === "checkin" ? "ກຳລັງບັນທຶກ..." : "Check-in (ຖ່າຍຮູບ + GPS)"}
            </Btn>
          )}

          {/* 4) Check-out (work done → awaiting inspection) */}
          {hasCheckin && !hasCheckout && canAct && (
            <Btn variant="ink" className="w-full" disabled={!!busy} onClick={() => startCheckpoint("checkout")}>
              {busy === "checkout" ? <Clock size={15} className="animate-spin" /> : <LogOut size={15} />}
              {busy === "checkout" ? "ກຳລັງບັນທຶກ..." : "Check-out — ສົ່ງກວດສອບ (ຖ່າຍຮູບ + GPS)"}
            </Btn>
          )}

          {/* 5) Inspection close — manager/inspector only */}
          {hasCheckout && !hasClose && canApprove && (
            <Btn variant="go" className="w-full" disabled={!!busy} onClick={() => {
              const note = window.prompt("ໝາຍເຫດການກວດສອບ (ບໍ່ບັງຄັບ)") ?? undefined;
              void run("close", () => closeWorkOrder(String(wo.id), { note }));
            }}>
              <CheckCircle2 size={15} /> ກວດສອບ & ປິດງານ
            </Btn>
          )}
          {hasCheckout && !hasClose && !canApprove && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-[var(--warning)]"><Clock size={14} /> ລໍຖ້າຜູ້ກວດສອບປິດງານ</p>
          )}

          {hasClose && (
            <p className="flex items-center gap-1.5 rounded-xl border border-[var(--success-soft)] bg-[var(--success-soft)] px-3 py-2 text-[12.5px] font-bold text-[var(--success)]">
              <CheckCircle2 size={15} /> ປິດງານສຳເລັດ
            </p>
          )}
        </div>

        {/* Captured evidence */}
        {(hasCheckin || hasCheckout) && (
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--border-soft)] pt-3">
            <Evidence title="ກ່ອນເລີ່ມວຽກ" photo={wo.checkin_photo} lat={wo.checkin_lat} lng={wo.checkin_lng} at={wo.checkin_at} />
            <Evidence title="ຫຼັງສຳເລັດ" photo={wo.checkout_photo} lat={wo.checkout_lat} lng={wo.checkout_lng} at={wo.checkout_at} />
          </div>
        )}
      </div>
    </Card>
  );
}

function Step({ done, rejected, label, value }: { done?: boolean; rejected?: boolean; label: string; value: string }) {
  const tone = rejected ? "var(--danger)" : done ? "var(--success)" : "var(--border-strong)";
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: tone }} />
      <div className="min-w-0">
        <span className="text-[12px] font-bold text-[var(--text)]">{label}</span>
        <p className="break-words text-[11.5px] text-[var(--text-mute)]">{value}</p>
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
      <span className="text-[11px] font-bold tracking-wider text-[var(--text-mute)]">{title}</span>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <a href={photo} target="_blank" rel="noreferrer">
          <img src={photo} alt={title} className="h-32 w-full rounded-xl border border-[var(--border)] object-cover" />
        </a>
      ) : (
        <div className="flex h-32 w-full items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-[var(--text-mute)]">
          <Camera size={20} />
        </div>
      )}
      {la && ln && (
        <a
          href={`https://www.google.com/maps?q=${la},${ln}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-[11px] font-semibold text-[var(--brand)] hover:underline"
        >
          <MapPin size={12} /> {la}, {ln}
        </a>
      )}
    </div>
  );
}
