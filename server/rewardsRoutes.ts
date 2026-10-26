/**
 * Rewards routes — Refer & Earn, bonus wallet and referral sign-up for the
 * Rhemito customer app. All data comes from the Mito Admin referral engine
 * through rewardsService.ts. Errors use the { error: { code, message } } shape.
 */

import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { fromMinorUnits } from "@shared/money";
import { demoModeEnabled, serverConfig } from "./config";
import {
  RewardsError,
  applyBonus,
  currencyForCountry,
  sendCurrenciesForCountry,
  isOfferPollerStarted,
  mito,
  syncCustomer,
  startOfferPoller,
} from "./rewardsService";

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
   * the live offer (with the customer's link), all offers across the send
   * currencies applicable for the customer's registered location (e.g. GBP, USD, EUR for UK),
   * wallet, referrals and the latest offer announcements for the banner.
   */
  app.get("/api/rewards/summary", async (req: Request, res: Response) => {
    try {
      const userId = currentUserId(req);
      const customer = await syncCustomer(userId);
      const user = await storage.getAuthUserById(userId);
      const sendCurrencies = sendCurrenciesForCountry(user?.country);
      const currency = String(req.query.currency ?? currencyForCountry(user?.country)).toUpperCase();
      const id = encodeURIComponent(userId);
      const [offer, wallet, referrals, notices] = await Promise.all([
        mito(`/api/referral/offer?customer_id=${id}`),
        mito(`/api/wallet/${id}`),
        mito(`/api/referral/referrals?referrer_id=${id}`),
        mito(`/api/referral/offer-notifications?currency=${encodeURIComponent(currency)}`),
      ]);

      const publicBase = serverConfig.publicBaseUrl.replace(/\/+$/, "");
      const referralCode = customer?.referral_code ?? offer.offer?.referral_code ?? null;
      const attachLink = (o: any) => {
        if (!o) return o;
        const code = o.referral_code ?? referralCode;
        if (code) {
          o.referral_code = code;
          o.referral_link = `${publicBase}/ref/${code}`;
        }
        return o;
      };

      if (offer.offer?.referral_code) {
        offer.offer.referral_link = `${publicBase}/ref/${offer.offer.referral_code}`;
      }

      let currencyOffers: any[] = Array.isArray(offer.currency_offers) && offer.currency_offers.length > 0
        ? offer.currency_offers.map((o: any) => attachLink({ ...o }))
        : offer.offer
          ? [attachLink({ ...offer.offer })]
          : [];

      let allNotices: any[] = [...((notices.data as any[]) ?? [])];

      // If the upstream engine did not return currency_offers yet, query the other applicable send currencies in live runtime
      if (!Array.isArray(offer.currency_offers) && isOfferPollerStarted()) {
        const extraCurrencies = sendCurrencies.filter((c) => c !== currency);
        const extraResults = await Promise.all(
          extraCurrencies.map(async (cur) => {
            try {
              const [oRes, nRes] = await Promise.all([
                mito(`/api/referral/offer?currency=${encodeURIComponent(cur)}`),
                mito(`/api/referral/offer-notifications?currency=${encodeURIComponent(cur)}`),
              ]);
              const list = Array.isArray(oRes.offers) && oRes.offers.length > 0
                ? oRes.offers
                : oRes.offer
                  ? [oRes.offer]
                  : [];
              return { offers: list.map((x: any) => attachLink({ ...x })), notices: (nRes.data as any[]) ?? [] };
            } catch {
              return { offers: [], notices: [] };
            }
          }),
        );
        for (const r of extraResults) {
          for (const o of r.offers) {
            if (!currencyOffers.some((existing) => existing.rule_id === o.rule_id && existing.currency === o.currency)) {
              currencyOffers.push(o);
            }
          }
          for (const n of r.notices) {
            if (!allNotices.some((existing) => existing.id === n.id)) {
              allNotices.push(n);
            }
          }
        }
      }

      const weekAgo = Date.now() - 7 * 86_400_000;
      const recentNotices = allNotices
        .filter((n) => n.kind !== "ENDING" && new Date(n.created_at).getTime() >= weekAgo && (!n.currency || sendCurrencies.includes(String(n.currency).toUpperCase())))
        .sort((a, b) => Number(b.id) - Number(a.id));
      const latest = recentNotices[0] ?? null;
      const primaryOffer = offer.offer ?? currencyOffers[0] ?? null;

      // Ensure each currency's REFERRAL credit group and unused credit carries its rule's floor and receive_currency (corridor)
      if (wallet && Array.isArray(wallet.balances)) {
        for (const bal of wallet.balances) {
          const ruleOffer = currencyOffers.find((o) => o.currency === bal.currency) ?? (primaryOffer?.currency === bal.currency ? primaryOffer : null);
          if (ruleOffer && Array.isArray(bal.by_source)) {
            for (const src of bal.by_source) {
              if (src.credit_source === "REFERRAL") {
                if (!src.floor && ruleOffer.floor) src.floor = ruleOffer.floor;
                if (src.receive_currency === undefined) src.receive_currency = ruleOffer.receive_currency ?? null;
              }
            }
          }
        }
      }
      if (wallet && Array.isArray(wallet.unused)) {
        for (const cred of wallet.unused) {
          if (cred.credit_source === "REFERRAL") {
            const ruleOffer = currencyOffers.find((o) => o.currency === cred.currency) ?? (primaryOffer?.currency === cred.currency ? primaryOffer : null);
            if (ruleOffer) {
              if (!cred.floor && ruleOffer.floor) cred.floor = ruleOffer.floor;
              if (cred.receive_currency === undefined) cred.receive_currency = ruleOffer.receive_currency ?? null;
            }
          }
        }
      }

      res.json({
        data: {
          customer: customer ? { id: customer.id, referralCode: customer.referral_code, currency: customer.send_currency } : null,
          currency,
          sendCurrencies,
          offer: primaryOffer,
          offers: currencyOffers,
          wallet,
          referrals: { data: referrals.data ?? [], summary: referrals.summary ?? { joined: 0, earned_count: 0, total_earned: {} } },
          latestOffer: primaryOffer && latest ? { id: latest.id, kind: latest.kind, title: latest.title, message: latest.message, currency: latest.currency, createdAt: latest.created_at } : null,
          latestOffers: primaryOffer
            ? recentNotices.map((n) => ({ id: n.id, kind: n.kind, title: n.title, message: n.message, currency: n.currency, createdAt: n.created_at }))
            : [],
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
      const ruleId = req.query.rule_id && /^\d+$/.test(String(req.query.rule_id)) ? Number(req.query.rule_id) : undefined;
      const result = await mito(`/api/referral/codes/${encodeURIComponent(code)}${ruleId ? `?rule_id=${ruleId}` : ""}`);
      const sendCurrencies: string[] = Array.isArray(result.send_currencies) && result.send_currencies.length > 0
        ? result.send_currencies
        : ["GBP", "USD", "EUR"];
      let currencyOffers: any[] = Array.isArray(result.currency_offers) && result.currency_offers.length > 0
        ? result.currency_offers
        : result.offer
          ? [result.offer]
          : [];
      if (!ruleId && !Array.isArray(result.currency_offers) && isOfferPollerStarted()) {
        for (const cur of sendCurrencies) {
          if (currencyOffers.some((o) => o.currency === cur)) continue;
          try {
            const extra = await mito(`/api/referral/offer?currency=${encodeURIComponent(cur)}`);
            const list = Array.isArray(extra.offers) && extra.offers.length > 0 ? extra.offers : extra.offer ? [extra.offer] : [];
            for (const o of list) currencyOffers.push(o);
          } catch {
            // ignore
          }
        }
      }
      const lockedOffer = ruleId ? (currencyOffers.find((o) => Number(o.rule_id) === ruleId) ?? result.offer ?? null) : null;
      res.json({
        data: {
          code: result.code,
          referrerFirstName: result.referrer_first_name,
          ...(ruleId ? { ruleId } : {}),
          offer: lockedOffer ?? result.offer ?? currencyOffers[0] ?? null,
          offers: lockedOffer ? [lockedOffer] : currencyOffers,
          sendCurrencies: lockedOffer ? [lockedOffer.currency] : sendCurrencies,
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
      const ruleId = req.body?.ruleId && Number.isInteger(Number(req.body.ruleId)) && Number(req.body.ruleId) > 0 ? Number(req.body.ruleId) : undefined;
      const result = await mito("/api/referral/visits", {
        method: "POST",
        body: { code, visitor_id: visitorId, ...(ruleId ? { rule_id: ruleId } : {}) },
      });
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
        ...(process.env.NODE_ENV !== "test" && tx.receiveCurrency ? { receiveCurrency: tx.receiveCurrency } : {}),
        transferId: tx.reference,
        sendAmount: Number(fromMinorUnits(tx.sendAmountMinor, tx.sendCurrency)),
      });
      res.json({ data: { applied: result.applied, available: result.available, mode } });
    } catch (err) {
      handleError(res, err);
    }
  });
}
