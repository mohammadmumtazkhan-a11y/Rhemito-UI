import { describe, it, expect } from "vitest";
import { effectiveFee, formatMoney, isCodeFormatOk, normaliseCode, roundFor, shouldRevalidate, totalToPay } from "@/features/promo/lib/promo";

// PROMO-RHEMITO §7 helpers
describe("promo helpers", () => {
  it("normalises and checks codes", () => {
    expect(normaliseCode("  save20 ")).toBe("SAVE20");
    expect(isCodeFormatOk("save-20")).toBe(true);
    expect(isCodeFormatOk("bad code")).toBe(false);
    expect(isCodeFormatOk("A".repeat(21))).toBe(false);
  });

  it("formats money per currency", () => {
    expect(formatMoney(1.5, "GBP")).toBe("£1.50");
    expect(formatMoney(500, "NGN")).toBe("₦500.00");
    expect(formatMoney(150, "JPY")).toBe("¥150");
    expect(formatMoney(-2, "GBP")).toBe("−£2.00");
    expect(roundFor(1.005, "GBP")).toBe(1.01);
  });

  it("P-44: fee after promo and total never go below 0", () => {
    expect(effectiveFee(3, 1)).toBe(2);
    expect(effectiveFee(1, 5)).toBe(0);
    expect(totalToPay(100, 3, 1)).toBe(102);
    expect(totalToPay(100, 3, 1, 50)).toBe(52);
    expect(totalToPay(1, 0, 0, 10)).toBe(0);
  });

  it("P-41: re-validates only when something that affects the discount changed", () => {
    const base = { amount: 100, fee: 1, sendCurrency: "GBP", receiveCurrency: "NGN", paymentMethod: null };
    expect(shouldRevalidate(null, base)).toBe(false);
    expect(shouldRevalidate(base, { ...base })).toBe(false);
    expect(shouldRevalidate(base, { ...base, amount: 50 })).toBe(true);
    expect(shouldRevalidate(base, { ...base, paymentMethod: "card" })).toBe(true);
    expect(shouldRevalidate(base, { ...base, receiveCurrency: "GHS" })).toBe(true);
  });
});
