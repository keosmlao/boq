"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Select from "react-select";
import Swal from "sweetalert2";
import {
  ArrowLeft,
  Save,
  Package,
  Calendar,
  MapPin,
  Trash2,
  Plus,
  RotateCcw,
  AlertTriangle,
  FileText,
  X,
  Search,
  Check,
} from "lucide-react";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function MaterialReturn() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    projectId: "",
    returnDate: new Date().toISOString().split("T")[0],
    notes: "",
    returnItems: [],
  });
  const [returnDocNo, setReturnDocNo] = useState("");
  const [returnedBy, setReturnedBy] = useState("");
  const [returnedByCode, setReturnedByCode] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const [projectOptions, setProjectOptions] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [issuedMaterials, setIssuedMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState("");

  useEffect(() => {
    loadProjects();
    loadReturnDocNo();
    loadUser();
    loadWarehouses();
  }, []);

  useEffect(() => {
    if (formData.projectId) {
      loadIssuedMaterials(formData.projectId);
    } else {
      setIssuedMaterials([]);
      setFormData((prev) => ({ ...prev, returnItems: [] }));
    }
  }, [formData.projectId]);

  useEffect(() => {
    if (!selectedWarehouse) {
      setLocations([]);
      setSelectedLocation("");
      return;
    }
    loadLocations(selectedWarehouse);
  }, [selectedWarehouse]);

  const loadUser = () => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return;
      const user = JSON.parse(userStr);
      const code = user.username || user.code || "";
      const name = user.name_1 || user.name || user.full_name || code;
      setReturnedByCode(code);
      setReturnedBy(name);
    } catch {
      /* ignore */
    }
  };

  const loadReturnDocNo = async () => {
    try {
      const res = await fetch("/api/materials/return/nextno", { headers: _getAuthHeaders() }).then(r => r.json());
      const docNo = res?.doc_no || "";
      setReturnDocNo(docNo);
    } catch (e) {
      console.error("Failed to load return doc no:", e);
    }
  };

  const loadWarehouses = async () => {
    try {
      setWarehouseLoading(true);
      const res = await fetch("/api/warehouses", { headers: _getAuthHeaders() }).then(r => r.json());
      const list = Array.isArray(res?.data) ? res.data : [];
      setWarehouses(list);
      if (list.length === 1) setSelectedWarehouse(list[0].code);
    } catch (e) {
      console.error("Failed to load warehouses:", e);
    } finally {
      setWarehouseLoading(false);
    }
  };

  const loadLocations = async (warehouseCode) => {
    try {
      setLocationLoading(true);
      const res = await fetch(`/api/locations?warehouse=${encodeURIComponent(warehouseCode)}`, { headers: _getAuthHeaders() }).then(r => r.json());
      const list = Array.isArray(res?.data) ? res.data : [];
      setLocations(list);
      if (list.length === 1) setSelectedLocation(list[0].code);
      else setSelectedLocation("");
    } catch (e) {
      console.error("Failed to load locations:", e);
      setLocations([]);
      setSelectedLocation("");
    } finally {
      setLocationLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      setProjectsLoading(true);
      const response = await fetch("/api/projects", { headers: _getAuthHeaders() }).then(r => r.json());
      const projects = response?.data || [];
      const options = projects.map((project) => ({
        value: project.id ?? project.sml_code ?? "",
        label: `${project.project_name} - ${project.province_name}`,
        project,
      }));
      setProjectOptions(options);
    } catch (error) {
      console.error("Failed to load projects:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "ໂຫຼດໂຄງການບໍ່ສຳເລັດ",
      });
    } finally {
      setProjectsLoading(false);
    }
  };

  const loadIssuedMaterials = async (projectId) => {
    try {
      setMaterialsLoading(true);
      const response = await fetch(`/api/materials/issued/${projectId}`, { headers: _getAuthHeaders() }).then(r => r.json());
      const materials = response?.data || [];
      setIssuedMaterials(materials);
    } catch (error) {
      console.error("Failed to load issued materials:", error);
      setIssuedMaterials([]);
    } finally {
      setMaterialsLoading(false);
    }
  };

  const handleProjectChange = (selectedOption) => {
    setFormData((prev) => ({
      ...prev,
      projectId: selectedOption?.project?.id ?? selectedOption?.value ?? "",
      returnItems: [],
    }));
    setSelectedProject(selectedOption?.project || null);
  };

  // Filter materials that haven't been added yet
  const availableMaterials = issuedMaterials.filter(
    (m) => !formData.returnItems.find((item) => item.materialId === m.id)
  );

  // Filter by search
  const filteredMaterials = availableMaterials.filter(
    (m) =>
      m.item_name?.toLowerCase().includes(modalSearch.toLowerCase()) ||
      m.item_code?.toLowerCase().includes(modalSearch.toLowerCase())
  );

  const openModal = () => {
    if (!formData.projectId) {
      Swal.fire({
        icon: "warning",
        title: "ເລືອກໂຄງການກ່ອນ",
        text: "ກະລຸນາເລືອກໂຄງການກ່ອນເພີ່ມລາຍການ",
      });
      return;
    }

    if (!selectedWarehouse || !selectedLocation) {
      Swal.fire({
        icon: "warning",
        title: "ກະລຸນາເລືອກສາງ/ທີ່ເກັບ",
        text: "ກະລຸນາເລືອກສາງ ແລະ ທີ່ເກັບ ກ່ອນບັນທຶກ",
      });
      return;
    }
    setModalSearch("");
    setIsModalOpen(true);
  };

  const selectMaterial = (material) => {
    const newItem = {
      id: Date.now(),
      materialId: material.id,
      materialName: material.item_name,
      materialCode: material.item_code,
      unit: material.unit_code,
      unit_code: material.unit_code,
      issuedQuantity: material.qty || 0,
      availableQuantity: material.qty || 0,
      returnQuantity: 1,
      condition: "good",
      notes: "",
    };

    setFormData((prev) => ({
      ...prev,
      returnItems: [...prev.returnItems, newItem],
    }));
    setIsModalOpen(false);
  };

  const updateReturnItem = (itemId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      returnItems: prev.returnItems.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeReturnItem = (itemId) => {
    setFormData((prev) => ({
      ...prev,
      returnItems: prev.returnItems.filter((item) => item.id !== itemId),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.projectId) {
      Swal.fire({
        icon: "warning",
        title: "ກະລຸນາເລືອກໂຄງການ",
        text: "ກະລຸນາເລືອກໂຄງການກ່ອນບັນທຶກ",
      });
      return;
    }

    if (formData.returnItems.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "ບໍ່ມີລາຍການ",
        text: "ກະລຸນາເພີ່ມອາໄຫຼ່ຢ່າງໜ້ອຍ 1 ລາຍການ",
      });
      return;
    }

    const invalidItems = formData.returnItems.filter(
      (item) =>
        !item.returnQuantity ||
        item.returnQuantity <= 0 ||
        item.returnQuantity > item.availableQuantity
    );

    if (invalidItems.length > 0) {
      Swal.fire({
        icon: "warning",
        title: "ຈຳນວນບໍ່ຖືກຕ້ອງ",
        text: "ກະລຸນາກວດສອບຈຳນວນຄືນ",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        projectId: formData.projectId,
        docNo: returnDocNo,
        returnDate: formData.returnDate,
        notes: formData.notes,
        returnedBy: returnedByCode || returnedBy || null,
        warehouse_code: selectedWarehouse,
        warehouse_name: warehouses.find((w) => w.code === selectedWarehouse)?.name_1 || "",
        location_code: selectedLocation,
        location_name: locations.find((l) => l.code === selectedLocation)?.name_1 || "",
        returnItems: formData.returnItems.map((item) => ({
          materialId: item.materialId,
          returnQuantity: parseFloat(item.returnQuantity),
          unit_code: item.unit_code || item.unit || item.unitCode || null,
          condition: item.condition,
          notes: item.notes,
        })),
      };

      await fetch("/api/materials/return", {
      method: "POST",
      headers: { "Content-Type": "application/json", ..._getAuthHeaders() },
      body: JSON.stringify(payload),
    });

      Swal.fire({
        icon: "success",
        title: "ສຳເລັດ!",
        text: "ບັນທຶກການຄືນອາໄຫຼ່ສຳເລັດ",
        confirmButtonText: "ຕໍ່ໄປ",
      }).then(() => {
        router.push("/service-admin/material-return-list");
      });
    } catch (error) {
      console.error("Failed to submit return:", error);
      const errorMessage =
        error?.response?.message || "ບັນທຶກບໍ່ສຳເລັດ";
      Swal.fire({
        icon: "error",
        title: "ເກີດຂໍ້ຜິດພາດ",
        text: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const conditionOptions = [
    { value: "good", label: "ສະພາບດີ" },
    { value: "damaged", label: "ເສຍຫາຍ" },
    { value: "expired", label: "ໝົດອາຍຸ" },
  ];

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: "40px",
      borderColor: state.isFocused ? "#1c1917" : "#d6d3d1",
      borderWidth: "2px",
      borderRadius: "8px",
      backgroundColor: "#fafaf9",
      boxShadow: state.isFocused ? "0 0 0 2px rgba(28, 25, 23, 0.1)" : "none",
      "&:hover": { borderColor: "#a8a29e" },
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? "#1c1917"
        : state.isFocused
        ? "#f5f5f4"
        : "white",
      color: state.isSelected ? "white" : "#1c1917",
      fontSize: "13px",
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({ ...base, zIndex: 9999, borderRadius: "8px" }),
  };

  const warehouseOptions = warehouses.map((w) => ({
    value: w.code,
    label: `${w.code} - ${w.name_1}`,
  }));
  const selectedWarehouseOption =
    warehouseOptions.find((opt) => opt.value === selectedWarehouse) || null;
  const locationOptions = locations.map((loc) => ({
    value: loc.code,
    label: `${loc.code} - ${loc.name_1}`,
  }));
  const selectedLocationOption =
    locationOptions.find((opt) => opt.value === selectedLocation) || null;

  return (
    <>
      {/* Custom Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        
        .return-form-page {
          font-family: var(--font-lao), 'IBM Plex Sans', system-ui, sans-serif;
        }
        
        .mono-text {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }
        
        .grain-overlay {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          opacity: 0.03;
        }
        
        .action-btn {
          transition: all 0.15s ease;
        }
        
        .action-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        
        .action-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        
        .form-input {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border: 2px solid #d6d3d1;
          border-radius: 8px;
          background-color: #fafaf9;
          font-size: 13px;
          transition: all 0.15s ease;
        }
        
        .form-input:focus {
          outline: none;
          border-color: #1c1917;
          box-shadow: 0 0 0 2px rgba(28, 25, 23, 0.1);
          background-color: white;
        }
        
        .form-input:hover {
          border-color: #a8a29e;
        }
        
        .form-input::placeholder {
          color: #a8a29e;
        }
        
        .form-textarea {
          min-height: 100px;
          padding: 10px 12px;
          resize: vertical;
        }
      `}</style>

      <div className="return-form-page min-h-screen bg-[var(--theme-bg-muted)]">
        <div className="fixed inset-0 grain-overlay pointer-events-none" />

        <div className="relative px-6 lg:px-10 py-8 max-w-[1400px] mx-auto">
          {/* Header */}
          <header className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push("/service-admin/material-return-list")}
                  className="action-btn h-11 w-11 rounded-md border-2 border-[var(--theme-border-subtle)] bg-white text-stone-600 hover:bg-stone-900 hover:text-white hover:border-stone-900 flex items-center justify-center transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="h-1 w-8 bg-stone-900 rounded-full" />
                    <span className="text-xs font-semibold tracking-[0.2em] uppercase text-stone-500">
                      ແບບຟອມ
                    </span>
                  </div>
                  <h1 className="text-3xl font-bold text-stone-900 tracking-tight">
                    ຄືນອາໄຫຼ່
                  </h1>
                </div>
              </div>
            </div>
          </header>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Selection Row */}
            <section className="rounded-lg border-2 border-[var(--theme-border-subtle)] bg-white p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                    <MapPin className="inline w-3 h-3 mr-1 -mt-0.5" />
                    ໂຄງການ <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    options={projectOptions}
                    value={projectOptions.find(
                      (p) => p.value === formData.projectId
                    )}
                    onChange={handleProjectChange}
                    isLoading={projectsLoading}
                    placeholder="ເລືອກໂຄງການ..."
                    classNamePrefix="react-select"
                    isClearable
                    menuPortalTarget={document.body}
                    styles={selectStyles}
                  />
                  {selectedProject && (
                    <div className="mt-2 text-xs text-stone-500">
                      {selectedProject.village_name}, {selectedProject.district_name}, {selectedProject.province_name}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                    <Calendar className="inline w-3 h-3 mr-1 -mt-0.5" />
                    ວັນທີຄືນ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.returnDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        returnDate: e.target.value,
                      }))
                    }
                    className="form-input mono-text"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                    <FileText className="inline w-3 h-3 mr-1 -mt-0.5" />
                    ເລກທີໃບຂໍຄືນ
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={returnDocNo}
                      readOnly
                      className="form-input mono-text bg-stone-100 text-stone-600 cursor-not-allowed"
                      placeholder="RWRNXXXX"
                    />
                    <button
                      type="button"
                      onClick={loadReturnDocNo}
                      className="action-btn inline-flex items-center justify-center h-11 w-11 rounded-md border-2 border-[var(--theme-border-subtle)] bg-white text-stone-700 hover:bg-stone-900 hover:text-white hover:border-stone-900"
                      title="ສ້າງເລກໃໝ່"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-1 text-[10px] text-stone-500">
                    ກົດປຸ່ມ Reload ເມື່ອພົບວ່າເລກທີຊ້ຳກັນ
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                    ຜູ້ຂໍຄືນ
                  </label>
                  <input
                    type="text"
                    value={returnedBy}
                    readOnly
                    className="form-input bg-stone-100 text-stone-600 cursor-not-allowed"
                    placeholder="ຊື່ຜູ້ຂໍຄືນ"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                    ສາງສິນຄ້າ <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    options={warehouseOptions}
                    value={selectedWarehouseOption}
                    onChange={(opt) => setSelectedWarehouse(opt?.value || "")}
                    isLoading={warehouseLoading}
                    isClearable
                    placeholder="ເລືອກສາງ..."
                    classNamePrefix="react-select"
                    menuPortalTarget={document.body}
                    styles={selectStyles}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                    ທີ່ເກັບ (Location) <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    options={locationOptions}
                    value={selectedLocationOption}
                    onChange={(opt) => setSelectedLocation(opt?.value || "")}
                    isLoading={locationLoading}
                    isClearable
                    placeholder="ເລືອກທີ່ເກັບ..."
                    classNamePrefix="react-select"
                    menuPortalTarget={document.body}
                    styles={selectStyles}
                    isDisabled={!selectedWarehouse}
                  />
                </div>
              </div>
            </section>

            {/* Return Items Table */}
            <section className="rounded-lg border-2 border-[var(--theme-border-subtle)] bg-white overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--theme-border-subtle)] bg-stone-900 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-white text-stone-900 flex items-center justify-center">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-white">
                    ລາຍການຄືນ
                  </span>
                  {formData.returnItems.length > 0 && (
                    <span className="mono-text text-xs text-[var(--theme-text-mute)] bg-stone-800 px-2 py-0.5 rounded">
                      {formData.returnItems.length} ລາຍການ
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={openModal}
                  disabled={!formData.projectId || materialsLoading}
                  className={`action-btn inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    !formData.projectId || materialsLoading
                      ? "bg-stone-700 text-[var(--theme-text-mute)] cursor-not-allowed"
                      : "bg-white text-stone-900 hover:bg-stone-100"
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  ເພີ່ມລາຍການ
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b-2 border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)]">
                      <th className="px-4 py-3 text-left text-[10px] font-bold tracking-wide uppercase text-stone-500 w-12">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold tracking-wide uppercase text-stone-500">
                        ລະຫັດ
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold tracking-wide uppercase text-stone-500">
                        ຊື່ສິນຄ້າ
                      </th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold tracking-wide uppercase text-stone-500">
                        ເບີກໄປ
                      </th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold tracking-wide uppercase text-stone-500">
                        ຫົວໜ່ວຍ
                      </th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold tracking-wide uppercase text-stone-500 w-28">
                        ຈຳນວນຄືນ
                      </th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold tracking-wide uppercase text-stone-500 w-36">
                        ສະພາບ
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold tracking-wide uppercase text-stone-500">
                        ໝາຍເຫດ
                      </th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold tracking-wide uppercase text-stone-500 w-16">
                        ລຶບ
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.returnItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-16 text-center">
                          <div className="flex flex-col items-center">
                            <div className="h-14 w-14 rounded-lg border-2 border-dashed border-stone-300 flex items-center justify-center mb-4">
                              <Package className="w-6 h-6 text-[var(--theme-text-mute)]" />
                            </div>
                            <span className="text-sm text-stone-500 mb-2">
                              ຍັງບໍ່ມີລາຍການ
                            </span>
                            <button
                              type="button"
                              onClick={openModal}
                              disabled={!formData.projectId}
                              className="text-sm font-medium text-stone-900 hover:underline disabled:text-[var(--theme-text-mute)] disabled:no-underline"
                            >
                              {formData.projectId
                                ? "ກົດເພື່ອເພີ່ມລາຍການ"
                                : "ເລືອກໂຄງການກ່ອນ"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      formData.returnItems.map((item, index) => (
                        <tr
                          key={item.id}
                          className="border-b border-[var(--theme-border-subtle)] hover:bg-[var(--theme-bg-muted)]/50 transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="mono-text text-xs text-[var(--theme-text-mute)]">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="mono-text text-xs font-medium text-stone-700">
                              {item.materialCode}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm font-medium text-stone-900">
                              {item.materialName}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <span className="mono-text text-sm font-semibold text-sky-600">
                              {item.issuedQuantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <span className="text-xs text-stone-500">
                              {item.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="number"
                              value={item.returnQuantity}
                              onChange={(e) =>
                                updateReturnItem(
                                  item.id,
                                  "returnQuantity",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              min="0"
                              max={item.availableQuantity}
                              step="0.01"
                              className="form-input mono-text text-center w-24"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Select
                              options={conditionOptions}
                              value={conditionOptions.find(
                                (c) => c.value === item.condition
                              )}
                              onChange={(opt) =>
                                updateReturnItem(
                                  item.id,
                                  "condition",
                                  opt?.value || "good"
                                )
                              }
                              classNamePrefix="react-select"
                              styles={{
                                ...selectStyles,
                                control: (base, state) => ({
                                  ...selectStyles.control(base, state),
                                  minHeight: "36px",
                                  minWidth: "120px",
                                }),
                              }}
                              menuPortalTarget={document.body}
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="text"
                              value={item.notes}
                              onChange={(e) =>
                                updateReturnItem(item.id, "notes", e.target.value)
                              }
                              className="form-input w-full min-w-[120px]"
                              placeholder="ໝາຍເຫດ..."
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <button
                              type="button"
                              onClick={() => removeReturnItem(item.id)}
                              className="action-btn h-9 w-9 rounded-lg border-2 border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white hover:border-rose-500 flex items-center justify-center transition-all mx-auto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Notes */}
            <section className="rounded-lg border-2 border-[var(--theme-border-subtle)] bg-white p-6">
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                <FileText className="inline w-3 h-3 mr-1 -mt-0.5" />
                ໝາຍເຫດ
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                className="form-input form-textarea"
                placeholder="ໝາຍເຫດເພີ່ມເຕີມກ່ຽວກັບການຄືນອາໄຫຼ່..."
                rows={3}
              />
            </section>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push("/service-admin/material-return-list")}
                className="action-btn inline-flex items-center gap-2 px-6 py-3 rounded-md border-2 border-[var(--theme-border-subtle)] bg-white text-stone-700 font-semibold text-sm hover:bg-[var(--theme-bg-muted)] transition-all"
              >
                ຍົກເລີກ
              </button>
              <button
                type="submit"
                disabled={isSubmitting || formData.returnItems.length === 0}
                className={`action-btn inline-flex items-center gap-2 px-6 py-3 rounded-md text-white font-semibold text-sm transition-all ${
                  isSubmitting || formData.returnItems.length === 0
                    ? "bg-stone-300 cursor-not-allowed"
                    : "bg-stone-900 hover:bg-stone-800"
                }`}
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກການຄືນ"}
              </button>
            </div>
          </form>
        </div>

        {/* Material Selection Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-stone-900/70 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-white rounded-lg border-2 border-[var(--theme-border-subtle)] shadow-[var(--theme-shadow-lg)] overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-[var(--theme-border-subtle)] bg-stone-900 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-white text-stone-900 flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      ເລືອກສິນຄ້າ
                    </h3>
                    <p className="text-[10px] text-[var(--theme-text-mute)]">
                      ເລືອກອາໄຫຼ່ທີ່ຕ້ອງການຄືນ
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="action-btn h-9 w-9 rounded-lg bg-stone-800 text-[var(--theme-text-mute)] hover:bg-stone-700 hover:text-white flex items-center justify-center transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search */}
              <div className="px-6 py-4 border-b border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--theme-text-mute)]" />
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    placeholder="ຄົ້ນຫາລະຫັດ ຫຼື ຊື່ສິນຄ້າ..."
                    className="form-input pl-10"
                    autoFocus
                  />
                </div>
              </div>

              {/* Material List */}
              <div className="max-h-[400px] overflow-y-auto">
                {materialsLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="relative h-10 w-10 mb-4">
                      <div className="absolute inset-0 rounded-full border-2 border-[var(--theme-border-subtle)]" />
                      <div className="absolute inset-0 rounded-full border-t-2 border-stone-900 animate-spin" />
                    </div>
                    <span className="text-sm text-stone-500">ກຳລັງໂຫຼດ...</span>
                  </div>
                ) : filteredMaterials.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="h-14 w-14 rounded-lg border-2 border-dashed border-stone-300 flex items-center justify-center mb-4">
                      <AlertTriangle className="w-6 h-6 text-[var(--theme-text-mute)]" />
                    </div>
                    <span className="text-sm text-stone-500">
                      {availableMaterials.length === 0
                        ? "ເພີ່ມທຸກລາຍການແລ້ວ"
                        : "ບໍ່ພົບສິນຄ້າ"}
                    </span>
                  </div>
                ) : (
                  <table className="min-w-full">
                    <thead className="sticky top-0 bg-white border-b border-[var(--theme-border-subtle)]">
                      <tr>
                        <th className="px-6 py-3 text-left text-[10px] font-bold tracking-wide uppercase text-stone-500">
                          ລະຫັດ
                        </th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold tracking-wide uppercase text-stone-500">
                          ຊື່ສິນຄ້າ
                        </th>
                        <th className="px-4 py-3 text-center text-[10px] font-bold tracking-wide uppercase text-stone-500">
                          ຈຳນວນເບີກ
                        </th>
                        <th className="px-4 py-3 text-center text-[10px] font-bold tracking-wide uppercase text-stone-500">
                          ຫົວໜ່ວຍ
                        </th>
                        <th className="px-6 py-3 text-center text-[10px] font-bold tracking-wide uppercase text-stone-500 w-20">
                          ເລືອກ
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMaterials.map((material) => (
                        <tr
                          key={material.id}
                          className="border-b border-[var(--theme-border-subtle)] hover:bg-[var(--theme-bg-muted)] transition-colors cursor-pointer"
                          onClick={() => selectMaterial(material)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="mono-text text-xs font-medium text-stone-700">
                              {material.item_code}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-stone-900">
                              {material.item_name}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <span className="mono-text text-sm font-semibold text-sky-600">
                              {material.qty}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <span className="text-xs text-stone-500">
                              {material.unit_code}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectMaterial(material);
                              }}
                              className="action-btn h-8 w-8 rounded-lg bg-stone-900 text-white hover:bg-stone-800 flex items-center justify-center transition-all mx-auto"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-[var(--theme-border-subtle)] bg-[var(--theme-bg-muted)] flex items-center justify-between">
                <span className="text-xs text-stone-500">
                  {filteredMaterials.length} ລາຍການ
                </span>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="action-btn px-4 py-2 rounded-lg border-2 border-[var(--theme-border-subtle)] bg-white text-stone-700 text-sm font-medium hover:bg-[var(--theme-bg-muted)] transition-all"
                >
                  ປິດ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}