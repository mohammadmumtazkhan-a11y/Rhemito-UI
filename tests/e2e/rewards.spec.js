import { test, expect } from '@playwright/test';

/**
 * Refer & Earn and Bonus & Discounts (docs/design/referral-bonus-spec.md).
 * The rewards API is mocked so these tests do not need the Mito Admin engine.
 */

const offer = {
    rule_id: 81, currency: 'GBP', reward_type: 'BOTH', referrer_reward: 5, referee_reward: 10, floor: 50,
    qualification_window_days: 30, bonus_validity_days: 90, min_redeem_amount: 0,
    text: 'Invite friends with your link. You get £5.00 and your friend gets £10.00 in bonus credit when they send £50.00 or more within 30 days of joining.',
    referral_code: 'JOHN2880', referral_link: 'http://localhost:5000/ref/JOHN2880', cap_reached: false,
};

const inDays = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
};

function summary(overrides = {}) {
    return {
        customer: { id: 'user_123', referralCode: 'JOHN2880', currency: 'GBP' },
        currency: 'GBP',
        offer,
        wallet: {
            balances: [{ currency: 'GBP', available: 7, earned: 15, used: 8, expired: 0, used_transfer_count: 1, referral_credit_count: 1, other_credit_count: 1 }],
            unused: [
                { id: 'c2', source: 'Referee reward – invited by Olayinka A.', reason_code: 'REFERRAL_REWARD', amount: 10, remaining: 2, currency: 'GBP', earned_on: '2026-09-12', expires_on: inDays(9), status: 'PARTLY_USED' },
                { id: 'c1', source: 'Referrer reward – referred Sarah S.', reason_code: 'REFERRAL_REWARD', amount: 5, remaining: 5, currency: 'GBP', earned_on: '2026-10-01', expires_on: inDays(88), status: 'UNUSED' },
            ],
            credits: [
                { id: 'c1', amount: 5, remaining: 5, currency: 'GBP', status: 'UNUSED', expires_on: inDays(88), notes: '', reason_code: 'REFERRAL_REWARD', created_at: '2026-10-01' },
                { id: 'c2', amount: 10, remaining: 2, currency: 'GBP', status: 'PARTLY_USED', expires_on: inDays(9), notes: '', reason_code: 'REFERRAL_REWARD', created_at: '2026-09-12' },
            ],
            history: [
                { id: 'c1', created_at: '2026-10-01T10:00:00Z', type: 'EARNED', reason_code: 'REFERRAL_REWARD', amount: 5, currency: 'GBP', notes: 'Referrer reward – referred Sarah S.', transfer_id: null, source_credit_id: null },
                { id: 'a1', created_at: '2026-09-20T10:00:00Z', type: 'APPLIED', reason_code: 'BONUS_REDEMPTION', amount: -8, currency: 'GBP', notes: '', transfer_id: 'TXN-202609-00042', source_credit_id: 'c2' },
                { id: 'c2', created_at: '2026-09-12T10:00:00Z', type: 'EARNED', reason_code: 'REFERRAL_REWARD', amount: 10, currency: 'GBP', notes: 'Referee reward – invited by Olayinka A.', transfer_id: null, source_credit_id: null },
            ],
            promo_redemptions: [{ id: 'p1', code: 'WELCOME', amount: -10, currency: 'GBP', transfer_id: 'TXN-1', created_at: '2026-09-01T10:00:00Z' }],
        },
        referrals: {
            data: [
                { id: 'R3', friend: 'Musa I.', joined_on: '2026-09-25T10:00:00Z', status: 'REGISTERED', status_label: 'Joined', currency: 'GBP', floor: 50, qualification_deadline: inDays(22), reward: 5, credited: 0 },
                { id: 'R2', friend: 'Kemi L.', joined_on: '2026-09-24T10:00:00Z', status: 'PENDING', status_label: 'In progress', currency: 'GBP', floor: 50, qualification_deadline: inDays(21), reward: 5, credited: 0 },
                { id: 'R1', friend: 'Sarah S.', joined_on: '2026-09-20T10:00:00Z', status: 'REWARDED', status_label: 'Earned', currency: 'GBP', floor: 50, qualification_deadline: inDays(17), reward: 5, credited: 5 },
            ],
            summary: { joined: 3, earned_count: 1, total_earned: { GBP: 5 } },
        },
        latestOffer: { id: 9, kind: 'LIVE', title: 'New offer: Refer & Earn', message: 'Invite friends and get £5.00 each time they send £50.00 or more. Your friend gets £10.00 too.', createdAt: new Date().toISOString() },
        ...overrides,
    };
}

async function mockRewards(page, data = summary()) {
    await page.route('**/api/rewards/summary**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) }));
    // Promo savings now come from the promo module (PROMO-RHEMITO P-12); serve the same rows
    const promoRows = data.wallet?.promo_redemptions ?? [];
    const items = promoRows.map((p) => ({ id: p.id, code: p.code, amount: Math.abs(p.amount), currency: p.currency, transferId: p.transfer_id, createdAt: p.created_at }));
    const saved = {};
    for (const i of items) saved[i.currency] = (saved[i.currency] ?? 0) + i.amount;
    await page.route('**/api/promocodes/savings**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items, saved } }) }));
}

test.describe('Refer & Earn on the Dashboard', () => {
    test('shows the live offer, link, friend progress and bonus credit', async ({ page }) => {
        await mockRewards(page);
        await page.goto('/');
        const card = page.getByTestId('refer-earn-card');
        await expect(card).toBeVisible();
        await expect(card.getByTestId('refer-offer-text')).toContainText('You get £5.00 and your friend gets £10.00');
        await expect(card.getByLabel('Your referral link')).toHaveValue('localhost:5000/ref/JOHN2880');
        // Totals only — individual friends are listed on the Referrals tab, so the card never grows
        await expect(card.getByTestId('refer-count')).toHaveText('3');
        await expect(card.getByTestId('refer-earned')).toHaveText('£5.00');
        await expect(card.getByTestId('refer-waiting')).toContainText('2 friends are yet to send £50.00+');
        await expect(card.getByText('Kemi L.')).toHaveCount(0);
        await expect(card.getByRole('link', { name: 'View all referrals' })).toBeVisible();
        await expect(page.getByTestId('bonus-credit-card')).toHaveCount(0);
        await expect(page.getByTestId('bonus-earned-pill')).toContainText('£7.00 bonus credit');
    });

    test('offer banner can be dismissed and stays dismissed', async ({ page }) => {
        await mockRewards(page);
        await page.goto('/');
        const banner = page.getByTestId('offer-banner');
        await expect(banner).toContainText('NEW OFFER');
        await banner.getByRole('button', { name: 'Dismiss offer' }).click();
        await expect(banner).toBeHidden();
        await page.reload();
        await expect(page.getByTestId('refer-earn-card')).toBeVisible();
        await expect(page.getByTestId('offer-banner')).toBeHidden();
    });

    test('card is hidden when there is no active offer, and pill hidden with no balance', async ({ page }) => {
        const data = summary({ offer: null, latestOffer: null });
        data.wallet.balances = [];
        await mockRewards(page, data);
        await page.goto('/');
        await expect(page.getByText('Quick Services')).toBeVisible();
        await expect(page.getByTestId('refer-earn-card')).toHaveCount(0);
        await expect(page.getByTestId('bonus-earned-pill')).toHaveCount(0);
        await expect(page.getByTestId('rewards-waiting-badge')).toHaveCount(0);
    });

    test('shows a retry message when rewards cannot load', async ({ page }) => {
        await page.route('**/api/rewards/summary**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'REWARDS_UNAVAILABLE', message: 'Rewards are unavailable right now.' } }) }));
        await page.goto('/');
        await expect(page.getByTestId('refer-earn-error')).toContainText("We couldn't load your referral details.", { timeout: 15000 });
        // Retry loads the card once rewards are available again
        await page.unroute('**/api/rewards/summary**');
        await mockRewards(page);
        await page.getByRole('button', { name: 'Try again' }).click();
        await expect(page.getByTestId('refer-earn-card')).toBeVisible();
    });
});

test.describe('Bonus & Discounts page', () => {
    test('overview shows totals, savings and unused bonus', async ({ page }) => {
        await mockRewards(page);
        await page.goto('/bonus-discounts');
        const totals = page.getByTestId('bonus-totals');
        await expect(totals).toContainText('£7.00');
        await expect(totals).toContainText('£15.00');
        await expect(totals).toContainText('Across 1 transfer');
        await expect(page.getByTestId('total-saved')).toContainText('£18.00');
        const unused = page.getByTestId('unused-bonus');
        await expect(unused).toContainText('Welcome bonus – invited by Olayinka A.');
        await expect(unused).toContainText('£2.00 left of £10.00');
        await expect(unused).toContainText('Expires in 9 days');
    });

    test('history can be filtered', async ({ page }) => {
        await mockRewards(page);
        await page.goto('/bonus-discounts?tab=history');
        const list = page.getByTestId('bonus-history');
        await expect(list).toContainText('Referral bonus – Sarah S.');
        await expect(list).toContainText('Promo code WELCOME');
        await page.getByRole('button', { name: 'Bonus used' }).click();
        await expect(list).toContainText('Bonus used on transfer TXN-202609-00042');
        await expect(list).not.toContainText('Promo code WELCOME');
    });

    test('my referrals shows each friend with a timeline for transfers in progress', async ({ page }) => {
        await mockRewards(page);
        await page.goto('/bonus-discounts?tab=referrals');
        await expect(page.getByTestId('referral-summary')).toContainText('Joined: 3 · Earned: 1 · Total earned: £5.00');
        await expect(page.getByTestId('referral-card-R2')).toContainText('You get £5.00 when it completes');
        await expect(page.getByTestId('referral-card-R3')).toContainText('Waiting for their first transfer of £50.00 or more');
        await expect(page.getByTestId('referral-card-R1')).toContainText('£5.00 added to your bonus credit');
    });
});

test.describe('Referral sign-up', () => {
    test('invalid referral link still opens sign-up with a message', async ({ page }) => {
        await page.goto('/ref/AB-12');
        await expect(page).toHaveURL(/sign-in-sign-up/);
        await expect(page.getByText("This referral link isn't valid").first()).toBeVisible();
    });

    test('valid link shows the invitation on the sign-up page', async ({ page }) => {
        await page.route('**/api/rewards/codes/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { code: 'JOHN2880', referrerFirstName: 'John', offer, signedIn: false } }) }));
        await page.route('**/api/rewards/visits', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { counted: true } }) }));
        await page.goto('/ref/JOHN2880');
        await expect(page).toHaveURL(/sign-in-sign-up/);
        await expect(page.getByTestId('referral-invite')).toContainText('John invited you');
        await expect(page.getByTestId('referral-invite')).toContainText('Send £50.00+ in 30 days');
    });
});

test.describe('Send Money — use your bonus', () => {
    test('Pay less reduces the total to pay', async ({ page }) => {
        await mockRewards(page);
        await page.goto('/send-money');
        await page.getByPlaceholder('0.00').first().fill('500');
        await page.getByRole('button', { name: 'Continue' }).click();
        await page.getByText('Akshita', { exact: true }).first().click();
        await expect(page.getByText('Recipient Details')).toBeVisible();
        await page.getByRole('button', { name: 'Continue' }).click();

        const bonus = page.getByTestId('bonus-redemption');
        await expect(bonus).toContainText('£7.00 available', { timeout: 15000 });
        await expect(bonus).toContainText('£2.00 of this expires on');
        await expect(page.getByRole('radio', { name: /Don't use bonus/ })).toBeChecked();

        const before = Number((await page.getByTestId('summary-total').innerText()).replace(/[^0-9.]/g, ''));
        await page.getByRole('radio', { name: /Pay less/ }).check();
        await expect(page.getByTestId('summary-bonus')).toContainText('7.00');
        await expect(page.getByTestId('summary-total')).toHaveText(`${(before - 7).toFixed(2)} GBP`);

        await page.getByRole('radio', { name: /Send more/ }).check();
        await expect(page.getByTestId('summary-total')).toHaveText(`${before.toFixed(2)} GBP`);
    });
});
