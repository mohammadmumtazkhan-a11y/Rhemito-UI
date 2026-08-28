import { test, expect } from '@playwright/test';

test.describe('Sidebar Transactions navigation & dedicated page', () => {

    test('clicking Transactions in sidebar navigates to /transactions page', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('link-transactions')).toBeVisible();

        // Click Transactions in sidebar
        await page.getByTestId('link-transactions').click();

        // Verify URL and dedicated page elements
        await expect(page).toHaveURL(/\/transactions/);
        await expect(page.getByTestId('section-transactions-page')).toBeVisible();
        await expect(page.getByTestId('table-transactions')).toBeVisible();
        await expect(page.getByTestId('input-search-transactions')).toBeVisible();
        await expect(page.getByTestId('chip-type-all')).toBeVisible();
    });

    test('type query parameter applies the filter on /transactions', async ({ page }) => {
        await page.goto('/transactions?type=send_money');
        await expect(page.getByTestId('table-transactions')).toBeVisible();

        // The Send Money chip is selected instead of All
        await expect(page.getByTestId('chip-type-send-money')).toHaveClass(/bg-blue-600/);
        await expect(page.getByTestId('chip-type-all')).not.toHaveClass(/bg-blue-600/);

        // Every visible row is a Send Money row
        const rows = page.locator('[data-testid^="row-transaction-"], [data-testid^="row-scheduled-"]');
        await expect(rows.filter({ hasNotText: 'Send Money' })).toHaveCount(0);
        await expect(rows.first()).toBeVisible();
    });

    test('switching type filter chips on /transactions updates visible rows', async ({ page }) => {
        await page.goto('/transactions');
        await expect(page.getByTestId('chip-type-all')).toHaveClass(/bg-blue-600/);

        // Click Receive Money chip
        await page.getByTestId('chip-type-receive-money').click();
        await expect(page.getByTestId('chip-type-receive-money')).toHaveClass(/bg-blue-600/);
        await expect(page.getByTestId('chip-type-all')).not.toHaveClass(/bg-blue-600/);
    });

    test('plain dashboard load keeps the All filter by default', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('table-transactions')).toBeVisible();
        await expect(page.getByTestId('chip-type-all')).toHaveClass(/bg-blue-600/);
        await expect(page.getByTestId('chip-type-send-money')).not.toHaveClass(/bg-blue-600/);
    });

});
