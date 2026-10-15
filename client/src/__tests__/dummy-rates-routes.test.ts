// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFxRate, staticFxRate } from "../../../server/fxService";
import { corridorsForRequester, findCorridor, validateCorridor } from "../../../server/corridors";

describe("dummy rates", () => {
  it("covers every common currency pair, including the ones missing from the direct table", () => {
    const codes = ["GBP", "USD", "EUR", "NGN", "KES", "GHS", "ZAR", "EGP", "TZS", "UGX", "XOF", "RWF"];
    for (const a of codes) {
      for (const b of codes) {
        const r = staticFxRate(a, b);
        expect(r, `${a}→${b}`).toBeGreaterThan(0);
      }
    }
  });

  it("uses the direct table entry when there is one and crosses through GBP otherwise", () => {
    expect(staticFxRate("ZAR", "GBP")).toBe(0.043);
    expect(staticFxRate("EGP", "GBP")).toBeCloseTo(1 / 62, 6);
    expect(staticFxRate("EGP", "TZS")).toBeCloseTo(3350 / 62, 4);
  });

  it("never invents a rate for an unknown currency", () => {
    expect(staticFxRate("XYZ", "GBP")).toBeUndefined();
  });

  describe("when the providers are down", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("getFxRate falls back to a dummy rate instead of failing", async () => {
      expect(await getFxRate("ZAR", "GBP")).toBe(0.043);
      expect(await getFxRate("RWF", "EGP")).toBeGreaterThan(0);
    });

    it("still fails loudly for a currency it has no dummy rate for", async () => {
      await expect(getFxRate("XYZ", "GBP")).rejects.toMatchObject({ code: "FX_UNAVAILABLE" });
    });
  });
});

describe("demo cross-currency routes", () => {
  it("lets a GBP requester receive from a ZAR payer", () => {
    const list = corridorsForRequester("GB");
    const route = list.find((c) => c.payInCurrency === "ZAR" && c.payoutCurrency === "GBP");
    expect(route?.enabled).toBe(true);
    expect(route?.demoCatchAll).toBe(true);
    expect(findCorridor(route!.id)?.id).toBe(route!.id);
  });

  it("accepts a verified account in the payout currency and rejects a different one", () => {
    const route = findCorridor("DEMO-GB-ZAR-GBP")!;
    const base = { corridor: route, requesterCountry: "GB", payoutAccountCountry: "GB", amountMinor: 10_000 };
    expect(validateCorridor({ ...base, payoutAccountCurrency: "GBP" }).ok).toBe(true);
    expect(validateCorridor({ ...base, payoutAccountCurrency: "USD" }).ok).toBe(false);
  });

  it("never overrides a reviewed corridor — NGN to GBP is the reviewed, enabled route", () => {
    const list = corridorsForRequester("GB");
    const ngnGbp = list.filter((c) => c.payInCurrency === "NGN" && c.payoutCurrency === "GBP");
    expect(ngnGbp).toHaveLength(1);
    expect(ngnGbp[0].id).toBe("NG-GB-NGN-GBP");
    expect(ngnGbp[0].enabled).toBe(true);
    expect(findCorridor("DEMO-GB-NGN-GBP")).toBeUndefined();
  });

  it("does not duplicate reviewed enabled routes", () => {
    const list = corridorsForRequester("NG");
    expect(list.filter((c) => c.payInCurrency === "GBP" && c.payoutCurrency === "NGN")).toHaveLength(1);
  });

  it("gives every route a unique id", () => {
    const ids = corridorsForRequester("GB").map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
