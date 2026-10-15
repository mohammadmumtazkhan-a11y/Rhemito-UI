/** Bonus credit feature (BONUS_MODULE_SPEC_RHEMITO.md) — public exports used by the host pages. Imports nothing from referral or promo code. */
export { useBonusSummary, useBonusWallet, type BonusSummary } from "./api";
export { BonusCreditPill } from "./components/BonusCreditPill";
export { BonusBlockedNotice } from "./components/BonusBlockedNotice";
export { BonusBreakdown } from "./components/BonusBreakdown";
export { SourceChip } from "./components/SourceChip";
export { WaysToEarn } from "./components/WaysToEarn";
export { UseBonusCredit, type BonusChoice } from "./components/UseBonusCredit";
export { BONUS_COPY } from "./lib/copy";
export * from "./lib/bonus";
