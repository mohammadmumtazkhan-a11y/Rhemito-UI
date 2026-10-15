// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { MoneyRequest } from "@shared/schema";

// payoutTotalMinor is pure; stub the storage module so importing walletService touches no database.
vi.mock("../../../server/storage", () => ({ storage: {} }));
const { payoutTotalMinor } = await import("../../../server/walletService");

const req = (over: Partial<MoneyRequest>) =>
  ({ payInAmountMinor: 10000, feeMinor: 200, absorbFee: false, payoutAmountMinor: null, promoCode: null, promoBonusMinor: null, ...over }) as MoneyRequest;

describe("payoutTotalMinor", () => {
  it("no promo: the stored net payout", () => {
    expect(payoutTotalMinor(req({ payoutAmountMinor: 9800 }))).toBe(9800);
  });
  it("falls back to net of pay-in when no payout amount is stored", () => {
    expect(payoutTotalMinor(req({}))).toBe(10000);
    expect(payoutTotalMinor(req({ absorbFee: true }))).toBe(9800);
  });
  it("promo: adds the bonus on top of the net payout", () => {
    expect(payoutTotalMinor(req({ payoutAmountMinor: 9800, promoCode: "WELCOME", promoBonusMinor: 500 }))).toBe(10300);
  });
  it("promo with no bonus amount pays the net only", () => {
    expect(payoutTotalMinor(req({ payoutAmountMinor: 9800, promoCode: "WELCOME" }))).toBe(9800);
  });
  it("ignores a stray bonus when there is no promo code", () => {
    expect(payoutTotalMinor(req({ payoutAmountMinor: 9800, promoBonusMinor: 500 }))).toBe(9800);
  });
});
