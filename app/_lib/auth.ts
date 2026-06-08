export const ROLES = {
  ACCOUNT_ADMIN: "account_admin",
  HEAD_TECHNICIAN: "head_technician",
  SALE_ADMIN: "sale_admin",
  SALE_MANAGER: "sale_manager",
  SERVICE_ADMIN: "service_admin",
  SERVICE_MANAGER: "service_manager",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export function normalizeRole(role: unknown): string {
  return String(role || "").trim().toLowerCase();
}

export function parseRoleList(roleData: unknown): string[] {
  if (Array.isArray(roleData)) return roleData.map(normalizeRole).filter(Boolean);
  if (typeof roleData === "string") {
    return roleData.split(",").map(normalizeRole).filter(Boolean);
  }
  const role = normalizeRole(roleData);
  return role ? [role] : [];
}

export function getEffectiveRoles(user: { role?: unknown; allRoles?: unknown } | null | undefined): string[] {
  if (!user) return [];
  return [...new Set([...parseRoleList(user.role), ...parseRoleList(user.allRoles)])];
}

export function hasAnyRole(user: { role?: unknown; allRoles?: unknown } | null | undefined, allowedRoles: string[] = []): boolean {
  if (!allowedRoles.length) return true;
  const effectiveRoles = getEffectiveRoles(user);
  return allowedRoles.map(normalizeRole).some((role) => effectiveRoles.includes(role));
}
