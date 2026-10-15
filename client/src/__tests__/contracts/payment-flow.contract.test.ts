/**
 * Payment-flow contracts (PAY-*): the order in which a Send Money payment checks and records promo and bonus,
 * how it undoes them on failure, which events go to Mito, and how the browser reports a failed payment.
 *
 * Runs the real Rhemito routes against a stub Mito service (see _mitoStub.ts).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, vi } from "vitest";
import { bootContractApp, flush, resetContractApp, routeBrowserFetchTo, type ContractApp } from "./_mitoStub";
import { countMatches, rule, source } from "./_contract";
import { receiptLines, paySendMoneyTransaction, SendMoneyApiError } from "@/lib/sendMoney";
import { statusForPaymentMethod, type SendMoneyTransactionView } from "@shared/sendMoney";
import { createOutbox } from "../../../../server/promo/outbox";

let ctx: ContractApp;
beforeAll(async () => { ctx = await bootContractApp(); });
afterAll(async () => { await ctx.close(); });
beforeEach(async () => { await resetContractApp(ctx); });
afterEach(() => { vi.restoreAllMocks(); });

const pay = (id: string, body: Record<string, unknown>) => ctx.api("POST", `/api/send-money/transactions/${id}/pay`, body);
const withPromo = { promoCode: "SAVE5", promoDiscount: "1.00" };
const withBonus = { bonusCredit: { mode: "pay_less", amount: "10.00" } };
const statusOf = async (id: string) => (await ctx.storage.getSendMoneyTransactionById(id))!.status;
const PAY_CODE = ["server/sendMoneyRoutes.ts", "server/promo/hooks.ts", "server/bonus/hooks.ts"];

describe("Payment flow ordering", () => {
  rule("PAY-01", "A payment is checked in the order: validate promo -> redeem promo -> apply bonus -> mark paid", {
    why: "Money must never be recorded as paid before Mito has confirmed the promo use and the bonus use. If the order changed, a customer could be marked paid with a promo or bonus that Mito later refuses, or have a promo/bonus used for a payment that never happened.",
    fix: "In POST /api/send-money/transactions/:id/pay keep this sequence: promo.applyForPayment (Mito validate, then Mito redeem) -> bonus.applyForPayment (Mito wallet apply) -> storage.updateSendMoneyTransaction (status/paidAt). Nothing may call storage.update... before both applyForPayment calls have returned.",
    where: PAY_CODE,
  }, async () => {
    const tx = await ctx.newTx();
    ctx.stub.onCall(async () => (await ctx.storage.getSendMoneyTransactionById(tx.id))!.status);
    const r = await pay(tx.id, { paymentMethod: "card", ...withPromo, ...withBonus });
    expect(r.status).toBe(200);
    const order = ctx.stub.calls
      .map((c) => c.path.split("?")[0])
      .filter((p) => ["/api/promocodes/validate", "/api/promocodes/redeem", "/api/wallet/user_123/apply"].includes(p));
    expect(order).toEqual(["/api/promocodes/validate", "/api/promocodes/redeem", "/api/wallet/user_123/apply"]);
    // while Mito was being asked, the transfer was still unpaid
    for (const p of order) expect(ctx.stub.to(p)[0].meta).toBe("awaiting_payment");
    expect(await statusOf(tx.id)).toBe("completed");
  });

  rule("PAY-02", "The pay request is validated against the stored transaction, not the browser's numbers", {
    why: "A tampered browser must not be able to claim a bigger discount or a different amount. Promo checks use the amount and fee saved when the transaction was created.",
    fix: "server/promo/hooks.ts applyForPayment builds the Mito request from `tx` (sendAmountMinor, feeMinor/feeBeforePromoMinor, currencies) and only takes the promo code and the discount the customer was shown from the request body.",
    where: ["server/promo/hooks.ts", "server/sendMoneyRoutes.ts"],
  }, async () => {
    const tx = await ctx.newTx();
    await pay(tx.id, { paymentMethod: "card", ...withPromo, amount: "1.00", sendAmount: "1.00", fee: "0.00" });
    const sent = ctx.stub.to("/api/promocodes/redeem")[0].body;
    expect(sent).toMatchObject({ code: "SAVE5", transactionId: tx.reference, amount: 100, fee: 3, currency: "GBP", paymentMethod: "card", userId: "user_123" });
  });
});

describe("Releasing promo and bonus when payment fails", () => {
  rule("PAY-03", "If the bonus is refused, the promo use already recorded is given back and the transfer stays unpaid", {
    why: "Promo codes have limited uses. Recording a use for a payment that did not happen would burn the customer's code and leave Mito's counts wrong.",
    fix: "In the pay route, wrap bonus.applyForPayment in try/catch and call promo.releaseForPayment(tx.reference) (Mito /api/promocodes/release, reason PAYMENT_FAILED) before rethrowing as the SendMoneyError. Status must remain awaiting_payment.",
    where: PAY_CODE,
  }, async () => {
    ctx.stub.on(/\/api\/wallet\/user_123\/apply/, { status: 409, body: { error: "BALANCE_CHANGED", message: "x" } });
    const tx = await ctx.newTx();
    const r = await pay(tx.id, { paymentMethod: "card", ...withPromo, ...withBonus });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("BONUS_CHANGED");
    expect(ctx.stub.to("/api/promocodes/release")[0].body).toEqual({ transaction_id: tx.reference, reason: "PAYMENT_FAILED" });
    expect(await statusOf(tx.id)).toBe("awaiting_payment");
    await flush();
    expect(ctx.stub.to("/api/bonus/transfer-events")).toHaveLength(0);
  });

  rule("PAY-04", "If recording the payment fails (error or nothing saved), both the promo use and the bonus use are given back", {
    why: "The promo and bonus were already used in Mito. If the transfer cannot be saved as paid, the customer must not lose them.",
    fix: "In the pay route, after storage.updateSendMoneyTransaction throws or returns undefined, call promo.releaseForPayment(tx.reference) AND bonus.releaseForPayment(userId, tx.reference) (only for the ones that were applied), then fail the request (500).",
    where: ["server/sendMoneyRoutes.ts"],
  }, async () => {
    const tx = await ctx.newTx();
    const spy = vi.spyOn(ctx.storage, "updateSendMoneyTransaction").mockRejectedValueOnce(new Error("disk full"));
    const r1 = await pay(tx.id, { paymentMethod: "card", ...withPromo, ...withBonus });
    expect(r1.status).toBe(500);
    expect(ctx.stub.to("/api/promocodes/release")).toHaveLength(1);
    expect(ctx.stub.to("/api/wallet/user_123/release")[0].body).toEqual({ transfer_id: tx.reference });

    ctx.stub.reset();
    spy.mockResolvedValueOnce(undefined);
    const r2 = await pay(tx.id, { paymentMethod: "card", ...withPromo, ...withBonus });
    expect(r2.status).toBe(500);
    expect(r2.body.error.code).toBe("INTERNAL_ERROR");
    expect(ctx.stub.to("/api/promocodes/release")).toHaveLength(1);
    expect(ctx.stub.to("/api/wallet/user_123/release")).toHaveLength(1);
    expect(await statusOf(tx.id)).toBe("awaiting_payment");
  });

  rule("PAY-05", "A rejected promo stops the payment before the bonus is touched and before anything is redeemed", {
    why: "The customer was shown a price that included the promo. If Mito no longer honours it the payment must stop so they can review the new price; nothing else may be consumed first.",
    fix: "promo.applyForPayment runs first and throws PromoPaymentError (409 PROMO_REJECTED / PROMO_CHANGED); the route converts it to a SendMoneyError and returns before calling bonus.applyForPayment or redeemPromo.",
    where: ["server/promo/hooks.ts", "server/sendMoneyRoutes.ts"],
  }, async () => {
    ctx.stub.on("/api/promocodes/validate", { status: 400, body: { error: "This promo code has reached its limit.", code: "FULLY_REDEEMED" } });
    const tx = await ctx.newTx();
    const r = await pay(tx.id, { paymentMethod: "card", ...withPromo, ...withBonus });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("PROMO_REJECTED");
    expect(ctx.stub.to("/api/promocodes/redeem")).toHaveLength(0);
    expect(ctx.stub.to("/api/wallet/user_123/apply")).toHaveLength(0);
    expect(await statusOf(tx.id)).toBe("awaiting_payment");
  });
});

describe("Status and events after payment", () => {
  rule("PAY-06", "Manual bank transfer leaves the transfer awaiting payment; every instant method completes it", {
    why: "A manual transfer is only paid when the customer's bank money arrives (30-minute window). Marking it completed would release the transfer without funds.",
    fix: "shared/sendMoney.ts statusForPaymentMethod: manual_transfer -> awaiting_payment (paidAt stays null); instant_bank, card and wallet -> completed with paidAt set. The pay route must use that function.",
    where: ["shared/sendMoney.ts", "server/sendMoneyRoutes.ts"],
  }, async () => {
    expect(statusForPaymentMethod("manual_transfer")).toBe("awaiting_payment");
    for (const m of ["instant_bank", "card", "wallet"] as const) expect(statusForPaymentMethod(m)).toBe("completed");

    const manual = await ctx.newTx();
    const rm = await pay(manual.id, { paymentMethod: "manual_transfer" });
    expect(rm.body.data).toMatchObject({ status: "awaiting_payment", paidAt: null, paymentMethod: "manual_transfer" });
    const instant = await ctx.newTx();
    const ri = await pay(instant.id, { paymentMethod: "instant_bank" });
    expect(ri.body.data.status).toBe("completed");
    expect(ri.body.data.paidAt).toEqual(expect.any(String));
  });

  rule("PAY-07", "PAID then COMPLETED transfer events go to Mito (bonus, promo, referral) only when the transfer is completed", {
    why: "Mito awards referral rewards, bonus schemes and promo accounting from these events. Sending them for a transfer that is still awaiting the customer's bank payment would reward money that has not arrived.",
    fix: "In the pay route, only inside `if (status === \"completed\")`: onTransferEvent(PAID) then (COMPLETED) for referral, and promo.onTransferStatus + bonus.onTransferStatus for PAID and COMPLETED, in that order. A manual transfer sends none.",
    where: ["server/sendMoneyRoutes.ts", "server/promo/hooks.ts", "server/bonus/hooks.ts", "server/rewardsService.ts"],
  }, async () => {
    const instant = await ctx.newTx();
    await pay(instant.id, { paymentMethod: "card" });
    await flush();
    const statuses = (p: string) => ctx.stub.to(p).filter((c) => c.body.transfer_id === instant.reference).map((c) => c.body.status);
    expect(statuses("/api/bonus/transfer-events")).toEqual(["PAID", "COMPLETED"]);
    expect(statuses("/api/promocodes/transfer-events")).toEqual(["PAID", "COMPLETED"]);
    expect(statuses("/api/referral/transfer-events")).toEqual(["PAID", "COMPLETED"]);

    ctx.stub.reset();
    const manual = await ctx.newTx();
    await pay(manual.id, { paymentMethod: "manual_transfer" });
    await flush();
    for (const p of ["/api/bonus/transfer-events", "/api/promocodes/transfer-events", "/api/referral/transfer-events"]) {
      expect(ctx.stub.to(p)).toHaveLength(0);
    }
  });

  rule("PAY-08", "Transfer events are queued in an outbox and can never block or fail the payment", {
    why: "Mito being slow or down must not stop a customer paying. Events are delivered in the background and retried later; the payment result never depends on them.",
    fix: "Promo and bonus events use createOutbox (server/promo/outbox.ts, server/bonus/outbox.ts) via onTransferStatus -> promoOutbox/bonusOutbox.enqueue (fire and forget). Referral events use `void onTransferEvent(...)` which never throws. Do not `await` Mito calls for events in the pay route.",
    where: ["server/sendMoneyRoutes.ts", "server/promo/hooks.ts", "server/bonus/hooks.ts", "server/promo/outbox.ts"],
  }, async () => {
    ctx.stub.on("/api/promocodes/transfer-events", { status: 503, body: { error: "down" } });
    ctx.stub.on("/api/bonus/transfer-events", { status: 503, body: { error: "down" } });
    ctx.stub.on("/api/referral/transfer-events", "drop");
    const tx = await ctx.newTx();
    const r = await pay(tx.id, { paymentMethod: "card" });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe("completed");
    await flush();
    // the undelivered events are waiting in the outbox for a retry, in order, keyed by transfer
    const promoPending = ctx.promo.promoOutbox.pending().filter((i) => i.key === `transfer:${tx.reference}`);
    const bonusPending = ctx.bonus.bonusOutbox.pending().filter((i) => i.key === `transfer:${tx.reference}`);
    expect(promoPending.map((i) => (i.payload as any).status)).toEqual(["PAID", "COMPLETED"]);
    expect(bonusPending.map((i) => (i.payload as any).status)).toEqual(["PAID", "COMPLETED"]);
    expect(promoPending[0].attempts).toBeGreaterThanOrEqual(1);
  });

  rule("PAY-09", "The outbox retries after 1, 5, 15 and 60 minutes, then hourly, gives up after 24 attempts and drops permanent 4xx errors", {
    why: "Events must eventually reach Mito after an outage without hammering it, and a request Mito will never accept must not block later events for the same transfer.",
    fix: "server/promo/outbox.ts and server/bonus/outbox.ts: BACKOFF_MIN = [1, 5, 15, 60] minutes (then 60), MAX_ATTEMPTS = 24, 4xx except 408/429 is dropped, items with the same key are sent in order.",
    where: ["server/promo/outbox.ts", "server/bonus/outbox.ts"],
  }, async () => {
    const bonusOutbox = (await import("../../../../server/bonus/outbox")).createOutbox;
    for (const make of [createOutbox, bonusOutbox]) {
      let mode: "fail" | "bad" = "fail";
      const box = make("t", async () => (mode === "bad" ? { ok: false, status: 400, error: "invalid" } : { ok: false, status: 503, error: "down" }));
      box.enqueue("t", "k", { n: 1 });
      await flush();
      const gaps: number[] = [];
      let now = Date.now();
      for (let i = 0; i < 5; i++) {
        const item = box.pending()[0];
        gaps.push(Math.round((item.nextAttemptAt - now) / 60_000));
        now = item.nextAttemptAt + 1;
        await box.flush(now);
      }
      // after attempt 1: ~1 min, then 5, 15, 60, 60
      expect(gaps[0]).toBeGreaterThanOrEqual(0);
      expect(gaps.slice(1)).toEqual([5, 15, 60, 60]);
      // keep failing until the 24th attempt: the item is dropped
      for (let i = 0; i < 40 && box.pending().length; i++) { now = box.pending()[0].nextAttemptAt + 1; await box.flush(now); }
      expect(box.pending()).toHaveLength(0);

      mode = "bad";
      box.enqueue("t", "k2", { n: 2 });
      await flush();
      expect(box.pending()).toHaveLength(0);
    }
  });

  rule("PAY-10", "Only a transfer awaiting payment can be paid, and only a transfer awaiting payment can be cancelled (which reports CANCELLED)", {
    why: "Paying a completed transfer twice would use the promo and bonus twice; cancelling a completed one would reverse money already sent. Cancelling is how a promo/bonus use is given back.",
    fix: "Pay route: 409 INVALID_STATE unless status is awaiting_payment. Cancel route: 409 unless awaiting_payment/pending; on cancel it sends CANCELLED to referral, promo and bonus (promo.onTransferStatus / bonus.onTransferStatus / onTransferEvent).",
    where: ["server/sendMoneyRoutes.ts"],
  }, async () => {
    const done = await ctx.newTx();
    await pay(done.id, { paymentMethod: "card", ...withPromo });
    await flush();
    ctx.stub.reset();
    const again = await pay(done.id, { paymentMethod: "card", ...withPromo });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("INVALID_STATE");
    expect(ctx.stub.to("/api/promocodes/redeem")).toHaveLength(0);
    expect((await ctx.api("POST", `/api/send-money/transactions/${done.id}/cancel`)).status).toBe(409);

    const open = await ctx.newTx();
    ctx.stub.reset();
    expect((await ctx.api("POST", `/api/send-money/transactions/${open.id}/cancel`)).status).toBe(200);
    await flush();
    for (const p of ["/api/bonus/transfer-events", "/api/promocodes/transfer-events", "/api/referral/transfer-events"]) {
      expect(ctx.stub.to(p).filter((c) => c.body.transfer_id === open.reference).map((c) => c.body.status)).toEqual(["CANCELLED"]);
    }
  });
});

describe("What the browser sends and how a failure is shown", () => {
  rule("PAY-11", "The browser sends promo and bonus with the payment in the agreed shape, and omits them when unused", {
    why: "The server re-checks and uses the promo and bonus at pay time. It can only do that if the code, the discount the customer was shown, and the bonus mode and amount travel with the pay request.",
    fix: "client/src/lib/sendMoney.ts paySendMoneyTransaction: body = { paymentMethod, bonusCredit?: { mode, amount: toFixed(2) } (only when amount > 0), promoCode?, promoDiscount?: toFixed(2) (only with a code) }.",
    where: ["client/src/lib/sendMoney.ts", "shared/sendMoney.ts"],
  }, async () => {
    const restore = routeBrowserFetchTo(ctx.base);
    try {
      const real = globalThis.fetch;
      const bodies: any[] = [];
      globalThis.fetch = ((u: any, init: any) => { if (String(u).endsWith("/pay")) bodies.push(JSON.parse(init.body)); return real(u, init); }) as typeof fetch;
      const tx = await ctx.newTx();
      const view = await paySendMoneyTransaction(tx.id, "card", { code: "SAVE5", discount: 1 }, { mode: "send_more", amount: 10 });
      expect(bodies[0]).toEqual({ paymentMethod: "card", bonusCredit: { mode: "send_more", amount: "10.00" }, promoCode: "SAVE5", promoDiscount: "1.00" });
      expect(view).toMatchObject({ status: "completed", bonusCredit: "10.00", bonusCreditMode: "send_more", promoCode: "SAVE5" });

      const plain = await ctx.newTx();
      await paySendMoneyTransaction(plain.id, "card", null, { mode: "pay_less", amount: 0 });
      expect(bodies[1]).toEqual({ paymentMethod: "card" });
    } finally {
      restore();
    }
  });

  rule("PAY-12", "A failed payment throws a SendMoneyApiError carrying the server's code and message (never swallowed)", {
    why: "The pages decide what to tell the customer from the error code (PROMO_*, BONUS_*) and message. If the helper swallowed the error the page would behave as if the payment succeeded.",
    fix: "paySendMoneyTransaction throws new SendMoneyApiError(status, error.code ?? 'PAY_FAILED', error.message ?? 'The payment could not be recorded. Please try again.') for any non-2xx response.",
    where: ["client/src/lib/sendMoney.ts"],
  }, async () => {
    const restore = routeBrowserFetchTo(ctx.base);
    try {
      ctx.stub.on("/api/promocodes/validate", { status: 400, body: { error: "This promo code has expired.", code: "EXPIRED" } });
      const tx = await ctx.newTx();
      const err = await paySendMoneyTransaction(tx.id, "card", { code: "OLD", discount: 1 }).catch((e) => e);
      expect(err).toBeInstanceOf(SendMoneyApiError);
      expect(err).toMatchObject({ status: 409, code: "PROMO_REJECTED" });
      expect(err.message).toBe("This promo code has expired. Go back and remove the promo code to continue.");

      const missing = await paySendMoneyTransaction("nope", "card").catch((e) => e);
      expect(missing).toBeInstanceOf(SendMoneyApiError);
      expect(missing.code).toBe("NOT_FOUND");
    } finally {
      restore();
    }
  });

  rule("PAY-13", "NEGATIVE (fixed bug): a payment that fails must show a destructive 'Payment not completed' toast, never fail silently", {
    why: "A payment once failed with no message at all and the customer did not know whether they had paid. Every failure path must tell the customer, and must not show the success screen.",
    fix: "client/src/pages/SendMoney.tsx: every call to paySendMoneyTransaction sits in a try/catch whose generic branch calls toast({ title: \"Payment not completed\", description, variant: \"destructive\" }) and resets the chosen method (setPaymentMethod(\"\")). There are two pay sites (payment method click and manual-transfer confirm); both need it. PROMO_* errors use the 'Payment not made' destructive toast, BONUS_* errors use bonusRefused().",
    where: ["client/src/pages/SendMoney.tsx"],
  }, () => {
    const page = source("client/src/pages/SendMoney.tsx");
    const paySites = countMatches(page, /await paySendMoneyTransaction\(/);
    expect(paySites).toBeGreaterThanOrEqual(2);
    expect(countMatches(page, /toast\(\{\s*title:\s*"Payment not completed",\s*description,\s*variant:\s*"destructive"\s*\}\)/)).toBe(paySites);
    expect(countMatches(page, /toast\(\{\s*title:\s*"Payment not made",\s*description:\s*e\.message,\s*variant:\s*"destructive"\s*\}\)/)).toBe(paySites);
    expect(countMatches(page, /e instanceof SendMoneyApiError && e\.code\.startsWith\("BONUS_"\)/)).toBe(paySites);
    expect(countMatches(page, /e instanceof SendMoneyApiError && e\.code\.startsWith\("PROMO_"\)/)).toBe(paySites);
    // the generic fallback text when the error is not a SendMoneyApiError
    expect(page).toContain("We couldn't complete your payment. Please try again.");
  });
});

describe("Receipt lines", () => {
  const base = {
    id: "t1", reference: "RH-1", recipientName: "Ada", service: "bank_deposit", paymentMethod: "card",
    sendCurrency: "GBP", sendAmount: "100.00", receiveCurrency: "NGN", receiveAmount: "200000.00",
    fee: "2.00", exchangeRate: "2000", promoCode: null, status: "completed",
    createdAt: "2026-10-01T10:00:00Z", paidAt: "2026-10-01T10:05:00Z", cancelledAt: null,
  } as unknown as SendMoneyTransactionView;

  rule("PAY-14", "Receipt lines are send / fee / promo / bonus / total / receive, in that order, and only show what applied", {
    why: "The receipt is the customer's proof of what they paid. The fee stored on the transfer is already after the promo, so the fee line must be shown before the discount, with the promo and bonus taken off visibly, otherwise the lines do not add up to the total.",
    fix: "client/src/lib/sendMoney.ts receiptLines: keys in order send, fee (stored fee + promo discount), promo (only if discount > 0), bonus_pay_less or bonus_send_more (only for that mode), total, receive.",
    where: ["client/src/lib/sendMoney.ts", "client/src/components/transactions/SendMoneyReceiptDialog.tsx"],
  }, () => {
    const keys = (v: SendMoneyTransactionView) => receiptLines(v).map((l) => l.key);
    expect(keys(base)).toEqual(["send", "fee", "total", "receive"]);
    const promo = { ...base, fee: "0.00", promoCode: "WELCOME", promoDiscount: "2.00" };
    expect(keys(promo)).toEqual(["send", "fee", "promo", "total", "receive"]);
    expect(receiptLines(promo).find((l) => l.key === "fee")!.value).toBe("GBP 2.00");
    expect(receiptLines(promo).find((l) => l.key === "promo")!.value).toBe("−GBP 2.00");
    const payLess = { ...promo, bonusCredit: "5.00", bonusCreditMode: "pay_less" as const };
    expect(keys(payLess)).toEqual(["send", "fee", "promo", "bonus_pay_less", "total", "receive"]);
    const sendMore = { ...base, bonusCredit: "5.00", bonusCreditMode: "send_more" as const };
    expect(keys(sendMore)).toEqual(["send", "fee", "bonus_send_more", "total", "receive"]);
    expect(receiptLines(sendMore).find((l) => l.key === "bonus_send_more")!.value).toBe("+GBP 5.00");
  });

  rule("PAY-15", "Total paid = send + fee - promo - pay-less bonus, never below 0; send-more bonus does not change the total", {
    why: "Pay-less bonus reduces what the customer pays. Send-more bonus is extra money for the recipient funded by the bonus, so the customer's total stays the same. A negative total would be a refund the customer never earned.",
    fix: "receiptLines total = max(0, send + fee - payLessBonus) where fee is the stored (post-promo) fee; send-more is ignored in the total.",
    where: ["client/src/lib/sendMoney.ts"],
  }, () => {
    const total = (v: SendMoneyTransactionView) => receiptLines(v).find((l) => l.key === "total")!.value;
    expect(total(base)).toBe("GBP 102.00");
    expect(total({ ...base, bonusCredit: "5.00", bonusCreditMode: "pay_less" } as any)).toBe("GBP 97.00");
    expect(total({ ...base, bonusCredit: "5.00", bonusCreditMode: "send_more" } as any)).toBe("GBP 102.00");
    expect(total({ ...base, fee: "0.00", promoCode: "X", promoDiscount: "2.00" } as any)).toBe("GBP 100.00");
    expect(total({ ...base, sendAmount: "3.00", fee: "0.00", promoCode: "X", promoDiscount: "2.00", bonusCredit: "9.00", bonusCreditMode: "pay_less" } as any)).toBe("GBP 0.00");
  });
});
