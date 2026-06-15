"use client";

/** v2 — Material request (ຂໍເບີກ). Request BOQ materials (within remaining). */
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Save, PackageOpen } from "lucide-react";
import { getProjectBasic } from "@/_actions/projects";
import { getCustomer } from "@/_actions/customers";
import { getProjectMaterials } from "@/_actions/boq-v2";
import { getWorkOrderById } from "@/_actions/workorder";
import { createRequest, updateRequest, getRequestDetail } from "@/_actions/request-v2";
import { Page, Card, Btn, inputCls, tblCls, thCls, tdCls } from "../../../../_components/ui";

type Row = { item_code: string; description: string; unit: string; remaining: number; qty: number };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function RequestPage() {
  const { id } = useParams();
  const router = useRouter();
  const sp = useSearchParams();
  const woParam = sp.get("wo");
  const editId = sp.get("edit");

  const [project, setProject] = useState<any>(null);
  const [custName, setCustName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [pRes, mRes]: any = await Promise.all([getProjectBasic(String(id)), getProjectMaterials(String(id))]);
        if (!alive) return;
        const p = pRes?.success ? pRes.data : null;
        setProject(p);

        // Prefill quantities from a work-order material template (?wo=).
        const tmap: Record<string, number> = {};
        if (woParam) {
          try {
            const woRes: any = await getWorkOrderById(String(woParam));
            if (alive && woRes?.success) {
              const wmats = Array.isArray(woRes.data?.materials) ? woRes.data.materials : [];
              for (const wm of wmats) tmap[String(wm.item_code || wm.description || "")] = num(wm.qty);
              if (woRes.data?.work_no) setNotes(`ສຳລັບໃບງານ ${woRes.data.work_no}`);
            }
          } catch {
            /* ignore */
          }
        }

        const mats = mRes?.success ? mRes.data || [] : [];

        if (editId) {
          // Edit mode: prefill from the existing request's items (qty editable, max = remaining + current qty).
          const remMap: Record<string, number> = {};
          for (const m of mats) remMap[String(m.item_code || m.description || "")] = num(m.remaining);
          try {
            const detRes: any = await getRequestDetail(String(editId));
            if (alive && detRes?.success) {
              const reqItems = Array.isArray(detRes.data?.items) ? detRes.data.items : [];
              setRows(
                reqItems.map((it: any) => {
                  const key = String(it.item_code || it.description || "");
                  const qty = num(it.qty);
                  return {
                    item_code: it.item_code || "",
                    description: it.description || it.item_name || "",
                    unit: it.unit || it.unit_code || "",
                    remaining: (remMap[key] ?? 0) + qty,
                    qty,
                  };
                }),
              );
              setNotes(detRes.data?.notes || "");
            }
          } catch {
            /* ignore */
          }
        } else {
          setRows(
            mats
              .filter((m: any) => num(m.remaining) > 0)
              .map((m: any) => {
                const tq = tmap[String(m.item_code || "")] ?? tmap[String(m.description || "")] ?? 0;
                return {
                  item_code: m.item_code || "",
                  description: m.description || "",
                  unit: m.unit || "",
                  remaining: num(m.remaining),
                  qty: Math.min(tq, num(m.remaining)),
                };
              }),
          );
        }
        if (p?.sml_code) {
          const cuRes: any = await getCustomer(String(p.sml_code));
          if (alive && cuRes?.success) setCustName(cuRes.data.name || "");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const totalReq = useMemo(() => rows.reduce((s, r) => s + num(r.qty), 0), [rows]);
  const setRow = (i: number, qty: number) =>
    setRows((a) => a.map((r, idx) => (idx === i ? { ...r, qty: Math.min(Math.max(qty, 0), r.remaining) } : r)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const items = rows.filter((r) => num(r.qty) > 0).map((r) => ({ item_code: r.item_code || null, description: r.description, unit: r.unit || null, qty: num(r.qty) }));
    if (!items.length) {
      setError("ກະລຸນາໃສ່ຈຳນວນທີ່ຕ້ອງເບີກ");
      return;
    }
    setSaving(true);
    try {
      let requester = "";
      try { requester = JSON.parse(localStorage.getItem("v2_user") || "{}").name || ""; } catch {}
      const res: any = editId
        ? await updateRequest(String(editId), { items, notes: notes || null })
        : await createRequest({ project_id: String(id), project_name: project?.project_name || null, items, notes: notes || null, requester });
      if (res?.success) router.push(editId ? `/v2/requests/${encodeURIComponent(String(editId))}` : `/v2/projects/${id}?tab=requests`);
      else setError(res?.message || "ບັນທຶກບໍ່ສຳເລັດ");
    } catch (err: any) {
      setError(err?.message || "ເກີດຂໍ້ຜິດພາດ");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--theme-text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
        <span className="text-sm">ກຳລັງໂຫຼດ...</span>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <Page max="max-w-[700px]">
        <Card className="border-t-2 border-t-pink-400 p-6 text-center">
          <p className="text-[13px] text-[var(--theme-text-soft)]">ບໍ່ມີວັດສະດຸທີ່ຄົງເຫຼືອໃຫ້ເບີກ (ຕ້ອງມີ BOQ ກ່ອນ ຫຼື ເບີກໝົດແລ້ວ).</p>
          <div className="mt-4 flex justify-center">
            <Btn onClick={() => router.push(`/v2/projects/${id}`)}>ກັບໄປໂຄງການ</Btn>
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page max="max-w-none">
      <form onSubmit={submit}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <button type="button" onClick={() => router.push(`/v2/projects/${id}`)} className="mb-1 inline-flex items-center gap-1 text-[12px] text-[var(--theme-text-mute)] hover:text-[var(--theme-primary)]">
              <ArrowLeft size={14} /> ໄປໂຄງການ
            </button>
            <h1 className="flex items-center gap-2 text-[19px] font-bold leading-tight text-[var(--theme-text)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 text-white">
                <PackageOpen size={16} />
              </span>
              {editId ? "ແກ້ໄຂໃບຂໍເບີກ" : "ຂໍເບີກວັດສະດຸ"}
            </h1>
            {(custName || project?.project_name) && (
              <p className="text-[12px] text-[var(--theme-text-mute)]">
                {custName && <span className="font-medium text-[var(--theme-text-soft)]">ລູກຄ້າ: {custName}</span>}
                {custName && project?.project_name && " · "}
                {project?.project_name && <>ໂຄງການ: {project.project_name}</>}
              </p>
            )}
          </div>
          <Btn type="submit" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "ກຳລັງບັນທຶກ..." : editId ? "ບັນທຶກການແກ້ໄຂ" : "ສົ່ງຂໍເບີກ"}
          </Btn>
        </div>

        {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>}

        <Card className="overflow-hidden border-t-2 border-t-pink-400">
          <div className="border-b border-[var(--theme-border-subtle)] px-3 py-2 text-[13px] font-bold text-[var(--theme-text)]">
            ລາຍການວັດສະດຸ (ຂໍເບີກ {totalReq})
          </div>
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={thCls}>ລາຍການ</th>
                  <th className={`${thCls} w-20`}>ໜ່ວຍ</th>
                  <th className={`${thCls} w-24 text-right`}>ຄົງເຫຼືອ</th>
                  <th className={`${thCls} w-32 text-right`}>ຂໍເບີກ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className={`${tdCls} font-medium text-[var(--theme-text)]`}>{r.description || r.item_code}</td>
                    <td className={tdCls}>{r.unit || "-"}</td>
                    <td className={`${tdCls} text-right tabular-nums text-[var(--theme-text-soft)]`}>{r.remaining.toLocaleString("en-US")}</td>
                    <td className={tdCls}>
                      <input type="number" min="0" max={r.remaining} value={r.qty} onChange={(e) => setRow(i, Number(e.target.value))} className={`${inputCls} h-8 text-right`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[var(--theme-border-subtle)] p-3">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} h-auto py-2`} placeholder="ໝາຍເຫດ" />
          </div>
        </Card>
      </form>
    </Page>
  );
}
