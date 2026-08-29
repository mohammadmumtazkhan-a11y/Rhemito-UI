import { test, expect } from '@playwright/test';

/**
 * Invoices — generation ("generate on the go") and management.
 *
 * Covers the dedicated Invoices page (seeded data, filters, source badges),
 * the PayPal-style generate journey end-to-end (builder → review → send →
 * listed → payer sees the rendered invoice document), and the mutual
 * exclusivity of the Generate and Upload modes (UI and API).
 */

const uniqueSuffix = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Registers "John Doe", activates via OTP — the page context becomes the sender. */
async function setupSender(page) {
  const request = page.context().request;
  const email = `gen-inv-${uniqueSuffix()}@example.com`;
  const register = await request.post('/api/auth/register', {
    data: {
      email,
      accountType: 'individual',
      country: 'GB',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-05-05',
      gender: 'male',
      mobileCode: '+44',
      mobileNumber: '7700900123',
      password: 'Passw0rd!x',
      confirmPassword: 'Passw0rd!x',
    },
  });
  expect(register.ok()).toBeTruthy();
  const verify = await request.post('/api/auth/verify-otp', { data: { email, code: '123456' } });
  expect(verify.ok()).toBeTruthy();
  return { request, email };
}

/** Adds and (dev-stub) verifies a Barclays GBP payout account owned by the session user. */
async function addVerifiedAccount(request) {
  const res = await request.post('/api/request-money/payout-accounts', {
    data: {
      holderName: 'John Doe',
      country: 'GB',
      bankName: 'Barclays',
      accountNumber: `123${Math.floor(1000000 + Math.random() * 9000000)}`,
      currency: 'GBP',
    },
  });
  expect(res.ok()).toBeTruthy();
  const { data } = await res.json();
  const verify = await request.post(`/api/dev/payout-accounts/${data.id}/verify`, { data: {} });
  expect(verify.ok()).toBeTruthy();
  return data.id;
}

test.describe('Invoices — generation and management', () => {

  test('Invoices page lists invoices with source badges, summary cards and filters', async ({ page }) => {
    // Demo session (prototype fallback user) carries the seeded invoices,
    // including the generated ("generate on the go") demo rows.
    await page.goto('/invoices');
    await expect(page.getByTestId('section-invoices-page')).toBeVisible();
    await expect(page.getByTestId('table-invoices')).toBeVisible();

    // Both creation sources are represented and labelled
    await expect(page.getByTestId('badge-source-generated').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('badge-source-uploaded').first()).toBeVisible();

    // Status chips filter the table; every visible row carries the paid status
    await page.getByTestId('chip-status-paid').click();
    await expect(page.locator('[data-testid^="row-invoice-"]').first()).toBeVisible({ timeout: 10000 });
    const rowCount = await page.locator('[data-testid^="row-invoice-"]').count();
    expect(rowCount).toBeGreaterThan(0);
    const paidBadges = await page.locator('[data-testid="status-badge-paid"]').count();
    expect(paidBadges).toBe(rowCount);

    // Source chips narrow to generated invoices only
    await page.getByTestId('chip-source-generated').click();
    await expect(page.locator('[data-testid^="row-invoice-"]').first()).toBeVisible({ timeout: 10000 });
    const generatedRows = await page.locator('[data-testid^="row-invoice-"]').count();
    expect(generatedRows).toBeGreaterThan(0);
    expect(generatedRows).toBeLessThanOrEqual(rowCount);

    // Clearing filters restores the full list
    await page.getByTestId('button-clear-filters').click();
    await expect(page.locator('[data-testid^="row-invoice-"]').first()).toBeVisible({ timeout: 10000 });
    const allRows = await page.locator('[data-testid^="row-invoice-"]').count();
    expect(allRows).toBeGreaterThan(generatedRows);
  });

  test('Generate and Upload modes are mutually exclusive (UI and API)', async ({ page }) => {
    await page.goto('/send-invoice');

    // Generate is the default: builder visible, no upload dropzone, no manual amount
    await expect(page.getByTestId('invoice-items-builder')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(page.getByTestId('input-invoice-amount')).toHaveCount(0);

    // Switching to Upload hides the builder and shows the document flow
    await page.getByTestId('tab-upload-document').click();
    await expect(page.getByTestId('invoice-items-builder')).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toHaveCount(1);
    await expect(page.getByTestId('input-invoice-amount')).toBeVisible();

    // The exclusivity rule is communicated on the page
    await expect(page.getByTestId('text-mode-hint')).toContainText('not both');

    // Switching back to Generate restores the builder
    await page.getByTestId('tab-generate-invoice').click();
    await expect(page.getByTestId('invoice-items-builder')).toBeVisible();

    // The API enforces the same rule: a generated invoice must not carry a document
    const request = page.context().request;
    const res = await request.post('/api/invoices', {
      data: {
        source: 'generated',
        documentId: 'doc_should_not_be_here',
        invoiceAmount: '10.00',
        items: [{ name: 'Item', quantity: 1, unitAmount: 10 }],
        currency: 'GBP',
        absorbFee: false,
        payoutAccountId: 'acc_any',
        clientType: 'individual',
        clientFirstName: 'Ada',
        clientEmail: 'ada@example.com',
        expiry: { type: 'preset', days: 7 },
        idempotencyKey: `e2e-exclusive-${uniqueSuffix()}`,
      },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain('cannot include an attached document');
  });

  test('Per-item discount reduces its line and combines with the invoice-level discount', async ({ page }) => {
    const { request, email: senderEmail } = await setupSender(page);
    await addVerifiedAccount(request);
    const clientEmail = `itemdisc-${uniqueSuffix()}@example.com`;

    await page.goto('/send-invoice');
    await expect(page.getByTestId('invoice-items-builder')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('payout-account-card')).toBeVisible({ timeout: 10000 });

    // One item: 1 × £400 with a fixed £50 item discount
    await page.getByTestId('input-item-name-0').fill('Training workshop');
    await page.getByTestId('input-item-qty-0').fill('1');
    await page.getByTestId('input-item-unit-0').fill('400');
    await page.getByTestId('select-item-discount-type-0').click();
    await page.getByRole('option', { name: '£', exact: true }).click();
    await page.getByTestId('input-item-discount-0').fill('50');

    // Gross line amount with the discount shown beneath it
    await expect(page.getByTestId('text-item-amount-0')).toContainText('£400.00');
    await expect(page.getByTestId('text-item-discount-0')).toContainText('£50.00');

    // Totals: subtotal 400, items discount 50, total 350 (no invoice discount/tax yet)
    await expect(page.getByTestId('text-subtotal')).toContainText('£400.00');
    await expect(page.getByTestId('text-items-discount-total')).toContainText('£50.00');
    await expect(page.getByTestId('text-invoice-total')).toContainText('£350.00');

    // Add a 10% invoice-level discount on the net-of-item-discount base (350 → 35)
    await page.getByTestId('select-discount-type').click();
    await page.getByRole('option', { name: 'Percentage' }).click();
    await page.getByTestId('input-discount-value').fill('10');
    await expect(page.getByTestId('text-discount-amount')).toContainText('£35.00');
    await expect(page.getByTestId('text-invoice-total')).toContainText('£315.00');

    // Client
    await page.getByTestId('input-recipient-first-name').fill('Nadia');
    await page.getByTestId('input-recipient-last-name').fill('Rahman');
    await page.getByTestId('input-recipient-email').fill(clientEmail);

    // Review shows the full discount breakdown
    await page.getByTestId('button-review-invoice').click();
    await expect(page.getByTestId('review-subtotal')).toContainText('£400.00');
    await expect(page.getByTestId('review-items-discount')).toContainText('£50.00');
    await expect(page.getByTestId('review-discount')).toContainText('£35.00');
    await expect(page.getByTestId('review-amount')).toContainText('£315.00');
    await expect(page.getByTestId('review-client-pays')).toContainText('£324.45'); // 3% fee added
    await expect(page.getByTestId('review-item-discount-0')).toContainText('£50.00');

    // Send and verify the stored authoritative math
    await page.getByTestId('button-confirm-send-invoice').click();
    await expect(page.getByText('Invoice Sent!')).toBeVisible({ timeout: 15000 });
    const list = await (await request.get(`/api/invoices?search=${clientEmail}`)).json();
    expect(list.meta.total).toBe(1);
    const inv = list.data[0];
    expect(inv.amount).toBe('315.00');
    expect(inv.items[0].discountType).toBe('fixed');
    expect(inv.items[0].discountValue).toBe(50);
    expect(inv.totals.subtotal).toBe(400);
    expect(inv.totals.itemsDiscountTotal).toBe(50);
    expect(inv.totals.discountAmount).toBe(35);
    expect(inv.totals.total).toBe(315);

    // The payer page renders the per-item discount and the totals breakdown
    const paymentLink = await page.getByTestId('input-invoice-link').inputValue();
    await page.goto(paymentLink);
    await page.getByTestId('input-payer-email').fill(senderEmail);
    await page.getByTestId('button-check-email').click();
    await expect(page.getByTestId('input-payer-password')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('input-payer-password').fill('Passw0rd!x');
    await page.getByTestId('button-signin-pay').click();
    await expect(page.getByTestId('generated-invoice-document')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('generated-invoice-item-discount-0')).toContainText('£50.00');
    await expect(page.getByTestId('generated-invoice-items-discount')).toContainText('£50.00');
    await expect(page.getByTestId('generated-invoice-total')).toContainText('£315.00');
  });

  test('Generate invoice end-to-end: builder → review → send → Invoices page → payer document', async ({ page }) => {
    const { request, email: senderEmail } = await setupSender(page);
    await addVerifiedAccount(request);
    const clientEmail = `gen-client-${uniqueSuffix()}@example.com`;

    // The Invoices page is the entry point for creating an invoice
    await page.goto('/invoices');
    await page.getByTestId('button-create-invoice').click();
    await expect(page).toHaveURL(/\/send-invoice/);
    await expect(page.getByTestId('invoice-items-builder')).toBeVisible({ timeout: 10000 });

    // Receiving payout account preselected (verified, default)
    await expect(page.getByTestId('payout-account-card')).toBeVisible({ timeout: 10000 });

    // Two line items with a live line amount and subtotal
    await page.getByTestId('input-item-name-0').fill('Consulting services');
    await page.getByTestId('input-item-detail-0').fill('Strategy sessions');
    await page.getByTestId('input-item-qty-0').fill('2');
    await page.getByTestId('input-item-unit-0').fill('150');
    await expect(page.getByTestId('text-item-amount-0')).toContainText('£300.00');

    await page.getByTestId('button-add-item').click();
    await page.getByTestId('input-item-name-1').fill('Design work');
    await page.getByTestId('input-item-qty-1').fill('1');
    await page.getByTestId('input-item-unit-1').fill('95.50');
    await expect(page.getByTestId('text-subtotal')).toContainText('£395.50');

    // 10% discount and 20% tax on the discounted base
    await page.getByTestId('select-discount-type').click();
    await page.getByRole('option', { name: 'Percentage' }).click();
    await page.getByTestId('input-discount-value').fill('10');
    await page.getByTestId('input-tax-rate').fill('20');
    await expect(page.getByTestId('text-discount-amount')).toContainText('£39.55');
    await expect(page.getByTestId('text-tax-amount')).toContainText('£71.19');
    await expect(page.getByTestId('text-invoice-total')).toContainText('£427.14');

    // Notes to client
    await page.getByTestId('input-invoice-notes').fill('Thank you for your business.');

    // Client details
    await page.getByTestId('input-recipient-first-name').fill('Maya');
    await page.getByTestId('input-recipient-last-name').fill('Chen');
    await page.getByTestId('input-recipient-email').fill(clientEmail);

    // Review shows the items breakdown and the authoritative totals
    await page.getByTestId('button-review-invoice').click();
    await expect(page.getByRole('heading', { name: 'Review and Confirm' })).toBeVisible();
    await expect(page.getByTestId('review-items')).toHaveText('2 items');
    await expect(page.getByTestId('review-subtotal')).toContainText('£395.50');
    await expect(page.getByTestId('review-discount')).toContainText('£39.55');
    await expect(page.getByTestId('review-tax')).toContainText('£71.19');
    await expect(page.getByTestId('review-amount')).toContainText('£427.14');
    await expect(page.getByTestId('review-client-pays')).toContainText('£439.95'); // 3% fee added
    await expect(page.getByTestId('review-items-table')).toContainText('Consulting services');
    await expect(page.getByTestId('review-items-table')).toContainText('Thank you for your business.');

    // No invoice exists before confirmation (no drafts, ever)
    const before = await (await request.get(`/api/invoices?search=${clientEmail}`)).json();
    expect(before.meta.total).toBe(0);

    // Confirm and send
    await page.getByTestId('button-confirm-send-invoice').click();
    await expect(page.getByText('Invoice Sent!')).toBeVisible({ timeout: 15000 });
    const paymentLink = await page.getByTestId('input-invoice-link').inputValue();
    expect(paymentLink).toMatch(/\/invoice\/[0-9a-f]{40,}/);

    // Server-side record: generated source, stored items, computed total, no document
    const list = await (await request.get(`/api/invoices?search=${clientEmail}`)).json();
    expect(list.meta.total).toBe(1);
    const inv = list.data[0];
    expect(inv.invoiceNumber).toMatch(/^INV-\d{6}-\d{5}$/);
    expect(inv.source).toBe('generated');
    expect(inv.documentId).toBeNull();
    expect(inv.amount).toBe('427.14');
    expect(inv.items).toHaveLength(2);
    expect(inv.items[0].name).toBe('Consulting services');
    expect(inv.items[0].quantity).toBe(2);
    expect(inv.items[1].unitAmount).toBe(95.5);
    expect(inv.totals.subtotal).toBe(395.5);
    expect(inv.totals.total).toBe(427.14);
    expect(inv.notes).toBe('Thank you for your business.');

    // The invoice_sent email for a generated invoice carries no attachment
    const details = await (await request.get(`/api/invoices/${inv.id}`)).json();
    const sentEmail = details.data.emails.find((e) => e.type === 'invoice_sent');
    expect(sentEmail.attachmentFileName).toBeNull();

    // The Invoices page lists it with the Generated badge
    await page.goto('/invoices');
    const row = page.getByTestId(`row-invoice-${inv.id}`);
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.getByTestId('badge-source-generated')).toBeVisible();
    await expect(row).toContainText('£427.14');
    await expect(row).toContainText(clientEmail);

    // Sender detail page renders the generated invoice document
    await page.getByTestId(`button-view-${inv.id}`).click();
    await expect(page).toHaveURL(new RegExp(`/sent-invoices/${inv.id}`));
    await expect(page.getByTestId('generated-invoice-document')).toBeVisible();
    await expect(page.getByTestId('generated-invoice-total')).toContainText('£427.14');
    await expect(page.getByTestId('generated-invoice-item-0')).toContainText('Consulting services');

    // The payer sees the full generated invoice on the public payment page
    await page.goto(paymentLink);
    await expect(page.getByTestId('public-invoice-number')).toHaveText(inv.invoiceNumber);
    await expect(page.getByTestId('public-invoice-amount')).toContainText('£427.14');

    // Identify as the payer (registered email → password sign-in)
    await page.getByTestId('input-payer-email').fill(senderEmail);
    await page.getByTestId('button-check-email').click();
    await expect(page.getByTestId('input-payer-password')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('input-payer-password').fill('Passw0rd!x');
    await page.getByTestId('button-signin-pay').click();

    // The generated invoice renders as a document, with a print action
    await expect(page.getByTestId('generated-invoice-document')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('generated-invoice-total')).toContainText('£427.14');
    await expect(page.getByTestId('generated-invoice-notes')).toContainText('Thank you for your business.');
    await expect(page.getByTestId('button-print-invoice')).toBeVisible();

    // Pay the generated invoice through the normal journey
    await expect(page.getByTestId('button-pay-invoice')).toContainText('£439.95');
    await page.getByTestId('button-pay-invoice').click();
    await page.getByTestId('button-pay-card').click();
    await expect(page.getByTestId('paid-card')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('text-paid')).toContainText(inv.invoiceNumber);
  });

});
