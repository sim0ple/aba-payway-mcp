import crypto from "node:crypto";

/**
 * Core PayWay (ABA Bank) helpers: request-time formatting, HMAC-SHA512
 * hash generation, RSA "merchant_auth" chunk encryption, and a thin
 * HTTP client that posts to the correct sandbox/production checkout host.
 *
 * Everything here mirrors the PHP sample code published at
 * https://developer.payway.com.kh exactly (field order matters for the hash).
 */

export const BASE_URLS = {
  sandbox: "https://checkout-sandbox.payway.com.kh",
  production: "https://checkout.payway.com.kh",
};

export function nowReqTime() {
  // YYYYMMDDHHmmss in UTC, as required by every PayWay endpoint.
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

export function b64(input) {
  return Buffer.from(input, "utf8").toString("base64");
}

/**
 * Base64(HMAC-SHA512(concatenatedFields, apiKey)).
 * `fields` must already be in the exact order PayWay's docs specify for
 * that endpoint. Undefined/null fields are treated as empty string, which
 * matches PHP's behaviour of concatenating unset optional params as "".
 */
export function signHmac(fields, apiKey) {
  const b4hash = fields.map((v) => (v === undefined || v === null ? "" : String(v))).join("");
  return crypto.createHmac("sha512", apiKey).update(b4hash, "utf8").digest("base64");
}

/**
 * RSA-encrypts a JSON payload in 117-byte chunks using PKCS#1 v1.5 padding
 * (matches PHP's openssl_public_encrypt default), concatenates the raw
 * encrypted chunks, and base64-encodes the result. Used for `merchant_auth`
 * on Refund, Create Payment Link, and Get Payment Link Details.
 */
export function encryptMerchantAuth(payloadObj, rsaPublicKeyPem) {
  const source = Buffer.from(JSON.stringify(payloadObj), "utf8");
  const chunkSize = 117;
  const encryptedChunks = [];
  for (let offset = 0; offset < source.length; offset += chunkSize) {
    const chunk = source.subarray(offset, offset + chunkSize);
    const encrypted = crypto.publicEncrypt(
      {
        key: rsaPublicKeyPem,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      chunk
    );
    encryptedChunks.push(encrypted);
  }
  return Buffer.concat(encryptedChunks).toString("base64");
}

export class PayWayConfigError extends Error {}

export function loadConfig() {
  const merchantId = process.env.PAYWAY_MERCHANT_ID;
  const apiKey = process.env.PAYWAY_API_KEY;
  const env = (process.env.PAYWAY_ENV || "sandbox").toLowerCase();
  const rsaPublicKey = process.env.PAYWAY_RSA_PUBLIC_KEY;

  if (!merchantId || !apiKey) {
    throw new PayWayConfigError(
      "Missing PAYWAY_MERCHANT_ID or PAYWAY_API_KEY environment variables."
    );
  }
  if (!BASE_URLS[env]) {
    throw new PayWayConfigError(`PAYWAY_ENV must be "sandbox" or "production", got "${env}".`);
  }
  return {
    merchantId,
    apiKey,
    env,
    baseUrl: BASE_URLS[env],
    // PEM string; \n literals are common when passed via env vars/CI, so
    // normalize them into real newlines.
    rsaPublicKey: rsaPublicKey ? rsaPublicKey.replace(/\\n/g, "\n") : undefined,
  };
}

export function requireRsaKey(config) {
  if (!config.rsaPublicKey) {
    throw new PayWayConfigError(
      "This operation requires PAYWAY_RSA_PUBLIC_KEY (the RSA public key PayWay issued for merchant_auth encryption)."
    );
  }
  return config.rsaPublicKey;
}

/**
 * POSTs to a PayWay checkout endpoint and returns parsed JSON.
 * `contentType` is 'json' (application/json) or 'form' (multipart-ish
 * application/x-www-form-urlencoded — PayWay accepts urlencoded for the
 * multipart/form-data endpoints too, avoiding a multipart dependency).
 */
export async function postToPayway(config, path, body, contentType = "json") {
  const url = config.baseUrl + path;
  let fetchBody;
  let headers;

  if (contentType === "json") {
    fetchBody = JSON.stringify(body);
    headers = { "Content-Type": "application/json" };
  } else {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) params.append(k, String(v));
    }
    fetchBody = params.toString();
    headers = { "Content-Type": "application/x-www-form-urlencoded" };
  }

  const res = await fetch(url, { method: "POST", headers, body: fetchBody });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw_response: text, http_status: res.status };
  }
  if (!res.ok && typeof parsed === "object") {
    parsed._http_status = res.status;
  }
  return parsed;
}
