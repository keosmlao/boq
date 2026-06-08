"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createProjectAction, editProjectAction } from "@/_actions/projects";
import Select from "react-select";
import Swal from "sweetalert2";
import {
  ArrowLeft,
  Save,
  Upload,
  MapPin,
  Trash2,
  Navigation,
  X,
  Image as ImageIcon,
} from "lucide-react";

import FormSheet, { FieldGroup, Field } from "@/_components/odoo/FormSheet";
import StatusBar from "@/_components/odoo/StatusBar";
import Chatter from "@/_components/odoo/Chatter";
import { usePageHeader } from "@/_components/PageHeader";
import MapPicker from "@/_components/MapPicker";

/* ─── Constants (mirrors ProjectList.tsx) ─── */
const STATUSES = [
  { id: "ລົງທະບຽນໂຄງການ", short: "ລົງທະບຽນ" },
  { id: "ສຳຫຼວດ ແລະ ອອກແບບ", short: "ສຳຫຼວດ" },
  { id: "ສະເໜີລາຄາ", short: "ສະເໜີລາຄາ" },
  { id: "ເຊັນສັນຍາ", short: "ເຊັນສັນຍາ" },
  { id: "ອະນຸມັດສັນຍາ", short: "ອະນຸມັດສັນຍາ" },
  { id: "ລໍຖ້າບັນຊີກວດສອບ", short: "ລໍຖ້າບັນຊີ" },
  { id: "ລໍຖ້າກຳນົດ BOQ", short: "ລໍຖ້າ BOQ" },
  { id: "ດຳເນີນການຕິດຕັ້ງ", short: "ດຳເນີນຕາມສັນຍາ" },
  { id: "ສຳເລັດ", short: "ສຳເລັດ" },
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
  if (!res.ok) throw new Error(payload?.message || "Request failed");
  return payload;
}

function _asArray(payload: any) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function _asObject(payload: any) {
  if (payload && typeof payload === "object" && payload.data && typeof payload.data === "object") {
    return payload.data;
  }
  return payload && typeof payload === "object" ? payload : {};
}

const composeCoord = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) ? `${lat},${lng}` : "";

const parseLatLng = (coordStr: string) => {
  if (!coordStr) return { lat: NaN, lng: NaN };
  const [a, b] = String(coordStr).split(",").map((s) => s.trim());
  return { lat: parseFloat(a), lng: parseFloat(b) };
};

const toCoordString = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng)
    ? `${lat.toFixed(7)},${lng.toFixed(7)}`
    : "";

const cleanCoordInput = (v: string) =>
  v.replace(/[^\d.,-\s]/g, "").replace(/\s+/g, "").replace(/,+/g, ",");

/* ─── Odoo-style react-select theming (flat, tight) ─── */
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

/* ─── Reusable inline input class (Odoo-flat) ─── */
const inputClass =
  "w-full rounded border border-[var(--theme-border)] bg-white px-2 py-1 text-[12px] text-[var(--theme-text)] placeholder:text-[var(--theme-text-mute)] focus:border-[var(--theme-primary)] focus:outline-none";

/** Compact Odoo-style react-select wrapper used inside the form sheet. */
function OdooSelect(props: {
  value: any;
  options: any[];
  onChange: (opt: any) => void;
  placeholder?: string;
  isClearable?: boolean;
  isLoading?: boolean;
  isDisabled?: boolean;
  noOptionsMessage?: () => string;
  inputId?: string;
  menuPortalTarget?: any;
}) {
  return (
    <Select
      classNamePrefix="react-select"
      styles={selectStyles}
      isClearable={props.isClearable ?? true}
      {...props}
      noOptionsMessage={props.noOptionsMessage ? () => props.noOptionsMessage!() : undefined}
    />
  );
}

export default function CreateProject() {
  const router = useRouter();
  const { id } = useParams() as { id?: string };
  const isEditing = Boolean(id);

  /* ─── Form state (field names preserved exactly) ─── */
  const [formData, setFormData] = useState<any>({
    projectName: "",
    projectDescription: "",
    province: "",
    district: "",
    village: "",
    coordinator: "",
    coordinatorPhone: "",
    registrationDate: "",
    saleStaffId: "",
    saleStaff: "",
    status: STATUSES[0].id,
    businessType: "",
    businessModel: "",
    projectType: "",
    officeCoord: "",
    projectCoord: "",
    imageFiles: [] as File[],
  });

  const [existingImageUrl, setExistingImageUrl] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [provinceOptions, setProvinceOptions] = useState<any[]>([]);
  const [districtOptions, setDistrictOptions] = useState<any[]>([]);
  const [villageOptions, setVillageOptions] = useState<any[]>([]);

  const [saleStaffOptions, setSaleStaffOptions] = useState<any[]>([]);
  const [saleStaffLoading, setSaleStaffLoading] = useState(false);

  const [businessTypeOptions, setBusinessTypeOptions] = useState<any[]>([]);
  const [businessModelOptions, setBusinessModelOptions] = useState<any[]>([]);
  const [projectTypeOptions, setProjectTypeOptions] = useState<any[]>([]);
  const [businessTypeLoading, setBusinessTypeLoading] = useState(false);
  const [businessModelLoading, setBusinessModelLoading] = useState(false);
  const [projectTypeLoading, setProjectTypeLoading] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [locTab, setLocTab] = useState<"office" | "project">("office");
  const [gpsLoading, setGpsLoading] = useState({ office: false, project: false });

  const [pendingLocationNames, setPendingLocationNames] = useState({
    provinceName: "",
    districtName: "",
    villageName: "",
  });
  const [pendingBusinessNames, setPendingBusinessNames] = useState({
    typeName: "",
    modelName: "",
    projectName: "",
  });

  const localPrefillKey = "project_edit_prefill";
  const menuPortalTarget = isClient && typeof document !== "undefined" ? document.body : undefined;

  /* ─── Map server payload → form state ─── */
  const mapProjectToForm = (data: any, prev: any = {}) => {
    const firstStr = (...keys: string[]) => {
      for (const k of keys) {
        const v = data[k];
        if (v !== undefined && v !== null && String(v).trim()) return String(v);
      }
      return "";
    };
    const dateValue = (() => {
      const raw = firstStr(
        "registrationDate",
        "registration_date",
        "date_register",
        "created_at",
        "createdAt",
      ) || prev.registrationDate || "";
      if (!raw) return "";
      const dt = new Date(raw);
      return Number.isNaN(dt.getTime()) ? raw : dt.toISOString().split("T")[0];
    })();
    return {
      ...prev,
      projectName: firstStr("projectName", "project_name") || prev.projectName || "",
      projectDescription:
        firstStr("projectDescription", "project_description", "description") ||
        prev.projectDescription || "",
      province: firstStr("province", "province_code", "province_id", "provinceId") || prev.province || "",
      district: firstStr("district", "district_code", "district_id", "districtId") || prev.district || "",
      village: firstStr("village", "village_code", "village_id", "villageId") || prev.village || "",
      coordinator: firstStr("coordinator", "coordinator_name") || prev.coordinator || "",
      coordinatorPhone:
        firstStr("coordinatorPhone", "coordinator_phone", "phone") || prev.coordinatorPhone || "",
      registrationDate: dateValue,
      saleStaffId:
        firstStr("saleStaffId", "sale_staff_id", "sale_staff_code", "sale_staff") ||
        prev.saleStaffId || "",
      saleStaff: firstStr("saleStaff", "sale_staff_name", "sale_staff") || prev.saleStaff || "",
      status:
        firstStr("status", "project_status") || prev.status || STATUSES[0].id,
      businessType:
        firstStr("businessType", "business_type", "business_type_code", "business_type_id") ||
        prev.businessType || "",
      businessModel:
        firstStr("businessModel", "business_model", "business_model_code", "business_model_id") ||
        prev.businessModel || "",
      projectType:
        firstStr("projectType", "project_type", "project_type_code", "project_type_id") ||
        prev.projectType || "",
      officeCoord:
        firstStr("officeCoord", "office_coord") ||
        composeCoord(Number(data.office_lat ?? data.officeLat), Number(data.office_lng ?? data.officeLng)) ||
        prev.officeCoord || "",
      projectCoord:
        firstStr("projectCoord", "project_coord") ||
        composeCoord(Number(data.project_lat ?? data.projectLat), Number(data.project_lng ?? data.projectLng)) ||
        prev.projectCoord || "",
    };
  };

  /* ─── Effects: bootstrap ─── */
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isEditing || formData.registrationDate) return;
    setFormData((s: any) => ({
      ...s,
      registrationDate: new Date().toISOString().split("T")[0],
    }));
  }, [isEditing, formData.registrationDate]);

  /* ─── Generic cascading loader ─── */
  const loadOptions = async (
    url: string,
    setOpts: (v: any[]) => void,
    setLoading?: (v: boolean) => void,
    autoSelect?: { current: string; nameHint: string; field: keyof typeof formData },
    mapRow: (it: any) => any = (it) => ({
      value: String(it.code ?? it.id),
      label: it.name_1 ?? it.name ?? "Unknown",
    }),
  ) => {
    try {
      setLoading?.(true);
      const rows = _asArray(await _getJson(url));
      const options = rows.map(mapRow);
      setOpts(options);
      if (
        autoSelect &&
        isEditing &&
        !autoSelect.current &&
        autoSelect.nameHint &&
        options.length
      ) {
        const match = options.find(
          (o: any) =>
            String(o.label).trim().toLowerCase() ===
            String(autoSelect.nameHint).trim().toLowerCase(),
        );
        if (match) setFormData((s: any) => ({ ...s, [autoSelect.field]: String(match.value) }));
      }
    } catch (e) {
      console.error("Load failed:", url, e);
      setOpts([]);
    } finally {
      setLoading?.(false);
    }
  };

  /* ─── Provinces / Districts / Villages cascade ─── */
  useEffect(() => {
    loadOptions("/api/provinces", setProvinceOptions, undefined, {
      current: formData.province,
      nameHint: pendingLocationNames.provinceName,
      field: "province",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, pendingLocationNames.provinceName, formData.province]);

  useEffect(() => {
    if (!formData.province) {
      setDistrictOptions([]);
      setVillageOptions([]);
      if (!isEditing) setFormData((s: any) => ({ ...s, district: "", village: "" }));
      return;
    }
    loadOptions(
      `/api/districts?province=${formData.province}`,
      setDistrictOptions,
      undefined,
      {
        current: formData.district,
        nameHint: pendingLocationNames.districtName,
        field: "district",
      },
    );
    if (!isEditing) setFormData((s: any) => ({ ...s, district: "", village: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.province, isEditing, pendingLocationNames.districtName]);

  useEffect(() => {
    if (!formData.province || !formData.district) {
      setVillageOptions([]);
      if (!isEditing) setFormData((s: any) => ({ ...s, village: "" }));
      return;
    }
    loadOptions(
      `/api/villages?province=${formData.province}&district=${formData.district}`,
      setVillageOptions,
      undefined,
      {
        current: formData.village,
        nameHint: pendingLocationNames.villageName,
        field: "village",
      },
    );
    if (!isEditing) setFormData((s: any) => ({ ...s, village: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.district, formData.province, isEditing, pendingLocationNames.villageName]);

  /* ─── Sale staff ─── */
  useEffect(() => {
    loadOptions(
      "/api/sale-staffs",
      setSaleStaffOptions,
      setSaleStaffLoading,
      undefined,
      (it: any) => ({
        value: String(it.code ?? it.id ?? it.staff_code ?? it.staff_id ?? "unknown"),
        label: it.name_1 ?? it.full_name ?? "Unknown",
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Business types / models / project types cascade ─── */
  useEffect(() => {
    loadOptions("/api/business-types", setBusinessTypeOptions, setBusinessTypeLoading, {
      current: formData.businessType,
      nameHint: pendingBusinessNames.typeName,
      field: "businessType",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, pendingBusinessNames.typeName, formData.businessType]);

  useEffect(() => {
    if (!formData.businessType) {
      setBusinessModelOptions([]);
      setProjectTypeOptions([]);
      return;
    }
    loadOptions(
      `/api/business-models?businessType=${formData.businessType}`,
      setBusinessModelOptions,
      setBusinessModelLoading,
      {
        current: formData.businessModel,
        nameHint: pendingBusinessNames.modelName,
        field: "businessModel",
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.businessType, isEditing, pendingBusinessNames.modelName, formData.businessModel]);

  useEffect(() => {
    if (!formData.businessModel) {
      setProjectTypeOptions([]);
      return;
    }
    loadOptions(
      `/api/project-types?businessModel=${formData.businessModel}&businessType=${formData.businessType}`,
      setProjectTypeOptions,
      setProjectTypeLoading,
      {
        current: formData.projectType,
        nameHint: pendingBusinessNames.projectName,
        field: "projectType",
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.businessModel,
    formData.businessType,
    isEditing,
    pendingBusinessNames.projectName,
    formData.projectType,
  ]);

  /* ─── Load existing project (edit mode) ─── */
  useEffect(() => {
    if (isEditing && typeof window !== "undefined") {
      try {
        const cached = window.localStorage.getItem(localPrefillKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          setFormData((s: any) => mapProjectToForm(cachedData, s));
          setPendingLocationNames({
            provinceName: cachedData.province_name ?? "",
            districtName: cachedData.district_name ?? "",
            villageName: cachedData.village_name ?? "",
          });
          setPendingBusinessNames({
            typeName: cachedData.business_type_name ?? "",
            modelName: cachedData.business_model_name ?? "",
            projectName: cachedData.project_type_name ?? "",
          });
          if (cachedData.imageUrl || cachedData.image_url) {
            setExistingImageUrl(cachedData.imageUrl ?? cachedData.image_url);
            setPreviewImage(cachedData.imageUrl ?? cachedData.image_url);
          }
        }
      } catch (err) {
        console.warn("Cannot parse cached project prefill", err);
      }
    }

    if (!isEditing) return;
    let mounted = true;
    (async () => {
      try {
        const data = _asObject(await _getJson(`/api/projects/${id}`));
        if (!mounted) return;
        setFormData((s: any) => ({ ...mapProjectToForm(data, s) }));
        setPendingLocationNames({
          provinceName: data.province_name ?? "",
          districtName: data.district_name ?? "",
          villageName: data.village_name ?? "",
        });
        setPendingBusinessNames({
          typeName: data.business_type_name ?? "",
          modelName: data.business_model_name ?? "",
          projectName: data.project_type_name ?? "",
        });
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(localPrefillKey);
        }
        if (data.imageUrl || data.image_url) {
          setExistingImageUrl(data.imageUrl ?? data.image_url);
          setPreviewImage(data.imageUrl ?? data.image_url);
        }
      } catch (e) {
        console.error("Load project failed:", e);
        Swal.fire("ຜິດພາດ", "ດຶງຂໍ້ມູນໂຄງການບໍ່ສຳເລັດ", "error");
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditing]);

  /* ─── Handlers ─── */
  const handleChange = (e: any) => {
    const { name, value } = e.target;
    if (name === "officeCoord" || name === "projectCoord") {
      setFormData((s: any) => ({ ...s, [name]: cleanCoordInput(value) }));
    } else {
      setFormData((s: any) => ({ ...s, [name]: value }));
    }
  };

  const handleImageChange = (e: any) => {
    const files: File[] = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        Swal.fire("ແຈ້ງເຕືອນ", "ຮູບພາບຈຳເປັນເປັນ image/*", "warning");
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire("ແຈ້ງເຕືອນ", `${file.name} ເກີນ 5MB`, "warning");
        continue;
      }
      valid.push(file);
    }
    if (!valid.length) return;
    setFormData((s: any) => ({ ...s, imageFiles: [...s.imageFiles, ...valid] }));
    setPreviewImage(URL.createObjectURL(valid[0]));
    setExistingImageUrl("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []).filter(
      (f) => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024,
    );
    if (!files.length) return;
    setFormData((s: any) => ({ ...s, imageFiles: [...s.imageFiles, ...files] }));
    setPreviewImage(URL.createObjectURL(files[0]));
    setExistingImageUrl("");
  };

  const removeImageAt = (idx: number) => {
    setFormData((s: any) => {
      const copy = [...s.imageFiles];
      copy.splice(idx, 1);
      return { ...s, imageFiles: copy };
    });
    if (formData.imageFiles.length <= 1) {
      setPreviewImage(null);
      setExistingImageUrl("");
      const el = document.getElementById("imageFile") as HTMLInputElement | null;
      if (el) el.value = "";
    }
  };

  const setCoordFromGPS = (key: "office" | "project") => {
    if (!navigator.geolocation) {
      Swal.fire("ຜິດພາດ", "ບຣາວເຊີບໍ່ຮອງຮັບ Location", "error");
      return;
    }
    setGpsLoading((s) => ({ ...s, [key]: true }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const field = key === "office" ? "officeCoord" : "projectCoord";
        setFormData((s: any) => ({ ...s, [field]: toCoordString(latitude, longitude) }));
        setGpsLoading((s) => ({ ...s, [key]: false }));
      },
      (err) => {
        console.error(err);
        Swal.fire("ຜິດພາດ", "ບໍ່ສາມາດຮັບຕຳແໜ່ງໄດ້", "error");
        setGpsLoading((s) => ({ ...s, [key]: false }));
      },
    );
  };

  const clearCoord = (key: "office" | "project") => {
    const field = key === "office" ? "officeCoord" : "projectCoord";
    setFormData((s: any) => ({ ...s, [field]: "" }));
  };

  const copyOfficeToProject = () => {
    if (!formData.officeCoord) {
      Swal.fire("ແຈ້ງເຕືອນ", "ຍັງບໍ່ມີຕຳແໜ່ງຫ້ອງການ", "info");
      return;
    }
    setFormData((s: any) => ({ ...s, projectCoord: s.officeCoord }));
  };

  /* ─── Validation ─── */
  const validateForm = () => {
    if (!formData.projectName?.trim()) return "ກະລຸນາປ້ອນຊື່ໂຄງການ";
    if (!isEditing && (!formData.imageFiles || formData.imageFiles.length === 0))
      return "ກະລຸນາອັບໂຫລດຮູບພາບໂຄງການ";
    return "";
  };

  /* ─── Submit ─── */
  const handleSubmit = async () => {
    const errMsg = validateForm();
    if (errMsg) {
      Swal.fire("ແຈ້ງເຕືອນ", errMsg, "warning");
      return;
    }
    try {
      setIsSubmitting(true);
      Swal.fire({
        title: isEditing ? "ກຳລັງອັບເດດ..." : "ກຳລັງບັນທຶກ...",
        text: "ກະລຸນາລໍຖ້າ",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });
      const currentUser =
        typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};

      const fd = new FormData();
      const append = (k: string, v: any) => fd.append(k, v ?? "");
      append("projectName", formData.projectName);
      append("projectDescription", formData.projectDescription || "");
      append("province", formData.province);
      append("district", formData.district);
      append("village", formData.village);
      append("coordinator", formData.coordinator);
      append("coordinatorPhone", formData.coordinatorPhone);
      append("registrationDate", formData.registrationDate);
      append("saleStaffId", formData.saleStaffId);
      append("saleStaff", formData.saleStaff);
      append("status", formData.status);
      append("businessType", formData.businessType);
      append("businessModel", formData.businessModel);
      append("projectType", formData.projectType);
      append("officeCoord", formData.officeCoord || "");
      append("projectCoord", formData.projectCoord || "");
      append("username", currentUser?.username || "");

      if (formData.imageFiles && formData.imageFiles.length > 0) {
        formData.imageFiles.forEach((file: File, idx: number) => {
          fd.append("imageFiles", file, file.name ?? `image-${idx}.jpg`);
        });
      }

      if (isEditing) {
        await editProjectAction(String(id), fd);
        Swal.fire("ສຳເລັດ", "ອັບເດດໂຄງການສຳເລັດ", "success");
      } else {
        await createProjectAction(fd);
        Swal.fire("ສຳເລັດ", "ບັນທຶກໂຄງການໃໝ່ສຳເລັດ", "success");
      }
      router.push("/sale-admin/list-project");
    } catch (err: any) {
      console.error("Create project request failed:", err);
      Swal.fire("ຜິດພາດ", err?.message || "ບັນທຶກຂໍ້ມູນບໍ່ສຳເລັດ", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── Derived ─── */
  const activeStatusIndex = useMemo(() => {
    const idx = STATUSES.findIndex((s) => s.id === formData.status);
    return idx >= 0 ? idx : 0;
  }, [formData.status]);

  const officeParsed = useMemo(() => parseLatLng(formData.officeCoord), [formData.officeCoord]);
  const projectParsed = useMemo(() => parseLatLng(formData.projectCoord), [formData.projectCoord]);

  const imageCount =
    (formData.imageFiles?.length || 0) +
    (formData.imageFiles?.length === 0 && (previewImage || existingImageUrl) ? 1 : 0);

  /* ─── Page header ─── */
  usePageHeader({
    title: isEditing ? formData.projectName || "Project" : "New Project",
    subtitle: isEditing ? "ແກ້ໄຂໂຄງການ" : "ສ້າງໂຄງການໃໝ່",
    primaryAction: {
      label: isSubmitting ? "ກຳລັງບັນທຶກ..." : "Save",
      icon: <Save size={13} />,
      onClick: handleSubmit,
      disabled: isSubmitting,
    },
    secondaryActions: [
      {
        label: "Discard",
        icon: <X size={13} />,
        onClick: () => router.back(),
      },
    ],
  });

  /* ─── Notebook tab: Location ─── */
  const locationTab = (
    <div className="space-y-4">
      <FieldGroup>
        <Field label="ແຂວງ">
          <OdooSelect
            options={provinceOptions}
            value={provinceOptions.find((p) => String(p.value) === String(formData.province)) || null}
            onChange={(opt: any) =>
              setFormData((s: any) => ({ ...s, province: String(opt?.value || "") }))
            }
            placeholder="ເລືອກແຂວງ"
            menuPortalTarget={menuPortalTarget}
          />
        </Field>
        <Field label="ເມືອງ">
          <OdooSelect
            options={districtOptions}
            value={districtOptions.find((d) => String(d.value) === String(formData.district)) || null}
            onChange={(opt: any) =>
              setFormData((s: any) => ({ ...s, district: String(opt?.value || "") }))
            }
            placeholder="ເລືອກເມືອງ"
            isDisabled={!formData.province}
            menuPortalTarget={menuPortalTarget}
          />
        </Field>
        <Field label="ບ້ານ">
          <OdooSelect
            options={villageOptions}
            value={villageOptions.find((v) => String(v.value) === String(formData.village)) || null}
            onChange={(opt: any) =>
              setFormData((s: any) => ({ ...s, village: String(opt?.value || "") }))
            }
            placeholder="ເລືອກບ້ານ"
            isDisabled={!formData.district}
            menuPortalTarget={menuPortalTarget}
          />
        </Field>
      </FieldGroup>

      <div className="flex items-center gap-1 border-b border-[var(--theme-border-subtle)]">
        {(["office", "project"] as const).map((k) => {
          const active = locTab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setLocTab(k)}
              className={[
                "relative inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold transition-colors",
                active
                  ? "text-[var(--theme-primary)]"
                  : "text-[var(--theme-text-soft)] hover:text-[var(--theme-text)]",
              ].join(" ")}
            >
              <MapPin size={12} />
              {k === "office" ? "ຫ້ອງການ" : "ໂຄງການ"}
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-[2px] bg-[var(--theme-primary)]" />
              )}
            </button>
          );
        })}
      </div>

      {(() => {
        const field = locTab === "office" ? "officeCoord" : "projectCoord";
        const parsed = locTab === "office" ? officeParsed : projectParsed;
        const placeholder =
          locTab === "office" ? "17.975700,102.633100" : "17.965000,102.645000";
        const searchPlaceholder =
          locTab === "office" ? "ຄົ້ນຫາຕຳແໜ່ງຫ້ອງການ..." : "ຄົ້ນຫາຕຳແໜ່ງໂຄງການ...";
        const busy = gpsLoading[locTab];
        return (
          <div className="grid gap-4 lg:grid-cols-[260px,minmax(0,1fr)]">
            <div className="space-y-2">
              <Field label="Lat, Lng">
                <input
                  name={field}
                  value={formData[field]}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder={placeholder}
                />
              </Field>
              <div className="flex flex-wrap gap-1.5 pl-[140px]">
                <button
                  type="button"
                  onClick={() => setCoordFromGPS(locTab)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded border border-[var(--theme-border)] bg-white px-2 py-1 text-[11px] font-semibold text-[var(--theme-text)] hover:border-[var(--theme-primary)] disabled:opacity-50"
                >
                  <Navigation size={11} />
                  {busy ? "ກຳລັງຫາ..." : "Use my GPS"}
                </button>
                {locTab === "project" && (
                  <button
                    type="button"
                    onClick={copyOfficeToProject}
                    className="rounded border border-[var(--theme-border)] bg-white px-2 py-1 text-[11px] font-semibold text-[var(--theme-text-soft)] hover:border-[var(--theme-primary)]"
                  >
                    Copy office
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => clearCoord(locTab)}
                  className="rounded border border-[var(--theme-border)] bg-white px-2 py-1 text-[11px] font-semibold text-[var(--theme-text-soft)] hover:border-[var(--theme-primary)]"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="rounded border border-[var(--theme-border)] bg-[var(--theme-bg-muted)] p-2">
              <MapPicker
                value={{
                  lat: Number.isFinite(parsed.lat) ? parsed.lat : "",
                  lng: Number.isFinite(parsed.lng) ? parsed.lng : "",
                }}
                onChange={(p: any) =>
                  setFormData((s: any) => ({ ...s, [field]: toCoordString(p.lat, p.lng) }))
                }
                placeholder={searchPlaceholder}
                disabled={isSubmitting}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );

  /* ─── Notebook tab: Description ─── */
  const descriptionTab = (
    <textarea
      name="projectDescription"
      value={formData.projectDescription || ""}
      onChange={handleChange}
      rows={6}
      className="w-full resize-y rounded border border-[var(--theme-border)] bg-white px-3 py-2 text-[12px] text-[var(--theme-text)] placeholder:text-[var(--theme-text-mute)] focus:border-[var(--theme-primary)] focus:outline-none"
      placeholder="ລາຍລະອຽດໂຄງການ..."
    />
  );

  /* ─── Notebook tab: Images ─── */
  const imagesTab = (
    <div className="space-y-3">
      <input
        id="imageFile"
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageChange}
      />
      <div
        className="cursor-pointer rounded border border-dashed border-[var(--theme-border)] bg-[var(--theme-bg-muted)] p-6 text-center transition hover:border-[var(--theme-primary)] hover:bg-[var(--theme-primary-tint)]"
        onClick={() => document.getElementById("imageFile")?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[var(--theme-primary)] text-white">
          <Upload size={15} />
        </div>
        <p className="mt-2 text-[12px] font-semibold text-[var(--theme-text)]">
          ເລືອກຮູບພາບ ຫຼື ລາກວາງທີ່ນີ້
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--theme-text-mute)]">
          JPG / PNG / WEBP, ສູງສຸດ 5MB ຕໍ່ໄຟລ໌
        </p>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[var(--theme-text-soft)]">
        <span className="inline-flex items-center gap-1">
          <ImageIcon size={11} />
          {imageCount} image(s)
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
        {formData.imageFiles.map((file: File, idx: number) => {
          const src = URL.createObjectURL(file);
          return (
            <div
              key={idx}
              className="group relative h-24 overflow-hidden rounded border border-[var(--theme-border)] bg-[var(--theme-bg-muted)]"
            >
              <img src={src} alt={`preview-${idx}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImageAt(idx)}
                className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white group-hover:flex"
                title="ລຶບຮູບພາບ"
              >
                <Trash2 size={11} />
              </button>
            </div>
          );
        })}
        {formData.imageFiles.length === 0 && (previewImage || existingImageUrl) && (
          <div className="relative h-24 overflow-hidden rounded border border-[var(--theme-border)] bg-[var(--theme-bg-muted)]">
            <img
              src={(previewImage || existingImageUrl) as string}
              alt="preview"
              className="h-full w-full object-cover"
            />
          </div>
        )}
        {formData.imageFiles.length === 0 && !previewImage && !existingImageUrl && (
          <div className="col-span-full flex h-20 items-center justify-center rounded border border-dashed border-[var(--theme-border)] bg-[var(--theme-bg-muted)] text-[11px] text-[var(--theme-text-mute)]">
            ຍັງບໍ່ມີຮູບພາບ
          </div>
        )}
      </div>
    </div>
  );

  const notebook = [
    { id: "location", label: "Location", content: locationTab },
    { id: "description", label: "Description", content: descriptionTab },
    {
      id: "images",
      label: "Images",
      content: imagesTab,
      badge: imageCount || undefined,
    },
  ];

  /* ─── Sheet header ─── */
  const sheetHeader = (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => router.push("/sale-admin/list-project")}
        className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-[var(--theme-text-soft)] hover:text-[var(--theme-primary)]"
      >
        <ArrowLeft size={12} />
        ກັບຄືນລາຍການ
      </button>
      <input
        name="projectName"
        value={formData.projectName}
        onChange={handleChange}
        placeholder="Project name..."
        className="w-full border-0 border-b border-transparent bg-transparent px-0 py-1 text-2xl font-semibold text-[var(--theme-text)] placeholder:text-[var(--theme-text-mute)] focus:border-[var(--theme-primary)] focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--theme-text-soft)]">
        <span className="inline-flex items-center rounded bg-[var(--theme-primary-tint)] px-2 py-0.5 font-semibold text-[var(--theme-primary)]">
          {projectTypeOptions.find((o) => String(o.value) === String(formData.projectType))?.label ||
            pendingBusinessNames.projectName ||
            "—"}
        </span>
        {formData.saleStaff && (
          <span className="inline-flex items-center gap-1">
            <span className="text-[var(--theme-text-mute)]">Sale:</span>
            <span className="font-semibold text-[var(--theme-text)]">{formData.saleStaff}</span>
          </span>
        )}
      </div>
    </div>
  );

  /* ─── Render ─── */
  return (
    <div className="flex flex-col">
      <StatusBar
        stages={STATUSES.map((s) => ({ id: s.id, label: s.short }))}
        activeIndex={activeStatusIndex}
        onStageClick={(stageId) =>
          setFormData((s: any) => ({ ...s, status: stageId }))
        }
      />

      <div className="px-4 py-4">
        <FormSheet header={sheetHeader} notebook={notebook}>
          <FieldGroup>
            {/* Left column */}
            <Field label="Customer" required>
              <input
                name="coordinator"
                value={formData.coordinator}
                onChange={handleChange}
                className={inputClass}
                placeholder="ຊື່ຜູ້ປະສານງານ"
              />
            </Field>

            <Field label="Business Type">
              <OdooSelect
                inputId="businessType"
                isLoading={businessTypeLoading}
                options={businessTypeOptions}
                placeholder="ເລືອກປະເພດທຸລະກິດ"
                value={
                  businessTypeOptions.find(
                    (o) => String(o.value) === String(formData.businessType || ""),
                  ) || null
                }
                onChange={(opt: any) =>
                  setFormData((s: any) => {
                    const v = String(opt?.value || "");
                    return v !== s.businessType
                      ? { ...s, businessType: v, businessModel: "", projectType: "" }
                      : { ...s, businessType: v };
                  })
                }
                noOptionsMessage={() =>
                  businessTypeLoading ? "ກຳລັງໂຫຼດ..." : "ບໍ່ພົບປະເພດທຸລະກິດ"
                }
                menuPortalTarget={menuPortalTarget}
              />
            </Field>

            <Field label="Phone">
              <input
                name="coordinatorPhone"
                value={formData.coordinatorPhone}
                onChange={handleChange}
                className={inputClass}
                placeholder="020XXXXXXXX"
              />
            </Field>

            <Field label="Business Model">
              <OdooSelect
                inputId="businessModel"
                isLoading={businessModelLoading}
                options={businessModelOptions}
                placeholder="ເລືອກຮູບແບບທຸລະກິດ"
                value={
                  businessModelOptions.find(
                    (o) => String(o.value) === String(formData.businessModel || ""),
                  ) || null
                }
                onChange={(opt: any) =>
                  setFormData((s: any) => {
                    const v = String(opt?.value || "");
                    return v !== s.businessModel
                      ? { ...s, businessModel: v, projectType: "" }
                      : { ...s, businessModel: v };
                  })
                }
                isDisabled={!formData.businessType}
                noOptionsMessage={() =>
                  businessModelLoading ? "ກຳລັງໂຫຼດ..." : "ບໍ່ພົບຮູບແບບທຸລະກິດ"
                }
                menuPortalTarget={menuPortalTarget}
              />
            </Field>

            <Field label="Sale Staff">
              <OdooSelect
                inputId="saleStaff"
                isLoading={saleStaffLoading}
                options={saleStaffOptions}
                placeholder="ເລືອກພະນັກງານຂາຍ"
                value={
                  saleStaffOptions.find(
                    (o) => String(o.value) === String(formData.saleStaffId || ""),
                  ) ||
                  (formData.saleStaffId && !saleStaffLoading
                    ? {
                        value: String(formData.saleStaffId),
                        label: formData.saleStaff || `ID: ${formData.saleStaffId}`,
                      }
                    : null)
                }
                onChange={(opt: any) =>
                  setFormData((s: any) => ({
                    ...s,
                    saleStaffId: String(opt?.value || ""),
                    saleStaff: opt?.label || "",
                  }))
                }
                noOptionsMessage={() =>
                  saleStaffLoading ? "ກຳລັງໂຫຼດ..." : "ບໍ່ພົບພະນັກງານ"
                }
                menuPortalTarget={menuPortalTarget}
              />
            </Field>

            <Field label="Project Type">
              <OdooSelect
                inputId="projectType"
                isLoading={projectTypeLoading}
                options={projectTypeOptions}
                placeholder="ເລືອກປະເພດໂຄງການ"
                value={
                  projectTypeOptions.find(
                    (o) => String(o.value) === String(formData.projectType || ""),
                  ) || null
                }
                onChange={(opt: any) =>
                  setFormData((s: any) => ({ ...s, projectType: String(opt?.value || "") }))
                }
                isDisabled={!formData.businessModel}
                noOptionsMessage={() =>
                  projectTypeLoading ? "ກຳລັງໂຫຼດ..." : "ບໍ່ພົບປະເພດໂຄງການ"
                }
                menuPortalTarget={menuPortalTarget}
              />
            </Field>

            <Field label="Registration Date">
              <input
                type="date"
                name="registrationDate"
                value={formData.registrationDate}
                onChange={handleChange}
                className={inputClass}
              />
            </Field>
          </FieldGroup>
        </FormSheet>

        {isEditing && (
          <div className="mx-auto mt-4 w-full max-w-[1080px]">
            <Chatter entries={[]} onSend={() => {}} />
          </div>
        )}
      </div>
    </div>
  );
}
