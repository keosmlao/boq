"use client";


import AuthGuard from "@/_components/AuthGuard";
import { getProjectsBoq } from "@/_actions/projects";
import { getTechnicians, getHelpers, getTasks, updateTechnician } from "@/_actions/lookups";
import { getWorkOrders, createWorkOrder, updateWorkOrder, deleteWorkOrder, getWorkSchedule } from "@/_actions/work-orders";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, Fragment } from "react";
import {
  ClipboardList, Plus, RefreshCw,
  ChevronDown, ChevronRight, ChevronLeft, Printer, Trash2,
  Edit3, Layers, User, FolderOpen, ChevronsLeft, ChevronsRight, ListChecks
} from "lucide-react";
import WorkOrderModal from "@/_components/WorkOrderModal";
import { usePageHeader } from "@/_components/PageHeader";
import ViewSwitcher, { type ViewMode } from "@/_components/odoo/ViewSwitcher";
import KanbanBoard, { type KanbanColumn } from "@/_components/odoo/KanbanBoard";

function _getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}


// --- Configuration ---
const STATUS_CONFIG = {
  draft: { label: "ສະບັບຮ່າງ", bg: "bg-stone-100", text: "text-stone-600", dot: "bg-stone-500" },
  assigned: { label: "ມອບໝາຍແລ້ວ", bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  in_progress: { label: "ກຳລັງດຳເນີນ", bg: "bg-sky-100", text: "text-sky-700", dot: "bg-sky-500" },
  completed: { label: "ສຳເລັດ", bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  closed: { label: "ປິດແລ້ວ", bg: "bg-stone-200", text: "text-stone-700", dot: "bg-stone-700" },
  material_request: { label: "ຂໍເບີກອຸປະກອນ", bg: "bg-rose-100", text: "text-rose-700", dot: "bg-rose-500" }
};

const PRIORITY_CONFIG = {
  Low: { label: "ຕ່ຳ", bg: "bg-stone-100", text: "text-stone-600", dot: "bg-stone-500" },
  Normal: { label: "ປົກກະຕິ", bg: "bg-sky-100", text: "text-sky-700", dot: "bg-sky-500" },
  High: { label: "ສູງ", bg: "bg-rose-100", text: "text-rose-700", dot: "bg-rose-500" }
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const initialForm = {
  project_code: "",
  contract_no: "",
  code: "",
  created_at: "",
  task_name: "",
  task_id: "",
  task_list: [],
  description: "",
  technician_id: "",
  helper_ids: "",
  priority: "Normal"
};

// --- Main Component ---
function WorkOrders() {
  const router = useRouter();
  
  // Data State
  const [orders, setOrders] = useState([]);
  const [projects, setProjects] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [techOptions, setTechOptions] = useState([]);
  const [techRecords, setTechRecords] = useState([]);
  const [helperOptions, setHelperOptions] = useState([]);
  const [taskOptions, setTaskOptions] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState({ status: "", search: "" });
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [message, setMessage] = useState("");
  const [helperLookup, setHelperLookup] = useState({});
  const [techHelperDefaults, setTechHelperDefaults] = useState({});
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [helperToAdd, setHelperToAdd] = useState("");
  
  // Group by state
  const [groupBy, setGroupBy] = useState("none");
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Task accordion state
  const [expandedTasks, setExpandedTasks] = useState(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("work-orders-list-view");
      if (saved === "list" || saved === "kanban") setViewMode(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("work-orders-list-view", viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  const selectedHelpers = (form.helper_ids || "").split(",").map((s) => s.trim()).filter(Boolean);
  const selectedHelperSet = useMemo(() => new Set(selectedHelpers), [selectedHelpers]);

  const helperDefaults = useMemo(() => {
    const raw = techHelperDefaults[form.technician_id] || [];
    const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
    return list.map((s) => String(s).trim()).filter(Boolean);
  }, [form.technician_id, techHelperDefaults]);

  const helperKeyMap = useMemo(() => {
    const map = new Map();
    (helperOptions.length ? helperOptions : techOptions).forEach((h) => {
      if (h.code && h.name) {
        map.set(h.code, h.name);
        map.set(h.name, h.code);
      }
    });
    return map;
  }, [helperOptions, techOptions]);

  const expandHelperKeys = (val) => {
    const list = [];
    if (!val) return list;
    list.push(val);
    const mapped = helperKeyMap.get(val);
    if (mapped) list.push(mapped);
    if (helperLookup[val]) list.push(helperLookup[val]);
    return list;
  };

  const helperDefaultsKeySet = useMemo(() => {
    const set = new Set();
    helperDefaults.forEach((val) => {
      expandHelperKeys(val).forEach((k) => set.add(k));
    });
    return set;
  }, [helperDefaults, helperKeyMap, helperLookup]);

  const allHelperOptions = helperOptions.length ? helperOptions : techOptions;

  const assignedHelperSet = useMemo(() => {
    const assigned = new Set();
    Object.values(techHelperDefaults || {}).forEach((list) => {
      const arr = Array.isArray(list) ? list : typeof list === "string" ? list.split(",") : [];
      arr.map((s) => String(s).trim()).filter(Boolean).forEach((h) => {
        expandHelperKeys(h).forEach((k) => assigned.add(k));
      });
    });
    return assigned;
  }, [techHelperDefaults, helperKeyMap, helperLookup]);

  const defaultHelperOptions = useMemo(
    () => allHelperOptions.filter((h) => {
      const code = h.code || "";
      const name = h.name || "";
      return helperDefaultsKeySet.has(code) || helperDefaultsKeySet.has(name);
    }),
    [allHelperOptions, helperDefaultsKeySet]
  );

  const otherHelperOptions = useMemo(() => {
    const filtered = allHelperOptions.filter((h) => {
      const code = h.code || "";
      const name = h.name || "";
      return !helperDefaultsKeySet.has(code) && !helperDefaultsKeySet.has(name) && !assignedHelperSet.has(code) && !assignedHelperSet.has(name);
    });
    if (filtered.length > 0) return filtered;
    return allHelperOptions.filter((h) => {
      const code = h.code || "";
      const name = h.name || "";
      return !helperDefaultsKeySet.has(code) && !helperDefaultsKeySet.has(name);
    });
  }, [allHelperOptions, helperDefaultsKeySet, assignedHelperSet]);

  // --- Data Loading ---
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await getWorkOrders({ status: filters.status || undefined });
      setOrders(res?.success ? (res.data as any[]) : []);
    } catch (err) {
      console.error("Load orders error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    loadProjects();
    loadTechs();
  }, []);

  const loadProjects = async () => {
    try {
      const res = await getProjectsBoq({ contracts: true });
      const data = res?.data || [];
      const grouped = new Map();
      data
        .filter((c) => Boolean(c.has_boq) || c.boq_status === "done")
        .forEach((c) => {
          const key = String(c.project_id);
          if (!grouped.has(key)) {
            grouped.set(key, {
              id: c.project_id,
              project_name: c.project_name,
              sml_code: c.sml_code || c.cust_code,
              cust_code: c.cust_code || c.sml_code,
              coordinator: c.coordinator,
              phone: c.phone,
              contractlist: [],
            });
          }
          grouped.get(key).contractlist.push(c);
        });
      setProjects(Array.from(grouped.values()));
    } catch (err) { console.error(err); }
  };

  const loadTechs = async () => {
    try {
      const res = await getTechnicians();
      const data = (res?.success ? res.data : []) as any[];
      if (data.length) {
        const normalizeHelpers = (value) => {
          if (!value) return [];
          if (Array.isArray(value)) return value;
          if (typeof value === "string") {
            try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed; } catch {}
            return value.split(",").map((s) => s.trim()).filter(Boolean);
          }
          return [];
        };
        const techs = data.filter(t => ["technician", "lead"].includes((t.role || "").toLowerCase()))
          .map(t => ({ code: t.code || t.name_1 || t.name || "", name: t.name_1 || t.name || t.code || "", roworder: t.roworder }))
          .filter(t => t.code || t.name);
        setTechOptions(techs);
        setTechRecords(data);
        const defaultsMap = {};
        data.forEach(t => {
          const key = t.code || t.name_1 || t.name;
          const helpers = normalizeHelpers(t.helpers);
          if (key && helpers.length) defaultsMap[key] = helpers;
        });
        setTechHelperDefaults(defaultsMap);
        try {
          const helpersRes = await getHelpers();
          const helpersData = (helpersRes?.success ? helpersRes.data.data : []) as any[];
          const helpers = (helpersData.length ? helpersData : data)
            .map(h => ({ code: h.code || h.name_1 || h.name || "", name: h.name_1 || h.name || h.code || "" }))
            .filter(h => h.code || h.name);
          setHelperOptions(helpers);
          const lookup = {};
          helpers.forEach(h => { if (h.code) lookup[h.code] = h.name; });
          setHelperLookup(lookup);
        } catch { setHelperOptions(techs); }
        return;
      }
      const fallback = await getTasks();
      const owners = Array.from(new Set(((fallback?.success ? fallback.data : []) as any[]).map((t) => t.owner).filter(Boolean)));
      const ownerObjs = owners.map(o => ({ code: o, name: o }));
      setTechOptions(ownerObjs);
      setHelperOptions(ownerObjs);
    } catch (err) { console.warn(err); }
  };

  // --- Logic ---
  useEffect(() => {
    const proj = projects.find((p) => String(p.id) === String(selectedProjectId));
    if (proj) {
      setForm((prev) => ({ ...prev, project_code: proj.sml_code || proj.cust_code || proj.id || "", contract_no: "", task_id: "", task_name: "", task_list: [], technician_id: "", helper_ids: "" }));
      setContracts(Array.isArray(proj.contractlist) ? proj.contractlist : []);
    } else {
      setContracts([]);
    }
  }, [selectedProjectId, projects]);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!form.project_code || !form.contract_no) {
        setTaskOptions([]);
        setForm((prev) => ({ ...prev, task_id: "", task_name: "", task_list: [] }));
        return;
      }
      try {
        const res = await getWorkSchedule(form.project_code, form.contract_no);
        const data = (res?.success ? res.data : []) as any[];
        if (Array.isArray(data) && data.length) setTaskOptions(data);
        else { const master = await getTasks(); setTaskOptions(master?.success ? (master.data as any[]) : []); }
      } catch (err) {
        console.warn("Load tasks failed", err);
        try { const master = await getTasks(); setTaskOptions(master?.success ? (master.data as any[]) : []); } catch {}
      }
    };
    fetchTasks();
  }, [form.project_code, form.contract_no]);

  const resetForm = () => {
    setForm(initialForm);
    setSelectedProjectId("");
    setContracts([]);
    setMessage("");
    setEditingId(null);
  };

  const getCurrentUserCode = () => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return "";
      const user = JSON.parse(raw);
      return user.username || user.code || user.user || "";
    } catch {
      return "";
    }
  };

  const submit = async () => {
    const hasTasks = (Array.isArray(form.task_list) && form.task_list.length > 0) || form.task_name;
    if (!form.project_code || !form.contract_no || !hasTasks || !form.technician_id) {
       setMessage("ກະລຸນາປ້ອນຂໍ້ມູນທີ່ຈຳເປັນ (*)");
       return;
    }
    setSaving(true);
    try {
      const createdBy = getCurrentUserCode();
      const selHelpers = (form.helper_ids || "").split(",").map((s) => s.trim()).filter(Boolean);
      const techKey = form.technician_id;
      if (techKey) {
        const techRecord = techRecords.find((t) => (t.code || t.name_1 || t.name) === techKey);
        const roworder = techRecord?.roworder;
        if (roworder) {
          const currentDefaults = (techHelperDefaults[techKey] || []).map((s) => String(s).trim()).filter(Boolean).sort().join("|");
          const nextDefaults = [...selHelpers].sort().join("|");
          if (currentDefaults !== nextDefaults) {
            await updateTechnician(roworder, { helpers: selHelpers });
            setTechHelperDefaults((prev) => ({ ...prev, [techKey]: selHelpers }));
          }
        }
      }
      const taskList = Array.isArray(form.task_list) ? form.task_list : [];
      const primaryTask = taskList[0] || {};
      const payload = {
        ...form,
        task_id: primaryTask.task_id || form.task_id || "",
        task_name: primaryTask.task_name || form.task_name || "",
        task_list: taskList,
        helper_ids: form.helper_ids ? form.helper_ids.split(",").map((s) => s.trim()).filter(Boolean) : [],
      };
      if (!editingId && createdBy) {
        payload.created_by = createdBy;
      }
      const res = editingId
        ? await updateWorkOrder(editingId, payload)
        : await createWorkOrder(payload);
      if (res?.success) {
        fetchOrders();
        resetForm();
        setShowOrderModal(false);
        setMessage("ສຳເລັດ! ບັນທຶກໃບງານແລ້ວ.");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage((res as any)?.message || "ການບັນທຶກລົ້ມເຫລວ");
      }
    } catch (err) {
      setMessage("ບັນທຶກໃບງານຜິດພາດ");
    } finally {
      setSaving(false);
    }
  };

  // Filter orders
  const filteredOrders = useMemo(() => {
    let data = orders;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      data = data.filter(o => o.code?.toLowerCase().includes(s) || o.project_code?.toLowerCase().includes(s) || o.project_name?.toLowerCase().includes(s) || o.technician_id?.toLowerCase().includes(s));
    }
    if (filters.status) data = data.filter(o => o.status === filters.status);
    return data;
  }, [orders, filters.search, filters.status]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [filters.search, filters.status, groupBy, pageSize]);

  // Pagination calculations
  const totalItems = filteredOrders.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedOrders = useMemo(() => groupBy !== "none" ? filteredOrders : filteredOrders.slice(startIndex, endIndex), [filteredOrders, startIndex, endIndex, groupBy]);

  // Group data
  const groupedOrders = useMemo(() => {
    if (groupBy === "none") return null;
    const groups = {};
    filteredOrders.forEach(order => {
      let key, label;
      if (groupBy === "project") {
        key = order.project_code || "unassigned";
        label = order.project_name || order.project_code || "ບໍ່ລະບຸໂຄງການ";
      } else {
        key = order.technician_id || "unassigned";
        const tech = techOptions.find(t => t.code === order.technician_id || t.name === order.technician_id);
        label = tech?.name || order.technician_id || "ບໍ່ລະບຸຊ່າງ";
      }
      if (!groups[key]) groups[key] = { key, label, orders: [] };
      groups[key].orders.push(order);
    });
    return Object.values(groups).sort((a, b) => {
      if (a.key === "unassigned") return 1;
      if (b.key === "unassigned") return -1;
      return a.label.localeCompare(b.label);
    });
  }, [filteredOrders, groupBy, techOptions]);

  const toggleGroup = (key) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleTaskAccordion = (orderId) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
  };

  const expandAll = () => { if (groupedOrders) setExpandedGroups(new Set(groupedOrders.map(g => g.key))); };
  const collapseAll = () => { setExpandedGroups(new Set()); };

  // Summary stats
  const summary = useMemo(() => {
    const total = orders.length;
    const byStatus = {};
    orders.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
    return { total, byStatus };
  }, [orders]);

  usePageHeader({
    title: "ໃບງານຊ່າງ",
    subtitle: `${filteredOrders.length} ລາຍການ`,
    primaryAction: {
      label: "ສ້າງໃບງານ",
      icon: <Plus size={13} />,
      onClick: () => { resetForm(); setShowOrderModal(true); },
    },
    secondaryActions: [
      {
        label: "ໂຫຼດໃໝ່",
        icon: <RefreshCw size={13} className={loading ? "animate-spin" : ""} />,
        onClick: () => fetchOrders(),
        disabled: loading,
      },
    ],
    search: {
      value: filters.search,
      onChange: (v) => setFilters({ ...filters, search: v }),
      placeholder: "ຄົ້ນຫາ ລະຫັດ, ໂຄງການ, ຊ່າງ...",
    },
    filterChips: [
      { id: "all", label: "ທຸກສະຖານະ", count: orders.length, active: filters.status === "", onClick: () => setFilters({ ...filters, status: "" }) },
      ...Object.entries(STATUS_CONFIG).map(([key, config]) => ({
        id: key,
        label: config.label,
        count: summary.byStatus[key] || 0,
        active: filters.status === key,
        onClick: () => setFilters({ ...filters, status: key }),
      })),
    ],
  });

  const handleDelete = async (id) => {
    if (!window.confirm("ທ່ານຕ້ອງການລຶບໃບງານນີ້ແທ້ບໍ່?")) return;
    try { await deleteWorkOrder(id); fetchOrders(); } catch (err) { console.error(err); }
  };

  const handleEdit = (wo) => {
    setEditingId(wo.id);
    setShowOrderModal(true);
    setSelectedProjectId("");
    setForm(initialForm);
    setTimeout(() => {
      const tasks = Array.isArray(wo.tasks) && wo.tasks.length
        ? wo.tasks.map((t) => ({ task_id: t.task_id, task_name: t.task_name }))
        : (wo.task_id || wo.task_name) ? [{ task_id: wo.task_id, task_name: wo.task_name }] : [];
      const primaryTask = tasks[0] || {};
      setForm(prev => ({
        ...prev,
        project_code: wo.project_code || "",
        contract_no: wo.contract_no || "",
        task_id: primaryTask.task_id || "",
        task_name: primaryTask.task_name || "",
        task_list: tasks,
        description: wo.description || "",
        technician_id: wo.technician_id || "",
        helper_ids: Array.isArray(wo.helper_ids) ? wo.helper_ids.join(",") : (wo.helper_ids || ""),
        priority: wo.priority || "Normal",
      }));
    }, 0);
  };

  const clearFilters = () => { setFilters({ status: "", search: "" }); };
  const hasFilters = filters.search || filters.status;

  // Pagination handlers
  const goToPage = (page) => { setCurrentPage(Math.max(1, Math.min(page, totalPages))); };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      if (currentPage <= 3) { for (let i = 1; i <= 4; i++) pages.push(i); pages.push("..."); pages.push(totalPages); }
      else if (currentPage >= totalPages - 2) { pages.push(1); pages.push("..."); for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i); }
      else { pages.push(1); pages.push("..."); for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i); pages.push("..."); pages.push(totalPages); }
    }
    return pages;
  };

  const formatDateDMY = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const iconButtonClass = "inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--theme-border-subtle)] bg-white text-[var(--theme-text-mute)] hover:bg-[var(--theme-bg-muted)] hover:text-[var(--theme-text)] disabled:cursor-not-allowed disabled:opacity-40";
  const plainButtonClass = "inline-flex h-8 items-center gap-1.5 rounded border border-[var(--theme-border-subtle)] bg-white px-3 text-xs font-medium text-[var(--theme-text)] hover:bg-[var(--theme-bg-muted)]";
  const activeButtonClass = "border-[var(--theme-accent)] bg-[var(--theme-accent)] text-white hover:bg-[var(--theme-accent)]";

  const tableHeader = (
    <thead>
      <tr className="border-b border-[var(--theme-border-subtle)] bg-[#f7f7f7]">
        <th className="w-[150px] px-3 py-2 text-left text-[11px] font-semibold text-[var(--theme-text-mute)]">ໃບງານ</th>
        {groupBy !== "project" && <th className="min-w-[260px] px-3 py-2 text-left text-[11px] font-semibold text-[var(--theme-text-mute)]">ໂຄງການ / ສັນຍາ</th>}
        <th className="min-w-[280px] px-3 py-2 text-left text-[11px] font-semibold text-[var(--theme-text-mute)]">ໜ້າວຽກ</th>
        {groupBy !== "technician" && <th className="min-w-[180px] px-3 py-2 text-left text-[11px] font-semibold text-[var(--theme-text-mute)]">ຊ່າງ</th>}
        <th className="w-[120px] px-3 py-2 text-left text-[11px] font-semibold text-[var(--theme-text-mute)]">ຄວາມສຳຄັນ</th>
        <th className="w-[150px] px-3 py-2 text-left text-[11px] font-semibold text-[var(--theme-text-mute)]">ສະຖານະ</th>
        <th className="w-[120px] px-3 py-2 text-right text-[11px] font-semibold text-[var(--theme-text-mute)]">ຄຳສັ່ງ</th>
      </tr>
    </thead>
  );

  // --- Render Order Row with Task Accordion ---
  const renderOrderRow = (wo) => {
    const status = STATUS_CONFIG[wo.status] || STATUS_CONFIG.draft;
    const priority = PRIORITY_CONFIG[wo.priority] || PRIORITY_CONFIG.Normal;
    const helpers = Array.isArray(wo.helper_ids) ? wo.helper_ids : (typeof wo.helper_ids === "string" ? wo.helper_ids.split(",").map(s => s.trim()).filter(Boolean) : []);
    const tasks = Array.isArray(wo.tasks) ? wo.tasks : [];
    const taskNames = tasks.length
      ? tasks.map((t) => t.task_name || t.task || t.name).filter(Boolean)
      : (wo.task_name ? [wo.task_name] : []);
    const taskCount = taskNames.length;
    const isTaskExpanded = expandedTasks.has(wo.id);
    const colSpan = groupBy === "none" ? 7 : 6;

    return (
      <Fragment key={wo.id}>
        <tr className="border-b border-[var(--theme-border-subtle)] bg-white text-sm hover:bg-[#f8f9fa]">
          <td className="px-3 py-2 align-top">
            <button
              onClick={() => router.push(`/service-admin/work-orders/print/${wo.id}`)}
              className="font-mono text-xs font-semibold text-[var(--theme-accent)] hover:underline"
            >
              {wo.code}
            </button>
            <div className="mt-0.5 text-[11px] text-[var(--theme-text-mute)]">{formatDateDMY(wo.created_at)}</div>
          </td>
          {groupBy !== "project" && (
            <td className="px-3 py-2 align-top">
              <div className="max-w-[360px] truncate font-medium text-[var(--theme-text)]">{wo.project_name || wo.project_code || "-"}</div>
              <div className="mt-0.5 text-[11px] text-[var(--theme-text-mute)]">{wo.project_code || "-"} · {wo.contract_no || "-"}</div>
            </td>
          )}
          <td className="px-3 py-2 align-top">
            {taskCount > 0 ? (
              <div className="flex min-w-0 items-start gap-2">
                <button
                  onClick={() => toggleTaskAccordion(wo.id)}
                  className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded border border-[var(--theme-border-subtle)] text-[var(--theme-text-mute)] hover:bg-[var(--theme-bg-muted)]"
                  title="ສະແດງລາຍການໜ້າວຽກ"
                >
                  {isTaskExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                <div className="min-w-0">
                  <div className="truncate font-medium text-[var(--theme-text)]">{taskNames[0]}</div>
                  {taskCount > 1 && (
                    <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[var(--theme-text-mute)]">
                      <ListChecks className="h-3 w-3" />
                      {taskCount} ລາຍການ
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-[var(--theme-text-mute)]">-</span>
            )}
          </td>
          {groupBy !== "technician" && (
            <td className="px-3 py-2 align-top">
              {wo.technician_id ? (
                <div>
                  <div className="font-medium text-[var(--theme-text)]">{techOptions.find(t => t.code === wo.technician_id || t.name === wo.technician_id)?.name || wo.technician_id}</div>
                  {helpers.length > 0 && (
                    <div className="mt-0.5 text-[11px] text-[var(--theme-text-mute)]">
                      {helpers.slice(0, 2).map((h) => helperOptions.find(opt => opt.code === h || opt.name === h)?.name || h).join(", ")}
                      {helpers.length > 2 ? ` +${helpers.length - 2}` : ""}
                    </div>
                  )}
                </div>
              ) : <span className="text-xs text-[var(--theme-text-mute)]">ບໍ່ລະບຸ</span>}
            </td>
          )}
          <td className="px-3 py-2 align-top">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${priority.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} />
              {priority.label}
            </span>
          </td>
          <td className="px-3 py-2 align-top">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${status.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </td>
          <td className="px-3 py-2 align-top">
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => handleEdit(wo)} className={iconButtonClass} title="ແກ້ໄຂ"><Edit3 className="w-3.5 h-3.5" /></button>
              <a href={`/service-admin/work-orders/print/${wo.id}`} target="_blank" rel="noreferrer" className={iconButtonClass} title="ພິມ"><Printer className="w-3.5 h-3.5" /></a>
              <button onClick={() => handleDelete(wo.id)} className={`${iconButtonClass} hover:text-rose-600`} title="ລຶບ"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </td>
        </tr>
        {isTaskExpanded && taskCount > 0 && (
          <tr className="border-b border-[var(--theme-border-subtle)] bg-[#fbfbfb]">
            <td colSpan={colSpan} className="px-3 py-3">
              <div className="ml-[156px] grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {taskNames.map((name, idx) => (
                  <div key={`${wo.id}-tasklist-${idx}`} className="flex items-center gap-2 rounded border border-[var(--theme-border-subtle)] bg-white px-2.5 py-1.5 text-xs">
                    <span className="font-mono text-[11px] text-[var(--theme-text-mute)]">{idx + 1}</span>
                    <span className="font-medium text-[var(--theme-text)]">{name}</span>
                  </div>
                ))}
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-[var(--theme-bg-muted)] px-3 py-3 md:px-4">
        <div className="mx-auto max-w-[1600px] space-y-3">
          <section className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--theme-border-subtle)] bg-white px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="font-medium text-[var(--theme-text)]">{summary.total} ໃບງານ</span>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <span key={key} className="inline-flex items-center gap-1.5 text-[11px]">
                  <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
                  <span className={config.text}>{summary.byStatus[key] || 0}</span>
                  <span className="text-[var(--theme-text-mute)]">{config.label}</span>
                </span>
              ))}
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs font-medium text-[var(--theme-accent)] hover:underline">
                ລ້າງຕົວກັ່ນຕອງ
              </button>
            )}
          </section>

          <section className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--theme-border-subtle)] bg-white px-3 py-2">
            <div className="flex flex-wrap items-center gap-1">
              <button onClick={() => setGroupBy("none")} className={`${plainButtonClass} ${groupBy === "none" ? activeButtonClass : ""}`}>
                <Layers className="h-3.5 w-3.5" />
                ລາຍການ
              </button>
              <button onClick={() => { setGroupBy("project"); expandAll(); }} className={`${plainButtonClass} ${groupBy === "project" ? activeButtonClass : ""}`}>
                <FolderOpen className="h-3.5 w-3.5" />
                ກຸ່ມໂຄງການ
              </button>
              <button onClick={() => { setGroupBy("technician"); expandAll(); }} className={`${plainButtonClass} ${groupBy === "technician" ? activeButtonClass : ""}`}>
                <User className="h-3.5 w-3.5" />
                ກຸ່ມຊ່າງ
              </button>
            </div>
            <div className="flex items-center gap-2">
              {groupBy !== "none" && (
                <>
                  <button onClick={expandAll} className="text-xs text-[var(--theme-text-mute)] hover:text-[var(--theme-text)]">ເປີດທັງໝົດ</button>
                  <span className="text-[var(--theme-border-subtle)]">|</span>
                  <button onClick={collapseAll} className="text-xs text-[var(--theme-text-mute)] hover:text-[var(--theme-text)]">ປິດທັງໝົດ</button>
                </>
              )}
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="h-8 rounded border border-[var(--theme-border-subtle)] bg-white px-2 text-xs text-[var(--theme-text)]">
                {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size} ແຖວ</option>)}
              </select>
              <ViewSwitcher value={viewMode} onChange={setViewMode} />
            </div>
          </section>

          <section className="overflow-hidden rounded border border-[var(--theme-border-subtle)] bg-white">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-[var(--theme-text-mute)]">
                <RefreshCw className="h-4 w-4 animate-spin" />
                ກຳລັງໂຫຼດຂໍ້ມູນ...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-[var(--theme-border)]">
                    <ClipboardList className="h-5 w-5 text-[var(--theme-text-mute)]" />
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--theme-text)]">ບໍ່ພົບໃບງານ</div>
                    <div className="mt-1 text-sm text-[var(--theme-text-mute)]">ປັບຄຳຄົ້ນ ຫຼື ຕົວກັ່ນຕອງແລ້ວລອງໃໝ່</div>
                  </div>
                </div>
              </div>
            ) : viewMode === "kanban" ? (
              <div className="px-3 pt-3 md:px-4">
                <KanbanBoard<any>
                  columns={Object.entries(STATUS_CONFIG).map(([key, config]) => ({
                    id: key,
                    title: (config as any).label,
                    color:
                      key === "draft"
                        ? "#94a3b8"
                        : key === "assigned"
                          ? "#f59e0b"
                          : key === "in_progress"
                            ? "#3b82f6"
                            : key === "completed"
                              ? "#10b981"
                              : key === "closed"
                                ? "#64748b"
                                : "#f43f5e",
                    records: filteredOrders.filter((o) => o.status === key),
                  }))}
                  getCardId={(o: any) => String(o.id)}
                  onCardClick={(o: any) => handleEdit(o)}
                  renderCard={(o: any) => {
                    const priority = PRIORITY_CONFIG[o.priority] || PRIORITY_CONFIG.Normal;
                    const techName =
                      techOptions.find(
                        (t) => t.code === o.technician_id || t.name === o.technician_id,
                      )?.name || o.technician_id || "ບໍ່ລະບຸ";
                    const tasks = Array.isArray(o.tasks) ? o.tasks : [];
                    const taskNames = tasks.length
                      ? tasks.map((t: any) => t.task_name || t.task || t.name).filter(Boolean)
                      : o.task_name
                        ? [o.task_name]
                        : [];
                    return (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-[11px] font-semibold text-[var(--theme-primary)]">
                            {o.code}
                          </span>
                          <span className="flex-shrink-0 text-[10px] text-[var(--theme-text-mute)] tabular-nums">
                            {formatDateDMY(o.created_at)}
                          </span>
                        </div>
                        <div className="truncate text-[12px] font-semibold text-[var(--theme-text)]">
                          {o.project_name || o.project_code || "-"}
                        </div>
                        {taskNames[0] && (
                          <div className="truncate text-[10px] text-[var(--theme-text-mute)]">
                            {taskNames[0]}
                            {taskNames.length > 1 ? ` +${taskNames.length - 1}` : ""}
                          </div>
                        )}
                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--theme-text-mute)]">
                          <span className="truncate">{techName}</span>
                          <span className={`tabular-nums ${priority.text}`}>
                            {priority.label}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
              </div>
            ) : groupBy === "none" ? (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    {tableHeader}
                    <tbody>{paginatedOrders.map((wo) => renderOrderRow(wo))}</tbody>
                  </table>
                </div>
                
                {totalPages > 1 && (
                  <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--theme-border-subtle)] bg-[#f7f7f7] px-3 py-2 sm:flex-row">
                    <div className="text-xs text-[var(--theme-text-mute)]">
                      ສະແດງ <span className="font-mono font-semibold text-[var(--theme-text)]">{startIndex + 1}</span> - <span className="font-mono font-semibold text-[var(--theme-text)]">{endIndex}</span> ຈາກ <span className="font-mono font-semibold text-[var(--theme-text)]">{totalItems}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => goToPage(1)} disabled={currentPage === 1} className={iconButtonClass}><ChevronsLeft className="w-4 h-4" /></button>
                      <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className={iconButtonClass}><ChevronLeft className="w-4 h-4" /></button>
                      <div className="flex items-center gap-1 mx-2">
                        {getPageNumbers().map((page, idx) => page === "..." ? <span key={`e-${idx}`} className="px-1 text-xs text-[var(--theme-text-mute)]">...</span> : <button key={page} onClick={() => goToPage(page)} className={`h-7 min-w-7 rounded border px-2 text-xs font-medium ${currentPage === page ? "border-[var(--theme-accent)] bg-[var(--theme-accent)] text-white" : "border-[var(--theme-border-subtle)] bg-white text-[var(--theme-text)] hover:bg-[var(--theme-bg-muted)]"}`}>{page}</button>)}
                      </div>
                      <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className={iconButtonClass}><ChevronRight className="w-4 h-4" /></button>
                      <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} className={iconButtonClass}><ChevronsRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="divide-y divide-[var(--theme-border-subtle)]">
                {groupedOrders?.map((group) => (
                  <div key={group.key}>
                    <button onClick={() => toggleGroup(group.key)} className="flex w-full items-center justify-between gap-3 bg-[#f7f7f7] px-3 py-2 text-left hover:bg-[var(--theme-bg-muted)]">
                      <div className="flex min-w-0 items-center gap-2">
                        {expandedGroups.has(group.key) ? <ChevronDown className="h-4 w-4 text-[var(--theme-text-mute)]" /> : <ChevronRight className="h-4 w-4 text-[var(--theme-text-mute)]" />}
                        {groupBy === "project" ? <FolderOpen className="h-4 w-4 text-[var(--theme-text-mute)]" /> : <User className="h-4 w-4 text-[var(--theme-text-mute)]" />}
                        <span className="truncate text-sm font-semibold text-[var(--theme-text)]">{group.label}</span>
                        <span className="rounded bg-white px-1.5 py-0.5 text-[11px] text-[var(--theme-text-mute)]">{group.orders.length}</span>
                      </div>
                      <div className="hidden items-center gap-2 md:flex">
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                          const count = group.orders.filter(o => o.status === key).length;
                          if (count === 0) return null;
                          return <span key={key} className={`inline-flex items-center gap-1 text-[11px] font-medium ${config.text}`}><span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />{count}</span>;
                        })}
                      </div>
                    </button>
                    {expandedGroups.has(group.key) && (
                      <div className="overflow-x-auto border-t border-[var(--theme-border-subtle)]">
                        <table className="min-w-full border-collapse">
                          {tableHeader}
                          <tbody className="bg-white">{group.orders.map((wo) => renderOrderRow(wo))}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {message && <div className="fixed bottom-5 right-5 z-50"><div className={`rounded border px-4 py-2 text-sm font-medium shadow-[var(--theme-shadow)] ${message.includes("ສຳເລັດ") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{message}</div></div>}
        </div>
      </div>

      <WorkOrderModal open={showOrderModal} onClose={() => setShowOrderModal(false)} message={message} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} projects={projects} contracts={contracts} form={form} setForm={setForm} taskOptions={taskOptions} techOptions={techOptions} techHelperDefaults={techHelperDefaults} selectedHelpers={selectedHelpers} helperLookup={helperLookup} helperToAdd={helperToAdd} setHelperToAdd={setHelperToAdd} defaultHelperOptions={defaultHelperOptions} otherHelperOptions={otherHelperOptions} saving={saving} submit={submit} resetForm={resetForm} />
    </>
  );
}

export default function Page() {
  return (
    <AuthGuard roles={["service_admin", "service_manager", "account_admin", "head_technician"]}>
      <WorkOrders />
    </AuthGuard>
  );
}
