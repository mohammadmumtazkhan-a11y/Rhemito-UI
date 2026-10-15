import { describe, it, expect } from "vitest";
import { lastSuccessfulPayerAmount, type MoneyRequestView } from "@/lib/requests";

const row = (over: Partial<MoneyRequestView>): MoneyRequestView =>
  ({
    id: "id",
    requestNumber: "RM-1",
    status: "paid_out",
    payInAmount: "5000.00",
    payInCurrency: "NGN",
    createdAt: "2026-10-01T10:00:00.000Z",
    paidOutAt: "2026-10-01T12:00:00.000Z",
    ...over,
  }) as MoneyRequestView;

describe("lastSuccessfulPayerAmount (RM-01)", () => {
  it("returns the payer amount and currency of the latest paid-out request", () => {
    const result = lastSuccessfulPayerAmount([
      row({ id: "a", payInAmount: "1000.00", paidOutAt: "2026-09-01T00:00:00.000Z" }),
      row({ id: "b", payInAmount: "5000.00", paidOutAt: "2026-10-05T00:00:00.000Z" }),
    ]);
    expect(result).toEqual({ amount: "5000.00", currency: "NGN" });
  });

  it("ignores failed, cancelled, pending and expired requests even when newer", () => {
    const result = lastSuccessfulPayerAmount([
      row({ id: "ok", payInAmount: "5000.00", paidOutAt: "2026-10-01T00:00:00.000Z" }),
      row({ id: "f", status: "failed", payInAmount: "9999.00", createdAt: "2026-10-10T00:00:00.000Z", paidOutAt: null }),
      row({ id: "c", status: "cancelled", payInAmount: "8888.00", createdAt: "2026-10-11T00:00:00.000Z", paidOutAt: null }),
      row({ id: "p", status: "active", payInAmount: "7777.00", createdAt: "2026-10-12T00:00:00.000Z", paidOutAt: null }),
    ]);
    expect(result).toEqual({ amount: "5000.00", currency: "NGN" });
  });

  it("returns null when there is no successful history (first-use defaults apply)", () => {
    expect(lastSuccessfulPayerAmount([])).toBeNull();
    expect(lastSuccessfulPayerAmount([row({ status: "failed", paidOutAt: null })])).toBeNull();
  });
});
