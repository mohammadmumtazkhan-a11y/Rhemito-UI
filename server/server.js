const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve Static Files
app.use(express.static(path.join(__dirname, '../client/dist')));

// SPA Catch-all Route (Must be after API routes, handled at bottom)

// Database Setup
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('Connected to the in-memory SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Merchants
        db.run(`CREATE TABLE merchants (
            id TEXT PRIMARY KEY,
            mito_id TEXT UNIQUE,
            type TEXT,
            name TEXT,
            reg_number TEXT,
            email TEXT,
            base_currency TEXT,
            payout_currency TEXT,
            status TEXT DEFAULT 'Active'
        )`);

        // Transactions
        db.run(`CREATE TABLE transactions (
            id TEXT PRIMARY KEY,
            ref_number TEXT UNIQUE,
            merchant_id TEXT,
            type TEXT,
            amount_debit_ngn REAL,
            debit_date TEXT,
            status TEXT,
            FOREIGN KEY(merchant_id) REFERENCES merchants(id)
        )`);

        // Forex Logs
        db.run(`CREATE TABLE forex_logs (
            id TEXT PRIMARY KEY,
            transaction_id TEXT,
            conversion_date TEXT,
            rate_applied REAL,
            amount_input_ngn REAL,
            amount_output_target REAL,
            FOREIGN KEY(transaction_id) REFERENCES transactions(id)
        )`);

        // Commissions
        db.run(`CREATE TABLE commissions (
            id TEXT PRIMARY KEY,
            transaction_id TEXT,
            base_commission_ngn REAL,
            forex_spread_ngn REAL,
            total_commission_ngn REAL,
            payout_status TEXT,
            FOREIGN KEY(transaction_id) REFERENCES transactions(id)
        )`);

        // Seed Data
        const stmt = db.prepare("INSERT INTO merchants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        stmt.run("m1", "MITO001", "Business", "Global Tech Ltd", "RC12345", "contact@globaltech.com", "NGN", "USD", "Active");
        stmt.run("m2", "MITO002", "Individual", "John Doe Logistics", "N/A", "john@doelogistics.com", "NGN", "GBP", "Onboarding");
        stmt.finalize();

        // Seed Transactions, Forex, Commissions
        const tStmt = db.prepare("INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?)");
        tStmt.run("t1", "TXN100001", "m1", "Debit", 500000.00, "2024-10-24T10:30:00Z", "Successful");
        tStmt.run("t2", "TXN100002", "m2", "Debit", 150000.00, "2024-10-24T11:15:00Z", "Pending");
        tStmt.finalize();

        const fStmt = db.prepare("INSERT INTO forex_logs VALUES (?, ?, ?, ?, ?, ?)");
        fStmt.run("f1", "t1", "2024-10-24T14:00:00Z", 1545.79, 500000.00, 323.45);
        fStmt.finalize();

        const cStmt = db.prepare("INSERT INTO commissions VALUES (?, ?, ?, ?, ?, ?)");
        cStmt.run("c1", "t1", 5000.00, 2500.00, 7500.00, "Due");
        cStmt.finalize();

        // Seed Promo Codes (Dummy Data for Kill Switch Demo)
        db.run(`CREATE TABLE IF NOT EXISTS promo_redemptions (
            id TEXT PRIMARY KEY,
            promo_code_id TEXT,
            transaction_id TEXT,
            user_id TEXT,
            discount_amount REAL,
            status TEXT,
            created_at TEXT,
            FOREIGN KEY(promo_code_id) REFERENCES promo_codes(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS email_logs (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            code TEXT,
            segment TEXT,
            sent_at TEXT,
            status TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS promo_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            type TEXT,
            value REAL,
            min_threshold REAL DEFAULT 0,
            max_discount REAL,
            currency TEXT,
            usage_limit_global INTEGER DEFAULT -1,
            usage_limit_per_user INTEGER DEFAULT 1,
            usage_count INTEGER DEFAULT 0,
            total_discount_utilized REAL DEFAULT 0,
            budget_limit REAL DEFAULT -1,
            start_date TEXT,
            end_date TEXT,
            status TEXT DEFAULT 'Active',
            restrictions TEXT,
            user_segment TEXT,
            user_segment_criteria TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            const pStmt = db.prepare(`INSERT INTO promo_codes 
                (code, type, value, min_threshold, currency, usage_limit_global, usage_count, start_date, end_date, status, restrictions) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            // Active Code
            pStmt.run('SAVE20', 'Percentage', 20, 100, 'USD', 1000, 45, '2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z', 'Active', '{}');

            // Disabled Code (Kill Switch Demo)
            pStmt.run('GLITCH500', 'Fixed', 500, 0, 'USD', 50, 12, '2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z', 'Disabled', '{}');

            // FX Boost Code
            pStmt.run('BOOSTRATE', 'FX_BOOST', 5.0, 500, 'GBP', -1, 89, '2024-06-01T00:00:00Z', '2024-08-31T23:59:59Z', 'Active', '{}');

            pStmt.finalize();

            // Sample email campaign logs
            const emailStmt = db.prepare("INSERT INTO email_logs VALUES (?, ?, ?, ?, ?, ?)");
            emailStmt.run('log_demo_1', 'user_001', 'SAVE20', 'new_users', '2026-01-14T10:30:00Z', 'Sent');
            emailStmt.run('log_demo_2', 'user_002', 'SAVE20', 'new_users', '2026-01-14T10:30:00Z', 'Sent');
            emailStmt.run('log_demo_3', 'user_003', 'BOOSTRATE', 'churned_users', '2026-01-12T14:15:00Z', 'Sent');
            emailStmt.finalize();
        });
    });
}

// Routes
app.get('/api/dashboard/kpi', (req, res) => {
    res.json({
        commission_earned: { pending: 1250000, available: 4500000, paid_out: 12000000 },
        forex_payout: { pending_conversion: 2500000, to_be_paid: 1500, paid_out: 50000 }
    });
});

app.get('/api/transactions', (req, res) => {
    db.all(`SELECT t.*, m.name as merchant_name, f.amount_output_target, f.rate_applied, c.total_commission_ngn 
            FROM transactions t 
            JOIN merchants m ON t.merchant_id = m.id 
            LEFT JOIN forex_logs f ON t.id = f.transaction_id
            LEFT JOIN commissions c ON t.id = c.transaction_id`, [], (err, rows) => {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({ data: rows });
    });
});

// Financial Endpoints
app.get('/api/financials/debits', (req, res) => {
    db.all("SELECT t.ref_number, m.name, t.amount_debit_ngn, t.debit_date, t.status FROM transactions t JOIN merchants m ON t.merchant_id = m.id WHERE t.type = 'Debit'", [], (err, rows) => {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({ data: rows });
    });
});

app.get('/api/financials/payouts', (req, res) => {
    db.all(`SELECT t.ref_number, m.name, f.conversion_date, t.amount_debit_ngn, f.rate_applied, f.amount_output_target, t.status 
            FROM transactions t 
            JOIN merchants m ON t.merchant_id = m.id 
            JOIN forex_logs f ON t.id = f.transaction_id`, [], (err, rows) => {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({ data: rows });
    });
});

app.get('/api/merchants', (req, res) => {
    db.all("SELECT * FROM merchants", [], (err, rows) => {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({ data: rows });
    });
});

// NOTE: SPA catch-all and app.listen are at the end of the file, AFTER all API routes

// --- Promo Code Logic ---

// 1. List Promo Codes (with last campaign sent date)
app.get('/api/promocodes', (req, res) => {
    const query = `
        SELECT p.*, MAX(e.sent_at) as last_campaign_sent
        FROM promo_codes p
        LEFT JOIN email_logs e ON p.code = e.code
        GROUP BY p.id
        ORDER BY p.start_date DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const processed = rows.map(r => ({
            ...r,
            restrictions: JSON.parse(r.restrictions || '{}'),
            user_segment: r.user_segment ? JSON.parse(r.user_segment) : { type: 'all' },
            user_segment_criteria: r.user_segment_criteria ? JSON.parse(r.user_segment_criteria) : {},
            last_campaign_sent: r.last_campaign_sent || null
        }));
        res.json({ data: processed });
    });
});

// 2. Create Promo Code
app.post('/api/promocodes', (req, res) => {
    const {
        code, type, value, min_threshold, max_discount, currency,
        usage_limit_global, usage_limit_per_user, budget_limit, start_date, end_date,
        restrictions, user_segment, user_segment_criteria
    } = req.body;

    // Strict Input Validation (Basic)
    if (!code || !type || !value || !start_date || !end_date) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // Explicit Column Insert
    const stmt = db.prepare(`INSERT INTO promo_codes (
        code, type, value, min_threshold, max_discount, currency, 
        usage_limit_global, usage_limit_per_user, budget_limit, 
        start_date, end_date, status, restrictions, user_segment, user_segment_criteria
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    // Reliable parsing helper
    const parseNum = (val, isInt = false) => {
        if (val === '' || val === null || val === undefined) return null;
        const num = isInt ? parseInt(val) : parseFloat(val);
        return Number.isNaN(num) ? null : num;
    };

    console.log('[DEBUG] Creating Promo Payload:', { code, type, value });

    stmt.run(
        code.toUpperCase(),
        type,
        parseNum(value),
        parseNum(min_threshold) || 0,
        parseNum(max_discount),
        currency || null,
        parseNum(usage_limit_global, true) || -1,
        parseNum(usage_limit_per_user, true) || 1,
        parseNum(budget_limit) || -1,
        start_date,
        end_date,
        'Active',
        JSON.stringify(restrictions || {}),
        JSON.stringify(user_segment || { type: 'all' }),
        JSON.stringify(user_segment_criteria || {}),
        function (err) {
            if (err) {
                console.error("[ERROR] Insert Failed:", err);
                if (err.message.includes('UNIQUE')) return res.status(409).json({ error: "Promo code already exists" });
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, id: this.lastID });
        }
    );
    stmt.finalize();
});

// 3. Bulk Generate Codes (Story 1.3)
const crypto = require('crypto');
app.post('/api/promocodes/generate', (req, res) => {
    const { batch_size, prefix, config } = req.body;
    let createdCount = 0;

    db.serialize(() => {
        const stmt = db.prepare(`INSERT INTO promo_codes (
            code, type, value, min_threshold, max_discount, currency, 
            usage_limit_global, usage_limit_per_user, budget_limit, 
            start_date, end_date, status, restrictions, user_segment, user_segment_criteria
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        for (let i = 0; i < batch_size; i++) {
            const randomStr = crypto.randomBytes(4).toString('hex').toUpperCase();
            const code = (prefix ? prefix + '-' : '') + randomStr;

            stmt.run(
                code, config.type, config.value, config.min_threshold || 0, config.max_discount, config.currency,
                config.usage_limit_global || -1, config.usage_limit_per_user || 1, config.budget_limit || -1,
                config.start_date, config.end_date, 'Active',
                JSON.stringify(config.restrictions || {}),
                JSON.stringify(config.user_segment || { type: 'all' }),
                JSON.stringify(config.user_segment_criteria || {}),
                (err) => {
                    if (!err) createdCount++;
                }
            );
        }
        stmt.finalize(() => {
            res.json({ success: true, message: `Batch generation initiated for ${batch_size} codes.` });
        });
    });
});

// 4. Toggle Status / Emergency Kill Switch (Story 1.4)
app.put('/api/promocodes/:id/status', (req, res) => {
    const { status } = req.body; // 'Active' or 'Disabled'
    db.run("UPDATE promo_codes SET status = ? WHERE id = ?", [status, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// 5. User Journey: Validate Code (Story 3.1)
app.post('/api/promocodes/validate', (req, res) => {
    const { code, amount, currency, userId, source_currency, dest_currency, payment_method } = req.body;

    db.get("SELECT * FROM promo_codes WHERE code = ?", [code.toUpperCase()], (err, promo) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!promo) return res.status(404).json({ error: "Invalid promo code" });

        const now = new Date();
        if (promo.status !== 'Active' || new Date(promo.start_date) > now || new Date(promo.end_date) < now) {
            return res.status(400).json({ error: "Promo code expired or inactive" });
        }

        // Global Cap (Count)
        if (promo.usage_limit_global !== -1 && promo.usage_count >= promo.usage_limit_global) {
            return res.status(400).json({ error: "Promo code fully redeemed (Count Limit)" });
        }

        // Global Cap (Budget)
        if (promo.budget_limit !== -1 && promo.total_discount_utilized >= promo.budget_limit) {
            return res.status(400).json({ error: "Promo code fully redeemed (Budget Limit)" });
        }

        // Threshold
        if (amount < promo.min_threshold) {
            return res.status(400).json({ error: `Transfer amount too low (Min: ${promo.min_threshold})` });
        }

        const restrictions = JSON.parse(promo.restrictions || '{}');
        const userSeg = promo.user_segment ? JSON.parse(promo.user_segment) : { type: 'all' };
        const userCrit = promo.user_segment_criteria ? JSON.parse(promo.user_segment_criteria) : {};

        // Validations...
        if (restrictions.corridors?.length > 0) {
            const corridorKey = `${source_currency}-${dest_currency}`;
            if (!restrictions.corridors.includes(corridorKey)) {
                return res.status(400).json({ error: "Code not valid for this corridor" });
            }
        }

        if (restrictions.payment_methods?.length > 0) {
            if (!restrictions.payment_methods.includes(payment_method)) {
                return res.status(400).json({ error: "Code not valid for this payment method" });
            }
        }

        // Continue validation...
        res.json({
            valid: true,
            promo: promo,
            display_text: "Code Valid"
        });
    });
});

// 6. User Journey: Apply/Lock Code
app.post('/api/promocodes/apply', (req, res) => {
    const { code, discount_amount } = req.body;

    // Simple update for prototype
    db.run("UPDATE promo_codes SET usage_count = usage_count + 1, total_discount_utilized = total_discount_utilized + ? WHERE code = ?",
        [discount_amount, code],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// 7. Segments
app.get('/api/segments', (req, res) => {
    res.json({ data: { new_users: 10, churned_users: 5 } }); // Mock
});

// 8. Distribute Promos (Story 2.0)
app.post('/api/promocodes/distribute', (req, res) => {
    const { segment, promo_config, criteria, existing_code_id } = req.body;
    let query = "";

    // Explicit criteria handling
    const max_tx = criteria?.max_tx || 0;
    const churn_days = criteria?.churn_days || 90;

    if (segment === 'new_users') {
        // Mock query logic matching /api/segments
        // For prototype, let's just select ALL merchants as "targets" to ensure it works.
        query = "SELECT * FROM merchants";
    }
    else if (segment === 'churned_users') {
        query = "SELECT * FROM merchants"; // Mock
    }
    else return res.status(400).json({ error: "Invalid segment" });

    db.all(query, [], (err, users) => {
        if (err) return res.status(500).json({ error: err.message });

        // Mock filtering
        // For prototype, effectively returning all mocked users
        const targets = users;

        if (targets.length === 0) return res.json({ success: true, count: 0, message: "No users in segment" });

        const now = new Date().toISOString();

        // If distributing an EXISTING code, just log the campaign without creating new codes
        if (existing_code_id) {
            db.serialize(() => {
                const logStmt = db.prepare("INSERT INTO email_logs VALUES (?, ?, ?, ?, ?, ?)");
                let count = 0;
                targets.forEach(user => {
                    logStmt.run('log_' + Date.now() + '_' + count, user.id, existing_code_id, segment, now, 'Sent');
                    console.log(`[EMAIL SIMULATION] Sending existing code ${existing_code_id} to ${user.email}`);
                    count++;
                });
                logStmt.finalize();
                res.json({ success: true, count, segment, existing_code: existing_code_id });
            });
            return;
        }

        // Otherwise, create NEW unique codes for each target
        db.serialize(() => {
            const stmt = db.prepare(`INSERT INTO promo_codes (
                id, code, type, value, min_threshold, max_discount, currency, 
                usage_limit_global, usage_limit_per_user, budget_limit, 
                start_date, end_date, status, restrictions, user_segment, user_segment_criteria
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            const logStmt = db.prepare("INSERT INTO email_logs VALUES (?, ?, ?, ?, ?, ?)");

            let count = 0;

            // Helper to ensure proper numeric types
            const parseNum = (val, isInt = false) => {
                if (val === '' || val === null || val === undefined) return null;
                const num = isInt ? parseInt(val) : parseFloat(val);
                return Number.isNaN(num) ? null : num;
            };

            targets.forEach(user => {
                const uniqueCode = (promo_config.prefix || 'OFFER') + Math.random().toString(36).substring(7).toUpperCase();
                const id = 'pc_' + Date.now() + '_' + count;

                // Propagate restrictions
                const restrictions = { ...promo_config.restrictions };
                if (promo_config.corridors) restrictions.corridors = promo_config.corridors;
                if (promo_config.affiliates) restrictions.affiliates = promo_config.affiliates;

                stmt.run(
                    id,
                    uniqueCode,
                    promo_config.type,
                    parseNum(promo_config.value),
                    parseNum(promo_config.min_threshold) || 0,
                    parseNum(promo_config.max_discount),
                    promo_config.currency || null,
                    1, 1, -1, // Single use code
                    promo_config.start_date,
                    promo_config.end_date,
                    'Active',
                    JSON.stringify(restrictions),
                    JSON.stringify({ type: 'targeted', user_id: user.id }),
                    JSON.stringify({})
                );

                logStmt.run('log_' + Date.now() + '_' + count, user.id, uniqueCode, segment, now, 'Sent');
                console.log(`[EMAIL SIMULATION] Sending code ${uniqueCode} to ${user.email}`);
                count++;
            });

            stmt.finalize();
            logStmt.finalize();
            res.json({ success: true, count, segment });
        });
    });
});

// Handle SPA routing - return index.html for all non-API routes (MUST BE LAST)
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

