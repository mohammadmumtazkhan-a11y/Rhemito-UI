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
import { serverConfig, demoModeEnabled, buildCheckoutUrl, buildEmailCheckoutUrl } from "./config";
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
import { dispatchNotification } from "./notificationService";
import { findCorridor, validateCorridor, type CorridorConfig } from "./corridors";
import {
  toMinorUnits,
  fromMinorUnits,
  feeMinorOf,
  senderPaysMinorOf,
  netMinorOf,
  applyFxMarkup,
  convertMinor,
  maskAccountNumber,
  maskEmail,
} from "@shared/money";
import {
  formatDocumentNumber,
  dateInTz,
  EXPIRY_TIMEZONE,
  formatHumanDate,
  validateInvoiceDates,
} from "@shared/invoice-logic";
import { DEMO_PAYER_CREDENTIALS } from "@shared/schema";
import type {
  MoneyRequest,
  CreateMoneyRequestPayload,
  RequestStatus,
  PaymentAttempt,
  RequestRenewalRequest,
} from "@shared/schema";
import bcrypt from "bcryptjs";

export class RequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

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
  senderPaysMinor: number;
  payoutAmountMinor: number | null;
  fxRate: number | null;
  fxRateIsIndicative: boolean;
  fxMarkupApplied: number;
}

/** Fee + indicative FX quote. Never silently 1:1 — getFxRate throws on unknown pairs. */
export async function computeQuote(
  corridor: CorridorConfig,
  payInAmountMinor: number,
  absorbFee = true,
): Promise<QuoteSnapshot> {
  const feeMinor = feeMinorOf(payInAmountMinor, serverConfig.feeRate);
  const netMinor = netMinorOf(payInAmountMinor, feeMinor, absorbFee);

  if (corridor.payInCurrency === corridor.payoutCurrency) {
    return {
      feeMinor,
      senderPaysMinor: senderPaysMinorOf(payInAmountMinor, feeMinor, absorbFee),
      payoutAmountMinor: netMinor,
      fxRate: null,
      fxRateIsIndicative: true,
      fxMarkupApplied: 0,
    };
  }

  const midRate = await getFxRate(corridor.payInCurrency, corridor.payoutCurrency);
  const customerRate = applyFxMarkup(midRate, serverConfig.fxMarkup);
  return {
    feeMinor,
    senderPaysMinor: senderPaysMinorOf(payInAmountMinor, feeMinor, absorbFee),
    payoutAmountMinor: convertMinor(netMinor, customerRate),
    fxRate: customerRate,
    fxRateIsIndicative: true,
    fxMarkupApplied: serverConfig.fxMarkup,
  };
}

export async function createMoneyRequest(params: {
  userId: string;
  payload: CreateMoneyRequestPayload;
}): Promise<{ request: MoneyRequest; token: string; emailToken: string; checkoutUrl: string; emailCheckoutUrl: string; alreadyExisted: boolean }> {
  const { userId, payload } = params;

  // Idempotent submissions return the original request.
  const existing = await storage.getMoneyRequestByIdempotencyKey(userId, payload.idempotencyKey);
  if (existing) {
    const emailTok = existing.emailToken || existing.token;
    return {
      request: existing,
      token: existing.token,
      emailToken: emailTok,
      checkoutUrl: buildCheckoutUrl(existing.token),
      emailCheckoutUrl: buildEmailCheckoutUrl(emailTok),
      alreadyExisted: true,
    };
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

  const quote = await computeQuote(corridor, payInAmountMinor, payload.absorbFee);
  const now = new Date();

  // Due Date / Payment Link Expiry follow the invoice contract: the link
  // expires at the end (11:59:59 p.m. UK) of the chosen day, and preset
  // periods count from the Due Date when one is set. Client validation is
  // mirrored for UX only — this check is authoritative.
  const dateCheck = validateInvoiceDates(payload.dueDate, payload.expiry, now);
  if (dateCheck.errors.length > 0) {
    throw new RequestError(400, "VALIDATION_ERROR", dateCheck.errors[0]);
  }

  const sequence = await storage.nextMoneyRequestSequence();
  const yearMonth = dateInTz(now, EXPIRY_TIMEZONE).slice(0, 7);

  // Dual secure tokens: clean copyable link token + recipient-specific email link token
  const token = randomBytes(24).toString("hex"); // 192 bits of entropy for copyable link
  const tokenHash = hashToken(token);
  const emailToken = randomBytes(24).toString("hex"); // 192 bits of entropy for email notification link
  const emailTokenHash = hashToken(emailToken);
  const requesterName = await displayNameOf(userId);
  const recipientEmailMasked = maskEmail(payload.senderEmail);

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
    absorbFee: payload.absorbFee,
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
    emailToken,
    emailTokenHash,
    recipientEmailMasked,
    payerUserId: null,
    payerName: null,
    payerEmail: null,
    payerEmailMasked: null,
    activeSessionId: null,
    sessionExpiresAt: null,
    reservedAttemptId: null,
    dueDate: payload.dueDate ?? null,
    expiresAt: dateCheck.computation.expiresAt,
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
  await ensureDemoPayerForRequest(request);
  await queueRequestEmail(request, "initial");
  return {
    request,
    token,
    emailToken,
    checkoutUrl: buildCheckoutUrl(token),
    emailCheckoutUrl: buildEmailCheckoutUrl(emailToken),
    alreadyExisted: false,
  };
}

/**
 * Prototype-only: register the sender email the requester provided as a demo
 * payer (fixed demo password) so the checkout's registered-user path can be
 * demonstrated with exactly that email. Existing accounts are left untouched,
 * and real production (no dev hooks) never creates these accounts.
 */
async function ensureDemoPayerForRequest(request: MoneyRequest): Promise<void> {
  if (!demoModeEnabled) return;
  const email = request.senderEmail;
  if (await storage.getAuthUserByEmail(email)) return;
  const [firstName, ...rest] = request.senderName.split(" ");
  await storage.createAuthUser({
    email,
    password: bcrypt.hashSync(DEMO_PAYER_CREDENTIALS.password, 12),
    accountType: request.senderType === "business" ? "business" : "individual",
    country: request.senderCountry,
    firstName: firstName || "Demo",
    middleName: null,
    lastName: rest.join(" ") || "Payer",
    dateOfBirth: null,
    gender: null,
    mobileCode: null,
    mobileNumber: null,
    businessName: request.senderType === "business" ? request.senderName : null,
    businessRegNo: null,
    businessPhoneCode: null,
    businessPhoneNumber: null,
    directorName: null,
    status: "pending",
  });
  // createAuthUser seeds kycStatus "pending" — activate so the payer passes the
  // session compliance gate (same as the OTP-verified registration path).
  await storage.activateUser(email);
}

// ─── Email (provider interface, delivery states, idempotent, rate-limited) ────

async function queueRequestEmail(request: MoneyRequest, kind: "initial" | "resend"): Promise<void> {
  const dedupeKey = kind === "initial" ? `${request.id}:initial` : `${request.id}:resend:${Date.now()}`;

  if (kind === "initial") {
    const existing = await storage.getEmailDeliveryByDedupeKey(dedupeKey);
    if (existing) return;
  }

  const corridor = findCorridor(request.corridorId);
  const emailCheckoutUrl = buildEmailCheckoutUrl(request.emailToken || request.token);
  // The sender is told the total they pay — requested amount plus fee when the
  // requester does not absorb it.
  const amountText = `${fromMinorUnits(
    senderPaysMinorOf(request.payInAmountMinor, request.feeMinor, request.absorbFee),
    request.payInCurrency,
  )} ${request.payInCurrency}`;

  const message = {
    to: request.senderEmail,
    subject: `${request.requesterName} requests ${amountText} via Rhemito`,
    text:
      `Hello ${request.senderName},\n\n` +
      `${request.requesterName} has requested ${amountText} through Rhemito.\n\n` +
      `Purpose: ${request.purpose.replace(/_/g, " ")}\n` +
      `Reference: ${request.requestNumber}\n` +
      `This request expires on ${formatHumanDate(dateInTz(request.expiresAt, EXPIRY_TIMEZONE))}.\n\n` +
      `Review and pay securely:\n${emailCheckoutUrl}\n\n` +
      `⚠ Anti-fraud warning: Rhemito will never ask for your password, full card number or one-time codes by ` +
      `email or phone. If anything looks wrong, do not proceed with payment and contact Rhemito support.\n\n` +
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

async function sendLifecycleEmail(
  request: MoneyRequest,
  toEmail: string,
  subject: string,
  text: string,
  dedupeKey: string,
): Promise<void> {
  if (await storage.getEmailDeliveryByDedupeKey(dedupeKey)) return;
  const delivery = await storage.addEmailDelivery({
    id: randomUUID(), requestId: request.id, toEmail, subject, state: "queued",
    attempts: "0", dedupeKey, lastAttemptAt: new Date(), createdAt: new Date(),
  });
  try {
    await devEmailProvider.send({ to: toEmail, subject, text });
    await storage.updateEmailDelivery(delivery.id, { state: "sent", attempts: "1", lastAttemptAt: new Date() });
  } catch (error) {
    console.error("[requestService] lifecycle email failed:", error);
    await storage.updateEmailDelivery(delivery.id, { state: "failed", attempts: "1", lastAttemptAt: new Date() });
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

export async function getRequestByTokenOrEmailToken(
  tokenOrEmailToken: string,
  isEmailLink = false,
): Promise<MoneyRequest | undefined> {
  const hash = hashToken(tokenOrEmailToken);
  if (isEmailLink) {
    return storage.getMoneyRequestByEmailTokenHash(hash);
  }
  return storage.getMoneyRequestByTokenHash(hash);
}

/** Effective status incl. real-time expiry for pre-funding states. */
export function effectiveStatus(request: MoneyRequest, now = new Date()): RequestStatus {
  const s = request.status as RequestStatus;
  if ((s === "active" || s === "viewed") && now.getTime() >= request.expiresAt.getTime()) {
    return "expired";
  }
  return s;
}

// ─── Public projection (minimum data for the payer — no requester bank details) ─────────

export function toPublicRequestJSON(request: MoneyRequest, isEmailLink = false, currentUserId?: string) {
  const corridor = findCorridor(request.corridorId);
  const now = new Date();
  const senderPaysMinor = senderPaysMinorOf(request.payInAmountMinor, request.feeMinor, request.absorbFee);

  let sessionExpired = false;
  if (request.sessionExpiresAt && now.getTime() >= request.sessionExpiresAt.getTime()) {
    sessionExpired = true;
  }

  return {
    requestNumber: currentUserId ? request.requestNumber : null,
    requesterName: request.requesterName,
    requesterIdentity: "Rhemito customer",
    amount: fromMinorUnits(currentUserId ? senderPaysMinor : request.payInAmountMinor, request.payInCurrency),
    requestedAmount: fromMinorUnits(request.payInAmountMinor, request.payInCurrency),
    feeAmount: currentUserId ? fromMinorUnits(request.feeMinor, request.payInCurrency) : null,
    currency: request.payInCurrency,
    payoutCurrency: currentUserId ? request.payoutCurrency : null,
    absorbFee: currentUserId ? request.absorbFee : null,
    purpose: currentUserId ? request.purpose : null,
    reference: currentUserId ? (request.reference ?? null) : null,
    dueDate: request.dueDate ?? null,
    expiresAt: request.expiresAt.toISOString(),
    expiryDate: dateInTz(request.expiresAt, EXPIRY_TIMEZONE),
    methods: currentUserId ? (corridor?.methods ?? []) : [],
    estimatedDeliveryTime: currentUserId ? (corridor?.estimatedDeliveryTime ?? "") : "",
    senderFeeNote: currentUserId ? (request.absorbFee
      ? "No Rhemito fee is charged to you — the requester covers the fee."
      : `A 3% Rhemito fee of ${fromMinorUnits(request.feeMinor, request.payInCurrency)} ${request.payInCurrency} is included in the total.`
    ) : "",
    status: effectiveStatus(request, now),
    failureReason: currentUserId ? request.failureReason : null,
    legalEntity: serverConfig.legalEntity,
    isEmailLink,
    recipientEmailMasked: isEmailLink ? (request.recipientEmailMasked || maskEmail(request.senderEmail)) : undefined,
    // Prototype-only demo aid: the sender email the requester provided is the
    // registered demo payer shown on the identification screen. Hidden in real
    // production (no dev hooks) so the payer email is never disclosed pre-auth.
    demoPayerEmail: demoModeEnabled ? request.senderEmail : undefined,
    activeSessionId: currentUserId && !sessionExpired ? request.activeSessionId : null,
    sessionExpiresAt: currentUserId && !sessionExpired && request.sessionExpiresAt ? request.sessionExpiresAt.toISOString() : null,
    isReservedByOther: ["authorisation_in_progress", "payment_processing", "payment_pending"].includes(request.status)
      && !!request.payerUserId && request.payerUserId !== currentUserId,
  };
}

export function markViewed(request: MoneyRequest): void {
  if (request.status === "active") {
    void storage.updateMoneyRequest(request.id, { status: "viewed", viewedAt: new Date() });
  }
}

// ─── Payer Session (10-minute server timer after authentication & compliance) ──

export async function startPayerSession(params: {
  token: string;
  isEmailLink?: boolean;
  userId: string;
}): Promise<{
  sessionId: string;
  sessionExpiresAt: string;
  quote: QuoteSnapshot;
  payerName: string;
  payerEmail: string;
}> {
  const { token, isEmailLink = false, userId } = params;
  const request = await getRequestByTokenOrEmailToken(token, isEmailLink);
  if (!request) throw new RequestError(404, "NOT_FOUND", "This payment link is not valid.");

  const status = effectiveStatus(request);
  if (status === "paid_out" || status === "funded" || status === "payout_pending") {
    throw new RequestError(409, "ALREADY_PAID", "This payment request has already been paid.");
  }
  if (status === "cancelled") {
    throw new RequestError(409, "CANCELLED", "This payment request was cancelled by the requester.");
  }
  if (status === "expired") {
    await materializeExpiry(request);
    throw new RequestError(410, "EXPIRED", "This payment request has expired.");
  }
  if (["authorisation_in_progress", "payment_processing", "payment_pending"].includes(status)) {
    throw new RequestError(409, "PAYMENT_IN_PROGRESS", "A payment is currently being processed for this request.");
  }

  // Validate Payer account & KYC
  const user = await storage.getAuthUserById(userId);
  if (!user) throw new RequestError(401, "UNAUTHENTICATED", "Please sign in to proceed.");
  if (user.status === "blocked") throw new RequestError(403, "BLOCKED", "Your account is blocked. Please contact support.");
  if (user.status === "pending") throw new RequestError(403, "ACCOUNT_UNVERIFIED", "Please verify your account OTP first.");
  if (user.kycStatus === "pending") throw new RequestError(403, "KYC_PENDING", "Your identity verification is currently pending review.");
  if (user.kycStatus === "failed" || user.kycStatus === "rejected") throw new RequestError(403, "KYC_FAILED", "Your verification was unsuccessful.");

  const payerName = user.accountType === "business" && user.businessName
    ? user.businessName
    : [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ") || user.email;
  const payerEmail = user.email;
  const payerEmailMasked = maskEmail(user.email);

  const corridor = findCorridor(request.corridorId);
  if (!corridor) throw new RequestError(400, "CORRIDOR_NOT_FOUND", "Corridor configuration missing.");

  const quote = await computeQuote(corridor, request.payInAmountMinor, request.absorbFee);
  const now = new Date();
  const sessionExpiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
  const sessionId = randomUUID();

  const attempt: PaymentAttempt = {
    id: sessionId,
    requestId: request.id,
    requestNumber: request.requestNumber,
    payerId: userId,
    payerEmail,
    payerName,
    payerEmailMasked,
    paymentMethod: "pending",
    payCurrency: request.payInCurrency,
    payAmountMinor: senderPaysMinorOf(request.payInAmountMinor, request.feeMinor, request.absorbFee),
    feeMinor: request.feeMinor,
    absorbFee: request.absorbFee,
    fxRate: quote.fxRate !== null ? String(quote.fxRate) : null,
    status: "session_open",
    paymentReference: `PAY-${request.requestNumber}-${randomBytes(3).toString("hex").toUpperCase()}`,
    providerIntentId: null,
    providerPaymentRef: null,
    failureReason: null,
    sessionStartedAt: now,
    sessionExpiresAt,
    authorisationStartedAt: null,
    completedAt: null,
  };
  await storage.addPaymentAttempt(attempt);

  return {
    sessionId,
    sessionExpiresAt: sessionExpiresAt.toISOString(),
    quote,
    payerName,
    payerEmail,
  };
}

// ─── Pay-in Submission (Atomic Lock) ──────────────────────────────────────────

export async function createPayinIntent(params: {
  token: string;
  isEmailLink?: boolean;
  method: string;
  userId: string;
  sessionId: string;
}): Promise<{
  intentId: string;
  authorizationUrl: string;
  paymentReference: string;
  requestNumber: string;
}> {
  const { token, method, userId, sessionId, isEmailLink = false } = params;

  const request = await getRequestByTokenOrEmailToken(token, isEmailLink);
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
  if (["authorisation_in_progress", "payment_processing", "payment_pending"].includes(status)) {
    throw new RequestError(409, "PAYMENT_IN_PROGRESS", "A payment for this request is already in progress.");
  }

  const corridor = findCorridor(request.corridorId);
  if (!corridor || !corridor.methods.includes(method as never)) {
    throw new RequestError(400, "METHOD_UNAVAILABLE", "That payment method is not available for this request.");
  }

  const user = await storage.getAuthUserById(userId);
  if (!user || user.status !== "active" || user.kycStatus !== "passed") {
    throw new RequestError(403, "NOT_ELIGIBLE", "Your account is not eligible to make this payment.");
  }
  const session = await storage.getPaymentAttemptById(sessionId);
  if (!session || session.requestId !== request.id || session.payerId !== userId || session.status !== "session_open") {
    throw new RequestError(409, "INVALID_SESSION", "Start a new payment session to continue.");
  }
  if (!session.sessionExpiresAt || session.sessionExpiresAt.getTime() <= Date.now()) {
    await storage.updatePaymentAttempt(session.id, { status: "session_expired", completedAt: new Date() });
    throw new RequestError(410, "SESSION_EXPIRED", "Your payment session has expired.");
  }
  const payerName = user.accountType === "business" && user.businessName
    ? user.businessName
    : [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ") || user.email;
  const payerEmail = user.email;

  const paymentReference = `PAY-${request.requestNumber}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const now = new Date();

  // Reserve before contacting the provider. Only one concurrent payer wins.
  const reserved = await storage.compareAndUpdateMoneyRequest(request.id, ["active", "viewed"], {
    status: "authorisation_in_progress",
    paymentInitiatedAt: now,
    paymentMethod: method,
    reservedAttemptId: session.id,
    payerUserId: userId,
    payerName,
    payerEmail,
    payerEmailMasked: maskEmail(payerEmail),
  });
  if (!reserved) {
    throw new RequestError(409, "PAYMENT_IN_PROGRESS", "Another payment is already being processed.");
  }

  let intent;
  try {
    intent = await devPayinProvider.createIntent({
      requestNumber: request.requestNumber,
      amountMinor: senderPaysMinorOf(request.payInAmountMinor, request.feeMinor, request.absorbFee),
      currency: request.payInCurrency,
      method,
      checkoutUrl: buildCheckoutUrl(request.token),
    });
  } catch (error) {
    await storage.compareAndUpdateMoneyRequest(request.id, ["authorisation_in_progress"], {
      status: effectiveStatus({ ...request, status: "viewed" }),
      paymentInitiatedAt: null,
      paymentMethod: null,
      reservedAttemptId: null,
      payerUserId: null,
      payerName: null,
      payerEmail: null,
      payerEmailMasked: null,
    });
    throw error;
  }

  await storage.updatePaymentAttempt(session.id, {
    paymentMethod: method,
    status: "authorisation_initiated",
    paymentReference,
    providerIntentId: intent.intentId,
    authorisationStartedAt: now,
  });
  await storage.updateMoneyRequest(request.id, {
    status: "payment_processing",
    payinIntentId: intent.intentId,
  });

  return {
    intentId: intent.intentId,
    authorizationUrl: intent.authorizationUrl,
    paymentReference,
    requestNumber: request.requestNumber,
  };
}

// ─── Request New Link for Expired Requests ────────────────────────────────────

export async function requestNewPaymentLink(
  token: string,
  isEmailLink = false,
  payerEmail?: string,
): Promise<{ success: true; message: string }> {
  const request = await getRequestByTokenOrEmailToken(token, isEmailLink);
  if (!request) throw new RequestError(404, "NOT_FOUND", "This payment link is not valid.");

  if (request.status === "paid_out" || request.status === "funded" || request.status === "payout_pending") {
    throw new RequestError(409, "ALREADY_PAID", "This request has already been paid.");
  }
  if (request.status === "cancelled") {
    throw new RequestError(409, "CANCELLED", "This request was cancelled.");
  }

  const status = effectiveStatus(request);
  if (status !== "expired") {
    throw new RequestError(400, "NOT_EXPIRED", "This request has not expired yet.");
  }

  const normalizedPayerEmail = (payerEmail || request.senderEmail).toLowerCase();
  const existingRenewal = (await storage.listRenewalRequests(request.id))
    .find((item) => item.payerEmail?.toLowerCase() === normalizedPayerEmail);
  if (existingRenewal) {
    return { success: true, message: "The requester has already been notified to issue a new payment link." };
  }

  const renewal: RequestRenewalRequest = {
    id: randomUUID(),
    requestId: request.id,
    requestNumber: request.requestNumber,
    requesterId: request.requesterId,
    payerEmail: normalizedPayerEmail,
    requestedAt: new Date(),
  };
  await storage.addRenewalRequest(renewal);

  const requester = await storage.getAuthUserById(request.requesterId);
  if (requester?.email) {
    try {
      await devEmailProvider.send({
        to: requester.email,
        subject: `New payment link requested for ${request.requestNumber}`,
        text:
          `Hello ${request.requesterName},\n\n` +
          `A payer has requested a new payment link for expired request ${request.requestNumber} (${request.payInCurrency} ${fromMinorUnits(request.payInAmountMinor, request.payInCurrency)}).\n\n` +
          `You can generate a new payment request from your Rhemito Dashboard:\n${serverConfig.publicBaseUrl}/request-payment\n\n` +
          `— Rhemito Team`,
      });
    } catch (err) {
      console.error("[requestService] failed to send renewal notification:", err);
    }
  }

  await dispatchNotification({
    userId: request.requesterId,
    type: "money_request_new_link_requested",
    data: {
      requestNumber: request.requestNumber,
      payerName: normalizedPayerEmail,
      amount: fromMinorUnits(request.payInAmountMinor, request.payInCurrency),
      currency: request.payInCurrency,
    },
  });

  return { success: true, message: "A notification has been sent to the requester to issue a new payment link." };
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
    const senderPaysMinor = senderPaysMinorOf(request.payInAmountMinor, request.feeMinor, request.absorbFee);
    if (event.amountMinor !== senderPaysMinor || event.currency !== request.payInCurrency) {
      console.error(`[requestService] webhook amount mismatch for ${request.requestNumber} — ignored`);
      return { accepted: true };
    }
    if (!["authorisation_in_progress", "payment_processing", "payment_pending"].includes(request.status)) return { accepted: true };

    if (request.reservedAttemptId) {
      await storage.updatePaymentAttempt(request.reservedAttemptId, {
        status: "successful",
        providerPaymentRef: event.providerPaymentRef,
        completedAt: new Date(),
      });
    }

    await storage.updateMoneyRequest(request.id, {
      status: "funded",
      fundedAt: new Date(),
      providerPaymentRef: event.providerPaymentRef,
    });
    await postFundingEntries(request, event.providerPaymentRef);
    const requester = await storage.getAuthUserById(request.requesterId);
    if (request.payerEmail) {
      await sendLifecycleEmail(
        request, request.payerEmail, `Payment successful: ${request.requestNumber}`,
        `Your payment to ${request.requesterName} was successful. Payment reference: ${request.reservedAttemptId ?? request.requestNumber}.`,
        `${request.id}:payer:successful`,
      );
    }
    if (requester?.email) {
      await sendLifecycleEmail(
        request, requester.email, `Payment received: ${request.requestNumber}`,
        `Your payment request has been paid successfully.`, `${request.id}:requester:paid`,
      );
    }

    await dispatchNotification({
      userId: request.requesterId,
      type: "money_request_paid",
      data: {
        requestNumber: request.requestNumber,
        payerName: request.payerName ?? "Payer",
        amount: fromMinorUnits(request.payInAmountMinor, request.payInCurrency),
        currency: request.payInCurrency,
      },
    });

    // Payout eligibility passed (single-tier prototype): submit to the payout provider.
    const payout = await devPayoutProvider.submitPayout({
      requestNumber: request.requestNumber,
      amountMinor:
        request.payoutAmountMinor ?? netMinorOf(request.payInAmountMinor, request.feeMinor, request.absorbFee),
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
  } else if (event.type === "payment.failed" || event.type === "payment.cancelled") {
    if (["authorisation_in_progress", "payment_processing", "payment_pending"].includes(request.status)) {
      if (request.payinIntentId !== event.intentId) return { accepted: true };
      const completedAt = new Date();
      if (request.reservedAttemptId) {
        await storage.updatePaymentAttempt(request.reservedAttemptId, {
          status: event.type === "payment.cancelled" ? "provider_cancelled" : "failed",
          providerPaymentRef: event.providerPaymentRef,
          failureReason: "The payment was not completed.",
          completedAt,
        });
      }
      if (request.payerEmail) {
        await sendLifecycleEmail(
          request, request.payerEmail, `Payment not completed: ${request.requestNumber}`,
          "Your payment was not completed. You may try again if the request remains active.",
          `${request.id}:${request.reservedAttemptId ?? event.intentId}:payer:failed`,
        );
      }
      await storage.updateMoneyRequest(request.id, {
        status: completedAt.getTime() >= request.expiresAt.getTime() ? "expired" : "viewed",
        paymentInitiatedAt: null,
        payinIntentId: null,
        reservedAttemptId: null,
        payerUserId: null,
        payerName: null,
        payerEmail: null,
        payerEmailMasked: null,
        failureReason: "Payment failed at the provider.",
      });
    }
  } else if (event.type === "payment.pending" || event.type === "payment.unknown") {
    if (request.payinIntentId === event.intentId && ["authorisation_in_progress", "payment_processing", "payment_pending"].includes(request.status)) {
      await storage.updateMoneyRequest(request.id, { status: "payment_processing" });
      if (request.reservedAttemptId) {
        await storage.updatePaymentAttempt(request.reservedAttemptId, {
          status: event.type === "payment.pending" ? "pending" : "unknown",
          providerPaymentRef: event.providerPaymentRef,
        });
      }
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
  const attempts = await storage.listPaymentAttempts(request.id);
  const activePayerEmails = attempts
    .filter((attempt) => attempt.status === "session_open" && !!attempt.sessionExpiresAt && attempt.sessionExpiresAt.getTime() > Date.now())
    .map((attempt) => attempt.payerEmail);
  const recipients = Array.from(new Set([request.senderEmail, ...activePayerEmails].map((email) => email.toLowerCase())));
  await Promise.all(recipients.map((email) => sendLifecycleEmail(
    request, email, `Payment request cancelled: ${request.requestNumber}`,
    `${request.requesterName} cancelled this payment request. No payment can be submitted.`,
    `${request.id}:cancelled:${email}`,
  )));

  await dispatchNotification({
    userId,
    type: "money_request_cancelled",
    data: {
      requestNumber: request.requestNumber,
      senderName: request.senderName,
      amount: fromMinorUnits(request.payInAmountMinor, request.payInCurrency),
      currency: request.payInCurrency,
    },
  });
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
    senderPaysAmount: fromMinorUnits(
      senderPaysMinorOf(request.payInAmountMinor, request.feeMinor, request.absorbFee),
      request.payInCurrency,
    ),
    feeAmount: fromMinorUnits(request.feeMinor, request.payInCurrency),
    absorbFee: request.absorbFee,
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
    emailCheckoutUrl: buildEmailCheckoutUrl(request.emailToken || request.token),
    payerName: request.payerName ?? null,
    payerEmailMasked: request.payerEmailMasked ?? null,
    dueDate: request.dueDate ?? null,
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
    const requester = await storage.getAuthUserById(request.requesterId);
    if (requester?.email) {
      await sendLifecycleEmail(
        request, requester.email, `Payment request expired: ${request.requestNumber}`,
        "Your payment request expired without a successful or processing payment.",
        `${request.id}:requester:expired`,
      );
    }
  }
}

async function sweepOnce(): Promise<void> {
  const now = new Date();
  for (const request of await storage.listAllMoneyRequestsRaw()) {
    try {
      if (now.getTime() >= request.expiresAt.getTime()) {
        await materializeExpiry(request);
      }
      // Pending/unknown provider outcomes remain reserved until provider
      // reconciliation supplies a definitive result. Browser/session expiry is
      // never treated as a financial failure.
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

