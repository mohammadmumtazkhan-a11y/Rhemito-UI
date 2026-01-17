const request = require('supertest');
const app = require('../server');

describe('Interswitch Portal API Tests', () => {

    // Test /api/merchants
    describe('GET /api/merchants', () => {
        it('should return a list of merchants', async () => {
            const res = await request(app).get('/api/merchants');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('data');
            expect(Array.isArray(res.body.data)).toBe(true);
            if (res.body.data.length > 0) {
                expect(res.body.data[0]).toHaveProperty('mito_id');
            }
        });
    });

    // Test /api/transactions
    describe('GET /api/transactions', () => {
        it('should return a list of transactions', async () => {
            const res = await request(app).get('/api/transactions');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('data');
        });
    });

    // Test /api/promocodes
    describe('GET /api/promocodes', () => {
        it('should return a list of promo codes', async () => {
            const res = await request(app).get('/api/promocodes');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('data');
        });
    });

    // Test Creating a Promo Code
    describe('POST /api/promocodes', () => {
        it('should create a new promo code', async () => {
            const newPromo = {
                code: `TEST-${Date.now()}`,
                type: 'Fixed',
                value: 100,
                start_date: new Date().toISOString(),
                end_date: new Date(Date.now() + 86400000).toISOString(),
                currency: 'USD'
            };

            const res = await request(app)
                .post('/api/promocodes')
                .send(newPromo);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('id');
        });

        it('should fail with missing required fields', async () => {
            const res = await request(app)
                .post('/api/promocodes')
                .send({ code: 'INVALID' }); // Missing other fields

            expect(res.statusCode).toEqual(400);
        });
    });

});
