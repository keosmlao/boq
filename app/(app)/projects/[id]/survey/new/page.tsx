"use client";

/**
 * v2 — Site survey (stage 2, ສຳຫຼວດ). Captures measurements, install points +
 * rough materials, site checklist, and photos. Saves to odg_survey, then
 * continues to quotation. Optional — user may skip straight to the quote.
 *
 * Doubles as the EDIT form via `?edit=<survey id>` (same pattern as the
 * quotation / BOQ / request forms): prefill the survey, update instead of
 * create, same redirect back to the project.
 */
import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Save, ClipboardCheck, Plus, Trash2, ImagePlus, X, ListChecks, FileText } from "lucide-react";
import { getProjectBasic, advanceProjectStage } from "@/_actions/projects";
import { createSurvey, getSurvey, updateSurvey } from "@/_actions/survey";
import { Page, Card, Btn, Field, SectionHeader, inputCls, tblCls, thCls, tdCls } from "../../../../_components/ui";
import RSelect from "../../../../_components/RSelect";
import { useT } from "@/_lib/i18n";

const todayISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

type Meas = { label: string; value: string; unit: string };
type Mat = { item: string; qty: string; unit: string };
/** A new upload (file + preview url) or an already-saved photo (url only). */
type Photo = { file?: File; url: string };

export default function SurveyPage() {
  const t = useT();
  const { id } = useParams();
  const router = useRouter();
  const editId = useSearchParams().get("edit");

  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [surveyDate, setSurveyDate] = useState(todayISO());
  const [surveyor, setSurveyor] = useState("");
  const [condition, setCondition] = useState("");
  const [findings, setFindings] = useState("");

  const [meas, setMeas] = useState<Meas[]>([
    { label: t("surveyNew.measArea", "ພື້ນທີ່"), value: "", unit: "m²" },
    { label: t("surveyNew.measCeilingHeight", "ຄວາມສູງເພດານ"), value: "", unit: "m" },
  ]);
  const [installPoints, setInstallPoints] = useState("");
  const [mats, setMats] = useState<Mat[]>([{ item: "", qty: "", unit: "" }]);
  const [check, setCheck] = useState({ power: "", wallType: "", access: "", obstacles: "" });
  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res: any = await getProjectBasic(String(id));
        const p = res?.success ? res.data : null;
        if (alive && p) setProjectName(p.project_name || "");

        // Edit mode: prefill from the existing survey.
        if (editId) {
          const sRes: any = await getSurvey(String(editId));
          if (!alive) return;
          if (!sRes?.success) {
            setError(sRes?.message || t("surveyNew.notFound", "ບໍ່ພົບການສຳຫຼວດ"));
            return;
          }
          const s = sRes.data || {};
          const d = (s.data && typeof s.data === "object" ? s.data : {}) as any;
          setSurveyDate(String(s.survey_date ?? "").slice(0, 10) || todayISO());
          setSurveyor(String(s.surveyor ?? ""));
          setFindings(String(s.findings ?? ""));
          setCondition(String(d.condition ?? ""));
          const meas0 = Array.isArray(d.measurements) ? d.measurements : [];
          if (meas0.length) setMeas(meas0.map((m: any) => ({ label: String(m.label ?? ""), value: String(m.value ?? ""), unit: String(m.unit ?? "") })));
          setInstallPoints(d.installPoints ? String(d.installPoints) : "");
          const mats0 = Array.isArray(d.materials) ? d.materials : [];
          if (mats0.length) setMats(mats0.map((m: any) => ({ item: String(m.item ?? ""), qty: m.qty != null ? String(m.qty) : "", unit: String(m.unit ?? "") })));
          const c = (d.checklist && typeof d.checklist === "object" ? d.checklist : {}) as any;
          setCheck({ power: String(c.power ?? ""), wallType: String(c.wallType ?? ""), access: String(c.access ?? ""), obstacles: String(c.obstacles ?? "") });
          setPhotos((Array.isArray(d.photos) ? d.photos : []).map((u: any) => ({ url: String(u) })));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, editId]);

  const toProject = () => router.push(`/projects/${id}?tab=survey`);

  // dynamic list helpers
  const setMeasAt = (i: number, patch: Partial<Meas>) => setMeas((a) => a.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const setMatAt = (i: number, patch: Partial<Mat>) => setMats((a) => a.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const onPickPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos((p) => [...p, ...files.map((f) => ({ file: f, url: URL.createObjectURL(f) }))]);
    e.target.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const data = {
        condition,
        measurements: meas.filter((m) => m.label.trim() && m.value.trim()),
        installPoints: Number(installPoints) || 0,
        materials: mats
          .filter((m) => m.item.trim())
          .map((m) => ({ item: m.item, qty: Number(m.qty) || 0, unit: m.unit })),
        checklist: check,
        // Photos already saved that the user kept (new uploads are appended server-side).
        photos: photos.filter((p) => !p.file).map((p) => p.url),
      };
      const fd = new FormData();
      fd.set("project_id", String(id));
      if (editId) fd.set("id", String(editId));
      fd.set("survey_date", surveyDate);
      fd.set("surveyor", surveyor);
      fd.set("findings", findings);
      fd.set("data", JSON.stringify(data));
      photos.forEach((p) => { if (p.file) fd.append("photoFiles", p.file); });

      const res: any = editId ? await updateSurvey(fd) : await createSurvey(fd);
      if (res?.success) {
        // The survey row existing IS the stage — creating one advances it; an edit changes nothing.
        if (!editId) await advanceProjectStage(String(id), "ສຳຫຼວດ").catch(() => {});
        toProject();
      } else setError(res?.message || t("surveyNew.saveFailed", "ບັນທຶກບໍ່ສຳເລັດ"));
    } catch (err: any) {
      setError(err?.message || t("surveyNew.errorOccurred", "ເກີດຂໍ້ຜິດພາດ"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brand)]" />
        <span className="text-sm">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }

  return (
    <Page max="max-w-[1000px]">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => router.push(`/projects/${id}`)}
              className="mb-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--text-mute)] transition-colors hover:text-[var(--brand)]"
            >
              <ArrowLeft size={14} /> {t("surveyNew.toProject", "ໄປໂຄງການ")}
            </button>
            <h1 className="flex items-center gap-2.5 text-[19px] font-black leading-tight tracking-tight text-[var(--text)]">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--brand-soft)] bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                <ClipboardCheck size={16} />
              </span>
              {editId ? t("surveyNew.editTitle", "ແກ້ໄຂການສຳຫຼວດ") : t("surveyNew.title", "ສຳຫຼວດໜ້າງານ")}
            </h1>
            <p className="mt-1.5 text-[12px] text-[var(--text-mute)]">
              {projectName ? `${t("surveyNew.projectLabel", "ໂຄງການ")}: ${projectName}` : t("surveyNew.subtitle", "ວັດແທກ, ຖ່າຍຮູບ, ປະເມີນວັດສະດຸ")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Btn type="button" variant="outline" onClick={toProject}>{t("surveyNew.skipToProject", "ຂ້າມໄປໂຄງການ")}</Btn>
            <Btn type="submit" variant="go" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? t("common.saving", "ກຳລັງບັນທຶກ...") : t("surveyNew.saveAndGoProject", "ບັນທຶກ ແລະ ໄປໂຄງການ")}
            </Btn>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--danger)]">{error}</div>
        )}

        {/* Basic */}
        <Card className="p-4">
          <SectionHeader icon={<ClipboardCheck size={15} />} title={t("surveyNew.basicInfo", "ຂໍ້ມູນພື້ນຖານ")} tone="brand" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t("surveyNew.surveyDate", "ວັນທີສຳຫຼວດ")}>
              <input type="date" value={surveyDate} onChange={(e) => setSurveyDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label={t("surveyNew.surveyor", "ຜູ້ສຳຫຼວດ")}>
              <input value={surveyor} onChange={(e) => setSurveyor(e.target.value)} className={inputCls} placeholder={t("surveyNew.surveyorPlaceholder", "ຊື່ຜູ້ສຳຫຼວດ")} />
            </Field>
            <Field label={t("surveyNew.siteCondition", "ສະພາບໜ້າງານ")}>
              <input value={condition} onChange={(e) => setCondition(e.target.value)} className={inputCls} placeholder={t("surveyNew.conditionPlaceholder", "ພ້ອມຕິດຕັ້ງ / ຕ້ອງກຽມ...")} />
            </Field>
          </div>
        </Card>

        {/* Measurements */}
        <Card className="overflow-hidden">
          <SecBar title={t("surveyNew.measurements", "ການວັດແທກ")} onAdd={() => setMeas((a) => [...a, { label: "", value: "", unit: "" }])} t={t} />
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={thCls}>{t("surveyNew.item", "ລາຍການ")}</th>
                  <th className={`${thCls} w-32 text-right`}>{t("surveyNew.value", "ຄ່າ")}</th>
                  <th className={`${thCls} w-24`}>{t("common.unit", "ໜ່ວຍ")}</th>
                  <th className={`${thCls} w-10`} />
                </tr>
              </thead>
              <tbody>
                {meas.map((m, i) => (
                  <tr key={i}>
                    <td className={tdCls}><input value={m.label} onChange={(e) => setMeasAt(i, { label: e.target.value })} className={`${inputCls} h-8`} placeholder={t("surveyNew.measLabelPlaceholder", "ເຊັ່ນ: ໄລຍະທໍ່")} /></td>
                    <td className={tdCls}><input value={m.value} onChange={(e) => setMeasAt(i, { value: e.target.value })} className={`${inputCls} h-8 text-right`} placeholder="0" /></td>
                    <td className={tdCls}><input value={m.unit} onChange={(e) => setMeasAt(i, { unit: e.target.value })} className={`${inputCls} h-8`} placeholder="m" /></td>
                    <td className={tdCls}>{meas.length > 1 && <RemoveBtn onClick={() => setMeas((a) => a.filter((_, idx) => idx !== i))} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Install points + rough materials */}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
            <h2 className="text-[11px] font-black tracking-wider text-[var(--text)]">{t("surveyNew.installPointsAndMaterials", "ຈຸດຕິດຕັ້ງ ແລະ ວັດສະດຸເບື້ອງຕົ້ນ")}</h2>
            <Btn type="button" variant="outline" onClick={() => setMats((a) => [...a, { item: "", qty: "", unit: "" }])}>
              <Plus size={14} /> {t("surveyNew.addMaterial", "ເພີ່ມວັດສະດຸ")}
            </Btn>
          </div>
          <div className="px-4 py-3">
            <Field label={t("surveyNew.installPointCount", "ຈຳນວນຈຸດ/ເຄື່ອງທີ່ຕິດຕັ້ງ")} className="max-w-[220px]">
              <input type="number" min="0" value={installPoints} onChange={(e) => setInstallPoints(e.target.value)} className={inputCls} placeholder="0" />
            </Field>
          </div>
          <div className="overflow-x-auto">
            <table className={tblCls}>
              <thead>
                <tr>
                  <th className={thCls}>{t("surveyNew.materialEstimated", "ວັດສະດຸ (ຄາດຄະເນ)")}</th>
                  <th className={`${thCls} w-28 text-right`}>{t("common.qty", "ຈຳນວນ")}</th>
                  <th className={`${thCls} w-24`}>{t("common.unit", "ໜ່ວຍ")}</th>
                  <th className={`${thCls} w-10`} />
                </tr>
              </thead>
              <tbody>
                {mats.map((m, i) => (
                  <tr key={i}>
                    <td className={tdCls}><input value={m.item} onChange={(e) => setMatAt(i, { item: e.target.value })} className={`${inputCls} h-8`} placeholder={t("surveyNew.materialNamePlaceholder", "ຊື່ວັດສະດຸ")} /></td>
                    <td className={tdCls}><input type="number" min="0" value={m.qty} onChange={(e) => setMatAt(i, { qty: e.target.value })} className={`${inputCls} h-8 text-right`} placeholder="0" /></td>
                    <td className={tdCls}><input value={m.unit} onChange={(e) => setMatAt(i, { unit: e.target.value })} className={`${inputCls} h-8`} placeholder={t("surveyNew.unitPiece", "ອັນ")} /></td>
                    <td className={tdCls}>{mats.length > 1 && <RemoveBtn onClick={() => setMats((a) => a.filter((_, idx) => idx !== i))} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2.5 text-[11px] text-[var(--text-mute)]">{t("surveyNew.materialAutofillNote", "ວັດສະດຸນີ້ຈະຖືກດຶງໄປຕື່ມໃນໃບສະເໜີລາຄາໃຫ້ອັດຕະໂນມັດ.")}</p>
          </div>
        </Card>

        {/* Checklist */}
        <Card className="p-4">
          <SectionHeader icon={<ListChecks size={15} />} title={t("surveyNew.siteChecklist", "Checklist ໜ້າງານ")} tone="brand" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("surveyNew.powerReady", "ໄຟຟ້າພ້ອມບໍ?")}>
              <RSelect
                value={check.power}
                onChange={(v) => setCheck({ ...check, power: v })}
                isSearchable={false}
                isClearable
                placeholder={t("surveyNew.selectDash", "- ເລືອກ -")}
                options={[
                  { value: "ມີ", label: t("surveyNew.yes", "ມີ") },
                  { value: "ບໍ່ມີ", label: t("surveyNew.no", "ບໍ່ມີ") },
                ]}
              />
            </Field>
            <Field label={t("surveyNew.wallCeilingType", "ປະເພດຝາ/ເພດານ")}>
              <input value={check.wallType} onChange={(e) => setCheck({ ...check, wallType: e.target.value })} className={inputCls} placeholder={t("surveyNew.wallTypePlaceholder", "ກໍ່ອິດ / ໄມ້ / ...")} />
            </Field>
            <Field label={t("surveyNew.access", "ທາງເຂົ້າ/ການເຂົ້າເຖິງ")}>
              <input value={check.access} onChange={(e) => setCheck({ ...check, access: e.target.value })} className={inputCls} placeholder={t("surveyNew.accessPlaceholder", "ສະດວກ / ແຄບ ...")} />
            </Field>
            <Field label={t("surveyNew.obstacles", "ອຸປະສັກ")}>
              <input value={check.obstacles} onChange={(e) => setCheck({ ...check, obstacles: e.target.value })} className={inputCls} placeholder={t("surveyNew.obstaclesPlaceholder", "ມີ/ບໍ່ມີ ລາຍລະອຽດ")} />
            </Field>
          </div>
        </Card>

        {/* Photos */}
        <Card className="p-4">
          <SectionHeader icon={<ImagePlus size={15} />} title={t("surveyNew.sitePhotos", "ຮູບໜ້າງານ")} tone="brand" />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-20 w-full rounded-xl object-cover ring-1 ring-[var(--border)]" />
                <button type="button" onClick={() => setPhotos((a) => a.filter((_, idx) => idx !== i))} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white">
                  <X size={11} />
                </button>
              </div>
            ))}
            <label className="flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-sunken)] text-[var(--text-mute)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]">
              <ImagePlus size={20} />
              <span className="text-[10px] font-semibold">{t("surveyNew.addPhoto", "ເພີ່ມຮູບ")}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={onPickPhotos} />
            </label>
          </div>
        </Card>

        {/* Findings */}
        <Card className="p-4">
          <SectionHeader icon={<FileText size={15} />} title={t("surveyNew.findings", "ສິ່ງທີ່ພົບ / ໝາຍເຫດ")} tone="brand" />
          <textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={4} className={`${inputCls} h-auto py-2`} placeholder={t("surveyNew.findingsPlaceholder", "ລາຍລະອຽດ, ຂໍ້ສັງເກດ, ຄຳແນະນຳ...")} />
        </Card>
      </form>
    </Page>
  );
}

function SecBar({ title, onAdd, t }: { title: string; onAdd: () => void; t: ReturnType<typeof useT> }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
      <h2 className="text-[11px] font-black tracking-wider text-[var(--text)]">{title}</h2>
      <Btn type="button" variant="outline" onClick={onAdd}>
        <Plus size={14} /> {t("surveyNew.addRow", "ເພີ່ມແຖວ")}
      </Btn>
    </div>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-[var(--danger)] transition-opacity hover:opacity-70">
      <Trash2 size={15} />
    </button>
  );
}
