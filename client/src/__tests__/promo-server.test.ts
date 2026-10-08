// @vitest-environment node
/**
 * Rhemito promo server module (PROMO_MODULE_SPEC_RHEMITO.md §5) against a stub Mito service.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import http from "http";
import type { AddressInfo } from "net";
import express from "express";

type Call = { path: string; body: any; headers: http.IncomingHttpHeaders };
const calls: Call[] = [];
let validateReply: { status: number; body: any } = { status: 200, body: { valid: true, appliedDiscount: 1, appliesTo: "fee", displayText: "GBP 1.00 off", currency: "GBP" } };
let redeemReply: { status: number; body: any } = { status: 200, body: { success: true, discount: 1 } };
let mito: http.Server;
let app: http.Server;
let base = "";

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const flush = () => new Promise((r) => setTimeout(r, 50));

// Modules are imported after MITO_API_URL points at the stub
let storage: typeof import("../../../server/storage").storage;
let promo: typeof import("../../../server/promo");

beforeAll(async () => {
  mito = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      const body = raw ? JSON.parse(raw) : {};
      calls.push({ path: req.url ?? "", body, headers: req.headers });
      const send = (status: number, b: any) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(b)); };
      if (req.url === "/api/promocodes/validate") return send(validateReply.status, validateReply.body);
      if (req.url === "/api/promocodes/redeem") return send(redeemReply.status, redeemReply.body);
      if (req.url === "/api/promocodes/release") return send(200, { success: true, released: 1 });
      if (req.url?.startsWith("/api/promocodes/customers/") && req.method === "GET") {
        return send(200, { data: [{ id: "pr1", code: "SAVE5", transaction_id: "TXN-1", discount: 5, currency: "GBP", status: "Redeemed", created_at: "2026-10-01T10:00:00Z" }, { id: "pr2", code: "OLD", discount: 2, currency: "GBP", status: "Released", created_at: "2026-10-02T10:00:00Z" }], summary: { saved: { GBP: 5 } } });
      }
      return send(200, { success: true });
    });
  });
  await new Promise<void>((r) => mito.listen(0, r));
  process.env.MITO_API_URL = `http://127.0.0.1:${(mito.address() as AddressInfo).port}`;
  process.env.NODE_ENV = "test";

  ({ storage } = await import("../../../server/storage"));
  promo = await import("../../../server/promo");
  const { registerSendMoneyRoutes } = await import("../../../server/sendMoneyRoutes");
  const e = express();
  e.use(express.json());
  promo.registerPromoRoutes(e);
  registerSendMoneyRoutes(e);
  app = e.listen(0);
  await new Promise((r) => app.once("listening", r));
  base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
});

afterAll(() => { app?.close(); mito?.close(); });

beforeEach(async () => {
  calls.length = 0;
  validateReply = { status: 200, body: { valid: true, appliedDiscount: 1, appliesTo: "fee", displayText: "GBP 1.00 off", currency: "GBP" } };
  redeemReply = { status: 200, body: { success: true, discount: 1 } };
  delete process.env.PROMO_ENABLED;
  (await import("../../../server/promo/routes")).__resetPromoRateLimit();
  promo.promoOutbox.clear();
});

async function newTx(over: Record<string, unknown> = {}) {
  const res = await api("POST", "/api/send-money/transactions", {
    recipientName: "Ada Obi", service: "bank_deposit", sendCurrency: "GBP", sendAmount: "100.00", receiveCurrency: "NGN",
    receiveAmount: "202550.00", fee: "3.00", exchangeRate: "2025.50", ...over,
  });
  expect(res.status).toBe(201);
  return res.body.data;
}

describe("P-10 validate", () => {
  it("keeps the response fields, uses the session user (not the body) and omits an unchosen payment method", async () => {
    const r = await api("POST", "/api/promocodes/validate", { code: "save5", amount: 100, fee: 3, currency: "gbp", sourceCurrency: "GBP", destCurrency: "NGN", userId: "HACKER" });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ valid: true, appliedDiscount: 1, appliesTo: "fee", displayText: "GBP 1.00 off", currency: "GBP" });
    const sent = calls.find((c) => c.path === "/api/promocodes/validate")!.body;
    expect(sent).toMatchObject({ code: "SAVE5", userId: "user_123", currency: "GBP" });
    expect(sent).not.toHaveProperty("paymentMethod");
  });

  it("returns Mito's message as a string error with its code", async () => {
    validateReply = { status: 400, body: { error: "This promo code has expired.", code: "EXPIRED" } };
    const r = await api("POST", "/api/promocodes/validate", { code: "OLD", amount: 100, fee: 3 });
    expect(r).toEqual({ status: 400, body: { error: "This promo code has expired.", code: "EXPIRED" } });
  });

  it("checks input before calling Mito, and rate limits", async () => {
    expect((await api("POST", "/api/promocodes/validate", { code: "bad code", amount: 100 })).body.error).toBe("Enter a valid promo code.");
    expect((await api("POST", "/api/promocodes/validate", { code: "OK", amount: 0 })).body.error).toBe("Enter the amount you're sending first.");
    let last;
    for (let i = 0; i < 21; i++) last = await api("POST", "/api/promocodes/validate", { code: "OK", amount: 10 });
    expect(last!.status).toBe(429);
  });

  it("feature flag off: field hidden and validate 404 (NFR-3)", async () => {
    process.env.PROMO_ENABLED = "false";
    expect((await api("GET", "/api/promocodes/status")).body.data.enabled).toBe(false);
    expect((await api("POST", "/api/promocodes/validate", { code: "SAVE5", amount: 100 })).status).toBe(404);
  });
});

describe("P-20 – P-25 pay with a promo code", () => {
  it("records a code applied on the payment step, using stored amounts, and saves the discount", async () => {
    const tx = await newTx();
    const r = await api("POST", `/api/send-money/transactions/${tx.id}/pay`, { paymentMethod: "card", promoCode: "save5", promoDiscount: "1.00" });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ promoCode: "SAVE5", promoDiscount: "1.00", fee: "2.00", status: "completed" });
    const redeem = calls.find((c) => c.path === "/api/promocodes/redeem")!.body;
    expect(redeem).toMatchObject({ code: "SAVE5", transactionId: tx.reference, amount: 100, fee: 3, paymentMethod: "card", userId: "user_123" });
  });

  it("stops the payment when Mito rejects the code or the discount changed", async () => {
    validateReply = { status: 400, body: { error: "This promo code has reached its limit.", code: "FULLY_REDEEMED" } };
    const tx = await newTx();
    const r = await api("POST", `/api/send-money/transactions/${tx.id}/pay`, { paymentMethod: "card", promoCode: "SAVE5", promoDiscount: "1.00" });
    expect(r.status).toBe(409);
    expect(r.body.error).toEqual({ code: "PROMO_REJECTED", message: "This promo code has reached its limit. Go back and remove the promo code to continue." });
    expect((await storage.getSendMoneyTransactionById(tx.id))!.status).toBe("awaiting_payment");

    validateReply = { status: 200, body: { valid: true, appliedDiscount: 0.5 } };
    const r2 = await api("POST", `/api/send-money/transactions/${tx.id}/pay`, { paymentMethod: "card", promoCode: "SAVE5", promoDiscount: "1.00" });
    expect(r2.body.error.code).toBe("PROMO_CHANGED");
    expect(calls.some((c) => c.path === "/api/promocodes/redeem")).toBe(false);
  });

  it("still works for a code saved when the transaction was created (old path)", async () => {
    const tx = await newTx({ fee: "2.00", promoCode: "SAVE5", feeBeforePromo: "3.00" });
    const r = await api("POST", `/api/send-money/transactions/${tx.id}/pay`, { paymentMethod: "instant_bank" });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ promoCode: "SAVE5", fee: "2.00", promoDiscount: "1.00" });
  });

  it("gives the use back when saving the payment fails after the code was recorded", async () => {
    const tx = await newTx();
    const spy = vi.spyOn(storage, "updateSendMoneyTransaction").mockRejectedValueOnce(new Error("disk full"));
    const r = await api("POST", `/api/send-money/transactions/${tx.id}/pay`, { paymentMethod: "card", promoCode: "SAVE5", promoDiscount: "1.00" });
    spy.mockRestore();
    expect(r.status).toBe(500);
    expect(calls.find((c) => c.path === "/api/promocodes/release")!.body).toEqual({ transaction_id: tx.reference, reason: "PAYMENT_FAILED" });
  });

  it("ignores promo fields when promo codes are switched off", async () => {
    process.env.PROMO_ENABLED = "false";
    const tx = await newTx();
    const r = await api("POST", `/api/send-money/transactions/${tx.id}/pay`, { paymentMethod: "card", promoCode: "SAVE5", promoDiscount: "1.00" });
    expect(r.body.data).toMatchObject({ promoCode: null, fee: "3.00" });
  });
});

describe("P-30 – P-35 activity reporting", () => {
  it("reports paid and completed, then cancelled transfers to Mito in order", async () => {
    const tx = await newTx();
    await api("POST", `/api/send-money/transactions/${tx.id}/pay`, { paymentMethod: "manual_transfer" });
    await api("POST", `/api/send-money/transactions/${tx.id}/cancel`, {});
    await flush();
    const events = calls.filter((c) => c.path === "/api/promocodes/transfer-events").map((c) => c.body);
    expect(events.map((e) => e.status)).toEqual(["CANCELLED"]);
    expect(events[0]).toMatchObject({ transfer_id: tx.reference, customer_id: "user_123", amount: 100, currency: "GBP", receive_currency: "NGN" });

    const tx2 = await newTx();
    await api("POST", `/api/send-money/transactions/${tx2.id}/pay`, { paymentMethod: "card" });
    await flush();
    const ev2 = calls.filter((c) => c.path === "/api/promocodes/transfer-events" && c.body.transfer_id === tx2.reference).map((c) => c.body.status);
    expect(ev2).toEqual(["PAID", "COMPLETED"]);
  });

  it("outbox retries with back-off, keeps order per key and drops permanent failures", async () => {
    const { createOutbox } = await import("../../../server/promo/outbox");
    const sent: string[] = [];
    let down = true;
    const box = createOutbox("test", async (item) => {
      const p = item.payload as { n: string };
      if (p.n === "bad") return { ok: false, status: 400, error: "invalid" };
      if (down) return { ok: false, status: 0, error: "ECONNREFUSED" };
      sent.push(p.n);
      return { ok: true, status: 200 };
    });
    box.enqueue("t", "k1", { n: "a" });
    box.enqueue("t", "k1", { n: "b" });
    box.enqueue("t", "k2", { n: "bad" });
    await flush();
    const pending = box.pending();
    expect(pending.map((i) => (i.payload as { n: string }).n)).toEqual(["a", "b"]); // bad dropped, b waits behind a
    expect(pending[0].attempts).toBe(1);
    expect(pending[0].nextAttemptAt - Date.now()).toBeGreaterThan(55_000); // 1 minute back-off

    down = false;
    await box.flush(Date.now()); // not due yet: nothing sent
    expect(sent).toEqual([]);
    await box.flush(Date.now() + 61_000);
    expect(sent).toEqual(["a", "b"]);
    expect(box.pending()).toHaveLength(0);
  });

  it("syncs the customer to Mito (debounced)", async () => {
    await promo.syncCustomer("user_123", { force: true });
    await promo.syncCustomer("user_123");
    await flush();
    const syncs = calls.filter((c) => c.path === "/api/promocodes/customers");
    expect(syncs).toHaveLength(1);
    expect(syncs[0].body).toMatchObject({ id: "user_123", account_status: "ACTIVE" });
  });
});

describe("P-12 savings", () => {
  it("lists redeemed promo savings for the session customer", async () => {
    const r = await api("GET", "/api/promocodes/savings");
    expect(r.status).toBe(200);
    expect(r.body.data.items).toEqual([{ id: "pr1", code: "SAVE5", amount: 5, currency: "GBP", transferId: "TXN-1", createdAt: "2026-10-01T10:00:00Z" }]);
    expect(r.body.data.saved).toEqual({ GBP: 5 });
  });
});
