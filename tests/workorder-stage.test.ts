import { test } from "node:test";
import assert from "node:assert/strict";
import { workOrderStage } from "../app/_lib/workorder-stage.ts";

test("rejection states take priority", () => {
  assert.equal(workOrderStage({ approval_status: "rejected", closed_at: "2025-01-01" }).key, "approval_rejected");
  assert.equal(workOrderStage({ accept_status: "rejected" }).key, "accept_rejected");
});

test("lifecycle is derived from timestamps, newest wins", () => {
  assert.equal(workOrderStage({ closed_at: "2025-01-02", checkout_at: "2025-01-01" }).key, "closed");
  assert.equal(workOrderStage({ checkout_at: "2025-01-01" }).key, "awaiting_review");
  assert.equal(workOrderStage({ checkin_at: "2025-01-01" }).key, "in_progress");
  assert.equal(workOrderStage({ accept_status: "accepted" }).key, "accepted");
});

test("fresh work order is 'issued'", () => {
  const s = workOrderStage({});
  assert.equal(s.key, "issued");
  assert.equal(s.tone, "neutral");
});

test("empty-string timestamps are treated as absent", () => {
  assert.equal(workOrderStage({ checkin_at: "", accept_status: "accepted" }).key, "accepted");
});

test("every stage carries a Lao label", () => {
  for (const w of [{}, { accept_status: "accepted" }, { checkin_at: "x" }, { checkout_at: "x" }, { closed_at: "x" }]) {
    assert.ok(workOrderStage(w).label.length > 0);
  }
});
