import { describe, expect, it } from "vitest";
import { receiptLines, toSendMoneyRow } from "@/lib/sendMoney";
import type { SendMoneyTransactionView } from "@shared/sendMoney";

const base = {
  id: "t1", reference: "RH-1", recipientName: "Ada", service: "bank_deposit", paymentMethod: "card",
  sendCurrency: "GBP", sendAmount: "100.00", receiveCurrency: "NGN", receiveAmount: "200000.00",
  fee: "2.00", exchangeRate: "2000", promoCode: null, status: "completed",
  createdAt: "2026-10-01T10:00:00Z", paidAt: "2026-10-01T10:05:00Z", cancelledAt: null,
} as unknown as SendMoneyTransactionView;
const val = (v: SendMoneyTransactionView, key: string) => receiptLines(v).find((l) => l.key === key)?.value;

describe("receiptLines", () => {
  it("plain transfer: fee and total, no discount lines", () => {
    const keys = receiptLines(base).map((l) => l.key);
    expect(keys).toEqual(["send", "fee", "total", "receive"]);
    expect(val(base, "total")).toBe("GBP 102.00");
  });
  it("promo: shows fee before discount and takes the discount off", () => {
    const v = { ...base, fee: "0.00", promoCode: "WELCOME", promoDiscount: "2.00" };
    expect(val(v, "fee")).toBe("GBP 2.00");
    expect(val(v, "promo")).toBe("−GBP 2.00");
    expect(val(v, "total")).toBe("GBP 100.00");
  });
  it("pay less bonus reduces the total", () => {
    const v = { ...base, bonusCredit: "5.00", bonusCreditMode: "pay_less" as const };
    expect(val(v, "bonus_pay_less")).toBe("−GBP 5.00");
    expect(val(v, "total")).toBe("GBP 97.00");
  });
  it("send more bonus leaves the total unchanged", () => {
    const v = { ...base, bonusCredit: "5.00", bonusCreditMode: "send_more" as const };
    expect(val(v, "bonus_send_more")).toBe("+GBP 5.00");
    expect(val(v, "total")).toBe("GBP 102.00");
  });
  it("promo and pay-less bonus together never go below zero", () => {
    const v = { ...base, sendAmount: "3.00", fee: "0.00", promoCode: "X", promoDiscount: "2.00", bonusCredit: "9.00", bonusCreditMode: "pay_less" as const };
    expect(val(v, "total")).toBe("GBP 0.00");
  });
  it("only paid transfers carry a receipt", () => {
    expect(toSendMoneyRow(base).receipt).toBeDefined();
    expect(toSendMoneyRow({ ...base, paidAt: null, status: "awaiting_payment" }).receipt).toBeUndefined();
  });
});
