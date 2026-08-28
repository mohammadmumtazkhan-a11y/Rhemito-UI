import { describe, it, expect } from "vitest";
import {
  fromCampaign,
  fromInvoice,
  fromMoneyRequest,
  invoiceActionable,
  moneyRequestAwaiting,
  moneyRequestLinkShareable,
} from "@/lib/unifiedTransactions";
import type { CampaignWithSummary } from "@/lib/groupPay";
import type { InvoiceListItem } from "@/lib/invoices";
import type { MoneyRequestView } from "@/lib/requests";

/** Rhemito rule: displayed money never carries more than 2 decimal places. */
describe("unified transaction amount formatting", () => {
  it("fromCampaign rounds the stored fee-inclusive target to 2dp", () => {
    const campaign = {
      id: "809ea151007e9b2e6de4ee",
      name: "Test Office Party",
      targetAmount: 102.87179487179488,
      currency: "GBP",
      description: "End to end test description",
      bankAccountId: "acc-1",
      bankAccountName: "Barclays",
      status: "active",
      createdAt: new Date("2026-08-27T10:00:00Z"),
      uniqueLink: "http://localhost/contribute/809ea151007e9b2e6de4ee",
      creatorName: "Rita Money",
      summary: { totalRaised: 51.43589743589744, contributorCount: 1 },
    } as CampaignWithSummary;

    const row = fromCampaign(campaign);
    expect(row.amountLabel).toBe("£102.87 GBP");
    expect(row.subNote).toBe("50% raised · 1 contributor");
  });

  it("fromInvoice renders the invoice amount at 2dp", () => {
    const invoice = {
      invoiceNumber: "INV-202608-00001",
      clientName: "Acme Ltd",
      clientEmail: "acme@example.com",
      currency: "GBP",
      fees: { invoiceAmount: 500, fee: 15, clientPays: 515, senderReceives: 500 },
      sentAt: "2026-08-27T10:00:00.000Z",
      status: "sent",
      id: "inv-1",
    } as InvoiceListItem;

    const row = fromInvoice(invoice);
    expect(row.amountLabel).toBe("£500.00 GBP");
    // The row keeps the raw record (row actions) and its detail-page href.
    expect(row.invoice).toBe(invoice);
    expect(row.viewHref).toBe("/sent-invoices/inv-1");
  });

  it("fromMoneyRequest keeps the raw request and no longer links to the removed page", () => {
    const request = {
      id: "req-1",
      requestNumber: "RM-202608-00001",
      status: "active",
      senderName: "Ngozi Okafor",
      senderEmail: "ngozi.okafor@example.com",
      payInAmount: "300.00",
      payInCurrency: "GBP",
      senderPaysAmount: "309.30",
      feeAmount: "9.30",
      absorbFee: true,
      payoutAmount: "300.00",
      payoutCurrency: "GBP",
      createdAt: "2026-08-27T10:00:00.000Z",
    } as MoneyRequestView;

    const row = fromMoneyRequest(request);
    expect(row.amountLabel).toBe("£300.00 GBP");
    expect(row.moneyRequest).toBe(request);
    // /payment-requests was consolidated into the transactions table — View
    // opens the details dialog, so there is no navigation href.
    expect(row.viewHref).toBe("");
  });

  it("money-request action rules mirror the removed Money Requests page", () => {
    expect(moneyRequestAwaiting("active")).toBe(true);
    expect(moneyRequestAwaiting("viewed")).toBe(true);
    expect(moneyRequestAwaiting("funded")).toBe(false);
    expect(moneyRequestLinkShareable("failed")).toBe(true);
    expect(moneyRequestLinkShareable("paid_out")).toBe(false);
    expect(moneyRequestLinkShareable("cancelled")).toBe(false);
  });

  it("invoice action rules allow resend/cancel only while awaiting payment", () => {
    expect(invoiceActionable("sent")).toBe(true);
    expect(invoiceActionable("overdue")).toBe(true);
    expect(invoiceActionable("paid")).toBe(false);
    expect(invoiceActionable("expired")).toBe(false);
  });
});
