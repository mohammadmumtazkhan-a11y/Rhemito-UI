const request = require('supertest');
const app = require('../server');

describe('Promo Code Validation Tests', () => {

    beforeAll(async () => {
        // Wait for in-memory DB to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    // Test /api/promocodes/validate
    describe('POST /api/promocodes/validate', () => {
        it('should validate SAVE20 promo code correctly', async () => {
            const payload = {
                code: 'SAVE20',
                amount: 500,
                currency: 'GBP',
                userId: 'user_123',
                sourceCurrency: 'GBP',
                destCurrency: 'NGN',
                paymentMethod: 'bank_deposit'
            };

            const res = await request(app)
                .post('/api/promocodes/validate')
                .send(payload);

            if (res.statusCode !== 200) {
                console.log('Error Response:', res.body);
            }
            expect(res.statusCode).toEqual(200);
            expect(res.body.valid).toBe(true);
            expect(res.body.appliedDiscount).toBe(100);
            // In server/promocode.ts, SAVE20 is 20% off the FEE? or Amount?
            // "Percentage off the transaction fee (assuming fee is included in amount or separate)"
            // "const standardFee = 5; discount = (standardFee * promo.value) / 100;"
            // If value is 20, discount = 5 * 20/100 = 1.
            // BUT, the frontend mock was "parseFloat(amount) * 0.20".
            // So there is a discrepancy between frontend mock (Amount Discount) and backend logic (Fee Discount).
            // This is a CRITICAL finding. I need to see what the test returns to confirm.
        });

        it('should fail for invalid promo code', async () => {
            const payload = {
                code: 'INVALIDCODE',
                amount: 500,
                currency: 'GBP',
                userId: 'user_123'
            };

            const res = await request(app)
                .post('/api/promocodes/validate')
                .send(payload);

            expect(res.statusCode).toEqual(404);
            expect(res.body.error).toBe('Invalid promo code');
        });
    });
});
