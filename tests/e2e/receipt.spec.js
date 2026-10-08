import { test, expect } from '@playwright/test';

const paid = {
  id: 'tx-r1', reference: 'RH-RCPT1', recipientName: 'Ada Receipt', service: 'bank_deposit', paymentMethod: 'card',
  sendCurrency: 'GBP', sendAmount: '100.00', receiveCurrency: 'NGN', receiveAmount: '200000.00',
  fee: '0.00', exchangeRate: '2000', promoCode: 'WELCOME', promoDiscount: '2.00',
  bonusCredit: '5.00', bonusCreditMode: 'pay_less', status: 'completed',
  createdAt: '2026-10-01T10:00:00Z', paidAt: '2026-10-01T10:05:00Z', cancelledAt: null,
};
const unpaid = { ...paid, id: 'tx-r2', reference: 'RH-RCPT2', recipientName: 'Not Paid', promoCode: null, promoDiscount: null, bonusCredit: null, bonusCreditMode: null, status: 'awaiting_payment', paidAt: null };

test.describe('Send money receipt', () => {
    test('shows promo and bonus lines and the total paid', async ({ page }) => {
        await page.route('**/api/send-money/transactions', (route) => route.request().method() === 'GET'
            ? route.fulfill({ json: { data: [paid, unpaid] } }) : route.continue());
        await page.goto('/transactions?type=send_money');
        await expect(page.getByTestId('button-receipt-RH-RCPT1')).toBeVisible();
        await expect(page.getByTestId('button-receipt-RH-RCPT2')).toHaveCount(0);

        await page.getByTestId('button-receipt-RH-RCPT1').click();
        const receipt = page.getByTestId('send-money-receipt');
        await expect(receipt).toBeVisible();
        await expect(page.getByTestId('receipt-line-promo')).toContainText('WELCOME');
        await expect(page.getByTestId('receipt-line-promo')).toContainText('−GBP 2.00');
        await expect(page.getByTestId('receipt-line-bonus_pay_less')).toContainText('−GBP 5.00');
        await expect(page.getByTestId('receipt-line-total')).toContainText('GBP 95.00');
        // Contact support is shown but disabled until a support channel is decided
        await expect(page.getByTestId('receipt-contact-support')).toHaveAttribute('aria-disabled', 'true');
        await expect(page.getByTestId('receipt-contact-support')).not.toHaveAttribute('href', /.*/);

        // The receipt can always be closed
        await page.keyboard.press('Escape');
        await expect(receipt).toHaveCount(0);
    });
});
