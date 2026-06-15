/**
 * Single source of truth for a work order's lifecycle stage + Lao label,
 * derived from the lifecycle fields (not the raw `status` text, which may hold
 * legacy values). Pure module — safe to import in both client and server code.
 *
 * Lifecycle: ອອກໃບງານ → ຊ່າງຮັບງານ → ກຳລັງເຂົ້າໜ້າງານ → ລໍຖ້າກວດສອບ → ປິດງານແລ້ວ
 */
export type StageKey =
  | "issued" // ອອກໃບງານ (created / awaiting approve / awaiting accept)
  | "accepted" // ຊ່າງຮັບງານ
  | "in_progress" // ກຳລັງເຂົ້າໜ້າງານ (checked in)
  | "awaiting_review" // ລໍຖ້າກວດສອບ (checked out)
  | "closed" // ປິດງານແລ້ວ (inspected & closed)
  | "approval_rejected" // ບໍ່ອະນຸມັດ
  | "accept_rejected"; // ຊ່າງປະຕິເສດ

export type StageTone = "neutral" | "teal" | "indigo" | "amber" | "green" | "red";

export type Stage = { key: StageKey; label: string; tone: StageTone };

const has = (v: unknown) => v !== null && v !== undefined && String(v) !== "";

export function workOrderStage(w: any): Stage {
  if (w?.approval_status === "rejected") return { key: "approval_rejected", label: "ບໍ່ອະນຸມັດ", tone: "red" };
  if (w?.accept_status === "rejected") return { key: "accept_rejected", label: "ຊ່າງປະຕິເສດ", tone: "red" };
  if (has(w?.closed_at)) return { key: "closed", label: "ປິດງານແລ້ວ", tone: "green" };
  if (has(w?.checkout_at)) return { key: "awaiting_review", label: "ລໍຖ້າກວດສອບ", tone: "amber" };
  if (has(w?.checkin_at)) return { key: "in_progress", label: "ກຳລັງເຂົ້າໜ້າງານ", tone: "indigo" };
  if (w?.accept_status === "accepted") return { key: "accepted", label: "ຊ່າງຮັບງານ", tone: "teal" };
  return { key: "issued", label: "ອອກໃບງານ", tone: "neutral" };
}
