/**
 * Bonus module — Rhemito side (BONUS_MODULE_SPEC_RHEMITO.md).
 * Bonus credit lives in Mito Money; this module reports transfer status, keeps Mito's customer facts
 * current, uses the bonus at payment and turns Mito's feed into notifications.
 * It imports nothing from referral, promo or rewards code.
 */

export { registerBonusRoutes } from "./routes";
export { applyForPayment, releaseForPayment, onTransferStatus, syncCustomer, bonusOutbox, BonusPaymentError } from "./hooks";
export type { BonusAtPayment, BonusRequest, BonusTransferStatus } from "./hooks";
export { bonusEnabled } from "./client";
export { pollFeed, noteFor } from "./feed";

import { bonusOutbox } from "./hooks";
import { startFeedPoller } from "./feed";

/** Start the background sender and the feed poller (not in tests). */
export function startBonus(): void {
  bonusOutbox.start();
  startFeedPoller();
}
