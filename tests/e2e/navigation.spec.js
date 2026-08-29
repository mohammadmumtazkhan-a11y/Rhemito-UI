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
        await page.goto('/group-pay');
        await expect(page).toHaveURL(/\/group-pay/);

        // Click the Rhemito logo
        await page.getByTestId('link-logo-home').click();

        // Verify we're back on the dashboard
        await expect(page).toHaveURL('/');
    });

    test('Payments Received and Money Sent accordions are removed from sidebar', async ({ page }) => {
        await page.goto('/');

        // Payments Received & Money Sent accordions are removed from sidebar.
        await expect(page.getByText('Payments Received')).toHaveCount(0);
        await expect(page.getByText('Money Sent')).toHaveCount(0);

        // Standalone main items are directly visible.
        await expect(page.getByTestId('link-senders-&-recipients')).toBeVisible();
        await expect(page.getByTestId('link-collections-accounts')).toBeVisible();
    });

    test('Sidebar navigation - Senders & Recipients (main item)', async ({ page }) => {
        await page.goto('/');

        // Senders & Recipients is a main sidebar entry — no accordion needed.
        await page.getByTestId('link-senders-&-recipients').click();

        // Verify navigation to the consolidated page; Senders is the default tab
        await expect(page).toHaveURL(/\/senders-recipients/);
        await expect(page.getByTestId('panel-senders')).toBeVisible();
        await expect(page.getByTestId('input-search-senders')).toBeVisible();

        // Switching to the Recipients tab reveals the recipients table
        await page.getByTestId('tab-recipients').click();
        await expect(page.getByTestId('panel-recipients')).toBeVisible();
        await expect(page.getByTestId('table-recipients')).toBeVisible();
    });

    test('Senders tab deep link and sender detail round-trip', async ({ page }) => {
        // ?tab=recipients lands directly on the recipients list
        await page.goto('/senders-recipients?tab=recipients');
        await expect(page.getByTestId('panel-recipients')).toBeVisible();
        await expect(page.getByTestId('table-recipients')).toBeVisible();
        await expect(page.getByTestId('panel-senders')).not.toBeVisible();

        // ?tab=senders shows the senders list; View opens the detail page
        // (row testids sanitise @ and . to -, and the URL encodes the email)
        await page.goto('/senders-recipients?tab=senders');
        await page.getByTestId('button-view-john-adeyemi-email-com').click();
        await expect(page).toHaveURL(/\/senders\/john\.adeyemi%40email\.com$/);
        await expect(page.getByTestId('button-back')).toBeVisible();

        // Back returns to the consolidated page on the senders tab
        await page.getByTestId('button-back').click();
        await expect(page).toHaveURL(/\/senders-recipients\?tab=senders/);
        await expect(page.getByTestId('panel-senders')).toBeVisible();
    });

    test('Sidebar navigation - Collections Accounts (main item)', async ({ page }) => {
        await page.goto('/');

        // Click Collections Accounts link (main item)
        await page.getByTestId('link-collections-accounts').click();

        // Verify navigation
        await expect(page).toHaveURL(/\/payout-accounts/);

        // Verify "Add Payout Account" opens the popup modal
        await page.getByTestId('button-open-add-payout-account').click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Add payout bank account' })).toBeVisible();

        // Verify account nickname field is removed
        await expect(page.getByTestId('input-payout-nickname')).toHaveCount(0);

        // Cancel closes the dialog
        await page.getByTestId('button-cancel-payout-modal').click();
        await expect(page.getByRole('dialog')).toBeHidden();

        // Verify clicking edit on an account row opens the edit dialog
        await page.getByTestId('button-edit-1').click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Edit payout bank account' })).toBeVisible();

        // Cancel closes the dialog
        await page.getByTestId('button-cancel-payout-modal').click();
        await expect(page.getByRole('dialog')).toBeHidden();
    });

    test('Sidebar navigation - Transactions', async ({ page }) => {
        await page.goto('/');

        // Click Transactions link
        await page.getByTestId('link-transactions').click();

        // Verify navigation
        await expect(page).toHaveURL(/\/transactions/);
        await expect(page.getByTestId('section-transactions-page')).toBeVisible();
    });

    test('Sidebar navigation - Invoices', async ({ page }) => {
        await page.goto('/');

        // Click Invoices link
        await page.getByTestId('link-invoices').click();

        // Verify navigation to the dedicated Invoices management page
        await expect(page).toHaveURL(/\/invoices/);
        await expect(page.getByTestId('section-invoices-page')).toBeVisible();
        await expect(page.getByTestId('table-invoices')).toBeVisible();
        await expect(page.getByTestId('button-create-invoice')).toBeVisible();
    });

    test('Sidebar navigation - Bonus & Discounts', async ({ page }) => {
        await page.goto('/');

        // Click Bonus & Discounts link
        await page.locator('a[href="/bonus-discounts"]').first().click();

        // Verify navigation
        await expect(page).toHaveURL(/\/bonus-discounts/);
    });

});
