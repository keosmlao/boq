"use client";

/**
 * ລົດຊ່າງ (ODIEN SERVICE layout): toolbar → tabs → one table.
 *
 * The register comes from the car system and is read-only here; the one thing
 * this screen changes is WHO drives each vehicle, because that is what the
 * installation teams are dispatched on.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Car, Check, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, RefreshCw, Search, UserMinus, UserPlus, X } from "lucide-react";
import {
  assignVehicle,
  getTechniciansForAssign,
  getVehiclesPage,
  setTechVehicles,
  updateVehicleInfo,
  type VehicleRow,
} from "@/_actions/vehicles";
import {
  Btn,
  Card,
  Field,
  Page,
  PageHeader,
  Pill,
  RowBar,
  RowBarTh,
  Segmented,
  SortTh,
  Stat,
  Toolbar,
  TwoLine,
  inputCls,
  tblCls,
  tdCls,
  thCls,
  trHover,
  type PillTone,
} from "../_components/ui";
import type { Paged } from "@/_lib/paging";
import type { VehicleSource } from "@/_actions/vehicles";
import { getV2User } from "../../_lib/session";
import { can } from "@/_lib/permissions";
import { useT } from "@/_lib/i18n";

type Tab = "all" | "assigned" | "free" | "inactive" | "unmarked";
type SortKey = "plate" | "name" | "car_model" | "last_seen_at" | "drivers";

/** "2 ຊົ່ວໂມງກ່ອນ" — how long since the device last reported. */
function lastSeenLabel(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "ດຽວນີ້";
  if (mins < 60) return `${mins} ນາທີກ່ອນ`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ຊົ່ວໂມງກ່ອນ`;
  return `${Math.floor(hours / 24)} ມື້ກ່ອນ`;
}

/** Green while the device is reporting today, amber when it has gone quiet. */
const seenTone = (iso: string | null): PillTone => {
  if (!iso) return "neutral";
  const hours = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (!Number.isFinite(hours)) return "neutral";
  return hours <= 24 ? "green" : hours <= 24 * 7 ? "amber" : "red";
};

export default function VehiclesClient({
  initial,
  initialTechnicians,
  loadError = "",
}: {
  initial: (Paged<VehicleRow> & { source?: VehicleSource; live?: boolean; note?: string }) | null;
  initialTechnicians: Array<{ roworder: number; code: string; name: string; vehicle_id: string | null; vehicle_plate: string | null }>;
  /** Why the GPS fleet could not be read (credentials missing, API down, …). */
  loadError?: string;
}) {
  const t = useT();
  const router = useRouter();
  const user = getV2User();
  const canEdit = can(user, "tech-teams", "edit");

  const [data, setData] = useState<(Paged<VehicleRow> & { source?: VehicleSource; live?: boolean; note?: string }) | null>(initial);
  const [techs, setTechs] = useState(initialTechnicians);
  const [tab, setTab] = useState<Tab>("all");
  const [draftQ, setDraftQ] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "plate", dir: "asc" });
  const [loading, setLoading] = useState(false);
  const [assign, setAssign] = useState<VehicleRow | null>(null);
  const [edit, setEdit] = useState<{ row: VehicleRow; name: string; plate: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const first = useRef(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getVehiclesPage({ q, tab, page, sort: sort.key, dir: sort.dir });
      if (res.success) setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tab, page, sort]);

  const refreshAll = async () => {
    const [, techRes] = await Promise.all([load(), getTechniciansForAssign()]);
    if (techRes.success) setTechs(techRes.data);
  };

  const toggleSort = (key: SortKey) => {
    setPage(1);
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  const rows = data?.rows ?? [];
  const counts = data?.counts ?? { all: 0, assigned: 0, free: 0, inactive: 0, unmarked: 0 };
  const total = data?.total ?? 0;
  const perPage = data?.perPage ?? 25;
  const current = data?.page ?? 1;
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  const doAssign = async (roworder: number, vehicleId: string | null) => {
    setSaving(true);
    try {
      const res: any = await assignVehicle(roworder, vehicleId);
      if (!res?.success) {
        alert(res?.message || t("vehicles.saveFailed", "ບັນທຶກບໍ່ສຳເລັດ"));
        return;
      }
      setAssign(null);
      await refreshAll();
    } finally {
      setSaving(false);
    }
  };

  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: "all", label: t("vehicles.tabTech", "ລົດຊ່າງ"), count: counts.all },
    { value: "assigned", label: t("vehicles.tabAssigned", "ມີຊ່າງນຳໃຊ້"), count: counts.assigned },
    { value: "free", label: t("vehicles.tabFree", "ວ່າງ"), count: counts.free },
    { value: "inactive", label: t("vehicles.tabInactive", "ປິດໃຊ້ງານ"), count: counts.inactive },
    // The rest of the company register — where vehicles get marked in.
    { value: "unmarked", label: t("vehicles.tabUnmarked", "ຍັງບໍ່ໄດ້ໝາຍ"), count: counts.unmarked },
  ];

  /** Correct the vehicle's name / plate in the register itself. */
  const saveEdit = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      const res: any = await updateVehicleInfo(edit.row.vehicle_id, { name: edit.name, plate_no: edit.plate });
      if (!res?.success) {
        alert(res?.message || t("vehicles.saveFailed", "ບັນທຶກບໍ່ສຳເລັດ"));
        return;
      }
      setEdit(null);
      await refreshAll();
    } finally {
      setSaving(false);
    }
  };

  /** Mark a register vehicle as a craftsman vehicle, or take the mark off. */
  const mark = async (v: VehicleRow, isTech: boolean) => {
    setSaving(true);
    try {
      const res: any = await setTechVehicles([v.key], isTech);
      if (!res?.success) {
        alert(res?.message || t("vehicles.saveFailed", "ບັນທຶກບໍ່ສຳເລັດ"));
        return;
      }
      await refreshAll();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page max="max-w-none w-full">
      <PageHeader
        title={t("vehicles.title", "ລົດຊ່າງ")}
        subtitle={`${t("vehicles.subtitle", "ລົດທີ່ໝາຍໄວ້ໃຫ້ທີມຊ່າງ · ມອບໝາຍໃຫ້ຊ່າງໄດ້ຈາກທີ່ນີ້")} · ${total} ${t("vehicles.unit", "ຄັນ")} · ${t("common.page", "ໜ້າ")} ${current}/${pageCount}`}
        actions={
          <Btn variant="outline" onClick={() => void refreshAll()} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("common.reload", "ໂຫຼດໃໝ່")}
          </Btn>
        }
      />

      {loadError && (
        <div className="mb-4 rounded-lg border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-4 py-3 text-[12.5px] font-bold text-[var(--warning)]">
          {loadError}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Car size={18} />} label={t("vehicles.statTech", "ລົດຊ່າງ")} value={counts.all} />
        <Stat
          icon={<UserPlus size={18} />}
          label={t("vehicles.tabAssigned", "ມີຊ່າງນຳໃຊ້")}
          value={counts.assigned}
          active={tab === "assigned"}
          onClick={() => {
            setTab("assigned");
            setPage(1);
          }}
        />
        <Stat
          icon={<UserMinus size={18} />}
          label={t("vehicles.tabFree", "ວ່າງ")}
          value={counts.free}
          active={tab === "free"}
          onClick={() => {
            setTab("free");
            setPage(1);
          }}
        />
        <Stat
          icon={<Plus size={18} />}
          label={t("vehicles.tabUnmarked", "ຍັງບໍ່ໄດ້ໝາຍ")}
          value={counts.unmarked}
          active={tab === "unmarked"}
          onClick={() => {
            setTab("unmarked");
            setPage(1);
          }}
        />
      </div>

      <Toolbar>
        <label className="flex h-9 min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3">
          <Search size={15} className="text-[var(--text-mute)]" />
          <input
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              setQ(draftQ);
              setPage(1);
            }}
            placeholder={t("vehicles.searchPlaceholder", "ຄົ້ນຫາ ທະບຽນ, ຊື່ລົດ, ຊື່ຊ່າງ...")}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
          />
        </label>
        <Btn
          variant="ink"
          onClick={() => {
            setQ(draftQ);
            setPage(1);
          }}
        >
          <Search size={14} /> {t("common.search", "ຄົ້ນຫາ")}
        </Btn>
      </Toolbar>

      <div className="mb-4 overflow-x-auto">
        <Segmented<Tab>
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
          }}
          options={tabs.map((x) => ({
            value: x.value,
            label: (
              <span className="flex items-center gap-1.5">
                {x.label}
                <span className="rounded-full bg-black/10 px-1.5 text-[10px] font-black dark:bg-white/15">{x.count}</span>
              </span>
            ),
          }))}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className={tblCls}>
            <thead>
              <tr>
                <RowBarTh />
                <SortTh
                  label={t("vehicles.colName", "ຊື່ລົດ")}
                  active={sort.key === "name"}
                  dir={sort.dir}
                  onClick={() => toggleSort("name")}
                />
                <SortTh
                  label={t("vehicles.colPlate", "ທະບຽນ")}
                  active={sort.key === "plate"}
                  dir={sort.dir}
                  onClick={() => toggleSort("plate")}
                  className="w-44"
                />
                <SortTh
                  label={t("vehicles.colModel", "ລຸ້ນ / ປະເພດ")}
                  active={sort.key === "car_model"}
                  dir={sort.dir}
                  onClick={() => toggleSort("car_model")}
                  className="w-40"
                />
                <SortTh
                  label={t("vehicles.colDriver", "ຊ່າງທີ່ນຳໃຊ້")}
                  active={sort.key === "drivers"}
                  dir={sort.dir}
                  onClick={() => toggleSort("drivers")}
                />
                <SortTh
                  label={t("vehicles.colLastSeen", "ລາຍງານລ່າສຸດ")}
                  active={sort.key === "last_seen_at"}
                  dir={sort.dir}
                  onClick={() => toggleSort("last_seen_at")}
                  className="w-40"
                />
                {canEdit && <th className={`${thCls} w-32 text-right`}>{t("common.actions", "ການດຳເນີນ")}</th>}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="px-4 py-12 text-center text-[var(--text-mute)]">
                    <Loader2 size={20} className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="px-4 py-12 text-center text-[12.5px] text-[var(--text-mute)]">
                    {q
                      ? t("vehicles.notFound", "ບໍ່ພົບລົດ")
                      : tab === "unmarked"
                        ? t("vehicles.allMarked", "ລົດໃນທະບຽນຖືກໝາຍໝົດແລ້ວ")
                        : t("vehicles.emptyTech", "ຍັງບໍ່ມີລົດຊ່າງ — ໄປແທັບ “ຍັງບໍ່ໄດ້ໝາຍ” ແລ້ວກົດ ໝາຍເຂົ້າ")}
                  </td>
                </tr>
              ) : (
                rows.map((v) => (
                  <tr
                    key={v.key}
                    onClick={() => data?.live && router.push(`/vehicles/${encodeURIComponent(v.key)}`)}
                    className={`${trHover} ${data?.live ? "cursor-pointer" : ""}`}
                  >
                    <RowBar tone={v.drivers.length ? "success" : !v.active ? "neutral" : "info"} />
                    {/* The name is what people call the vehicle; the plate and
                        IMEI identify it, so they sit underneath / beside it. */}
                    <td className={tdCls}>
                      <TwoLine
                        primary={v.name || t("vehicles.unnamed", "(ຍັງບໍ່ຕັ້ງຊື່)")}
                        secondary={v.device_model || undefined}
                      />
                    </td>
                    <td className={tdCls}>
                      <TwoLine
                        primary={<span className="font-mono">{v.plate || "-"}</span>}
                        secondary={v.imei ? `IMEI ${v.imei}` : undefined}
                      />
                    </td>
                    <td className={`${tdCls} text-[var(--text-soft)]`}>
                      {[v.car_model, v.category].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className={tdCls}>
                      {v.drivers.length === 0 ? (
                        <span className="text-[var(--text-mute)]">— {t("vehicles.noDriver", "ຍັງບໍ່ມອບໝາຍ")}</span>
                      ) : (
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {v.drivers.map((d) => (
                            <TwoLine key={d.roworder} primary={d.name || d.code} secondary={d.phone || d.code} />
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={tdCls}>
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1.5">
                          {data?.live && v.last_seen_at ? (
                            <Pill tone={seenTone(v.last_seen_at)}>{lastSeenLabel(v.last_seen_at)}</Pill>
                          ) : (
                            <span className="text-[var(--text-mute)]">—</span>
                          )}
                          {!v.active && <Pill tone="neutral">{t("vehicles.inactive", "ປິດໃຊ້ງານ")}</Pill>}
                        </span>
                        {v.engine_on && (
                          <span className="text-[10.5px] text-[var(--success)]">
                            {t("vehicles.engineOn", "ຕິດເຄື່ອງ")}
                            {v.speed_kmh != null ? ` · ${v.speed_kmh} km/h` : ""}
                          </span>
                        )}
                      </div>
                    </td>
                    {canEdit && (
                      <td className={`${tdCls} text-right`}>
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {tab === "unmarked" ? (
                            <Btn variant="go" disabled={saving} onClick={() => mark(v, true)}>
                              <Plus size={13} /> {t("vehicles.markIn", "ໝາຍເຂົ້າ")}
                            </Btn>
                          ) : (
                            <>
                              <Btn
                                variant="ghost"
                                title={t("vehicles.editInfo", "ແກ້ໄຂຊື່ / ທະບຽນ")}
                                onClick={() => setEdit({ row: v, name: v.name, plate: v.plate })}
                              >
                                <Pencil size={13} />
                              </Btn>
                              <Btn variant="outline" onClick={() => setAssign(v)}>
                                <UserPlus size={13} /> {t("vehicles.assign", "ມອບໝາຍ")}
                              </Btn>
                              {v.drivers.length === 0 && (
                                <Btn
                                  variant="ghost"
                                  disabled={saving}
                                  title={t("vehicles.removeHint", "ເອົາອອກຈາກລາຍການລົດຊ່າງ")}
                                  onClick={() => mark(v, false)}
                                >
                                  <X size={13} />
                                </Btn>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border-soft)] px-4 py-2.5">
            <span className="text-[11.5px] text-[var(--text-mute)]">
              {t("common.page", "ໜ້າ")} {current}/{pageCount}
            </span>
            <div className="flex gap-1.5">
              <Btn variant="outline" onClick={() => setPage(current - 1)} disabled={current <= 1 || loading}>
                <ChevronLeft size={14} /> {t("common.prev", "ກ່ອນ")}
              </Btn>
              <Btn variant="outline" onClick={() => setPage(current + 1)} disabled={current >= pageCount || loading}>
                {t("common.next", "ຖັດໄປ")} <ChevronRight size={14} />
              </Btn>
            </div>
          </div>
        )}
      </Card>

      <p className="mt-3 px-1 text-[11px] text-[var(--text-mute)]">
        {t("vehicles.footnoteGps", "ຂໍ້ມູນລົດ (ທະບຽນ · IMEI · ລຸ້ນ · ລາຍງານລ່າສຸດ) ມາຈາກລະບົບ Lao GPS Tracker ໂດຍກົງ — ໜ້ານີ້ໝາຍວ່າຄັນໃດເປັນລົດຊ່າງ ແລະ ມອບໝາຍໃຫ້ຊ່າງ")}
      </p>

      {/* Edit dialog — writes back to the vehicle register */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !saving && setEdit(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />
          <Card className="relative w-full max-w-md p-5">
            <div className="mb-4 flex items-start justify-between gap-3" onClick={(e) => e.stopPropagation()}>
              <div className="min-w-0">
                <h3 className="text-[15px] font-black text-[var(--text)]">{t("vehicles.editTitle", "ແກ້ໄຂຂໍ້ມູນລົດ")}</h3>
                <p className="mt-1 truncate text-[12px] text-[var(--text-mute)]">
                  {[edit.row.plate, edit.row.imei ? `IMEI ${edit.row.imei}` : ""].filter(Boolean).join(" · ") || `#${edit.row.vehicle_id}`}
                </p>
              </div>
              <button onClick={() => setEdit(null)} className="text-[var(--text-mute)] hover:text-[var(--text)]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
              <Field label={t("vehicles.colName", "ຊື່ລົດ")}>
                <input
                  className={inputCls}
                  value={edit.name}
                  autoFocus
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  placeholder={t("vehicles.namePlaceholder", "ເຊັ່ນ TOYOTA HILUX ທີມ A")}
                />
              </Field>
              <Field label={t("vehicles.colPlate", "ທະບຽນ")}>
                <input
                  className={`${inputCls} font-mono`}
                  value={edit.plate}
                  onChange={(e) => setEdit({ ...edit, plate: e.target.value })}
                  placeholder="ກຂ-1234"
                />
              </Field>
              <p className="text-[10.5px] text-[var(--text-mute)]">
                {t("vehicles.editNote", "ບັນທຶກລົງທະບຽນລົດໂດຍກົງ — ລະບົບຈັດການລົດຈະເຫັນການແກ້ໄຂນີ້ນຳ")}
              </p>

              <div className="flex gap-2 pt-1">
                <Btn variant="outline" className="flex-1" onClick={() => setEdit(null)} disabled={saving}>
                  {t("common.cancel", "ຍົກເລີກ")}
                </Btn>
                <Btn variant="go" className="flex-1" onClick={saveEdit} disabled={saving || !edit.plate.trim()}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {t("common.save", "ບັນທຶກ")}
                </Btn>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Assign dialog */}
      {assign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !saving && setAssign(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />
          <Card className="relative w-full max-w-md p-5" >
            <div className="mb-4 flex items-start justify-between gap-3" onClick={(e) => e.stopPropagation()}>
              <div className="min-w-0">
                <h3 className="text-[15px] font-black text-[var(--text)]">{t("vehicles.assignTitle", "ມອບລົດໃຫ້ຊ່າງ")}</h3>
                <p className="mt-1 truncate font-mono text-[12px] text-[var(--text-mute)]">
                  {assign.name || t("vehicles.unnamed", "(ຍັງບໍ່ຕັ້ງຊື່)")} {assign.plate ? `· ${assign.plate}` : ""}
                </p>
              </div>
              <button onClick={() => setAssign(null)} className="text-[var(--text-mute)] hover:text-[var(--text)]">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[340px] space-y-1 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {techs.map((tech) => {
                const holdsThis = String(tech.vehicle_id || "") === assign.key;
                const holdsOther = !!tech.vehicle_id && !holdsThis;
                return (
                  <div
                    key={tech.roworder}
                    className="flex items-center gap-2 rounded-lg border border-[var(--border-soft)] px-3 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-bold text-[var(--text)]">{tech.name || tech.code}</span>
                      {holdsOther && (
                        <span className="block truncate text-[10.5px] text-[var(--warning)]">
                          {t("vehicles.currentlyHas", "ຖືລົດ")} {tech.vehicle_plate}
                        </span>
                      )}
                    </span>
                    {holdsThis ? (
                      <Btn variant="danger-outline" disabled={saving} onClick={() => doAssign(tech.roworder, null)}>
                        <UserMinus size={13} /> {t("vehicles.unassign", "ຖອນຄືນ")}
                      </Btn>
                    ) : (
                      <Btn variant="outline" disabled={saving} onClick={() => doAssign(tech.roworder, assign.key)}>
                        <UserPlus size={13} /> {t("vehicles.give", "ມອບ")}
                      </Btn>
                    )}
                  </div>
                );
              })}
              {techs.length === 0 && (
                <p className="py-8 text-center text-[12px] text-[var(--text-mute)]">{t("vehicles.noTechs", "ຍັງບໍ່ມີຊ່າງ")}</p>
              )}
            </div>
          </Card>
        </div>
      )}
    </Page>
  );
}
