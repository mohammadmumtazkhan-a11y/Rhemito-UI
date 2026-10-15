import { test, expect } from '@playwright/test';

/**
 * Choosing a payment method pays the transfer, which uses the promo code on the server.
 * The page must not check the code again after that (it would be "already used" by this very payment).
 */
test.describe('Send Money — promo code and payment method', () => {
    test('choosing a payment method does not re-validate the code against its own use', async ({ page }) => {
        let used = false;
        let validations = 0;
        await page.route('**/api/promocodes/status', (route) => route.fulfill({ json: { data: { enabled: true } } }));
        await page.route('**/api/promocodes/validate', (route) => {
            validations += 1;
            return used
                ? route.fulfill({ status: 400, json: { error: 'You have already used this promo code.', code: 'ALREADY_USED' } })
                : route.fulfill({ json: { valid: true, appliedDiscount: 1, displayText: '£1.00 off your fee' } });
        });
        await page.route('**/api/send-money/transactions/*/pay', async (route) => {
            used = true; // Mito has now recorded the use
            await route.fulfill({ json: { data: { id: 'tx1', reference: 'RH-PAY1', status: 'pending', paidAt: new Date().toISOString() } } });
        });

        await page.goto('/send-money');
        await page.getByPlaceholder('0.00').first().fill('500');
        await page.getByRole('button', { name: 'Continue' }).click();
        await page.getByText('Akshita', { exact: true }).first().click();
        await expect(page.getByText('Recipient Details')).toBeVisible();
        await page.getByRole('button', { name: 'Continue' }).click();

        await page.getByPlaceholder(/promo|code/i).first().fill('SAVE05');
        await page.getByRole('button', { name: 'Apply' }).click();
        await expect(page.getByText('£1.00 off your fee').first()).toBeVisible();
        const before = validations;

        await page.getByText('Credit/Debit Card').click();
        await page.waitForTimeout(1500); // longer than the 400ms re-validation debounce
        expect(validations).toBe(before);
        await expect(page.getByText('You have already used this promo code.')).toHaveCount(0);
    });
});
