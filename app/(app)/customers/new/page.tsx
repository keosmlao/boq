"use client";

/** v2 — Create a new project customer (category default "ລູກຄ້າໂຄງການ"). */
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Save, UserPlus, User, MapPin } from "lucide-react";
import { createCustomer, getCustomer, updateCustomer } from "@/_actions/customers";
import { getProvinces, getDistricts, getVillages } from "@/_actions/lookups";
import { Page, Card, Btn, Field, SectionHeader, inputCls } from "../../_components/ui";

type Opt = { value: string; label: string };
const toOpts = (res: any): Opt[] => {
  const data = res?.success ? res.data || [] : Array.isArray(res) ? res : [];
  return data
    .map((x: any) => ({ value: String(x.code ?? ""), label: String(x.name_1 ?? x.name ?? x.code ?? "") }))
    .filter((o: Opt) => o.value);
};

const CUSTOMER_TYPES = ["ລູກຄ້າໂຄງການ", "ລູກຄ້າທົ່ວໄປ", "ຮ້ານຄ້າ"];

export default function NewCustomerPage() {
  const router = useRouter();
  const editCode = useSearchParams().get("edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    customerType: "ລູກຄ້າໂຄງການ",
    phone: "",
    address: "",
    province: "",
    district: "",
    village: "",
  });

  const [provinces, setProvinces] = useState<Opt[]>([]);
  const [districts, setDistricts] = useState<Opt[]>([]);
  const [villages, setVillages] = useState<Opt[]>([]);

  useEffect(() => {
    (async () => {
      const provs = toOpts(await getProvinces());
      setProvinces(provs);
      if (editCode) {
        const res: any = await getCustomer(editCode);
        if (res?.success) {
          const c = res.data;
          setForm({
            name: c.name || "",
            customerType: c.customer_type || "ລູກຄ້າໂຄງການ",
            phone: c.phone || "",
            address: c.address || "",
            province: c.province || "",
            district: c.district || "",
            village: c.village || "",
          });
          if (c.province) setDistricts(toOpts(await getDistricts(c.province)));
          if (c.province && c.district) setVillages(toOpts(await getVillages(c.province, c.district)));
        }
      }
    })();
  }, [editCode]);

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("ກະລຸນາໃສ່ຊື່ລູກຄ້າ");
      return;
    }
    setSaving(true);
    try {
      const res: any = editCode ? await updateCustomer(editCode, form) : await createCustomer(form);
      if (res?.success) router.push(editCode ? "/customers" : `/customers/${encodeURIComponent(res.data.code)}`);
      else setError(res?.message || "ບັນທຶກບໍ່ສຳເລັດ");
    } catch (err: any) {
      setError(err?.message || "ເກີດຂໍ້ຜິດພາດ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page max="max-w-none">
      <button
        onClick={() => router.push("/customers")}
        className="mb-2 inline-flex items-center gap-1 text-[12px] text-[var(--theme-text-mute)] hover:text-[var(--theme-primary)]"
      >
        <ArrowLeft size={14} /> ກັບໄປລາຍຊື່ລູກຄ້າ
      </button>

      {/* Colourful hero */}
      <div className="mb-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-[var(--theme-primary)] to-blue-500 p-4 text-white shadow-[var(--theme-shadow)]">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
          <UserPlus size={24} />
        </div>
        <div>
          <h1 className="text-[18px] font-bold leading-tight">{editCode ? "ແກ້ໄຂລູກຄ້າ" : "ສ້າງລູກຄ້າໃໝ່"}</h1>
          <p className="text-[12px] text-white/85">{editCode ? "ແກ້ໄຂຂໍ້ມູນລູກຄ້າ" : "ເພີ່ມລູກຄ້າໂຄງການ ເພື່ອເລີ່ມລົງທະບຽນໂຄງການ"}</p>
        </div>
      </div>

      <form onSubmit={submit}>
        {error && (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-t-2 border-t-blue-400 p-4">
          <SectionHeader icon={<User size={15} />} title="ຂໍ້ມູນລູກຄ້າ" tone="blue" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="ຊື່ລູກຄ້າ" required className="sm:col-span-2">
              <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} placeholder="ຊື່ລູກຄ້າ" />
            </Field>
            <Field label="ປະເພດລູກຄ້າ">
              <select value={form.customerType} onChange={(e) => set("customerType", e.target.value)} className={inputCls}>
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="ເບີໂທ">
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} placeholder="020..." />
            </Field>
          </div>
        </Card>

        <Card className="border-t-2 border-t-emerald-400 p-4">
          <SectionHeader icon={<MapPin size={15} />} title="ສະຖານທີ່" tone="emerald" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="ແຂວງ">
              <Select value={form.province} onChange={onProvince} options={provinces} placeholder="ເລືອກແຂວງ" />
            </Field>
            <Field label="ເມືອງ">
              <Select value={form.district} onChange={onDistrict} options={districts} placeholder="ເລືອກເມືອງ" disabled={!form.province} />
            </Field>
            <Field label="ບ້ານ">
              <Select value={form.village} onChange={(v) => set("village", v)} options={villages} placeholder="ເລືອກບ້ານ" disabled={!form.district} />
            </Field>
            <Field label="ທີ່ຢູ່ (ລະອຽດ)">
              <input value={form.address} onChange={(e) => set("address", e.target.value)} className={inputCls} placeholder="ບ້ານເລກທີ່, ໜ່ວຍ..." />
            </Field>
          </div>
        </Card>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Btn type="button" variant="outline" onClick={() => router.push("/customers")}>ຍົກເລີກ</Btn>
          <Btn type="submit" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກລູກຄ້າ"}
          </Btn>
        </div>
      </form>
    </Page>
  );
}

function Select({
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
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`${inputCls} disabled:cursor-not-allowed disabled:bg-[var(--theme-bg-muted)] disabled:opacity-60`}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
