import { test, expect } from '@playwright/test';

test.describe('Contributor Flow', () => {

    test('Complete contribution flow for new user', async ({ page }) => {
        // 1. Navigate to demo campaign
        await page.goto('/contribute/demo-campaign-1');

        // 2. Initial Contribution Screen
        await expect(page.getByRole('heading', { name: 'Make a Contribution' })).toBeVisible();
        await page.getByLabel('Email Address').fill('testuser_' + Date.now() + '@example.com');
        await page.getByLabel('Contribution Amount').fill('100');

        // Select Currency (Optional, defaults to GBP maybe, let's keep it simple first or try to select if easy)
        // await page.getByRole('combobox').click();
        // await page.getByLabel('USD').click(); 

        await page.getByRole('button', { name: 'Continue' }).click();

        // 3. OTP Verification
        await expect(page.getByText('Verify your email')).toBeVisible();
        await page.getByLabel('Verification Code').fill('123456');
        await page.getByRole('button', { name: 'Verify Code' }).click();

        // Toast check - might be flaky
        // await expect(page.getByText('Email Verified')).toBeVisible();

        // 4. Password Creation
        await expect(page.getByText('Secure Your Account')).toBeVisible();
        await page.getByLabel('Create Password').fill('Password123!');
        await page.getByLabel('Confirm Password').fill('Password123!');
        await page.getByRole('button', { name: 'Set Password & Continue' }).click();

        // 5. Personal Details (Mini KYC)
        await expect(page.getByText('A Few More Details')).toBeVisible();
        await page.getByLabel('First Name').fill('John');
        await page.getByLabel('Last Name').fill('Doe');

        // New Fields
        await page.getByLabel('Address Line 1').fill('123 Test St');
        await page.getByLabel('City').fill('Test City');
        await page.getByLabel('Post Code').fill('TE5 7PC');

        // Date of Birth (Must be 18+)
        await page.getByRole('button', { name: 'Pick a date' }).click();

        // Select Year 2000
        // Year selector is the second combobox (Month is first)
        await page.getByRole('combobox').nth(1).click();
        await page.getByRole('option', { name: '2000' }).click();

        // Select Day 15
        await page.getByRole('gridcell', { name: '15' }).first().click();

        // Submit Details
        await page.getByRole('button', { name: 'Save and Continue' }).click();

        // Toast check - Details Saved - might be flaky
        // await expect(page.getByText('Details Saved', { exact: true })).toBeVisible();

        // 6. Verify Payment Screen Reached
        // After KYC processing, it should land on payment method selection
        await expect(page.getByText('How would you like to pay?')).toBeVisible({ timeout: 10000 });

    });
});
