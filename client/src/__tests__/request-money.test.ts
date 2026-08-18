/**
 * Unit tests — Request Money core: money maths, corridor validation, webhook
 * signatures and real QR generation/decoding.
 */

import { describe, it, expect } from "vitest";
import {
  toMinorUnits, fromMinorUnits, feeMinorOf, applyFxMarkup, convertMinor, maskAccountNumber, minorUnitFactor,
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

  it("has the four development corridors with Nigeria→UK disabled by default", () => {
    expect(CORRIDORS).toHaveLength(8);
    expect(gbgb.enabled).toBe(true);
    expect(gbng.enabled).toBe(true);
    expect(findCorridor("NG-NG-NGN")!.enabled).toBe(true);
    expect(nggb.enabled).toBe(false);
    expect(nggb.unavailabilityReason).toBeTruthy();
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

  it("rejects disabled corridors, mismatched accounts and out-of-range amounts", () => {
    expect(
      validateCorridor({ corridor: nggb, requesterCountry: "GB", payoutAccountCountry: "GB", payoutAccountCurrency: "GBP", amountMinor: 1000 }).ok,
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
