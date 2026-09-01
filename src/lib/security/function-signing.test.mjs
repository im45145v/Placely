import test from "node:test";
import assert from "node:assert/strict";
import {
  createFunctionSignature,
  signFunctionPayload,
  verifySignedFunctionPayload,
} from "./function-signing.js";

test("signed function payload verifies with matching secret and payload", () => {
  const signed = signFunctionPayload({ operationId: "bulk-1" }, "shared-secret");
  const verification = verifySignedFunctionPayload({
    payload: { operationId: "bulk-1" },
    issuedAt: signed.issuedAt,
    nonce: signed.nonce,
    signature: signed.signature,
    secret: "shared-secret",
  });

  assert.deepEqual(verification, { ok: true });
});

test("signed function payload rejects tampered payloads", () => {
  const issuedAt = "2026-09-01T12:00:00.000Z";
  const nonce = "nonce-1";
  const signature = createFunctionSignature({
    payload: { operationId: "bulk-1" },
    issuedAt,
    nonce,
    secret: "shared-secret",
  });

  const verification = verifySignedFunctionPayload({
    payload: { operationId: "bulk-2" },
    issuedAt,
    nonce,
    signature,
    secret: "shared-secret",
    now: Date.parse("2026-09-01T12:01:00.000Z"),
  });

  assert.deepEqual(verification, { ok: false, reason: "Invalid execution signature." });
});

test("signed function payload rejects expired executions", () => {
  const signature = createFunctionSignature({
    payload: { type: "SHORTLISTED" },
    issuedAt: "2026-09-01T12:00:00.000Z",
    nonce: "nonce-2",
    secret: "shared-secret",
  });

  const verification = verifySignedFunctionPayload({
    payload: { type: "SHORTLISTED" },
    issuedAt: "2026-09-01T12:00:00.000Z",
    nonce: "nonce-2",
    signature,
    secret: "shared-secret",
    now: Date.parse("2026-09-01T12:10:01.000Z"),
  });

  assert.deepEqual(verification, { ok: false, reason: "Execution signature expired." });
});
