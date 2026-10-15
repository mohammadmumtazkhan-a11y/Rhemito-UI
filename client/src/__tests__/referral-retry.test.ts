// @vitest-environment node
/**
 * A referral that Mito cannot take at sign-up (engine asleep or down) is retried in the background,
 * so the friend still gets their referral and bonus.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "http";
import type { AddressInfo } from "net";

let referralReplies: { status: number; body: any }[] = [];
let referralCalls = 0;
let mito: http.Server;
let svc: typeof import("../../../server/rewardsService");
let storage: typeof import("../../../server/storage").storage;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  mito = http.createServer((req, res) => {
    req.on("data", () => {});
    req.on("end", () => {
      const send = (status: number, b: any) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(b)); };
      if (req.url === "/api/referral/referrals" && req.method === "POST") {
        referralCalls += 1;
        const r = referralReplies.shift() ?? { status: 200, body: { data: { status: "REGISTERED", referrer_id: "nobody", reward_type: "BOTH", referrer_reward: 5, currency: "GBP", floor: 50 } } };
        return send(r.status, r.body);
      }
      return send(200, { data: { id: "x", referral_code: "ABC123" } });
    });
  });
  await new Promise<void>((r) => mito.listen(0, r));
  process.env.MITO_API_URL = `http://127.0.0.1:${(mito.address() as AddressInfo).port}`;
  process.env.NODE_ENV = "test";
  process.env.REFERRAL_RETRY_DELAYS_MS = "30,30,30";
  ({ storage } = await import("../../../server/storage"));
  svc = await import("../../../server/rewardsService");
});
afterAll(() => { mito?.close(); });
beforeEach(() => { referralCalls = 0; referralReplies = []; });

async function newUser() {
  return storage.createAuthUser({
    email: `retry${Math.random().toString(36).slice(2, 8)}@example.com`, accountType: "individual", country: "GB",
    firstName: "Mohammad", lastName: "Khan", password: "x", status: "active",
  } as any);
}
const down = { status: 503, body: { error: "DOWN", message: "waking up" } };

describe("referral registration retry", () => {
  it("records the referral on the first try when Mito is up (no retry)", async () => {
    const u = await newUser();
    await svc.onCustomerVerified(u.id, "JOHN7491");
    await wait(150);
    expect(referralCalls).toBe(1);
  });

  it("retries in the background when Mito answers with a server error, then stops once it works", async () => {
    const u = await newUser();
    referralReplies = [down, down]; // third attempt succeeds
    const first = await svc.onCustomerVerified(u.id, "JOHN7491");
    expect(first).toBeNull(); // the sign-up itself is never held up
    await wait(400);
    expect(referralCalls).toBe(3);
  });

  it("gives up after the last delay", async () => {
    const u = await newUser();
    referralReplies = [down, down, down, down, down, down];
    await svc.onCustomerVerified(u.id, "JOHN7491");
    await wait(400);
    expect(referralCalls).toBe(4); // first try + 3 retries
  });

  it("does not retry when Mito refuses the code", async () => {
    const u = await newUser();
    referralReplies = [{ status: 404, body: { error: "INVALID_CODE", message: "no such code" } }];
    await svc.onCustomerVerified(u.id, "NOSUCH1");
    await wait(200);
    expect(referralCalls).toBe(1);
  });

  it("does nothing without a referral code", async () => {
    const u = await newUser();
    await svc.onCustomerVerified(u.id, null);
    await wait(100);
    expect(referralCalls).toBe(0);
  });
});
