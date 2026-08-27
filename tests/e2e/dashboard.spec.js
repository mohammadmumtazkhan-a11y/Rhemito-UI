import { test, expect } from '@playwright/test';

test.describe('Rhemito Dashboard', () => {

    test('Dashboard loads correctly', async ({ page }) => {
        // Navigate to Dashboard
        await page.goto('/');

        // Verify page title
        await expect(page).toHaveTitle(/Rhemito/i);

        // Verify Quick Services widget is visible
        await expect(page.getByText('Quick Services')).toBeVisible();

        // Verify Quick Service buttons are present
        await expect(page.getByTestId('button-send-money')).toBeVisible();
        await expect(page.getByTestId('button-airtime-topup')).toBeVisible();
        await expect(page.getByTestId('button-request-payment')).toBeVisible();

        // Verify unified Transactions table with its type filter chips
        await expect(page.getByTestId('table-transactions')).toBeVisible();
        await expect(page.getByTestId('chip-type-all')).toBeVisible();
        await expect(page.getByTestId('chip-type-send-money')).toBeVisible();
        await expect(page.getByTestId('chip-type-receive-money')).toBeVisible();
        await expect(page.getByTestId('chip-type-invoice')).toBeVisible();
        await expect(page.getByTestId('chip-type-campaign')).toBeVisible();
    });

    test('Quick Services - Send Money navigation', async ({ page }) => {
        await page.goto('/');

        // Click Send Money button
        await page.getByTestId('button-send-money').click();

        // Verify navigation to Send Money page
        await expect(page).toHaveURL(/\/send-money/);
    });

    test('Quick Services - Request Payment opens modal', async ({ page }) => {
        await page.goto('/');

        // Click Request Payment button
        await page.getByTestId('button-request-payment').click();

        // Wait for modal content to appear - use specific test ID for modal buttons
        await expect(page.getByTestId('button-request')).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('button-invoice')).toBeVisible();
    });

    test('Unified Transactions table displays data', async ({ page }) => {
        await page.goto('/');

        // Verify transactions table has rows
        await expect(page.getByTestId('row-transaction-22502784')).toBeVisible();

        // Verify Resend button is present on completed transaction
        await expect(page.getByTestId('button-resend-22502785')).toBeVisible();
    });

    test('Transaction type filters narrow the unified table', async ({ page }) => {
        await page.goto('/');

        // All paginates the merged list — recent rows stay on page 1
        await expect(page.getByTestId('row-transaction-22502784')).toBeVisible();

        // Send Money chip keeps the recent + scheduled rows on one page
        await page.getByTestId('chip-type-send-money').click();
        await expect(page.getByTestId('row-transaction-22502784')).toBeVisible();
        await expect(page.getByTestId('row-scheduled-SCH001')).toBeVisible();

        // Invoices chip hides the send-money prototype rows
        await page.getByTestId('chip-type-invoice').click();
        await expect(page.getByTestId('row-transaction-22502784')).toBeHidden();
    });

    test('Transaction search narrows the unified table', async ({ page }) => {
        await page.goto('/');

        await page.getByTestId('input-search-transactions').fill('Aisha Bello');
        await expect(page.getByTestId('row-transaction-22502787')).toBeVisible();
        await expect(page.getByTestId('row-transaction-22502784')).toBeHidden();

        // Clearing the search restores the rows
        await page.getByTestId('input-search-transactions').fill('');
        await expect(page.getByTestId('row-transaction-22502784')).toBeVisible();
    });

    test('Unified table paginates at 20 records max per page across all types', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('chip-type-all')).toBeVisible();

        // Seeded demo data spans send money, receive money, invoices and campaigns (22+ rows)
        const rows = page.locator('[data-testid^="row-transaction-"], [data-testid^="row-scheduled-"], [data-testid^="row-receive_money-"], [data-testid^="row-invoice-"], [data-testid^="row-campaign-"]');
        await expect(rows).toHaveCount(20, { timeout: 10000 });
        await expect(page.getByTestId('transactions-pagination')).toContainText('Page 1 of');

        // Page 2 holds the remainder
        await page.getByTestId('button-next-page').click();
        await expect(rows.first()).toBeVisible();
        expect(await rows.count()).toBeGreaterThan(0);
        expect(await rows.count()).toBeLessThan(20);
        await expect(page.getByTestId('transactions-pagination')).toContainText('Page 2 of');

        // Back to page 1
        await page.getByTestId('button-prev-page').click();
        await expect(rows).toHaveCount(20);
    });

});
