// @vitest-environment node
/**
 * FURP staging affiliate rates client against a stub FURP service.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "http";
import type { AddressInfo } from "net";

let server: http.Server;
let logins = 0;
let rateCalls = 0;
let validToken = "tok-1";
let ratesStatus = 200;
let lastAuth = "";
let lastApiKey = "";
let lastLoginBody: any = null;
let lastRatesUrl = "";

const ROWS = [
  { rateId: "1", fromCurrency: "GBP", toCurrency: "NGN", fromCountry: "All", toCountry: "All", rateMoneyTransfer: 1831.01, partnerRateMoneyTransfer: 1831.01, rateExpiry: null, rateDirection: "BUY" },
  { rateId: "2", fromCurrency: "NGN", toCurrency: "GBP", fromCountry: "All", toCountry: "All", rateMoneyTransfer: 1887, partnerRateMoneyTransfer: 1887, rateExpiry: null, rateDirection: "SELL" },
  { rateId: "3", fromCurrency: "USD", toCurrency: "UGX", fromCountry: "All", toCountry: "All", rateMoneyTransfer: 3649, partnerRateMoneyTransfer: 3649, rateExpiry: null, rateDirection: "SELL" },
];

let mod: typeof import("../../../server/stagingRates");
let fx: typeof import("../../../server/fxService");

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/Auth/login" && req.method === "POST") {
        logins += 1;
        lastApiKey = String(req.headers["apikey"] ?? "");
        lastLoginBody = JSON.parse(raw || "{}");
        validToken = `tok-${logins}`;
        res.end(JSON.stringify({ data: { token: validToken, expiresOn: new Date(Date.now() + 3600_000).toISOString() }, code: 200 }));
        return;
      }
      if ((req.url ?? "").split("?")[0] === "/Exchange/affiliateRates") {
        rateCalls += 1;
        lastRatesUrl = req.url ?? "";
        lastAuth = String(req.headers.authorization ?? "");
        if (ratesStatus !== 200) {
          res.statusCode = ratesStatus;
          res.end("{}");
          return;
        }
        if (lastAuth !== `Bearer ${validToken}`) {
          res.statusCode = 401;
          res.end("{}");
          return;
        }
        res.end(JSON.stringify({ data: ROWS, code: 200 }));
        return;
      }
      res.statusCode = 404;
      res.end("{}");
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as AddressInfo).port;
  process.env.FURP_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.FURP_API_KEY = "key-123";
  process.env.FURP_USERNAME = "user";
  process.env.FURP_PASSWORD = "pass";
  process.env.FURP_SERVICE_NO = "21060";
  process.env.FURP_AFFILIATE_ID = "1112";
  process.env.FURP_USER_ID = "41844246-bfc9-44a6-b611-d2345a16c276";
  mod = await import("../../../server/stagingRates");
  fx = await import("../../../server/fxService");
});

afterAll(async () => {
  for (const k of ["FURP_BASE_URL", "FURP_API_KEY", "FURP_USERNAME", "FURP_PASSWORD", "FURP_SERVICE_NO", "FURP_AFFILIATE_ID", "FURP_USER_ID"]) delete process.env[k];
  await new Promise((r) => server.close(r));
});

beforeEach(() => {
  logins = 0;
  rateCalls = 0;
  ratesStatus = 200;
  mod._resetStagingRates();
});

describe("staging affiliate rates", () => {
  it("logs in with the affiliate credentials and API key header", async () => {
    await mod.getAffiliateRates();
    expect(logins).toBe(1);
    expect(lastApiKey).toBe("key-123");
    expect(lastLoginBody).toEqual({ username: "user", password: "pass", accessServiceNumber: "21060", accessAffiliateNumber: "1112" });
    expect(lastAuth).toBe("Bearer tok-1");
  });

  it("sends the configured user id as the userId query parameter", async () => {
    await mod.getAffiliateRates();
    expect(lastRatesUrl).toBe("/Exchange/affiliateRates?userId=41844246-bfc9-44a6-b611-d2345a16c276");
  });

  it("BUY rows multiply, SELL rows divide", async () => {
    expect(await mod.getStagingFxRate("GBP", "NGN")).toBeCloseTo(1831.01, 6);
    expect(await mod.getStagingFxRate("NGN", "GBP")).toBeCloseTo(1 / 1887, 10);
    expect(await mod.getStagingFxRate("USD", "UGX")).toBeCloseTo(1 / 3649, 10);
  });

  it("inverts the opposite row when only that one is configured", async () => {
    // UGX→USD has no row; inverse of USD→UGX (SELL ⇒ forward 1/3649)
    expect(await mod.getStagingFxRate("UGX", "USD")).toBeCloseTo(3649, 6);
  });

  it("returns 1 for the same currency and null for unknown pairs", async () => {
    expect(await mod.getStagingFxRate("GBP", "GBP")).toBe(1);
    expect(await mod.getStagingFxRate("GBP", "JPY")).toBeNull();
  });

  it("reuses the token and caches rates between calls", async () => {
    await mod.getStagingFxRate("GBP", "NGN");
    await mod.getStagingFxRate("NGN", "GBP");
    expect(logins).toBe(1);
    expect(rateCalls).toBe(1);
  });

  it("logs in again when the token is rejected (401)", async () => {
    await mod.getAffiliateRates();
    expect(logins).toBe(1);
    // The service rotates its token: our cached bearer now gets a 401
    validToken = "rotated-by-server";
    mod._resetStagingRates(true); // keep our (now stale) token, drop cached rates
    const rates = await mod.getAffiliateRates();
    expect(rates.length).toBe(3);
    expect(logins).toBe(2);
  });

  it("getFxRate prefers the staging rate", async () => {
    expect(await fx.getFxRate("GBP", "NGN")).toBeCloseTo(1831.01, 6);
  });

  it("getFxRate falls back to another source when staging is down", async () => {
    ratesStatus = 500;
    const rate = await fx.getFxRate("GBP", "NGN");
    expect(Number.isFinite(rate)).toBe(true);
    expect(rate).toBeGreaterThan(0);
    expect(rate).not.toBeCloseTo(1831.01, 6);
  });
});
