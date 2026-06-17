"use client";

/**
 * v2 — Site survey (stage 2, ສຳຫຼວດ). Captures measurements, install points +
 * rough materials, site checklist, and photos. Saves to odg_survey, then
 * continues to quotation. Optional — user may skip straight to the quote.
 */
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, ClipboardCheck, Plus, Trash2, ImagePlus, X } from "lucide-react";
import { getProjectBasic, advanceProjectStage } from "@/_actions/projects";
import { createSurvey } from "@/_actions/survey";
import { Page, Card, Btn, Field, inputCls, tblCls, thCls, tdCls } from "../../../../_components/ui";
import { useT } from "@/_lib/i18n";

const todayISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

type Meas = { label: string; value: string; unit: string };
type Mat = { item: string; qty: string; unit: string };
type Photo = { file: File; url: string };

export default function SurveyPage() {
  const t = useT();
  const { id } = useParams();
  const router = useRouter();

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
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

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
      };
      const fd = new FormData();
      fd.set("project_id", String(id));
      fd.set("survey_date", surveyDate);
      fd.set("surveyor", surveyor);
      fd.set("findings", findings);
      fd.set("data", JSON.stringify(data));
      photos.forEach((p) => fd.append("photoFiles", p.file));

      const res: any = await createSurvey(fd);
      if (res?.success) {
        await advanceProjectStage(String(id), "ສຳຫຼວດ").catch(() => {});
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
      <div className="flex h-[60vh] items-center justify-center gap-3 text-[var(--theme-text-mute)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--theme-border-subtle)] border-t-[var(--theme-primary)]" />
        <span className="text-sm">{t("common.loading", "ກຳລັງໂຫຼດ...")}</span>
      </div>
    );
  }

  return (
    <Page max="max-w-[1000px]">
      <button
        onClick={() => router.push(`/projects/${id}`)}
        className="mb-2 inline-flex items-center gap-1 text-[12px] text-[var(--theme-text-mute)] hover:text-[var(--theme-primary)]"
      >
        <ArrowLeft size={14} /> {t("surveyNew.toProject", "ໄປໂຄງການ")}
      </button>

      <div className="mb-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 p-4 text-white shadow-[var(--theme-shadow)]">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
          <ClipboardCheck size={24} />
        </div>
        <div>
          <h1 className="text-[18px] font-bold leading-tight">{t("surveyNew.title", "ສຳຫຼວດໜ້າງານ")}</h1>
          <p className="text-[12px] text-white/85">{projectName ? `${t("surveyNew.projectLabel", "ໂຄງການ")}: ${projectName}` : t("surveyNew.subtitle", "ວັດແທກ, ຖ່າຍຮູບ, ປະເມີນວັດສະດຸ")}</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>
        )}

        {/* Basic */}
        <Card className="p-4">
          <Sec>{t("surveyNew.basicInfo", "ຂໍ້ມູນພື້ນຖານ")}</Sec>
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
          <div className="flex items-center justify-between border-b border-[var(--theme-border-subtle)] px-3 py-2">
            <h2 className="text-[13px] font-bold text-[var(--theme-text)]">{t("surveyNew.installPointsAndMaterials", "ຈຸດຕິດຕັ້ງ ແລະ ວັດສະດຸເບື້ອງຕົ້ນ")}</h2>
            <Btn type="button" variant="outline" onClick={() => setMats((a) => [...a, { item: "", qty: "", unit: "" }])}>
              <Plus size={14} /> {t("surveyNew.addMaterial", "ເພີ່ມວັດສະດຸ")}
            </Btn>
          </div>
          <div className="px-3 py-2">
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
            <p className="px-3 py-2 text-[11px] text-[var(--theme-text-mute)]">{t("surveyNew.materialAutofillNote", "ວັດສະດຸນີ້ຈະຖືກດຶງໄປຕື່ມໃນໃບສະເໜີລາຄາໃຫ້ອັດຕະໂນມັດ.")}</p>
          </div>
        </Card>

        {/* Checklist */}
        <Card className="p-4">
          <Sec>{t("surveyNew.siteChecklist", "Checklist ໜ້າງານ")}</Sec>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("surveyNew.powerReady", "ໄຟຟ້າພ້ອມບໍ?")}>
              <select value={check.power} onChange={(e) => setCheck({ ...check, power: e.target.value })} className={inputCls}>
                <option value="">{t("surveyNew.selectDash", "- ເລືອກ -")}</option>
                <option value="ມີ">{t("surveyNew.yes", "ມີ")}</option>
                <option value="ບໍ່ມີ">{t("surveyNew.no", "ບໍ່ມີ")}</option>
              </select>
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
          <Sec>{t("surveyNew.sitePhotos", "ຮູບໜ້າງານ")}</Sec>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-20 w-full rounded-md object-cover ring-1 ring-[var(--theme-border-subtle)]" />
                <button type="button" onClick={() => setPhotos((a) => a.filter((_, idx) => idx !== i))} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white">
                  <X size={11} />
                </button>
              </div>
            ))}
            <label className="flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-[var(--theme-border-subtle)] text-[var(--theme-text-mute)] transition hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]">
              <ImagePlus size={20} />
              <span className="text-[10px]">{t("surveyNew.addPhoto", "ເພີ່ມຮູບ")}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={onPickPhotos} />
            </label>
          </div>
        </Card>

        {/* Findings */}
        <Card className="p-4">
          <Sec>{t("surveyNew.findings", "ສິ່ງທີ່ພົບ / ໝາຍເຫດ")}</Sec>
          <textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={4} className={`${inputCls} h-auto py-2`} placeholder={t("surveyNew.findingsPlaceholder", "ລາຍລະອຽດ, ຂໍ້ສັງເກດ, ຄຳແນະນຳ...")} />
        </Card>

        <div className="flex justify-end gap-2">
          <Btn type="button" variant="outline" onClick={toProject}>{t("surveyNew.skipToProject", "ຂ້າມໄປໂຄງການ")}</Btn>
          <Btn type="submit" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? t("common.saving", "ກຳລັງບັນທຶກ...") : t("surveyNew.saveAndGoProject", "ບັນທຶກ ແລະ ໄປໂຄງການ")}
          </Btn>
        </div>
      </form>
    </Page>
  );
}

function Sec({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="h-4 w-1 rounded bg-violet-500" />
      <h3 className="text-[13px] font-bold text-[var(--theme-text)]">{children}</h3>
    </div>
  );
}

function SecBar({ title, onAdd, t }: { title: string; onAdd: () => void; t: ReturnType<typeof useT> }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--theme-border-subtle)] px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="h-4 w-1 rounded bg-violet-500" />
        <h2 className="text-[13px] font-bold text-[var(--theme-text)]">{title}</h2>
      </div>
      <Btn type="button" variant="outline" onClick={onAdd}>
        <Plus size={14} /> {t("surveyNew.addRow", "ເພີ່ມແຖວ")}
      </Btn>
    </div>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-rose-500 hover:text-rose-700">
      <Trash2 size={15} />
    </button>
  );
}
