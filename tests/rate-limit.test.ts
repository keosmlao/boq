import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLoginAllowed, recordLoginFailure, recordLoginSuccess } from "../app/_lib/rate-limit.ts";

test("allows attempts before the threshold", () => {
  const u = "user_a";
  for (let i = 0; i < 4; i++) {
    assert.equal(checkLoginAllowed(u).ok, true);
    recordLoginFailure(u);
  }
  assert.equal(checkLoginAllowed(u).ok, true); // 4 fails — still allowed
});

test("locks out after 5 failures", () => {
  const u = "user_b";
  for (let i = 0; i < 5; i++) recordLoginFailure(u);
  const gate = checkLoginAllowed(u);
  assert.equal(gate.ok, false);
  assert.ok((gate.retryAfterSec ?? 0) > 0);
});

test("success clears the counter", () => {
  const u = "user_c";
  for (let i = 0; i < 5; i++) recordLoginFailure(u);
  assert.equal(checkLoginAllowed(u).ok, false);
  recordLoginSuccess(u);
  assert.equal(checkLoginAllowed(u).ok, true);
});

test("key is case-insensitive and trimmed", () => {
  for (let i = 0; i < 5; i++) recordLoginFailure("  User_D ");
  assert.equal(checkLoginAllowed("user_d").ok, false);
});
