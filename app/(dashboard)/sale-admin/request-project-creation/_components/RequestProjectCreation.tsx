"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Select from "react-select";
import Swal from "sweetalert2";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";

import { getProject, createProjectRequestAction } from "@/_actions/projects";
import { getQuotation, getQuotations } from "@/_actions/quotations";
import { usePageHeader } from "@/_components/PageHeader";

/* ─────────────────────────────────────────────────────────────────────────
   Static options
   ───────────────────────────────────────────────────────────────────────── */

const productBrandOptions = [
  { value: "daikin", label: "Daikin" },
  { value: "mitsubishi", label: "Mitsubishi" },
  { value: "lg", label: "LG" },
  { value: "samsung", label: "Samsung" },
  { value: "panasonic", label: "Panasonic" },
  { value: "carrier", label: "Carrier" },
  { value: "york", label: "York" },
  { value: "trane", label: "Trane" },
  { value: "midea", label: "Midea" },
  { value: "gree", label: "Gree" },
  { value: "haier", label: "Haier" },
  { value: "fujitsu", label: "Fujitsu" },
  { value: "hitachi", label: "Hitachi" },
  { value: "sharp", label: "Sharp" },
  { value: "tcl", label: "TCL" },
];

const salesModelOptions = [
  { value: "ສົດ", label: "ສົດ" },
  { value: "ສິນເຊື່ອ", label: "ສິນເຊື່ອ" },
];

const productCategoryOptions = [
  { value: "ແອ", label: "ແອ" },
  { value: "ຕິດຕັ້ງ", label: "ຕິດຕັ້ງ" },
  { value: "ແອພ້ອມຕິດຕັ້ງ", label: "ແອພ້ອມຕິດຕັ້ງ" },
];

const paymentFrequencyOptions = [
  { value: "1", label: "1 ຄັ້ງ" },
  { value: "2", label: "2 ຄັ້ງ" },
  { value: "3", label: "3 ຄັ້ງ" },
  { value: "4", label: "4 ຄັ້ງ" },
  { value: "6", label: "6 ຄັ້ງ" },
  { value: "12", label: "12 ຄັ້ງ" },
];

const currencyOptions = [
  { value: "LAK", label: "ກີບ (LAK)", symbol: "₭" },
  { value: "THB", label: "ບາດ (THB)", symbol: "฿" },
  { value: "USD", label: "ໂດລາ (USD)", symbol: "$" },
  { value: "CNY", label: "ຢວນ (CNY)", symbol: "¥" },
];

/* ─────────────────────────────────────────────────────────────────────────
   Helpers (preserved from previous version)
   ───────────────────────────────────────────────────────────────────────── */

const getTodayDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const splitEvenly = (total: number, count: number): string[] => {
  const amount = Number(total) || 0;
  if (count <= 0) return [];
  const base = Math.floor((amount / count) * 100) / 100;
  let remainder = Math.round((amount - base * count) * 100) / 100;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let value = base;
    if (remainder > 0) {
      value = Math.round((base + 0.01) * 100) / 100;
      remainder -= 0.01;
    }
    out.push(value.toFixed(2));
  }
  return out;
};

const sumValues = (arr: Array<string | number> = []): number =>
  arr.reduce<number>((sum, value) => sum + (parseFloat(String(value)) || 0), 0);

const getCurrencyMeta = (code = "LAK") =>
  currencyOptions.find((item) => item.value === code) || currencyOptions[0];

const formatCurrencyAmount = (amount: number, code = "LAK") => {
  const meta = getCurrencyMeta(code);
  const num = Number(amount || 0);
  const digits = meta.value === "LAK" ? 0 : 2;
  return `${meta.symbol} ${num.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
};

const parseQuotationItems = (items: unknown): any[] => {
  if (Array.isArray(items)) return items;
  if (typeof items !== "string" || !items.trim()) return [];
  try {
    const parsed = JSON.parse(items);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getQuotationProductLabel = (item: any, index: number) =>
  item?.productName ||
  item?.product_name ||
  item?.item_name ||
  item?.description ||
  `ລາຍການ ${index + 1}`;

const getQuotationLineTotal = (item: any) => {
  const direct =
    Number(item?.total) ||
    Number(item?.amount) ||
    Number(item?.line_total) ||
    Number(item?.total_amount);
  if (direct > 0) return direct;
  return (Number(item?.quantity || item?.qty || 0)) * (Number(item?.unit_price || item?.price || 0));
};

const mapQuotationItemsToContractItems = (quotation: any, currencyCode = "LAK") =>
  parseQuotationItems(quotation?.items)
    .filter((item: any) => !item?.type || item.type === "product")
    .map((item: any, index: number) => {
      const total = getQuotationLineTotal(item);
      const label = getQuotationProductLabel(item, index);
      return {
        id: `quotation-${quotation?.id || "new"}-${index}-${Date.now()}`,
        category: label,
        categoryLabel: label,
        value: total.toFixed(2),
        paymentFrequency: "1",
        averagePerPayment: total.toFixed(2),
        installments: splitEvenly(total, 1),
        isCustomInstallments: false,
        startInstallment: 1,
        sourceQuotationId: quotation?.id,
        sourceQuotationNo: quotation?.quotation_no,
        sourceQuotationCurrency: currencyCode,
        sourceQuotationItem: item,
      };
    })
    .filter((item: any) => Number(item.value) > 0);

const buildInstallmentSchedule = (items: any[] = []) => {
  const max = items.reduce((m, item) => {
    const start = Number(item.startInstallment) || 1;
    const len = item.installments?.length || 0;
    return Math.max(m, start + len - 1);
  }, 0);

  return Array.from({ length: max }).map((_, idx) => {
    const installmentNo = idx + 1;
    let total = 0;
    const itemDetails = items.map((item, itemIdx) => {
      const start = Number(item.startInstallment || 1);
      const pos = installmentNo - start;
      const amount = pos >= 0 ? Number(item.installments?.[pos] || 0) : 0;
      total += amount;
      return { item_index: itemIdx + 1, category: item.category, amount };
    });
    return { installment_no: installmentNo, total, items: itemDetails };
  });
};

/* ─────────────────────────────────────────────────────────────────────────
   Minimal react-select theme matching the new design tokens
   ───────────────────────────────────────────────────────────────────────── */

const selectStyles: any = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: 36,
    fontSize: 13,
    borderRadius: "var(--radius-sm)",
    borderColor: state.isFocused ? "var(--brand)" : "var(--border)",
    backgroundColor: "var(--surface)",
    boxShadow: state.isFocused ? "0 0 0 2px var(--brand-ring)" : "none",
    "&:hover": { borderColor: "var(--border-strong)" },
  }),
  valueContainer: (base: any) => ({ ...base, padding: "0 8px" }),
  indicatorsContainer: (base: any) => ({ ...base, paddingRight: 4 }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    boxShadow: "var(--shadow-md)",
    zIndex: 30,
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "var(--brand)"
      : state.isFocused
        ? "var(--bg-subtle)"
        : "transparent",
    color: state.isSelected ? "#fff" : "var(--text)",
    fontSize: 13,
    cursor: "pointer",
  }),
  placeholder: (base: any) => ({ ...base, color: "var(--text-mute)", fontSize: 13 }),
  singleValue: (base: any) => ({ ...base, color: "var(--text)", fontSize: 13 }),
  input: (base: any) => ({ ...base, color: "var(--text)" }),
};

/* ─────────────────────────────────────────────────────────────────────────
   Small UI helpers
   ───────────────────────────────────────────────────────────────────────── */

const labelCls = "mb-1 block text-[12px] font-medium text-[var(--text)]";
const inputCls =
  "block w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 h-9 text-[13px] text-[var(--text)] " +
  "placeholder:text-[var(--text-mute)] transition-colors " +
  "hover:border-[var(--border-strong)] " +
  "focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]";
const inputReadOnlyCls =
  "block w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-subtle)] px-3 h-9 text-[13px] text-[var(--text-soft)] cursor-not-allowed";

function Section({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] ${className}`}
    >
      <div className="border-b border-[var(--border-soft)] px-4 py-3">
        <div className="text-[13.5px] font-semibold text-[var(--text)]">{title}</div>
        {hint && <div className="mt-0.5 text-[11.5px] text-[var(--text-mute)]">{hint}</div>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: React.ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-mute)]">
        {label}
      </div>
      <div
        className={`mt-0.5 font-mono tabular-nums ${
          emphasize
            ? "text-[18px] font-bold text-[var(--text)]"
            : "text-[14px] font-semibold text-[var(--text)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────────────────────────── */

type AttachedFileItem = { file: File; preview: string | null };

const emptyItem = {
  id: null as null | string | number,
  category: "",
  categoryLabel: "",
  value: "",
  paymentFrequency: "",
  averagePerPayment: "",
  installments: [] as string[],
  isCustomInstallments: false,
  startInstallment: null as number | null,
  sourceQuotationId: undefined,
  sourceQuotationNo: undefined,
  sourceQuotationCurrency: undefined,
  sourceQuotationItem: undefined,
};

export default function RequestProjectCreation() {
  const { projectId } = useParams<{ projectId?: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuotationId = searchParams.get("quotationId") || "";

  /* ── State ── */
  const [loading, setLoading] = useState(false);
  const [existingProject, setExistingProject] = useState<any>(null);
  const [projectName, setProjectName] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [contractName, setContractName] = useState("");
  const [currencyCode, setCurrencyCode] = useState("LAK");
  const [contractDate, setContractDate] = useState(getTodayDate());
  const [startDate, setStartDate] = useState(getTodayDate());
  const [contactName, setContactName] = useState("");
  const [salesModel, setSalesModel] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [productBrand, setProductBrand] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFileItem[]>([]);
  const [productItems, setProductItems] = useState<any[]>([]);
  const [currentItem, setCurrentItem] = useState<any>(emptyItem);
  const [custCode, setCustCode] = useState("");
  const [quotationOptions, setQuotationOptions] = useState<any[]>([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState("");
  const [quotationLoading, setQuotationLoading] = useState(false);
  const [autoImportedQuotationId, setAutoImportedQuotationId] = useState("");

  const storageKey = `projDraft-${projectId || "new"}`;

  /* ── Load project ── */
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const json: any = await getProject(String(projectId));
        if (cancelled) return;
        const data = json?.data;
        if (json?.success === false || !data) return;
        setExistingProject(data);
        setProjectName(data.project_name || "");
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  /* ── Load quotations ── */
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      setQuotationLoading(true);
      try {
        const json: any = await getQuotations({ projectId: String(projectId) });
        if (cancelled || json?.success === false) return;
        const rows = json?.data?.data || json?.data || [];
        setQuotationOptions(
          rows.map((q: any) => ({
            value: String(q.id),
            label: `${q.quotation_no || `QT-${q.id}`} · ${formatCurrencyAmount(q.total_amount, currencyCode)}`,
            quotation: q,
          })),
        );
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setQuotationLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, currencyCode]);

  /* ── Draft hydration / persistence ── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.projectName) setProjectName(draft.projectName);
      setContractNumber(draft.contractNumber || "");
      setContractName(draft.contractName || "");
      setCurrencyCode(draft.currencyCode || "LAK");
      setContactName(draft.contactName || "");
      setSalesModel(draft.salesModel || "");
      setProjectDescription(draft.projectDescription || "");
      setProductBrand(draft.productBrand || "");
      setProductItems(draft.productItems || []);
      setSelectedQuotationId(draft.selectedQuotationId || "");
      setContractDate(draft.contractDate || getTodayDate());
      setStartDate(draft.startDate || getTodayDate());
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    const draft = {
      projectName,
      contractNumber,
      contractName,
      currencyCode,
      contractDate,
      contactName,
      salesModel,
      startDate,
      projectDescription,
      productBrand,
      productItems,
      selectedQuotationId,
    };
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    }
  }, [
    projectName,
    contractNumber,
    contractName,
    currencyCode,
    contractDate,
    contactName,
    salesModel,
    startDate,
    projectDescription,
    productBrand,
    productItems,
    selectedQuotationId,
    storageKey,
  ]);

  /* ── Computed ── */
  const totalAmount = useMemo(
    () => sumValues(productItems.map((item) => item.value)),
    [productItems],
  );
  const selectedCurrency = getCurrencyMeta(currencyCode);
  const availableCats = productCategoryOptions.filter(
    (option) => !productItems.some((item) => item.category === option.value),
  );
  const airItem = productItems.find((item) => item.category === "ແອ");
  const maxStart = airItem ? Number(airItem.paymentFrequency) || 12 : 12;

  useEffect(() => {
    setCurrentItem((prev: any) => {
      if (prev.category === "ແອ") {
        return prev.startInstallment === 1 ? prev : { ...prev, startInstallment: 1 };
      }
      if (!prev.startInstallment) return prev;
      const clamped = Math.min(prev.startInstallment, maxStart);
      return clamped === prev.startInstallment ? prev : { ...prev, startInstallment: clamped };
    });
  }, [maxStart, currentItem.category]);

  const previewSchedule = useMemo(
    () =>
      buildInstallmentSchedule(
        productItems.map((item) => ({
          ...item,
          value: parseFloat(item.value) || 0,
          installments: item.installments.map((value: string) => parseFloat(value) || 0),
          category_label: item.categoryLabel,
        })),
      ),
    [productItems],
  );

  const requiredChecks = [
    Boolean(contractNumber),
    Boolean(contractName),
    Boolean(contractDate),
    Boolean(startDate),
    Boolean(contactName),
    productItems.length > 0,
  ];
  const completedRequired = requiredChecks.filter(Boolean).length;
  const isReady = completedRequired === requiredChecks.length;

  /* ── Page header ── */
  const projectRef =
    existingProject?.project_code ||
    existingProject?.sml_code ||
    existingProject?.id ||
    projectId ||
    "-";

  usePageHeader({
    title: "ສ້າງສັນຍາ",
    subtitle: projectName ? `${projectName} · ${projectRef}` : `Project ${projectRef}`,
    secondaryActions: [
      {
        label: "ກັບໄປ",
        icon: <ArrowLeft size={13} />,
        onClick: () => router.back(),
      },
    ],
  });

  /* ── Handlers ── */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const next = files.map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    setAttachedFiles((prev) => [...prev, ...next]);
  };

  const removeFile = (index: number) =>
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));

  const autoDistributeInstallments = () => {
    const count = Number(currentItem.paymentFrequency) || 0;
    const amount = Number(currentItem.value) || 0;
    if (count <= 0 || amount <= 0) {
      Swal.fire("ຄຳແນະນຳ", "ກະລຸນາເລືອກຈຳນວນງວດ ແລະ ປ້ອນມູນຄ່າກ່ອນ", "warning");
      return;
    }
    setCurrentItem((prev: any) => ({
      ...prev,
      installments: splitEvenly(amount, count),
      isCustomInstallments: false,
    }));
  };

  const importQuotationItems = async (quotationId: string) => {
    if (!quotationId) return;
    setQuotationLoading(true);
    try {
      const selectedOption = quotationOptions.find((o) => o.value === quotationId);
      let quotation = selectedOption?.quotation;
      const items = parseQuotationItems(quotation?.items);
      if (!quotation || items.length === 0) {
        const json: any = await getQuotation(String(quotationId));
        if (json?.success === false) throw new Error("Quotation not found");
        quotation = json?.data?.data || json?.data || json;
      }
      const imported = mapQuotationItemsToContractItems(quotation, currencyCode);
      if (imported.length === 0) {
        Swal.fire("ຄຳແນະນຳ", "ໃບສະເໜີລາຄານີ້ບໍ່ມີລາຍການສິນຄ້າ", "warning");
        return;
      }
      setSelectedQuotationId(String(quotationId));
      setProductItems(imported);
      setContactName((prev) => prev || quotation?.customer_name || "");
      setContractName(
        (prev) =>
          prev || quotation?.project_name || projectName || quotation?.quotation_no || "",
      );
      setProjectDescription((prev) => prev || quotation?.notes || quotation?.terms || "");
      Swal.fire({
        title: "ດຶງລາຍການສຳເລັດ",
        text: `ນຳເຂົ້າ ${imported.length} ລາຍການ`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "ດຶງລາຍການບໍ່ສຳເລັດ", "error");
    } finally {
      setQuotationLoading(false);
    }
  };

  useEffect(() => {
    if (
      !initialQuotationId ||
      quotationOptions.length === 0 ||
      autoImportedQuotationId === initialQuotationId
    )
      return;
    if (!quotationOptions.some((o) => o.value === initialQuotationId)) return;
    setProductItems([]);
    setAutoImportedQuotationId(initialQuotationId);
    void importQuotationItems(initialQuotationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuotationId, quotationOptions, autoImportedQuotationId]);

  const handleAddItem = () => {
    if (!currentItem.category || !currentItem.paymentFrequency) {
      Swal.fire("ຄຳແນະນຳ", "ກະລຸນາເລືອກປະເພດ ແລະ ຈຳນວນງວດ", "warning");
      return;
    }
    const count = Number(currentItem.paymentFrequency);
    if (currentItem.category !== "ແອ" && !currentItem.startInstallment) {
      Swal.fire("ຄຳແນະນຳ", "ກະລຸນາເລືອກງວດເລີ່ມ", "warning");
      return;
    }
    const hasManual =
      sumValues(currentItem.installments) > 0 && currentItem.installments.length === count;
    const installments = hasManual
      ? currentItem.installments
      : splitEvenly(Number(currentItem.value) || 0, count);
    if (sumValues(installments) <= 0) {
      Swal.fire("ຄຳແນະນຳ", "ກະລຸນາປ້ອນມູນຄ່າລາຍການ", "warning");
      return;
    }
    setProductItems((prev) => [
      ...prev,
      {
        ...currentItem,
        id: Date.now(),
        installments,
        value: sumValues(installments).toFixed(2),
        categoryLabel:
          productCategoryOptions.find((c) => c.value === currentItem.category)?.label ||
          currentItem.category,
      },
    ]);
    setCurrentItem(emptyItem);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReady) {
      Swal.fire("ຂໍ້ມູນບໍ່ຄົບ", "ກະລຸນາກອກຂໍ້ມູນທີ່ມີເຄື່ອງໝາຍ * ໃຫ້ຄົບ", "warning");
      return;
    }
    setLoading(true);
    try {
      const attachments = await Promise.all(
        attachedFiles.map(
          (f) =>
            new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({
                  fileName: f.file.name,
                  fileType: f.file.type,
                  size: f.file.size,
                  base64: String(reader.result).split(",")[1],
                });
              reader.readAsDataURL(f.file);
            }),
        ),
      );

      const itemsPayload = productItems.map((item) => {
        const value = parseFloat(item.value) || 0;
        const count = item.installments.length || 1;
        const categoryLabel =
          item.categoryLabel ||
          productCategoryOptions.find((c) => c.value === item.category)?.label ||
          item.category;
        return {
          ...item,
          value,
          installments: item.installments.map((i: string) => parseFloat(i) || 0),
          averagePerPayment: (value / count).toFixed(2),
          category_label: categoryLabel,
          source_quotation_id: item.sourceQuotationId || selectedQuotationId || null,
          source_quotation_no: item.sourceQuotationNo || null,
          source_quotation_item: item.sourceQuotationItem || null,
        };
      });

      const response: any = await createProjectRequestAction({
        project_id: projectId,
        existing_project_id: existingProject?.id,
        contract_no: contractNumber,
        contract_name: contractName,
        currency_code: currencyCode,
        contract_date: contractDate,
        contact_name: contactName,
        sales_type: salesModel,
        product_brand: productBrand,
        start_date: startDate,
        project_description: projectDescription,
        cust_code: custCode,
        quotation_id: selectedQuotationId || null,
        product_items: itemsPayload,
        installment_schedule: buildInstallmentSchedule(itemsPayload),
        total_amount: sumValues(itemsPayload.map((item) => item.value)),
        attachments,
      });

      if (!response?.success) throw new Error("Submit failed");

      Swal.fire({
        title: "ບັນທຶກສຳເລັດ",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });

      if (typeof window !== "undefined") localStorage.removeItem(storageKey);
      router.push("/sale-admin/list-project");
    } catch (err) {
      console.error(err);
      Swal.fire("ຜິດພາດ", "ບັນທຶກບໍ່ສຳເລັດ", "error");
    } finally {
      setLoading(false);
    }
  };

  /* ── Render ── */
  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-24">
      {/* Top stats — quick scan */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Project" value={String(projectRef)} />
        <Stat label="Currency" value={selectedCurrency.value} />
        <Stat label="Items" value={String(productItems.length)} />
        <Stat
          label="Total"
          value={formatCurrencyAmount(totalAmount, currencyCode)}
          emphasize
        />
      </div>

      {/* Grid: left = contract header + context, right = files + package */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* CONTRACT HEADER */}
        <Section title="ຫົວສັນຍາ" hint="ຂໍ້ມູນຫຼັກສຳລັບອ້າງອີງສັນຍາ">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={labelCls}>ຊື່ໂຄງການ</label>
              <input
                type="text"
                className={inputReadOnlyCls}
                value={projectName}
                readOnly
                placeholder="ດຶງຈາກໂຄງການ"
              />
            </div>

            <div>
              <label className={labelCls}>
                ເລກທີສັນຍາ <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                className={inputCls}
                required
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                placeholder="CTR-2026-001"
              />
            </div>

            <div>
              <label className={labelCls}>
                ຊື່ສັນຍາ <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                className={inputCls}
                required
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                placeholder="ສັນຍາຈັດຊື້ ແລະ ຕິດຕັ້ງ"
              />
            </div>

            <div>
              <label className={labelCls}>
                ວັນທີສັນຍາ <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="date"
                className={inputCls}
                required
                value={contractDate}
                onChange={(e) => setContractDate(e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>
                ວັນເລີ່ມໂຄງການ <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="date"
                className={inputCls}
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>ສະກຸນເງິນ</label>
              <Select
                options={currencyOptions}
                value={currencyOptions.find((o) => o.value === currencyCode)}
                onChange={(o: any) => setCurrencyCode(o?.value || "LAK")}
                styles={selectStyles}
                placeholder="ເລືອກ..."
              />
            </div>

            <div>
              <label className={labelCls}>ລະຫັດອ້າງອີງ / SML</label>
              <input
                type="text"
                className={inputCls}
                value={custCode}
                onChange={(e) => setCustCode(e.target.value)}
                placeholder="ຖ້າມີ"
              />
            </div>
          </div>
        </Section>

        {/* CONTACT + CONTEXT */}
        <Section title="ຂໍ້ມູນຂາຍ" hint="ຜູ້ຕິດຕໍ່, ຮູບແບບການຂາຍ, ໝາຍເຫດ">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className={labelCls}>
                ຊື່ຜູ້ຕິດຕໍ່ <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                className={inputCls}
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="ຊື່ ແລະ ນາມສະກຸນ"
              />
            </div>

            <div>
              <label className={labelCls}>ຮູບແບບການຂາຍ</label>
              <Select
                options={salesModelOptions}
                value={salesModelOptions.find((o) => o.value === salesModel)}
                onChange={(o: any) => setSalesModel(o?.value || "")}
                styles={selectStyles}
                placeholder="ເລືອກ..."
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelCls}>ຍີ່ຫໍ້ຫຼັກ</label>
              <Select
                options={productBrandOptions}
                value={productBrandOptions.find((o) => o.value === productBrand)}
                onChange={(o: any) => setProductBrand(o?.value || "")}
                styles={selectStyles}
                placeholder="ເລືອກ..."
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelCls}>ລາຍລະອຽດ / ໝາຍເຫດ</label>
              <textarea
                rows={5}
                className={`${inputCls} h-auto py-2 resize-y`}
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="ບັນທຶກຂອບເຂດວຽກ, ເງື່ອນໄຂພິເສດ..."
              />
            </div>
          </div>
        </Section>
      </div>

      {/* Quotation import + Package builder side-by-side */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* QUOTATION IMPORT + ATTACHMENTS */}
        <div className="space-y-4">
          <Section
            title="ດຶງລາຍການຈາກໃບສະເໜີລາຄາ"
            hint="ນຳເຂົ້າ items ຈາກໃບສະເໜີລາຄາ → ສ້າງເປັນ package ສັນຍາ"
          >
            <div className="space-y-3">
              <Select
                isLoading={quotationLoading}
                isDisabled={quotationLoading}
                options={quotationOptions}
                value={
                  quotationOptions.find((o) => o.value === selectedQuotationId) || null
                }
                onChange={(o: any) => setSelectedQuotationId(o?.value || "")}
                styles={selectStyles}
                placeholder={
                  quotationOptions.length === 0
                    ? "ບໍ່ພົບໃບສະເໜີລາຄາໃນໂຄງການນີ້"
                    : "ເລືອກໃບສະເໜີລາຄາ..."
                }
              />
              <button
                type="button"
                onClick={() => importQuotationItems(selectedQuotationId)}
                disabled={quotationLoading || !selectedQuotationId}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13px] font-medium text-[var(--text)] hover:bg-[var(--bg-subtle)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download size={13} />
                {quotationLoading ? "ກຳລັງດຶງ..." : "ດຶງລາຍການເຂົ້າສັນຍາ"}
              </button>
            </div>
          </Section>

          <Section title="ເອກະສານປະກອບ" hint="PDF, ຮູບ ຫຼື ໄຟລ໌ປະກອບອື່ນ">
            <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] text-center transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]">
              <Upload size={18} className="text-[var(--text-mute)]" />
              <div className="mt-2 text-[12.5px] font-medium text-[var(--text)]">
                ອັບໂຫລດເອກະສານ
              </div>
              <div className="text-[11px] text-[var(--text-mute)]">
                ຄລິກ ຫຼື ລາກໄຟລ໌ມາວາງ
              </div>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            {attachedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachedFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  >
                    {f.preview ? (
                      <img
                        src={f.preview}
                        alt=""
                        className="h-9 w-9 flex-shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-[var(--bg-subtle)] text-[var(--text-mute)]">
                        <FileText size={14} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium text-[var(--text)]">
                        {f.file.name}
                      </div>
                      <div className="text-[10.5px] text-[var(--text-mute)]">
                        {(f.file.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="flex h-7 w-7 items-center justify-center rounded text-[var(--text-mute)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* PACKAGE BUILDER */}
        <Section title="ສ້າງລາຍການສັນຍາ" hint="ກຳນົດປະເພດ, ມູນຄ່າ ແລະ ງວດຊຳລະ">
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelCls}>ປະເພດລາຍການ</label>
                <Select
                  options={availableCats}
                  value={productCategoryOptions.find((o) => o.value === currentItem.category)}
                  onChange={(o: any) =>
                    setCurrentItem((prev: any) => ({
                      ...prev,
                      category: o?.value || "",
                      paymentFrequency: "",
                      installments: [],
                      value: "",
                      isCustomInstallments: false,
                      startInstallment: o?.value === "ແອ" ? 1 : null,
                    }))
                  }
                  styles={selectStyles}
                  placeholder="ເລືອກ..."
                />
              </div>

              <div>
                <label className={labelCls}>ຈຳນວນງວດ</label>
                <Select
                  options={paymentFrequencyOptions}
                  value={paymentFrequencyOptions.find(
                    (o) => o.value === currentItem.paymentFrequency,
                  )}
                  onChange={(o: any) => {
                    const count = Number(o?.value) || 0;
                    setCurrentItem((prev: any) => ({
                      ...prev,
                      paymentFrequency: o?.value || "",
                      installments:
                        count > 0
                          ? Number(prev.value) > 0
                            ? splitEvenly(prev.value, count)
                            : Array(count).fill("")
                          : [],
                      isCustomInstallments: false,
                      startInstallment: prev.category === "ແອ" ? 1 : prev.startInstallment,
                    }));
                  }}
                  styles={selectStyles}
                  placeholder="ເລືອກ..."
                />
              </div>

              <div>
                <label className={labelCls}>ເລີ່ມງວດທີ</label>
                <Select
                  isDisabled={currentItem.category === "ແອ" || !currentItem.paymentFrequency}
                  options={Array.from({ length: maxStart }, (_, i) => ({
                    value: String(i + 1),
                    label: `ງວດ ${i + 1}`,
                  }))}
                  value={
                    currentItem.startInstallment
                      ? {
                          value: String(currentItem.startInstallment),
                          label: `ງວດ ${currentItem.startInstallment}`,
                        }
                      : null
                  }
                  onChange={(o: any) =>
                    setCurrentItem((prev: any) => ({
                      ...prev,
                      startInstallment: Number(o?.value || 0),
                    }))
                  }
                  styles={selectStyles}
                  placeholder="ເລືອກ..."
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelCls}>
                  ມູນຄ່າ ({selectedCurrency.label})
                </label>
                <input
                  type="number"
                  className={inputCls}
                  value={currentItem.value}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    const count = Number(currentItem.paymentFrequency) || 0;
                    setCurrentItem((prev: any) => ({
                      ...prev,
                      value: nextValue,
                      installments:
                        !prev.isCustomInstallments && count > 0
                          ? Number(nextValue) > 0
                            ? splitEvenly(Number(nextValue), count)
                            : Array(count).fill("")
                          : prev.installments,
                    }));
                  }}
                  placeholder="0.00"
                />
              </div>
            </div>

            {Number(currentItem.paymentFrequency) > 0 && (
              <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-[var(--text-soft)]">
                    ກະຈາຍງວດຊຳລະ
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={autoDistributeInstallments}
                      className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors"
                    >
                      ກະຈາຍເທົ່າກັນ
                    </button>
                    <span className="font-mono text-[11.5px] font-semibold tabular-nums text-[var(--text)]">
                      {formatCurrencyAmount(sumValues(currentItem.installments), currencyCode)}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 lg:grid-cols-4">
                  {currentItem.installments.map((value: string, index: number) => (
                    <div key={index} className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[var(--text-mute)]">
                        {index + 1}
                      </span>
                      <input
                        type="number"
                        className="block h-8 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] pl-7 pr-2 text-right text-[12.5px] tabular-nums text-[var(--text)] hover:border-[var(--border-strong)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                        value={value}
                        placeholder="0"
                        onChange={(e) => {
                          const next = [...currentItem.installments];
                          next[index] = e.target.value;
                          setCurrentItem((prev: any) => ({
                            ...prev,
                            installments: next,
                            isCustomInstallments: true,
                            value: sumValues(next).toFixed(2),
                          }));
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--brand)] text-[13px] font-medium text-white hover:bg-[var(--brand-hover)] transition-colors"
            >
              <Plus size={14} />
              ເພີ່ມລາຍການເຂົ້າສັນຍາ
            </button>
          </div>
        </Section>
      </div>

      {/* Items list + installment preview */}
      <Section
        title={`ລາຍການສັນຍາ (${productItems.length})`}
        hint="ກວດກ່ອນບັນທຶກ"
      >
        {productItems.length === 0 ? (
          <div className="flex min-h-[140px] flex-col items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] text-center">
            <div className="text-[13px] font-medium text-[var(--text)]">
              ຍັງບໍ່ມີລາຍການ
            </div>
            <div className="mt-1 text-[11.5px] text-[var(--text-mute)]">
              ເລືອກປະເພດ ແລະ ກົດ ເພີ່ມລາຍການເຂົ້າສັນຍາ
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            {/* Items */}
            <div className="space-y-2">
              {productItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
                >
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[12px] font-semibold text-[var(--text-soft)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-[var(--text)]">
                      {item.categoryLabel || item.category}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-[var(--text-mute)]">
                      <span>{item.paymentFrequency} ງວດ</span>
                      {item.category !== "ແອ" && (
                        <span>· ເລີ່ມງວດ {item.startInstallment}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[13px] font-semibold tabular-nums text-[var(--text)]">
                      {formatCurrencyAmount(parseFloat(item.value), currencyCode)}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setProductItems((prev) => prev.filter((e) => e.id !== item.id))
                      }
                      className="mt-0.5 text-[10.5px] text-[var(--danger)] hover:underline"
                    >
                      ລຶບ
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Installment preview */}
            <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-soft)] p-3">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-mute)]">
                ພາບລວມງວດຊຳລະ
              </div>
              {previewSchedule.length === 0 ? (
                <div className="rounded-[var(--radius-sm)] bg-[var(--surface)] px-3 py-4 text-center text-[11.5px] text-[var(--text-mute)]">
                  ຈະສະແດງຫຼັງເພີ່ມລາຍການ
                </div>
              ) : (
                <div className="space-y-1.5">
                  {previewSchedule.map((s) => (
                    <div
                      key={s.installment_no}
                      className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px]"
                    >
                      <span className="text-[var(--text-soft)]">ງວດ {s.installment_no}</span>
                      <span className="font-mono font-semibold tabular-nums text-[var(--text)]">
                        {formatCurrencyAmount(s.total, currencyCode)}
                      </span>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center justify-between border-t border-[var(--border-soft)] pt-2 text-[12.5px]">
                    <span className="font-semibold text-[var(--text)]">ລວມ</span>
                    <span className="font-mono text-[13.5px] font-bold tabular-nums text-[var(--text)]">
                      {formatCurrencyAmount(totalAmount, currencyCode)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* Sticky footer */}
      <div className="sticky bottom-3 z-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={[
                "inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full",
                isReady
                  ? "bg-[var(--success-soft)] text-[var(--success)]"
                  : "bg-[var(--warning-soft)] text-[var(--warning)]",
              ].join(" ")}
            >
              <CheckCircle2 size={12} />
            </span>
            <span className="text-[12.5px] text-[var(--text-soft)] truncate">
              ກວດຄົບ {completedRequired}/{requiredChecks.length} ລາຍການຫຼັກ
            </span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/sale-admin/list-project")}
              className="inline-flex h-9 items-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors"
            >
              ຍົກເລີກ
            </button>
            <button
              type="submit"
              disabled={loading || !isReady}
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--brand)] px-4 text-[13px] font-medium text-white hover:bg-[var(--brand-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={13} />
              {loading ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກສັນຍາ"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
