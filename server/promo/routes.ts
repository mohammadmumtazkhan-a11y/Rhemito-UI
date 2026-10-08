/**
 * Promo endpoints for the browser (PROMO-RHEMITO §5.1). Paths and response fields are unchanged
 * from before; `error` stays a string so existing callers keep working.
 */

import type { Express, Request, Response } from "express";
import { demoModeEnabled } from "../config";
import { callMito, promoEnabled, redeemPromo, validatePromo } from "./client";
import { syncCustomer } from "./hooks";

const CODE_RE = /^[A-Z0-9-]{1,20}$/;

function sessionUser(req: Request): string | undefined {
  return req.session?.userId ?? (demoModeEnabled ? "user_123" : undefined);
}

// 20 validations per session per minute (P-10)
const attempts = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const list = (attempts.get(key) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  attempts.set(key, list);
  return list.length > 20;
}
export function __resetPromoRateLimit(): void { attempts.clear(); }

const num = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : Number(v));

export function registerPromoRoutes(app: Express): void {
  /** Whether the promo field should be shown (NFR-3 feature flag). */
  app.get("/api/promocodes/status", (_req: Request, res: Response) => {
    res.json({ data: { enabled: promoEnabled() } });
  });

  // P-10 validate while the transfer is being built. The customer comes from the session, never from the body.
  app.post("/api/promocodes/validate", async (req: Request, res: Response) => {
    try {
      if (!promoEnabled()) return res.status(404).json({ error: "Promo codes are not available.", code: "PROMO_DISABLED" });
      const code = String(req.body?.code ?? "").trim().toUpperCase();
      if (!code) return res.status(400).json({ error: "Please enter a promo code.", code: "VALIDATION" });
      if (!CODE_RE.test(code)) return res.status(400).json({ error: "Enter a valid promo code.", code: "VALIDATION" });
      const amount = num(req.body?.amount);
      const fee = num(req.body?.fee);
      if (amount === undefined || !(amount > 0) || (fee !== undefined && (Number.isNaN(fee) || fee < 0))) {
        return res.status(400).json({ error: "Enter the amount you're sending first.", code: "VALIDATION" });
      }
      const userId = sessionUser(req);
      if (rateLimited(userId ?? req.ip ?? "anon")) {
        return res.status(429).json({ error: "Too many attempts. Please wait a minute and try again.", code: "RATE_LIMITED" });
      }
      if (userId) void syncCustomer(userId).catch(() => {});
      const upper = (v: unknown) => (v ? String(v).trim().toUpperCase().slice(0, 3) : undefined);
      const result = await validatePromo({
        code,
        amount,
        fee,
        currency: upper(req.body?.currency),
        userId,
        sourceCurrency: upper(req.body?.sourceCurrency),
        destCurrency: upper(req.body?.destCurrency),
        // P-40: only when the customer has chosen one
        paymentMethod: req.body?.paymentMethod ? String(req.body.paymentMethod) : undefined,
      });
      if (!result.ok) return res.status(result.status >= 400 ? result.status : 400).json({ error: result.error, code: result.code });
      return res.json({
        valid: true,
        appliedDiscount: result.body.appliedDiscount,
        appliesTo: result.body.appliesTo ?? "fee",
        displayText: result.body.displayText,
        currency: result.body.currency ?? null,
      });
    } catch (error) {
      console.error("Promo validation error:", error);
      return res.status(500).json({ error: "Failed to validate promo code" });
    }
  });

  // P-11 kept for the test checkout pages (deprecated): redeem outside the Send Money wizard
  app.post("/api/promocodes/apply", async (req: Request, res: Response) => {
    try {
      const { code, transactionId, amount, fee, currency } = req.body ?? {};
      if (!transactionId) return res.status(400).json({ error: "transactionId is required" });
      const result = await redeemPromo({
        code: String(code ?? ""),
        transactionId: String(transactionId),
        userId: sessionUser(req),
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        fee: fee !== undefined ? parseFloat(fee) : undefined,
        currency,
      });
      if (!result.ok) return res.status(result.status >= 400 ? result.status : 400).json({ error: result.error });
      return res.json({ success: true, message: "Promo code applied successfully" });
    } catch (error) {
      console.error("Promo application error:", error);
      return res.status(500).json({ error: "Failed to apply promo code" });
    }
  });

  // P-12 what the customer saved with promo codes (Bonus & Discounts)
  app.get("/api/promocodes/savings", async (req: Request, res: Response) => {
    const userId = sessionUser(req);
    if (!userId) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." } });
    const result = await callMito(`/api/promocodes/customers/${encodeURIComponent(userId)}/redemptions`, { method: "GET" });
    if (!result.ok) {
      return res.status(result.status === 404 ? 404 : 503).json({ error: { code: result.status === 404 ? "NOT_FOUND" : "PROMO_UNAVAILABLE", message: result.error } });
    }
    const currency = req.query.currency ? String(req.query.currency).toUpperCase() : null;
    const items = ((result.body.data as any[]) ?? [])
      .filter((r) => r.status === "Redeemed" && (!currency || (r.currency ?? currency) === currency))
      .map((r) => ({ id: r.id, code: r.code, amount: Number(r.discount ?? 0), currency: r.currency ?? null, transferId: r.transaction_id, createdAt: r.created_at }));
    return res.json({ data: { items, saved: result.body.summary?.saved ?? {} } });
  });
}
