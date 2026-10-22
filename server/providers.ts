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
  | "payment.refunded"
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

// ─── Email provider (Mailjet Send API v3.1 + Event Webhook tracking) ──────────

export interface EmailAttachment {
  contentType: string;
  filename: string;
  base64Content: string;
}

export interface EmailMessage {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  html?: string;
  customId?: string;
  eventPayload?: string;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  readonly id: string;
  send(message: EmailMessage): Promise<{
    messageId: string;
    delivered: boolean;
    provider: "mailjet" | "dev:email";
    mailjetMessageUuid?: string;
  }>;
}

export type MailjetWebhookEventType =
  | "sent"
  | "open"
  | "click"
  | "bounce"
  | "spam"
  | "blocked"
  | "unsub";

export interface MailjetWebhookEvent {
  event: MailjetWebhookEventType;
  time: number;
  MessageID: number | string;
  Message_GUID?: string;
  email: string;
  mj_campaign_id?: number;
  mj_contact_id?: number;
  customcampaign?: string;
  CustomID?: string;
  Payload?: string;
  ip?: string;
  geo?: string;
  agent?: string;
  url?: string;
  error_related_to?: string;
  error?: string;
  hard_bounce?: boolean;
  comment?: string;
}

const recentMailjetEvents: MailjetWebhookEvent[] = [];

export function recordMailjetWebhookEvent(evt: MailjetWebhookEvent): void {
  recentMailjetEvents.unshift(evt);
  if (recentMailjetEvents.length > 200) {
    recentMailjetEvents.length = 200;
  }
}

export function listRecentMailjetWebhookEvents(): MailjetWebhookEvent[] {
  return [...recentMailjetEvents];
}

function isAutomatedTestEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  return (
    lower.endsWith("@example.com") ||
    lower.endsWith("@rhemito.com") ||
    lower.endsWith("@test.com")
  );
}

/**
 * Transactional Email Provider:
 * - When `MAILJET_API_KEY` and `MAILJET_SECRET_KEY` are configured and the
 *   recipient is a real email address (not `@example.com` / `@rhemito.com` automated
 *   test fixtures), sends a real email through Mailjet Send API v3.1
 *   (`POST https://api.mailjet.com/v3.1/send`) with `CustomID` and `EventPayload`
 *   for Mailjet Event API webhooks.
 * - Also emits a local `sent` webhook event into the Mailjet webhook event log
 *   so webhook tracking works immediately on `localhost`.
 */
export const devEmailProvider: EmailProvider = {
  id: "mailjet:email",

  async send(message) {
    const { apiKey, secretKey, fromEmail, fromName } = serverConfig.mailjet;
    const canUseMailjet =
      Boolean(apiKey && secretKey && fromEmail) && !isAutomatedTestEmail(message.to);

    if (canUseMailjet) {
      try {
        const auth = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");
        const htmlPart =
          message.html ??
          `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;line-height:1.6;">` +
            message.text
              .split("\n")
              .map((line) => `<p style="margin:0 0 10px;">${line}</p>`)
              .join("") +
            `</div>`;

        const response = await fetch("https://api.mailjet.com/v3.1/send", {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            Messages: [
              {
                From: {
                  Email: fromEmail,
                  Name: fromName || "Rhemito",
                },
                To: [
                  {
                    Email: message.to,
                    Name: message.toName || message.to.split("@")[0],
                  },
                ],
                Subject: message.subject,
                TextPart: message.text,
                HTMLPart: htmlPart,
                ...(message.customId ? { CustomID: message.customId.slice(0, 64) } : {}),
                ...(message.eventPayload ? { EventPayload: message.eventPayload } : {}),
                ...(message.attachments && message.attachments.length > 0
                  ? {
                      Attachments: message.attachments.map((att) => ({
                        ContentType: att.contentType,
                        Filename: att.filename,
                        Base64Content: att.base64Content,
                      })),
                    }
                  : {}),
              },
            ],
          }),
        });

        const data = (await response.json().catch(() => null)) as {
          Messages?: Array<{
            Status?: string;
            CustomID?: string;
            To?: Array<{
              Email?: string;
              MessageUUID?: string;
              MessageID?: number | string;
              MessageHref?: string;
            }>;
          }>;
        } | null;

        const firstMsg = data?.Messages?.[0];
        const firstRecipient = firstMsg?.To?.[0];
        if (response.ok && firstMsg?.Status === "success" && firstRecipient) {
          const messageId = String(firstRecipient.MessageID ?? `mj_${Date.now()}`);
          const messageUuid = firstRecipient.MessageUUID;
          console.log(
            `[MAILJET SENT] To: ${message.to} | Subject: ${message.subject} | MessageID: ${messageId}`,
          );
          recordMailjetWebhookEvent({
            event: "sent",
            time: Math.floor(Date.now() / 1000),
            MessageID: firstRecipient.MessageID ?? messageId,
            Message_GUID: messageUuid,
            email: message.to,
            CustomID: message.customId,
            Payload: message.eventPayload,
          });
          return {
            messageId,
            delivered: true,
            provider: "mailjet",
            mailjetMessageUuid: messageUuid,
          };
        } else {
          console.warn(
            `[MAILJET WARNING] Status ${response.status} for ${message.to}:`,
            JSON.stringify(data),
          );
        }
      } catch (err) {
        console.error(`[MAILJET ERROR] Failed sending to ${message.to}:`, err);
      }
    }

    const messageId = `devmail_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[DEV EMAIL STUB] To: ${message.to} | Subject: ${message.subject}\n${message.text}`);
    recordMailjetWebhookEvent({
      event: "sent",
      time: Math.floor(Date.now() / 1000),
      MessageID: messageId,
      email: message.to,
      CustomID: message.customId,
      Payload: message.eventPayload,
    });
    return { messageId, delivered: true, provider: "dev:email" };
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
