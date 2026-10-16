// @vitest-environment node
/**
 * Unit tests — Request Money core: money maths, corridor validation, webhook
 * signatures and real QR generation/decoding.
 */

import { describe, it, expect } from "vitest";
import {
  toMinorUnits, fromMinorUnits, feeMinorOf, senderPaysMinorOf, netMinorOf, applyFxMarkup, convertMinor, maskAccountNumber, minorUnitFactor,
} from "../../../shared/money";
import { validateCorridor, findCorridor, CORRIDORS } from "../../../server/corridors";
import { signWebhookPayload, verifyWebhookSignature } from "../../../server/providers";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";

describe("money (integer minor units)", () => {
  it("converts decimal amounts to minor units and back", () => {
    expect(toMinorUnits("123.45", "GBP")).toBe(12345);
    expect(toMinorUnits("0.10", "NGN")).toBe(10);
    expect(toMinorUnits("100", "JPY")).toBe(100); // zero-decimal currency
    expect(fromMinorUnits(12345, "GBP")).toBe("123.45");
    expect(fromMinorUnits(100, "JPY")).toBe("100");
  });

  it("rejects amounts that are not exact money", () => {
    expect(() => toMinorUnits("-5", "GBP")).toThrow();
    expect(() => toMinorUnits("1.234", "GBP")).toThrow();
    expect(() => toMinorUnits("abc", "GBP")).toThrow();
  });

  it("keeps the fee consistent: sender pays gross, fee from requester proceeds", () => {
    const gross = toMinorUnits("100.00", "GBP");
    const fee = feeMinorOf(gross, 0.03);
    expect(fee).toBe(300);
    expect(fromMinorUnits(gross - fee, "GBP")).toBe("97.00");
  });

  it("absorbed fee: sender pays the requested amount, fee comes from requester proceeds", () => {
    const requested = toMinorUnits("250.00", "GBP");
    const fee = feeMinorOf(requested, 0.03); // 750
    expect(senderPaysMinorOf(requested, fee, true)).toBe(25000);
    expect(fromMinorUnits(netMinorOf(requested, fee, true), "GBP")).toBe("242.50");
  });

  it("fee passed to sender: sender pays requested + fee, requester receives the full amount", () => {
    const requested = toMinorUnits("250.00", "GBP");
    const fee = feeMinorOf(requested, 0.03); // 750
    expect(fromMinorUnits(senderPaysMinorOf(requested, fee, false), "GBP")).toBe("257.50");
    expect(netMinorOf(requested, fee, false)).toBe(25000);
  });

  it("applies FX markup by reducing the offered rate and rounds converted minor units", () => {
    const offered = applyFxMarkup(2000, 0.005);
    expect(offered).toBeCloseTo(1990, 6);
    expect(convertMinor(9700, offered)).toBe(19303000);
    expect(Number.isInteger(convertMinor(9700, offered))).toBe(true);
  });

  it("masks account numbers for display", () => {
    expect(maskAccountNumber("12312300011")).toBe("****0011");
  });

  it("uses a minor-unit factor of 100 except for zero-decimal currencies", () => {
    expect(minorUnitFactor("GBP")).toBe(100);
    expect(minorUnitFactor("JPY")).toBe(1);
  });
});

describe("corridor validation (server-owned)", () => {
  const gbgb = findCorridor("GB-GB-GBP")!;
  const gbng = findCorridor("GB-NG-GBP-NGN")!;
  const nggb = findCorridor("NG-GB-NGN-GBP")!;

  it("has the development corridors, all enabled including Nigeria→UK (NGN payer, GBP payout)", () => {
    expect(CORRIDORS).toHaveLength(8);
    expect(gbgb.enabled).toBe(true);
    expect(gbng.enabled).toBe(true);
    expect(findCorridor("NG-NG-NGN")!.enabled).toBe(true);
    expect(nggb.enabled).toBe(true);
    expect(nggb.payInCurrency).toBe("NGN");
    expect(nggb.payoutCurrency).toBe("GBP");
  });

  it("accepts a matching enabled corridor within limits", () => {
    expect(
      validateCorridor({
        corridor: gbgb,
        requesterCountry: "GB",
        payoutAccountCountry: "GB",
        payoutAccountCurrency: "GBP",
        amountMinor: 5000,
      }).ok,
    ).toBe(true);
  });

  it("accepts Nigeria→UK for a UK requester with a GBP account", () => {
    expect(
      validateCorridor({ corridor: nggb, requesterCountry: "GB", payoutAccountCountry: "GB", payoutAccountCurrency: "GBP", amountMinor: 50_000 }).ok,
    ).toBe(true);
  });

  it("rejects wrong requester countries, mismatched accounts and out-of-range amounts", () => {
    expect(
      validateCorridor({ corridor: nggb, requesterCountry: "NG", payoutAccountCountry: "GB", payoutAccountCurrency: "GBP", amountMinor: 50_000 }).ok,
    ).toBe(false);
    expect(
      validateCorridor({ corridor: gbng, requesterCountry: "NG", payoutAccountCountry: "GB", payoutAccountCurrency: "GBP", amountMinor: 1000 }).ok,
    ).toBe(false);
    expect(
      validateCorridor({ corridor: gbgb, requesterCountry: "GB", payoutAccountCountry: "GB", payoutAccountCurrency: "GBP", amountMinor: 10 }).ok,
    ).toBe(false);
    expect(
      validateCorridor({ corridor: gbgb, requesterCountry: "GB", payoutAccountCountry: "GB", payoutAccountCurrency: "GBP", amountMinor: 999_999_999 }).ok,
    ).toBe(false);
  });
});

describe("webhook signatures", () => {
  it("verifies a correctly signed payload and rejects tampering or bad signatures", () => {
    const body = Buffer.from(JSON.stringify({ eventId: "e1", type: "payment.succeeded" }));
    const signature = signWebhookPayload(body);
    expect(verifyWebhookSignature(body, signature)).toBe(true);
    expect(verifyWebhookSignature(Buffer.from("tampered"), signature)).toBe(false);
    expect(verifyWebhookSignature(body, "deadbeef")).toBe(false);
    expect(verifyWebhookSignature(body, "")).toBe(false);
  });
});

import {
  getPayerSavedAccounts,
  savePayerBankAccountForEmail,
  markSenderEmailKnown,
  isKnownSenderEmail,
  partiallyMaskSenderAccount,
} from "../../../server/requestService";

describe("QR code generation (real, standards-compliant)", () => {
  it("encodes exactly the canonical checkout URL and no personal data, and decodes back", async () => {
    const url = "http://localhost:5000/pay/abc123def456abc123def456abc123de";
    const pngBuffer = await QRCode.toBuffer(url, { errorCorrectionLevel: "M", margin: 4, width: 256, type: "png" });
    const png = PNG.sync.read(pngBuffer);
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(decoded).not.toBeNull();
    expect(decoded!.data).toBe(url);
    // No PII or bank details are encoded — only the opaque token URL.
    expect(decoded!.data).not.toMatch(/GB\d{2}[A-Z]{4}/i); // no IBAN-like strings
    expect(decoded!.data.split("/").length).toBe(5); // http://host/pay/token
  });
});

describe("Sender / Payer checkout helpers", () => {
  it("partially masks sender account numbers provided by the requester so the sender knows which account to pay from", () => {
    expect(partiallyMaskSenderAccount("3661883153")).toBe("36****3153");
    expect(partiallyMaskSenderAccount("12345678")).toBe("12**5678");
    expect(partiallyMaskSenderAccount("****8558")).toBe("****8558");
  });

  it("returns seeded saved bank accounts partially masked and allows saving a new account", () => {
    const seeded = getPayerSavedAccounts("payer@rhemito.com");
    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded[0].bankName).toBe("Paga Mobile Money");
    expect(seeded[0].accountNumber).toBe("36****3153");

    const customEmail = `sender-${Date.now()}@example.com`;
    const added = savePayerBankAccountForEmail(customEmail, {
      bankName: "Zenith Bank",
      accountNumber: "2089123456",
      accountName: "Ropo Akin",
    });
    expect(added.bankName).toBe("Zenith Bank");
    expect(added.accountNumber).toBe("2089123456");

    const list = getPayerSavedAccounts(customEmail);
    expect(list[0].accountNumber).toBe("2089123456");
    expect(list[0].accountName).toBe("Ropo Akin");
  });

  it("tracks whether a sender email is already known so 'New to Rhemito?' is only shown to new senders", async () => {
    const freshEmail = `brandnew-${Date.now()}@example.com`;
    expect(await isKnownSenderEmail(freshEmail)).toBe(false);
    markSenderEmailKnown(freshEmail);
    expect(await isKnownSenderEmail(freshEmail)).toBe(true);
  });
});


