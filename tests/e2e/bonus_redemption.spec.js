import { test, expect } from '@playwright/test';

test('Referral Bonus Redemption Flow', async ({ page }) => {
    // 1. Visit Send Money Page
    await page.goto('/send-money');

    // Step 1: Amount
    // Wait for amount input and fill it
    await page.getByPlaceholder('0.00').first().fill('500');
    // Click Continue
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: Recipient
    await expect(page.getByText('Who are you sending to?')).toBeVisible();
    // Click "New Recipient" button
    await page.getByRole('button', { name: 'New Recipient' }).click();

    // Step 3: Details
    // Fill Recipient Details (using indices as labels are not associated)
    const inputs = page.locator('input');
    // We expect First Name and Last Name inputs.
    // Assuming they are the first visible inputs on this step.
    // Step 3 has First Name, Last Name, Nickname.
    // Note: Search input from previous step might still be in DOM but hidden? 
    // Playwright locator interactions auto-wait for visibility.
    // Use :visible pseudo-selector or stick to order.
    // Let's rely on placeholder or hierarchy? 
    // Inputs don't have placeholders in code (except Nickname).
    // Let's use layout order inside the card.

    // Find the Recipient Details card
    const card = page.locator('.rounded-xl', { hasText: 'Recipient Details' }).first();
    await card.locator('input').nth(0).fill('Test');
    await card.locator('input').nth(1).fill('User');

    // Select Relationship (default might be family, but let's ensure)
    // Select Reason (default might be family_support)
    // Just click Continue since defaults are usually pre-selected or fields are optional?
    // Looking at code: Select defaultValue='family', 'family_support'. So we don't need to interact.

    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 4: Summary
    // Click "Continue to Payment"
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 5: Payment (The focus of our test)
    // 1. Verify Bonus Card is Visible
    await expect(page.getByText('Referral Bonus Available')).toBeVisible();
    await expect(page.getByText('Redeem your £5.00 bonus')).toBeVisible();

    // 2. Test "Pay Less" Option
    const payLessOption = page.getByText('Pay Less');
    await payLessOption.click();

    // Check Status Indicator
    // The "Pay Less" box should be green/active
    // We can check if the Amount Summary shows the discount row
    await expect(page.locator('.bg-green-50').getByText('Referral Bonus', { exact: true })).toBeVisible();
    await expect(page.locator('.bg-green-50').getByText('- 5.00 GBP')).toBeVisible();

    // 3. Test "Send More" Option
    const sendMoreOption = page.getByText('Send More');
    await sendMoreOption.click();

    // Check Status Indicator
    // Amount Summary should show the recipient bonus row
    await expect(page.locator('.bg-green-50').getByText('Referral Bonus (Recipient)')).toBeVisible();
    await expect(page.locator('.bg-green-50').getByText('+ 5.00 GBP')).toBeVisible();
});
