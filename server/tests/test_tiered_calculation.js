const request = require('supertest');
const app = require('../server');

async function runTest() {
    try {
        console.log('--- Starting Tiered Commission Test (Supertest) ---');

        console.log('Waiting for DB init (2s)...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        const agent = request(app);

        // 1. Create a Tiered Bonus Scheme
        const schemeData = {
            name: 'Test Tiered Scheme',
            bonus_type: 'TRANSACTION_THRESHOLD_CREDIT',
            credit_amount: 0,
            currency: 'NGN',
            min_transaction_threshold: 0,
            min_transactions: 0,
            time_period_days: 0,
            commission_type: 'FIXED',
            commission_percentage: 0,
            is_tiered: true,
            tiers: [
                { min: 0, max: 1000, value: 50 },
                { min: 1001, max: 5000, value: 100 },
                { min: 5001, max: null, value: 200 }
            ],
            eligibility_rules: { oneTimeOnly: false },
            start_date: '2024-01-01',
            end_date: '2027-12-31'
        };

        console.log('Creating Scheme...');
        const createRes = await agent.post('/api/bonus-schemes')
            .send(schemeData)
            .expect(200);

        console.log('Scheme Created Response:', createRes.body);

        // Fetch to get the ID
        const listRes = await agent.get('/api/bonus-schemes').expect(200);
        const createdScheme = listRes.body.data.find(s => s.name === 'Test Tiered Scheme');

        if (!createdScheme) {
            console.error('FAILURE: Could not find created scheme.');
            return;
        }
        const schemeId = createdScheme.id;
        console.log(`Scheme ID: ${schemeId}`);

        // 2. Award Bonus for 't1' (500,000 NGN) -> Should be Tier 3 (200)
        // t1 is the ID of a seeded transaction in server.js
        const txnId = 't1';
        const userId = 'user_test_001';

        console.log(`Awarding Bonus for Txn ${txnId} (Amount: 500,000)... Expecting 200.`);

        const awardRes = await agent.post('/api/credits/award-bonus')
            .send({
                user_id: userId,
                scheme_id: schemeId,
                transaction_id: txnId,
                admin_user: 'TestScript'
            });

        if (awardRes.status !== 200) {
            console.error('FAILURE: Award Bonus returned status', awardRes.status);
            console.error('Response Body:', JSON.stringify(awardRes.body, null, 2));
            return;
        }

        console.log('Award Result:', awardRes.body);

        if (awardRes.body.amount === 200) {
            console.log('SUCCESS: Awarded amount matches Tier 3 value (200).');
        } else {
            console.error(`FAILURE: Expected 200, got ${awardRes.body.amount}`);
        }

    } catch (error) {
        console.error('CRITICAL ERROR:', error);
    }

    console.log('--- Test Complete ---');
    process.exit(0);
}

runTest();
