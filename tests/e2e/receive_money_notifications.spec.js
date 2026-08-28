import { test, expect } from '@playwright/test';

test.describe('Receive Money Notifications', () => {
    test('Bell icon shows notifications and lists Receive Money items', async ({ page }) => {
        await page.goto('/');

        // Verify bell button is visible
        const bellButton = page.getByTestId('button-notifications');
        await expect(bellButton).toBeVisible();

        // Click bell button to open notification panel
        await bellButton.click();

        // Check panel heading
        await expect(page.getByText('Notifications', { exact: true })).toBeVisible({ timeout: 5000 });

        // Verify Receive Money notifications are present
        await expect(page.getByText('Money Request Paid').first()).toBeVisible();
        await expect(page.getByText('Invoice Paid').first()).toBeVisible();
        await expect(page.getByText('New Campaign Contribution').first()).toBeVisible();
    });

    test('Clicking money request notification navigates to detail and has View in Transactions button', async ({ page }) => {
        await page.goto('/notifications/demo-notification-5');

        // Verify detail content
        await expect(page.getByRole('heading', { name: 'Money Request Paid' })).toBeVisible({ timeout: 5000 });
        await expect(page.getByText('Ngozi Okafor has paid 300.70 GBP')).toBeVisible();

        // Verify contextual button
        const viewInTransactionsBtn = page.getByTestId('button-view-receive-money');
        await expect(viewInTransactionsBtn).toBeVisible();

        // Click contextual button
        await viewInTransactionsBtn.click();
        await expect(page).toHaveURL(/\/transactions\?type=receive_money/);
    });

    test('Clicking invoice notification shows View Invoices button', async ({ page }) => {
        await page.goto('/notifications/demo-notification-6');

        await expect(page.getByRole('heading', { name: 'Invoice Paid' })).toBeVisible({ timeout: 5000 });
        await expect(page.getByText('Payment of 750.00 GBP for invoice INV-202608-00001')).toBeVisible();

        const viewInvoicesBtn = page.getByTestId('button-view-invoices');
        await expect(viewInvoicesBtn).toBeVisible();
        await viewInvoicesBtn.click();
        await expect(page).toHaveURL(/\/invoices/);
    });

    test('Clicking campaign notification shows View Campaigns button', async ({ page }) => {
        await page.goto('/notifications/demo-notification-7');

        await expect(page.getByRole('heading', { name: 'New Campaign Contribution' })).toBeVisible({ timeout: 5000 });
        await expect(page.getByText('Samuel Jackson contributed 150.00 GBP')).toBeVisible();

        const viewCampaignsBtn = page.getByTestId('button-view-campaigns');
        await expect(viewCampaignsBtn).toBeVisible();
        await viewCampaignsBtn.click();
        await expect(page).toHaveURL(/\/group-pay/);
    });
});
