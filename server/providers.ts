/**
 * Provider adapters — Request Money.
 *
 * Real integrations (open banking, card acquirer with 3-D Secure, Nigerian
 * pay-in, bank payout, transactional email, bank-account verification) are
 * external work. What exists here are the production-shaped INTERFACES plus
 * clearly named development stubs ("dev:*"). The stubs use the same webhook
 * processing boundary as a real provider and are disabled outside
 * development/test environments.
 *
 * No adapter claims regulatory approval or a real bank partnership.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { serverConfig } from "./config";

// ─── Pay-in provider ──────────────────────────────────────────────────────────

export interface PayinIntent {
  intentId: string;
  method: string;
  /** Where the sender authorises the payment (provider-hosted in production). */
  authorizationUrl: string;
  provider: string;
}

export interface SignedWebhook {
  rawBody: Buffer;
  signature: string;
}

export type WebhookEventType =
  | "payment.succeeded"
  | "payment.failed"
  | "payment.cancelled"
  | "payment.pending"
  | "payment.unknown"
  | "payout.succeeded"
  | "payout.failed";

export interface PayinWebhookEvent {
  eventId: string;
  type: WebhookEventType;
  intentId: string;
  requestNumber: string;
  amountMinor: number;
  currency: string;
  providerPaymentRef: string;
}

export interface PayinProvider {
  readonly id: string;
  createIntent(params: {
    requestNumber: string;
    amountMinor: number;
    currency: string;
    method: string;
    checkoutUrl: string;
  }): Promise<PayinIntent>;
}

/**
 * DEVELOPMENT STUB (dev:payin). Simulates a provider that authorises via a
 * development-only confirm endpoint and settles through the same signed
 * webhook boundary a real provider uses. Never active in production.
 */
export const devPayinProvider: PayinProvider = {
  id: "dev:payin",

  async createIntent({ requestNumber, amountMinor, currency, method, checkoutUrl }) {
    const intentId = `devpi_${createHmac("sha256", serverConfig.webhookSecret)
      .update(`${requestNumber}:${amountMinor}:${currency}:${Date.now()}`)
      .digest("hex")
      .slice(0, 24)}`;
    return {
      intentId,
      method,
      // Development authorization "page" is the checkout status route with an
      // explicit dev-only confirmation step.
      authorizationUrl: `${checkoutUrl}?intent=${intentId}`,
      provider: this.id,
    };
  },
};

// ─── Payout provider ──────────────────────────────────────────────────────────

export interface PayoutProvider {
  readonly id: string;
  submitPayout(params: {
    requestNumber: string;
    amountMinor: number;
    currency: string;
    maskedAccount: string;
  }): Promise<{ payoutRef: string }>;
}

/** DEVELOPMENT STUB (dev:payout) — simulates bank payout submission. */
export const devPayoutProvider: PayoutProvider = {
  id: "dev:payout",

  async submitPayout({ requestNumber, amountMinor, currency }) {
    return {
      payoutRef: `devpay_${createHmac("sha256", serverConfig.webhookSecret)
        .update(`payout:${requestNumber}:${amountMinor}:${currency}`)
        .digest("hex")
        .slice(0, 20)}`,
    };
  },
};

// ─── Webhook signing/verification (same boundary for dev and production) ─────

export function signWebhookPayload(rawBody: Buffer, secret = serverConfig.webhookSecret): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string, secret = serverConfig.webhookSecret): boolean {
  const expected = signWebhookPayload(rawBody, secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature ?? "", "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Build a signed development webhook body (test/dev tooling only). */
export function buildSignedDevWebhook(event: PayinWebhookEvent): { rawBody: Buffer; signature: string } {
  const rawBody = Buffer.from(JSON.stringify(event), "utf8");
  return { rawBody, signature: signWebhookPayload(rawBody) };
}

// ─── Email provider ───────────────────────────────────────────────────────────

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailProvider {
  readonly id: string;
  send(message: EmailMessage): Promise<{ messageId: string; delivered: boolean }>;
}

/** DEVELOPMENT STUB (dev:email) — logs delivery; no real email is sent. */
export const devEmailProvider: EmailProvider = {
  id: "dev:email",

  async send(message) {
    const messageId = `devmail_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[DEV EMAIL STUB] To: ${message.to} | Subject: ${message.subject}\n${message.text}`);
    return { messageId, delivered: true };
  },
};

// ─── Bank-account verification provider ───────────────────────────────────────

export interface BankVerificationProvider {
  readonly id: string;
  /**
   * Verifies the account belongs to the named holder. Production uses a real
   * verification service (e.g. open-banking confirmation of payee); the dev
   * stub returns pending and is completed via a clearly labelled dev hook.
   */
  requestVerification(params: {
    holderName: string;
    country: string;
    accountNumber: string;
    routingNumber?: string;
  }): Promise<{ status: "pending" | "verified" | "failed"; reference: string }>;
}

/** DEVELOPMENT STUB (dev:bank-verification). */
export const devBankVerificationProvider: BankVerificationProvider = {
  id: "dev:bank-verification",

  async requestVerification() {
    return { status: "pending", reference: `devver_${Date.now().toString(36)}` };
  },
};
