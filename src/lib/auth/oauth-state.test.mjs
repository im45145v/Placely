import test from "node:test";
import assert from "node:assert/strict";
import { isValidOAuthState } from "./oauth-state.js";

test("oauth state validation accepts exact matches", () => {
  assert.equal(isValidOAuthState("abc", "abc"), true);
});

test("oauth state validation rejects missing or mismatched values", () => {
  assert.equal(isValidOAuthState("abc", "xyz"), false);
  assert.equal(isValidOAuthState("", "abc"), false);
  assert.equal(isValidOAuthState("abc", ""), false);
});
