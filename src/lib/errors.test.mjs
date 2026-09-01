import test from "node:test";
import assert from "node:assert/strict";
import { getSafeUserMessage } from "./errors-user-message.js";

test("toUserMessage preserves explicit AppError messages", () => {
  assert.equal(getSafeUserMessage({ name: "AppError", message: "Denied" }), "Denied");
});

test("toUserMessage does not leak raw unexpected error messages", () => {
  assert.equal(
    getSafeUserMessage(new Error("database host db.internal.local is unreachable")),
    "An unexpected error occurred."
  );
});
