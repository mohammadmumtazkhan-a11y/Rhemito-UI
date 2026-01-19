import { test, expect } from '@playwright/test';

test.describe('Rhemito Navigation', () => {

    test('Sidebar navigation - Overview', async ({ page }) => {
        await page.goto('/');

        // Click Overview in sidebar
        await page.getByTestId('link-overview').click();

        // Verify we're on dashboard
        await expect(page).toHaveURL('/');
    });

    test('Sidebar navigation - Payments (via accordion)', async ({ page }) => {
        await page.goto('/');

        // First expand the "Payments Received" accordion
        await page.getByText('Payments Received').click();

        // Wait for accordion to expand
        await page.waitForTimeout(500);

        // Click Received Payments link
        await page.getByTestId('link-received-payments').click();

        // Verify navigation
        await expect(page).toHaveURL(/\/payments/);
    });

    test('Sidebar navigation - Senders (via accordion)', async ({ page }) => {
        await page.goto('/');

        // First expand the "Payments Received" accordion
        await page.getByText('Payments Received').click();

        // Wait for accordion to expand
        await page.waitForTimeout(500);

        // Click Senders link
        await page.getByTestId('link-senders').click();

        // Verify navigation
        await expect(page).toHaveURL(/\/senders/);
    });

    test('Sidebar navigation - Collections Accounts (via accordion)', async ({ page }) => {
        await page.goto('/');

        // First expand the "Payments Received" accordion
        await page.getByText('Payments Received').click();

        // Wait for accordion to expand
        await page.waitForTimeout(500);

        // Click Collections Accounts link
        await page.getByTestId('link-collections-accounts').click();

        // Verify navigation
        await expect(page).toHaveURL(/\/payout-accounts/);
    });

    test('Sidebar navigation - Bonus & Discounts', async ({ page }) => {
        await page.goto('/');

        // Click Bonus & Discounts link (it's a highlighted item, not in accordion)
        await page.getByText('Bonus & Discounts').first().click();

        // Verify navigation
        await expect(page).toHaveURL(/\/bonus-discounts/);
    });

});
