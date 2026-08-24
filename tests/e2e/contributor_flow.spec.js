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

    test('Shared contribution link opens a persisted campaign after a fresh page load', async ({ page }) => {
        // Simulate a campaign created in another tab: mockData persists to
        // localStorage, so the shared link must resolve on a fresh load.
        const campaignId = 'persist-campaign-1';
        await page.addInitScript((id) => {
            window.localStorage.setItem('rhemito:group-pay:state:v1', JSON.stringify({
                campaigns: [{
                    id,
                    name: 'Persisted Relief Fund',
                    targetAmount: 900,
                    currency: 'GBP',
                    description: 'Campaign persisted across page loads.',
                    bankAccountId: '2',
                    bankAccountName: 'John Doe - Barclays',
                    status: 'active',
                    createdAt: new Date().toISOString(),
                    uniqueLink: `${window.location.origin}/contribute/${id}`,
                    creatorName: 'John Doe',
                }],
                contributors: [],
            }));
        }, campaignId);

        await page.goto(`/contribute/${campaignId}`);
        await expect(page.getByText('Persisted Relief Fund')).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('heading', { name: 'Make a Contribution' })).toBeVisible();

        // Unknown links show a clear not-found state instead of a blank page
        await page.goto('/contribute/does-not-exist');
        await expect(page.getByTestId('campaign-not-found')).toBeVisible();
        await expect(page.getByText('Campaign not found')).toBeVisible();
    });
});
