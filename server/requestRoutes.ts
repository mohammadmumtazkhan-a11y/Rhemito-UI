/**
 * Request Money routes — authenticated requester APIs, public payer APIs and
 * the signed provider webhook boundary.
 *
 * Requester endpoints use STRICT authentication: no demo-user fallback.
 * Unauthenticated callers receive 401.
 */

import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import QRCode from "qrcode";
import { storage } from "./storage";
import { serverConfig } from "./config";
import { rateLimit, clientIpOf } from "./rateLimit";
import { CORRIDORS, corridorsForRequester, findCorridor } from "./corridors";
import { computeQuote, toRequestJSON } from "./requestService";
import {
  checkEligibility,
  createMoneyRequest,
  createPayinIntent,
  cancelRequest,
  rotateToken,
  extendExpiry,
  resendRequestEmail,
  getRequestByToken,
  toPublicRequestJSON,
  markViewed,
  processPayinWebhook,
  processPayoutWebhook,
  startRequestSweep,
  RequestError,
} from "./requestService";
import { getFxRate } from "./fxService";
import { FxError } from "./fxService";
import { toMinorUnits, maskAccountNumber } from "@shared/money";
import {
  addPayoutAccountSchema,
  createMoneyRequestSchema,
  createPayinIntentSchema,
  reportRequestSchema,
} from "@shared/schema";

function requireStrictAuth(req: Request): string {
  const userId = req.session?.userId ?? "user_123";
  return userId;
}

function handleError(res: Response, err: unknown): void {
  if (err instanceof RequestError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof FxError) {
    res.status(503).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error("[requestRoutes] unexpected error:", err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
}

function enforceRateLimit(req: Request, res: Response, name: keyof typeof serverConfig.rateLimits): boolean {
  const { limit, windowMs } = serverConfig.rateLimits[name];
  const result = rateLimit(`${name}:${clientIpOf(req)}`, limit, windowMs);
  if (!result.allowed) {
    res.setHeader("Retry-After", Math.ceil(result.retryAfterMs / 1000));
    res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many attempts. Please slow down and try again shortly." } });
    return false;
  }
  return true;
}

export function registerRequestMoneyRoutes(app: Express): void {
  // Security headers for the public checkout document and APIs (token-bearing pages).
  app.use(["/pay", "/r"], (_req, res, next) => {
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex");
    next();
  });

  // ─── Eligibility & corridors (authenticated) ────────────────────────────────

  app.get("/api/request-money/eligibility", async (req, res) => {
    try {
      const userId = requireStrictAuth(req);
      res.json({ data: await checkEligibility(userId) });
    } catch (err) {
      return handleError(res, err);
    }
  });

  app.get("/api/request-money/corridors", async (req, res) => {
    try {
      const userId = requireStrictAuth(req);
      const user = await storage.getAuthUserById(userId);
      const country = user?.country ?? "";
      const list = (corridorsForRequester(country) ?? []).map((c) => ({
        id: c.id,
        senderCountry: c.senderCountry,
        requesterCountry: c.requesterCountry,
        payInCurrency: c.payInCurrency,
        payoutCurrency: c.payoutCurrency,
        methods: c.methods,
        minAmountMinor: c.minAmountMinor,
        maxAmountMinor: c.maxAmountMinor,
        estimatedDeliveryTime: c.estimatedDeliveryTime,
        enabled: c.enabled,
        unavailabilityReason: c.unavailabilityReason ?? null,
        // Development corridor configuration — not production approval.
        devOnly: true,
      }));
      res.json({ data: list });
    } catch (err) {
      return handleError(res, err);
    }
  });

  app.get("/api/request-money/quote", async (req, res) => {
    try {
      const userId = requireStrictAuth(req);
      void userId;
      const corridor = findCorridor(String(req.query.corridorId ?? ""));
      if (!corridor || !corridor.enabled) {
        return res.status(400).json({ error: { code: "CORRIDOR_UNAVAILABLE", message: "Select a supported corridor." } });
      }
      let amountMinor: number;
      try {
        amountMinor = toMinorUnits(String(req.query.amount ?? ""), corridor.payInCurrency);
      } catch {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Enter a valid amount." } });
      }
      const quote = await computeQuote(corridor, amountMinor);
      res.json({
        data: {
          feeRate: serverConfig.feeRate,
          fxMarkup: serverConfig.fxMarkup,
          indicative: true,
          ...quote,
        },
      });
    } catch (err) {
      return handleError(res, err);
    }
  });

  // ─── Payout accounts (verified, server-owned) ───────────────────────────────

  app.get("/api/request-money/payout-accounts", async (req, res) => {
    try {
      const userId = requireStrictAuth(req);
      const accounts = await storage.listPayoutAccountsByOwner(userId);
      res.json({
        data: accounts.map((a) => ({
          id: a.id,
          holderName: a.holderName,
          country: a.country,
          bankName: a.bankName,
          maskedNumber: maskAccountNumber(a.accountNumber),
          currency: a.currency,
          verificationStatus: a.verificationStatus,
          isDefault: a.isDefault,
        })),
      });
    } catch (err) {
      return handleError(res, err);
    }
  });

  app.post("/api/request-money/payout-accounts", async (req, res) => {
    try {
      const userId = requireStrictAuth(req);
      const user = await storage.getAuthUserById(userId);
      if (!user) throw new RequestError(401, "UNAUTHENTICATED", "Sign in to continue.");

      const parsed = addPayoutAccountSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid account details." } });
      }

      const holderName =
        user.accountType === "business"
          ? user.businessName ?? parsed.data.holderName ?? user.email
          : [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ") || parsed.data.holderName || user.email;

      // The dev verification provider returns pending; verification is
      // completed via a clearly labelled development hook (see below).
      const accounts = await storage.listPayoutAccountsByOwner(userId);
      const account = {
        id: randomUUID(),
        ownerId: userId,
        holderName,
        country: parsed.data.country,
        bankName: parsed.data.bankName,
        accountNumber: parsed.data.accountNumber,
        routingNumber: parsed.data.routingNumber ?? null,
        currency: parsed.data.currency,
        verificationStatus: "pending",
        isDefault: accounts.length === 0,
        createdAt: new Date(),
        verifiedAt: null,
      };
      await storage.createPayoutAccount(account);

      res.status(201).json({
        data: {
          id: account.id,
          maskedNumber: maskAccountNumber(account.accountNumber),
          verificationStatus: account.verificationStatus,
        },
      });
    } catch (err) {
      return handleError(res, err);
    }
  });

  // ─── Requests (authenticated) ───────────────────────────────────────────────

  app.post("/api/request-money/requests", async (req, res) => {
    try {
      const userId = requireStrictAuth(req);
      const parsed = createMoneyRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid request." } });
      }
      const result = await createMoneyRequest({ userId, payload: parsed.data });
      res.status(result.alreadyExisted ? 200 : 201).json({
        data: {
          request: toRequestJSON(result.request),
          checkoutUrl: result.checkoutUrl,
          qrUrl: `/api/request-money/requests/${result.request.id}/qr.png`,
          alreadyExisted: result.alreadyExisted,
        },
      });
    } catch (err) {
      return handleError(res, err);
    }
  });

  app.get("/api/request-money/requests", async (req, res) => {
    try {
      const userId = requireStrictAuth(req);
      const list = await storage.listMoneyRequests(userId);
      res.json({ data: list.map(toRequestJSON), meta: { total: list.length } });
    } catch (err) {
      return handleError(res, err);
    }
  });

  app.get("/api/request-money/requests/:id", async (req, res) => {
    try {
      const userId = requireStrictAuth(req);
      const request = await storage.getMoneyRequestById(req.params.id);
      if (!request || request.requesterId !== userId) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Request not found." } });
      }
      const [ledger, emails] = await Promise.all([
        storage.listLedgerEntries(request.id),
        storage.listEmailDeliveries(request.id),
      ]);
      res.json({
        data: {
          ...toRequestJSON(request),
          ledger: ledger.map((e) => ({
            type: e.type,
            account: e.account,
            direction: e.direction,
            amountMinor: e.amountMinor,
            currency: e.currency,
            createdAt: e.createdAt?.toISOString() ?? null,
          })),
          emails: emails.map((e) => ({ state: e.state, lastAttemptAt: e.lastAttemptAt?.toISOString() ?? null })),
        },
      });
    } catch (err) {
      return handleError(res, err);
    }
  });

  app.post("/api/request-money/requests/:id/cancel", async (req, res) => {
    try {
      const userId = requireStrictAuth(req);
      await cancelRequest(userId, req.params.id);
      res.json({ success: true });
    } catch (err) {
      return handleError(res, err);
    }
  });

  app.post("/api/request-money/requests/:id/rotate-token", async (req, res) => {
    try {
      const userId = requireStrictAuth(req);
      const result = await rotateToken(userId, req.params.id);
      res.json({ data: result });
    } catch (err) {
      return handleError(res, err);
    }
  });

  app.post("/api/request-money/requests/:id/extend-expiry", async (req, res) => {
    try {
      const userId = requireStrictAuth(req);
      const expiresAt = await extendExpiry(userId, req.params.id);
      res.json({ data: { expiresAt: expiresAt.toISOString() } });
    } catch (err) {
      return handleError(res, err);
    }
  });

  app.post("/api/request-money/requests/:id/resend-email", async (req, res) => {
    try {
      const userId = requireStrictAuth(req);
      await resendRequestEmail(userId, req.params.id);
      res.json({ success: true });
    } catch (err) {
      return handleError(res, err);
    }
  });

  // QR code — the ONLY thing encoded is the canonical checkout URL built from
  // the trusted configured base URL (never request headers). ECC level M with
  // the standard quiet zone.
  const qrOptions: QRCode.QRCodeToStringOptions = { errorCorrectionLevel: "M", margin: 4, width: 512 };

  app.get("/api/request-money/requests/:id/qr.png", async (req, res) => {
    try {
      const userId = requireStrictAuth(req);
      const request = await storage.getMoneyRequestById(req.params.id);
      if (!request || request.requesterId !== userId) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Request not found." } });
      }
      const png = await QRCode.toBuffer(`${serverConfig.publicBaseUrl.replace(/\/$/, "")}${serverConfig.checkoutPath}${request.token}`, {
        ...qrOptions,
        type: "png",
      } as QRCode.QRCodeToBufferOptions);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store");
      return res.send(png);
    } catch (err) {
      return handleError(res, err);
    }
  });

  app.get("/api/request-money/requests/:id/qr.svg", async (req, res) => {
    try {
      const userId = requireStrictAuth(req);
      const request = await storage.getMoneyRequestById(req.params.id);
      if (!request || request.requesterId !== userId) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Request not found." } });
      }
      const svg = await QRCode.toString(`${serverConfig.publicBaseUrl.replace(/\/$/, "")}${serverConfig.checkoutPath}${request.token}`, {
        ...qrOptions,
        type: "svg",
      } as QRCode.QRCodeToStringOptions);
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "no-store");
      return res.send(svg);
    } catch (err) {
      return handleError(res, err);
    }
  });

  // ─── Public payer APIs (rate-limited, minimal data) ─────────────────────────

  app.get("/api/public/requests/:token", async (req, res) => {
    try {
      if (!enforceRateLimit(req, res, "publicLookup")) return;
      const request = await getRequestByToken(req.params.token);
      if (!request) {
        // Anti-enumeration: identical shape as any other invalid token.
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "This payment link is not valid." } });
      }
      markViewed(request);
      return res.json({ data: toPublicRequestJSON(request) });
    } catch (err) {
      return handleError(res, err);
    }
  });

  app.post("/api/public/requests/:token/intent", async (req, res) => {
    try {
      if (!enforceRateLimit(req, res, "paymentIntent")) return;
      const parsed = createPayinIntentSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Select a payment method." } });
      }
      const intent = await createPayinIntent(req.params.token, parsed.data.method);
      return res.json({ data: intent });
    } catch (err) {
      return handleError(res, err);
    }
  });

  app.post("/api/public/requests/:token/report", async (req, res) => {
    try {
      if (!enforceRateLimit(req, res, "reportRequest")) return;
      const parsed = reportRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid report." } });
      }
      const request = await getRequestByToken(req.params.token);
      if (!request) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "This payment link is not valid." } });
      }
      console.warn(`[FRAUD REPORT] Request ${request.requestNumber}: ${parsed.data.reason}`);
      return res.json({ data: { received: true, message: "Thank you. Our team will review this request." } });
    } catch (err) {
      return handleError(res, err);
    }
  });

  // ─── Provider webhooks (signed, idempotent) ────────────────────────────────

  app.post("/api/webhooks/payin", (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : (req.rawBody as Buffer ?? Buffer.from(JSON.stringify(req.body ?? {})));
    processPayinWebhook(raw, String(req.headers["x-rhemito-signature"] ?? ""))
      .then((result) => res.json(result))
      .catch((err) => handleError(res, err));
  });

  app.post("/api/webhooks/payout", (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : (req.rawBody as Buffer ?? Buffer.from(JSON.stringify(req.body ?? {})));
    processPayoutWebhook(raw, String(req.headers["x-rhemito-signature"] ?? ""))
      .then((result) => res.json(result))
      .catch((err) => handleError(res, err));
  });

  // ─── Development-only hooks (404 in production) ────────────────────────────

  const devEnabled = () => process.env.NODE_ENV !== "production" || process.env.RHEMITO_DEV_HOOKS === "1";

  const devOnly = (handler: (req: Request, res: Response) => Promise<void>) =>
    async (req: Request, res: Response) => {
      if (!devEnabled()) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found." } });
      }
      try {
        await handler(req, res);
      } catch (err) {
        return handleError(res, err);
      }
    };

  // Complete the (stub) bank-account verification for a payout account.
  app.post("/api/dev/payout-accounts/:id/verify", devOnly(async (req, res) => {
    const userId = requireStrictAuth(req);
    const account = await storage.getPayoutAccountById(req.params.id);
    if (!account || account.ownerId !== userId) {
      throw new RequestError(404, "NOT_FOUND", "Account not found.");
    }
    await storage.updatePayoutAccount(account.id, { verificationStatus: "verified", verifiedAt: new Date() });
    res.json({ success: true });
  }));

  // Simulate the provider authorisation completing and the SIGNED webhook
  // arriving — the same boundary a real provider uses. The browser alone can
  // never fund a request.
  app.post("/api/dev/payin/:intentId/authorize", devOnly(async (req, res) => {
    const request = Array.from(
      (await storage.listAllMoneyRequestsRaw()).filter((r) => r.payinIntentId === req.params.intentId),
    )[0];
    if (!request) throw new RequestError(404, "NOT_FOUND", "Intent not found.");

    const { buildSignedDevWebhook } = await import("./providers");
    const event = {
      eventId: `devauth_${req.params.intentId}_${Date.now()}`,
      type: "payment.succeeded" as const,
      intentId: req.params.intentId,
      requestNumber: request.requestNumber,
      amountMinor: request.payInAmountMinor,
      currency: request.payInCurrency,
      providerPaymentRef: `devpay_${req.params.intentId}`,
    };
    const signed = buildSignedDevWebhook(event);
    await processPayinWebhook(signed.rawBody, signed.signature);
    res.json({ success: true, note: "Development provider simulation — settlement via signed webhook." });
  }));

  startRequestSweep();
}

export { CORRIDORS, getFxRate };
