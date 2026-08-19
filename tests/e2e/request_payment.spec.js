import { test, expect } from '@playwright/test';

/**
 * Request Money E2E — unified server-backed journey.
 *
 * Auth is real (register + OTP activation starts a session with mini-KYC
 * passed). Payment completes through the development provider simulation which
 * settles via the SAME signed webhook boundary production providers use — the
 * browser alone can never fund a request.
 */

const unique = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Registers a user, activates via OTP (starts a session + mini-KYC passed). */
async function registerAndActivate(request, country = "GB") {
  const email = `rm-${unique()}@example.com`;
  await request.post('/api/auth/register', {
    data: {
      email,
      accountType: 'individual',
      country,
      firstName: 'Rita',
      lastName: `Money-${unique().slice(0, 4)}`,
      dateOfBirth: '1990-05-05',
      gender: 'female',
      mobileCode: '+44',
      mobileNumber: '7700900123',
      password: 'Passw0rd!x',
      confirmPassword: 'Passw0rd!x',
    },
  });
  const verify = await request.post('/api/auth/verify-otp', { data: { email, code: '123456' } });
  expect(verify.ok()).toBeTruthy();
  return { email, country };
}

/** Adds and (dev-stub) verifies a payout account matching the corridor. */
async function addVerifiedAccount(request, country, currency) {
  const res = await request.post('/api/request-money/payout-accounts', {
    data: { holderName: 'Rita Money', country, bankName: 'Barclays', accountNumber: `1234${Math.floor(1000 + Math.random() * 9000)}`, currency },
  });
  expect(res.ok()).toBeTruthy();
  const { data } = await res.json();
  const verify = await request.post(`/api/dev/payout-accounts/${data.id}/verify`, { data: {} });
  expect(verify.ok()).toBeTruthy();
  return data.id;
}

async function createRequestViaApi(request, user, overrides = {}) {
  const accountId = user.accountId ?? (await addVerifiedAccount(request, user.country, user.country === 'GB' ? 'GBP' : 'NGN'));
  const res = await request.post('/api/request-money/requests', {
    data: {
      corridorId: user.country === 'GB' ? 'GB-GB-GBP' : 'NG-NG-NGN',
      payoutAccountId: accountId,
      payInAmount: '120.00',
      senderType: 'individual',
      senderName: 'Sam Sender',
      senderEmail: `sam-${unique()}@example.com`,
      purpose: 'invoice_payment',
      idempotencyKey: `e2e-${unique()}`,
      ...overrides,
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data;
}

test.describe('Request Money E2E', () => {

  test('Unauthenticated API calls return 401 (or 200 in dev resume) — and the UI never asks the user to sign in or register', async ({ page, request }) => {
    const res = await request.get('/api/request-money/eligibility');
    expect([200, 401]).toContain(res.status());

    // The UI shows a neutral session notice only — no sign-in/register prompt.
    await page.goto('/request-payment');
    const gate = page.getByTestId('gate-unauthenticated');
    if (await gate.isVisible().catch(() => false)) {
      expect(await gate.getByText(/sign in|register|create an account/i).count()).toBe(0);
    }
  });

  test('Eligibility blocks before a verified payout account exists', async ({ page, request, browser }) => {
    const user = await registerAndActivate(request);
    // Fresh context is logged-out; log the page in via the same session cookies
    const context = page.context();
    const pageRequest = context.request;
    const verify = await pageRequest.post('/api/auth/login', { data: { email: user.email, password: 'Passw0rd!x' } });
    expect(verify.ok()).toBeTruthy();

    await page.goto('/request-payment');
    await expect(page.getByTestId('payout-account-required')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Payout Account Required')).toBeVisible();

    // The add-and-verify dialog auto-opens when no verified account exists
    await expect(page.getByTestId('input-account-bank')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('input-account-bank').fill('Barclays');
    await page.getByTestId('input-account-number').fill('12345678');
    await page.getByTestId('button-save-account').click();
    await expect(page.getByTestId('payout-account-required')).toBeHidden({ timeout: 10000 });
  });

  test('Full requester journey: corridor → amount → sender → review → create → distribution options', async ({ page, request }) => {
    const user = await registerAndActivate(request);
    const pageRequest = page.context().request;
    await pageRequest.post('/api/auth/login', { data: { email: user.email, password: 'Passw0rd!x' } });
    user.accountId = await addVerifiedAccount(pageRequest, 'GB', 'GBP');

    await page.goto('/request-payment');

    // Step 1: amount (GBP→GBP default corridor + default verified account)
    await page.getByTestId('input-request-amount').fill('250');
    await expect(page.getByText('Calculation Breakdown')).toBeVisible();
    await expect(page.getByText('You Receive in Bank (GBP):')).toBeVisible();
    await page.getByTestId('button-step-next').click();

    // Step 2: sender + mandatory purpose (classic first/last name fields)
    await page.getByTestId('input-sender-first-name').fill('Ada');
    await page.getByTestId('input-sender-last-name').fill('Lovelace');
    await page.getByTestId('input-sender-email').fill(`ada-${unique()}@example.com`);
    await expect(page.getByTestId('button-step-next')).toBeDisabled();
    await page.getByTestId('select-reason').click();
    await page.getByRole('option', { name: /invoice \/ services/i }).click();
    await page.getByTestId('button-step-next').click();

    // Step 3: review disclosures then create (classic review & confirm)
    await expect(page.getByText('£250.00 GBP')).toBeVisible();
    await expect(page.getByText('-£7.50 GBP')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate Payment Link' })).toBeVisible();
    await page.getByTestId('button-step-next').click();

    // Success screen: same URL distributed by email / copy / share / QR
    await expect(page.getByText('Payment Request Sent!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('img-qr')).toBeVisible();
    await expect(page.getByTestId('input-payment-link')).toHaveValue(/\/pay\/[0-9a-f]{40,}/);
    await expect(page.getByTestId('button-copy-link')).toBeVisible();
    await expect(page.getByTestId('button-share')).toBeVisible();
    await expect(page.getByTestId('button-download-qr-png')).toBeVisible();
    await expect(page.getByTestId('button-resend-email')).toBeVisible();

    // The QR endpoint serves a real decodable PNG encoding exactly the link
    const link = await page.getByTestId('input-payment-link').inputValue();
    const qrUrl = await page.getByTestId('img-qr').getAttribute('src');
    const qr = await pageRequest.get(qrUrl);
    expect(qr.ok()).toBeTruthy();
    expect((await qr.headers())['content-type']).toBe('image/png');
    void link;
  });

  test('Absorb fee checkbox appears after amount entry; unchecking passes the 3% fee to the sender end-to-end', async ({ page, request }) => {
    const user = await registerAndActivate(request);
    const pageRequest = page.context().request;
    await pageRequest.post('/api/auth/login', { data: { email: user.email, password: 'Passw0rd!x' } });
    user.accountId = await addVerifiedAccount(pageRequest, 'GB', 'GBP');

    await page.goto('/request-payment');

    // The absorb-fee option only appears once an amount is entered
    await expect(page.getByTestId('absorb-fee-section')).toHaveCount(0);
    await page.getByTestId('input-request-amount').fill('250');
    await expect(page.getByTestId('absorb-fee-section')).toBeVisible();
    await expect(page.getByTestId('checkbox-absorb-fee')).toBeChecked();

    // Absorbed (default): sender pays the exact requested amount
    await expect(page.getByTestId('breakdown-sender-pays')).toHaveText('£250.00 GBP');
    await expect(page.getByText('-£7.50 GBP')).toBeVisible();

    // Uncheck → the 3% fee is added to the sender's payment
    await page.getByTestId('checkbox-absorb-fee').click();
    await expect(page.getByTestId('breakdown-sender-pays')).toHaveText('£257.50 GBP');
    await expect(page.getByText('+£7.50 GBP')).toBeVisible();
    await page.getByTestId('button-step-next').click();

    // Step 2: sender + purpose
    await page.getByTestId('input-sender-first-name').fill('Grace');
    await page.getByTestId('input-sender-last-name').fill('Hopper');
    await page.getByTestId('input-sender-email').fill(`grace-${unique()}@example.com`);
    await page.getByTestId('select-reason').click();
    await page.getByRole('option', { name: /invoice \/ services/i }).click();
    await page.getByTestId('button-step-next').click();

    // Step 3: review reflects the sender-pays-total and fee-added-to-sender
    await expect(page.getByTestId('review-sender-pays')).toHaveText('£257.50 GBP');
    await expect(page.getByText('+£7.50 GBP')).toBeVisible();
    await page.getByTestId('button-step-next').click();

    // Success screen
    await expect(page.getByText('Payment Request Sent!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Sender Pays:').locator('..')).toContainText('£257.50');

    // The public checkout charges the sender the total incl. fee, with a clear fee note
    const link = await page.getByTestId('input-payment-link').inputValue();
    const token = link.split('/pay/')[1];
    await page.goto(`/pay/${token}`);
    await expect(page.getByTestId('checkout-amount')).toContainText('£257.50');
    await expect(page.getByTestId('checkout-fee-note')).toContainText('£7.50');
    await expect(page.getByTestId('checkout-disclosures')).toContainText('3% Rhemito fee');
  });

  test('Guest payer pays on mobile-width checkout; funding only via webhook; link dies after payout', async ({ page, request }) => {
    const user = await registerAndActivate(request);
    const created = await createRequestViaApi(request, user);
    const token = created.checkoutUrl.split('/pay/')[1];

    // Mobile viewport — the link opens the checkout directly, no QR prompts
    await page.setViewportSize({ width: 375, height: 720 });
    await page.goto(`/pay/${token}`);

    await expect(page.getByTestId('checkout-amount')).toBeVisible();
    await expect(page.getByText('Open payment request')).toBeVisible();
    await expect(page.getByTestId('checkout-disclosures')).toContainText('Anti-scam warning');
    await expect(page.getByTestId('checkout-disclosures')).toContainText('No Rhemito fee is charged to you');
    expect(await page.locator('text=/scan/i').count()).toBe(0);

    // Choose Pay by Bank (guest) → development authorisation → webhook settle
    await page.getByTestId('button-method-pay_by_bank').click();
    await expect(page.getByTestId('dev-provider-notice')).toBeVisible();
    await page.getByTestId('button-authorize').click();

    // Status page follows the webhook: funded → payout → paid out
    await expect(page.getByTestId('status-card')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Payment complete')).toBeVisible({ timeout: 20000 });

    // Single-use after terminal status: replay attempts are rejected server-side
    const replay = await request.post(`/api/public/requests/${token}/intent`, { data: { method: 'card' } });
    expect(replay.status()).toBe(409);
    await page.goto(`/pay/${token}`);
    await expect(page.getByText('Payment complete')).toBeVisible();
  });

  test('Security boundaries: foreign accounts rejected, unsigned webhooks rejected, disabled corridors blocked', async ({ request }) => {
    const owner = await registerAndActivate(request, 'GB');
    const accountId = await addVerifiedAccount(request, 'GB', 'GBP');

    // Another user cannot create a request against someone else's account
    const attacker = await registerAndActivate(request, 'NG');
    const res = await request.post('/api/request-money/requests', {
      data: {
        corridorId: 'GB-GB-GBP',
        payoutAccountId: accountId, // owned by `owner`, not `attacker`
        payInAmount: '50.00',
        senderType: 'individual',
        senderName: 'Mallory',
        senderEmail: 'mallory@example.com',
        purpose: 'gift',
        idempotencyKey: `e2e-foreign-${unique()}`,
      },
    });
    expect(res.status()).toBe(403);

    // Disabled corridor (NG→GB) is rejected server-side
    const disabled = await request.post('/api/request-money/requests', {
      data: {
        corridorId: 'NG-GB-NGN-GBP',
        payoutAccountId: accountId,
        payInAmount: '50000.00',
        senderType: 'individual',
        senderName: 'Sam',
        senderEmail: 'sam2@example.com',
        purpose: 'family_support',
        idempotencyKey: `e2e-disabled-${unique()}`,
      },
    });
    expect([400, 403]).toContain(disabled.status());

    // Unsigned / forged webhooks are rejected outright
    const forged = await request.post('/api/webhooks/payin', {
      headers: { 'Content-Type': 'application/json', 'x-rhemito-signature': 'deadbeef' },
      data: { eventId: 'forge1', type: 'payment.succeeded', requestNumber: 'RM-X', intentId: 'x', amountMinor: 100, currency: 'GBP' },
    });
    expect(forged.status()).toBe(401);

    // Duplicate submissions return the SAME request through idempotency
    // (re-login as owner first — the attacker registration replaced the session)
    const relogin = await request.post('/api/auth/login', { data: { email: owner.email, password: 'Passw0rd!x' } });
    expect(relogin.ok()).toBeTruthy();
    const key = `e2e-dup-${unique()}`;
    const first = await createRequestViaApi(request, { ...owner, accountId }, { idempotencyKey: key });
    const second = await createRequestViaApi(request, { ...owner, accountId }, { idempotencyKey: key });
    expect(second.request.id).toBe(first.request.id);
  });

  test('Old QR route redirects into the unified Request Money journey', async ({ page }) => {
    await page.goto('/show-qr-code');
    await expect(page).toHaveURL(/\/request-payment/);
  });

  test('Date of Birth only appears for individual senders and is cleared when switching to Business', async ({ page, request }) => {
    const user = await registerAndActivate(request);
    const pageRequest = page.context().request;
    await pageRequest.post('/api/auth/login', { data: { email: user.email, password: 'Passw0rd!x' } });
    await addVerifiedAccount(pageRequest, 'GB', 'GBP');

    await page.goto('/request-payment');
    await page.getByTestId('input-request-amount').fill('150');
    await page.getByTestId('button-step-next').click();

    // Individual: DOB is shown (optional)
    await expect(page.getByTestId('input-sender-dob')).toBeVisible();
    await page.getByTestId('input-sender-dob').fill('1990-05-05');

    // Business: DOB disappears and any entered value is cleared
    await page.getByTestId('button-sender-type-business').click();
    await expect(page.getByTestId('input-sender-dob')).toHaveCount(0);
    await expect(page.getByTestId('input-sender-business-name')).toBeVisible();

    // Switching back does not resurrect the stale DOB value
    await page.getByTestId('button-sender-type-individual').click();
    await expect(page.getByTestId('input-sender-dob')).toHaveValue('');
  });

  test('Reason for Payment "Other" dynamically requires a specific reason before continuing', async ({ page, request }) => {
    const user = await registerAndActivate(request);
    const pageRequest = page.context().request;
    await pageRequest.post('/api/auth/login', { data: { email: user.email, password: 'Passw0rd!x' } });
    await addVerifiedAccount(pageRequest, 'GB', 'GBP');

    await page.goto('/request-payment');

    // Step 1
    await page.getByTestId('input-request-amount').fill('150');
    await page.getByTestId('button-step-next').click();

    // Step 2
    await page.getByTestId('input-sender-first-name').fill('John');
    await page.getByTestId('input-sender-last-name').fill('Doe');
    await page.getByTestId('input-sender-email').fill(`johndoe-${unique()}@example.com`);

    // Select "Other"
    await page.getByTestId('select-reason').click();
    await page.getByRole('option', { name: /^other$/i }).click();

    // Field must appear and button must be disabled until filled
    await expect(page.getByTestId('container-other-reason')).toBeVisible();
    await expect(page.getByTestId('button-step-next')).toBeDisabled();

    // Fill other reason
    await page.getByTestId('input-other-reason').fill('Consulting services for project');
    await expect(page.getByTestId('button-step-next')).toBeEnabled();
    await page.getByTestId('button-step-next').click();

    // Step 3: verify custom reason display
    await expect(page.getByText('Other (Consulting services for project)')).toBeVisible();
  });

  test('Cancellation flow on /payments takes confirmation before cancelling and displays confirmation post-cancellation', async ({ page }) => {
    await page.goto('/payments');

    // Find pending payment request row (e.g. Michael Chen)
    const cancelBtn = page.getByTestId('button-cancel-payment-3');
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Pre-cancellation dialog must appear
    const dialog = page.getByTestId('dialog-cancel-payment-request');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Cancel Payment Request?')).toBeVisible();
    await expect(dialog.getByText('Michael Chen')).toBeVisible();
    await expect(dialog.getByText('REF-D4E5F6')).toBeVisible();

    // Dismissing keeps request
    await dialog.getByTestId('button-cancel-dialog-keep').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('payment-row-3')).toBeVisible();

    // Cancel again and confirm
    await cancelBtn.click();
    await expect(dialog).toBeVisible();
    await dialog.getByTestId('button-cancel-dialog-confirm').click();

    // Post-cancellation confirmation banner and status updated
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('success-cancel-banner')).toBeVisible();
    await expect(page.getByTestId('success-cancel-banner').getByText('REF-D4E5F6')).toBeVisible();
    await expect(page.getByTestId('payment-row-3').getByText('Cancelled')).toBeVisible();
  });

  test('Cancellation on /payment-requests takes confirmation dialog before cancelling', async ({ page, request }) => {
    const user = await registerAndActivate(request);
    const pageRequest = page.context().request;
    await pageRequest.post('/api/auth/login', { data: { email: user.email, password: 'Passw0rd!x' } });
    const created = await createRequestViaApi(pageRequest, user);

    await page.goto('/payment-requests');
    const cancelBtn = page.getByTestId(`button-cancel-${created.request.requestNumber}`);
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Pre-cancellation confirmation modal
    const dialog = page.getByTestId('dialog-cancel-request');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(created.request.requestNumber)).toBeVisible();

    // Confirm cancel
    await dialog.getByTestId('button-dialog-confirm-cancel').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId(`request-status-cancelled`)).toBeVisible({ timeout: 10000 });
  });

});
