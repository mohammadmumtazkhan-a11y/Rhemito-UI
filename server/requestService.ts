/**
 * Request Service — unified Request Money lifecycle.
 *
 * Server-authoritative: eligibility, verified payout-account ownership,
 * corridor enforcement, secure token generation, provider intents, signed
 * webhook processing (the ONLY path that funds a request), payout submission,
 * cancellation/rotation/extension, expiry sweeps and email delivery via the
 * provider interface.
 *
 * The provider adapters are development stubs (see server/providers.ts). No
 * simulated behaviour here is presented as a real bank/email/KYC integration.
 */

import { randomUUID, randomBytes, createHash } from "crypto";
import { storage } from "./storage";
import { serverConfig, buildCheckoutUrl } from "./config";
import { getFxRate } from "./fxService";
import {
  devPayinProvider,
  devPayoutProvider,
  devEmailProvider,
  verifyWebhookSignature,
  signWebhookPayload,
  type PayinWebhookEvent,
} from "./providers";
import { postFundingEntries, postPayoutEntry } from "./walletService";
import { findCorridor, validateCorridor, type CorridorConfig } from "./corridors";
import {
  toMinorUnits,
  fromMinorUnits,
  feeMinorOf,
  applyFxMarkup,
  convertMinor,
  maskAccountNumber,
} from "@shared/money";
import {
  formatDocumentNumber,
  dateInTz,
  EXPIRY_TIMEZONE,
  formatHumanDate,
} from "@shared/invoice-logic";
import type {
  MoneyRequest,
  CreateMoneyRequestPayload,
  RequestStatus,
} from "@shared/schema";

export class RequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const PAYMENT_PENDING_TIMEOUT_MS = 10 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

// ─── Eligibility ──────────────────────────────────────────────────────────────

export interface EligibilityResult {
  authenticated: true;
  accountStatus: string;
  kycStatus: string;
  country: string;
  eligible: boolean;
  reasons: string[];
}

export async function checkEligibility(userId: string): Promise<EligibilityResult> {
  const user = await storage.getAuthUserById(userId);
  const reasons: string[] = [];

  if (!user) {
    throw new RequestError(401, "UNAUTHENTICATED", "Sign in to request money.");
  }

  const accountOk = user.status === "active";
  const kycOk = user.kycStatus === "passed";

  if (!accountOk) reasons.push(`Your Rhemito account is ${user.status}.`);
  if (!kycOk) reasons.push("You must complete mini-KYC before requesting money.");

  const accounts = await storage.listPayoutAccountsByOwner(userId);
  const hasVerified = accounts.some((a) => a.verificationStatus === "verified");
  if (!hasVerified) reasons.push("Add and verify a payout bank account to receive requests.");

  return {
    authenticated: true,
    accountStatus: user.status,
    kycStatus: user.kycStatus,
    country: user.country,
    eligible: accountOk && kycOk && hasVerified,
    reasons,
  };
}

// ─── Creation ─────────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function displayNameOf(userId: string): Promise<string> {
  const user = await storage.getAuthUserById(userId);
  if (!user) throw new RequestError(401, "UNAUTHENTICATED", "Sign in to request money.");
  const name =
    user.accountType === "business"
      ? user.businessName
      : [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ");
  return name || user.email;
}

export interface QuoteSnapshot {
  feeMinor: number;
  payoutAmountMinor: number | null;
  fxRate: number | null;
  fxRateIsIndicative: boolean;
  fxMarkupApplied: number;
}

/** Fee + indicative FX quote. Never silently 1:1 — getFxRate throws on unknown pairs. */
export async function computeQuote(
  corridor: CorridorConfig,
  payInAmountMinor: number,
): Promise<QuoteSnapshot> {
  const feeMinor = feeMinorOf(payInAmountMinor, serverConfig.feeRate);
  const netMinor = payInAmountMinor - feeMinor;

  if (corridor.payInCurrency === corridor.payoutCurrency) {
    return { feeMinor, payoutAmountMinor: netMinor, fxRate: null, fxRateIsIndicative: true, fxMarkupApplied: 0 };
  }

  const midRate = await getFxRate(corridor.payInCurrency, corridor.payoutCurrency);
  const customerRate = applyFxMarkup(midRate, serverConfig.fxMarkup);
  return {
    feeMinor,
    payoutAmountMinor: convertMinor(netMinor, customerRate),
    fxRate: customerRate,
    fxRateIsIndicative: true,
    fxMarkupApplied: serverConfig.fxMarkup,
  };
}

export async function createMoneyRequest(params: {
  userId: string;
  payload: CreateMoneyRequestPayload;
}): Promise<{ request: MoneyRequest; token: string; checkoutUrl: string; alreadyExisted: boolean }> {
  const { userId, payload } = params;

  // Idempotent submissions return the original request.
  const existing = await storage.getMoneyRequestByIdempotencyKey(userId, payload.idempotencyKey);
  if (existing) {
    return { request: existing, token: existing.token, checkoutUrl: buildCheckoutUrl(existing.token), alreadyExisted: true };
  }

  const eligibility = await checkEligibility(userId);
  if (!eligibility.eligible) {
    throw new RequestError(403, "NOT_ELIGIBLE", eligibility.reasons[0] ?? "You cannot create requests yet.");
  }

  const corridor = findCorridor(payload.corridorId);
  if (!corridor) {
    throw new RequestError(400, "CORRIDOR_NOT_FOUND", "Select a supported corridor.");
  }

  const user = (await storage.getAuthUserById(userId))!;
  const account = await storage.getPayoutAccountById(payload.payoutAccountId);
  if (!account || account.ownerId !== userId) {
    throw new RequestError(403, "ACCOUNT_NOT_OWNED", "Select one of your own payout accounts.");
  }
  if (account.verificationStatus !== "verified") {
    throw new RequestError(403, "ACCOUNT_NOT_VERIFIED", "Select a verified payout account.");
  }

  let payInAmountMinor: number;
  try {
    payInAmountMinor = toMinorUnits(payload.payInAmount, corridor.payInCurrency);
  } catch {
    throw new RequestError(400, "VALIDATION_ERROR", "Enter a valid amount.");
  }

  const corridorCheck = validateCorridor({
    corridor,
    requesterCountry: user.country,
    payoutAccountCountry: account.country,
    payoutAccountCurrency: account.currency,
    amountMinor: payInAmountMinor,
  });
  if (!corridorCheck.ok) {
    throw new RequestError(400, "CORRIDOR_UNAVAILABLE", corridorCheck.reason ?? "Corridor unavailable.");
  }

  const quote = await computeQuote(corridor, payInAmountMinor);
  const now = new Date();
  const sequence = await storage.nextMoneyRequestSequence();
  const yearMonth = dateInTz(now, EXPIRY_TIMEZONE).slice(0, 7);
  const token = randomBytes(24).toString("hex"); // 192 bits of entropy
  const tokenHash = hashToken(token);
  const requesterName = await displayNameOf(userId);

  const request: MoneyRequest = {
    id: randomUUID(),
    requestNumber: formatDocumentNumber("RM", sequence, yearMonth),
    requesterId: userId,
    requesterName,
    requesterCountry: user.country,
    corridorId: corridor.id,
    senderCountry: corridor.senderCountry,
    payInCurrency: corridor.payInCurrency,
    payInAmountMinor,
    payoutCurrency: corridor.payoutCurrency,
    feeMinor: quote.feeMinor,
    payoutAmountMinor: quote.payoutAmountMinor,
    fxRate: quote.fxRate !== null ? String(quote.fxRate) : null,
    fxRateIsIndicative: quote.fxRateIsIndicative,
    fxMarkupApplied: String(quote.fxMarkupApplied),
    payoutAccountId: account.id,
    payoutAccountMasked: maskAccountNumber(account.accountNumber),
    payoutAccountBankName: account.bankName,
    payoutAccountHolderName: account.holderName,
    payoutAccountCountry: account.country,
    senderType: payload.senderType,
    senderName: payload.senderName,
    senderEmail: payload.senderEmail.toLowerCase(),
    senderPhone: payload.senderPhone ?? null,
    purpose: payload.purpose,
    reference: payload.reference ?? null,
    status: "active",
    token,
    tokenHash,
    expiresAt: new Date(now.getTime() + serverConfig.requestExpiryDays * 24 * 60 * 60 * 1000),
    expiryExtendedOnce: false,
    viewedAt: null,
    paymentInitiatedAt: null,
    fundedAt: null,
    payoutSubmittedAt: null,
    paidOutAt: null,
    cancelledAt: null,
    failureReason: null,
    payinIntentId: null,
    providerPaymentRef: null,
    payoutProviderRef: null,
    paymentMethod: null,
    idempotencyKey: payload.idempotencyKey,
    createdAt: now,
  };

  await storage.createMoneyRequest(request);
  await queueRequestEmail(request, "initial");
  return { request, token, checkoutUrl: buildCheckoutUrl(token), alreadyExisted: false };
}

// ─── Email (provider interface, delivery states, idempotent, rate-limited) ────

async function queueRequestEmail(request: MoneyRequest, kind: "initial" | "resend"): Promise<void> {
  const dedupeKey = kind === "initial" ? `${request.id}:initial` : `${request.id}:resend:${Date.now()}`;

  if (kind === "initial") {
    const existing = await storage.getEmailDeliveryByDedupeKey(dedupeKey);
    if (existing) return;
  }

  const corridor = findCorridor(request.corridorId);
  const checkoutUrl = buildCheckoutUrl(request.token);
  const amountText = `${fromMinorUnits(request.payInAmountMinor, request.payInCurrency)} ${request.payInCurrency}`;

  const message = {
    to: request.senderEmail,
    subject: `${request.requesterName} requests ${amountText} via Rhemito`,
    text:
      `Hello ${request.senderName},\n\n` +
      `${request.requesterName} has requested ${amountText} through Rhemito.\n\n` +
      `Purpose: ${request.purpose.replace(/_/g, " ")}\n` +
      `Reference: ${request.requestNumber}\n` +
      `This request expires on ${formatHumanDate(dateInTz(request.expiresAt, EXPIRY_TIMEZONE))}.\n\n` +
      `Review and pay securely:\n${checkoutUrl}\n\n` +
      `⚠ Anti-fraud warning: Rhemito will never ask for your password, full card number or one-time codes by ` +
      `email or phone. If anything looks wrong, use "Report this request" on the payment page.\n\n` +
      `Need help? Contact Rhemito support: ${serverConfig.legalEntity.supportUrl}\n\n` +
      `— Rhemito (${serverConfig.legalEntity.displayName})`,
  };

  const delivery = {
    id: randomUUID(),
    requestId: request.id,
    toEmail: request.senderEmail,
    subject: message.subject,
    state: "queued",
    attempts: "0",
    dedupeKey,
    lastAttemptAt: new Date(),
    createdAt: new Date(),
  };
  const stored = await storage.addEmailDelivery(delivery);

  try {
    await devEmailProvider.send(message);
    await storage.updateEmailDelivery(stored.id, {
      state: kind === "resend" ? "resent" : "sent",
      attempts: "1",
      lastAttemptAt: new Date(),
    });
  } catch (err) {
    console.error("[requestService] email send failed:", err);
    await storage.updateEmailDelivery(stored.id, { state: "failed", attempts: "1", lastAttemptAt: new Date() });
  }
}

export async function resendRequestEmail(userId: string, requestId: string): Promise<void> {
  const request = await getOwnRequest(userId, requestId);
  if (request.status !== "active" && request.status !== "viewed") {
    throw new RequestError(409, "INVALID_STATE", "Email can only be resent while the request is awaiting payment.");
  }

  const deliveries = await storage.listEmailDeliveries(requestId);
  const last = deliveries[deliveries.length - 1];
  if (last?.lastAttemptAt && Date.now() - last.lastAttemptAt.getTime() < serverConfig.emailResendCooldownMs) {
    throw new RequestError(429, "RATE_LIMITED", "Please wait a minute before resending the email.");
  }

  await queueRequestEmail(request, "resend");
}

// ─── Lookup / ownership helpers ────────────────────────────────────────────────

async function getOwnRequest(userId: string, requestId: string): Promise<MoneyRequest> {
  const request = await storage.getMoneyRequestById(requestId);
  if (!request || request.requesterId !== userId) {
    throw new RequestError(404, "NOT_FOUND", "Request not found.");
  }
  return request;
}

export async function getRequestByToken(token: string): Promise<MoneyRequest | undefined> {
  return storage.getMoneyRequestByTokenHash(hashToken(token));
}

/** Effective status incl. real-time expiry for pre-funding states. */
export function effectiveStatus(request: MoneyRequest, now = new Date()): RequestStatus {
  const s = request.status as RequestStatus;
  if ((s === "active" || s === "viewed") && now.getTime() >= request.expiresAt.getTime()) {
    return "expired";
  }
  return s;
}

// ─── Public projection (minimum data for the payer — no bank details) ─────────

export function toPublicRequestJSON(request: MoneyRequest) {
  const corridor = findCorridor(request.corridorId);
  const now = new Date();
  return {
    requestNumber: request.requestNumber,
    requesterName: request.requesterName,
    // Accurate identity description — never "verified" just because it arrived by email.
    requesterIdentity: "Rhemito customer",
    amount: fromMinorUnits(request.payInAmountMinor, request.payInCurrency),
    currency: request.payInCurrency,
    purpose: request.purpose,
    reference: request.reference ?? null,
    expiresAt: request.expiresAt.toISOString(),
    expiryDate: dateInTz(request.expiresAt, EXPIRY_TIMEZONE),
    methods: corridor?.methods ?? [],
    estimatedDeliveryTime: corridor?.estimatedDeliveryTime ?? "",
    senderFeeNote: "No Rhemito fee is charged to you — the requester covers the fee.",
    status: effectiveStatus(request, now),
    legalEntity: serverConfig.legalEntity,
  };
}

export function markViewed(request: MoneyRequest): void {
  if (request.status === "active") {
    void storage.updateMoneyRequest(request.id, { status: "viewed", viewedAt: new Date() });
  }
}

// ─── Pay-in intents ────────────────────────────────────────────────────────────

export async function createPayinIntent(token: string, method: string): Promise<{
  intentId: string;
  authorizationUrl: string;
  requestNumber: string;
}> {
  const request = await getRequestByToken(token);
  if (!request) throw new RequestError(404, "NOT_FOUND", "This payment link is not valid.");

  const status = effectiveStatus(request);
  if (status === "paid_out" || status === "funded" || status === "payout_pending") {
    throw new RequestError(409, "ALREADY_PAID", "This request has already been paid.");
  }
  if (status === "cancelled") {
    throw new RequestError(409, "CANCELLED", "This request was cancelled by the requester.");
  }
  if (status === "expired") {
    await materializeExpiry(request);
    throw new RequestError(410, "EXPIRED", "This request has expired.");
  }
  if (status === "payment_pending") {
    throw new RequestError(409, "PAYMENT_IN_PROGRESS", "A payment for this request is already in progress.");
  }

  const corridor = findCorridor(request.corridorId);
  if (!corridor || !corridor.methods.includes(method as never)) {
    throw new RequestError(400, "METHOD_UNAVAILABLE", "That payment method is not available for this request.");
  }

  // Critical section: single in-flight payment per request.
  await storage.updateMoneyRequest(request.id, {
    status: "payment_pending",
    paymentInitiatedAt: new Date(),
    paymentMethod: method,
  });

  const intent = await devPayinProvider.createIntent({
    requestNumber: request.requestNumber,
    amountMinor: request.payInAmountMinor,
    currency: request.payInCurrency,
    method,
    checkoutUrl: buildCheckoutUrl(request.token),
  });
  await storage.updateMoneyRequest(request.id, { payinIntentId: intent.intentId });

  return { intentId: intent.intentId, authorizationUrl: intent.authorizationUrl, requestNumber: request.requestNumber };
}

// ─── Webhook processing — the ONLY path that funds a request ──────────────────

export async function processPayinWebhook(rawBody: Buffer, signature: string): Promise<{ accepted: true }> {
  if (!verifyWebhookSignature(rawBody, signature)) {
    throw new RequestError(401, "BAD_SIGNATURE", "Invalid webhook signature.");
  }

  let event: PayinWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString("utf8")) as PayinWebhookEvent;
  } catch {
    throw new RequestError(400, "BAD_PAYLOAD", "Malformed webhook payload.");
  }
  if (!event.eventId || !event.type || !event.requestNumber) {
    throw new RequestError(400, "BAD_PAYLOAD", "Webhook payload missing required fields.");
  }

  // Idempotent processing.
  const seen = await storage.getWebhookEvent("payin", event.eventId);
  if (seen) return { accepted: true };
  await storage.addWebhookEvent({
    id: randomUUID(),
    provider: "payin",
    eventId: event.eventId,
    eventType: event.type,
    processedAt: new Date(),
    requestNumber: event.requestNumber,
  });

  const request = Array.from(
    (await storage.listAllMoneyRequestsRaw()).filter((r) => r.requestNumber === event.requestNumber),
  )[0];
  if (!request) return { accepted: true }; // unknown request: acknowledge, ignore

  if (event.type === "payment.succeeded") {
    // Validate the webhook against the request before funding anything.
    if (request.payinIntentId !== event.intentId) return { accepted: true };
    if (event.amountMinor !== request.payInAmountMinor || event.currency !== request.payInCurrency) {
      console.error(`[requestService] webhook amount mismatch for ${request.requestNumber} — ignored`);
      return { accepted: true };
    }
    if (request.status !== "payment_pending") return { accepted: true }; // stale/duplicate

    await storage.updateMoneyRequest(request.id, {
      status: "funded",
      fundedAt: new Date(),
      providerPaymentRef: event.providerPaymentRef,
    });
    await postFundingEntries(request, event.providerPaymentRef);

    // Payout eligibility passed (single-tier prototype): submit to the payout provider.
    const payout = await devPayoutProvider.submitPayout({
      requestNumber: request.requestNumber,
      amountMinor: request.payoutAmountMinor ?? request.payInAmountMinor - request.feeMinor,
      currency: request.payoutCurrency,
      maskedAccount: request.payoutAccountMasked,
    });
    await storage.updateMoneyRequest(request.id, {
      status: "payout_pending",
      payoutSubmittedAt: new Date(),
      payoutProviderRef: payout.payoutRef,
    });

    // Development stub: simulate the bank's settlement webhook through the
    // same signed boundary. A real provider calls /api/webhooks/payout.
    const settlement: PayinWebhookEvent = {
      eventId: `payoutsettle_${payout.payoutRef}`,
      type: "payout.succeeded",
      intentId: payout.payoutRef,
      requestNumber: request.requestNumber,
      amountMinor: request.payoutAmountMinor ?? 0,
      currency: request.payoutCurrency,
      providerPaymentRef: payout.payoutRef,
    };
    const settlementBody = Buffer.from(JSON.stringify(settlement), "utf8");
    const settlementSignature = signWebhookPayload(settlementBody);
    setTimeout(() => {
      void processPayoutWebhook(settlementBody, settlementSignature).catch((err) =>
        console.error("[requestService] simulated payout webhook failed:", err),
      );
    }, serverConfig.devProvider.payoutSettlementDelayMs);
  } else if (event.type === "payment.failed") {
    if (request.status === "payment_pending") {
      await storage.updateMoneyRequest(request.id, {
        status: "viewed",
        paymentInitiatedAt: null,
        payinIntentId: null,
        failureReason: "Payment failed at the provider.",
      });
    }
  }

  return { accepted: true };
}

export async function processPayoutWebhook(rawBody: Buffer, signature: string): Promise<{ accepted: true }> {
  if (!verifyWebhookSignature(rawBody, signature)) {
    throw new RequestError(401, "BAD_SIGNATURE", "Invalid webhook signature.");
  }

  let event: PayinWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString("utf8")) as PayinWebhookEvent;
  } catch {
    throw new RequestError(400, "BAD_PAYLOAD", "Malformed webhook payload.");
  }

  const seen = await storage.getWebhookEvent("payout", event.eventId);
  if (seen) return { accepted: true };
  await storage.addWebhookEvent({
    id: randomUUID(),
    provider: "payout",
    eventId: event.eventId,
    eventType: event.type,
    processedAt: new Date(),
    requestNumber: event.requestNumber,
  });

  const request = Array.from(
    (await storage.listAllMoneyRequestsRaw()).filter((r) => r.requestNumber === event.requestNumber),
  )[0];
  if (!request) return { accepted: true };

  if (event.type === "payout.succeeded" && request.status === "payout_pending") {
    await postPayoutEntry(request, event.providerPaymentRef);
    await storage.updateMoneyRequest(request.id, { status: "paid_out", paidOutAt: new Date() });
  } else if (event.type === "payout.failed" && request.status === "payout_pending") {
    // Funds remain credited; the failed payout stays visible and recoverable.
    await storage.updateMoneyRequest(request.id, {
      status: "failed",
      failureReason: "Bank payout failed — funds remain in your Rhemito wallet for retry.",
    });
  }

  return { accepted: true };
}

// ─── Requester actions ─────────────────────────────────────────────────────────

export async function cancelRequest(userId: string, requestId: string): Promise<void> {
  const request = await getOwnRequest(userId, requestId);
  const status = effectiveStatus(request);
  if (status !== "active" && status !== "viewed") {
    throw new RequestError(409, "INVALID_STATE", "This request can no longer be cancelled.");
  }
  await storage.updateMoneyRequest(request.id, { status: "cancelled", cancelledAt: new Date() });
}

export async function rotateToken(userId: string, requestId: string): Promise<{ token: string; checkoutUrl: string }> {
  const request = await getOwnRequest(userId, requestId);
  const status = effectiveStatus(request);
  if (status !== "active" && status !== "viewed") {
    throw new RequestError(409, "INVALID_STATE", "The link can only be rotated while awaiting payment.");
  }
  const token = randomBytes(24).toString("hex");
  await storage.updateMoneyRequest(request.id, { token, tokenHash: hashToken(token) });
  return { token, checkoutUrl: buildCheckoutUrl(token) };
}

export async function extendExpiry(userId: string, requestId: string): Promise<Date> {
  const request = await getOwnRequest(userId, requestId);
  const status = effectiveStatus(request);
  if (status !== "active" && status !== "viewed") {
    throw new RequestError(409, "INVALID_STATE", "Expiry can only be extended while awaiting payment.");
  }
  if (request.expiryExtendedOnce) {
    throw new RequestError(409, "ALREADY_EXTENDED", "This request's expiry has already been extended once.");
  }
  const current = request.expiresAt.getTime();
  const now = Date.now();
  const base = Math.max(current, now);
  const extended = new Date(base + serverConfig.maxExpiryExtensionDays * 24 * 60 * 60 * 1000);
  await storage.updateMoneyRequest(request.id, { expiresAt: extended, expiryExtendedOnce: true });
  return extended;
}

// ─── Requester serialization (masked accounts) ─────────────────────────────────

export function toRequestJSON(request: MoneyRequest) {
  return {
    id: request.id,
    requestNumber: request.requestNumber,
    status: effectiveStatus(request),
    senderName: request.senderName,
    senderEmail: request.senderEmail,
    senderType: request.senderType,
    senderCountry: request.senderCountry,
    payInAmount: fromMinorUnits(request.payInAmountMinor, request.payInCurrency),
    payInCurrency: request.payInCurrency,
    feeAmount: fromMinorUnits(request.feeMinor, request.payInCurrency),
    payoutAmount:
      request.payoutAmountMinor !== null
        ? fromMinorUnits(request.payoutAmountMinor, request.payoutCurrency)
        : null,
    payoutCurrency: request.payoutCurrency,
    fxRate: request.fxRate !== null ? Number(request.fxRate) : null,
    fxRateIsIndicative: request.fxRateIsIndicative,
    fxMarkupApplied: request.fxMarkupApplied !== null ? Number(request.fxMarkupApplied) : null,
    payoutAccount: {
      bankName: request.payoutAccountBankName,
      maskedNumber: request.payoutAccountMasked,
      holderName: request.payoutAccountHolderName,
      country: request.payoutAccountCountry,
    },
    purpose: request.purpose,
    reference: request.reference ?? null,
    corridorId: request.corridorId,
    paymentMethod: request.paymentMethod ?? null,
    checkoutUrl: buildCheckoutUrl(request.token),
    expiresAt: request.expiresAt.toISOString(),
    expiryExtendedOnce: request.expiryExtendedOnce,
    viewedAt: request.viewedAt?.toISOString() ?? null,
    fundedAt: request.fundedAt?.toISOString() ?? null,
    paidOutAt: request.paidOutAt?.toISOString() ?? null,
    cancelledAt: request.cancelledAt?.toISOString() ?? null,
    failureReason: request.failureReason ?? null,
    createdAt: request.createdAt?.toISOString() ?? null,
  };
}

// ─── Sweep ─────────────────────────────────────────────────────────────────────

async function materializeExpiry(request: MoneyRequest): Promise<void> {
  if (request.status === "active" || request.status === "viewed") {
    await storage.updateMoneyRequest(request.id, { status: "expired" });
  }
}

async function sweepOnce(): Promise<void> {
  const now = new Date();
  for (const request of await storage.listAllMoneyRequestsRaw()) {
    try {
      if (now.getTime() >= request.expiresAt.getTime()) {
        await materializeExpiry(request);
      }
      // A payment that never settles reverts to an active request so the
      // sender can retry (never funded without a webhook).
      if (
        request.status === "payment_pending" &&
        request.paymentInitiatedAt &&
        now.getTime() - request.paymentInitiatedAt.getTime() > PAYMENT_PENDING_TIMEOUT_MS
      ) {
        await storage.updateMoneyRequest(request.id, {
          status: "viewed",
          paymentInitiatedAt: null,
          payinIntentId: null,
          failureReason: "Payment authorisation was not completed.",
        });
      }
    } catch (err) {
      console.error(`[requestService] sweep failed for ${request.id}:`, err);
    }
  }
}

let sweepTimer: NodeJS.Timeout | null = null;

export function startRequestSweep(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    void sweepOnce().catch((err) => console.error("[requestService] sweep error:", err));
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref();
}

