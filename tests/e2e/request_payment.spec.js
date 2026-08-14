import { test, expect } from '@playwright/test';

test.describe('Request Payment Functionality E2E', () => {

  test('Complete Request Payment flow with Cross-Currency FX Notice', async ({ page }) => {
    // 1. Navigate to Request Payment
    await page.goto('/request-payment');
    await expect(page.getByRole('heading', { name: 'Request Payment' })).toBeVisible();

    // 2. Step 1: Amount & Currencies
    const amountInput = page.getByTestId('input-request-amount');
    await expect(amountInput).toBeVisible();
    await amountInput.fill('250');

    // Select USD as sender currency (payout account is default GBP Barclays, creating cross-currency)
    await page.getByTestId('select-sender-currency').click();
    await page.getByRole('option', { name: /USD/i }).click();

    // Verify calculation breakdown shows live spot rate notice
    await expect(page.getByText('Live Spot Rate at Payout')).toBeVisible();

    // Click Continue - should open FX Spot Rate notice modal
    await page.getByTestId('button-step-next').click();
    await expect(page.getByText('FX Conversion Notice')).toBeVisible();
    await expect(page.getByText(/FX Spot rates at the time of payout/i)).toBeVisible();

    // Click Continue inside FX Modal to proceed to Step 2
    await page.getByRole('button', { name: 'Continue' }).click();

    // 3. Step 2: Sender Information
    await expect(page.getByTestId('input-sender-first-name')).toBeVisible();
    await page.getByTestId('input-sender-first-name').fill('Sarah');
    await page.getByTestId('input-sender-last-name').fill('Jenkins');
    await page.getByTestId('input-sender-email').fill('sarah.jenkins@example.com');

    // Click Continue to Step 3
    await page.getByTestId('button-step-next').click();

    // 4. Step 3: Review & Confirm
    await expect(page.getByRole('button', { name: 'Generate Payment Link' })).toBeVisible();
    await expect(page.getByText('$250.00 USD')).toBeVisible();
    await expect(page.getByText('sarah.jenkins@example.com')).toBeVisible();
    await expect(page.getByText('Applied at live spot rate upon payout')).toBeVisible();

    // Generate Payment Link
    await page.getByTestId('button-step-next').click();

    // 5. Success Screen
    await expect(page.getByText('Payment Request Sent!')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/The payment link has been sent to/i)).toBeVisible();
    await expect(page.getByText('sarah.jenkins@example.com')).toBeVisible();
    await expect(page.getByTestId('input-payment-link')).toBeVisible();
    await expect(page.getByTestId('button-copy-link')).toBeVisible();
  });

  test('Request Payment Same-Currency Flow (GBP to GBP)', async ({ page }) => {
    await page.goto('/request-payment');

    // Step 1: Same currency GBP
    await page.getByTestId('input-request-amount').fill('100');
    await page.getByTestId('select-sender-currency').click();
    await page.getByRole('option', { name: /GBP/i }).click();

    // Continue directly to Step 2 without FX modal
    await page.getByTestId('button-step-next').click();
    await expect(page.getByTestId('input-sender-first-name')).toBeVisible();

    // Fill sender
    await page.getByTestId('input-sender-first-name').fill('Michael');
    await page.getByTestId('input-sender-email').fill('michael@example.com');

    // Go to Review
    await page.getByTestId('button-step-next').click();
    await expect(page.getByRole('button', { name: 'Generate Payment Link' })).toBeVisible();
    await expect(page.getByText('£100.00 GBP')).toBeVisible();

    // Submit
    await page.getByTestId('button-step-next').click();
    await expect(page.getByText('Payment Request Sent!')).toBeVisible();
    await expect(page.getByText('michael@example.com')).toBeVisible();
  });

  test('Single-Use Payment Link Invalidation after Settlement', async ({ page }) => {
    const testLinkId = `ref-test-${Date.now()}`;
    await page.goto(`/pay/${testLinkId}`);

    // Enter email for existing user
    await page.locator('#email').fill('user@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Enter password and log in
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: /Log in and Pay/i }).click();

    // Select Wallet Balance payment
    await page.getByText('Wallet Balance').click();

    // Verify Payment Success Screen (headline is "Payment Successful")
    await expect(page.getByText('Payment Successful')).toBeVisible({ timeout: 5000 });

    // Reload / re-visit the same single-use payment link
    await page.goto(`/pay/${testLinkId}`);

    // Verify that the link is permanently invalidated
    await expect(page.getByText('Payment Link No Longer Valid')).toBeVisible();
    await expect(page.getByText('Status: Completed')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go to Rhemito Home' })).toBeVisible();
  });

});
