import { test, expect } from '@playwright/test';

test.describe('Rhemito Navigation', () => {

    test('Sidebar navigation - Overview', async ({ page }) => {
        await page.goto('/');

        // Click Overview in sidebar
        await page.getByTestId('link-overview').click();

        // Verify we're on dashboard
        await expect(page).toHaveURL('/');
    });

    test('Sidebar logo always navigates to dashboard', async ({ page }) => {
        // Start on a page other than the dashboard
        await page.goto('/senders');
        await expect(page).toHaveURL(/\/senders/);

        // Click the Rhemito logo
        await page.getByTestId('link-logo-home').click();

        // Verify we're back on the dashboard
        await expect(page).toHaveURL('/');
    });

    test('Payments Received pages are consolidated into the dashboard table', async ({ page }) => {
        await page.goto('/');

        // Expand the "Payments Received" accordion
        await page.getByText('Payments Received').click();
        await page.waitForTimeout(500);

        // Received Payments, Money Requests and Sent Invoices no longer have
        // their own sidebar entries — their data lives in the Transactions table.
        await expect(page.getByTestId('link-received-payments')).toHaveCount(0);
        await expect(page.getByTestId('link-money-requests')).toHaveCount(0);
        await expect(page.getByTestId('link-sent-invoices')).toHaveCount(0);

        // The remaining Payments Received entries are still navigable.
        await page.getByTestId('link-senders').click();
        await expect(page).toHaveURL(/\/senders/);
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
