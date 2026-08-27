import { test, expect } from '@playwright/test';

test.describe('Rhemito Send Money Flow', () => {

    test('Navigate to Send Money page', async ({ page }) => {
        await page.goto('/send-money');

        // Verify page loaded
        await expect(page).toHaveURL(/\/send-money/);

        // Verify amount input is present
        await expect(page.getByPlaceholder('0.00').first()).toBeVisible();
    });

    test('Step 1 - Enter amount and continue', async ({ page }) => {
        await page.goto('/send-money');

        // Enter amount
        await page.getByPlaceholder('0.00').first().fill('100');

        // Click Continue
        await page.getByRole('button', { name: 'Continue' }).click();

        // Verify moved to next step (Recipient selection)
        await expect(page.getByText(/Who are you sending to/i)).toBeVisible({ timeout: 5000 });
    });

    test('Full Send Money flow - Step 1 to Step 2', async ({ page }) => {
        await page.goto('/send-money');

        // Step 1: Amount
        await page.getByPlaceholder('0.00').first().fill('500');
        await page.getByRole('button', { name: 'Continue' }).click();

        // Step 2: Recipient
        await expect(page.getByText(/Who are you sending to/i)).toBeVisible();

        // Click New Recipient
        await page.getByRole('button', { name: 'New Recipient' }).click();

        // Verify moved to details step
        await expect(page.getByText('Recipient Details')).toBeVisible({ timeout: 5000 });
    });

    test('Complete Send Money flow (Step 1 to Step 4 Payment Method)', async ({ page }) => {
        await page.goto('/send-money');

        // Step 1: Amount
        await page.getByPlaceholder('0.00').first().fill('500');
        await page.getByRole('button', { name: 'Continue' }).click();

        // Step 2: Recipient
        await expect(page.getByText(/Who are you sending to/i)).toBeVisible();

        // Click on recent recipient "Akshita"
        await page.getByText('Akshita', { exact: true }).first().click();

        // Step 3: Details (prefilled, click Continue submits the real server-owned transaction)
        await expect(page.getByText('Recipient Details')).toBeVisible();
        await page.getByRole('button', { name: 'Continue' }).click();

        // Step 4: Payment Method
        await expect(page.getByText('Referral Bonus Available')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('Instant Pay By Bank')).toBeVisible();
    });

    test('Wizard transaction appears on the Dashboard and can be cancelled without a refresh', async ({ page }) => {
        await page.goto('/send-money');

        // Step 1: Amount
        await page.getByPlaceholder('0.00').first().fill('100');
        await page.getByRole('button', { name: 'Continue' }).click();
        await expect(page.getByText(/Who are you sending to/i)).toBeVisible({ timeout: 5000 });

        // Step 2: Pick a known recipient
        await page.getByText('Akshita', { exact: true }).first().click();
        await expect(page.getByText('Recipient Details')).toBeVisible();

        // Step 3: Continue creates the real transaction (awaiting_payment)
        await page.getByRole('button', { name: 'Continue' }).click();
        await expect(page.getByText('Referral Bonus Available')).toBeVisible({ timeout: 15000 });

        // The Dashboard unified table shows the new TXN row
        await page.goto('/');
        const row = page.locator('[data-testid^="row-transaction-TXN-"]').first();
        await expect(row).toBeVisible({ timeout: 15000 });
        const ref = (await row.getAttribute('data-testid')).replace('row-transaction-', '');

        // Cancel from the Dashboard — the row flips to Cancelled via the real API
        await page.getByTestId(`button-cancel-${ref}`).click();
        await page.getByTestId('button-confirm-cancel').click();
        await expect(page.getByTestId(`row-transaction-${ref}`).getByText('Cancelled')).toBeVisible({ timeout: 15000 });
    });

});
