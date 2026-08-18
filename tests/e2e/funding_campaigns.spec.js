import { test, expect } from '@playwright/test';

test.describe('Funding Campaigns', () => {

    test('Navigate to Funding Campaigns', async ({ page }) => {
        await page.goto('/');

        // First expand the "Payments Received" accordion
        await page.getByText('Payments Received').click();
        await page.waitForTimeout(500);

        // Click sidebar link
        await page.getByTestId('link-funding-campaigns').click();

        // Verify URL and Title
        await expect(page).toHaveURL(/\/group-pay/);
        await expect(page.getByRole('heading', { name: 'Funding Campaigns', exact: true })).toBeVisible();
    });

    test('Create a new campaign', async ({ page }) => {
        await page.goto('/group-pay');

        // Click Create button
        await page.getByRole('button', { name: 'Create Funding Campaign' }).first().click();
        await expect(page).toHaveURL(/\/group-pay\/create/);

        // Fill form
        await page.getByLabel('Campaign Name').fill('Test Office Party');
        await page.getByLabel('Description').fill('End to end test description');

        // Handle Target Amount
        await page.getByLabel('How much do you want to collect?').fill('100');

        // If payout account dialog is open or needs bank details
        const saveAccountBtn = page.getByTestId('button-save-account');
        if (await saveAccountBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await page.getByTestId('input-account-bank').fill('Barclays');
            await page.getByTestId('input-account-number').fill('12345678');
            await saveAccountBtn.click();
            await expect(saveAccountBtn).toBeHidden({ timeout: 10000 });
        }

        // Submit
        const submitBtn = page.getByRole('button', { name: 'Create Funding Campaign' });
        await expect(submitBtn).toBeEnabled({ timeout: 10000 });
        await submitBtn.click();

        // Should show success view
        await expect(page.getByRole('heading', { name: 'Campaign Created!' })).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('button', { name: 'View Campaign' })).toBeVisible();
    });

    test('Search and functionality', async ({ page }) => {
        await page.goto('/group-pay');

        // Verify Search input exists
        const searchInput = page.getByPlaceholder('Search campaigns...');
        await expect(searchInput).toBeVisible();

        // Type non-existent name
        await searchInput.fill('NonExistentCampaignXYZ');

        // Verify empty state
        // Note: Typo fixed in code "matching"
        await expect(page.getByText('No matching campaigns')).toBeVisible();

        // Clear search
        await page.getByRole('button', { name: 'Clear Filters' }).click();

        // Verify header is visible again. Using strict heading role to avoid matching text in other elements
        await expect(page.getByRole('heading', { name: 'Funding Campaigns', exact: true })).toBeVisible();
    });

    test('View Campaign Details', async ({ page }) => {
        await page.goto('/group-pay');

        // Wait for grid to load by ensuring header is present
        await expect(page.getByRole('heading', { name: 'Funding Campaigns', exact: true })).toBeVisible();

        // Click on the first "View" button found
        const viewButton = page.getByRole('button', { name: 'View' }).first();

        // Check if any campaign exists. If so, test the view.
        if (await viewButton.isVisible()) {
            await viewButton.click();
            await expect(page).toHaveURL(/\/group-pay\/.+/);
            // Check for the "Funds Overview" header card we added
            await expect(page.getByText('Funds Overview')).toBeVisible();
        }
    });

});
