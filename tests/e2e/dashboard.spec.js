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

        // Verify Recent Transactions section
        await expect(page.getByTestId('tab-recent-transactions')).toBeVisible();
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
        await expect(page.getByTestId('button-qrcode')).toBeVisible();
    });

    test('Recent Transactions table displays data', async ({ page }) => {
        await page.goto('/');

        // Verify transactions table has rows
        await expect(page.getByTestId('row-transaction-22502784')).toBeVisible();

        // Verify Resend button is present
        await expect(page.getByTestId('button-resend-22502784')).toBeVisible();
    });

    test('Scheduled Transactions tab works', async ({ page }) => {
        await page.goto('/');

        // Click Scheduled tab
        await page.getByTestId('tab-scheduled-transactions').click();

        // Verify scheduled transaction is visible
        await expect(page.getByTestId('row-scheduled-SCH001')).toBeVisible();
    });

});
