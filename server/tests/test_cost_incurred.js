const request = require('supertest');
const app = require('../server');

async function runTest() {
    try {
        console.log('--- Starting Cost Incurred Verification ---');
        console.log('Waiting for DB init (2s)...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        const agent = request(app);
        const userId = 'user_123';
        const today = new Date().toISOString().split('T')[0];

        // 1. Check Initial Cost (Should include seeded Promos: 20 + 5 = 25)
        // Note: Seeding happens on server start. 'promo_redemptions' are backdated to 2024.
        // If we don't pass dates, we get everything.
        console.log('Checking Initial Cost for user_123 (Seeded Promos only)...');
        const initRes = await agent.get(`/api/credits/${userId}`).expect(200);
        console.log('Initial Cost:', initRes.body.cost_incurred);

        // We expect at least 25.0 from the seeded promos if no other credits exist.
        // (20 from May 2024, 5 from June 2024)

        // 2. Award a new Bonus (Type EARNED)
        // We need a scheme first. Using existing or causing a standardized one.
        // Let's create a simple fixed scheme to be sure.
        const schemeData = {
            name: 'Cost Test Scheme',
            bonus_type: 'TRANSACTION_THRESHOLD_CREDIT',
            credit_amount: 50.00,
            currency: 'GBP',
            min_transaction_threshold: 0,
            commission_type: 'FIXED',
            start_date: '2020-01-01',
            end_date: '2030-12-31'
        };
        const schemeRes = await agent.post('/api/bonus-schemes').send(schemeData).expect(200);
        const schemeId = schemeRes.body.id;

        // Award 50.00
        const txnId = `txn_cost_test_${Date.now()}`;
        await agent.post('/api/credits/award-bonus').send({
            user_id: userId,
            scheme_id: schemeId,
            transaction_id: txnId,
            admin_user: 'Tester'
        }).expect(200);

        console.log('Awarded 50.00 Credit.');

        // 3. Check New Cost (Should be Initial + 50)
        const updatedRes = await agent.get(`/api/credits/${userId}`).expect(200);
        console.log('Updated Cost:', updatedRes.body.cost_incurred);

        // 4. Test Date Filtering
        // Promos are in 2024. New Credit is Today (2026 likely based on logs, or current date).
        // Filter for TODAY only -> Should see 50, but NOT 25 (promos).
        console.log('Testing Date Filter (Today Only)...');
        const filterRes = await agent.get(`/api/credits/${userId}?startDate=${today}&endDate=${today}`).expect(200);
        console.log(`Filtered Cost (${today}):`, filterRes.body.cost_incurred);

        if (filterRes.body.cost_incurred === 50) {
            console.log('SUCCESS: Date filter correctly excluded old promos.');
        } else {
            console.error('FAILURE: Date filter failed. Expected 50, got ' + filterRes.body.cost_incurred);
        }

    } catch (error) {
        console.error('CRITICAL ERROR:', error);
    }
    console.log('--- Test Complete ---');
    process.exit(0);
}

runTest();
