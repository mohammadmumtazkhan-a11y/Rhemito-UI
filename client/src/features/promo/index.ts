/** Promo code feature (PROMO_MODULE_SPEC_RHEMITO.md) — public exports used by the host pages. */
export { PromoCodeField } from "./PromoCodeField";
export { usePromoCode, type PromoController, type PromoState } from "./usePromoCode";
export { usePromoSavings, type PromoSavings, type PromoSavingItem } from "./usePromoSavings";
export { PROMO_COPY } from "./lib/copy";
export { formatMoney as formatPromoMoney, effectiveFee, totalToPay } from "./lib/promo";
