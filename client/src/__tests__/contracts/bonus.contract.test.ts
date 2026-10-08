/**
 * Bonus contracts (BONUS-*). Rhemito shows ONE bonus balance per currency (credit_source REFERRAL / SCHEME / MANUAL
 * only says how a credit was earned). Mito owns the wallet; Rhemito offers it on Send Money, uses it at payment,
 * and shows the history. These rules pin the money maths, the error handling and the places the bonus appears.
 */
import React from "react";
import { afterAll, beforeAll, beforeEach, describe, expect } from "vitest";
import { render } from "@testing-library/react";
import { bootContractApp, flush, resetContractApp, type ContractApp } from "./_mitoStub";
import { countMatches, rule, source } from "./_contract";
import {
  BONUS_COPY, SOURCE_ORDER, UseBonusCredit, amountConverted, availableParts, balanceFor, breakdownRows, bySource, creditToApply,
  daysUntil, expiringSoon, expiryLabel, sourceGroupLabel, totalToPay, SourceChip, BonusCreditPill,
  type BonusBalance, type BonusCredit,
} from "@/features/bonus";
import { balanceFor as rewardsBalanceFor } from "@/lib/rewards";

let ctx: ContractApp;
beforeAll(async () => { ctx = await bootContractApp(); });
afterAll(async () => { await ctx.close(); });
beforeEach(async () => { await resetContractApp(ctx); });

const pay = (id: string, body: Record<string, unknown>) => ctx.api("POST", `/api/send-money/transactions/${id}/pay`, body);
const withBonus = (amount = "10.00", mode = "pay_less") => ({ paymentMethod: "card", bonusCredit: { mode, amount } });
const txStatus = async (id: string) => (await ctx.storage.getSendMoneyTransactionById(id))!.status;

const zero = { used: 0, expired: 0, used_transfer_count: 0, referral_credit_count: 0, other_credit_count: 0 };
const grp = (credit_source: "REFERRAL" | "SCHEME" | "MANUAL", earned: number, available: number) => ({ credit_source, earned, used: earned - available, expired: 0, removed: 0, available });
const balance = (over: Partial<BonusBalance> = {}): BonusBalance => ({ currency: "GBP", available: 7, earned: 15, ...zero, ...over });

describe("Balance and the maths of using it", () => {
  rule("BONUS-01", "The bonus balance is per currency: balanceFor picks the transfer's currency and gives zeros (never another currency's money) when there is none", {
    why: "A £ bonus cannot pay for a $ transfer. Mixing currencies would let a customer spend credit that is worth something else.",
    fix: "features/bonus/lib/bonus.ts and lib/rewards.ts balanceFor(wallet, currency) finds balances[].currency === currency, otherwise returns a zero balance for that currency. SendMoney.tsx calls balanceFor(rewards.data?.wallet, SEND_CURRENCY).",
    where: ["client/src/features/bonus/lib/bonus.ts", "client/src/lib/rewards.ts", "client/src/pages/SendMoney.tsx"],
  }, () => {
    const wallet = { balances: [balance({ currency: "GBP", available: 7 }), balance({ currency: "USD", available: 3 })] } as any;
    for (const fn of [balanceFor, rewardsBalanceFor] as const) {
      expect(fn(wallet, "GBP").available).toBe(7);
      expect(fn(wallet, "USD").available).toBe(3);
      expect(fn(wallet, "NGN")).toMatchObject({ currency: "NGN", available: 0, earned: 0 });
      expect(fn(undefined, "GBP")).toMatchObject({ currency: "GBP", available: 0 });
    }
    expect(source("client/src/pages/SendMoney.tsx")).toMatch(/balanceFor\(rewards\.data\?\.wallet,\s*SEND_CURRENCY\)/);
  });

  rule("BONUS-02", "The credit applied is never above the whole balance or above the amount being sent, and is rounded for the currency", {
    why: "Bonus credit is real money. Applying more than the customer has, or more than the transfer, would create money out of nothing.",
    fix: "creditToApply(available, sendAmount, currency) = round(min(available, sendAmount)), and 0 if either is not positive (features/bonus/lib/bonus.ts). The server also refuses a bonus above the send amount (BONUS_TOO_HIGH).",
    where: ["client/src/features/bonus/lib/bonus.ts", "server/bonus/hooks.ts"],
  }, () => {
    expect(creditToApply(7, 100)).toBe(7);
    expect(creditToApply(70, 20)).toBe(20);
    expect(creditToApply(0, 20)).toBe(0);
    expect(creditToApply(-5, 20)).toBe(0);
    expect(creditToApply(5, 0)).toBe(0);
    expect(creditToApply(7.456, 100)).toBe(7.46);
    expect(creditToApply(1000.4, 5000, "JPY")).toBe(1000);
  });

  rule("BONUS-03", "There is NO minimum to use bonus: even a £1 transfer can use it, and the offer's min_redeem_amount is not used", {
    why: "Product decision: customers can use any amount of bonus on any transfer. A minimum would strand small balances until they expire.",
    fix: "Do not add a minimum in creditToApply, UseBonusCredit or SendMoney.tsx. The panel renders whenever available > 0 and shows the capped credit; there is no 'below minimum' state. (RewardOffer.min_redeem_amount is only a legacy field of the referral offer.)",
    where: ["client/src/features/bonus/components/UseBonusCredit.tsx", "client/src/features/bonus/lib/bonus.ts", "client/src/pages/SendMoney.tsx"],
  }, () => {
    expect(creditToApply(7, 1)).toBe(1);
    expect(creditToApply(7, 0.01)).toBe(0.01);
    const view = render(React.createElement(UseBonusCredit, { balance: balance({ available: 7 }), currency: "GBP", sendAmount: 1, receiveCurrency: "NGN", exchangeRate: 2000, choice: "none", onChoice: () => {} }));
    expect(view.getByText("Save £1.00 now. £6.00 will stay in your bonus credit.")).toBeTruthy();
    expect(view.queryByTestId("bonus-below-min")).toBeNull();
    expect(view.getAllByRole("radio")).toHaveLength(3);
    view.unmount();
    for (const f of ["client/src/features/bonus/lib/bonus.ts", "client/src/features/bonus/components/UseBonusCredit.tsx", "client/src/pages/SendMoney.tsx"]) {
      expect(source(f)).not.toMatch(/min_redeem_amount|minRedeem|bonus-below-min/);
    }
  });

  rule("BONUS-04", "Pay less lowers the total (never below 0); Send more leaves the total unchanged and converts send + bonus for the recipient", {
    why: "Pay less = the customer pays less. Send more = the customer pays the same but the recipient gets more, funded by the bonus. Mixing these up would charge the wrong amount or short the recipient.",
    fix: "SendMoney.tsx: totalPay = max(0, amount + effectiveFee - (pay_less ? bonusAmount : 0)); amountSent = amount + (send_more ? bonusAmount : 0); they receive amountSent x rate. Pure helpers: totalToPay and amountConverted in features/bonus/lib/bonus.ts.",
    where: ["client/src/pages/SendMoney.tsx", "client/src/features/bonus/lib/bonus.ts"],
  }, () => {
    expect(totalToPay(100, 3, 1, 7)).toBe(95);
    expect(totalToPay(10, 0, 0, 50)).toBe(0);
    expect(amountConverted(7, 2025.5, "NGN")).toBe(14178.5);
    expect(amountConverted(0, 2025.5, "NGN")).toBe(0);
    const page = source("client/src/pages/SendMoney.tsx");
    expect(page).toMatch(/const totalPay = Math\.max\(0,\s*\(parseFloat\(amount \|\| "0"\) \+ effectiveFee\) - \(useBonus && bonusType === 'pay_less' \? bonusAmount : 0\)\)/);
    expect(page).toMatch(/const amountSentGBP = youSendAmount \+ \(useBonus && bonusType === 'send_more' \? bonusAmount : 0\)/);
    expect(page).toMatch(/const finalReceiveAmount = \(amountSentGBP \* EXCHANGE_RATE\)\.toFixed\(2\)/);
    expect(page).toMatch(/const bonusAmount = useBonus \? creditToApply\(bonusBalance, parseFloat\(amount \|\| "0"\), SEND_CURRENCY\) : 0/);
  });
});

describe("Using the bonus at payment (server)", () => {
  rule("BONUS-05", "The bonus is used once, in the transfer's currency, with the transfer reference, and saved on the transaction with its mode", {
    why: "Mito must be able to tie the used credit to exactly one transfer so it can give it back if the transfer is cancelled.",
    fix: "bonus.applyForPayment posts { amount, currency: tx.sendCurrency, transfer_id: tx.reference, send_amount } to Mito /api/wallet/:customer/apply and the pay route saves bonusCreditMinor and bonusCreditMode (pay_less | send_more) on the transaction; no bonus requested = no Mito call and bonusCredit null.",
    where: ["server/bonus/hooks.ts", "server/sendMoneyRoutes.ts"],
  }, async () => {
    const tx = await ctx.newTx();
    const r = await pay(tx.id, withBonus("10.00", "send_more"));
    expect(r.body.data).toMatchObject({ status: "completed", bonusCredit: "10.00", bonusCreditMode: "send_more" });
    expect(ctx.stub.to("/api/wallet/user_123/apply")[0].body).toEqual({ amount: 10, currency: "GBP", transfer_id: tx.reference, send_amount: 100 });

    ctx.stub.reset();
    const none = await ctx.newTx();
    const r2 = await pay(none.id, { paymentMethod: "card" });
    expect(r2.body.data.bonusCredit).toBeNull();
    expect(ctx.stub.to("/api/wallet/user_123/apply")).toHaveLength(0);
  });

  rule("BONUS-06", "A bonus larger than the send amount is refused by Rhemito (BONUS_TOO_HIGH) without calling Mito, and the transfer stays unpaid", {
    why: "Second line of defence behind the browser: a tampered request must not push the credit above the transfer value.",
    fix: "bonus.applyForPayment throws BonusPaymentError(400, 'BONUS_TOO_HIGH', 'Bonus cannot be more than the amount you send.') when askedMinor > tx.sendAmountMinor, before any Mito call. Mito's own 'send amount' message maps to the same code.",
    where: ["server/bonus/hooks.ts"],
  }, async () => {
    const tx = await ctx.newTx();
    const r = await pay(tx.id, withBonus("100.01"));
    expect(r.status).toBe(400);
    expect(r.body.error).toEqual({ code: "BONUS_TOO_HIGH", message: "Bonus cannot be more than the amount you send." });
    expect(ctx.stub.to("/api/wallet/user_123/apply")).toHaveLength(0);
    expect(await txStatus(tx.id)).toBe("awaiting_payment");

    ctx.stub.on(/\/apply$/, { status: 400, body: { error: "TOO_HIGH", message: "Bonus cannot exceed the send amount." } });
    const r2 = await pay(tx.id, withBonus("10.00"));
    expect(r2.body.error.code).toBe("BONUS_TOO_HIGH");
  });

  rule("BONUS-07", "BONUS_CHANGED: if the balance changed (or Mito refuses with a 4xx) the payment stops with 409, the transfer stays unpaid, and an already-applied retry counts as success", {
    why: "The customer chose a bonus amount from a balance that is no longer true. They must review the transfer rather than pay a price based on credit that is gone. A retry of the same payment must not fail just because Mito already holds the credit.",
    fix: "bonus.applyForPayment: Mito code BALANCE_CHANGED -> BonusPaymentError(409, 'BONUS_CHANGED', 'Your bonus balance has changed. Please review your transfer.'); other 4xx -> 409 BONUS_CHANGED with Mito's text; code ALREADY_APPLIED -> returns the bonus as applied.",
    where: ["server/bonus/hooks.ts"],
  }, async () => {
    ctx.stub.on(/\/apply$/, { status: 409, body: { error: "BALANCE_CHANGED", message: "x", available: 3 } });
    const tx = await ctx.newTx();
    const r = await pay(tx.id, withBonus());
    expect(r.status).toBe(409);
    expect(r.body.error).toEqual({ code: "BONUS_CHANGED", message: "Your bonus balance has changed. Please review your transfer." });
    expect(await txStatus(tx.id)).toBe("awaiting_payment");

    ctx.stub.reset();
    ctx.stub.on(/\/apply$/, { status: 422, body: { error: "Bonus is not available for this transfer." } });
    const other = await pay(tx.id, withBonus());
    expect(other.body.error).toEqual({ code: "BONUS_CHANGED", message: "Bonus is not available for this transfer." });

    ctx.stub.reset();
    ctx.stub.on(/\/apply$/, { status: 409, body: { error: "ALREADY_APPLIED", message: "done" } });
    const retry = await pay(tx.id, withBonus("10.00", "send_more"));
    expect(retry.status).toBe(200);
    expect(retry.body.data).toMatchObject({ bonusCredit: "10.00", bonusCreditMode: "send_more" });
  });

  rule("BONUS-08", "BONUS_UNAVAILABLE: when Mito is down or the bonus feature is off, a payment that asks for bonus is refused (503) with the 'Don't use bonus' guidance, never paid without the bonus", {
    why: "If the bonus cannot be confirmed, silently charging the full price (or giving the discount without recording it) would both be wrong. The customer is told how to continue.",
    fix: "bonus.applyForPayment: BONUS_ENABLED=false or a Mito 5xx/unreachable -> BonusPaymentError(503, 'BONUS_UNAVAILABLE', UNAVAILABLE) where UNAVAILABLE = `Bonus credit can't be used right now. Choose \"Don't use bonus\" to continue, or try again shortly.` A payment WITHOUT a bonus still works.",
    where: ["server/bonus/hooks.ts", "server/bonus/client.ts"],
  }, async () => {
    const message = `Bonus credit can't be used right now. Choose "Don't use bonus" to continue, or try again shortly.`;
    ctx.stub.on(/\/apply$/, "drop");
    const tx = await ctx.newTx();
    const down = await pay(tx.id, withBonus());
    expect(down.status).toBe(503);
    expect(down.body.error).toEqual({ code: "BONUS_UNAVAILABLE", message });
    expect(await txStatus(tx.id)).toBe("awaiting_payment");

    ctx.stub.reset();
    ctx.stub.on(/\/apply$/, { status: 500, body: { error: "boom" } });
    expect((await pay(tx.id, withBonus())).body.error.code).toBe("BONUS_UNAVAILABLE");

    ctx.stub.reset();
    process.env.BONUS_ENABLED = "false";
    const off = await pay(tx.id, withBonus());
    expect(off.status).toBe(503);
    expect(off.body.error).toEqual({ code: "BONUS_UNAVAILABLE", message });

    const without = await pay(tx.id, { paymentMethod: "card" });
    expect(without.status).toBe(200);
  });
});

describe("The bonus panel and the choice", () => {
  rule("BONUS-09", "The 'Use your bonus' panel is one balance with three choices (Pay less, Send more, Don't use bonus), nothing is pre-selected, and it is hidden at 0", {
    why: "Bonus is never applied without the customer choosing it. One total keeps it simple; the sources are only an explanatory line.",
    fix: "features/bonus/components/UseBonusCredit.tsx: returns null when balance.available <= 0 (or just the blocked notice), shows `${available} available`, radios in the order pay_less, send_more, none, and the 'Includes ... and ...' line only when more than one source holds credit. SendMoney.tsx starts with bonusChoice 'none'.",
    where: ["client/src/features/bonus/components/UseBonusCredit.tsx", "client/src/features/bonus/lib/copy.ts", "client/src/pages/SendMoney.tsx"],
  }, () => {
    const mixed = balance({ available: 7, by_source: [grp("REFERRAL", 10, 4), grp("SCHEME", 5, 3)] });
    const view = render(React.createElement(UseBonusCredit, { balance: mixed, currency: "GBP", sendAmount: 5, receiveCurrency: "NGN", exchangeRate: 2000, choice: "none", onChoice: () => {} }));
    expect(view.getByText("£7.00 available")).toBeTruthy();
    expect(view.getByTestId("bonus-includes").textContent).toBe("Includes £4.00 from referrals and £3.00 from bonus offers");
    const radios = view.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((r) => r.value)).toEqual(["pay_less", "send_more", "none"]);
    expect(radios.map((r) => r.checked)).toEqual([false, false, true]); // "none" is the default choice
    expect(view.getByText(BONUS_COPY.payLess)).toBeTruthy();
    expect(view.getByText(BONUS_COPY.sendMore)).toBeTruthy();
    expect(view.getByText("Don't use bonus")).toBeTruthy();
    expect(view.getByText("Save £5.00 now. £2.00 will stay in your bonus credit.")).toBeTruthy();
    expect(view.getByText(`Recipient gets ₦10,000.00 more`)).toBeTruthy();
    view.unmount();

    const single = render(React.createElement(UseBonusCredit, { balance: balance({ available: 7, by_source: [grp("REFERRAL", 10, 7)] }), currency: "GBP", sendAmount: 50, receiveCurrency: "NGN", exchangeRate: 2000, choice: "none", onChoice: () => {} }));
    expect(single.queryByTestId("bonus-includes")).toBeNull();
    single.unmount();
    const empty = render(React.createElement(UseBonusCredit, { balance: balance({ available: 0 }), currency: "GBP", sendAmount: 50, receiveCurrency: "NGN", exchangeRate: 2000, choice: "none", onChoice: () => {} }));
    expect(empty.container.innerHTML).toBe("");
    empty.unmount();
    expect(source("client/src/pages/SendMoney.tsx")).toMatch(/useState<BonusChoice>\("none"\)/);
  });

  rule("BONUS-10", "The bonus panel appears on the Amount step AND the Payment step, and both share one choice", {
    why: "Customers should see their bonus as soon as they land, not discover it at payment, and the choice they make on either step must carry to the other (and into the pay request).",
    fix: "SendMoney.tsx renders <UseBonusCredit> twice (step 1 and step 4), both with balance={bonusWallet}, choice={bonusChoice} and onChoice={setBonusChoice} from ONE useState. Do not create a second state variable for the payment step.",
    where: ["client/src/pages/SendMoney.tsx"],
  }, () => {
    const page = source("client/src/pages/SendMoney.tsx");
    expect(countMatches(page, /<UseBonusCredit\b/)).toBe(2);
    expect(countMatches(page, /choice=\{bonusChoice\}/)).toBe(2);
    expect(countMatches(page, /onChoice=\{setBonusChoice\}/)).toBe(2);
    expect(countMatches(page, /balance=\{bonusWallet\}/)).toBe(2);
    expect(countMatches(page, /useState<BonusChoice>/)).toBe(1);
    // the step-1 summary row and the payment summary row both reflect the choice
    expect(page).toContain('data-testid="summary-bonus-step1"');
    expect(page).toContain('data-testid="summary-bonus"');
    // the same choice, amount and mode go into the pay request at both pay sites
    expect(countMatches(page, /useBonus \? \{ mode: bonusType, amount: bonusAmount \} : null/)).toBe(2);
  });

  rule("BONUS-11", "Choice reset rules: BONUS_CHANGED / BONUS_TOO_HIGH reset to 'Don't use bonus' and reload the balance; BONUS_UNAVAILABLE keeps the choice; all show a destructive toast", {
    why: "After a changed balance the old choice is stale, so it is cleared for the customer to re-decide. When the service is merely unavailable the choice is still valid, and the customer can retry or pick 'Don't use bonus'.",
    fix: "SendMoney.tsx bonusRefused(e): if (e.code !== 'BONUS_UNAVAILABLE') setBonusChoiceState('none'); rewards.refetch(); toast({ title: e.code === 'BONUS_CHANGED' ? BONUS_COPY.changedTitle : 'Bonus not applied', description: e.message, variant: 'destructive' }). Called from both pay sites for any code starting with BONUS_.",
    where: ["client/src/pages/SendMoney.tsx", "client/src/features/bonus/lib/copy.ts"],
  }, () => {
    const page = source("client/src/pages/SendMoney.tsx");
    const fn = page.slice(page.indexOf("const bonusRefused"), page.indexOf("const bonusRefused") + 600);
    expect(fn).toMatch(/if \(e\.code !== "BONUS_UNAVAILABLE"\) setBonusChoiceState\("none"\)/);
    expect(fn).toMatch(/void rewards\.refetch\(\)/);
    expect(fn).toMatch(/title: e\.code === "BONUS_CHANGED" \? BONUS_COPY\.changedTitle : "Bonus not applied"/);
    expect(fn).toMatch(/variant: "destructive"/);
    expect(countMatches(page, /bonusRefused\(e\)/)).toBe(2);
    expect(BONUS_COPY.changedTitle).toBe("Your bonus balance has changed");
    expect(BONUS_COPY.changed).toBe("Your bonus balance has changed. Please review your transfer.");
    // the choice only counts while there is a balance to use
    expect(page).toMatch(/const useBonus = bonusChoice !== "none" && bonusBalance > 0/);
    // selecting a choice confirms it with a toast
    expect(BONUS_COPY.toastPayLess("£5.00")).toEqual({ title: "£5.00 bonus applied", description: "You'll pay £5.00 less." });
    expect(BONUS_COPY.toastSendMore("£5.00")).toEqual({ title: "£5.00 bonus added", description: "Your recipient will get more." });
  });

  rule("BONUS-12", "BONUS_BLOCKED: a blocked customer sees the notice (and no panel at 0 balance), but can still use credit they already have; the reason stays private", {
    why: "Blocked means the customer cannot EARN more bonus (support decision). It does not take away credit already in their balance, and the reason is for admins only.",
    fix: "UseBonusCredit: available <= 0 -> only <BonusBlockedNotice> when blocked; available > 0 -> notice above the panel. The flag comes from Mito's wallet.bonus_blocked (summary route returns blocked: Boolean(wallet.bonus_blocked)). Copy: BONUS_COPY.blocked, with no reason.",
    where: ["client/src/features/bonus/components/UseBonusCredit.tsx", "client/src/features/bonus/components/BonusBlockedNotice.tsx", "server/bonus/routes.ts"],
  }, async () => {
    const props = { currency: "GBP", sendAmount: 50, receiveCurrency: "NGN", exchangeRate: 2000, choice: "none" as const, onChoice: () => {}, blocked: true };
    const zeroView = render(React.createElement(UseBonusCredit, { ...props, balance: balance({ available: 0 }) }));
    expect(zeroView.getByTestId("bonus-blocked-notice").textContent).toContain("You're not qualified to get bonus. Please contact support for more information.");
    expect(zeroView.queryByTestId("bonus-redemption")).toBeNull();
    zeroView.unmount();
    const withCredit = render(React.createElement(UseBonusCredit, { ...props, balance: balance({ available: 7 }) }));
    expect(withCredit.getByTestId("bonus-blocked-notice")).toBeTruthy();
    expect(withCredit.getByTestId("bonus-redemption")).toBeTruthy();
    withCredit.unmount();

    ctx.stub.on(/^\/api\/wallet\/user_123(\?.*)?$/, { status: 200, body: { bonus_blocked: true, balances: [{ currency: "GBP", available: 7, earned: 7 }], unused: [], credits: [], history: [], promo_redemptions: [] } });
    const summary = await ctx.api("GET", "/api/bonus/summary?currency=GBP");
    expect(summary.body.data.blocked).toBe(true);
  });
});

describe("Sources, expiry and history labels", () => {
  rule("BONUS-13", "Sources: REFERRAL = 'Referrals', SCHEME = 'Bonus offers', MANUAL = 'From Rhemito', always in that order; unknown sources show no chip; filtering never touches the totals", {
    why: "credit_source only explains where credit came from. Customers must see consistent names, and a filter on the lists must not change the balance tiles (one balance).",
    fix: "features/bonus/lib/bonus.ts SOURCE_ORDER + sourceGroupLabel; SourceChip renders null for an unknown source; breakdownRows adds up to the tiles; server/bonus/routes.ts accepts source in REFERRAL|SCHEME|MANUAL (400 otherwise) and fetches an UNFILTERED wallet for totals when a source filter is used.",
    where: ["client/src/features/bonus/lib/bonus.ts", "client/src/features/bonus/components/SourceChip.tsx", "server/bonus/routes.ts"],
  }, async () => {
    expect(SOURCE_ORDER).toEqual(["REFERRAL", "SCHEME", "MANUAL"]);
    expect([sourceGroupLabel("REFERRAL"), sourceGroupLabel("SCHEME"), sourceGroupLabel("MANUAL"), sourceGroupLabel("OTHER")]).toEqual(["Referrals", "Bonus offers", "From Rhemito", ""]);
    const chip = render(React.createElement(SourceChip, { source: "SCHEME" }));
    expect(chip.getByTestId("source-chip").textContent).toBe("Bonus offers");
    chip.unmount();
    const none = render(React.createElement(SourceChip, { source: "PROMO" }));
    expect(none.container.innerHTML).toBe("");
    none.unmount();

    const b = balance({ available: 12, earned: 20, by_source: [grp("MANUAL", 5, 5), grp("REFERRAL", 10, 4), grp("SCHEME", 5, 3)] });
    const rows = breakdownRows(b);
    expect(rows.map((r) => r.source)).toEqual(["REFERRAL", "SCHEME", "MANUAL"]);
    expect(rows.reduce((s, r) => s + r.earned, 0)).toBe(b.earned);
    expect(rows.reduce((s, r) => s + r.available, 0)).toBe(b.available);
    expect(availableParts(balance({ by_source: [grp("REFERRAL", 5, 5)] }))).toEqual([]);
    expect(bySource([{ credit_source: "REFERRAL" }, { credit_source: "SCHEME" }, { credit_source: null }], "SCHEME")).toHaveLength(1);

    expect((await ctx.api("GET", "/api/bonus/summary?source=NOPE")).status).toBe(400);
    await ctx.api("GET", "/api/bonus/summary?currency=GBP&source=REFERRAL");
    const walletCalls = ctx.stub.calls.map((c) => c.path).filter((p) => p.startsWith("/api/wallet/user_123"));
    expect(walletCalls).toContain("/api/wallet/user_123?currency=GBP&credit_source=REFERRAL");
    expect(walletCalls).toContain("/api/wallet/user_123");
  });

  rule("BONUS-14", "Expiry warnings: credit expiring within 14 days is flagged soonest-first ('Expires today / tomorrow / in N days'), the panel says it is used first, and the Dashboard pill shows the same warning", {
    why: "Bonus expires. Customers should be nudged to use credit before it is lost; Mito uses the soonest-expiring credit first, and the wording says so.",
    fix: "features/bonus/lib/bonus.ts expiringSoon(credits, now, windowDays = 14) and expiryLabel; UseBonusCredit shows BONUS_COPY.expiryNote(amount, date) ('... of this expires on DD/MM/YYYY – it's used first.'); BonusCreditPill shows BONUS_COPY.pillExpiring / pillExpiringToday.",
    where: ["client/src/features/bonus/lib/bonus.ts", "client/src/features/bonus/components/UseBonusCredit.tsx", "client/src/features/bonus/components/BonusCreditPill.tsx"],
  }, () => {
    const now = new Date("2026-10-08T12:00:00Z");
    const list = [
      { remaining: 1, expires_on: "2026-12-01" }, { remaining: 2, expires_on: "2026-10-20" },
      { remaining: 3, expires_on: "2026-10-12" }, { remaining: 0, expires_on: "2026-10-09" }, { remaining: 4, expires_on: "2026-10-22" },
    ];
    expect(expiringSoon(list, now).map((c) => c.remaining)).toEqual([3, 2, 4]); // 14 days inclusive, remaining > 0 only
    expect(daysUntil("2026-10-10", now)).toBe(2);
    expect(expiryLabel("2026-10-08", now)).toBe("Expires today");
    expect(expiryLabel("2026-10-09", now)).toBe("Expires tomorrow");
    expect(expiryLabel("2026-10-17", now)).toBe("Expires in 9 days");

    const soon = new Date(); soon.setDate(soon.getDate() + 5);
    const ymd = soon.toISOString().slice(0, 10);
    const unused = [{ id: "s", source: null, reason_code: "X", amount: 5, remaining: 3, currency: "GBP", earned_on: "2026-09-01", expires_on: ymd, status: "PARTLY_USED" } as BonusCredit];
    const panel = render(React.createElement(UseBonusCredit, { balance: balance({ available: 7 }), unused, currency: "GBP", sendAmount: 50, receiveCurrency: "NGN", exchangeRate: 2000, choice: "none", onChoice: () => {} }));
    expect(panel.container.textContent).toContain("£3.00 of this expires on");
    expect(panel.container.textContent).toContain("it's used first.");
    panel.unmount();
    const pill = render(React.createElement(BonusCreditPill, { balance: balance({ available: 7 }), unused, onCreateTransaction: () => {} }));
    expect(pill.getByTestId("bonus-pill-expiring").textContent).toBe("£3.00 expires in 5 days.");
    pill.unmount();
    const hidden = render(React.createElement(BonusCreditPill, { balance: balance({ available: 0 }), onCreateTransaction: () => {} }));
    expect(hidden.container.innerHTML).toBe("");
    hidden.unmount();
  });

  rule("BONUS-15", "Bonus & Discounts History uses the labels 'Bonus earned', 'Bonus used', 'Bonus expired' (and 'Promo codes'); earned = EARNED, used = APPLIED, expired = EXPIRED/VOIDED; repayment rows are hidden", {
    why: "These are the words customers see for their bonus activity, and they must match the overview tiles. Clawback rows are internal repayment bookkeeping and are explained by the 'outstanding' line instead.",
    fix: "pages/BonusAndDiscounts.tsx: filter buttons [['all','All'],['earned','Bonus earned'],['used','Bonus used'],['expired','Bonus expired'],['promo','Promo codes']]; tiles use StatTile label 'Bonus earned' / 'Bonus used' / 'Bonus expired'; buildHistory maps EARNED -> earned, APPLIED -> used, otherwise expired, and filters out CLAWBACK and CLAWBACK_SETTLED.",
    where: ["client/src/pages/BonusAndDiscounts.tsx"],
  }, () => {
    const page = source("client/src/pages/BonusAndDiscounts.tsx");
    expect(page).toMatch(/\["all", "All"\], \["earned", "Bonus earned"\], \["used", "Bonus used"\], \["expired", "Bonus expired"\], \["promo", "Promo codes"\]/);
    for (const label of ["Bonus earned", "Bonus used", "Bonus expired"]) expect(page).toContain(`label="${label}"`);
    expect(page).toMatch(/h\.type === "EARNED"[\s\S]*kind: "earned"/);
    expect(page).toMatch(/h\.type === "APPLIED"[\s\S]*kind: "used"/);
    expect(page).toMatch(/kind: "expired"/);
    expect(page).toMatch(/h\.type !== "CLAWBACK" && h\.type !== "CLAWBACK_SETTLED"/);
    expect(page).toContain("Bonus used on transfer");
  });

  rule("BONUS-16", "Mito's bonus feed becomes notifications with the agreed wording, and unknown feed types are ignored", {
    why: "The bell/push messages are how customers learn they earned, used, lost or got back bonus. Wording is agreed copy, and a new Mito type that Rhemito does not know must not crash or spam.",
    fix: "server/bonus/feed.ts noteFor(item): BONUS_EARNED (SCHEME wording vs MANUAL 'Rhemito has added ...'), BONUS_USED (with 'Includes £x from referrals.' only when sources are mixed), BONUS_RETURNED, BONUS_EXPIRING, BONUS_EXPIRED, BONUS_REVERSED, BONUS_BLOCK_LIFTED; default -> null.",
    where: ["server/bonus/feed.ts"],
  }, async () => {
    const { noteFor } = await import("../../../../server/bonus/feed");
    const item = (type: string, payload: any) => ({ id: 1, customer_id: "user_123", type, payload, created_at: "2026-10-01T10:00:00Z" });
    expect(noteFor(item("BONUS_EARNED", { credit_source: "SCHEME", scheme_name: "Spring", amount: 5, currency: "GBP", expires_on: "2026-12-31" }))).toEqual({
      type: "bonus_earned", title: "You've earned £5.00 bonus credit",
      body: "Bonus earned: Spring. £5.00 bonus credit is ready to use on your next transfer by 31/12/2026.",
    });
    expect(noteFor(item("BONUS_EARNED", { credit_source: "MANUAL", amount: 5, currency: "GBP", expires_on: "2026-12-31" }))!.body).toBe("Rhemito has added £5.00 bonus credit to your account. Use it by 31/12/2026.");
    expect(noteFor(item("BONUS_USED", { amount: 10, currency: "GBP", transfer_id: "TXN-1", by_source: [{ credit_source: "REFERRAL", amount: 4 }, { credit_source: "SCHEME", amount: 6 }] }))!.body).toBe("£10.00 bonus credit was used on transfer TXN-1. Includes £4.00 from referrals.");
    expect(noteFor(item("BONUS_EXPIRED", { amount: 2, currency: "GBP", expired_on: "2026-10-01" }))!.title).toBe("Bonus expired");
    expect(noteFor(item("BONUS_EXPIRING", { remaining: 3, currency: "GBP", expires_on: "2026-10-12" }))!.title).toBe("Bonus expiring soon");
    expect(noteFor(item("BONUS_RETURNED", { amount: 3, currency: "GBP", transfer_id: "T9" }))!.title).toBe("Bonus returned");
    expect(noteFor(item("SOMETHING_NEW", {}))).toBeNull();
  });

  rule("BONUS-17", "The summary and wallet endpoints report problems as { error: { code, message } } and switch off with BONUS_ENABLED=false", {
    why: "The Dashboard and Bonus & Discounts pages rely on this shape to show 'try again' states, and the feature flag is the kill switch.",
    fix: "server/bonus/routes.ts: 401 UNAUTHENTICATED, 404 BONUS_DISABLED, 400 VALIDATION for a bad currency/source, wallet failures -> 503 BONUS_UNAVAILABLE with the standard text.",
    where: ["server/bonus/routes.ts"],
  }, async () => {
    expect((await ctx.api("GET", "/api/bonus/summary?currency=POUNDS")).body.error.code).toBe("VALIDATION");
    ctx.stub.on(/^\/api\/wallet\/user_123/, "drop");
    const down = await ctx.api("GET", "/api/bonus/wallet?currency=GBP");
    expect(down.status).toBe(503);
    expect(down.body.error.code).toBe("BONUS_UNAVAILABLE");
    ctx.stub.reset();
    process.env.BONUS_ENABLED = "false";
    const off = await ctx.api("GET", "/api/bonus/wallet");
    expect(off.status).toBe(404);
    expect(off.body.error.code).toBe("BONUS_DISABLED");
    await flush();
  });
});
