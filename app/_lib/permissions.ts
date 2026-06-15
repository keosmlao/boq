/**
 * RBAC catalog + helpers — shared by client (sidebar / button gating) and server
 * (middleware / action guards).
 *
 * Model: every user has a `role` (admin | manager | staff) and a per-module
 * `permissions` map `{ moduleKey: action[] }`.
 *   - admin   → full access + user management (implicit, perms ignored).
 *   - manager → full access + user management (implicit, perms ignored).
 *   - staff   → ONLY the modules/actions explicitly granted in `permissions`.
 * The "users" admin area is gated by role (manager+), never by the staff matrix.
 */
export type Role = "admin" | "manager" | "head_craftsman" | "staff";
export type Action = "view" | "create" | "edit" | "delete" | "approve";
export type Permissions = Record<string, Action[]>;

export type AccessUser = {
  role?: string | null;
  permissions?: Permissions | null;
} | null | undefined;

export type ModuleDef = {
  key: string;
  label: string;
  href: string;
  /** Actions this module supports (drives the permission matrix UI). */
  actions: Action[];
};

/** Business modules a staff member can be granted. Order = sidebar order. */
export const MODULES: ModuleDef[] = [
  { key: "customers", label: "ລູກຄ້າ", href: "/customers", actions: ["view", "create", "edit", "delete"] },
  { key: "projects", label: "ໂຄງການ", href: "/projects", actions: ["view", "create", "edit", "delete"] },
  { key: "quotations", label: "ໃບສະເໜີລາຄາ", href: "/quotations", actions: ["view", "create", "edit", "delete", "approve"] },
  { key: "contracts", label: "ສັນຍາ", href: "/contracts", actions: ["view", "create", "edit", "delete", "approve"] },
  { key: "boq", label: "BOQ", href: "/boq", actions: ["view", "create", "edit", "delete", "approve"] },
  { key: "schedule", label: "ກຳນົດໜ້າວຽກ", href: "/schedule", actions: ["view", "create", "edit", "delete"] },
  { key: "work-orders", label: "ໃບງານ", href: "/work-orders", actions: ["view", "create", "edit", "delete", "approve"] },
  { key: "tracking", label: "ຕິດຕາມຊ່າງ", href: "/tracking", actions: ["view"] },
  { key: "requests", label: "ຂໍເບີກ", href: "/requests", actions: ["view", "create", "edit", "delete", "approve"] },
  { key: "finance", label: "ບັນຊີ / ງວດຈ່າຍ", href: "/finance", actions: ["view"] },
  { key: "inventory", label: "ສິນຄ້າ / ສະຕັອກ", href: "/inventory", actions: ["view"] },
  { key: "reports", label: "ລາຍງານ & ສະຖິຕິ", href: "/reports", actions: ["view"] },
];

export const ACTION_LABELS: Record<Action, string> = {
  view: "ເບິ່ງ",
  create: "ສ້າງ",
  edit: "ແກ້ໄຂ",
  delete: "ລຶບ",
  approve: "ອະນຸມັດ",
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "ຜູ້ດູແລລະບົບ",
  manager: "ຜູ້ຈັດການ",
  head_craftsman: "ຫົວໜ້າຊ່າງ",
  staff: "ພະນັກງານ",
};

/** Route prefix that opens the user-management area (role-gated, not in the matrix). */
export const USERS_HREF = "/users";

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

export function isAdmin(u: AccessUser): boolean {
  return norm(u?.role) === "admin";
}

/** manager OR admin — the "can manage users / full access" tier. */
export function isManager(u: AccessUser): boolean {
  const r = norm(u?.role);
  return r === "admin" || r === "manager";
}

/** Can the user perform `action` on `moduleKey`? Managers/admins always can. */
export function can(u: AccessUser, moduleKey: string, action: Action = "view"): boolean {
  if (isManager(u)) return true;
  const acts = u?.permissions?.[moduleKey];
  return Array.isArray(acts) && acts.includes(action);
}

export function canView(u: AccessUser, moduleKey: string): boolean {
  return can(u, moduleKey, "view");
}

/** Modules the user may see in the sidebar (view access). */
export function allowedModules(u: AccessUser): ModuleDef[] {
  return MODULES.filter((m) => canView(u, m.key));
}

/** The module that owns a given pathname (longest matching href prefix), or null. */
export function moduleForPath(pathname: string): ModuleDef | null {
  let best: ModuleDef | null = null;
  for (const m of MODULES) {
    if (pathname === m.href || pathname.startsWith(m.href + "/")) {
      if (!best || m.href.length > best.href.length) best = m;
    }
  }
  return best;
}

/** Normalize an arbitrary stored value into a clean Permissions map. */
export function normalizePermissions(raw: unknown): Permissions {
  const out: Permissions = {};
  if (!raw || typeof raw !== "object") return out;
  const validKeys = new Set(MODULES.map((m) => m.key));
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!validKeys.has(k) || !Array.isArray(v)) continue;
    const mod = MODULES.find((m) => m.key === k)!;
    const acts = v.map(norm).filter((a): a is Action => (mod.actions as string[]).includes(a));
    if (acts.length) out[k] = [...new Set(acts)] as Action[];
  }
  return out;
}

/** Grant every action on every module — used as the admin/manager baseline. */
export function fullPermissions(): Permissions {
  const out: Permissions = {};
  for (const m of MODULES) out[m.key] = [...m.actions];
  return out;
}
