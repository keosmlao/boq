"use client";

/**
 * Shared project form for both CREATE and EDIT.
 * - create → createProjectAction → continue to quotation creation
 * - edit   → editProjectAction → back to the project pipeline
 */
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Loader2, Save, ImagePlus, X, MapPin, FolderKanban, Tags, Check, Search, ChevronDown } from "lucide-react";
import { createProjectAction, editProjectAction } from "@/_actions/projects";
import {
  getProvinces,
  getDistricts,
  getVillages,
  getBusinessTypes,
  getBusinessModels,
  getProjectTypes,
  getSaleStaffs,
} from "@/_actions/lookups";
import { getCustomer } from "@/_actions/customers";
import { Page, Card, Btn, Field, SectionHeader, inputCls } from "../_components/ui";
import CustomerPicker, { type PickedCustomer } from "../_components/CustomerPicker";

const MapPicker = dynamic(() => import("@/_components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center rounded-md border border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] text-[12px] text-[var(--theme-text-mute)]">
      ກຳລັງໂຫຼດແຜນທີ່...
    </div>
  ),
});

type Opt = { value: string; label: string };

const toOpts = (res: any): Opt[] => {
  const data = res?.success ? res.data || [] : Array.isArray(res) ? res : [];
  return data
    .map((x: any) => ({
      value: String(x.code ?? x.id ?? x.value ?? ""),
      label: String(x.name_1 ?? x.name ?? x.label ?? x.code ?? ""),
    }))
    .filter((o: Opt) => o.value);
};

const todayISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export type ProjectInitial = {
  projectName?: string;
  projectDescription?: string;
  coordinator?: string;
  coordinatorPhone?: string;
  registrationDate?: string;
  province?: string;
  district?: string;
  village?: string;
  businessType?: string;
  businessModel?: string;
  projectType?: string;
  saleStaffId?: string;
  imageUrl?: string;
  coord?: { lat: number; lng: number } | null;
  custCode?: string;
  custName?: string;
};

export default function ProjectForm({
  mode,
  projectId,
  initial,
  custCode,
  custName,
}: {
  mode: "create" | "edit";
  projectId?: string;
  initial?: ProjectInitial;
  custCode?: string;
  custName?: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    projectName: initial?.projectName ?? "",
    projectDescription: initial?.projectDescription ?? "",
    coordinator: initial?.coordinator ?? "",
    coordinatorPhone: initial?.coordinatorPhone ?? "",
    registrationDate: initial?.registrationDate || todayISO(),
    province: initial?.province ?? "",
    district: initial?.district ?? "",
    village: initial?.village ?? "",
    businessType: initial?.businessType ?? "",
    businessModel: initial?.businessModel ?? "",
    projectType: initial?.projectType ?? "",
    saleStaffId: initial?.saleStaffId ?? "",
  });

  const [customer, setCustomer] = useState<PickedCustomer | null>(
    custCode
      ? { code: custCode, name: custName || custCode }
      : initial?.custCode
        ? { code: initial.custCode, name: initial.custName || initial.custCode }
        : null,
  );
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(initial?.coord ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(initial?.imageUrl || "");

  const [provinces, setProvinces] = useState<Opt[]>([]);
  const [districts, setDistricts] = useState<Opt[]>([]);
  const [villages, setVillages] = useState<Opt[]>([]);
  const [bizTypes, setBizTypes] = useState<Opt[]>([]);
  const [bizModels, setBizModels] = useState<Opt[]>([]);
  const [projTypes, setProjTypes] = useState<Opt[]>([]);
  const [saleStaffs, setSaleStaffs] = useState<Opt[]>([]);
  const [fromCustomer, setFromCustomer] = useState(false); // location prefilled from the customer

  // Selecting a customer pulls their phone + site location into the project —
  // the job is at the customer's place, so we shouldn't re-type it. Customer
  // province/district/village use the same erp codes as the project selects.
  const applyCustomer = async (c: PickedCustomer | null) => {
    setCustomer(c);
    if (!c) { setFromCustomer(false); return; }
    // Location auto-fill only on create — never clobber a saved project's site.
    const fillLoc = mode === "create" && !!c.province;
    setForm((f) => ({
      ...f,
      coordinatorPhone: f.coordinatorPhone || c.phone || "",
      ...(fillLoc ? { province: c.province!, district: c.district || "", village: c.village || "" } : {}),
    }));
    if (fillLoc) {
      setDistricts(toOpts(await getDistricts(c.province!)));
      setVillages(c.district ? toOpts(await getVillages(c.province!, c.district)) : []);
      setFromCustomer(true);
    }
  };

  // Load base lookups + (in edit mode) the dependent lists for saved values.
  useEffect(() => {
    (async () => {
      const [p, b, s] = await Promise.all([getProvinces(), getBusinessTypes(), getSaleStaffs()]);
      setProvinces(toOpts(p));
      setBizTypes(toOpts(b));
      setSaleStaffs(toOpts(s));

      if (initial?.province) setDistricts(toOpts(await getDistricts(initial.province)));
      if (initial?.province && initial?.district)
        setVillages(toOpts(await getVillages(initial.province, initial.district)));
      if (initial?.businessType) {
        const [m, t] = await Promise.all([
          getBusinessModels(initial.businessType),
          getProjectTypes({ businessType: initial.businessType, businessModel: initial.businessModel }),
        ]);
        setBizModels(toOpts(m));
        setProjTypes(toOpts(t));
      }

      // Arrived from the customer page (?cust=): pull the full customer to
      // prefill contact + location so registration is one continuous step.
      if (mode === "create" && custCode) {
        const cu: any = await getCustomer(custCode);
        if (cu?.success) {
          await applyCustomer({
            code: cu.data.code, name: cu.data.name, phone: cu.data.phone,
            province: cu.data.province, district: cu.data.district, village: cu.data.village, address: cu.data.address,
          });
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onProvince = async (v: string) => {
    setForm((f) => ({ ...f, province: v, district: "", village: "" }));
    setDistricts([]);
    setVillages([]);
    if (v) setDistricts(toOpts(await getDistricts(v)));
  };
  const onDistrict = async (v: string) => {
    setForm((f) => ({ ...f, district: v, village: "" }));
    setVillages([]);
    if (v && form.province) setVillages(toOpts(await getVillages(form.province, v)));
  };
  const onBizType = async (v: string) => {
    setForm((f) => ({ ...f, businessType: v, businessModel: "", projectType: "" }));
    setBizModels([]);
    setProjTypes([]);
    if (v) {
      const [m, t] = await Promise.all([getBusinessModels(v), getProjectTypes({ businessType: v })]);
      setBizModels(toOpts(m));
      setProjTypes(toOpts(t));
    }
  };
  const onBizModel = async (v: string) => {
    setForm((f) => ({ ...f, businessModel: v, projectType: "" }));
    if (form.businessType)
      setProjTypes(toOpts(await getProjectTypes({ businessType: form.businessType, businessModel: v })));
  };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };
  const clearImage = () => {
    setImageFile(null);
    setImagePreview("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!customer) {
      setError("ກະລຸນາເລືອກ ຫຼື ສ້າງລູກຄ້າກ່ອນ");
      return;
    }
    if (!form.projectName || !form.province || !form.district || !form.village || !form.registrationDate) {
      setError("ກະລຸນາຕື່ມຊ່ອງທີ່ມີ * ໃຫ້ຄົບ (ຊື່ໂຄງການ, ແຂວງ, ເມືອງ, ບ້ານ, ວັນທີ)");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.set(k, v));
      if (coord) fd.set("projectCoord", `${coord.lat},${coord.lng}`);
      if (imageFile) fd.set("imageFiles", imageFile);
      // New projects start at pipeline stage 1 = "ລົງທະບຽນ".
      if (mode === "create") fd.set("status", "ລົງທະບຽນ");
      // Link to the selected customer (cust code -> project.sml_code).
      if (customer?.code) fd.set("smlCode", customer.code);

      const res: any =
        mode === "edit" && projectId
          ? await editProjectAction(projectId, fd)
          : await createProjectAction(fd);

      if (res?.success) {
        if (mode === "edit") {
          router.push(`/projects/${projectId}`);
        } else {
          // Continue the pipeline: register -> survey -> quotation.
          router.push(res.id ? `/projects/${res.id}/survey/new` : "/projects");
        }
      } else {
        setError(res?.message || "ບັນທຶກບໍ່ສຳເລັດ");
      }
    } catch (err: any) {
      setError(err?.message || "ເກີດຂໍ້ຜິດພາດ");
    } finally {
      setSaving(false);
    }
  };

  const backHref = mode === "edit" && projectId ? `/projects/${projectId}` : "/projects";

  return (
    <Page max="max-w-none">
      <button
        onClick={() => router.push(backHref)}
        className="mb-2 inline-flex items-center gap-1 text-[12px] text-[var(--theme-text-mute)] hover:text-[var(--theme-primary)]"
      >
        <ArrowLeft size={14} /> {mode === "edit" ? "ກັບໄປໂຄງການ" : "ກັບໄປລາຍການໂຄງການ"}
      </button>

      {/* Colourful hero */}
      <div className="mb-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-[var(--theme-primary)] to-blue-400 p-4 text-white shadow-[var(--theme-shadow)]">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
          <FolderKanban size={24} />
        </div>
        <div>
          <h1 className="text-[18px] font-bold leading-tight">
            {mode === "edit" ? "ແກ້ໄຂໂຄງການ" : "ລົງທະບຽນໂຄງການ"}
          </h1>
          <p className="text-[12px] text-white/85">
            {mode === "edit" ? "ແກ້ໄຂຂໍ້ມູນ ແລະ ສະຖານທີ່ໂຄງການ" : "ເລືອກລູກຄ້າ → ດຶງເບີໂທ/ສະຖານທີ່ມາໃຫ້ → ຕື່ມຊື່ໂຄງການ"}
          </p>
        </div>
      </div>

      <form onSubmit={submit}>
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="border-t-2 border-t-blue-400 p-4 lg:col-span-2">
            <SectionHeader icon={<FolderKanban size={15} />} title="ຂໍ້ມູນໂຄງການ" tone="blue" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="ລູກຄ້າ" required className="sm:col-span-2">
                <CustomerPicker value={customer} onChange={applyCustomer} />
                {customer?.address && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--theme-text-mute)]">
                    <MapPin size={11} /> {customer.address}
                  </p>
                )}
              </Field>
              <Field label="ຊື່ໂຄງການ" required className="sm:col-span-2">
                <input value={form.projectName} onChange={(e) => set("projectName", e.target.value)} className={inputCls} placeholder="ຊື່ໂຄງການ" />
              </Field>
              <Field label="ລາຍລະອຽດ" className="sm:col-span-2">
                <textarea value={form.projectDescription} onChange={(e) => set("projectDescription", e.target.value)} rows={2} className={`${inputCls} h-auto py-2`} placeholder="ລາຍລະອຽດໂຄງການ" />
              </Field>
              <Field label="ວັນທີລົງທະບຽນ" required>
                <input type="date" value={form.registrationDate} onChange={(e) => set("registrationDate", e.target.value)} className={inputCls} />
              </Field>
              <Field label="ຜູ້ປະສານ">
                <input value={form.coordinator} onChange={(e) => set("coordinator", e.target.value)} className={inputCls} placeholder="ຊື່ຜູ້ປະສານ" />
              </Field>
              <Field label="ເບີໂທ">
                <input value={form.coordinatorPhone} onChange={(e) => set("coordinatorPhone", e.target.value)} className={inputCls} placeholder="020..." />
              </Field>
            </div>
          </Card>

          <Card className="border-t-2 border-t-amber-400 p-4">
            <SectionHeader icon={<ImagePlus size={15} />} title="ຮູບພາບໂຄງການ" tone="amber" />
            {imagePreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="preview" onError={() => setImagePreview("")} className="h-44 w-full rounded-md object-cover ring-1 ring-[var(--theme-border-subtle)]" />
                <button type="button" onClick={clearImage} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)]/40 text-[var(--theme-text-mute)] transition hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]">
                <ImagePlus size={26} />
                <span className="text-[12px]">ກົດເພື່ອອັບໂຫຼດຮູບ</span>
                <input type="file" accept="image/*" className="hidden" onChange={onPickImage} />
              </label>
            )}
          </Card>

          <Card className="border-t-2 border-t-violet-400 p-4 lg:col-span-3">
            <SectionHeader icon={<Tags size={15} />} title="ການຈັດປະເພດ" tone="violet" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="ປະເພດທຸລະກິດ">
                <SearchableSelect value={form.businessType} onChange={onBizType} options={bizTypes} placeholder="ເລືອກປະເພດ" />
              </Field>
              <Field label="ຮູບແບບທຸລະກິດ">
                <SearchableSelect value={form.businessModel} onChange={onBizModel} options={bizModels} placeholder="ເລືອກຮູບແບບ" disabled={!form.businessType} />
              </Field>
              <Field label="ປະເພດໂຄງການ">
                <SearchableSelect value={form.projectType} onChange={(v) => set("projectType", v)} options={projTypes} placeholder="ເລືອກປະເພດໂຄງການ" disabled={!form.businessType} />
              </Field>
              <Field label="ພະນັກງານຂາຍ">
                <SearchableSelect value={form.saleStaffId} onChange={(v) => set("saleStaffId", v)} options={saleStaffs} placeholder="ເລືອກພະນັກງານ" />
              </Field>
            </div>
          </Card>

          <Card className="border-t-2 border-t-emerald-400 p-4 lg:col-span-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <SectionHeader icon={<MapPin size={15} />} title="ສະຖານທີ່ໂຄງການ" tone="emerald" className="mb-0" />
              {fromCustomer && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                  <Check size={11} /> ດຶງຈາກລູກຄ້າ — ປ່ຽນໄດ້
                </span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="ແຂວງ" required>
                <SearchableSelect value={form.province} onChange={onProvince} options={provinces} placeholder="ເລືອກແຂວງ" />
              </Field>
              <Field label="ເມືອງ" required>
                <SearchableSelect value={form.district} onChange={onDistrict} options={districts} placeholder="ເລືອກເມືອງ" disabled={!form.province} />
              </Field>
              <Field label="ບ້ານ" required>
                <SearchableSelect value={form.village} onChange={(v) => set("village", v)} options={villages} placeholder="ເລືອກບ້ານ" disabled={!form.district} />
              </Field>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--theme-text-soft)]">
                <MapPin size={13} /> ປັກໝຸດທີ່ຕັ້ງໂຄງການ (ກົດເທິງແຜນທີ່ ຫຼື ຄົ້ນຫາ)
              </div>
              <MapPicker value={coord} onChange={setCoord} height={300} />
              {coord && (
                <div className="mt-1 font-mono text-[10.5px] text-[var(--theme-text-mute)]">
                  {coord.lat.toFixed(6)}, {coord.lng.toFixed(6)}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Btn type="button" variant="outline" onClick={() => router.push(backHref)}>
            ຍົກເລີກ
          </Btn>
          <Btn type="submit" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "ກຳລັງບັນທຶກ..." : mode === "edit" ? "ບັນທຶກການແກ້ໄຂ" : "ບັນທຶກ ແລະ ໄປສຳຫຼວດ"}
          </Btn>
        </div>
      </form>
    </Page>
  );
}


/**
 * Type-to-search select for long option lists (e.g. ~400 sales staff) where a
 * native <select> is impractical to scroll. Filters the already-loaded options
 * client-side by label or code.
 */
function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? options.filter(
        (o) => o.label.toLowerCase().includes(needle) || o.value.toLowerCase().includes(needle),
      )
    : options;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`${inputCls} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:bg-[var(--theme-bg-muted)] disabled:opacity-60`}
      >
        <span className={`truncate ${selected ? "" : "text-slate-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={15} className="shrink-0 text-slate-400" />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border border-[var(--theme-border-subtle)] bg-white shadow-[var(--theme-shadow-lg)]">
          <div className="border-b border-[var(--theme-border-subtle)] p-2">
            <div className="flex h-8 items-center gap-2 rounded-md border border-[var(--theme-border-subtle)] px-2">
              <Search size={13} className="text-[var(--theme-text-mute)]" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ຄົ້ນຫາຊື່ / ລະຫັດ..."
                className="h-full w-full bg-transparent text-[13px] outline-none"
              />
              {q && (
                <button type="button" onClick={() => setQ("")} className="text-[var(--theme-text-mute)] hover:text-rose-600">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-center text-[12px] text-[var(--theme-text-mute)]">ບໍ່ພົບ</div>
            ) : (
              filtered.map((o) => (
                <button
                  type="button"
                  key={o.value}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQ("");
                  }}
                  className={`flex w-full items-center justify-between gap-2 border-b border-[var(--theme-border-subtle)] px-3 py-2 text-left text-[12.5px] last:border-0 hover:bg-[var(--theme-bg-muted)] ${
                    o.value === value
                      ? "bg-[var(--theme-primary-tint)] font-medium text-[var(--theme-primary)]"
                      : "text-[var(--theme-text)]"
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {o.value === value && <Check size={14} className="shrink-0 text-[var(--theme-primary)]" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
