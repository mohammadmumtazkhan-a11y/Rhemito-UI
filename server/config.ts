/**
 * Server configuration — Request Money.
 *
 * Production-oriented knobs in one place. Values here are development defaults;
 * production must provide real values via environment variables and reviewed
 * configuration. Nothing in this file claims regulatory approval.
 */

/**
 * Prototype demo affordances — seeded demo users, no-login dashboard requester,
 * demo payer, master password, demo credential hints. ON by default (this is a
 * prototype); a hardened production deployment sets RHEMITO_DEMO_MODE=off to
 * disable all of them at once.
 */
export const demoModeEnabled: boolean = process.env.RHEMITO_DEMO_MODE !== "off";

export const serverConfig = {
  /**
   * Trusted public base URL used to build payment links, QR codes and emails.
   * NEVER built from request Origin/Host headers (header injection risk).
   */
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:5000",

  /** Canonical checkout path appended to the base URL. */
  checkoutPath: "/pay/",

  /**
   * HMAC secret for provider webhooks. Dev default only — production must set
   * a strong per-provider secret.
   */
  webhookSecret: process.env.WEBHOOK_SECRET ?? "rhemito-dev-webhook-secret-change-me",

  /** Rhemito fee deducted from the requester's proceeds (3%). */
  feeRate: 0.03,

  /** FX margin included in the rate offered to customers (disclosed). */
  fxMarkup: 0.005,

  /** Default request expiry window. */
  requestExpiryDays: 30,

  /** Maximum number of days an active request expiry can be extended by, once. */
  maxExpiryExtensionDays: 30,

  /**
   * Public endpoint rate limits (per IP). Relaxed in prototype demo mode so
   * the e2e suite and demo testing (all traffic from one IP) don't trip the
   * limiter; hardened mode (RHEMITO_DEMO_MODE=off) keeps strict per-IP values.
   */
  rateLimits: demoModeEnabled
    ? {
        publicLookup: { limit: 300, windowMs: 60_000 },
        paymentIntent: { limit: 100, windowMs: 60_000 },
        reportRequest: { limit: 50, windowMs: 60_000 },
      }
    : {
        publicLookup: { limit: 30, windowMs: 60_000 },
        paymentIntent: { limit: 10, windowMs: 60_000 },
        reportRequest: { limit: 5, windowMs: 60_000 },
      },

  /** Email resend cooldown per request. */
  emailResendCooldownMs: 60_000,

  /**
   * Legal-entity disclosure shown on the public checkout. Placeholder values
   * that MUST be replaced with reviewed legal text before production use.
   */
  legalEntity: {
    displayName: "Rhemito",
    legalName: "[Rhemito legal entity name — pending legal review]",
    registrationNumber: "[pending]",
    safeguardingStatement:
      "[Safeguarding disclosure — pending legal & compliance review. Do not present as regulatory approval in production.]",
    supportUrl: "/support",
  },

  /** Simulated provider timings (development stubs only). */
  devProvider: {
    payoutSettlementDelayMs: 4_000,
  },
};

export function buildCheckoutUrl(token: string): string {
  return `${serverConfig.publicBaseUrl.replace(/\/$/, "")}${serverConfig.checkoutPath}${token}`;
}

export function buildEmailCheckoutUrl(emailToken: string): string {
  return `${serverConfig.publicBaseUrl.replace(/\/$/, "")}/pay/e/${emailToken}`;
}

