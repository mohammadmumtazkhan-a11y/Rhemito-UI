import { describe, it, expect } from "vitest";
import { fromCampaign, fromInvoice } from "@/lib/unifiedTransactions";
import type { CampaignWithSummary } from "@/lib/groupPay";
import type { InvoiceListItem } from "@/lib/invoices";

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

    expect(fromInvoice(invoice).amountLabel).toBe("£500.00 GBP");
  });
});
