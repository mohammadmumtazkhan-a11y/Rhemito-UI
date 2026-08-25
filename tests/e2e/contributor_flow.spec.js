import { test, expect } from '@playwright/test';

test.describe('Contributor Flow', () => {

    test('Complete contribution flow for new user', async ({ page }) => {
        // 1. Navigate to demo campaign
        await page.goto('/contribute/demo-campaign-1');

        // 2. Initial Contribution Screen
        await expect(page.getByRole('heading', { name: 'Make a Contribution' })).toBeVisible();
        await page.getByLabel('Email Address').fill('testuser_' + Date.now() + '@example.com');
        await page.getByLabel('Contribution Amount').fill('100');

        // Select Currency (Optional, defaults to GBP maybe, let's keep it simple first or try to select if easy)
        // await page.getByRole('combobox').click();
        // await page.getByLabel('USD').click(); 

        await page.getByRole('button', { name: 'Continue' }).click();

        // 3. Unregistered email → real 6-digit PIN (devPin surfaced in demo mode)
        await expect(page.getByText('Verify your email')).toBeVisible();
        const tip = page.getByTestId('dev-pin-hint');
        await expect(tip).toBeVisible({ timeout: 10000 });
        const pin = (await tip.innerText()).match(/\d{6}/)[0];
        await page.getByTestId('input-pin-code').fill(pin);
        await page.getByRole('button', { name: 'Verify & Continue' }).click();

        // 4. Registration — real account creation with instant activation
        await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible({ timeout: 10000 });
        await page.getByTestId('input-reg-first-name').fill('John');
        await page.getByTestId('input-reg-last-name').fill('Doe');
        await page.getByTestId('select-register-country').click();
        await page.getByRole('option', { name: /United Kingdom/ }).click();
        await page.getByRole('button', { name: 'Pick a date' }).click();
        await page.getByRole('combobox').nth(1).click();
        await page.getByRole('option', { name: '2000' }).click();
        await page.getByRole('gridcell', { name: '15' }).first().click();
        await page.getByTestId('select-register-gender').click();
        await page.getByRole('option', { name: 'Male', exact: true }).click();
        await page.getByPlaceholder('Contact number').fill('7700900123');
        await page.getByTestId('input-reg-password').fill('Password123!');
        await page.getByTestId('input-reg-confirm-password').fill('Password123!');
        await page.getByTestId('button-register-pay').click();

        // 5. Verify Payment Screen Reached
        // After registration (instant activation + sign-in), it lands on payment method selection
        await expect(page.getByText('How would you like to pay?')).toBeVisible({ timeout: 10000 });

    });

    test('Shared contribution link opens a server-persisted campaign after a fresh page load', async ({ page }) => {
        // Campaigns now live server-side: create one via the API, then open
        // the share link — it must resolve without any browser-local seeding.
        const res = await page.request.post('/api/group-pay/campaigns', {
            data: {
                name: 'Persisted Relief Fund',
                creatorName: 'John Doe',
                targetAmount: 900,
                currency: 'GBP',
                description: 'Campaign persisted server-side.',
                bankAccountId: 'acc_demo_gbp',
                bankAccountName: 'John Doe - Barclays',
            },
        });
        expect(res.ok()).toBeTruthy();
        const { data: campaign } = await res.json();

        await page.goto(`/contribute/${campaign.id}`);
        await expect(page.getByText('Persisted Relief Fund')).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('heading', { name: 'Make a Contribution' })).toBeVisible();

        // Unknown links show a clear not-found state instead of a blank page
        await page.goto('/contribute/does-not-exist');
        await expect(page.getByTestId('campaign-not-found')).toBeVisible();
        await expect(page.getByText('Campaign not found')).toBeVisible();
    });

    test('Campaign link created in one browser opens in a different browser', async ({ browser, page }) => {
        // Regression test: campaigns used to live in localStorage, so share
        // links showed "Campaign not found" in any other browser.
        const res = await page.request.post('/api/group-pay/campaigns', {
            data: {
                name: 'Cross Browser Fund',
                creatorName: 'John Doe',
                targetAmount: 250,
                currency: 'GBP',
                description: 'Created in browser A, opened in browser B.',
                bankAccountId: 'acc_demo_gbp',
                bankAccountName: 'John Doe - Barclays',
            },
        });
        expect(res.ok()).toBeTruthy();
        const { data: campaign } = await res.json();

        // A fresh context has completely separate storage — a different "browser"
        const otherContext = await browser.newContext();
        const otherPage = await otherContext.newPage();
        try {
            await otherPage.goto(`/contribute/${campaign.id}`);
            await expect(otherPage.getByText('Cross Browser Fund')).toBeVisible({ timeout: 10000 });
            await expect(otherPage.getByRole('heading', { name: 'Make a Contribution' })).toBeVisible();
        } finally {
            await otherContext.close();
        }
    });
});
