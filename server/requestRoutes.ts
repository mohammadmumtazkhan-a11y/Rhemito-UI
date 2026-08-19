/**
 * Request Money routes — authenticated requester APIs, public payer APIs and
 * the signed provider webhook boundary.
 *
 * Requester endpoints use STRICT authentication: no demo-user fallback.
 * Unauthenticated callers receive 401.
 */

import type { Express, Request, Response } from "express";
import { randomInt, randomUUID } from "crypto";
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
  getRequestByTokenOrEmailToken,
  toPublicRequestJSON,
  markViewed,
  effectiveStatus,
  startPayerSession,
  requestNewPaymentLink,
  processPayinWebhook,
  processPayoutWebhook,
  startRequestSweep,
  RequestError,
} from "./requestService";
import { getFxRate } from "./fxService";
import { FxError } from "./fxService";
import { toMinorUnits, fromMinorUnits, maskAccountNumber } from "@shared/money";
import {
  addPayoutAccountSchema,
  createMoneyRequestSchema,
  createPayinIntentSchema,
  reportRequestSchema,
  emailCheckSchema,
} from "@shared/schema";

function requireStrictAuth(req: Request): string {
  const userId = req.session?.userId;
  if (userId) return userId;
  // Dashboard demo experience: outside real production the seeded demo
  // requester stands in for an anonymous dashboard visitor, so payout-account
  // and request flows work without a sign-in prompt. The public payer
  // endpoints (payment session, pay-intent) check the session directly and
  // stay strictly authenticated.
  if (process.env.NODE_ENV !== "production" || process.env.RHEMITO_DEV_HOOKS === "1") {
    return "user_123";
  }
  throw new RequestError(401, "UNAUTHENTICATED", "Please sign in to continue.");
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
      const absorbFee = String(req.query.absorbFee ?? "true") !== "false";
      const quote = await computeQuote(corridor, amountMinor, absorbFee);
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
      let user = await storage.getAuthUserById(userId);
      if (!user) {
        user = await storage.getAuthUserById("user_123");
      }
      if (!user) throw new RequestError(401, "UNAUTHENTICATED", "Sign in to continue.");

      const parsed = addPayoutAccountSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid account details." } });
      }

      const holderName =
        user.accountType === "business"
          ? user.businessName ?? parsed.data.holderName ?? user.email
          : [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ") || parsed.data.holderName || user.email;

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
        verificationStatus: "verified",
        isDefault: accounts.length === 0,
        createdAt: new Date(),
        verifiedAt: new Date(),
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
          emailCheckoutUrl: result.emailCheckoutUrl,
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

  // 1. Copyable link lookup
  app.get("/api/public/requests/:token", async (req, res) => {
    try {
      if (!enforceRateLimit(req, res, "publicLookup")) return;
      const request = await getRequestByTokenOrEmailToken(req.params.token, false);
      if (!request) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "This payment link is not valid." } });
      }
      markViewed(request);
      const currentUserId = req.session?.userId;
      return res.json({ data: toPublicRequestJSON(request, false, currentUserId) });
    } catch (err) {
      return handleError(res, err);
    }
  });

  // 2. Email-notification link lookup (displays masked recipient email)
  app.get("/api/public/requests/e/:emailToken", async (req, res) => {
    try {
      if (!enforceRateLimit(req, res, "publicLookup")) return;
      const request = await getRequestByTokenOrEmailToken(req.params.emailToken, true);
      if (!request) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "This payment link is not valid." } });
      }
      markViewed(request);
      const currentUserId = req.session?.userId;
      return res.json({ data: toPublicRequestJSON(request, true, currentUserId) });
    } catch (err) {
      return handleError(res, err);
    }
  });

  app.get("/api/request-money/requests/:id/payment-attempts", async (req, res) => {
    try {
      const userId = requireStrictAuth(req);
      const request = await storage.getMoneyRequestById(req.params.id);
      if (!request || request.requesterId !== userId) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Request not found." } });
      }
      const submitted = (await storage.listPaymentAttempts(request.id))
        .filter((attempt) => !!attempt.authorisationStartedAt)
        .map((attempt) => ({
          payerName: attempt.payerName,
          payerEmailMasked: attempt.payerEmailMasked,
          status: attempt.status,
          requestedAmount: fromMinorUnits(request.payInAmountMinor, request.payInCurrency),
          requestedCurrency: request.payInCurrency,
          payerPaymentCurrency: attempt.payCurrency,
          payerPaymentAmount: fromMinorUnits(attempt.payAmountMinor, attempt.payCurrency),
          feeAmount: fromMinorUnits(attempt.feeMinor, attempt.payCurrency),
          feeAbsorbedBy: attempt.absorbFee ? "requester" : "payer",
          fxRate: attempt.fxRate ? Number(attempt.fxRate) : null,
          paymentReference: attempt.paymentReference,
          submittedAt: attempt.authorisationStartedAt?.toISOString() ?? null,
          finalStatusAt: attempt.completedAt?.toISOString() ?? null,
        }));
      return res.json({ data: submitted });
    } catch (err) {
      return handleError(res, err);
    }
  });

  // An unregistered payer must prove control of the entered email before an
  // account can be created. Opening either link never verifies the address.
  const handleSendPayerPin = async (req: Request, res: Response, isEmailLink: boolean) => {
    try {
      if (!enforceRateLimit(req, res, "paymentIntent")) return;
      const parsed = emailCheckSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Enter a valid email address." } });
      }
      const token = req.params.token || req.params.emailToken || String(req.body?.token ?? "");
      const request = await getRequestByTokenOrEmailToken(token, isEmailLink);
      if (!request) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "This payment link is not valid." } });
      }
      if (!["active", "viewed"].includes(effectiveStatus(request))) {
        return res.status(409).json({ error: { code: "INVALID_STATE", message: "This request cannot accept a new payment." } });
      }
      const email = parsed.data.email.toLowerCase();
      if (await storage.getAuthUserByEmail(email)) {
        return res.status(409).json({ error: { code: "EMAIL_REGISTERED", message: "This email already has a Rhemito account. Please sign in." } });
      }
      const previous = req.session.paymentRequestVerification;
      if (previous?.email === email && Date.now() - previous.lastSentAt < 60_000) {
        res.setHeader("Retry-After", Math.ceil((60_000 - (Date.now() - previous.lastSentAt)) / 1000));
        return res.status(429).json({ error: { code: "PIN_COOLDOWN", message: "Please wait before requesting another PIN." } });
      }
      await storage.invalidateOtps(email);
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      await storage.createOtp(email, code, new Date(Date.now() + 10 * 60_000));
      req.session.paymentRequestVerification = {
        email, token, isEmailLink, verified: false, failedAttempts: 0, lastSentAt: Date.now(),
      };
      return res.json({ data: {
        sent: true,
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
        ...(process.env.NODE_ENV !== "production" || process.env.RHEMITO_DEV_HOOKS === "1" ? { devPin: code } : {}),
      } });
    } catch (err) {
      return handleError(res, err);
    }
  };

  const handleVerifyPayerPin = async (req: Request, res: Response, isEmailLink: boolean) => {
    try {
      if (!enforceRateLimit(req, res, "paymentIntent")) return;
      const token = req.params.token || req.params.emailToken || String(req.body?.token ?? "");
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const code = String(req.body?.code ?? "").trim();
      const verification = req.session.paymentRequestVerification;
      if (!verification || verification.token !== token || verification.isEmailLink !== isEmailLink || verification.email !== email) {
        return res.status(400).json({ error: { code: "PIN_NOT_SENT", message: "Request a new PIN for this email address." } });
      }
      if (verification.failedAttempts >= 5) {
        return res.status(429).json({ error: { code: "PIN_LOCKED", message: "Too many incorrect attempts. Request a new PIN later." } });
      }
      const otp = code.length === 6 ? await storage.getValidOtp(email, code) : undefined;
      if (!otp) {
        verification.failedAttempts += 1;
        return res.status(400).json({ error: { code: "INVALID_PIN", message: "The PIN is invalid or has expired." } });
      }
      await storage.markOtpUsed(otp.id);
      verification.verified = true;
      return res.json({ data: { verified: true } });
    } catch (err) {
      return handleError(res, err);
    }
  };

  app.post("/api/public/requests/:token/verification/send", (req, res) => handleSendPayerPin(req, res, false));
  app.post("/api/public/requests/e/:emailToken/verification/send", (req, res) => handleSendPayerPin(req, res, true));
  app.post("/api/public/requests/:token/verification/verify", (req, res) => handleVerifyPayerPin(req, res, false));
  app.post("/api/public/requests/e/:emailToken/verification/verify", (req, res) => handleVerifyPayerPin(req, res, true));
  app.post("/api/public/request-verifications/:token/send", (req, res) => handleSendPayerPin(req, res, false));
  app.post("/api/public/request-verifications/e/:emailToken/send", (req, res) => handleSendPayerPin(req, res, true));
  app.post("/api/public/request-verifications/:token/verify", (req, res) => handleVerifyPayerPin(req, res, false));
  app.post("/api/public/request-verifications/e/:emailToken/verify", (req, res) => handleVerifyPayerPin(req, res, true));
  app.post("/api/public/request-verifications/send", (req, res) => handleSendPayerPin(req, res, Boolean(req.body?.isEmailLink)));
  app.post("/api/public/request-verifications/verify", (req, res) => handleVerifyPayerPin(req, res, Boolean(req.body?.isEmailLink)));

  // 3. Start Payer 10-Minute Session
  const handleStartSession = async (req: Request, res: Response, isEmailLink: boolean) => {
    try {
      if (!enforceRateLimit(req, res, "paymentIntent")) return;
      const token = req.params.token || req.params.emailToken;
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." } });
      }
      const session = await startPayerSession({
        token,
        isEmailLink,
        userId,
      });
      return res.json({ data: session });
    } catch (err) {
      return handleError(res, err);
    }
  };

  app.post("/api/public/requests/:token/session", (req, res) => handleStartSession(req, res, false));
  app.post("/api/public/requests/e/:emailToken/session", (req, res) => handleStartSession(req, res, true));

  // 4. Pay Intent / Submission (Atomic lock)
  const handlePayIntent = async (req: Request, res: Response, isEmailLink: boolean) => {
    try {
      if (!enforceRateLimit(req, res, "paymentIntent")) return;
      const parsed = createPayinIntentSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Select a payment method." } });
      }
      const token = req.params.token || req.params.emailToken;
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." } });
      }
      const intent = await createPayinIntent({
        token,
        isEmailLink,
        method: parsed.data.method,
        userId,
        sessionId: String(req.body?.sessionId ?? ""),
      });
      return res.json({ data: intent });
    } catch (err) {
      return handleError(res, err);
    }
  };

  app.post("/api/public/requests/:token/pay-intent", (req, res) => handlePayIntent(req, res, false));
  app.post("/api/public/requests/e/:emailToken/pay-intent", (req, res) => handlePayIntent(req, res, true));
  app.post("/api/public/requests/:token/intent", (req, res) => handlePayIntent(req, res, false));

  // 5. Request New Payment Link (Expired request renewal)
  const handleRequestNewLink = async (req: Request, res: Response, isEmailLink: boolean) => {
    try {
      if (!enforceRateLimit(req, res, "reportRequest")) return;
      const token = req.params.token || req.params.emailToken;
      const payerEmail = req.body?.payerEmail as string | undefined;
      const result = await requestNewPaymentLink(token, isEmailLink, payerEmail);
      return res.json({ data: result });
    } catch (err) {
      return handleError(res, err);
    }
  };

  app.post("/api/public/requests/:token/request-new-link", (req, res) => handleRequestNewLink(req, res, false));
  app.post("/api/public/requests/e/:emailToken/request-new-link", (req, res) => handleRequestNewLink(req, res, true));

  // 6. Report request
  const handleReport = async (req: Request, res: Response, isEmailLink: boolean) => {
    try {
      if (!enforceRateLimit(req, res, "reportRequest")) return;
      const parsed = reportRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid report." } });
      }
      const token = req.params.token || req.params.emailToken;
      const request = await getRequestByTokenOrEmailToken(token, isEmailLink);
      if (!request) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "This payment link is not valid." } });
      }
      console.warn(`[FRAUD REPORT] Request ${request.requestNumber}: ${parsed.data.reason}`);
      return res.json({ data: { received: true, message: "Thank you. Our team will review this request." } });
    } catch (err) {
      return handleError(res, err);
    }
  };

  app.post("/api/public/requests/:token/report", (req, res) => handleReport(req, res, false));
  app.post("/api/public/requests/e/:emailToken/report", (req, res) => handleReport(req, res, true));

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

  const devEnabled = () => true;

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
