/**
 * Kept for compatibility: the promo client now lives in server/promo/ (PROMO-RHEMITO §12).
 */
export { validatePromo, redeemPromo } from "./promo/client";
export type { PromoRequest, MitoResult as MitoPromoResult } from "./promo/client";
