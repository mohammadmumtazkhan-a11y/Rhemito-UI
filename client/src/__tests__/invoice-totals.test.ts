/**
 * Unit tests — invoice generation ("generate on the go"):
 * - computeInvoiceTotals (shared/invoice-logic.ts): the authoritative totals
 *   math reused by the builder, the server and both invoice views.
 * - sendInvoiceSchema (shared/schema.ts): the generate/upload modes are
 *   mutually exclusive — items XOR document — and the legacy upload contract
 *   still validates unchanged.
 */

import { describe, it, expect } from "vitest";
import { computeInvoiceTotals } from "../../../shared/invoice-logic";
import { sendInvoiceSchema } from "../../../shared/schema";

describe("computeInvoiceTotals", () => {
  it("sums per-line amounts (quantity × unit price) into the subtotal", () => {
    const totals = computeInvoiceTotals({
      items: [
        { quantity: 2, unitAmount: 150 },
        { quantity: 1, unitAmount: 95.5 },
      ],
    });
    expect(totals.subtotal).toBe(395.5);
    expect(totals.discountAmount).toBe(0);
    expect(totals.taxAmount).toBe(0);
    expect(totals.total).toBe(395.5);
  });

  it("rounds each line amount to two decimals before summing", () => {
    const totals = computeInvoiceTotals({
      items: [
        { quantity: 0.5, unitAmount: 0.03 }, // 0.015 → 0.02 per line
        { quantity: 0.5, unitAmount: 0.03 },
      ],
    });
    expect(totals.subtotal).toBe(0.04);
  });

  it("applies a percentage discount to the subtotal", () => {
    const totals = computeInvoiceTotals({
      items: [{ quantity: 1, unitAmount: 400 }],
      discountType: "percent",
      discountValue: "5",
    });
    expect(totals.discountAmount).toBe(20);
    expect(totals.total).toBe(380);
  });

  it("caps a fixed discount at the subtotal", () => {
    const totals = computeInvoiceTotals({
      items: [{ quantity: 1, unitAmount: 50 }],
      discountType: "fixed",
      discountValue: "75",
    });
    expect(totals.discountAmount).toBe(50);
    expect(totals.total).toBe(0);
  });

  it("taxes the discounted base, not the gross subtotal", () => {
    const totals = computeInvoiceTotals({
      items: [{ quantity: 1, unitAmount: 395.5 }],
      discountType: "percent",
      discountValue: "10",
      taxRate: "20",
    });
    // base 355.95 → tax 71.19 → total 427.14
    expect(totals.discountAmount).toBe(39.55);
    expect(totals.taxAmount).toBe(71.19);
    expect(totals.total).toBe(427.14);
  });

  it("accepts the stored invoice shape (string columns, null items)", () => {
    expect(computeInvoiceTotals({ items: null, taxRate: null, discountType: null, discountValue: null }).total).toBe(0);
    const totals = computeInvoiceTotals({
      items: [
        { quantity: "2", unitAmount: "150.00" },
        { quantity: "1", unitAmount: "95.50" },
      ],
      taxRate: "20",
      discountType: "percent",
      discountValue: "10",
    });
    expect(totals.subtotal).toBe(395.5);
    expect(totals.total).toBe(427.14);
  });

  it("treats invalid numeric input as zero instead of NaN", () => {
    const totals = computeInvoiceTotals({
      items: [{ quantity: "not-a-number", unitAmount: 10 }],
    });
    expect(totals.subtotal).toBe(0);
    expect(totals.total).toBe(0);
  });

  it("applies a per-item percentage discount to its own line", () => {
    const totals = computeInvoiceTotals({
      items: [
        { quantity: 2, unitAmount: 150 },
        { quantity: 1, unitAmount: 100, discountType: "percent", discountValue: 10 },
      ],
    });
    expect(totals.subtotal).toBe(400); // gross subtotal
    expect(totals.itemsDiscountTotal).toBe(10); // 10% of the £100 line
    expect(totals.total).toBe(390);
  });

  it("caps a per-item fixed discount at the line amount", () => {
    const totals = computeInvoiceTotals({
      items: [{ quantity: 1, unitAmount: 50, discountType: "fixed", discountValue: 80 }],
    });
    expect(totals.itemsDiscountTotal).toBe(50);
    expect(totals.total).toBe(0);
  });

  it("stacks item discounts before the invoice-level discount and tax", () => {
    const totals = computeInvoiceTotals({
      items: [{ quantity: 1, unitAmount: 400, discountType: "fixed", discountValue: 50 }],
      discountType: "percent",
      discountValue: 10,
      taxRate: "20",
    });
    // item discount 50 → base 350; invoice discount 10% = 35; tax 20% of 315 = 63
    expect(totals.subtotal).toBe(400);
    expect(totals.itemsDiscountTotal).toBe(50);
    expect(totals.discountAmount).toBe(35);
    expect(totals.taxAmount).toBe(63);
    expect(totals.total).toBe(378);
  });

  it("keeps the legacy behaviour when no item discounts exist", () => {
    const totals = computeInvoiceTotals({
      items: [{ quantity: 1, unitAmount: 395.5 }],
      discountType: "percent",
      discountValue: "10",
      taxRate: "20",
    });
    expect(totals.itemsDiscountTotal).toBe(0);
    expect(totals.discountAmount).toBe(39.55);
    expect(totals.total).toBe(427.14);
  });
});

describe("sendInvoiceSchema — generate vs upload exclusivity", () => {
  const base = {
    currency: "GBP",
    absorbFee: false,
    payoutAccountId: "acc_1",
    clientType: "individual",
    clientFirstName: "Ada",
    clientEmail: "ada@example.com",
    expiry: { type: "preset", days: 7 },
    idempotencyKey: "e2e-idempotency-key",
  };

  it("accepts the legacy upload payload (document + manual amount) unchanged", () => {
    const parsed = sendInvoiceSchema.safeParse({
      ...base,
      documentId: "doc_1",
      invoiceAmount: "150.00",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.documentId).toBe("doc_1");
      expect(parsed.data.invoiceAmount).toBe("150.00");
      expect(parsed.data.items).toBeUndefined();
    }
  });

  it("accepts a generated payload with items, discount, tax and notes", () => {
    const parsed = sendInvoiceSchema.safeParse({
      ...base,
      source: "generated",
      items: [
        { name: "Consulting", description: "Sessions", quantity: 2, unitAmount: 150 },
        { name: "Design", quantity: 1, unitAmount: 95.5 },
      ],
      discountType: "percent",
      discountValue: 10,
      taxRate: 20,
      notes: "Thanks!",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a generated payload that also carries a document", () => {
    const parsed = sendInvoiceSchema.safeParse({
      ...base,
      source: "generated",
      documentId: "doc_1",
      items: [{ name: "Consulting", quantity: 1, unitAmount: 10 }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message.includes("cannot include an attached document"))).toBe(true);
    }
  });

  it("rejects a generated payload without items", () => {
    const parsed = sendInvoiceSchema.safeParse({
      ...base,
      source: "generated",
      items: [],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message.includes("Add at least one invoice item"))).toBe(true);
    }
  });

  it("rejects an upload payload without a document", () => {
    const parsed = sendInvoiceSchema.safeParse({
      ...base,
      invoiceAmount: "150.00",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message.includes("An invoice document must be attached"))).toBe(true);
    }
  });

  it("rejects an upload payload that carries generated items", () => {
    const parsed = sendInvoiceSchema.safeParse({
      ...base,
      documentId: "doc_1",
      invoiceAmount: "150.00",
      items: [{ name: "Consulting", quantity: 1, unitAmount: 150 }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message.includes("cannot include generated items"))).toBe(true);
    }
  });

  it("rejects items with invalid quantities, unit prices or names", () => {
    const cases = [
      { name: "", quantity: 1, unitAmount: 10 }, // empty name
      { name: "X", quantity: 0, unitAmount: 10 }, // zero quantity
      { name: "X", quantity: -1, unitAmount: 10 }, // negative quantity
      { name: "X", quantity: 1.234, unitAmount: 10 }, // 3-decimal quantity
      { name: "X", quantity: 1, unitAmount: 0 }, // zero unit price
      { name: "X", quantity: 1, unitAmount: 10.999 }, // 3-decimal unit price
    ];
    for (const item of cases) {
      const parsed = sendInvoiceSchema.safeParse({
        ...base,
        source: "generated",
        items: [item],
      });
      expect(parsed.success, `expected item to be rejected: ${JSON.stringify(item)}`).toBe(false);
    }
  });

  it("rejects discount and tax values out of range", () => {
    const percentTooHigh = sendInvoiceSchema.safeParse({
      ...base,
      source: "generated",
      items: [{ name: "X", quantity: 1, unitAmount: 100 }],
      discountType: "percent",
      discountValue: 150,
    });
    expect(percentTooHigh.success).toBe(false);

    const taxTooHigh = sendInvoiceSchema.safeParse({
      ...base,
      source: "generated",
      items: [{ name: "X", quantity: 1, unitAmount: 100 }],
      taxRate: 120,
    });
    expect(taxTooHigh.success).toBe(false);

    const discountWithoutType = sendInvoiceSchema.safeParse({
      ...base,
      source: "generated",
      items: [{ name: "X", quantity: 1, unitAmount: 100 }],
      discountValue: 10,
    });
    expect(discountWithoutType.success).toBe(false);
  });

  it("rejects a generated invoice whose total is zero (100% discount, no tax)", () => {
    const parsed = sendInvoiceSchema.safeParse({
      ...base,
      source: "generated",
      items: [{ name: "X", quantity: 1, unitAmount: 100 }],
      discountType: "percent",
      discountValue: 100,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message.includes("total must be greater than zero"))).toBe(true);
    }
  });

  it("accepts items with a valid per-item discount", () => {
    const parsed = sendInvoiceSchema.safeParse({
      ...base,
      source: "generated",
      items: [
        { name: "Consulting", quantity: 1, unitAmount: 400, discountType: "fixed", discountValue: 50 },
        { name: "Design", quantity: 1, unitAmount: 100, discountType: "percent", discountValue: 10 },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects per-item discounts that are incomplete or out of range", () => {
    const cases = [
      { name: "X", quantity: 1, unitAmount: 100, discountType: "percent" }, // type without value
      { name: "X", quantity: 1, unitAmount: 100, discountValue: 10 }, // value without type
      { name: "X", quantity: 1, unitAmount: 100, discountType: "percent", discountValue: 150 }, // percent > 100
      { name: "X", quantity: 1, unitAmount: 100, discountType: "fixed", discountValue: 10.999 }, // 3 decimals
    ];
    for (const item of cases) {
      const parsed = sendInvoiceSchema.safeParse({
        ...base,
        source: "generated",
        items: [item],
      });
      expect(parsed.success, `expected item to be rejected: ${JSON.stringify(item)}`).toBe(false);
    }
  });
});
