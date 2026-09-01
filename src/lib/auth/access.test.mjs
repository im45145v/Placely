import test from "node:test";
import assert from "node:assert/strict";
import { getAuthRedirectReason } from "./access.js";

test("missing app user fails closed", () => {
  assert.equal(getAuthRedirectReason(null), "account_not_provisioned");
});

test("inactive app user is rejected", () => {
  assert.equal(getAuthRedirectReason({ isActive: false }), "inactive_user");
});

test("active app user is accepted", () => {
  assert.equal(getAuthRedirectReason({ isActive: true }), null);
});
