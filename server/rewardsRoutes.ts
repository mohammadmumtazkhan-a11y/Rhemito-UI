/**
 * Rewards routes — Refer & Earn, bonus wallet and referral sign-up for the
 * Rhemito customer app. All data comes from the Mito Admin referral engine
 * through rewardsService.ts. Errors use the { error: { code, message } } shape.
 */

import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { fromMinorUnits } from "@shared/money";
import { demoModeEnabled, serverConfig } from "./config";
import { RewardsError, applyBonus, currencyForCountry, mito, syncCustomer, startOfferPoller } from "./rewardsService";

function currentUserId(req: Request): string {
  const userId = req.session?.userId;
  if (userId) return userId;
  // Same prototype policy as Send Money: the seeded demo user stands in for an
  // anonymous dashboard visitor in demo mode.
  if (demoModeEnabled) return "user_123";
  throw new RewardsError(401, "UNAUTHENTICATED", "Please sign in to continue.");
}

function handleError(res: Response, err: unknown): void {
  if (err instanceof RewardsError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error("[rewardsRoutes] unexpected error:", err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
}

export function registerRewardsRoutes(app: Express): void {
  startOfferPoller();

  /**
   * Everything the Dashboard and Bonus & Discounts page need in one call:
   * the live offer (with the customer's link), wallet, referrals and the
   * latest offer announcement for the banner.
   */
  app.get("/api/rewards/summary", async (req: Request, res: Response) => {
    try {
      const userId = currentUserId(req);
      const customer = await syncCustomer(userId);
      const user = await storage.getAuthUserById(userId);
      const currency = String(req.query.currency ?? currencyForCountry(user?.country)).toUpperCase();
      const id = encodeURIComponent(userId);
      const [offer, wallet, referrals, notices] = await Promise.all([
        mito(`/api/referral/offer?customer_id=${id}`),
        mito(`/api/wallet/${id}`),
        mito(`/api/referral/referrals?referrer_id=${id}`),
        mito(`/api/referral/offer-notifications?currency=${encodeURIComponent(currency)}`),
      ]);
      const weekAgo = Date.now() - 7 * 86_400_000;
      const latest = ((notices.data as any[]) ?? []).find((n) => n.kind !== "ENDING" && new Date(n.created_at).getTime() >= weekAgo) ?? null;
      // Links point at this Rhemito deployment so they work in every environment
      if (offer.offer?.referral_code) {
        offer.offer.referral_link = `${serverConfig.publicBaseUrl.replace(/\/+$/, "")}/ref/${offer.offer.referral_code}`;
      }
      res.json({
        data: {
          customer: customer ? { id: customer.id, referralCode: customer.referral_code, currency: customer.send_currency } : null,
          currency,
          offer: offer.offer ?? null,
          wallet,
          referrals: { data: referrals.data ?? [], summary: referrals.summary ?? { joined: 0, earned_count: 0, total_earned: {} } },
          latestOffer: offer.offer && latest ? { id: latest.id, kind: latest.kind, title: latest.title, message: latest.message, createdAt: latest.created_at } : null,
        },
      });
    } catch (err) {
      handleError(res, err);
    }
  });

  /** Validate a referral code from a link or the sign-up form (public). */
  app.get("/api/rewards/codes/:code", async (req: Request, res: Response) => {
    try {
      const code = String(req.params.code ?? "").trim().toUpperCase();
      const result = await mito(`/api/referral/codes/${encodeURIComponent(code)}`);
      res.json({
        data: {
          code: result.code,
          referrerFirstName: result.referrer_first_name,
          offer: result.offer,
          signedIn: Boolean(req.session?.userId),
        },
      });
    } catch (err) {
      if (err instanceof RewardsError && err.details) {
        res.status(err.status).json({ error: { code: err.code, message: String(err.details.message ?? err.message) } });
        return;
      }
      handleError(res, err);
    }
  });

  /** Count a referral link visit (public; repeat visits within 24h count once). */
  app.post("/api/rewards/visits", async (req: Request, res: Response) => {
    try {
      const code = String(req.body?.code ?? "").trim().toUpperCase();
      const visitorId = String(req.body?.visitorId ?? "anonymous").slice(0, 64);
      const result = await mito("/api/referral/visits", { method: "POST", body: { code, visitor_id: visitorId } });
      res.json({ data: { counted: Boolean(result.counted) } });
    } catch (err) {
      handleError(res, err);
    }
  });

  /** Use bonus credit on a Send Money transaction (Pay less / Send more). */
  app.post("/api/rewards/apply", async (req: Request, res: Response) => {
    try {
      const userId = currentUserId(req);
      const { transactionId, amount, mode } = req.body ?? {};
      if (!transactionId || !(Number(amount) > 0) || !["pay_less", "send_more"].includes(mode)) {
        throw new RewardsError(400, "VALIDATION_ERROR", "Choose how to use your bonus and try again.");
      }
      const tx = await storage.getSendMoneyTransactionById(String(transactionId));
      if (!tx || tx.ownerId !== userId) throw new RewardsError(404, "NOT_FOUND", "Transaction not found.");
      const result = await applyBonus(userId, {
        amount: Number(amount),
        currency: tx.sendCurrency,
        transferId: tx.reference,
        sendAmount: Number(fromMinorUnits(tx.sendAmountMinor, tx.sendCurrency)),
      });
      res.json({ data: { applied: result.applied, available: result.available, mode } });
    } catch (err) {
      handleError(res, err);
    }
  });
}
