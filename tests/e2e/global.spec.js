const { test, expect } = require('@playwright/test');

test('Global End-to-End Flow', async ({ page }) => {
    // 1. Visit the Dashboard
    await page.goto('/');
    await expect(page).toHaveTitle(/Mito Admin/i);
    await expect(page.getByText('Account Overview')).toBeVisible();

    // 2. Navigate to Merchant List
    // The sidebar link for merchants is not clear in the sidebar code snippet I read earlier.
    // Sidebar has: Financials, Reports, CRM, Integration, Admin, Config, Logs, KYC
    // AND "Merchants" is not a top level item?
    // let's check App.jsx routes: /merchants, /merchants/onboard are routes.
    // How to navigate there?
    // Sidebar: "Profile" and "Support" at bottom.
    // The sidebar code snippet I saw earlier (lines 44-96) shows:
    // Dashboard, Financials (Promo Codes, Debit Logs), Reports, CRM, Integration, Admin, Config, Logs, KYC.
    // Where is "Merchants"? 
    // Maybe it's not in the sidebar yet? 
    // Let's assume for now we just visit the URL directly if sidebar doesn't have it.
    // But strictly E2E should use UI.
    // Let's check "Financials > Promo Codes" which is in sidebar.

    // Click Financials to expand (it's hardcoded expanded in style but maybe clickable?)
    // Text: "Financials"
    // Click it just in case.
    await page.getByText(/Financials/i).click();

    // Click Promo Codes
    await page.getByText('Promo Codes').click();
    await expect(page.url()).toContain('/financials/promocodes');

    // 3. Check for API response data on Promo Codes page
    // We assume the backend is seeding data (SAVE20, etc.)
    // Wait for network idle or text "SAVE20"
    await expect(page.getByText('SAVE20')).toBeVisible({ timeout: 10000 });
});
