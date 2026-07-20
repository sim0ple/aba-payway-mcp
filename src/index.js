#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  loadConfig,
  requireRsaKey,
  nowReqTime,
  b64,
  signHmac,
  encryptMerchantAuth,
  postToPayway,
  PayWayConfigError,
} from "./payway.js";

const server = new McpServer({
  name: "aba-payway-mcp",
  version: "1.0.1",
});

// Wraps a tool handler so config errors and upstream failures come back
// as normal MCP tool results instead of crashing the server.
function tool(name, description, schema, handler) {
  server.registerTool(
    name,
    { description, inputSchema: schema },
    async (args) => {
      try {
        const config = loadConfig();
        const result = await handler(config, args ?? {});
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        const message =
          err instanceof PayWayConfigError ? `Config error: ${err.message}` : `Error: ${err.message}`;
        return { content: [{ type: "text", text: message }], isError: true };
      }
    }
  );
}

const maybeB64Json = (obj) => (obj === undefined ? undefined : b64(JSON.stringify(obj)));

// ---------------------------------------------------------------------------
// Ecommerce Checkout
// ---------------------------------------------------------------------------

tool(
  "payway_purchase",
  "Create a PayWay Purchase transaction (redirect/QR/deeplink checkout). Returns checkout HTML/JSON depending on payment_option.",
  {
    tran_id: z.string().max(20).describe("Unique transaction ID you generate"),
    amount: z.number().positive(),
    currency: z.enum(["KHR", "USD"]).optional(),
    firstname: z.string().max(100).optional(),
    lastname: z.string().max(100).optional(),
    email: z.string().max(50).optional(),
    phone: z.string().max(20).optional(),
    type: z.enum(["purchase", "pre-auth"]).optional(),
    payment_option: z
      .enum(["cards", "abapay_khqr", "abapay_khqr_deeplink", "alipay", "wechat", "google_pay"])
      .optional(),
    items: z.array(z.object({ name: z.string(), quantity: z.number(), price: z.number() })).optional(),
    shipping: z.number().optional(),
    return_url: z.string().optional().describe("Plain URL; will be base64-encoded automatically"),
    cancel_url: z.string().optional(),
    continue_success_url: z.string().optional(),
    skip_success_page: z.union([z.literal(0), z.literal(1)]).optional(),
    return_deeplink: z.object({ ios_scheme: z.string(), android_scheme: z.string() }).optional(),
    custom_fields: z.record(z.string()).optional(),
    return_params: z.string().optional(),
    payout: z.array(z.object({ acc: z.string(), amt: z.number() })).optional(),
    lifetime: z.number().int().min(3).optional().describe("Minutes; 3 min to 30 days"),
    view_type: z.enum(["hosted_view", "popup"]).optional(),
    payment_gate: z.union([z.literal(0), z.literal(1)]).optional(),
  },
  async (config, a) => {
    const req_time = nowReqTime();
    const items = a.items ? b64(JSON.stringify(a.items)) : "";
    const return_url = a.return_url ? b64(a.return_url) : "";
    const return_deeplink = a.return_deeplink ? b64(JSON.stringify(a.return_deeplink)) : "";
    const custom_fields = maybeB64Json(a.custom_fields) ?? "";
    const payout = a.payout ? b64(JSON.stringify(a.payout)) : "";

    const fields = [
      req_time,
      config.merchantId,
      a.tran_id,
      a.amount,
      items,
      a.shipping ?? "",
      a.firstname ?? "",
      a.lastname ?? "",
      a.email ?? "",
      a.phone ?? "",
      a.type ?? "",
      a.payment_option ?? "",
      return_url,
      a.cancel_url ?? "",
      a.continue_success_url ?? "",
      return_deeplink,
      a.currency ?? "",
      custom_fields,
      a.return_params ?? "",
      payout,
      a.lifetime ?? "",
      "", // additional_params (unsupported here)
      "", // google_pay_token (unsupported here)
      a.skip_success_page ?? "",
    ];
    const hash = signHmac(fields, config.apiKey);

    const body = {
      req_time,
      merchant_id: config.merchantId,
      tran_id: a.tran_id,
      amount: a.amount,
      items,
      shipping: a.shipping,
      firstname: a.firstname,
      lastname: a.lastname,
      email: a.email,
      phone: a.phone,
      type: a.type,
      payment_option: a.payment_option,
      return_url,
      cancel_url: a.cancel_url,
      continue_success_url: a.continue_success_url,
      return_deeplink,
      currency: a.currency,
      custom_fields,
      return_params: a.return_params,
      payout,
      lifetime: a.lifetime,
      skip_success_page: a.skip_success_page,
      view_type: a.view_type,
      payment_gate: a.payment_gate,
      hash,
    };
    return postToPayway(config, "/api/payment-gateway/v1/payments/purchase", body, "form");
  }
);

tool(
  "payway_check_transaction",
  "Check the status of a transaction created within the last 7 days.",
  { tran_id: z.string().max(20) },
  async (config, a) => {
    const req_time = nowReqTime();
    const hash = signHmac([req_time, config.merchantId, a.tran_id], config.apiKey);
    const body = { req_time, merchant_id: config.merchantId, tran_id: a.tran_id, hash };
    return postToPayway(config, "/api/payment-gateway/v1/payments/check-transaction-2", body, "json");
  }
);

tool(
  "payway_get_transaction_details",
  "Get full details/history of any past transaction (any age). Limited to 10 requests/minute by PayWay.",
  { tran_id: z.string().max(20) },
  async (config, a) => {
    const req_time = nowReqTime();
    const hash = signHmac([req_time, config.merchantId, a.tran_id], config.apiKey);
    const body = { req_time, merchant_id: config.merchantId, tran_id: a.tran_id, hash };
    return postToPayway(config, "/api/payment-gateway/v1/payments/transaction-detail", body, "json");
  }
);

tool(
  "payway_get_transaction_list",
  "List transactions filtered by date range (max 3 days), amount range, and status. Max 50 req/min.",
  {
    from_date: z.string().optional().describe("YYYY-MM-DD HH:mm:ss"),
    to_date: z.string().optional().describe("YYYY-MM-DD HH:mm:ss"),
    from_amount: z.number().optional(),
    to_amount: z.number().optional(),
    status: z
      .string()
      .optional()
      .describe("Comma-separated: APPROVED,PRE-AUTH,REFUNDED,PENDING,DECLINDED,CANCELLED"),
    page: z.string().optional(),
    pagination: z.string().optional().describe("Records per page, default 40, max 1000"),
  },
  async (config, a) => {
    const req_time = nowReqTime();
    const fields = [
      req_time,
      config.merchantId,
      a.from_date ?? "",
      a.to_date ?? "",
      a.from_amount ?? "",
      a.to_amount ?? "",
      a.status ?? "",
      a.page ?? "",
      a.pagination ?? "",
    ];
    const hash = signHmac(fields, config.apiKey);
    const body = {
      req_time,
      merchant_id: config.merchantId,
      from_date: a.from_date,
      to_date: a.to_date,
      from_amount: a.from_amount,
      to_amount: a.to_amount,
      status: a.status,
      page: a.page,
      pagination: a.pagination,
      hash,
    };
    return postToPayway(config, "/api/payment-gateway/v1/payments/transaction-list-2", body, "json");
  }
);

tool(
  "payway_get_transactions_by_merchant_ref",
  "Retrieve up to the last 50 transactions matching a merchant_ref (tag 62.01 on KHQR). Max 10 req/min.",
  { merchant_ref: z.string().max(20) },
  async (config, a) => {
    const req_time = nowReqTime();
    const hash = signHmac([req_time, config.merchantId, a.merchant_ref], config.apiKey);
    const body = { req_time, merchant_id: config.merchantId, merchant_ref: a.merchant_ref, hash };
    return postToPayway(
      config,
      "/api/payment-gateway/v1/payments/get-transactions-by-mc-ref",
      body,
      "json"
    );
  }
);

tool(
  "payway_close_transaction",
  "Cancel/close a transaction (e.g. flash sale, hotel booking, ticket). Sets status to CANCELLED, no callback sent.",
  { tran_id: z.string().max(20) },
  async (config, a) => {
    const req_time = nowReqTime();
    const hash = signHmac([req_time, config.merchantId, a.tran_id], config.apiKey);
    const body = { req_time, merchant_id: config.merchantId, tran_id: a.tran_id, hash };
    return postToPayway(config, "/api/payment-gateway/v1/payments/close-transaction", body, "json");
  }
);

tool(
  "payway_refund",
  "Issue a full or partial refund within 30 days of a COMPLETED transaction. Requires PAYWAY_RSA_PUBLIC_KEY.",
  { tran_id: z.string().max(20), refund_amount: z.number().positive() },
  async (config, a) => {
    const rsaKey = requireRsaKey(config);
    const request_time = nowReqTime();
    const merchant_auth = encryptMerchantAuth(
      { mc_id: config.merchantId, tran_id: a.tran_id, refund_amount: a.refund_amount },
      rsaKey
    );
    const hash = signHmac([request_time, config.merchantId, merchant_auth], config.apiKey);
    const body = { request_time, merchant_id: config.merchantId, merchant_auth, hash };
    return postToPayway(
      config,
      "/api/merchant-portal/merchant-access/online-transaction/refund",
      body,
      "json"
    );
  }
);

tool(
  "payway_exchange_rate",
  "Fetch ABA Bank's current buy/sell exchange rates (same as ababank.com/en/forex-exchange).",
  {},
  async (config) => {
    const req_time = nowReqTime();
    const hash = signHmac([req_time, config.merchantId], config.apiKey);
    const body = { req_time, merchant_id: config.merchantId, hash };
    return postToPayway(config, "/api/payment-gateway/v1/exchange-rate", body, "json");
  }
);

// ---------------------------------------------------------------------------
// ABA QR API
// ---------------------------------------------------------------------------

tool(
  "payway_generate_qr",
  "Generate a KHQR / WeChat / Alipay QR code (string + PNG image + ABA deeplink) for a payment, without a hosted checkout page.",
  {
    tran_id: z.string().max(20),
    amount: z.number().positive(),
    currency: z.enum(["KHR", "USD"]),
    payment_option: z.enum(["abapay_khqr", "wechat", "alipay"]),
    qr_image_template: z.string().max(20).default("template3_color"),
    lifetime: z.number().int().min(3).default(30),
    first_name: z.string().max(20).optional(),
    last_name: z.string().max(20).optional(),
    email: z.string().max(50).optional(),
    phone: z.string().max(20).optional(),
    purchase_type: z.enum(["purchase", "pre-auth"]).optional(),
    items: z.array(z.object({ name: z.string(), quantity: z.number(), price: z.number() })).optional(),
    callback_url: z.string().optional().describe("Plain URL; base64-encoded automatically"),
    return_deeplink: z.object({ ios_scheme: z.string(), android_scheme: z.string() }).optional(),
    custom_fields: z.record(z.string()).optional(),
    return_params: z.string().optional(),
    payout: z.array(z.object({ account: z.string(), amount: z.number() })).optional(),
  },
  async (config, a) => {
    const req_time = nowReqTime();
    const items = a.items ? b64(JSON.stringify(a.items)) : "";
    const callback_url = a.callback_url ? b64(a.callback_url) : "";
    const return_deeplink = a.return_deeplink ? b64(JSON.stringify(a.return_deeplink)) : "";
    const custom_fields = maybeB64Json(a.custom_fields) ?? "";
    const payout = a.payout ? b64(JSON.stringify(a.payout)) : "";

    const fields = [
      req_time,
      config.merchantId,
      a.tran_id,
      a.amount,
      items,
      a.first_name ?? "",
      a.last_name ?? "",
      a.email ?? "",
      a.phone ?? "",
      a.purchase_type ?? "",
      a.payment_option,
      callback_url,
      return_deeplink,
      a.currency,
      custom_fields,
      a.return_params ?? "",
      payout,
      a.lifetime,
      a.qr_image_template,
    ];
    const hash = signHmac(fields, config.apiKey);

    const body = {
      req_time,
      merchant_id: config.merchantId,
      tran_id: a.tran_id,
      first_name: a.first_name,
      last_name: a.last_name,
      email: a.email,
      phone: a.phone,
      amount: a.amount,
      currency: a.currency,
      purchase_type: a.purchase_type,
      payment_option: a.payment_option,
      items,
      callback_url,
      return_deeplink,
      custom_fields,
      return_params: a.return_params,
      payout,
      lifetime: a.lifetime,
      qr_image_template: a.qr_image_template,
      hash,
    };
    return postToPayway(config, "/api/payment-gateway/v1/payments/generate-qr", body, "json");
  }
);

// ---------------------------------------------------------------------------
// Payment Link
// ---------------------------------------------------------------------------

tool(
  "payway_create_payment_link",
  "Create a shareable PayWay payment link. Requires PAYWAY_RSA_PUBLIC_KEY.",
  {
    title: z.string().max(250),
    amount: z.number().positive(),
    currency: z.enum(["KHR", "USD"]),
    description: z.string().max(250).optional(),
    payment_limit: z.number().int().optional(),
    expired_date: z.number().optional().describe("Unix timestamp; omit/null for no expiry"),
    return_url: z.string().describe("Plain URL; base64-encoded automatically"),
    merchant_ref_no: z.string().max(50).optional(),
    payout: z.array(z.object({ acc: z.string(), amt: z.number() })).optional(),
  },
  async (config, a) => {
    const rsaKey = requireRsaKey(config);
    const request_time = nowReqTime();
    const authPayload = {
      mc_id: config.merchantId,
      title: a.title,
      amount: a.amount,
      currency: a.currency,
      description: a.description,
      payment_limit: a.payment_limit,
      expired_date: a.expired_date,
      return_url: b64(a.return_url),
      merchant_ref_no: a.merchant_ref_no,
      payout: a.payout ? JSON.stringify(a.payout) : undefined,
    };
    const merchant_auth = encryptMerchantAuth(authPayload, rsaKey);
    const hash = signHmac([request_time, config.merchantId, merchant_auth], config.apiKey);
    const body = { request_time, merchant_id: config.merchantId, merchant_auth, hash };
    return postToPayway(
      config,
      "/api/merchant-portal/merchant-access/payment-link/create",
      body,
      "form"
    );
  }
);

tool(
  "payway_get_payment_link_details",
  "Get details/status of a previously created payment link. Requires PAYWAY_RSA_PUBLIC_KEY.",
  { id: z.string().describe("The payment link ID returned by payway_create_payment_link") },
  async (config, a) => {
    const rsaKey = requireRsaKey(config);
    const request_time = nowReqTime();
    const merchant_auth = encryptMerchantAuth({ mc_id: config.merchantId, id: a.id }, rsaKey);
    const hash = signHmac([request_time, config.merchantId, merchant_auth], config.apiKey);
    const body = { request_time, merchant_id: config.merchantId, merchant_auth, hash };
    return postToPayway(
      config,
      "/api/merchant-portal/merchant-access/payment-link/detail",
      body,
      "json"
    );
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
