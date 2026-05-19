"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createQuotation, updateQuotation } from "@/_actions/quotations";
import { updateProjectAction } from "@/_actions/projects";
import Select from "react-select";
import Swal from "sweetalert2";
import {
  ArrowLeft,
  Save,
  Send,
  Plus,
  Trash2,
  FilePlus,
  X,
  Search,
  ChevronDown,
  CheckCircle,
} from "lucide-react";

import FormSheet, { FieldGroup, Field } from "@/_components/odoo/FormSheet";
import StatusBar from "@/_components/odoo/StatusBar";
import Chatter from "@/_components/odoo/Chatter";
import { usePageHeader } from "@/_components/PageHeader";

/* ─── Pipeline stages (Odoo-style labels, backend uses Lao status string) ─── */
const STAGES = [
  { id: "ລໍຖ້າອະນຸມັດ", label: "Quotation" },
  { id: "ສົ່ງແລ້ວ", label: "Quotation Sent" },
  { id: "ອະນຸມັດແລ້ວ", label: "ເຊັນສັນຍາ" },
  { id: "ຖືກປະຕິເສດ", label: "Cancelled" },
] as const;

/* ─── Helpers ─── */
function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function _getJson(url: string) {
  const res = await fetch(url, { headers: _getAuthHeaders() });
  const payload = await res.json().catch(() => ({}));
  return payload;
}

/* ─── Odoo-style react-select theme ─── */
const selectStyles: any = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: "30px",
    height: "30px",
    fontSize: "12px",
    background: "#ffffff",
    border: state.isFocused
      ? "1px solid var(--theme-primary)"
      : "1px solid var(--theme-border)",
    borderRadius: "4px",
    boxShadow: "none",
    "&:hover": { borderColor: "var(--theme-primary)" },
  }),
  valueContainer: (base: any) => ({ ...base, padding: "0 6px" }),
  indicatorsContainer: (base: any) => ({ ...base, height: "30px" }),
  input: (base: any) => ({ ...base, margin: 0, padding: 0 }),
  placeholder: (base: any) => ({ ...base, color: "var(--theme-text-mute)" }),
  singleValue: (base: any) => ({ ...base, color: "var(--theme-text)" }),
  indicatorSeparator: () => ({ display: "none" }),
  menu: (base: any) => ({
    ...base,
    fontSize: "12px",
    border: "1px solid var(--theme-border)",
    borderRadius: "4px",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    zIndex: 9999,
  }),
  menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
  option: (base: any, state: any) => ({
    ...base,
    background: state.isSelected
      ? "var(--theme-primary)"
      : state.isFocused
      ? "var(--theme-primary-tint)"
      : "#ffffff",
    color: state.isSelected ? "#ffffff" : "var(--theme-text)",
    padding: "6px 10px",
  }),
};

/* ─── Reusable input class (Odoo-flat) ─── */
const inputClass =
  "w-full rounded border border-[var(--theme-border)] bg-white px-2 py-1 text-[12px] text-[var(--theme-text)] placeholder:text-[var(--theme-text-mute)] focus:border-[var(--theme-primary)] focus:outline-none";

/* ─── Currency formatter ─── */
const formatCurrency = (amount: any) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(Number(amount) || 0)
    .replace("THB", "ບາດ");

/* ─── Defaults ─── */
const getDefaultValidityDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().split("T")[0];
};

const newProductRow = () => ({
  type: "product" as "product" | "section" | "note",
  productId: "",
  productName: "",
  description: "",
  quantity: 1,
  unit: "",
  unit_price: 0,
  total: 0,
});

const newSectionRow = () => ({
  type: "section" as const,
  productId: "",
  productName: "",
  description: "Section",
  quantity: 0,
  unit: "",
  unit_price: 0,
  total: 0,
});

const newNoteRow = () => ({
  type: "note" as const,
  productId: "",
  productName: "",
  description: "Note",
  quantity: 0,
  unit: "",
  unit_price: 0,
  total: 0,
});

export default function CreateQuotation() {
  const router = useRouter();
  const { id } = useParams() as { id?: string };
  const searchParams = useSearchParams();
  const initialProjectId = searchParams?.get("projectId") || null;
  const isEditing = Boolean(id);

  /* ─── Form state (field names preserved exactly) ─── */
  const [formData, setFormData] = useState<any>({
    quotation_no: "",
    project_id: "",
    project_name: "",
    customer_name: "",
    customer_address: "",
    customer_phone: "",
    quotation_date: new Date().toISOString().split("T")[0],
    validity_date: getDefaultValidityDate(),
    terms: "",
    items: [newProductRow()],
    subtotal: 0,
    discount: 0,
    tax: 0,
    tax_type: "0",
    total_amount: 0,
    notes: "",
    status: "ລໍຖ້າອະນຸມັດ",
  });

  const [projects, setProjects] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ─── Product search (per-row inline dropdown) ─── */
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [searchCache, setSearchCache] = useState<Record<string, any[]>>({});
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  /* ─── Role-based approval (sale_manager / account_admin / service_manager) ─── */
  const [role, setRole] = useState<string>("");
  const canApprove =
    role === "sale_manager" || role === "account_admin" || role === "service_manager";
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      const r = typeof u.role === "string" && u.role.includes(",")
        ? u.role.split(",")[0].trim()
        : (u.role as string) || "";
      setRole(r);
    } catch { /* ignore */ }
  }, []);

  /* ─── Close inline dropdowns on outside-click / scroll / resize ─── */
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (openRow == null) return;
      const el = rowRefs.current[openRow];
      if (el && !el.contains(e.target as Node)) setOpenRow(null);
    };
    const onScrollOrResize = () => setOpenRow(null);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [openRow]);

  /* ─── Already-selected product IDs (filter in inline picker) ─── */
  const selectedProductIds = useMemo(
    () =>
      (formData.items || [])
        .map((it: any) => it.productId)
        .filter(Boolean),
    [formData.items],
  );

  /* ─── Load projects + (edit) existing quotation ─── */
  useEffect(() => {
    loadProjects();
    if (id) {
      loadQuotationData(id as string);
    } else {
      generateQuotationNumber();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ─── Prefill project from kanban drop (?projectId=...) ─── */
  useEffect(() => {
    if (id || !initialProjectId || projects.length === 0) return;
    const match = projects.find(
      (p: any) => String(p.value) === String(initialProjectId),
    );
    if (!match) return;
    setFormData((s: any) => ({
      ...s,
      project_id: match.value,
      project_name: match.project_name || s.project_name,
      customer_name: match.customer_name || s.customer_name,
      customer_phone: match.customer_phone || s.customer_phone,
      customer_address: match.customer_address || s.customer_address,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, initialProjectId, id]);

  /* ─── Recalculate totals on tax / discount change ─── */
  useEffect(() => {
    calculateTotals(formData.items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.tax_type, formData.discount]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const res = await _getJson("/api/projects");
      const options = (res?.data || []).map((p: any) => ({
        value: p.id,
        label: `${p.project_name} (${p.id})`,
        project_name: p.project_name,
        customer_name: p.coordinator,
        customer_phone: p.phone,
        customer_address: `${p.village_name || ""}, ${p.district_name || ""}, ${p.province_name || ""}`,
      }));
      setProjects(options);
    } catch (e) {
      Swal.fire({ icon: "error", title: "ຜິດພາດ", text: "ບໍ່ສາມາດໂຫຼດຂໍ້ມູນໂຄງການໄດ້" });
    } finally {
      setLoading(false);
    }
  };

  const loadQuotationData = async (quotationId: string) => {
    try {
      setLoading(true);
      const res = await _getJson(`/api/quotations/${quotationId}`);
      const q = res || {};
      const incomingItems: any[] = Array.isArray(q.items) ? q.items : [];
      const items = incomingItems.length
        ? incomingItems.map((it: any) => ({
            type: (it.type as any) || "product",
            productId: it.productId ?? "",
            productName: it.productName ?? "",
            description: it.description ?? "",
            quantity: Number(it.quantity ?? 0),
            unit: it.unit ?? "",
            unit_price: Number(it.unit_price ?? 0),
            total: Number(it.total ?? 0),
          }))
        : [newProductRow()];
      setFormData((s: any) => ({
        ...s,
        ...q,
        items,
        quotation_date: q.quotation_date
          ? new Date(q.quotation_date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        validity_date: q.validity_date
          ? new Date(q.validity_date).toISOString().split("T")[0]
          : "",
      }));
    } catch (e) {
      Swal.fire({ icon: "error", title: "ຜິດພາດ", text: "ບໍ່ສາມາດໂຫຼດຂໍ້ມູນໃບສະເໜີລາຄາໄດ້" });
    } finally {
      setLoading(false);
    }
  };

  const generateQuotationNumber = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    setFormData((s: any) => ({ ...s, quotation_no: `QT-${y}${m}${day}-${random}` }));
  };

  /* ─── Field handlers ─── */
  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((s: any) => ({ ...s, [name]: value }));
  };

  const handleProjectChange = (opt: any) => {
    setFormData((s: any) => ({
      ...s,
      project_id: opt?.value || "",
      project_name: opt?.project_name || (opt?.label?.split(" (")[0] ?? ""),
      customer_name: opt?.customer_name || "",
      customer_phone: opt?.customer_phone || "",
      customer_address: opt?.customer_address || "",
    }));
  };

  /* ─── Product search ─── */
  const fetchProducts = async (term: string) => {
    if (!term || term.length < 2) {
      setProducts([]);
      return;
    }
    setLoadingProducts(true);
    try {
      const res = await _getJson(`/api/inventory?search=${encodeURIComponent(term)}`);
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setProducts(list);
    } catch {
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const filterProducts = (currentCode = "") =>
    products.filter(
      (p: any) =>
        !selectedProductIds.includes(p.code) || p.code === currentCode,
    );

  const selectProduct = (index: number, product: any) => {
    const items = [...formData.items];
    const qty = Number(items[index].quantity) || 1;
    const price = parseFloat(product.unit_cost) || 0;
    // ic_inventory does not carry a unit-of-measure column, so we only fill
    // `unit` from the product when it really has a value; otherwise we keep
    // whatever the user already typed in the row (don't clobber their input).
    const productUnit = (product.unit ?? "").toString().trim();
    items[index] = {
      ...items[index],
      type: "product",
      productId: product.code,
      productName: product.name_1,
      description: product.name_1,
      unit: productUnit || items[index].unit || "",
      unit_price: price,
      quantity: qty,
      total: qty * price,
    };
    setFormData((s: any) => ({ ...s, items }));
    setOpenRow(null);
    calculateTotals(items);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const items = [...formData.items];
    items[index] = { ...items[index], [field]: value };
    if (field === "quantity" || field === "unit_price") {
      const q = field === "quantity" ? parseFloat(value) : parseFloat(items[index].quantity);
      const p = field === "unit_price" ? parseFloat(value) : parseFloat(items[index].unit_price);
      items[index].total = (Number.isFinite(q) ? q : 0) * (Number.isFinite(p) ? p : 0);
    }
    setFormData((s: any) => ({ ...s, items }));
    calculateTotals(items);
  };

  const addItem = () => {
    setFormData((s: any) => ({ ...s, items: [...s.items, newProductRow()] }));
  };
  const addSection = () => {
    setFormData((s: any) => ({ ...s, items: [...s.items, newSectionRow()] }));
  };
  const addNote = () => {
    setFormData((s: any) => ({ ...s, items: [...s.items, newNoteRow()] }));
  };

  const removeItem = (index: number) => {
    if (formData.items.length <= 1) return;
    const items = [...formData.items];
    items.splice(index, 1);
    setFormData((s: any) => ({ ...s, items }));
    if (openRow === index) setOpenRow(null);
    calculateTotals(items);
  };

  const calculateTotals = (items: any[]) => {
    const subtotal = items.reduce(
      (sum, it) => sum + (it.type === "product" ? Number(it.total) || 0 : 0),
      0,
    );
    const discount = parseFloat(formData.discount) || 0;
    let tax = 0;
    let total = 0;
    if (formData.tax_type === "external") {
      tax = (subtotal - discount) * 0.1;
      total = subtotal - discount + tax;
    } else if (formData.tax_type === "internal") {
      // VAT-included: tax extracted from net for display, total = net
      const net = subtotal - discount;
      tax = net - net / 1.1;
      total = net;
    } else {
      tax = 0;
      total = subtotal - discount;
    }
    setFormData((s: any) => ({
      ...s,
      subtotal,
      tax,
      total_amount: total,
    }));
  };

  /* ─── Submit ─── */
  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!formData.project_id) {
      Swal.fire({ icon: "warning", title: "ແຈ້ງເຕືອນ", text: "ກະລຸນາເລືອກໂຄງການ" });
      return;
    }
    if (!formData.quotation_date) {
      Swal.fire({ icon: "warning", title: "ແຈ້ງເຕືອນ", text: "ກະລຸນາໃສ່ວັນທີໃບສະເໜີລາຄາ" });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        quotation_date: formData.quotation_date,
        validity_date: formData.validity_date || null,
      };

      if (id) {
        await updateQuotation(String(id), payload);
        Swal.fire("ສຳເລັດ!", "ອັບເດດໃບສະເໜີລາຄາແລ້ວ", "success");
      } else {
        await createQuotation(payload);
        try {
          await updateProjectAction(String(formData.project_id), { project_status: "ສະເໜີລາຄາ" });
        } catch { /* ignore */ }
        Swal.fire("ສຳເລັດ!", "ສ້າງໃບສະເໜີລາຄາ ແລະ ປ່ຽນສະຖານະໂຄງການແລ້ວ", "success");
      }

      router.push("/sale-admin/quotations");
    } catch (e) {
      Swal.fire({
        icon: "error",
        title: "ຜິດພາດ",
        text: id ? "ບໍ່ສາມາດອັບເດດໃບສະເໜີລາຄາໄດ້" : "ບໍ່ສາມາດສ້າງໃບສະເໜີລາຄາໄດ້",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── Derived ─── */
  const activeStageIndex = useMemo(() => {
    const idx = STAGES.findIndex((s) => s.id === formData.status);
    return idx >= 0 ? idx : 0;
  }, [formData.status]);

  const selectedProject = useMemo(
    () =>
      projects.find(
        (p) => String(p.value) === String(formData.project_id),
      ) || null,
    [projects, formData.project_id],
  );

  /* ─── Page header (TopBar control panel) ─── */
  const fmtDateDisplay = (iso?: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-GB"); // dd/mm/yyyy
    } catch {
      return iso;
    }
  };

  /* ─── Approve / Reject quotation (managers only, while pending) ─── */
  const applyQuotationStatus = async (newStatus: string, verb: string) => {
    if (!id) return;
    const result = await Swal.fire({
      title: `ຢືນຢັນ${verb}?`,
      html: `ໃບສະເໜີລາຄາ <b>${formData.quotation_no || "—"}</b>`,
      icon: "question",
      showCancelButton: true,
      cancelButtonText: "ຍົກເລີກ",
      confirmButtonText: verb,
      confirmButtonColor: newStatus === "ຖືກປະຕິເສດ" ? "#dc2626" : "#714b67",
    });
    if (!result.isConfirmed) return;
    try {
      await updateQuotation(String(id), { ...formData, status: newStatus });
      setFormData((s: any) => ({ ...s, status: newStatus }));
      Swal.fire({ icon: "success", title: "ສຳເລັດ", timer: 1100, showConfirmButton: false });
    } catch {
      Swal.fire("ຜິດພາດ", "ປ່ຽນສະຖານະບໍ່ສຳເລັດ", "error");
    }
  };

  const showApprovalButtons =
    isEditing && canApprove && formData.status === "ລໍຖ້າອະນຸມັດ";

  // Contract creation uses the main project contract workflow
  // (`odg_projects_contract`) because approval, BOQ and material requests read
  // from that table. Keep this out of the separate `odg_contract` flow.
  const createContract = async () => {
    if (!id) return;
    if (!formData.project_id) {
      Swal.fire("ຜິດພາດ", "ໃບສະເໜີລາຄານີ້ບໍ່ມີໂຄງການອ້າງອີງ", "error");
      return;
    }

    const confirm = await Swal.fire({
      title: "ສ້າງສັນຍາຈາກໃບສະເໜີລາຄາ?",
      html: `<b>${formData.quotation_no || "—"}</b><br/>ລະບົບຈະໄປໜ້າສ້າງສັນຍາ ແລະດຶງລາຍການຈາກໃບສະເໜີລາຄານີ້.`,
      icon: "question",
      showCancelButton: true,
      cancelButtonText: "ຍົກເລີກ",
      confirmButtonText: "ສ້າງສັນຍາ",
      confirmButtonColor: "#714b67",
    });
    if (!confirm.isConfirmed) return;

    router.push(
      `/sale-admin/request-project-creation/${encodeURIComponent(
        String(formData.project_id),
      )}?quotationId=${encodeURIComponent(String(id))}`,
    );
  };

  const showCreateContractButton =
    isEditing && formData.status === "ອະນຸມັດແລ້ວ";

  usePageHeader({
    title: formData.quotation_no
      ? `Quotation ${formData.quotation_no}`
      : isEditing
        ? "Quotation"
        : "New Quotation",
    subtitle: [
      isEditing ? "ແກ້ໄຂໃບສະເໜີລາຄາ" : "ສ້າງໃບສະເໜີລາຄາໃໝ່",
      formData.quotation_date && `· ${fmtDateDisplay(formData.quotation_date)}`,
    ]
      .filter(Boolean)
      .join(" "),
    primaryAction: {
      label: "Save",
      icon: <Save size={13} />,
      onClick: handleSubmit,
      disabled: isSubmitting,
    },
    secondaryActions: [
      ...(showApprovalButtons
        ? [
            {
              label: "ອະນຸມັດ",
              icon: <CheckCircle size={13} />,
              onClick: () => applyQuotationStatus("ອະນຸມັດແລ້ວ", "ອະນຸມັດ"),
            },
            {
              label: "ປະຕິເສດ",
              icon: <X size={13} />,
              onClick: () => applyQuotationStatus("ຖືກປະຕິເສດ", "ປະຕິເສດ"),
            },
          ]
        : []),
      ...(showCreateContractButton
        ? [
            {
              label: "ສ້າງສັນຍາ",
              icon: <FilePlus size={13} />,
              onClick: createContract,
            },
          ]
        : []),
      {
        label: "Send by Email",
        icon: <Send size={13} />,
        onClick: () =>
          Swal.fire({
            icon: "info",
            title: "ສົ່ງອີເມວ",
            text: "ຍັງບໍ່ໄດ້ກຳນົດ SMTP",
          }),
      },
      {
        label: "Discard",
        icon: <X size={13} />,
        onClick: () => router.back(),
      },
    ],
  });

  /* ─── Notebook tab: Order Lines ─── */
  const orderLinesTab = (
    <div className="space-y-3">
      {/*
        NOTE: do NOT wrap this table in `overflow-x-auto`. The inline product
        picker dropdown is `position: absolute` from the row cell; any ancestor
        with `overflow-x: auto` will silently clip the dropdown on the Y axis
        too (CSS spec: a non-visible value on one axis coerces the other).
      */}
      <div className="rounded border border-[var(--theme-border)]">
        <table className="w-full border-collapse text-[12px]">
          <thead className="bg-[var(--theme-bg-muted)] text-[11px] uppercase tracking-wide text-[var(--theme-text-soft)]">
            <tr className="[&>th]:border-b [&>th]:border-[var(--theme-border)] [&>th]:px-2 [&>th]:py-1.5 [&>th]:font-semibold">
              <th className="w-8 text-left">#</th>
              <th className="w-[170px] text-left">Product</th>
              <th className="text-left">Description</th>
              <th className="w-[80px] text-right">Qty</th>
              <th className="w-[80px] text-left">Unit</th>
              <th className="w-[110px] text-right">Unit Price</th>
              <th className="w-[80px] text-right">Tax</th>
              <th className="w-[110px] text-right">Subtotal</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {formData.items.map((item: any, index: number) => {
              if (item.type === "section" || item.type === "note") {
                const isSection = item.type === "section";
                return (
                  <tr key={index} className={`border-t border-[var(--theme-border-subtle)] ${isSection ? "bg-[var(--theme-bg-muted)]" : ""}`}>
                    <td className="px-2 py-1 text-[11px] text-[var(--theme-text-mute)]">{index + 1}</td>
                    <td colSpan={7} className="px-2 py-1">
                      <input
                        value={item.description}
                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                        placeholder={isSection ? "Section title..." : "Add a note..."}
                        className={isSection
                          ? "w-full bg-transparent text-[13px] font-semibold uppercase tracking-wide text-[var(--theme-text)] focus:outline-none"
                          : "w-full bg-transparent text-[12px] italic text-[var(--theme-text-soft)] focus:outline-none"}
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button type="button" onClick={() => removeItem(index)} className="text-[var(--theme-text-mute)] hover:text-rose-600">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              }
              const dropdownOpen = openRow === index;
              return (
                <tr key={index} className="h-9 border-t border-[var(--theme-border-subtle)] hover:bg-[var(--theme-bg-muted)]/50 [&>td]:px-1 [&>td]:py-0.5">
                  <td className="!px-2 !py-1 text-[11px] text-[var(--theme-text-mute)]">{index + 1}</td>
                  <td>
                    <div className="relative" ref={(el) => { rowRefs.current[index] = el; }}>
                      <div className="flex items-center gap-1">
                        <input
                          value={item.productId || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            handleItemChange(index, "productId", v);
                            fetchProducts(v);
                            setOpenRow(index);
                          }}
                          onFocus={() => setOpenRow(index)}
                          placeholder="Search..."
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setOpenRow(dropdownOpen ? null : index);
                            if (!dropdownOpen && item.productId) fetchProducts(item.productId);
                          }}
                          className="rounded p-1 text-[var(--theme-text-mute)] hover:text-[var(--theme-text)]"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                      {dropdownOpen && (
                        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-[480px] overflow-y-auto rounded border border-[var(--theme-border)] bg-white text-[12px] shadow-lg">
                          {loadingProducts ? (
                            <div className="px-3 py-2 text-center text-[11px] text-[var(--theme-text-mute)]">ກຳລັງໂຫຼດ...</div>
                          ) : filterProducts(item.productId).length > 0 ? (
                            filterProducts(item.productId).slice(0, 12).map((p: any) => (
                              <div
                                key={p.code}
                                onClick={() => selectProduct(index, p)}
                                className="flex cursor-pointer items-center justify-between gap-2 border-b border-[var(--theme-border-subtle)] px-2 py-1.5 last:border-b-0 hover:bg-[var(--theme-primary-tint)]"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="rounded bg-[var(--theme-bg-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--theme-text)]">{p.code}</span>
                                  <span className="truncate text-[12px] text-[var(--theme-text)]">{p.name_1}</span>
                                </div>
                                <div className="flex flex-shrink-0 items-center gap-2 whitespace-nowrap text-[11px]">
                                  {p.unit && (
                                    <span className="rounded bg-[var(--theme-bg-muted)] px-1.5 py-0.5 text-[10px] text-[var(--theme-text-soft)]">
                                      {String(p.unit)}
                                    </span>
                                  )}
                                  <span className="text-[var(--theme-text-mute)]">{formatCurrency(p.unit_cost)}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-center text-[11px] text-[var(--theme-text-mute)]">ບໍ່ພົບສິນຄ້າ</div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <input
                      value={item.description || ""}
                      onChange={(e) => handleItemChange(index, "description", e.target.value)}
                      placeholder="Description"
                      className={inputClass}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                      min={0}
                      className={`${inputClass} text-right`}
                    />
                  </td>
                  <td>
                    <input
                      value={item.unit || ""}
                      onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                      placeholder="Unit"
                      className={inputClass}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(index, "unit_price", e.target.value)}
                      min={0}
                      step="0.01"
                      className={`${inputClass} text-right`}
                    />
                  </td>
                  <td className="!px-2 !py-1 text-right text-[11px] text-[var(--theme-text-soft)]">
                    {formData.tax_type === "none" || formData.tax_type === "0" ? "—" : "10%"}
                  </td>
                  <td className="!px-2 !py-1 text-right font-medium text-[var(--theme-text)]">
                    {formatCurrency(item.total)}
                  </td>
                  <td className="!px-2 !py-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={formData.items.length <= 1}
                      className="text-[var(--theme-text-mute)] hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--theme-border)] bg-[var(--theme-bg-muted)] px-3 py-1.5 text-[12px]">
          <button type="button" onClick={addItem} className="inline-flex items-center gap-1 font-semibold text-[var(--theme-primary)] hover:underline">
            <FilePlus size={12} /> Add a product
          </button>
          <span className="text-[var(--theme-text-mute)]">·</span>
          <button type="button" onClick={addSection} className="inline-flex items-center gap-1 font-semibold text-[var(--theme-text-soft)] hover:text-[var(--theme-primary)]">
            <Plus size={12} /> Add a section
          </button>
          <span className="text-[var(--theme-text-mute)]">·</span>
          <button type="button" onClick={addNote} className="inline-flex items-center gap-1 font-semibold text-[var(--theme-text-soft)] hover:text-[var(--theme-primary)]">
            <Plus size={12} /> Add a note
          </button>
        </div>
      </div>

      {/* Totals summary panel */}
      <div className="flex justify-end">
        <div className="w-[280px] rounded border border-[var(--theme-border)] bg-white text-[12px] [&>div]:flex [&>div]:items-center [&>div]:justify-between [&>div]:px-3">
          <div className="border-b border-[var(--theme-border-subtle)] py-1.5">
            <span className="text-[var(--theme-text-soft)]">Untaxed Amount</span>
            <span className="font-medium text-[var(--theme-text)]">{formatCurrency(formData.subtotal)}</span>
          </div>
          <div className="border-b border-[var(--theme-border-subtle)] py-1.5">
            <span className="text-[var(--theme-text-soft)]">Discount</span>
            <span className="font-medium text-[var(--theme-text)]">− {formatCurrency(parseFloat(formData.discount) || 0)}</span>
          </div>
          <div className="border-b border-[var(--theme-border-subtle)] py-1.5">
            <span className="text-[var(--theme-text-soft)]">Taxes</span>
            <span className="font-medium text-[var(--theme-text)]">{formatCurrency(formData.tax)}</span>
          </div>
          <div className="py-2">
            <span className="text-[13px] font-semibold text-[var(--theme-text)]">Total</span>
            <span className="text-[14px] font-bold text-[var(--theme-primary)]">{formatCurrency(formData.total_amount)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  /* ─── Notebook tab: Other Info ─── */
  const otherInfoTab = (
    <div className="space-y-4">
      <FieldGroup>
        <Field label="Quotation #">
          <input
            name="quotation_no"
            value={formData.quotation_no}
            onChange={handleInputChange}
            className={inputClass}
            placeholder="QT-…"
          />
        </Field>
        <Field label="Customer Ref">
          <input
            name="terms"
            value={formData.terms || ""}
            onChange={handleInputChange}
            className={inputClass}
            placeholder="Payment terms / reference"
          />
        </Field>
      </FieldGroup>
      <Field label="Terms & Notes">
        <textarea
          name="notes"
          value={formData.notes || ""}
          onChange={handleInputChange}
          rows={5}
          className="w-full resize-y rounded border border-[var(--theme-border)] bg-white px-3 py-2 text-[12px] text-[var(--theme-text)] placeholder:text-[var(--theme-text-mute)] focus:border-[var(--theme-primary)] focus:outline-none"
          placeholder="ບັນທຶກໝາຍເຫດ..."
        />
      </Field>
    </div>
  );

  const notebook = [
    {
      id: "order_lines",
      label: "Order Lines",
      content: orderLinesTab,
      badge: formData.items.filter((it: any) => it.type === "product").length || undefined,
    },
    { id: "other_info", label: "Other Info", content: otherInfoTab },
  ];

  /* ─── Sheet header ─── */
  const sheetHeader = (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => router.push("/sale-admin/quotations")}
        className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-[var(--theme-text-soft)] hover:text-[var(--theme-primary)]"
      >
        <ArrowLeft size={12} />
        ກັບຄືນລາຍການ
      </button>
      <input
        name="customer_name"
        value={formData.customer_name}
        onChange={handleInputChange}
        placeholder="Customer..."
        className="w-full border-0 border-b border-transparent bg-transparent px-0 py-1 text-2xl font-semibold text-[var(--theme-text)] placeholder:text-[var(--theme-text-mute)] focus:border-[var(--theme-primary)] focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--theme-text-soft)]">
        {(selectedProject?.project_name || formData.project_name) && (
          <span className="inline-flex items-center rounded bg-[var(--theme-primary-tint)] px-2 py-0.5 font-semibold text-[var(--theme-primary)]">
            {selectedProject?.project_name || formData.project_name}
          </span>
        )}
        {formData.quotation_no && (
          <span className="inline-flex items-center gap-1">
            <span className="text-[var(--theme-text-mute)]">No:</span>
            <span className="font-mono font-semibold text-[var(--theme-text)]">
              {formData.quotation_no}
            </span>
          </span>
        )}
        {formData.quotation_date && (
          <span className="inline-flex items-center gap-1">
            <span className="text-[var(--theme-text-mute)]">Date:</span>
            <span className="font-semibold text-[var(--theme-text)]">
              {fmtDateDisplay(formData.quotation_date)}
            </span>
          </span>
        )}
      </div>
    </div>
  );

  /* ─── Render ─── */
  return (
    <div className="flex flex-col">
      <StatusBar
        stages={STAGES.map((s) => ({ id: s.id, label: s.label }))}
        activeIndex={activeStageIndex}
        onStageClick={(stageId) =>
          setFormData((s: any) => ({ ...s, status: stageId }))
        }
      />

      <div className="px-4 py-4">
        {loading ? (
          <div className="mx-auto flex w-full max-w-[1080px] items-center justify-center rounded border border-[var(--theme-border)] bg-white py-16 text-[12px] text-[var(--theme-text-mute)]">
            ກຳລັງໂຫຼດຂໍ້ມູນ...
          </div>
        ) : (
          <FormSheet header={sheetHeader} notebook={notebook}>
            <FieldGroup>
              {/* Left column */}
              <Field label="Project" required>
                <Select
                  classNamePrefix="react-select"
                  styles={selectStyles}
                  options={projects}
                  value={selectedProject}
                  onChange={handleProjectChange}
                  placeholder="ເລືອກໂຄງການ..."
                  isClearable
                  menuPortalTarget={
                    typeof document !== "undefined" ? document.body : undefined
                  }
                />
              </Field>

              <Field label="Quotation Date" required>
                <input
                  type="date"
                  name="quotation_date"
                  value={formData.quotation_date}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </Field>

              <Field label="Customer Address">
                <input
                  name="customer_address"
                  value={formData.customer_address}
                  onChange={handleInputChange}
                  className={inputClass}
                  placeholder="ທີ່ຢູ່ລູກຄ້າ"
                />
              </Field>

              <Field label="Expiration">
                <input
                  type="date"
                  name="validity_date"
                  value={formData.validity_date}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </Field>

              <Field label="Customer Phone">
                <input
                  name="customer_phone"
                  value={formData.customer_phone}
                  onChange={handleInputChange}
                  className={inputClass}
                  placeholder="020XXXXXXXX"
                />
              </Field>

              <Field label="Tax Type">
                <select
                  name="tax_type"
                  value={formData.tax_type}
                  onChange={handleInputChange}
                  className={inputClass}
                >
                  <option value="0">None</option>
                  <option value="internal">ລວມ VAT (Included 10%)</option>
                  <option value="external">ບວກ VAT (Add 10%)</option>
                </select>
              </Field>

              <Field label="Discount">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    name="discount"
                    value={formData.discount}
                    onChange={handleInputChange}
                    min={0}
                    className={`${inputClass} text-right`}
                  />
                  <span className="text-[11px] text-[var(--theme-text-mute)]">ບາດ</span>
                </div>
              </Field>
            </FieldGroup>
          </FormSheet>
        )}

        {isEditing && (
          <div className="mx-auto mt-4 w-full max-w-[1080px]">
            <Chatter entries={[]} onSend={() => {}} />
          </div>
        )}
      </div>
    </div>
  );
}
