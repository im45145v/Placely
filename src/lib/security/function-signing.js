import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const DEFAULT_MAX_AGE_SECONDS = 300;

function canonicalizePayload(payload) {
  return JSON.stringify(payload ?? null);
}

export function createFunctionSignature({ payload, issuedAt, nonce, secret }) {
  const hmac = createHmac("sha256", secret);
  hmac.update(issuedAt);
  hmac.update(":");
  hmac.update(nonce);
  hmac.update(":");
  hmac.update(canonicalizePayload(payload));
  return hmac.digest("hex");
}

export function signFunctionPayload(payload, secret) {
  const issuedAt = new Date().toISOString();
  const nonce = randomUUID();
  const signature = createFunctionSignature({ payload, issuedAt, nonce, secret });
  return {
    ...payload,
    issuedAt,
    nonce,
    signature,
  };
}

export function verifySignedFunctionPayload({
  payload,
  issuedAt,
  nonce,
  signature,
  secret,
  now,
  maxAgeSeconds,
}) {
  if (typeof issuedAt !== "string" || typeof nonce !== "string" || typeof signature !== "string") {
    return { ok: false, reason: "Missing execution signature." };
  }

  const issuedAtMs = Date.parse(issuedAt);
  if (Number.isNaN(issuedAtMs)) {
    return { ok: false, reason: "Invalid execution timestamp." };
  }

  const referenceNow = now ?? Date.now();
  const maxAgeMs = (maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS) * 1000;
  if (Math.abs(referenceNow - issuedAtMs) > maxAgeMs) {
    return { ok: false, reason: "Execution signature expired." };
  }

  const expected = createFunctionSignature({
    payload,
    issuedAt,
    nonce,
    secret,
  });
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(signature, "utf8");
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return { ok: false, reason: "Invalid execution signature." };
  }

  return { ok: true };
}
