"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import Select from "react-select";
import Swal from "sweetalert2";
import {
  ArrowLeft as FiArrowLeft,
  FileText as FiFileText,
  Plus as FiPlus,
  Save as FiSave,
  Trash2 as FiTrash2,
  Upload as FiUpload,
} from "lucide-react";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

const getTodayDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const splitEvenly = (total, count) => {
  const amount = Number(total) || 0;
  if (count <= 0) return [];

  const base = Math.floor((amount / count) * 100) / 100;
  let remainder = Math.round((amount - base * count) * 100) / 100;
  const installments = [];

  for (let i = 0; i < count; i++) {
    let value = base;
    if (remainder > 0) {
      value = Math.round((base + 0.01) * 100) / 100;
      remainder -= 0.01;
    }
    installments.push(value.toFixed(2));
  }

  return installments;
};

const sumValues = (arr = []) =>
  arr.reduce((sum, value) => sum + (parseFloat(value) || 0), 0);

const getCurrencyMeta = (code = "LAK") =>
  currencyOptions.find((item) => item.value === code) || currencyOptions[0];

const formatCurrencyAmount = (amount, code = "LAK") => {
  const meta = getCurrencyMeta(code);
  const num = Number(amount || 0);
  const digits = meta.value === "LAK" ? 0 : 2;

  return `${meta.symbol} ${num.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
};

const parseQuotationItems = (items) => {
  if (Array.isArray(items)) return items;
  if (typeof items !== "string" || !items.trim()) return [];

  try {
    const parsed = JSON.parse(items);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getQuotationProductLabel = (item, index) =>
  item?.productName ||
  item?.product_name ||
  item?.item_name ||
  item?.description ||
  `ລາຍການ ${index + 1}`;

const getQuotationLineTotal = (item) => {
  const directTotal =
    Number(item?.total) ||
    Number(item?.amount) ||
    Number(item?.line_total) ||
    Number(item?.total_amount);
  if (directTotal > 0) return directTotal;

  const quantity = Number(item?.quantity || item?.qty || 0);
  const unitPrice = Number(item?.unit_price || item?.price || 0);
  return quantity * unitPrice;
};

const mapQuotationItemsToContractItems = (quotation, currencyCode = "LAK") => {
  const rows = parseQuotationItems(quotation?.items);
  return rows
    .filter((item) => !item?.type || item.type === "product")
    .map((item, index) => {
      const total = getQuotationLineTotal(item);
      const label = getQuotationProductLabel(item, index);
      const installments = splitEvenly(total, 1);

      return {
        id: `quotation-${quotation?.id || "new"}-${index}-${Date.now()}`,
        category: label,
        categoryLabel: label,
        value: total.toFixed(2),
        paymentFrequency: "1",
        averagePerPayment: total.toFixed(2),
        installments,
        isCustomInstallments: false,
        startInstallment: 1,
        sourceQuotationId: quotation?.id,
        sourceQuotationNo: quotation?.quotation_no,
        sourceQuotationCurrency: currencyCode,
        sourceQuotationItem: item,
      };
    })
    .filter((item) => Number(item.value) > 0);
};

const buildInstallmentSchedule = (items = []) => {
  const maxInstallments = items.reduce((max, item) => {
    const start = Number(item.startInstallment) || 1;
    const len = item.installments?.length || 0;
    return Math.max(max, start + len - 1);
  }, 0);

  return Array.from({ length: maxInstallments }).map((_, idx) => {
    const installmentNo = idx + 1;
    let total = 0;
    const itemDetails = items.map((item, itemIdx) => {
      const start = Number(item.startInstallment || 1);
      const pos = installmentNo - start;
      const amount = pos >= 0 ? Number(item.installments?.[pos] || 0) : 0;
      total += amount;
      return {
        item_index: itemIdx + 1,
        category: item.category,
        amount,
      };
    });

    return {
      installment_no: installmentNo,
      total,
      items: itemDetails,
    };
  });
};

const inputBase =
  "block w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors";
const inputDefault = `${inputBase} border-[var(--theme-border-subtle)] bg-white text-slate-800 hover:border-slate-300 focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[rgba(15,118,110,0.12)]`;
const inputDisabled = `${inputBase} cursor-not-allowed border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] text-slate-500`;
const labelStyle =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-600";

const customSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 42,
    padding: 1,
    borderRadius: 10,
    borderColor: state.isFocused ? "var(--theme-primary)" : "#e2e8f0",
    backgroundColor: "#ffffff",
    boxShadow: state.isFocused ? "0 0 0 4px rgba(15,118,110,0.12)" : "none",
    "&:hover": {
      borderColor: "#cbd5e1",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "0 8px",
  }),
  indicatorsContainer: (base) => ({
    ...base,
    paddingRight: 6,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "var(--theme-primary)"
      : state.isFocused
        ? "#e6fffb"
        : "#ffffff",
    color: state.isSelected ? "#ffffff" : "#0f172a",
    fontSize: 13,
    cursor: "pointer",
  }),
  placeholder: (base) => ({
    ...base,
    color: "#94a3b8",
    fontSize: 13,
  }),
  singleValue: (base) => ({
    ...base,
    color: "#0f172a",
    fontSize: 13,
  }),
};

export default function RequestProjectCreation() {
  const { projectId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuotationId = searchParams.get("quotationId") || "";

  const emptyItem = {
    id: null,
    category: "",
    value: "",
    paymentFrequency: "",
    averagePerPayment: "",
    installments: [],
    isCustomInstallments: false,
    startInstallment: null,
  };

  type AttachedFileItem = {
    file: File;
    preview: string | null;
  };

  const [loading, setLoading] = useState(false);
  const [existingProject, setExistingProject] = useState(null);
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
  const [productItems, setProductItems] = useState([]);
  const [currentItem, setCurrentItem] = useState(emptyItem);
  const [custCode, setCustCode] = useState("");
  const [quotationOptions, setQuotationOptions] = useState([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState("");
  const [quotationLoading, setQuotationLoading] = useState(false);
  const [quotationImportSummary, setQuotationImportSummary] = useState("");
  const [autoImportedQuotationId, setAutoImportedQuotationId] = useState("");

  const storageKey = `projDraft-${projectId || "new"}`;

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          headers: _getAuthHeaders(),
        });
        const json = await res.json();
        const data = json?.data;

        if (!res.ok || !data || cancelled) return;

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

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    (async () => {
      setQuotationLoading(true);
      try {
        const res = await fetch(`/api/quotations?project_id=${projectId}`, {
          headers: _getAuthHeaders(),
        });
        const json = await res.json();
        const rows = json?.data?.data || json?.data || [];

        if (!res.ok || cancelled) return;

        setQuotationOptions(
          rows.map((quotation) => ({
            value: String(quotation.id),
            label: `${quotation.quotation_no || `QT-${quotation.id}`} · ${
              quotation.customer_name || quotation.project_name || "ບໍ່ມີຊື່ລູກຄ້າ"
            } · ${formatCurrencyAmount(quotation.total_amount, currencyCode)}`,
            quotation,
          })),
        );
      } catch (err) {
        console.error("Load quotations error:", err);
      } finally {
        if (!cancelled) setQuotationLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, currencyCode]);

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
      setQuotationImportSummary(draft.quotationImportSummary || "");
      setContractDate(draft.contractDate || getTodayDate());
      setStartDate(draft.startDate || getTodayDate());
    } catch (err) {
      console.error("Load draft error:", err);
    }
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
      quotationImportSummary,
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
    quotationImportSummary,
    storageKey,
  ]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const nextFiles = files.map((file) => ({
      file,
      preview: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null,
    }));
    setAttachedFiles((prev) => [...prev, ...nextFiles]);
  };

  const validateRequiredFields = () => {
    if (
      !contractNumber ||
      !contractName ||
      !contractDate ||
      !contactName ||
      !startDate
    ) {
      Swal.fire({
        title: "ຂໍ້ມູນບໍ່ຄົບ",
        text: "ກະລຸນາກອກຂໍ້ມູນທີ່ມີເຄື່ອງໝາຍ * ໃຫ້ຄົບຖ້ວນ",
        icon: "warning",
        confirmButtonColor: "var(--theme-primary)",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateRequiredFields()) return;

    if (productItems.length === 0) {
      Swal.fire("Warning", "ກະລຸນາເພີ່ມສິນຄ້າຢ່າງນ້ອຍ 1 ລາຍການ", "warning");
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
          productCategoryOptions.find((category) => category.value === item.category)
            ?.label ||
          item.category;
        return {
          ...item,
          value,
          installments: item.installments.map(
            (installment) => parseFloat(installment) || 0,
          ),
          averagePerPayment: (value / count).toFixed(2),
          category_label: categoryLabel,
          source_quotation_id: item.sourceQuotationId || selectedQuotationId || null,
          source_quotation_no: item.sourceQuotationNo || null,
          source_quotation_item: item.sourceQuotationItem || null,
        };
      });

      const response = await fetch("/api/project-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ..._getAuthHeaders(),
        },
        body: JSON.stringify({
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
        }),
      });

      if (!response.ok) {
        throw new Error("Submit failed");
      }

      Swal.fire({
        title: "Success",
        text: "ບັນທຶກສຳເລັດ",
        icon: "success",
        confirmButtonColor: "var(--theme-primary)",
      });

      if (typeof window !== "undefined") {
        localStorage.removeItem(storageKey);
      }

      router.push("/sale-admin/listproject");
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່ລະບົບ", "error");
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = sumValues(productItems.map((item) => item.value));
  const selectedCurrency = getCurrencyMeta(currencyCode);
  const availableCats = productCategoryOptions.filter(
    (option) => !productItems.some((item) => item.category === option.value),
  );
  const airItem = productItems.find((item) => item.category === "ແອ");
  const maxStart = airItem ? Number(airItem.paymentFrequency) || 12 : 12;

  useEffect(() => {
    setCurrentItem((prev) => {
      if (prev.category === "ແອ") {
        return prev.startInstallment === 1
          ? prev
          : { ...prev, startInstallment: 1 };
      }

      if (!prev.startInstallment) return prev;

      const clamped = Math.min(prev.startInstallment, maxStart);
      return clamped === prev.startInstallment
        ? prev
        : { ...prev, startInstallment: clamped };
    });
  }, [maxStart, currentItem.category]);

  const previewSchedule = buildInstallmentSchedule(
    productItems.map((item) => ({
      ...item,
      value: parseFloat(item.value) || 0,
      installments: item.installments.map((value) => parseFloat(value) || 0),
      category_label: item.categoryLabel,
    })),
  );

  const readinessItems = [
    {
      label: "ຂໍ້ມູນຫົວສັນຍາ",
      note: "ເລກທີສັນຍາ ແລະ ຊື່ສັນຍາ",
      ready: Boolean(contractNumber && contractName),
      optional: false,
    },
    {
      label: "ວັນທີ ແລະ ຜູ້ຕິດຕໍ່",
      note: "ວັນທີສັນຍາ, ວັນເລີ່ມ ແລະ ຊື່ຜູ້ຕິດຕໍ່",
      ready: Boolean(contractDate && startDate && contactName),
      optional: false,
    },
    {
      label: "ລາຍການສັນຍາ",
      note: "ຢ່າງນ້ອຍ 1 ລາຍການ",
      ready: productItems.length > 0,
      optional: false,
    },
    {
      label: "ໄຟລ໌ແນບ",
      note: "ເພີ່ມໄດ້ພາຍຫຼັງ ແຕ່ຄວນມີກ່ອນສົ່ງ",
      ready: attachedFiles.length > 0,
      optional: true,
    },
  ];

  const requiredChecks = readinessItems.filter((item) => !item.optional);
  const completedRequiredChecks = requiredChecks.filter(
    (item) => item.ready,
  ).length;
  const readinessPercent = requiredChecks.length
    ? (completedRequiredChecks / requiredChecks.length) * 100
    : 0;

  const sectionOverview = [
    {
      id: "contract-core",
      index: "01",
      title: "ຫົວສັນຍາ",
      note: "ເລກທີ, ຊື່, ວັນທີ, ສະກຸນເງິນ",
    },
    {
      id: "contract-context",
      index: "02",
      title: "ຂໍ້ມູນຂາຍ",
      note: "ຜູ້ຕິດຕໍ່, sales model, ຍີ່ຫໍ້, ໝາຍເຫດ",
    },
    {
      id: "contract-files",
      index: "03",
      title: "ໄຟລ໌ປະກອບ",
      note: "ແນບເອກະສານທີ່ຈະໃຊ້ໃນການອະນຸມັດ",
    },
    {
      id: "contract-package",
      index: "04",
      title: "Package ສັນຍາ",
      note: "ເພີ່ມລາຍການ, ງວດ ແລະ ກວດຍອດລວມ",
    },
  ];

  const projectReference =
    existingProject?.project_code ||
    existingProject?.sml_code ||
    existingProject?.id ||
    projectId ||
    "-";

  const autoDistributeInstallments = () => {
    const count = Number(currentItem.paymentFrequency) || 0;
    const amount = Number(currentItem.value) || 0;

    if (count <= 0 || amount <= 0) {
      Swal.fire(
        "Warning",
        "ກະລຸນາເລືອກຈຳນວນງວດ ແລະ ປ້ອນມູນຄ່າລາຍການກ່ອນ",
        "warning",
      );
      return;
    }

    setCurrentItem((prev) => ({
      ...prev,
      installments: splitEvenly(amount, count),
      isCustomInstallments: false,
    }));
  };

  const importQuotationItems = async (quotationId) => {
    if (!quotationId) {
      Swal.fire(
        "Warning",
        "ກະລຸນາເລືອກໃບສະເໜີລາຄາກ່ອນ",
        "warning",
      );
      return;
    }

    setQuotationLoading(true);

    try {
      const selectedOption = quotationOptions.find(
        (option) => option.value === quotationId,
      );
      let quotation = selectedOption?.quotation;

      const items = parseQuotationItems(quotation?.items);
      if (!quotation || items.length === 0) {
        const res = await fetch(`/api/quotations/${quotationId}`, {
          headers: _getAuthHeaders(),
        });
        const json = await res.json();
        if (!res.ok) throw new Error("Quotation not found");
        quotation = json?.data?.data || json?.data || json;
      }

      const importedItems = mapQuotationItemsToContractItems(
        quotation,
        currencyCode,
      );

      if (importedItems.length === 0) {
        Swal.fire(
          "Warning",
          "ໃບສະເໜີລາຄານີ້ບໍ່ມີລາຍການສິນຄ້າທີ່ດຶງໄດ້",
          "warning",
        );
        return;
      }

      setSelectedQuotationId(String(quotationId));
      setProductItems(importedItems);
      setContactName((prev) => prev || quotation?.customer_name || "");
      setContractName(
        (prev) =>
          prev ||
          quotation?.project_name ||
          projectName ||
          quotation?.quotation_no ||
          "",
      );
      setProjectDescription((prev) => prev || quotation?.notes || quotation?.terms || "");
      setQuotationImportSummary(
        `${quotation?.quotation_no || "ໃບສະເໜີລາຄາ"} · ${
          importedItems.length
        } ລາຍການ · ${formatCurrencyAmount(
          sumValues(importedItems.map((item) => item.value)),
          currencyCode,
        )}`,
      );

      Swal.fire({
        title: "ດຶງລາຍການສຳເລັດ",
        text: `ນຳເຂົ້າ ${importedItems.length} ລາຍການຈາກໃບສະເໜີລາຄາ`,
        icon: "success",
        confirmButtonColor: "var(--theme-primary)",
      });
    } catch (err) {
      console.error("Import quotation items error:", err);
      Swal.fire(
        "Error",
        "ດຶງລາຍການຈາກໃບສະເໜີລາຄາບໍ່ສຳເລັດ",
        "error",
      );
    } finally {
      setQuotationLoading(false);
    }
  };

  const handleImportQuotationItems = async () => {
    await importQuotationItems(selectedQuotationId);
  };

  useEffect(() => {
    if (
      !initialQuotationId ||
      quotationOptions.length === 0 ||
      autoImportedQuotationId === initialQuotationId
    ) {
      return;
    }

    const exists = quotationOptions.some((option) => option.value === initialQuotationId);
    if (!exists) return;

    setProductItems([]);
    setQuotationImportSummary("");
    setAutoImportedQuotationId(initialQuotationId);
    void importQuotationItems(initialQuotationId);
  }, [initialQuotationId, quotationOptions, autoImportedQuotationId]);

  const handleAddItem = () => {
    if (!currentItem.category || !currentItem.paymentFrequency) {
      Swal.fire("Warning", "ກະລຸນາເລືອກຂໍ້ມູນລາຍການໃຫ້ຄົບ", "warning");
      return;
    }

    const count = Number(currentItem.paymentFrequency);
    if (currentItem.category !== "ແອ" && !currentItem.startInstallment) {
      Swal.fire("Warning", "ກະລຸນາເລືອກງວດເລີ່ມ", "warning");
      return;
    }

    const hasManual =
      sumValues(currentItem.installments) > 0 &&
      currentItem.installments.length === count;
    const installments = hasManual
      ? currentItem.installments
      : splitEvenly(currentItem.value || 0, count);

    if (sumValues(installments) <= 0) {
      Swal.fire("Warning", "ກະລຸນາປ້ອນມູນຄ່າລາຍການ", "warning");
      return;
    }

    setProductItems((prev) => [
      ...prev,
      {
        ...currentItem,
        id: Date.now(),
        installments,
        value: sumValues(installments).toFixed(2),
        categoryLabel: productCategoryOptions.find(
          (category) => category.value === currentItem.category,
        )?.label,
      },
    ]);
    setCurrentItem(emptyItem);
  };

  return (
    <div className="min-h-screen bg-[#f3f7fc] pb-24">
      <div className="mx-auto max-w-[1500px] px-4 py-6 lg:px-6">
        <div className="overflow-hidden rounded-lg border border-[var(--theme-primary)]/12 bg-white shadow-[0_24px_60px_-40px_rgba(15,35,63,0.35)]">
          <div className="bg-[linear-gradient(135deg,var(--theme-primary-strong)_0%,var(--theme-primary)_58%,var(--theme-primary-soft)_100%)] px-6 py-6 text-white md:px-8">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/90 transition hover:bg-white/15"
            >
              <FiArrowLeft size={13} />
              <span>ກັບໄປລາຍການ</span>
            </button>

            <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex rounded-full bg-white/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/72">
                  Contract Workspace
                </div>
                <h1 className="mt-3 text-2xl font-semibold leading-tight md:text-3xl">
                  {projectName || "ສ້າງສັນຍາໃໝ່"}
                </h1>
                <p className="mt-2 text-sm leading-6 text-white/78">
                  ລວບຂໍ້ມູນສັນຍາ, ຂໍ້ມູນຂາຍ, ໄຟລ໌ປະກອບ ແລະ package ໄວ້ໃນໜ້າດຽວ
                  ເພື່ອໃຫ້ກວດແລະບັນທຶກໄດ້ໄວຂຶ້ນ.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryTile
                  label="Project Ref"
                  value={String(projectReference)}
                  hint="ອ້າງອີງໂຄງການ"
                  mono
                />
                <SummaryTile
                  label="Currency"
                  value={selectedCurrency.value}
                  hint={selectedCurrency.label}
                />
                <SummaryTile
                  label="Items"
                  value={String(productItems.length)}
                  hint="ລາຍການໃນສັນຍາ"
                />
                <SummaryTile
                  label="Total"
                  value={formatCurrencyAmount(totalAmount, currencyCode)}
                  hint="ຍອດລວມປັດຈຸບັນ"
                  dark
                />
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--theme-border-subtle)] bg-[#f8fbff] px-6 py-4 md:px-8">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {sectionOverview.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="rounded-lg border border-[var(--theme-border-subtle)] bg-white px-4 py-3 transition hover:border-[var(--theme-primary)]/25 hover:shadow-sm"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--theme-primary)]">
                    {section.index}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {section.title}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {section.note}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-lg border border-[var(--theme-border-subtle)] bg-white p-5 shadow-[0_20px_50px_-40px_rgba(15,35,63,0.4)]">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--theme-primary)]">
                    Readiness
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-slate-900">
                    ຄວາມພ້ອມກ່ອນບັນທຶກ
                  </h3>
                </div>
                <div className="rounded-full bg-[var(--theme-primary-tint)] px-2.5 py-1 text-[11px] font-semibold text-[var(--theme-primary)]">
                  {completedRequiredChecks}/{requiredChecks.length}
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--theme-primary)_0%,var(--theme-primary-soft)_100%)]"
                  style={{ width: `${readinessPercent}%` }}
                />
              </div>

              <div className="mt-4 space-y-3">
                {readinessItems.map((item) => (
                  <ReadinessRow
                    key={item.label}
                    label={item.label}
                    note={item.note}
                    ready={item.ready}
                    optional={item.optional}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--theme-border-subtle)] bg-white p-5 shadow-[0_20px_50px_-40px_rgba(15,35,63,0.4)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--theme-primary)]">
                Quick View
              </div>
              <h3 className="mt-2 text-base font-semibold text-slate-900">
                ພາບລວມສັນຍາ
              </h3>

              <div className="mt-4 space-y-3">
                <InfoRow
                  label="Project Ref"
                  value={String(projectReference)}
                  mono
                />
                <InfoRow label="ເລກທີສັນຍາ" value={contractNumber || "-"} />
                <InfoRow label="ຊື່ສັນຍາ" value={contractName || "-"} />
                <InfoRow label="ຜູ້ຕິດຕໍ່" value={contactName || "-"} />
                <InfoRow label="ວັນທີສັນຍາ" value={contractDate || "-"} />
                <InfoRow
                  label="ໄຟລ໌ປະກອບ"
                  value={`${attachedFiles.length} ໄຟລ໌`}
                />
              </div>
            </div>

            <div className="rounded-lg border border-[var(--theme-border-subtle)] bg-[#f8fbff] p-5 shadow-[0_20px_50px_-40px_rgba(15,35,63,0.4)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--theme-primary)]">
                After Save
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                ຫຼັງບັນທຶກສັນຍາ ລະບົບຈະນຳເຂົ້າຄິວຂໍອະນຸມັດ.
                ຖ້າຂໍ້ມູນແລະໄຟລ໌ປະກອບຄົບ ຝ່າຍກວດສອບຈະເຮັດວຽກຕໍ່ໄດ້ໄວຂຶ້ນ.
              </p>
            </div>
          </aside>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 2xl:grid-cols-2">
              <section
                id="contract-core"
                className="rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-[0_20px_50px_-40px_rgba(15,35,63,0.4)]"
              >
                <div className="border-b border-[var(--theme-border-subtle)] px-6 py-5">
                  <SectionLead
                    index="01"
                    title="ຫົວສັນຍາ ແລະ ຂໍ້ມູນອ້າງອີງ"
                    description="ສ່ວນຫຼັກຂອງສັນຍາ ເພື່ອໃຫ້ອ້າງອີງໄດ້ຖືກຕ້ອງ."
                  />
                </div>

                <div className="grid gap-5 p-6 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className={labelStyle}>ຊື່ໂຄງການ</label>
                    <input
                      type="text"
                      className={inputDisabled}
                      value={projectName}
                      readOnly
                      placeholder="ດຶງຈາກໂຄງການ"
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>
                      ເລກທີສັນຍາ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className={inputDefault}
                      required
                      value={contractNumber}
                      onChange={(e) => setContractNumber(e.target.value)}
                      placeholder="CTR-2026-001"
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>
                      ຊື່ສັນຍາ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className={inputDefault}
                      required
                      value={contractName}
                      onChange={(e) => setContractName(e.target.value)}
                      placeholder="ສັນຍາຈັດຊື້ ແລະ ຕິດຕັ້ງ"
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>
                      ວັນທີສັນຍາ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      className={inputDefault}
                      required
                      value={contractDate}
                      onChange={(e) => setContractDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>
                      ວັນເລີ່ມໂຄງການ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      className={inputDefault}
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>ສະກຸນເງິນ</label>
                    <Select
                      options={currencyOptions}
                      value={currencyOptions.find(
                        (option) => option.value === currencyCode,
                      )}
                      onChange={(option) =>
                        setCurrencyCode(option?.value || "LAK")
                      }
                      styles={customSelectStyles}
                      placeholder="ເລືອກ..."
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>ລະຫັດອ້າງອີງ / SML</label>
                    <input
                      type="text"
                      className={inputDefault}
                      value={custCode}
                      onChange={(e) => setCustCode(e.target.value)}
                      placeholder="ຖ້າມີ"
                    />
                  </div>
                </div>
              </section>

              <section
                id="contract-context"
                className="rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-[0_20px_50px_-40px_rgba(15,35,63,0.4)]"
              >
                <div className="border-b border-[var(--theme-border-subtle)] px-6 py-5">
                  <SectionLead
                    index="02"
                    title="ຂໍ້ມູນຕິດຕໍ່ ແລະ ຂໍ້ມູນຂາຍ"
                    description="ເພີ່ມ context ທາງການຂາຍໃຫ້ຝ່າຍກວດສອບເຫັນຮູບພາບຊັດ."
                  />
                </div>

                <div className="grid gap-5 p-6 md:grid-cols-2">
                  <div>
                    <label className={labelStyle}>
                      ຊື່ຜູ້ຕິດຕໍ່ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className={inputDefault}
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="ຊື່ ແລະ ນາມສະກຸນ"
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>ຮູບແບບການຂາຍ</label>
                    <Select
                      options={salesModelOptions}
                      value={salesModelOptions.find(
                        (option) => option.value === salesModel,
                      )}
                      onChange={(option) => setSalesModel(option?.value || "")}
                      styles={customSelectStyles}
                      placeholder="ເລືອກ..."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelStyle}>ຍີ່ຫໍ້ຫຼັກ</label>
                    <Select
                      options={productBrandOptions}
                      value={productBrandOptions.find(
                        (option) => option.value === productBrand,
                      )}
                      onChange={(option) =>
                        setProductBrand(option?.value || "")
                      }
                      styles={customSelectStyles}
                      placeholder="ເລືອກ..."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelStyle}>ລາຍລະອຽດ / ໝາຍເຫດ</label>
                    <textarea
                      rows={7}
                      className={`${inputDefault} min-h-[180px] resize-y`}
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="ບັນທຶກຂອບເຂດວຽກ, ເງື່ອນໄຂພິເສດ ຫຼື ຂໍ້ສັງເກດ..."
                    />
                  </div>
                </div>
              </section>
            </div>

            <div className="grid gap-6 2xl:grid-cols-[360px_minmax(0,1fr)]">
              <section
                id="contract-files"
                className="rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-[0_20px_50px_-40px_rgba(15,35,63,0.4)]"
              >
                <div className="border-b border-[var(--theme-border-subtle)] px-6 py-5">
                  <SectionLead
                    index="03"
                    title="ເອກະສານປະກອບ"
                    description="ແນບໄຟລ໌ທີ່ຈະໃຊ້ໃນການກວດສອບສັນຍາ."
                  />
                </div>

                <div className="p-6">
                  <label className="flex h-44 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[var(--theme-primary)]/20 bg-[#f8fbff] px-6 text-center transition hover:border-[var(--theme-primary)]/35 hover:bg-[var(--theme-primary-tint)]">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-white text-[var(--theme-primary)] shadow-sm">
                      <FiUpload size={18} />
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      ອັບໂຫຼດເອກະສານສັນຍາ
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      PDF, JPG, PNG ຫຼື ໄຟລ໌ປະກອບອື່ນໆ ເພື່ອໃຊ້ໃນຂັ້ນຕອນອະນຸມັດ
                    </div>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>

                  <div className="mt-4 space-y-3">
                    {attachedFiles.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] px-4 py-6 text-center text-sm text-[var(--theme-text-mute)]">
                        ຍັງບໍ່ມີໄຟລ໌ແນບ
                      </div>
                    ) : (
                      attachedFiles.map((fileItem, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 rounded-lg border border-[var(--theme-border-subtle)] bg-white px-3 py-3"
                        >
                          {fileItem.preview ? (
                            <img
                              src={fileItem.preview}
                              alt=""
                              className="h-12 w-12 rounded-md object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                              <FiFileText />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {fileItem.file.name}
                            </p>
                            <p className="text-[11px] text-[var(--theme-text-mute)]">
                              {(fileItem.file.size / 1024).toFixed(0)} KB
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const nextFiles = [...attachedFiles];
                              nextFiles.splice(index, 1);
                              setAttachedFiles(nextFiles);
                            }}
                            className="rounded-md p-2 text-[var(--theme-text-mute)] transition hover:bg-rose-50 hover:text-rose-500"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-[0_20px_50px_-40px_rgba(15,35,63,0.4)]">
                <div className="border-b border-[var(--theme-border-subtle)] px-6 py-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <SectionLead
                      index="04"
                      title="Package Builder"
                      description="ສ້າງລາຍການສັນຍາ ແລະ ກຳນົດແຜນຊຳລະຂອງແຕ່ລະລາຍການ."
                    />
                    <button
                      type="button"
                      onClick={() => setCurrentItem(emptyItem)}
                      className="rounded-full border border-[var(--theme-border-subtle)] px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-[var(--theme-bg-muted)]"
                    >
                      ລ້າງຟອມ
                    </button>
                  </div>
                </div>

                <div className="space-y-5 p-6">
                  <div className="rounded-lg border border-[rgba(15,118,110,0.16)] bg-[#f8fbff] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                      <div className="min-w-0 flex-1">
                        <label className={labelStyle}>
                          ດຶງລາຍການຈາກໃບສະເໜີລາຄາ
                        </label>
                        <Select
                          isLoading={quotationLoading}
                          isDisabled={quotationLoading}
                          options={quotationOptions}
                          value={
                            quotationOptions.find(
                              (option) => option.value === selectedQuotationId,
                            ) || null
                          }
                          onChange={(option) => {
                            setSelectedQuotationId(option?.value || "");
                            setQuotationImportSummary("");
                          }}
                          styles={customSelectStyles}
                          placeholder={
                            quotationOptions.length === 0
                              ? "ບໍ່ພົບໃບສະເໜີລາຄາໃນໂຄງການນີ້"
                              : "ເລືອກໃບສະເໜີລາຄາ..."
                          }
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleImportQuotationItems}
                        disabled={quotationLoading || !selectedQuotationId}
                        className="inline-flex min-h-[42px] items-center justify-center rounded-md bg-[var(--theme-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--theme-primary-strong)] disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {quotationLoading
                          ? "ກຳລັງດຶງ..."
                          : "ດຶງລາຍການເຂົ້າສັນຍາ"}
                      </button>
                    </div>

                    <div className="mt-3 text-xs leading-5 text-slate-500">
                      {quotationImportSummary ||
                        "ລາຍການສິນຄ້າໃນໃບສະເໜີລາຄາຈະຖືກນຳມາເປັນ package ສັນຍາ. ສາມາດລຶບ ຫຼື ເພີ່ມລາຍການຕໍ່ໄດ້."}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className={labelStyle}>ປະເພດລາຍການ</label>
                      <Select
                        options={availableCats}
                        value={productCategoryOptions.find(
                          (option) => option.value === currentItem.category,
                        )}
                        onChange={(option) =>
                          setCurrentItem((prev) => ({
                            ...prev,
                            category: option?.value || "",
                            paymentFrequency: "",
                            installments: [],
                            value: "",
                            isCustomInstallments: false,
                            startInstallment: option?.value === "ແອ" ? 1 : null,
                          }))
                        }
                        styles={customSelectStyles}
                        placeholder="ເລືອກ..."
                      />
                    </div>

                    <div>
                      <label className={labelStyle}>ຈຳນວນງວດ</label>
                      <Select
                        options={paymentFrequencyOptions}
                        value={paymentFrequencyOptions.find(
                          (option) =>
                            option.value === currentItem.paymentFrequency,
                        )}
                        onChange={(option) => {
                          const count = Number(option?.value) || 0;
                          setCurrentItem((prev) => ({
                            ...prev,
                            paymentFrequency: option?.value || "",
                            installments:
                              count > 0
                                ? Number(prev.value) > 0
                                  ? splitEvenly(prev.value || 0, count)
                                  : Array(count).fill("")
                                : [],
                            isCustomInstallments: false,
                            startInstallment:
                              prev.category === "ແອ"
                                ? 1
                                : prev.startInstallment,
                          }));
                        }}
                        styles={customSelectStyles}
                        placeholder="ເລືອກ..."
                      />
                    </div>

                    <div>
                      <label className={labelStyle}>ເລີ່ມງວດທີ</label>
                      <Select
                        isDisabled={
                          currentItem.category === "ແອ" ||
                          !currentItem.paymentFrequency
                        }
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
                        onChange={(option) =>
                          setCurrentItem((prev) => ({
                            ...prev,
                            startInstallment: Number(option?.value || 0),
                          }))
                        }
                        styles={customSelectStyles}
                        placeholder="ເລືອກ..."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className={labelStyle}>
                        ມູນຄ່າ ({selectedCurrency.label})
                      </label>
                      <input
                        type="number"
                        className={inputDefault}
                        value={currentItem.value}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          const count =
                            Number(currentItem.paymentFrequency) || 0;
                          setCurrentItem((prev) => ({
                            ...prev,
                            value: nextValue,
                            installments:
                              !prev.isCustomInstallments && count > 0
                                ? Number(nextValue) > 0
                                  ? splitEvenly(nextValue, count)
                                  : Array(count).fill("")
                                : prev.installments,
                          }));
                        }}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {Number(currentItem.paymentFrequency) > 0 && (
                    <div className="rounded-lg border border-[rgba(15,118,110,0.16)] bg-[#f8fbff] p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--theme-primary)]">
                            Payment Plan
                          </div>
                          <h4 className="mt-1 text-base font-semibold text-slate-900">
                            ກະຈາຍງວດຊຳລະ
                          </h4>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            ກົດ `ກະຈາຍເທົ່າກັນ` ເພື່ອແບ່ງຍອດອັດຕະໂນມັດ ຫຼື
                            ແກ້ຈຳນວນຂອງແຕ່ລະງວດເອງ.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={autoDistributeInstallments}
                            className="rounded-full border border-[rgba(15,118,110,0.22)] bg-white px-3 py-1.5 text-[11px] font-semibold text-[var(--theme-primary)] transition hover:bg-[var(--theme-primary-tint)]"
                          >
                            ກະຈາຍເທົ່າກັນ
                          </button>
                          <div className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white">
                            {formatCurrencyAmount(
                              sumValues(currentItem.installments),
                              currencyCode,
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-3">
                        {currentItem.installments.map((value, index) => (
                          <div key={index} className="relative">
                            <span className="pointer-events-none absolute left-3 top-2 text-[10px] font-semibold text-[var(--theme-text-mute)]">
                              {index + 1}
                            </span>
                            <input
                              type="number"
                              className="w-full rounded-lg border border-[var(--theme-border-subtle)] bg-white px-3 py-3 pl-10 text-right text-sm font-medium text-slate-800 focus:border-[var(--theme-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/10"
                              value={value}
                              placeholder="0"
                              onChange={(e) => {
                                const nextInstallments = [
                                  ...currentItem.installments,
                                ];
                                nextInstallments[index] = e.target.value;
                                setCurrentItem((prev) => ({
                                  ...prev,
                                  installments: nextInstallments,
                                  isCustomInstallments: true,
                                  value: sumValues(nextInstallments).toFixed(2),
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
                    className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--theme-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--theme-primary-strong)]"
                  >
                    <FiPlus size={14} />
                    ເພີ່ມລາຍການເຂົ້າສັນຍາ
                  </button>
                </div>
              </section>
            </div>

            <section
              id="contract-package"
              className="rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-[0_20px_50px_-40px_rgba(15,35,63,0.4)]"
            >
              <div className="border-b border-[var(--theme-border-subtle)] px-6 py-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <SectionLead
                    index="05"
                    title="ລາຍການທີ່ຈະບັນທຶກເຂົ້າສັນຍາ"
                    description="ກວດ package, ຈຳນວນງວດ ແລະ ຍອດລວມກ່ອນກົດບັນທຶກ."
                  />

                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-full bg-[var(--theme-primary-tint)] px-3 py-1 text-[11px] font-semibold text-[var(--theme-primary)]">
                      {productItems.length} ລາຍການ
                    </div>
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white">
                      {formatCurrencyAmount(totalAmount, currencyCode)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-3">
                  {productItems.length === 0 ? (
                    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] px-6 text-center">
                      <div className="text-sm font-semibold text-slate-700">
                        ຍັງບໍ່ມີລາຍການໃນສັນຍາ
                      </div>
                      <div className="mt-2 max-w-sm text-xs leading-5 text-[var(--theme-text-mute)]">
                        ເລືອກປະເພດລາຍການ, ກຳນົດງວດ ແລະ ກົດ
                        `ເພີ່ມລາຍການເຂົ້າສັນຍາ`
                      </div>
                    </div>
                  ) : (
                    productItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-[var(--theme-border-subtle)] bg-white px-4 py-4 transition hover:border-[var(--theme-primary)]/20 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-700">
                              {index + 1}
                            </div>
                            <div>
                              <div className="text-base font-semibold text-slate-900">
                                {item.categoryLabel}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                                  {item.paymentFrequency} ງວດ
                                </span>
                                {item.category !== "ແອ" && (
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                                    ເລີ່ມງວດ {item.startInstallment}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-semibold text-slate-900">
                              {formatCurrencyAmount(
                                parseFloat(item.value),
                                currencyCode,
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setProductItems((prev) =>
                                  prev.filter((entry) => entry.id !== item.id),
                                )
                              }
                              className="mt-2 text-[11px] font-medium text-rose-500 transition hover:text-rose-600"
                            >
                              ລຶບລາຍການ
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg bg-[linear-gradient(145deg,var(--theme-primary-strong)_0%,var(--theme-primary)_100%)] p-5 text-white">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/72">
                      Submission Summary
                    </div>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between text-white/72">
                        <span>ເລກທີສັນຍາ</span>
                        <span className="font-semibold text-white">
                          {contractNumber || "-"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-white/72">
                        <span>ຜູ້ຕິດຕໍ່</span>
                        <span className="font-semibold text-white">
                          {contactName || "-"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-white/72">
                        <span>ຈຳນວນລາຍການ</span>
                        <span className="font-semibold text-white">
                          {productItems.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-white/72">
                        <span>ຈຳນວນງວດລວມ</span>
                        <span className="font-semibold text-white">
                          {previewSchedule.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/12 pt-3 text-white/86">
                        <span>ມູນຄ່າສັນຍາ</span>
                        <span className="text-base font-semibold text-white">
                          {formatCurrencyAmount(totalAmount, currencyCode)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[var(--theme-border-subtle)] bg-[#f8fbff] p-4">
                    <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--theme-primary)]">
                      Installment Preview
                    </div>
                    {previewSchedule.length === 0 ? (
                      <div className="rounded-lg bg-white px-4 py-5 text-center text-xs text-[var(--theme-text-mute)]">
                        ພາບລວມງວດຈະສະແດງຫຼັງຈາກເພີ່ມລາຍການ
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {previewSchedule.map((schedule) => (
                          <div
                            key={schedule.installment_no}
                            className="flex items-center justify-between rounded-lg bg-white px-3 py-2.5 text-sm"
                          >
                            <span className="font-medium text-slate-600">
                              ງວດທີ {schedule.installment_no}
                            </span>
                            <span className="font-semibold text-slate-900">
                              {formatCurrencyAmount(
                                schedule.total,
                                currencyCode,
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-[var(--theme-border-subtle)] bg-white p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--theme-primary)]">
                      Approval Note
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      ຫຼັງຈາກບັນທຶກສັນຍາ ລະບົບຈະນຳເຂົ້າໜ້າ `ລາຍການຂໍອະນຸມັດ`
                      ເພື່ອໃຫ້ຝ່າຍກ່ຽວຂ້ອງກວດສອບຕໍ່.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div className="sticky bottom-4 z-10 rounded-lg border border-[var(--theme-border-subtle)] bg-white/95 p-4 shadow-[0_24px_60px_-40px_rgba(15,35,63,0.4)] backdrop-blur-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--theme-primary)]">
                    Ready To Submit
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    ກວດຄົບ {completedRequiredChecks}/{requiredChecks.length}{" "}
                    ລາຍການຫຼັກ
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    ກວດຫົວສັນຍາ, ຜູ້ຕິດຕໍ່ ແລະ package ໃຫ້ຄົບ
                    ກ່ອນບັນທຶກເຂົ້າລະບົບ.
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => router.push("/sale-admin/listproject")}
                    className="rounded-full border border-[var(--theme-border-subtle)] px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-[var(--theme-bg-muted)] hover:text-slate-900"
                  >
                    ຍົກເລີກ
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition ${
                      loading
                        ? "cursor-not-allowed bg-slate-400"
                        : "bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-strong)]"
                    }`}
                  >
                    {loading ? (
                      "ກຳລັງບັນທຶກ..."
                    ) : (
                      <>
                        <FiSave className="h-4 w-4" />
                        ບັນທຶກສັນຍາ
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  dark = false,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  dark?: boolean;
  mono?: boolean;
}) {
  const wrapClass = dark
    ? "border-white/10 bg-slate-900/30 text-white"
    : "border-white/10 bg-white/10 text-white";
  const labelClass = dark ? "text-[var(--theme-text-mute)]" : "text-white/72";
  const hintClass = dark ? "text-[var(--theme-text-mute)]" : "text-white/72";

  return (
    <div className={`rounded-md border px-4 py-3 ${wrapClass}`}>
      <div
        className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${labelClass}`}
      >
        {label}
      </div>
      <div
        className={`mt-2 truncate text-base font-semibold ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </div>
      <div className={`mt-1 text-[11px] ${hintClass}`}>{hint}</div>
    </div>
  );
}

function SectionLead({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 rounded-full bg-[var(--theme-primary-tint)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--theme-primary)]">
        <span>{index}</span>
        <span>Section</span>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function ReadinessRow({
  label,
  note,
  ready,
  optional = false,
}: {
  label: string;
  note: string;
  ready: boolean;
  optional?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] px-4 py-3">
      <div
        className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          ready
            ? "bg-emerald-500 text-white"
            : optional
              ? "bg-slate-200 text-slate-500"
              : "bg-rose-100 text-rose-500"
        }`}
      >
        {ready ? "✓" : optional ? "•" : "!"}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-slate-800">{label}</div>
          {optional && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              Optional
            </span>
          )}
        </div>
        <div className="mt-1 text-xs leading-5 text-slate-500">{note}</div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--theme-text-mute)]">
        {label}
      </div>
      <div
        className={`mt-1 text-sm font-semibold text-slate-900 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
