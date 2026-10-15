/**
 * Promo code module — Rhemito side (PROMO_MODULE_SPEC_RHEMITO.md).
 * Promo codes live in Mito Money; this module forwards checks, records uses at payment,
 * reports transfer status changes and keeps Mito's customer facts current.
 * It imports nothing from rewards/referral/bonus code.
 */

export { registerPromoRoutes } from "./routes";
export { applyForPayment, releaseForPayment, onTransferStatus, syncCustomer, promoOutbox, PromoPaymentError } from "./hooks";
export type { PromoAtPayment, PromoTransferStatus } from "./hooks";
export { promoEnabled, validatePromo, redeemPromo } from "./client";

import { promoOutbox } from "./hooks";

/** Start the background sender (not in tests). */
export function startPromo(): void {
  promoOutbox.start();
}
