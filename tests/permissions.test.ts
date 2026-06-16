import { test } from "node:test";
import assert from "node:assert/strict";
import {
  can,
  canView,
  isAdmin,
  isManager,
  normalizePermissions,
  fullPermissions,
  allowedModules,
  moduleForPath,
  MODULES,
} from "../app/_lib/permissions.ts";

test("admin has implicit full access", () => {
  const admin = { role: "admin", permissions: {} };
  assert.equal(can(admin, "finance", "view"), true);
  assert.equal(can(admin, "work-orders", "approve"), true);
  assert.equal(isAdmin(admin), true);
});

test("manager is matrix-driven (no implicit module access)", () => {
  const mgr = { role: "manager", permissions: {} };
  // Module access follows the matrix — empty perms means no module view.
  assert.equal(canView(mgr, "finance"), false);
  // But the manager tier flag is still true (user management etc.).
  assert.equal(isManager(mgr), true);
  // Granting view works.
  const mgr2 = { role: "manager", permissions: { finance: ["view"] as const } };
  assert.equal(canView(mgr2, "finance"), true);
});

test("staff only sees explicitly granted modules", () => {
  const staff = { role: "staff", permissions: { customers: ["view", "create"] as const } };
  assert.equal(canView(staff, "customers"), true);
  assert.equal(can(staff, "customers", "create"), true);
  assert.equal(can(staff, "customers", "delete"), false);
  assert.equal(canView(staff, "finance"), false);
});

test("normalizePermissions keeps only valid keys/actions", () => {
  const out = normalizePermissions({
    customers: ["view", "bogus"],
    not_a_module: ["view"],
    boq: ["approve"],
  });
  assert.deepEqual(out.customers, ["view"]);
  assert.deepEqual(out.boq, ["approve"]);
  assert.equal("not_a_module" in out, false);
});

test("fullPermissions grants every action on every module", () => {
  const full = fullPermissions();
  for (const m of MODULES) {
    assert.deepEqual(full[m.key], [...m.actions]);
  }
});

test("allowedModules reflects view access", () => {
  const staff = { role: "staff", permissions: { boq: ["view"] as const } };
  const keys = allowedModules(staff).map((m) => m.key);
  assert.deepEqual(keys, ["boq"]);
});

test("null / undefined user has no access", () => {
  assert.equal(canView(null, "customers"), false);
  assert.equal(canView(undefined, "customers"), false);
  assert.equal(isAdmin(null), false);
});

test("moduleForPath matches the owning module by longest prefix", () => {
  assert.equal(moduleForPath("/customers")?.key, "customers");
  assert.equal(moduleForPath("/work-orders/123")?.key, "work-orders");
  assert.equal(moduleForPath("/tech-summary")?.key, "tech-summary");
  assert.equal(moduleForPath("/nope"), null);
});

test("role matching is case/space tolerant", () => {
  assert.equal(isAdmin({ role: " Admin ", permissions: {} }), true);
  assert.equal(isManager({ role: "MANAGER", permissions: {} }), true);
});
