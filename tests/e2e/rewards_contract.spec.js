import { test, expect } from '@playwright/test';

/**
 * Rewards contract tests (UI rules) — Promo Code, Bonus and Referral behaviour in the browser.
 * Companion to client/src/__tests__/contracts/*.contract.test.ts; only rules the existing specs
 * (bonus, rewards, promo_payment, receipt, payment_failure, welcome_name) do not already cover.
 *
 * If one of these fails, read the "CONTRACT" comment above the test: it says WHY the rule exists and
 * WHERE it is implemented. Only change a contract when the product owner (Mohammad) changed the rule,
 * and update the test in the same PR with the reason (see "Rewards contract tests" in CLAUDE.md).
 *
 * Mito and the rewards APIs are mocked with page.route, so no Mito service is needed.
 */

const inDays = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
};

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const offer = {
    rule_id: 81, currency: 'GBP', reward_type: 'BOTH', referrer_reward: 5, referee_reward: 10, floor: 50,
    qualification_window_days: 30, bonus_validity_days: 90, min_redeem_amount: 0,
    text: 'Invite friends with your link. You get £5.00 and your friend gets £10.00 in bonus credit when they send £50.00 or more within 30 days of joining.',
    referral_code: 'JOHN2880', referral_link: 'http://localhost:5000/ref/JOHN2880', cap_reached: false,
};

const friends = [
    { id: 'R3', friend: 'Musa I.', joined_on: '2026-09-25T10:00:00Z', status: 'REGISTERED', status_label: 'Joined', currency: 'GBP', floor: 50, qualification_deadline: inDays(22), reward: 5, credited: 0 },
    { id: 'R2', friend: 'Kemi L.', joined_on: '2026-09-24T10:00:00Z', status: 'PENDING', status_label: 'In progress', currency: 'GBP', floor: 50, qualification_deadline: inDays(21), reward: 5, credited: 0 },
    { id: 'R1', friend: 'Sarah S.', joined_on: '2026-09-20T10:00:00Z', status: 'REWARDED', status_label: 'Earned', currency: 'GBP', floor: 50, qualification_deadline: inDays(17), reward: 5, credited: 5 },
];

const history = [
    { id: 'h1', created_at: '2026-10-05T10:00:00Z', type: 'EARNED', reason_code: 'REFERRAL_REWARD', amount: 10, currency: 'GBP', notes: 'Referrer reward – referred Sarah S.', transfer_id: null, source_credit_id: null, credit_source: 'REFERRAL', credit_source_label: 'Referral bonus – Sarah S.' },
    { id: 'h2', created_at: '2026-10-04T10:00:00Z', type: 'EARNED', reason_code: 'MANUAL_CREDIT', amount: 5, currency: 'GBP', notes: 'Goodwill', transfer_id: null, source_credit_id: null, credit_source: 'MANUAL', credit_source_label: 'Goodwill credit from Rhemito' },
    { id: 'h3', created_at: '2026-10-03T10:00:00Z', type: 'APPLIED', reason_code: 'BONUS_REDEMPTION', amount: -4, currency: 'GBP', notes: '', transfer_id: 'TXN-202610-00001', source_credit_id: 'h1', credit_source: 'REFERRAL' },
    { id: 'h4', created_at: '2026-10-02T10:00:00Z', type: 'EXPIRED', reason_code: 'BONUS_EXPIRED', amount: -2, currency: 'GBP', notes: '', transfer_id: null, source_credit_id: 'h2', credit_source: 'MANUAL' },
    { id: 'h5', created_at: '2026-10-01T10:00:00Z', type: 'VOIDED', reason_code: 'TRANSFER_CANCELLED', amount: -3, currency: 'GBP', notes: '', transfer_id: 'TXN-X', source_credit_id: null, credit_source: 'SCHEME' },
    // Repayment bookkeeping rows are never shown as bonus activity
    { id: 'h6', created_at: '2026-09-30T10:00:00Z', type: 'CLAWBACK', reason_code: 'CLAWBACK', amount: -1, currency: 'GBP', notes: 'Clawback bookkeeping row', transfer_id: 'TXN-X', source_credit_id: null, credit_source: 'SCHEME' },
];

function summary({ gbp = 7, usd = 0, referrals = friends, referralSummary, hist = [], blocked = false } = {}) {
    const balances = [];
    if (gbp > 0) balances.push({ currency: 'GBP', available: gbp, earned: gbp + 8, used: 4, expired: 2, used_transfer_count: 1, referral_credit_count: 1, other_credit_count: 1, by_source: [{ credit_source: 'REFERRAL', label: 'Referrals', earned: gbp + 8, used: 8, expired: 0, removed: 0, available: gbp }] });
    if (usd > 0) balances.push({ currency: 'USD', available: usd, earned: usd, used: 0, expired: 0, used_transfer_count: 0, referral_credit_count: 0, other_credit_count: 1 });
    return {
        customer: { id: 'user_123', referralCode: 'JOHN2880', currency: 'GBP' },
        currency: 'GBP',
        offer,
        wallet: { bonus_blocked: blocked, balances, unused: [], credits: [], history: hist, promo_redemptions: [] },
        referrals: { data: referrals, summary: referralSummary ?? { joined: 3, earned_count: 1, total_earned: { GBP: 5 } } },
        latestOffer: null,
    };
}

async function mockRewards(page, opts = {}) {
    const data = summary(opts);
    await page.route('**/api/rewards/summary**', (route) => route.fulfill(json({ data })));
    await page.route('**/api/promocodes/savings**', (route) => route.fulfill(json({ data: { items: [], saved: {} } })));
    await page.route('**/api/bonus/summary**', (route) => route.fulfill(json({ data: { currency: 'GBP', currencies: ['GBP'], blocked: opts.blocked ?? false, offers: [], wallet: data.wallet } })));
}

async function openSendMoney(page, amount) {
    await page.goto('/send-money');
    await page.getByPlaceholder('0.00').first().fill(amount);
}

async function toPayment(page, amount) {
    await openSendMoney(page, amount);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByText('Akshita', { exact: true }).first().click();
    await expect(page.getByText('Recipient Details')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
}

const num = async (locator) => Number((await locator.innerText()).replace(/[^0-9.]/g, ''));

test.describe('Rewards contract — bonus panel', () => {
    /**
     * CONTRACT BONUS-10: the bonus panel is on the Amount step AND the Payment step and both share ONE choice.
     * WHY: customers should see their bonus as soon as they land, and the choice must carry to payment and into the pay request.
     * CODE: client/src/pages/SendMoney.tsx (two <UseBonusCredit> bound to the same bonusChoice state).
     */
    test('[BONUS-10] a choice made on the Amount step is still selected on the Payment step and is sent with the payment', async ({ page }) => {
        await mockRewards(page);
        let sent = null;
        await page.route('**/api/send-money/transactions/*/pay', async (route) => {
            sent = route.request().postDataJSON();
            await route.fulfill(json({ data: { id: 'tx1', reference: 'RH-C1', status: 'completed', paidAt: new Date().toISOString() } }));
        });

        await openSendMoney(page, '500');
        const panel1 = page.getByTestId('bonus-redemption');
        await expect(panel1).toContainText('£7.00 available', { timeout: 15000 });
        await expect(page.getByRole('radio', { name: /Don't use bonus/ })).toBeChecked(); // nothing is pre-selected
        await page.getByRole('radio', { name: /Send more/ }).check();
        await expect(page.getByTestId('summary-bonus-step1')).toContainText('+ 7.00 GBP');

        await page.getByRole('button', { name: 'Continue' }).click();
        await page.getByText('Akshita', { exact: true }).first().click();
        await expect(page.getByText('Recipient Details')).toBeVisible();
        await page.getByRole('button', { name: 'Continue' }).click();

        await expect(page.getByTestId('bonus-redemption')).toHaveCount(1);
        await expect(page.getByRole('radio', { name: /Send more/ })).toBeChecked();
        await expect(page.getByTestId('summary-bonus')).toContainText('Bonus credit (to recipient)');
        await expect(page.getByTestId('summary-bonus')).toContainText('+ 7.00 GBP');

        await page.getByText('Credit/Debit Card').click();
        await expect.poll(() => sent).not.toBeNull();
        expect(sent.paymentMethod).toBe('card');
        expect(sent.bonusCredit).toEqual({ mode: 'send_more', amount: '7.00' });
    });

    /**
     * CONTRACT BONUS-01: the bonus balance is per currency — only the transfer's currency (GBP) counts.
     * WHY: £ bonus cannot pay a $ transfer; and with 0 balance the panel stays hidden on both steps.
     * CODE: client/src/pages/SendMoney.tsx (balanceFor(wallet, SEND_CURRENCY)), client/src/features/bonus/components/UseBonusCredit.tsx.
     */
    test('[BONUS-01] a balance in another currency does not show the bonus panel, on either step', async ({ page }) => {
        await mockRewards(page, { gbp: 0, usd: 50 });
        await openSendMoney(page, '500');
        await expect(page.getByText('Send Money').first()).toBeVisible();
        await expect(page.getByTestId('bonus-redemption')).toHaveCount(0);
        await expect(page.getByTestId('summary-bonus-step1')).toHaveCount(0);
        await page.getByRole('button', { name: 'Continue' }).click();
        await page.getByText('Akshita', { exact: true }).first().click();
        await expect(page.getByText('Recipient Details')).toBeVisible();
        await page.getByRole('button', { name: 'Continue' }).click();
        await expect(page.getByText('How would you like to pay?')).toBeVisible();
        await expect(page.getByTestId('bonus-redemption')).toHaveCount(0);
    });

    /**
     * CONTRACT BONUS-11: when the server says the bonus service is unavailable the choice is KEPT (the customer may retry or pick
     * "Don't use bonus"), the transfer is not paid, and a destructive toast explains.
     * WHY: the choice is still valid; only the service is down. CODE: client/src/pages/SendMoney.tsx bonusRefused().
     */
    test('[BONUS-11] BONUS_UNAVAILABLE keeps the choice and shows a destructive toast', async ({ page }) => {
        await mockRewards(page);
        const message = `Bonus credit can't be used right now. Choose "Don't use bonus" to continue, or try again shortly.`;
        await page.route('**/api/send-money/transactions/*/pay', (route) => route.fulfill(json({ error: { code: 'BONUS_UNAVAILABLE', message } }, 503)));
        await toPayment(page, '500');
        await expect(page.getByTestId('bonus-redemption')).toContainText('£7.00 available', { timeout: 15000 });
        await page.getByRole('radio', { name: /Pay less/ }).check();
        await page.getByText('Credit/Debit Card').click();
        const toast = page.locator('.destructive').filter({ hasText: 'Bonus not applied' });
        await expect(toast).toBeVisible();
        await expect(toast).toContainText("Choose \"Don't use bonus\" to continue");
        await expect(page.getByRole('radio', { name: /Pay less/ })).toBeChecked();
        await expect(page.getByText('Success!')).toHaveCount(0);
    });
});

test.describe('Rewards contract — promo code field', () => {
    async function promoPage(page, { payReply }) {
        await mockRewards(page, { gbp: 0 });
        const validations = [];
        const payBodies = [];
        await page.route('**/api/promocodes/status', (route) => route.fulfill(json({ data: { enabled: true } })));
        await page.route('**/api/promocodes/validate', (route) => {
            validations.push(route.request().postDataJSON());
            return route.fulfill(json({ valid: true, appliedDiscount: 1, displayText: '£1.00 off your fee' }));
        });
        await page.route('**/api/send-money/transactions/*/pay', (route) => {
            payBodies.push(route.request().postDataJSON());
            return route.fulfill(payReply);
        });
        await toPayment(page, '500');
        return { validations, payBodies };
    }

    /**
     * CONTRACT PROMO-01/04/06: the discount shown comes from Mito's answer and comes off the FEE only (the send amount is unchanged);
     * the payment method is not sent to Mito before one is chosen; the payment carries the code and the discount that was shown.
     * CODE: client/src/features/promo/usePromoCode.ts, client/src/pages/SendMoney.tsx.
     */
    test('[PROMO-01] applying a code shows "Promo (CODE)" and lowers the total by exactly the approved fee discount', async ({ page }) => {
        const { validations } = await promoPage(page, { payReply: json({ data: { id: 'tx1', reference: 'RH-C2', status: 'completed', paidAt: new Date().toISOString() } }) });
        const before = await num(page.getByTestId('summary-total'));
        await page.getByTestId('promo-code-input').fill('save05');
        await page.getByTestId('promo-apply').click();
        await expect(page.getByTestId('promo-message')).toContainText('£1.00 off your fee');
        await expect(page.getByTestId('summary-promo')).toContainText('Promo (SAVE05)');
        await expect(page.getByTestId('summary-promo')).toContainText('£1.00');
        await expect(page.getByTestId('summary-total')).toHaveText(`${(before - 1).toFixed(2)} GBP`);
        expect(validations).toHaveLength(1);
        expect(validations[0]).toMatchObject({ code: 'SAVE05', amount: 500, currency: 'GBP' });
        expect(validations[0]).not.toHaveProperty('paymentMethod'); // no method chosen yet
        // Removing the code clears the applied discount
        await expect(page.getByTestId('promo-remove')).toBeVisible();
        await page.getByTestId('promo-remove').click();
        await expect(page.getByTestId('summary-promo')).toHaveCount(0);
        await expect(page.getByTestId('summary-total')).toHaveText(`${before.toFixed(2)} GBP`);
    });

    /**
     * CONTRACT PROMO-10: a pay-time PROMO_* refusal is shown on the promo field, the payment method is cleared, the discount is
     * dropped and a destructive "Payment not made" toast explains — and the generic "Payment not completed" toast is NOT used.
     * WHY: the server re-checks the code before any money moves; the customer must be able to remove the code and continue.
     * CODE: client/src/pages/SendMoney.tsx (PROMO_ branch), client/src/features/promo/usePromoCode.ts reject().
     */
    test('[PROMO-10] a code refused at payment time is shown on the field, with a destructive "Payment not made" toast', async ({ page }) => {
        const message = 'This promo code has reached its limit. Go back and remove the promo code to continue.';
        const { payBodies } = await promoPage(page, { payReply: json({ error: { code: 'PROMO_REJECTED', message } }, 409) });
        await page.getByTestId('promo-code-input').fill('SAVE05');
        await page.getByTestId('promo-apply').click();
        await expect(page.getByTestId('summary-promo')).toBeVisible();

        await page.getByText('Credit/Debit Card').click();
        const toast = page.locator('.destructive').filter({ hasText: 'Payment not made' });
        await expect(toast).toBeVisible();
        await expect(toast).toContainText('This promo code has reached its limit.');
        expect(payBodies[0]).toMatchObject({ paymentMethod: 'card', promoCode: 'SAVE05', promoDiscount: '1.00' });
        await expect(page.getByTestId('promo-message')).toContainText(message);
        await expect(page.getByTestId('summary-promo')).toHaveCount(0);
        await expect(page.getByTestId('promo-code-input')).toBeEnabled();
        await expect(page.getByText('Payment not completed')).toHaveCount(0);
        await expect(page.getByText('Success!')).toHaveCount(0);
    });
});

test.describe('Rewards contract — a failed payment is never silent', () => {
    /**
     * CONTRACT PAY-13: if the payment request cannot even reach the server the customer still sees a destructive
     * "Payment not completed" toast with the standard text, never the success screen, and can try again.
     * WHY: a payment once failed with no message at all. CODE: client/src/pages/SendMoney.tsx (catch around paySendMoneyTransaction).
     */
    test('[PAY-13] a network failure shows the destructive "Payment not completed" toast and allows a retry', async ({ page }) => {
        await mockRewards(page, { gbp: 0 });
        let attempts = 0;
        await page.route('**/api/send-money/transactions/*/pay', (route) => {
            attempts += 1;
            return attempts === 1 ? route.abort('connectionfailed') : route.fulfill(json({ error: { code: 'INTERNAL_ERROR', message: 'The payment could not be recorded. Please try again.' } }, 500));
        });
        await toPayment(page, '100');
        await page.getByText('Instant Pay By Bank').click();
        const toast = page.locator('.destructive').filter({ hasText: 'Payment not completed' }).first();
        await expect(toast).toBeVisible();
        await expect(toast).toContainText("We couldn't complete your payment. Please try again.");
        await expect(page.getByText('Success!')).toHaveCount(0);
        // The method is released so the customer can choose again
        await page.getByText('Instant Pay By Bank').click();
        await expect.poll(() => attempts).toBe(2);
        await expect(page.locator('.destructive').filter({ hasText: 'The payment could not be recorded.' }).first()).toBeVisible();
    });
});

test.describe('Rewards contract — Bonus & Discounts', () => {
    /**
     * CONTRACT BONUS-15: the tiles and History filters use "Bonus earned", "Bonus used", "Bonus expired" (and "Promo codes");
     * earned = EARNED, used = APPLIED, expired = EXPIRED/VOIDED; repayment (CLAWBACK) rows are never listed; each row shows
     * a source chip (Referrals / Bonus offers / From Rhemito) from credit_source.
     * CODE: client/src/pages/BonusAndDiscounts.tsx, client/src/features/bonus/components/SourceChip.tsx.
     */
    test('[BONUS-15] tile and History labels, filters by kind, source chips, and no repayment rows', async ({ page }) => {
        await mockRewards(page, { hist: history });
        await page.goto('/bonus-discounts');
        const tiles = page.getByTestId('bonus-totals');
        await expect(tiles).toContainText('Bonus earned');
        await expect(tiles).toContainText('Bonus used');
        await expect(tiles).toContainText('Bonus expired');

        await page.getByRole('tab', { name: 'History' }).click();
        for (const name of ['All', 'Bonus earned', 'Bonus used', 'Bonus expired', 'Promo codes']) {
            await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
        }
        const rows = page.getByTestId('bonus-history').locator('li');
        await expect(rows).toHaveCount(5); // the CLAWBACK row is not shown
        await expect(page.getByTestId('bonus-history')).not.toContainText('Clawback bookkeeping row');

        await page.getByRole('button', { name: 'Bonus earned', exact: true }).click();
        await expect(rows).toHaveCount(2);
        await expect(rows.nth(0).getByTestId('source-chip')).toHaveText('Referrals');
        await expect(rows.nth(1).getByTestId('source-chip')).toHaveText('From Rhemito');
        await expect(rows.nth(1)).toContainText('Goodwill credit from Rhemito');

        await page.getByRole('button', { name: 'Bonus used', exact: true }).click();
        await expect(rows).toHaveCount(1);
        await expect(rows.first()).toContainText('Bonus used on transfer TXN-202610-00001');

        await page.getByRole('button', { name: 'Bonus expired', exact: true }).click();
        await expect(rows).toHaveCount(2);
        await expect(page.getByTestId('bonus-history')).toContainText('Bonus credit expired');
        await expect(page.getByTestId('bonus-history')).toContainText('Bonus removed – transfer or request reversed');
    });
});

test.describe('Rewards contract — Refer & Earn card', () => {
    /**
     * CONTRACT REF-13/14: the card shows the friends-joined count and the total earned (several currencies joined with " + "),
     * the money amounts in the offer sentence are bold, and it NEVER lists individual friends — they are on the Referrals tab,
     * which the "View all referrals" link opens.
     * WHY: the Dashboard card must keep its height however many friends join. CODE: client/src/components/rewards/ReferEarnCard.tsx.
     */
    test('[REF-13] totals only on the card, bold offer amounts, friends listed only after "View all referrals"', async ({ page }) => {
        await mockRewards(page, { referralSummary: { joined: 3, earned_count: 1, total_earned: { GBP: 5, USD: 3 } } });
        await page.goto('/');
        const card = page.getByTestId('refer-earn-card');
        await expect(card).toBeVisible();
        await expect(card.getByText('Friends joined')).toBeVisible();
        await expect(card.getByText('Bonus earned')).toBeVisible();
        await expect(card.getByTestId('refer-count')).toHaveText('3');
        await expect(card.getByTestId('refer-earned')).toHaveText('£5.00 + $3.00');
        const bold = card.getByTestId('refer-offer-text').locator('strong');
        await expect(bold).toHaveText(['£5.00', '£10.00', '£50.00']);
        for (const f of friends) await expect(card.getByText(f.friend)).toHaveCount(0);

        await card.getByRole('link', { name: 'View all referrals' }).click();
        await expect(page).toHaveURL(/\/bonus-discounts\?tab=referrals/);
        await expect(page.getByTestId('referral-card-R3')).toContainText('Musa I.');
        await expect(page.getByTestId('referral-card-R2')).toContainText('Kemi L.');
    });

    /**
     * CONTRACT REF-01: opening /ref/:code validates the code with the server, remembers it in the browser (localStorage
     * "rhemito.referral") and opens sign-up, so it can be sent when the customer registers.
     * CODE: client/src/pages/ReferralLanding.tsx, client/src/lib/rewards.ts.
     */
    test('[REF-01] a referral link stores the code for sign-up', async ({ page }) => {
        await page.route('**/api/rewards/codes/**', (route) => route.fulfill(json({ data: { code: 'JOHN2880', referrerFirstName: 'John', offer, signedIn: false } })));
        await page.route('**/api/rewards/visits', (route) => route.fulfill(json({ data: { counted: true } })));
        await page.goto('/ref/john2880');
        await expect(page).toHaveURL(/sign-in-sign-up/);
        const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rhemito.referral') || 'null'));
        expect(stored).toMatchObject({ code: 'JOHN2880', referrerFirstName: 'John' });
    });
});
