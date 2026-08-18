/**
 * Unit tests — Send Invoice MVP1 pure domain logic (shared/invoice-logic.ts).
 * Every time-dependent behaviour is pinned to explicit instants.
 */

import { describe, it, expect } from "vitest";
import {
  EXPIRY_TIMEZONE,
  addDays,
  computeExpiry,
  computeInvoiceFees,
  dateInTz,
  defaultExpiryPresetDays,
  deriveInvoiceStatus,
  formatDocumentNumber,
  formatInvoiceNumber,
  isDueReminderEligible,
  isExpiryReminderEligible,
  validateInvoiceDates,
  zonedEndOfDayUTC,
  zonedTimeOnDateUTC,
} from "../../../shared/invoice-logic";
import {
  cancelInvoiceSchema,
  sendInvoiceSchema,
  payInvoiceSchema,
  createMoneyRequestSchema,
} from "../../../shared/schema";

// Fixed instants: 17 Aug 2026 12:00 UTC (BST, UTC+1) and 17 Jan 2026 12:00 UTC (GMT).
const SUMMER_NOW = new Date("2026-08-17T12:00:00.000Z");
const WINTER_NOW = new Date("2026-01-17T12:00:00.000Z");

const baseInvoice = {
  status: "sent" as const,
  dueDate: null,
  expiryTimezone: EXPIRY_TIMEZONE,
  sentAt: new Date("2026-08-01T10:00:00.000Z"),
  dueReminderSentAt: null,
  expiryReminderSentAt: null,
};

describe("computeExpiry", () => {
  it("calculates preset periods from the Due Date when one is provided", () => {
    const result = computeExpiry("2026-09-10", { type: "preset", days: 7 }, SUMMER_NOW);
    expect(result.expiryDate).toBe("2026-09-17");
    expect(result.baseDate).toBe("2026-09-10");
  });

  it("calculates preset periods from the sent date when no Due Date exists", () => {
    const result = computeExpiry(null, { type: "preset", days: 30 }, new Date("2026-09-01T12:00:00.000Z"));
    expect(result.expiryDate).toBe("2026-10-01");
  });

  it("uses the custom date as-is", () => {
    const result = computeExpiry("2026-09-10", { type: "custom", date: "2026-09-30" }, SUMMER_NOW);
    expect(result.expiryDate).toBe("2026-09-30");
  });
});

describe("zonedEndOfDayUTC (expiry is 11:59:59 p.m. local)", () => {
  it("converts to 22:59:59 UTC during British Summer Time", () => {
    expect(zonedEndOfDayUTC("2026-08-27", EXPIRY_TIMEZONE).toISOString()).toBe("2026-08-27T22:59:59.000Z");
  });

  it("converts to 23:59:59 UTC during GMT", () => {
    expect(zonedEndOfDayUTC("2026-01-27", EXPIRY_TIMEZONE).toISOString()).toBe("2026-01-27T23:59:59.000Z");
  });
});

describe("validateInvoiceDates", () => {
  it("rejects a past Due Date with the exact message", () => {
    const { errors } = validateInvoiceDates("2026-08-15", { type: "preset", days: 7 }, SUMMER_NOW);
    expect(errors).toContain("The Due Date cannot be in the past.");
  });

  it("rejects a non-future expiry with the exact message", () => {
    const today = dateInTz(SUMMER_NOW, EXPIRY_TIMEZONE);
    const { errors } = validateInvoiceDates(null, { type: "custom", date: today }, SUMMER_NOW);
    expect(errors).toContain("Select a future Payment Link Expiry Date.");
  });

  it("rejects an expiry earlier than the Due Date with the exact message", () => {
    const { errors } = validateInvoiceDates("2026-09-30", { type: "custom", date: "2026-09-10" }, SUMMER_NOW);
    expect(errors).toContain("The Payment Link Expiry Date cannot be earlier than the Due Date.");
  });

  it("accepts a valid combination and computes the UTC expiry instant", () => {
    const { errors, computation } = validateInvoiceDates("2026-09-10", { type: "preset", days: 7 }, SUMMER_NOW);
    expect(errors).toEqual([]);
    expect(computation.expiryDate).toBe("2026-09-17");
    expect(computation.expiresAt.toISOString()).toBe("2026-09-17T22:59:59.000Z");
  });

  it("accepts today as the Due Date (only past dates are rejected)", () => {
    const today = dateInTz(SUMMER_NOW, EXPIRY_TIMEZONE);
    const { errors } = validateInvoiceDates(today, { type: "preset", days: 7 }, SUMMER_NOW);
    expect(errors).toEqual([]);
  });
});

describe("deriveInvoiceStatus (precedence: Paid > Processing > Cancelled > Expired > Overdue > Sent)", () => {
  const expiresAt = new Date("2026-12-01T22:59:59.000Z");
  const pastExpiry = new Date("2026-01-01T00:00:00.000Z");
  const duePast = "2026-01-02"; // end-of-day 2026-01-02 23:59:59 GMT
  const dueFuture = "2026-12-20";

  it("returns paid for paid invoices regardless of dates", () => {
    expect(deriveInvoiceStatus({ ...baseInvoice, status: "paid", dueDate: duePast, expiresAt: pastExpiry }, WINTER_NOW)).toBe("paid");
  });

  it("returns payment_processing even past expiry — accepted payments are never terminated", () => {
    expect(deriveInvoiceStatus({ ...baseInvoice, status: "payment_processing", expiresAt: pastExpiry }, WINTER_NOW)).toBe("payment_processing");
  });

  it("returns cancelled for cancelled invoices regardless of dates", () => {
    expect(deriveInvoiceStatus({ ...baseInvoice, status: "cancelled", expiresAt: pastExpiry }, WINTER_NOW)).toBe("cancelled");
  });

  it("honours a stored expired status even before the expiry timestamp", () => {
    expect(deriveInvoiceStatus({ ...baseInvoice, status: "expired", expiresAt }, WINTER_NOW)).toBe("expired");
  });

  it("derives expired in real time for unpaid invoices past their expiry timestamp", () => {
    expect(deriveInvoiceStatus({ ...baseInvoice, status: "sent", expiresAt: pastExpiry }, WINTER_NOW)).toBe("expired");
  });

  it("returns overdue when the due date has passed but expiry has not", () => {
    expect(deriveInvoiceStatus({ ...baseInvoice, status: "sent", dueDate: duePast, expiresAt }, new Date("2026-08-17T12:00:00.000Z"))).toBe("overdue");
  });

  it("stays sent on the due date itself (the day has not passed)", () => {
    expect(deriveInvoiceStatus({ ...baseInvoice, status: "sent", dueDate: "2026-01-17", expiresAt }, WINTER_NOW)).toBe("sent");
  });

  it("never becomes overdue without a due date", () => {
    expect(deriveInvoiceStatus({ ...baseInvoice, status: "sent", dueDate: null, expiresAt }, new Date("2026-11-30T12:00:00.000Z"))).toBe("sent");
  });

  it("expiry wins over overdue (precedence)", () => {
    expect(deriveInvoiceStatus({ ...baseInvoice, status: "sent", dueDate: duePast, expiresAt: pastExpiry }, WINTER_NOW)).toBe("expired");
  });
});

describe("reminder eligibility", () => {
  const dueDate = "2026-08-20";
  const nineAmDue = zonedTimeOnDateUTC(dueDate, 9, 0, 0, EXPIRY_TIMEZONE);
  const endOfDueDay = zonedEndOfDayUTC(dueDate, EXPIRY_TIMEZONE);
  const expiresAt = zonedEndOfDayUTC("2026-09-20", EXPIRY_TIMEZONE); // expiry reminder date = 2026-09-17

  it("is due-reminder eligible from 9 a.m. on the due date while active and unpaid", () => {
    const inv = { ...baseInvoice, dueDate, expiresAt };
    expect(isDueReminderEligible(inv, new Date(nineAmDue.getTime() + 1000))).toBe(true);
    expect(isDueReminderEligible(inv, new Date(endOfDueDay.getTime() + 1000))).toBe(false); // day passed
  });

  it("is not due-reminder eligible for processing, paid, cancelled or expired invoices", () => {
    for (const status of ["payment_processing", "paid", "cancelled"]) {
      expect(isDueReminderEligible({ ...baseInvoice, status, dueDate, expiresAt }, nineAmDue)).toBe(false);
    }
    expect(isDueReminderEligible({ ...baseInvoice, status: "sent", dueDate, expiresAt: new Date("2026-08-18T22:59:59.000Z") }, nineAmDue)).toBe(false);
  });

  it("never re-sends a due reminder", () => {
    expect(
      isDueReminderEligible({ ...baseInvoice, dueDate, expiresAt, dueReminderSentAt: new Date() }, nineAmDue),
    ).toBe(false);
  });

  it("is expiry-reminder eligible three calendar days before expiry", () => {
    const inv = { ...baseInvoice, expiresAt }; // sent 1 Aug, reminder date 17 Sep
    const fireAt = zonedTimeOnDateUTC("2026-09-17", 9, 0, 0, EXPIRY_TIMEZONE);
    expect(isExpiryReminderEligible(inv, fireAt)).toBe(true);
    expect(isExpiryReminderEligible(inv, new Date(fireAt.getTime() - 1000))).toBe(false); // too early
  });

  it("skips the expiry reminder when generated fewer than three calendar days before expiry", () => {
    // Expiry 20 Sep → reminder date 17 Sep; sent 18 Sep is within three days → skip.
    const inv = { ...baseInvoice, sentAt: new Date("2026-09-18T10:00:00.000Z"), expiresAt };
    const fireAt = zonedTimeOnDateUTC("2026-09-17", 9, 0, 0, EXPIRY_TIMEZONE);
    expect(isExpiryReminderEligible(inv, fireAt)).toBe(false);
  });

  it("never sends the expiry reminder after expiry", () => {
    const inv = { ...baseInvoice, expiresAt };
    expect(isExpiryReminderEligible(inv, new Date(expiresAt.getTime() + 1000))).toBe(false);
  });
});

describe("fees", () => {
  it("adds the 3% fee to the client when not absorbed", () => {
    expect(computeInvoiceFees("250.00", false)).toEqual({
      invoiceAmount: 250,
      fee: 7.5,
      clientPays: 257.5,
      senderReceives: 250,
    });
  });

  it("absorbs the 3% fee from the sender when absorbed", () => {
    expect(computeInvoiceFees("100.00", true)).toEqual({
      invoiceAmount: 100,
      fee: 3,
      clientPays: 100,
      senderReceives: 97,
    });
  });
});

describe("defaults and formatting", () => {
  it("defaults to 7 days after the due date, 30 days after the sent date", () => {
    expect(defaultExpiryPresetDays("2026-09-10")).toBe(7);
    expect(defaultExpiryPresetDays(null)).toBe(30);
  });

  it("formats invoice numbers as INV-YYYYMM-#####", () => {
    expect(formatInvoiceNumber(1, "2026-08")).toBe("INV-202608-00001");
    expect(formatInvoiceNumber(12345, "2026-08")).toBe("INV-202608-12345");
  });

  it("formats payment request numbers with the PR prefix", () => {
    expect(formatDocumentNumber("PR", 7, "2026-08")).toBe("PR-202608-00007");
  });

  it("adds calendar days across month boundaries", () => {
    expect(addDays("2026-08-30", 7)).toBe("2026-09-06");
  });
});

describe("schema validation", () => {
  const validPayload = {
    documentId: "doc-1",
    invoiceAmount: "250.00",
    currency: "GBP",
    absorbFee: false,
    payoutAccountId: "acc-1",
    clientType: "individual",
    clientFirstName: "Ada",
    clientLastName: "Lovelace",
    clientEmail: "ada@example.com",
    expiry: { type: "preset", days: 7 },
    idempotencyKey: "key-12345678",
  };

  it("accepts a valid payload without a due date (due date is optional)", () => {
    expect(sendInvoiceSchema.safeParse(validPayload).success).toBe(true);
  });

  it("requires a receiving payout account reference (server-owned accounts only)", () => {
    const { payoutAccountId, ...withoutPayout } = validPayload;
    expect(sendInvoiceSchema.safeParse(withoutPayout).success).toBe(false);
    expect(sendInvoiceSchema.safeParse({ ...validPayload, payoutAccountId: "" }).success).toBe(false);
  });

  it("rejects an invalid amount", () => {
    const result = sendInvoiceSchema.safeParse({ ...validPayload, invoiceAmount: "-5" });
    expect(result.success).toBe(false);
  });

  it("requires a first name for individual clients and a business name for business clients", () => {
    expect(sendInvoiceSchema.safeParse({ ...validPayload, clientFirstName: " " }).success).toBe(false);
    expect(
      sendInvoiceSchema.safeParse({ ...validPayload, clientType: "business", clientBusinessName: undefined }).success,
    ).toBe(false);
  });

  it("rejects empty and whitespace-only cancellation reasons", () => {
    expect(cancelInvoiceSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(cancelInvoiceSchema.safeParse({ reason: "   " }).success).toBe(false);
    expect(cancelInvoiceSchema.safeParse({ reason: "Incorrect amount" }).success).toBe(true);
  });

  it("caps the cancellation reason at 500 characters", () => {
    expect(cancelInvoiceSchema.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
    expect(cancelInvoiceSchema.safeParse({ reason: "x".repeat(500) }).success).toBe(true);
  });

  it("accepts only card or bank_transfer payment methods", () => {
    expect(payInvoiceSchema.safeParse({}).success).toBe(true);
    expect(payInvoiceSchema.safeParse({ method: "card" }).success).toBe(true);
    expect(payInvoiceSchema.safeParse({ method: "bank_transfer" }).success).toBe(true);
    expect(payInvoiceSchema.safeParse({ method: "crypto" }).success).toBe(false);
  });

  it("requires a purpose and payout account reference on money requests (cross-border compliance)", () => {
    const base = {
      corridorId: "GB-GB-GBP",
      payoutAccountId: "acc-1",
      payInAmount: "150.00",
      senderType: "individual",
      senderName: "Ada Lovelace",
      senderEmail: "ada@example.com",
      purpose: "invoice_payment",
      idempotencyKey: "key-12345678",
    };
    expect(createMoneyRequestSchema.safeParse(base).success).toBe(true);
    expect(createMoneyRequestSchema.safeParse({ ...base, purpose: undefined }).success).toBe(false);
    expect(createMoneyRequestSchema.safeParse({ ...base, payoutAccountId: "" }).success).toBe(false);
    expect(createMoneyRequestSchema.safeParse({ ...base, payInAmount: "-5" }).success).toBe(false);
  });
});
