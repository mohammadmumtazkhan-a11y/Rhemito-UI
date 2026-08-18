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
  senderName: string;
  senderEmail: string;
  payInAmount: string;
  payInCurrency: string;
  feeAmount: string;
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
  expiresAt: string;
  expiryExtendedOnce: boolean;
  failureReason: string | null;
  createdAt: string | null;
  fundedAt: string | null;
  paidOutAt: string | null;
}

export interface PublicRequestView {
  requestNumber: string;
  requesterName: string;
  requesterIdentity: string;
  amount: string;
  currency: string;
  purpose: string;
  reference: string | null;
  expiresAt: string;
  expiryDate: string;
  methods: string[];
  estimatedDeliveryTime: string;
  senderFeeNote: string;
  status: string;
  legalEntity: {
    displayName: string;
    legalName: string;
    registrationNumber: string;
    safeguardingStatement: string;
    supportUrl: string;
  };
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

export function getQuote(corridorId: string, amount: string): Promise<Quote> {
  return getJSON<Quote>(`/api/request-money/quote?corridorId=${encodeURIComponent(corridorId)}&amount=${encodeURIComponent(amount)}`);
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
  qrUrl: string;
}> {
  const res = await apiRequest("POST", "/api/request-money/requests", input);
  const json = (await res.json()) as { data: { request: MoneyRequestView; checkoutUrl: string; qrUrl: string } };
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

export function getPublicRequest(token: string): Promise<PublicRequestView> {
  return getJSON<PublicRequestView>(`/api/public/requests/${encodeURIComponent(token)}`);
}

export async function createIntent(token: string, method: string): Promise<{
  intentId: string;
  authorizationUrl: string;
  requestNumber: string;
}> {
  const res = await fetch(`/api/public/requests/${encodeURIComponent(token)}/intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw Object.assign(new Error(json?.error?.message ?? "The payment could not be started."), { status: res.status });
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

export async function reportRequest(token: string, reason: string): Promise<void> {
  await fetch(`/api/public/requests/${encodeURIComponent(token)}/report`, {
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
