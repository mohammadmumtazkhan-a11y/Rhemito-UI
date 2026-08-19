/**
 * Request Money API client.
 */

import { apiRequest } from "@/lib/queryClient";
import type { PaymentPurpose } from "@shared/schema";

export interface Eligibility {
  authenticated: true;
  accountStatus: string;
  kycStatus: string;
  country: string;
  eligible: boolean;
  reasons: string[];
}

export interface Corridor {
  id: string;
  senderCountry: string;
  requesterCountry: string;
  payInCurrency: string;
  payoutCurrency: string;
  methods: string[];
  minAmountMinor: number;
  maxAmountMinor: number;
  estimatedDeliveryTime: string;
  enabled: boolean;
  unavailabilityReason: string | null;
  devOnly: boolean;
}

export interface PayoutAccountView {
  id: string;
  holderName: string;
  country: string;
  bankName: string;
  maskedNumber: string;
  currency: string;
  verificationStatus: string;
  isDefault: boolean;
}

export interface Quote {
  feeMinor: number;
  senderPaysMinor: number;
  payoutAmountMinor: number | null;
  fxRate: number | null;
  fxRateIsIndicative: boolean;
  fxMarkupApplied: number;
  feeRate: number;
  fxMarkup: number;
  indicative: true;
}

export interface MoneyRequestView {
  id: string;
  requestNumber: string;
  status: string;
  failureReason?: string | null;
  senderName: string;
  senderEmail: string;
  payInAmount: string;
  payInCurrency: string;
  senderPaysAmount: string;
  feeAmount: string | null;
  absorbFee: boolean;
  payoutAmount: string | null;
  payoutCurrency: string;
  fxRate: number | null;
  fxRateIsIndicative: boolean;
  fxMarkupApplied: number | null;
  payoutAccount: { bankName: string; maskedNumber: string; holderName: string; country: string };
  purpose: string;
  reference: string | null;
  corridorId: string;
  paymentMethod: string | null;
  checkoutUrl: string;
  emailCheckoutUrl?: string;
  payerName?: string | null;
  payerEmailMasked?: string | null;
  expiresAt: string;
  expiryExtendedOnce: boolean;
  failureReason: string | null;
  createdAt: string | null;
  fundedAt: string | null;
  paidOutAt: string | null;
}

export interface PublicRequestView {
  requestNumber: string | null;
  requesterName: string;
  requesterIdentity: string;
  /** Total charged to the sender: requested amount, plus the fee when the requester does not absorb it. */
  amount: string;
  requestedAmount: string;
  feeAmount: string;
  currency: string;
  payoutCurrency?: string | null;
  absorbFee?: boolean | null;
  purpose: string | null;
  reference: string | null;
  expiresAt: string;
  expiryDate: string;
  methods: string[];
  estimatedDeliveryTime: string;
  senderFeeNote: string;
  status: string;
  isEmailLink?: boolean;
  recipientEmailMasked?: string;
  activeSessionId?: string | null;
  sessionExpiresAt?: string | null;
  isReservedByOther?: boolean;
  legalEntity: {
    displayName: string;
    legalName: string;
    registrationNumber: string;
    safeguardingStatement: string;
    supportUrl: string;
  };
  /** Prototype-only: the sender email the requester provided (registered demo payer). */
  demoPayerEmail?: string;
}

export interface CreateRequestInput {
  corridorId: string;
  payoutAccountId: string;
  payInAmount: string;
  senderType: "individual" | "business";
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  purpose: PaymentPurpose;
  reference?: string;
  /** Default true — requester absorbs the 3% fee. */
  absorbFee?: boolean;
  idempotencyKey: string;
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw Object.assign(new Error(json?.error?.message ?? "Request failed"), { status: res.status });
  }
  return json.data as T;
}

export const getEligibility = () => getJSON<Eligibility>("/api/request-money/eligibility");
export const getCorridors = () => getJSON<Corridor[]>("/api/request-money/corridors");
export const getPayoutAccounts = () => getJSON<PayoutAccountView[]>("/api/request-money/payout-accounts");

export function getQuote(corridorId: string, amount: string, absorbFee = true): Promise<Quote> {
  return getJSON<Quote>(
    `/api/request-money/quote?corridorId=${encodeURIComponent(corridorId)}&amount=${encodeURIComponent(amount)}&absorbFee=${absorbFee}`,
  );
}

export async function addPayoutAccount(input: {
  holderName: string;
  country: string;
  bankName: string;
  accountNumber: string;
  routingNumber?: string;
  currency: string;
}): Promise<PayoutAccountView> {
  const res = await apiRequest("POST", "/api/request-money/payout-accounts", input);
  const json = (await res.json()) as { data: PayoutAccountView };
  return json.data;
}

/** Development-only hook that completes the stub bank verification. */
export async function devVerifyPayoutAccount(id: string): Promise<void> {
  await apiRequest("POST", `/api/dev/payout-accounts/${id}/verify`, {});
}

export async function createRequest(input: CreateRequestInput): Promise<{
  request: MoneyRequestView;
  checkoutUrl: string;
  emailCheckoutUrl?: string;
  qrUrl: string;
}> {
  const res = await apiRequest("POST", "/api/request-money/requests", input);
  const json = (await res.json()) as { data: { request: MoneyRequestView; checkoutUrl: string; emailCheckoutUrl?: string; qrUrl: string } };
  return json.data;
}

export const getRequests = () => getJSON<MoneyRequestView[]>("/api/request-money/requests");

export async function cancelRequest(id: string): Promise<void> {
  await apiRequest("POST", `/api/request-money/requests/${id}/cancel`, {});
}

export async function rotateToken(id: string): Promise<{ token: string; checkoutUrl: string }> {
  const res = await apiRequest("POST", `/api/request-money/requests/${id}/rotate-token`, {});
  return ((await res.json()) as { data: { token: string; checkoutUrl: string } }).data;
}

export async function extendExpiry(id: string): Promise<string> {
  const res = await apiRequest("POST", `/api/request-money/requests/${id}/extend-expiry`, {});
  return ((await res.json()) as { data: { expiresAt: string } }).data.expiresAt;
}

export async function resendEmail(id: string): Promise<void> {
  await apiRequest("POST", `/api/request-money/requests/${id}/resend-email`, {});
}

// ─── Public checkout APIs ─────────────────────────────────────────────────────

export function getPublicRequest(token: string, isEmailLink = false): Promise<PublicRequestView> {
  const prefix = isEmailLink ? "/api/public/requests/e/" : "/api/public/requests/";
  return getJSON<PublicRequestView>(`${prefix}${encodeURIComponent(token)}`);
}

export async function startPayerSession(params: {
  token: string;
  isEmailLink?: boolean;
}): Promise<{
  sessionId: string;
  sessionExpiresAt: string;
  quote: Quote;
  payerName: string;
  payerEmail: string;
}> {
  const { token, isEmailLink = false } = params;
  const prefix = isEmailLink ? "/api/public/requests/e/" : "/api/public/requests/";
  const res = await fetch(`${prefix}${encodeURIComponent(token)}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({}),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw Object.assign(new Error(json?.error?.message ?? "Session could not be started."), {
      status: res.status,
      code: json?.error?.code,
    });
  }
  return json.data;
}

/** Check whether an email already belongs to a Rhemito account (identifier-first auth). */
export async function checkEmailRegistered(email: string): Promise<{ registered: boolean; status: string | null }> {
  const res = await fetch("/api/auth/check-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(json?.message ?? "Could not check this email address."), { status: res.status });
  return { registered: !!json?.registered, status: json?.status ?? null };
}

export async function sendPayerVerificationPin(token: string, email: string, isEmailLink = false): Promise<{
  sent: boolean;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  devPin?: string;
}> {
  const res = await fetch("/api/public/request-verifications/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token, email, isEmailLink }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(json?.error?.message ?? "The PIN could not be sent."), { code: json?.error?.code, status: res.status });
  return json.data;
}

export async function verifyPayerVerificationPin(token: string, email: string, code: string, isEmailLink = false): Promise<void> {
  const res = await fetch("/api/public/request-verifications/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token, email, code, isEmailLink }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(json?.error?.message ?? "The PIN could not be verified."), { code: json?.error?.code, status: res.status });
}

export async function createIntent(token: string, method: string, sessionId: string, isEmailLink = false): Promise<{
  intentId: string;
  authorizationUrl: string;
  paymentReference: string;
  requestNumber: string;
}> {
  const prefix = isEmailLink ? "/api/public/requests/e/" : "/api/public/requests/";
  const res = await fetch(`${prefix}${encodeURIComponent(token)}/pay-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ method, sessionId }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw Object.assign(new Error(json?.error?.message ?? "The payment could not be started."), {
      status: res.status,
      code: json?.error?.code,
    });
  }
  return json.data;
}

export async function requestNewLink(token: string, isEmailLink = false, payerEmail?: string): Promise<{ success: boolean; message: string }> {
  const prefix = isEmailLink ? "/api/public/requests/e/" : "/api/public/requests/";
  const res = await fetch(`${prefix}${encodeURIComponent(token)}/request-new-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ payerEmail }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw Object.assign(new Error(json?.error?.message ?? "Failed to request a new payment link."), {
      status: res.status,
      code: json?.error?.code,
    });
  }
  return json.data;
}

/** Development provider simulation: completes authorisation via the signed webhook boundary. */
export async function devAuthorizeIntent(intentId: string): Promise<void> {
  const res = await fetch(`/api/dev/payin/${encodeURIComponent(intentId)}/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Authorisation simulation failed.");
  }
}

export async function reportRequest(token: string, reason: string, isEmailLink = false): Promise<void> {
  const prefix = isEmailLink ? "/api/public/requests/e/" : "/api/public/requests/";
  await fetch(`${prefix}${encodeURIComponent(token)}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export const METHOD_LABELS: Record<string, string> = {
  pay_by_bank: "Pay by Bank (open banking)",
  card: "Card (3-D Secure)",
  bank_transfer: "Local bank transfer",
  wallet: "Rhemito wallet",
};
