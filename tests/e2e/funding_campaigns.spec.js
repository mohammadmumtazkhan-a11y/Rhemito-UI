import { test, expect } from '@playwright/test';

test.describe('Funding Campaigns', () => {

    test('Navigate to Funding Campaigns', async ({ page }) => {
        await page.goto('/');

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

        // Submit
        await page.getByRole('button', { name: 'Create Funding Campaign' }).click();

        // Should redirect to Dashboard or Details
        // We'll check for the presence of the campaign name in the dashboard list or details view
        await expect(page.getByText('Test Office Party')).toBeVisible();
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
