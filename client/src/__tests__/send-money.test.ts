import { describe, it, expect } from "vitest";
import { toSendMoneyRow } from "@/lib/sendMoney";
import {
  receivedStatusForMoneyRequest,
  receivedStatusForInvoice,
  receivedStatusForContribution,
} from "@shared/paymentsReceived";

describe("toSendMoneyRow", () => {
  it("maps an API view to the dashboard row shape with 2dp amounts", () => {
    const row = toSendMoneyRow({
      id: "txn-1",
      reference: "TXN-202608-00001",
      recipientName: "Aisha Bello",
      service: "bank_deposit",
      paymentMethod: null,
      sendCurrency: "GBP",
      sendAmount: "120.00",
      receiveCurrency: "NGN",
      receiveAmount: "243060.00",
      fee: "1.20",
      exchangeRate: "2025.50",
      promoCode: null,
      status: "awaiting_payment",
      createdAt: "2026-08-27T10:00:00.000Z",
      paidAt: null,
      cancelledAt: null,
    });

    expect(row).toEqual({
      id: "TXN-202608-00001",
      recipient: "Aisha Bello",
      service: "Bank Deposit",
      date: "27 Aug 2026",
      amount: "GBP 120.00",
      status: "awaiting_payment",
    });
  });

  it("labels every supported service and passes the status through untouched", () => {
    const base = {
      id: "txn-2",
      reference: "TXN-202608-00002",
      recipientName: "Sarah Chen",
      sendCurrency: "GBP",
      sendAmount: "150.00",
      receiveCurrency: "NGN",
      receiveAmount: "303825.00",
      fee: "1.50",
      exchangeRate: "2025.50",
      promoCode: null,
      createdAt: "2026-08-27T10:00:00.000Z",
      paidAt: null,
      cancelledAt: null,
    };
    expect(toSendMoneyRow({ ...base, service: "mobile_money", paymentMethod: null, status: "pending" }).service).toBe("Mobile Money");
    expect(toSendMoneyRow({ ...base, service: "cash_pickup", paymentMethod: null, status: "pending" }).service).toBe("Cash Pickup");
  });
});

describe("received payment status mapping (server-authoritative)", () => {
  it("maps the money-request lifecycle", () => {
    expect(receivedStatusForMoneyRequest("paid_out")).toBe("completed");
    expect(receivedStatusForMoneyRequest("funded")).toBe("completed");
    expect(receivedStatusForMoneyRequest("payout_pending")).toBe("completed");
    expect(receivedStatusForMoneyRequest("active")).toBe("pending");
    expect(receivedStatusForMoneyRequest("viewed")).toBe("pending");
    expect(receivedStatusForMoneyRequest("payment_processing")).toBe("pending");
    expect(receivedStatusForMoneyRequest("failed")).toBe("failed");
    expect(receivedStatusForMoneyRequest("cancelled")).toBe("cancelled");
    expect(receivedStatusForMoneyRequest("expired")).toBeNull();
  });

  it("maps invoice and contribution statuses", () => {
    expect(receivedStatusForInvoice("paid")).toBe("completed");
    expect(receivedStatusForInvoice("payment_processing")).toBe("pending");
    expect(receivedStatusForInvoice("cancelled")).toBe("cancelled");
    expect(receivedStatusForInvoice("sent")).toBeNull();
    expect(receivedStatusForInvoice("overdue")).toBeNull();
    expect(receivedStatusForContribution("completed")).toBe("completed");
    expect(receivedStatusForContribution("pending")).toBe("pending");
    expect(receivedStatusForContribution("failed")).toBeNull();
  });
});
