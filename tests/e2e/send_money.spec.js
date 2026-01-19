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

});
