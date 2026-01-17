const { test, expect } = require('@playwright/test');

test.describe('Bonus & Wallet Ledger', () => {

    test('Navigate and Manage Bonus Schemes', async ({ page }) => {
        // Start at root
        await page.goto('/');
        await expect(page).toHaveTitle(/Mito Admin/i);

        // Wait for hydration
        await page.waitForTimeout(1000);

        // Sidebar Navigation
        await page.click('text=Bonus Scheme Manager');

        await expect(page.getByText('Bonus Scheme Manager')).toBeVisible({ timeout: 15000 });

        // Create Scheme
        const schemeName = `Test Scheme ${Date.now()}`;
        await page.fill('input[placeholder="e.g. Transaction Threshold Credit"]', schemeName);
        await page.selectOption('select:has-text("Bonus Type")', 'LOYALTY_CREDIT');

        await page.fill('input[placeholder="0.00"]', '50');

        // Select Currency (New Feature)
        await page.selectOption('select:has-text("Currency")', 'USD');

        const today = new Date().toISOString().split('T')[0];
        const dateInputs = await page.locator('input[type="date"]');
        await dateInputs.nth(0).fill(today);
        await dateInputs.nth(1).fill(today);

        await page.getByRole('button', { name: 'Create Scheme' }).click();

        // Verification
        await expect(page.getByText(schemeName)).toBeVisible({ timeout: 10000 });
        // Verify currency display in table (e.g., "USD 50.00")
        await expect(page.getByText('USD 50.00')).toBeVisible();
    });

    test('Navigate and Adjust Credit Ledger', async ({ page }) => {
        await page.goto('/');
        // Wait for hydration
        await page.waitForTimeout(1000);

        await page.click('text=Bonus Wallet / Ledger');

        await expect(page.getByText('User Credit Ledger')).toBeVisible({ timeout: 15000 });

        // Verify Dummy Data Note is visible
        await expect(page.getByText('Ref: #9988')).toBeVisible({ timeout: 10000 });

        // Click on the note to open Audit Modal
        await page.getByText('Ref: #9988').click();

        // Verify Modal content
        await expect(page.getByText('Transaction Details')).toBeVisible();
        await expect(page.getByText('Audit History')).toBeVisible();
        await expect(page.getByText('Expires')).toBeVisible();

        // Close Modal
        await page.getByRole('button', { name: 'Close' }).click();
        await expect(page.getByText('Transaction Details')).not.toBeVisible();
    });

});
