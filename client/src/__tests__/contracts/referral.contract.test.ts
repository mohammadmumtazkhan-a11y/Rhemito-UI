/**
 * Referral contracts (REF-*). The referral rules, referrals and rewards live in Mito; Rhemito captures the code
 * from a /ref/:code link, records the referral when the new customer verifies their email, reports transfers, and
 * shows the Refer & Earn card. Self-referral and eligibility are decided by Mito, not by Rhemito.
 */
import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, vi } from "vitest";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import express from "express";
import type { AddressInfo } from "net";
import { Route, Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { bootContractApp, resetContractApp, routeBrowserFetchTo, wait, type ContractApp } from "./_mitoStub";
import { rule, source } from "./_contract";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }), toast }));
// server/auth.ts imports `log` from server/index.ts, which would boot the whole app on import
vi.mock("../../../../server/index", () => ({ log: () => {} }));

import ReferralLanding from "@/pages/ReferralLanding";
import { ReferEarnCard } from "@/components/rewards/ReferEarnCard";
import { REFERRAL_CODE_RE, clearReferral, loadReferral, saveReferral, type MyReferral, type RewardOffer } from "@/lib/rewards";
import { userInitials, welcomeName } from "@/lib/userDisplay";

let ctx: ContractApp;
let restoreFetch: () => void;
let authBase = "";
let authServer: import("http").Server;
const session: Record<string, any> = {};

beforeAll(async () => {
  ctx = await bootContractApp();
  restoreFetch = routeBrowserFetchTo(ctx.base);
  const { registerAuthRoutes } = await import("../../../../server/auth");
  const e = express();
  e.use(express.json());
  e.use((req, _res, next) => { (req as any).session = session; next(); });
  registerAuthRoutes(e);
  authServer = e.listen(0, "127.0.0.1");
  await new Promise((r) => authServer.once("listening", r));
  authBase = `http://127.0.0.1:${(authServer.address() as AddressInfo).port}`;
});
afterAll(async () => { restoreFetch(); authServer.close(); await ctx.close(); });
beforeEach(async () => {
  await resetContractApp(ctx);
  toast.mockClear();
  try { localStorage.clear(); } catch { /* ignore */ }
  for (const k of Object.keys(session)) delete session[k];
});
afterEach(() => { vi.restoreAllMocks(); delete process.env.REFERRAL_RETRY_DELAYS_MS; });

const referralCalls = (userId?: string) => ctx.stub.to("/api/referral/referrals").filter((c) => !userId || c.body?.referee?.id === userId);
async function newUser() {
  return ctx.storage.createAuthUser({
    email: `ref${Math.random().toString(36).slice(2, 8)}@example.com`, accountType: "individual", country: "GB",
    firstName: "Mohammad", lastName: "Khan", password: "x", status: "active",
  } as any);
}
async function authApi(path: string, body: unknown) {
  const res = await fetch(`${authBase}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const OFFER: RewardOffer = {
  rule_id: 1, currency: "GBP", reward_type: "BOTH", referrer_reward: 5, referee_reward: 10, floor: 50, qualification_window_days: 30,
  bonus_validity_days: 90, min_redeem_amount: 0,
  text: "Invite friends with your link. You get £5.00 and your friend gets £10.00 in bonus credit when they send £50.00 or more within 30 days of joining.",
  referral_code: "JOHN2880", referral_link: "http://localhost:5000/ref/JOHN2880", cap_reached: false,
};
const FRIENDS: MyReferral[] = ["Musa I.", "Kemi L.", "Sarah S."].map((friend, i) => ({
  id: `R${i}`, friend, joined_on: "2026-09-20T10:00:00Z", status: i === 2 ? "REWARDED" : "REGISTERED", status_label: "x", currency: "GBP", floor: 50, qualification_deadline: "2027-01-01", reward: 5, credited: i === 2 ? 5 : 0,
}));
const card = (over: Record<string, unknown> = {}) => render(React.createElement(ReferEarnCard, {
  offer: OFFER, referrals: FRIENDS, summary: { joined: 3, earned_count: 1, total_earned: { GBP: 5 } }, isLoading: false, isError: false, onRetry: () => {}, ...over,
} as any));

describe("Capturing the referral code", () => {
  async function openLanding(code: string) {
    const { hook, history } = memoryLocation({ path: `/ref/${code}`, record: true });
    const view = render(React.createElement(Router, { hook }, React.createElement(Route, { path: "/ref/:code", component: ReferralLanding })));
    await waitFor(() => expect(history.some((p) => p.includes("/sign-in-sign-up"))).toBe(true), { timeout: 3000 });
    return { view, history };
  }

  rule("REF-01", "A /ref/:code link is validated with Mito, the visit is counted, the code is remembered in the browser and sign-up opens", {
    why: "The referral is only credited if the new customer's code survives from the link click to email verification, possibly across pages and sessions.",
    fix: "pages/ReferralLanding.tsx: GET /api/rewards/codes/:code -> saveReferral({ code, referrerFirstName, offer }) (localStorage 'rhemito.referral'), POST /api/rewards/visits with the visitor id, then navigate to /sign-in-sign-up?mode=signup. Codes must match REFERRAL_CODE_RE (6-12 letters/digits).",
    where: ["client/src/pages/ReferralLanding.tsx", "client/src/lib/rewards.ts", "server/rewardsRoutes.ts"],
    timeout: 10_000,
  }, async () => {
    expect(REFERRAL_CODE_RE.test("JOHN2880")).toBe(true);
    expect(REFERRAL_CODE_RE.test("AB-12")).toBe(false);
    ctx.stub.on("/api/referral/codes/JOHN2880", { status: 200, body: { code: "JOHN2880", referrer_first_name: "John", offer: OFFER } });
    const { view, history } = await openLanding("john2880");
    const stored = JSON.parse(localStorage.getItem("rhemito.referral")!);
    expect(stored).toMatchObject({ code: "JOHN2880", referrerFirstName: "John" });
    expect(history[history.length - 1]).toContain("/sign-in-sign-up?mode=signup");
    await waitFor(() => expect(ctx.stub.to("/api/referral/visits")).toHaveLength(1));
    expect(ctx.stub.to("/api/referral/visits")[0].body).toMatchObject({ code: "JOHN2880" });
    view.unmount();
  });

  rule("REF-02", "A malformed or refused referral link does not keep a code: sign-up still opens with a friendly message", {
    why: "A bad link must never block sign-up, and a code Mito says is invalid must not be sent on registration.",
    fix: "ReferralLanding: format check first (clearReferral + toast \"This referral link isn't valid\" + open sign-up); a non-OK answer from /api/rewards/codes also clears the stored code and shows the toast (a different title when the referrer is inactive).",
    where: ["client/src/pages/ReferralLanding.tsx"],
    timeout: 10_000,
  }, async () => {
    saveReferral({ code: "OLDCODE1" });
    const bad = await openLanding("AB-12");
    expect(localStorage.getItem("rhemito.referral")).toBeNull();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "This referral link isn't valid" }));
    bad.view.unmount();

    toast.mockClear();
    ctx.stub.on("/api/referral/codes/NOSUCH12", { status: 404, body: { error: "INVALID_CODE", message: "No such code" } });
    const refused = await openLanding("NOSUCH12");
    expect(localStorage.getItem("rhemito.referral")).toBeNull();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "This referral link isn't valid" }));
    refused.view.unmount();
  });

  rule("REF-03", "Referral links are for new customers only: a signed-in visitor is told so and nothing is stored", {
    why: "An existing customer opening a friend's link cannot be referred; storing the code could attach it to a later business sign-up.",
    fix: "ReferralLanding: when body.data.signedIn is true, toast 'Referral links are for new customers only', go to '/', and do not call saveReferral. (/api/rewards/codes/:code sets signedIn from the session.)",
    where: ["client/src/pages/ReferralLanding.tsx", "server/rewardsRoutes.ts"],
  }, async () => {
    const real = globalThis.fetch;
    globalThis.fetch = ((u: any, init?: any) => String(u).includes("/api/rewards/codes/")
      ? Promise.resolve(new Response(JSON.stringify({ data: { code: "JOHN2880", signedIn: true } }), { status: 200, headers: { "Content-Type": "application/json" } }))
      : real(u, init)) as typeof fetch;
    try {
      const { hook, history } = memoryLocation({ path: "/ref/JOHN2880", record: true });
      const view = render(React.createElement(Router, { hook }, React.createElement(Route, { path: "/ref/:code", component: ReferralLanding })));
      await waitFor(() => expect(history[history.length - 1]).toBe("/"), { timeout: 3000 });
      expect(toast).toHaveBeenCalledWith({ title: "Referral links are for new customers only" });
      expect(localStorage.getItem("rhemito.referral")).toBeNull();
      view.unmount();
    } finally {
      globalThis.fetch = real;
    }
    expect(source("server/rewardsRoutes.ts")).toMatch(/signedIn: Boolean\(req\.session\?\.userId\)/);
  });

  rule("REF-04", "The captured code is kept for 30 days, then dropped", {
    why: "The invitation should still count if the friend signs up within a month, but stale codes must not attach to unrelated sign-ups later.",
    fix: "lib/rewards.ts: saveReferral stores { code, referrerFirstName, offer, savedAt } under 'rhemito.referral'; loadReferral returns null (and removes it) when older than REF_TTL_MS = 30 days.",
    where: ["client/src/lib/rewards.ts"],
  }, () => {
    const t0 = Date.UTC(2026, 9, 1);
    saveReferral({ code: "JOHN2880", referrerFirstName: "John" }, t0);
    expect(loadReferral(t0 + 29 * 86_400_000)?.code).toBe("JOHN2880");
    expect(loadReferral(t0 + 31 * 86_400_000)).toBeNull();
    expect(localStorage.getItem("rhemito.referral")).toBeNull();
    saveReferral({ code: "JOHN2880" });
    clearReferral();
    expect(loadReferral()).toBeNull();
  });
});

describe("Recording the referral", () => {
  rule("REF-05", "The code travels with the registration, but the referral is recorded at EMAIL VERIFICATION (not at registration), and the browser forgets the code afterwards", {
    why: "A referral must only exist for a real, verified customer; sign-ups with unverified emails must not create referrals or notify the referrer.",
    fix: "Browser: SignUpForm / BusinessStep2 send referralCode from the stored referral; OtpStep calls clearReferral() after verify-otp succeeds. Server (server/auth.ts): register validates the code format, holds it in pendingReferralCodes by email, and POST /api/auth/verify-otp calls onCustomerVerified(user.id, pendingCode).",
    where: ["server/auth.ts", "client/src/pages/Auth/components/SignUpForm.tsx", "client/src/pages/Auth/components/BusinessStep2.tsx", "client/src/pages/Auth/components/OtpStep.tsx", "server/rewardsService.ts"],
    timeout: 15_000,
  }, async () => {
    expect(source("client/src/pages/Auth/components/SignUpForm.tsx")).toContain("referralCode: referral?.code");
    expect(source("client/src/pages/Auth/components/BusinessStep2.tsx")).toContain("referralCode: loadReferral()?.code");
    expect(source("client/src/pages/Auth/components/OtpStep.tsx")).toMatch(/onSuccess:[\s\S]*clearReferral\(\)/);

    const email = `friend${Math.random().toString(36).slice(2, 8)}@example.com`;
    const bad = await authApi("/api/auth/register", { email: "x@example.com", password: "Passw0rd!x", confirmPassword: "Passw0rd!x", referralCode: "AB-12" });
    expect(bad.status).toBe(400);

    const reg = await authApi("/api/auth/register", { email, accountType: "individual", country: "GB", firstName: "Fatima", lastName: "Ali", password: "Passw0rd!xx", confirmPassword: "Passw0rd!xx", referralCode: "john2880" });
    expect(reg.status).toBe(200);
    await wait(150);
    expect(referralCalls()).toHaveLength(0); // not recorded at registration

    const verified = await authApi("/api/auth/verify-otp", { email, code: "123456" });
    expect(verified.status).toBe(200);
    await waitFor(() => expect(referralCalls()).toHaveLength(1), { timeout: 3000 });
    const user = await ctx.storage.getAuthUserByEmail(email);
    expect(referralCalls()[0].body).toEqual({ code: "JOHN2880", referee: { id: user!.id, send_currency: "GBP" } });
  });

  rule("REF-06", "On verification the customer is synced to Mito FIRST, then the referral is recorded with the code and the friend's send currency; no code means sync only", {
    why: "Mito must know the friend (country, currency, device) before it can create and judge the referral.",
    fix: "rewardsService.onCustomerVerified: await syncCustomer(userId) (POST /api/referral/customers) then recordReferral (POST /api/referral/referrals { code, referee: { id, send_currency } }); returns null and never throws.",
    where: ["server/rewardsService.ts"],
  }, async () => {
    const u = await newUser();
    await ctx.rewards.onCustomerVerified(u.id, "JOHN2880");
    const order = ctx.stub.calls.map((c) => c.path.split("?")[0]).filter((p) => p.startsWith("/api/referral/"));
    expect(order).toEqual(["/api/referral/customers", "/api/referral/referrals"]);
    expect(ctx.stub.to("/api/referral/customers")[0].body).toMatchObject({ id: u.id, email: u.email, country: "GB", send_currency: "GBP" });
    expect(referralCalls()[0].body).toEqual({ code: "JOHN2880", referee: { id: u.id, send_currency: "GBP" } });

    ctx.stub.reset();
    expect(await ctx.rewards.onCustomerVerified(u.id, null)).toBeNull();
    expect(referralCalls()).toHaveLength(0);
    expect(ctx.stub.to("/api/referral/customers")).toHaveLength(1);
  });

  rule("REF-07", "A temporary Mito failure (5xx or unreachable) is retried in the background with the delays 10 s, 30 s, 2 min, 5 min, 15 min; a refusal (4xx) is not retried", {
    why: "Mito may be asleep or restarting at the moment a friend verifies. Retrying later keeps the referral; retrying a refusal (bad code, self-referral) would never succeed.",
    fix: "rewardsService.ts: referralRetryDelays() defaults to REFERRAL_RETRY_DELAYS_MS ?? '10000,30000,120000,300000,900000'; isTemporary(err) = RewardsError with status >= 500 (the unreachable case is a 503); scheduleReferralRetry re-syncs the customer and records again, and gives up after the last delay.",
    where: ["server/rewardsService.ts"],
    timeout: 10_000,
  }, async () => {
    expect(source("server/rewardsService.ts")).toContain('process.env.REFERRAL_RETRY_DELAYS_MS ?? "10000,30000,120000,300000,900000"');
    process.env.REFERRAL_RETRY_DELAYS_MS = "30,30,30";

    // 500 twice, then success: three attempts in total, sign-up itself returns immediately
    const u = await newUser();
    const replies = [{ status: 500, body: { error: "BOOM" } }, { status: 503, body: { error: "DOWN" } }];
    ctx.stub.on("/api/referral/referrals", () => replies.shift() ?? { status: 200, body: { data: { status: "REGISTERED", referrer_id: "nobody", reward_type: "BOTH", referrer_reward: 5, currency: "GBP", floor: 50 } } });
    expect(await ctx.rewards.onCustomerVerified(u.id, "JOHN2880")).toBeNull();
    await wait(400);
    expect(referralCalls(u.id)).toHaveLength(3);
    expect(ctx.stub.to("/api/referral/customers").filter((c) => c.body.id === u.id).length).toBeGreaterThanOrEqual(3); // re-synced before each retry

    // always failing: first try + 3 retries, then it gives up
    ctx.stub.reset();
    const v = await newUser();
    ctx.stub.on("/api/referral/referrals", { status: 503, body: { error: "DOWN" } });
    await ctx.rewards.onCustomerVerified(v.id, "JOHN2880");
    await wait(400);
    expect(referralCalls(v.id)).toHaveLength(4);

    // a refusal is final
    ctx.stub.reset();
    const w = await newUser();
    ctx.stub.on("/api/referral/referrals", { status: 404, body: { error: "INVALID_CODE", message: "no such code" } });
    await ctx.rewards.onCustomerVerified(w.id, "NOSUCH12");
    await wait(200);
    expect(referralCalls(w.id)).toHaveLength(1);
  });

  rule("REF-08", "NEGATIVE (fixed bug): referral recording survives Mito being completely down when the friend verifies", {
    why: "Mito (on a free host) was asleep when friends verified their email; the referral was lost and the referrer never got their reward. The unreachable case must be treated as temporary and retried.",
    fix: "mito() in rewardsService.ts turns a network failure into RewardsError(503, 'REWARDS_UNAVAILABLE'); onCustomerVerified catches it and, because isTemporary() is true, calls scheduleReferralRetry. Do not rethrow, and do not treat 503 as final.",
    where: ["server/rewardsService.ts"],
    timeout: 10_000,
  }, async () => {
    process.env.REFERRAL_RETRY_DELAYS_MS = "50,50,50,50";
    const u = await newUser();
    ctx.stub.on(/^\/api\/referral\//, "drop"); // connection dies: Mito unreachable
    const first = await ctx.rewards.onCustomerVerified(u.id, "JOHN2880");
    expect(first).toBeNull(); // verification itself is not held up or failed
    ctx.stub.reset(); // Mito wakes up
    await waitFor(() => expect(referralCalls(u.id).length).toBeGreaterThanOrEqual(1), { timeout: 3000 });
    expect(referralCalls(u.id)[0].body.code).toBe("JOHN2880");
  });

  rule("REF-09", "Self-referral is NOT decided by Rhemito: whatever Mito answers is passed on, a refusal ends quietly, and Rhemito sends the facts Mito needs (device id when known)", {
    why: "Eligibility (self-referral, duplicate accounts, caps) is a Mito business rule. Duplicating it in Rhemito would let the two disagree.",
    fix: "rewardsService.onCustomerVerified forwards the code and never compares referrer and referee itself. A 4xx from Mito (e.g. 409 SELF_REFERRAL) is logged, returns null and is not retried. syncCustomer sends device_id (hashed, from deviceForUser) only when known.",
    where: ["server/rewardsService.ts", "server/deviceId.ts"],
  }, async () => {
    const u = await newUser();
    ctx.stub.on("/api/referral/referrals", { status: 409, body: { error: "SELF_REFERRAL", message: "You can't refer yourself." } });
    expect(await ctx.rewards.onCustomerVerified(u.id, "JOHN2880")).toBeNull();
    expect(referralCalls(u.id)).toHaveLength(1);
    const text = source("server/rewardsService.ts");
    expect(text).not.toMatch(/referrer_id\s*===\s*(userId|referee)|self.?referral/i);
    expect(text).toContain("device_id: deviceForUser(user.id) ?? undefined");
  });

  rule("REF-10", "Transfer events are reported to Mito's referral engine with the corridor, and a Mito failure never breaks the transfer", {
    why: "The referral reward is released by the friend's first qualifying transfer; Mito also needs the receive currency because rules can be tied to a corridor.",
    fix: "rewardsService.onTransferEvent posts { transfer_id, customer_id, amount, currency, receive_currency, status, created_at } to /api/referral/transfer-events after syncing the customer, and catches every error.",
    where: ["server/rewardsService.ts", "server/sendMoneyRoutes.ts"],
  }, async () => {
    const u = await newUser();
    const tx = { reference: "TXN-1", sendAmount: 100, sendCurrency: "GBP", receiveCurrency: "NGN", createdAt: new Date("2026-10-01T10:00:00Z") };
    await ctx.rewards.onTransferEvent(u.id, tx, "COMPLETED");
    expect(ctx.stub.to("/api/referral/transfer-events")[0].body).toEqual({
      transfer_id: "TXN-1", customer_id: u.id, amount: 100, currency: "GBP", receive_currency: "NGN", status: "COMPLETED", created_at: "2026-10-01T10:00:00.000Z",
    });
    ctx.stub.on(/^\/api\/referral\//, "drop");
    await expect(ctx.rewards.onTransferEvent(u.id, tx, "COMPLETED")).resolves.toBeUndefined();
  });

  rule("REF-11", "The referral link is built from Rhemito's own public URL: <publicBaseUrl>/ref/<CODE>, whatever link Mito sends", {
    why: "Links must work in every environment (local, staging, production). Mito does not know Rhemito's address.",
    fix: "server/rewardsRoutes.ts GET /api/rewards/summary overwrites offer.referral_link with `${serverConfig.publicBaseUrl without trailing slash}/ref/${offer.referral_code}`. The Refer card shows it without the http(s):// prefix.",
    where: ["server/rewardsRoutes.ts", "server/config.ts", "client/src/components/rewards/ReferEarnCard.tsx"],
  }, async () => {
    const { serverConfig } = await import("../../../../server/config");
    ctx.stub.on(/^\/api\/referral\/offer\?/, { status: 200, body: { offer: { ...OFFER, referral_link: "https://mito.example/wrong" } } });
    const r = await ctx.api("GET", "/api/rewards/summary");
    expect(r.status).toBe(200);
    expect(r.body.data.offer.referral_link).toBe(`${serverConfig.publicBaseUrl.replace(/\/+$/, "")}/ref/JOHN2880`);
    expect(r.body.data.referrals.summary).toEqual({ joined: 0, earned_count: 0, total_earned: {} });

    const view = card({ offer: { ...OFFER, referral_link: "https://app.rhemito.com/ref/JOHN2880" } });
    expect((view.getByLabelText("Your referral link") as HTMLInputElement).value).toBe("app.rhemito.com/ref/JOHN2880");
    view.unmount();
  });

  rule("REF-12", "Friends are shown by first name + last initial only ('Sarah S.')", {
    why: "Privacy: the referrer sees who joined without learning the friend's full name.",
    fix: "rewardsService.maskName(first, last) -> `${first || 'Your friend'} ${lastInitial}.` and Mito's referrals list uses the same style.",
    where: ["server/rewardsService.ts"],
  }, () => {
    expect(ctx.rewards.maskName("Sarah", "Smith")).toBe("Sarah S.");
    expect(ctx.rewards.maskName("Sarah", null)).toBe("Sarah");
    expect(ctx.rewards.maskName(null, "Smith")).toBe("Your friend S.");
  });
});

describe("Refer & Earn card", () => {
  rule("REF-13", "The card shows the friends-joined count and total bonus earned, plus a 'View all referrals' link; it NEVER lists individual friends", {
    why: "The Dashboard card must stay the same height however many friends join, and friends' names belong on the Referrals tab of Bonus & Discounts, not on the Dashboard.",
    fix: "components/rewards/ReferEarnCard.tsx renders only totals from `summary` (joined, earned_count, total_earned) and a Link to /bonus-discounts?tab=referrals. Do not map over `referrals` to render rows here.",
    where: ["client/src/components/rewards/ReferEarnCard.tsx", "client/src/pages/BonusAndDiscounts.tsx"],
  }, () => {
    const view = card();
    expect(view.getByTestId("refer-count").textContent).toBe("3");
    expect(view.getByTestId("refer-earned").textContent).toBe("£5.00");
    expect(view.getByTestId("refer-waiting").textContent).toBe("2 friends are yet to send £50.00+");
    const link = view.getByRole("link", { name: /View all referrals/ });
    expect(link.getAttribute("href")).toBe("/bonus-discounts?tab=referrals");
    for (const f of FRIENDS) expect(view.queryByText(f.friend)).toBeNull();
    expect(view.container.textContent).not.toMatch(/Musa|Kemi|Sarah/);
    view.unmount();
    // totals come from the summary, not from counting rows; several currencies are joined with ' + '
    const multi = card({ referrals: [], summary: { joined: 10, earned_count: 4, total_earned: { GBP: 20, USD: 5, EUR: 0 } } });
    expect(multi.getByTestId("refer-count").textContent).toBe("10");
    expect(multi.getByTestId("refer-earned").textContent).toBe("£20.00 + $5.00");
    multi.unmount();
    const none = card({ referrals: [], summary: { joined: 0, earned_count: 0, total_earned: {} } });
    expect(none.getByText("No referrals yet. Share your link to start earning.")).toBeTruthy();
    expect(none.queryByRole("link", { name: /View all referrals/ })).toBeNull();
    none.unmount();
  });

  rule("REF-14", "The offer sentence shows every money amount in bold", {
    why: "Customers scan the card for what they and their friend get; the amounts are the key facts.",
    fix: "ReferEarnCard.OfferSentence splits the offer text on currency amounts (£ $ € ₦ ₹ ¥ A$ C$ R KSh GH₵ AED) and wraps each in <strong>. The text itself comes from Mito (offer.text).",
    where: ["client/src/components/rewards/ReferEarnCard.tsx"],
  }, () => {
    const view = card();
    const bold = Array.from(view.getByTestId("refer-offer-text").querySelectorAll("strong")).map((s) => s.textContent);
    expect(bold).toEqual(["£5.00", "£10.00", "£50.00"]);
    expect(view.getByTestId("refer-offer-text").textContent).toBe(OFFER.text);
    view.unmount();
    const ngn = card({ offer: { ...OFFER, text: "You get ₦2,500.00 when they send ₦25,000.00 or more." } });
    expect(Array.from(ngn.getByTestId("refer-offer-text").querySelectorAll("strong")).map((s) => s.textContent)).toEqual(["₦2,500.00", "₦25,000.00"]);
    ngn.unmount();
  });

  rule("REF-15", "The card is hidden when there is no offer, shows a retry state on error (not a blank), and a cap-reached message instead of the link", {
    why: "No active rule for the customer's currency means nothing to promote. A failed load must be recoverable. When the reward cap is reached a link would promise rewards that will not come.",
    fix: "ReferEarnCard: isLoading -> skeleton (data-testid refer-earn-loading); isError -> role=alert message \"We couldn't load your referral details...\" with a 'Try again' button calling onRetry; !offer -> null; offer.cap_reached -> message and no link field.",
    where: ["client/src/components/rewards/ReferEarnCard.tsx"],
  }, () => {
    const hidden = card({ offer: null });
    expect(hidden.container.innerHTML).toBe("");
    hidden.unmount();

    const onRetry = vi.fn();
    const err = card({ isError: true, onRetry });
    expect(err.getByTestId("refer-earn-error").textContent).toContain("We couldn't load your referral details.");
    expect(err.getByRole("alert")).toBeTruthy();
    fireEvent.click(err.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    err.unmount();

    expect(card({ isLoading: true }).getByTestId("refer-earn-loading")).toBeTruthy();

    const capped = card({ offer: { ...OFFER, cap_reached: true } });
    expect(capped.getByTestId("refer-cap-reached")).toBeTruthy();
    expect(capped.queryByLabelText("Your referral link")).toBeNull();
    capped.unmount();
  });

  rule("REF-16", "Copy link copies the full link and confirms with a toast; if copying fails the customer is told to copy manually", {
    why: "Every submission or action needs visible feedback (project rule), and a silent copy failure would leave the customer sharing nothing.",
    fix: "ReferEarnCard.handleCopy: navigator.clipboard.writeText(link) -> toast 'Referral link copied!'; on error -> destructive toast \"We couldn't copy the link\" and the input is selected.",
    where: ["client/src/components/rewards/ReferEarnCard.tsx"],
  }, async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const view = card();
    await act(async () => { fireEvent.click(view.getByRole("button", { name: /Copy link/ })); });
    expect(writeText).toHaveBeenCalledWith("http://localhost:5000/ref/JOHN2880");
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Referral link copied!" }));

    toast.mockClear();
    writeText.mockRejectedValueOnce(new Error("denied"));
    await act(async () => { fireEvent.click(view.getByRole("button", { name: /Copy|Copied/ })); });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "We couldn't copy the link", variant: "destructive" }));
    view.unmount();
  });
});

describe("Who is signed in", () => {
  rule("REF-17", "The header initials and Dashboard welcome come from the signed-in user (first name, or business name, or email), never from a fixed name", {
    why: "A hard-coded name once showed another customer's name on every account. The greeting and avatar must always describe the person logged in.",
    fix: "lib/userDisplay.ts welcomeName(user) and userInitials(user); Dashboard.tsx renders `Welcome ${welcomeName(user)}` with user from useAuth(); layout/Header.tsx renders userInitials(user).",
    where: ["client/src/lib/userDisplay.ts", "client/src/pages/Dashboard.tsx", "client/src/components/layout/Header.tsx"],
  }, () => {
    expect(welcomeName({ accountType: "individual", firstName: "Mohammad", lastName: "Khan", email: "m@x.com" } as any)).toBe("Mohammad");
    expect(welcomeName({ accountType: "individual", firstName: "", email: "fatima.ali@x.com" } as any)).toBe("fatima.ali");
    expect(welcomeName({ accountType: "business", businessName: "Acme Ltd", firstName: "Sam", email: "s@x.com" } as any)).toBe("Acme Ltd");
    expect(welcomeName(null)).toBe("");
    expect(userInitials({ accountType: "individual", firstName: "Mohammad", lastName: "Khan", email: "m@x.com" } as any)).toBe("MK");
    expect(userInitials({ accountType: "business", businessName: "Acme Ltd", email: "s@x.com" } as any)).toBe("AL");

    const dash = source("client/src/pages/Dashboard.tsx");
    expect(dash).toMatch(/const \{ user \} = useAuth\(\)/);
    expect(dash).toMatch(/data-testid="dashboard-welcome">Welcome\{welcomeName\(user\) \? ` \$\{welcomeName\(user\)\}` : ""\}/);
    expect(source("client/src/components/layout/Header.tsx")).toMatch(/\{userInitials\(user\)\}/);
  });

  rule("REF-18", "NEGATIVE (fixed bug): no customer's name is hard-coded in the Dashboard welcome or the header", {
    why: "The welcome once read 'Welcome Olayinka' for everyone. Names, initials and the profile label must be derived from the logged-in user only.",
    fix: "Remove the literal and use welcomeName(user) / userInitials(user) / profileLabel(user) from lib/userDisplay.ts. (Demo names belong only in seed data and test fixtures.)",
    where: ["client/src/pages/Dashboard.tsx", "client/src/components/layout/Header.tsx", "client/src/lib/userDisplay.ts"],
  }, () => {
    const names = /\b(Olayinka|Mohammad|Akshita|Sarah|Kemi|Musa|John Doe)\b/;
    for (const f of ["client/src/pages/Dashboard.tsx", "client/src/components/layout/Header.tsx", "client/src/lib/userDisplay.ts"]) {
      expect(source(f), `${f} must not contain a hard-coded customer name`).not.toMatch(names);
    }
    expect(source("client/src/pages/Dashboard.tsx")).not.toMatch(/Welcome\s+[A-Z][a-z]+(?![a-zA-Z{])/);
  });
});
