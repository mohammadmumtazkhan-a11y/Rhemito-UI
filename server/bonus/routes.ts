/**
 * Bonus endpoints for the browser (BONUS-RHEMITO §5.5, B-50 / B-51). The customer always comes from the session.
 * Errors use { error: { code, message } } like the other customer routes.
 */

import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { demoModeEnabled } from "../config";
import { bonusEnabled, getOffers, getWallet, BONUS_UNAVAILABLE } from "./client";
import { currencyForCountry, syncCustomer } from "./hooks";

const SOURCES = ["REFERRAL", "SCHEME", "MANUAL"];
const CURRENCY_RE = /^[A-Za-z]{3}$/;

function sessionUser(req: Request): string | undefined {
  return req.session?.userId ?? (demoModeEnabled ? "user_123" : undefined);
}

function fail(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

async function homeCurrency(userId: string): Promise<string> {
  const user = await storage.getAuthUserById(userId);
  return currencyForCountry(user?.country);
}

export function registerBonusRoutes(app: Express): void {
  /** Everything Bonus & Discounts and the Dashboard need in one call (B-50). `source` filters the lists, never the totals. */
  app.get("/api/bonus/summary", async (req: Request, res: Response) => {
    const userId = sessionUser(req);
    if (!userId) return fail(res, 401, "UNAUTHENTICATED", "Please sign in to continue.");
    if (!bonusEnabled()) return fail(res, 404, "BONUS_DISABLED", "Bonus credit is not available.");
    const asked = req.query.currency ? String(req.query.currency) : "";
    if (asked && !CURRENCY_RE.test(asked)) return fail(res, 400, "VALIDATION", "Choose a valid currency.");
    const source = req.query.source ? String(req.query.source).toUpperCase() : "";
    if (source && !SOURCES.includes(source)) return fail(res, 400, "VALIDATION", "Choose a valid source.");
    try {
      void syncCustomer(userId).catch(() => {});
      const home = await homeCurrency(userId);
      const currency = (asked || home).toUpperCase();
      const [wallet, all, offers] = await Promise.all([
        getWallet(userId, currency, source || undefined),
        source || asked ? getWallet(userId) : Promise.resolve(null),
        getOffers(currency),
      ]);
      if (!wallet.ok) return fail(res, wallet.status >= 500 || wallet.status === 0 ? 503 : wallet.status, wallet.code ?? "BONUS_UNAVAILABLE", wallet.status === 503 ? BONUS_UNAVAILABLE : wallet.error ?? BONUS_UNAVAILABLE);
      const balances = ((all?.ok ? all.body : wallet.body).balances as Array<{ currency: string; available?: number; earned?: number }>) ?? [];
      const currencies = Array.from(new Set([home, ...balances.filter((b) => Number(b.earned ?? 0) > 0 || Number(b.available ?? 0) > 0).map((b) => b.currency)]));
      if (!currencies.includes(currency)) currencies.push(currency);
      return res.json({
        data: {
          currency,
          currencies,
          wallet: wallet.body,
          blocked: Boolean(wallet.body.bonus_blocked),
          offers: offers.ok ? (Array.isArray(offers.body) ? offers.body : offers.body.data ?? []) : [],
        },
      });
    } catch (err) {
      console.error("[bonus] summary failed:", err);
      return fail(res, 500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
    }
  });

  /** Light wallet call for Send Money (B-51). */
  app.get("/api/bonus/wallet", async (req: Request, res: Response) => {
    const userId = sessionUser(req);
    if (!userId) return fail(res, 401, "UNAUTHENTICATED", "Please sign in to continue.");
    if (!bonusEnabled()) return fail(res, 404, "BONUS_DISABLED", "Bonus credit is not available.");
    const asked = req.query.currency ? String(req.query.currency) : "";
    if (asked && !CURRENCY_RE.test(asked)) return fail(res, 400, "VALIDATION", "Choose a valid currency.");
    const result = await getWallet(userId, asked ? asked.toUpperCase() : undefined);
    if (!result.ok) return fail(res, result.status >= 500 ? 503 : result.status, result.code ?? "BONUS_UNAVAILABLE", result.status >= 500 ? BONUS_UNAVAILABLE : result.error ?? BONUS_UNAVAILABLE);
    return res.json({ data: result.body });
  });
}
