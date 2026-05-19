"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  ArrowLeft,
  Building2,
  Calendar,
  ClipboardList,
  Edit3,
  FileText,
  Hash,
  Loader2,
  PackageCheck,
  Plus,
  Save,
  Trash2,
  User,
  X,
} from "lucide-react";
import { usePageHeader } from "@/_components/PageHeader";

type ContractItem = {
  item_code?: string;
  item_name?: string;
  description?: string;
  qty?: number | string;
  quantity?: number | string;
  unit?: string;
  price?: number | string;
  unit_price?: number | string;
  amount?: number | string;
  total?: number | string;
};

type Contract = {
  id: number | string;
  contract_no?: string;
  quotation_id?: number | string | null;
  project_id?: string | null;
  project_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  sign_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  payment_terms?: string | null;
  subtotal?: number | string | null;
  discount?: number | string | null;
  tax?: number | string | null;
  total_amount?: number | string | null;
  status?: string | null;
  notes?: string | null;
  items?: ContractItem[] | string | null;
};

const money = (v: unknown) =>
  Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

const fmtDate = (v?: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const dateInput = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  return d.toISOString().slice(0, 10);
};

const parseItems = (items: Contract["items"]): ContractItem[] => {
  if (Array.isArray(items)) return items;
  if (typeof items !== "string" || !items.trim()) return [];
  try {
    const parsed = JSON.parse(items);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export default function ContractDetail() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Contract | null>(null);
  const [editItems, setEditItems] = useState<ContractItem[]>([]);

  const items = useMemo(() => parseItems(contract?.items), [contract?.items]);
  const editTotal = useMemo(
    () =>
      editItems.reduce((sum, item) => {
        const qty = Number(item.qty ?? item.quantity ?? 1) || 0;
        const price = Number(item.price ?? item.unit_price ?? 0) || 0;
        const amount = Number(item.amount ?? item.total);
        return sum + (Number.isFinite(amount) && amount > 0 ? amount : qty * price);
      }, 0),
    [editItems],
  );

  usePageHeader({
    title: contract?.contract_no ? `Contract ${contract.contract_no}` : "Contract",
    subtitle: contract?.project_name || "ລາຍລະອຽດສັນຍາ",
    secondaryActions: [
      {
        label: "ກັບຄືນ",
        icon: <ArrowLeft size={13} />,
        onClick: () => router.back(),
      },
      ...(contract && !editMode
        ? [
            {
              label: "ແກ້ໄຂ",
              icon: <Edit3 size={13} />,
              onClick: () => startEdit(),
            },
          ]
        : []),
    ],
  });

  const startEdit = () => {
    if (!contract) return;
    setForm({ ...contract });
    setEditItems(parseItems(contract.items));
    setEditMode(true);
  };

  const cancelEdit = () => {
    setForm(null);
    setEditItems([]);
    setEditMode(false);
  };

  const updateForm = (key: keyof Contract, value: string) => {
    setForm((cur) => (cur ? { ...cur, [key]: value } : cur));
  };

  const updateItem = (index: number, key: keyof ContractItem, value: string) => {
    setEditItems((cur) =>
      cur.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  };

  const saveContract = async () => {
    if (!contract || !form) return;
    try {
      setSaving(true);
      const total = editTotal;
      const res = await fetch(`/api/contracts/${contract.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...contract,
          ...form,
          subtotal: total,
          total_amount: total,
          items: editItems,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Save failed");
      const next = payload?.data || payload;
      setContract(next);
      setEditMode(false);
      setForm(null);
      setEditItems([]);
      Swal.fire({ icon: "success", title: "ບັນທຶກແລ້ວ", timer: 1100, showConfirmButton: false });
    } catch (e: any) {
      Swal.fire("ຜິດພາດ", e?.message || "ບັນທຶກບໍ່ສຳເລັດ", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteContract = async () => {
    if (!contract) return;
    const confirm = await Swal.fire({
      icon: "warning",
      title: "ລົບສັນຍາ?",
      text: contract.contract_no || `#${contract.id}`,
      showCancelButton: true,
      confirmButtonText: "ລົບ",
      cancelButtonText: "ຍົກເລີກ",
      confirmButtonColor: "#ef4444",
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/contracts/${contract.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      Swal.fire({ icon: "success", title: "ລົບແລ້ວ", timer: 1000, showConfirmButton: false });
      router.push(contract.quotation_id ? `/sale-admin/quotation/${contract.quotation_id}` : "/sale-admin/listproject");
    } catch {
      Swal.fire("ຜິດພາດ", "ລົບບໍ່ສຳເລັດ", "error");
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/contracts/${id}`);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.message || "Contract not found");
        if (alive) setContract(payload?.data || payload);
      } catch (e: any) {
        if (alive) setError(e?.message || "ໂຫຼດສັນຍາບໍ່ສຳເລັດ");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ກຳລັງໂຫຼດສັນຍາ...
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error || "ບໍ່ພົບສັນຍາ"}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="rounded-md border border-[var(--theme-border-subtle)] bg-white">
        <div className="border-b border-[var(--theme-border-subtle)] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--theme-primary)]">
                <ClipboardList className="h-4 w-4" />
                ສັນຍາ
              </div>
              <h1 className="mt-1 text-xl font-semibold text-slate-900">
                {contract.contract_no || `#${contract.id}`}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                <button
                  type="button"
                  onClick={() => router.push(`/sale-admin/listproject?projectId=${encodeURIComponent(String(contract.project_id || ""))}`)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(113,75,103,0.18)] bg-[var(--theme-primary-tint)] px-2 py-1 font-semibold text-[var(--theme-primary)] hover:bg-white"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {contract.project_name || `Project #${contract.project_id || "-"}`}
                </button>
                <span className="text-[var(--theme-text-mute)]">/</span>
                <button
                  type="button"
                  onClick={() => contract.quotation_id ? router.push(`/sale-admin/quotation/${contract.quotation_id}`) : router.push("/sale-admin/quotations")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-700 hover:bg-white"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {contract.quotation_id ? `Quotation #${contract.quotation_id}` : "Quotation"}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-fit rounded-full border border-[rgba(113,75,103,0.22)] bg-[var(--theme-primary-tint)] px-3 py-1 text-[12px] font-semibold text-[var(--theme-primary)]">
                {editMode ? form?.status || "draft" : contract.status || "draft"}
              </span>
              {editMode ? (
                <>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={saving}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--theme-border-subtle)] bg-white px-2.5 text-[12px] font-semibold text-slate-600 hover:bg-[var(--theme-bg-muted)] disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    ຍົກເລີກ
                  </button>
                  <button
                    type="button"
                    onClick={saveContract}
                    disabled={saving}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--theme-accent)] px-2.5 text-[12px] font-semibold text-white hover:bg-[var(--theme-accent-strong)] disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    ບັນທຶກ
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={startEdit}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--theme-border-subtle)] bg-white px-2.5 text-[12px] font-semibold text-slate-700 hover:bg-[var(--theme-bg-muted)]"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    ແກ້ໄຂ
                  </button>
                  <button
                    type="button"
                    onClick={deleteContract}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 text-[12px] font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    ລົບ
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-[var(--theme-border-subtle)] bg-[#fbfbfb] px-4 py-3">
          <div className="grid gap-3 md:grid-cols-3">
            <ReferenceCard
              icon={<Building2 className="h-4 w-4" />}
              label="ອ້າງອີງໂຄງການ"
              title={contract.project_name || "-"}
              meta={contract.project_id ? `Project ID: ${contract.project_id}` : "Project ID: -"}
              onClick={() => router.push(`/sale-admin/listproject?projectId=${encodeURIComponent(String(contract.project_id || ""))}`)}
            />
            <ReferenceCard
              icon={<FileText className="h-4 w-4" />}
              label="ອ້າງອີງໃບສະເໜີລາຄາ"
              title={contract.quotation_id ? `Quotation #${contract.quotation_id}` : "-"}
              meta="1 ໃບສະເໜີລາຄາ = 1 ສັນຍາ"
              onClick={() => contract.quotation_id ? router.push(`/sale-admin/quotation/${contract.quotation_id}`) : router.push("/sale-admin/quotations")}
            />
            <ReferenceCard
              icon={<ClipboardList className="h-4 w-4" />}
              label="ສັນຍາ"
              title={contract.contract_no || `#${contract.id}`}
              meta={`Status: ${contract.status || "draft"}`}
            />
          </div>
        </div>

        {editMode && form ? (
          <div className="grid gap-3 border-b border-[var(--theme-border-subtle)] p-4 md:grid-cols-4">
            <Field label="ເລກສັນຍາ" value={form.contract_no || ""} onChange={(v) => updateForm("contract_no", v)} />
            <Field label="ສະຖານະ" value={form.status || ""} onChange={(v) => updateForm("status", v)} />
            <Field label="ວັນທີເຊັນ" type="date" value={dateInput(form.sign_date)} onChange={(v) => updateForm("sign_date", v)} />
            <Field label="ລູກຄ້າ" value={form.customer_name || ""} onChange={(v) => updateForm("customer_name", v)} />
            <Field label="ວັນເລີ່ມ" type="date" value={dateInput(form.start_date)} onChange={(v) => updateForm("start_date", v)} />
            <Field label="ວັນສິ້ນສຸດ" type="date" value={dateInput(form.end_date)} onChange={(v) => updateForm("end_date", v)} />
            <Field label="ເງື່ອນໄຂຊຳລະ" value={form.payment_terms || ""} onChange={(v) => updateForm("payment_terms", v)} />
            <div className="rounded-md border border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-text-mute)]">Total</div>
              <div className="mt-1 text-[13px] font-bold text-slate-900">{money(editTotal)} ₭</div>
            </div>
            <label className="md:col-span-4">
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">ໝາຍເຫດ</span>
              <textarea
                value={form.notes || ""}
                onChange={(event) => updateForm("notes", event.target.value)}
                className="min-h-20 w-full rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 py-2 text-[12px] outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15"
              />
            </label>
          </div>
        ) : (
          <div className="grid gap-3 border-b border-[var(--theme-border-subtle)] p-4 md:grid-cols-4">
            <Info icon={<Hash className="h-4 w-4" />} label="Project ID" value={contract.project_id || "-"} />
            <Info icon={<User className="h-4 w-4" />} label="Customer" value={contract.customer_name || "-"} />
            <Info icon={<Calendar className="h-4 w-4" />} label="Sign date" value={fmtDate(contract.sign_date)} />
            <Info icon={<PackageCheck className="h-4 w-4" />} label="Total" value={`${money(contract.total_amount)} ₭`} strong />
          </div>
        )}

        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">ລາຍການໃນສັນຍາ</h2>
            {editMode ? (
              <button
                type="button"
                onClick={() => setEditItems((cur) => [...cur, { item_name: "", qty: 1, price: 0, unit: "" }])}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--theme-border-subtle)] bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-[var(--theme-bg-muted)]"
              >
                <Plus className="h-3 w-3" />
                ເພີ່ມລາຍການ
              </button>
            ) : (
              <span className="text-[11px] text-[var(--theme-text-mute)]">{items.length} ລາຍການ</span>
            )}
          </div>
          <div className="overflow-hidden rounded-md border border-[var(--theme-border-subtle)]">
            <table className="min-w-full text-[12px]">
              <thead className="bg-[var(--theme-bg-muted)] text-[10px] uppercase tracking-wide text-[var(--theme-text-mute)]">
                <tr>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  {editMode && <th className="w-10 px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {editMode ? (
                  editItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-[var(--theme-text-mute)]">
                        ບໍ່ມີລາຍການ
                      </td>
                    </tr>
                  ) : (
                    editItems.map((item, index) => {
                      const qty = item.qty ?? item.quantity ?? "";
                      const price = item.price ?? item.unit_price ?? "";
                      const amount = Number(qty || 0) * Number(price || 0);
                      return (
                        <tr key={index} className="border-t border-[var(--theme-border-subtle)]">
                          <td className="px-3 py-2">
                            <input
                              value={item.item_name || item.description || ""}
                              onChange={(event) => updateItem(index, "item_name", event.target.value)}
                              className="w-full rounded border border-[var(--theme-border-subtle)] px-2 py-1 text-[12px] outline-none focus:border-[var(--theme-primary)]"
                              placeholder="Item name"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              value={qty}
                              onChange={(event) => updateItem(index, "qty", event.target.value)}
                              className="w-24 rounded border border-[var(--theme-border-subtle)] px-2 py-1 text-right text-[12px] outline-none focus:border-[var(--theme-primary)]"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              value={price}
                              onChange={(event) => updateItem(index, "price", event.target.value)}
                              className="w-28 rounded border border-[var(--theme-border-subtle)] px-2 py-1 text-right text-[12px] outline-none focus:border-[var(--theme-primary)]"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">{money(amount)}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setEditItems((cur) => cur.filter((_, i) => i !== index))}
                              className="inline-flex h-7 w-7 items-center justify-center rounded border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-[var(--theme-text-mute)]">
                      ບໍ່ມີລາຍການ
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const qty = item.qty ?? item.quantity ?? 1;
                    const price = item.price ?? item.unit_price ?? 0;
                    const amount = item.amount ?? item.total ?? Number(qty || 0) * Number(price || 0);
                    return (
                      <tr key={index} className="border-t border-[var(--theme-border-subtle)]">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-800">
                            {item.item_name || item.description || item.item_code || `Item ${index + 1}`}
                          </div>
                          {item.item_code && <div className="text-[10px] text-[var(--theme-text-mute)]">{item.item_code}</div>}
                        </td>
                        <td className="px-3 py-2 text-right">{money(qty)} {item.unit || ""}</td>
                        <td className="px-3 py-2 text-right">{money(price)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{money(amount)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] px-4 py-3">
          <button
            type="button"
            onClick={() => router.push(`/sale-admin/listproject?projectId=${encodeURIComponent(String(contract.project_id || ""))}`)}
            className="mr-2 inline-flex items-center gap-2 rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-[var(--theme-bg-muted)]"
          >
            <Building2 className="h-4 w-4" />
            ເບິ່ງໂຄງການ
          </button>
          <button
            type="button"
            onClick={() => contract.quotation_id ? router.push(`/sale-admin/quotation/${contract.quotation_id}`) : router.push("/sale-admin/quotations")}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-[var(--theme-bg-muted)]"
          >
            <FileText className="h-4 w-4" />
            ເບິ່ງໃບສະເໜີລາຄາ
          </button>
        </div>
      </div>
    </div>
  );
}

function ReferenceCard({
  icon,
  label,
  title,
  meta,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  meta: string;
  onClick?: () => void;
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={[
        "min-w-0 rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 py-2 text-left",
        onClick ? "cursor-pointer hover:border-[var(--theme-primary-soft)] hover:bg-[var(--theme-primary-tint)]" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-text-mute)]">
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate text-[13px] font-semibold text-slate-800">{title}</div>
      <div className="mt-0.5 truncate text-[10px] text-slate-500">{meta}</div>
    </Component>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label>
      <span className="mb-1 block text-[11px] font-semibold text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-[var(--theme-border-subtle)] bg-white px-3 text-[12px] outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15"
      />
    </label>
  );
}

function Info({
  icon,
  label,
  value,
  strong = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-md border border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-text-mute)]">
        {icon}
        {label}
      </div>
      <div className={`mt-1 truncate text-[13px] ${strong ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>
        {value}
      </div>
    </div>
  );
}
