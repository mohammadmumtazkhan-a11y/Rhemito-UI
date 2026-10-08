import { test, expect } from '@playwright/test';

test.describe('Send Money — a payment that fails', () => {
    test('says so, and does not show the success message', async ({ page }) => {
        await page.route('**/api/send-money/transactions/*/pay', (route) => route.fulfill({
            status: 500, contentType: 'application/json',
            body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'The payment could not be recorded. Please try again.' } }),
        }));
        await page.goto('/send-money');
        await page.getByPlaceholder('0.00').first().fill('100');
        await page.getByRole('button', { name: 'Continue' }).click();
        await page.getByText('Akshita', { exact: true }).first().click();
        await expect(page.getByText('Recipient Details')).toBeVisible();
        await page.getByRole('button', { name: 'Continue' }).click();

        await page.getByText('Instant Pay By Bank').click();
        await expect(page.getByText('Payment not completed').first()).toBeVisible();
        await expect(page.getByText('The payment could not be recorded. Please try again.').first()).toBeVisible();
        await expect(page.getByText('Success!')).toHaveCount(0);
    });
});
