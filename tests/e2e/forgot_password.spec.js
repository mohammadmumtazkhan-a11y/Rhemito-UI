import { test, expect } from '@playwright/test';

/**
 * Forgot Password E2E — 6-digit email PIN reset flow on the sign-in page.
 *
 * Seeds a freshly registered + activated account, walks the real UI flow
 * (forgot → send PIN → enter PIN + new password → confirmation toast →
 * auto sign-in redirect), then proves the password actually changed via the
 * API. Demo mode (on by default) echoes the devPin in the amber prototype tip.
 */

const unique = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

test.describe('Forgot password', () => {
  test('resets the password via 6-digit email PIN, toasts, and auto signs in', async ({ page, request }) => {
    const email = `fp-${unique()}@example.com`;
    const oldPassword = 'Passw0rd!x';
    const newPassword = 'NewPass123!x';

    // Seed: register + activate a unique account (OTP 123456 in the prototype).
    await request.post('/api/auth/register', {
      data: {
        email,
        accountType: 'individual',
        country: 'GB',
        firstName: 'Fiona',
        lastName: 'Payer',
        dateOfBirth: '1990-05-05',
        gender: 'female',
        mobileCode: '+44',
        mobileNumber: '7700900123',
        password: oldPassword,
        confirmPassword: oldPassword,
      },
    });
    const verify = await request.post('/api/auth/verify-otp', { data: { email, code: '123456' } });
    expect(verify.ok()).toBeTruthy();

    // Sign-in page → email step → registered account lands on the sign-in step.
    await page.goto('/sign-in-sign-up');
    await page.getByPlaceholder('e.g. jamescollor@email.com').fill(email);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Sign in to your account')).toBeVisible();

    // Enter the forgot-password flow (email prefilled from the sign-in step).
    await page.getByTestId('button-forgot-password').click();
    await expect(page.getByTestId('input-forgot-email')).toHaveValue(email);

    // Send the PIN — demo mode surfaces it in the amber prototype tip.
    await page.getByTestId('button-send-pin').click();
    const tip = page.getByTestId('dev-pin-hint');
    await expect(tip).toBeVisible();
    const pin = (await tip.innerText()).match(/\d{6}/)[0];

    // Enter PIN + new password.
    await page.getByTestId('input-reset-pin').fill(pin);
    await page.getByTestId('input-new-password').fill(newPassword);
    await page.getByTestId('input-confirm-new-password').fill(newPassword);
    await page.getByTestId('button-reset-password').click();

    // Confirmation toast + auto sign-in redirect home.
    await expect(page.getByText('Password Successfully Reset', { exact: true })).toBeVisible();
    await page.waitForURL('**/', { timeout: 10000 });

    // The password really changed: new one works, old one is rejected.
    const reLogin = await request.post('/api/auth/login', { data: { email, password: newPassword } });
    expect(reLogin.ok()).toBeTruthy();
    const oldLogin = await request.post('/api/auth/login', { data: { email, password: oldPassword } });
    expect(oldLogin.ok()).toBeFalsy();
  });

  test('rejects an incorrect PIN with attempts remaining and does not reset', async ({ page, request }) => {
    const email = `fp-${unique()}@example.com`;
    const oldPassword = 'Passw0rd!x';

    await request.post('/api/auth/register', {
      data: {
        email,
        accountType: 'individual',
        country: 'GB',
        firstName: 'Felix',
        lastName: 'Payer',
        dateOfBirth: '1991-03-03',
        gender: 'male',
        mobileCode: '+44',
        mobileNumber: '7700900123',
        password: oldPassword,
        confirmPassword: oldPassword,
      },
    });
    await request.post('/api/auth/verify-otp', { data: { email, code: '123456' } });

    await page.goto('/sign-in-sign-up');
    await page.getByPlaceholder('e.g. jamescollor@email.com').fill(email);
    await page.locator('button[type="submit"]').click();
    await page.getByTestId('button-forgot-password').click();
    await page.getByTestId('button-send-pin').click();
    await expect(page.getByTestId('dev-pin-hint')).toBeVisible();

    await page.getByTestId('input-reset-pin').fill('000000');
    await page.getByTestId('input-new-password').fill('NewPass123!x');
    await page.getByTestId('input-confirm-new-password').fill('NewPass123!x');
    await page.getByTestId('button-reset-password').click();

    await expect(page.getByText('Incorrect PIN').first()).toBeVisible();

    // Old password still works — nothing was reset.
    const oldLogin = await request.post('/api/auth/login', { data: { email, password: oldPassword } });
    expect(oldLogin.ok()).toBeTruthy();
  });
});
