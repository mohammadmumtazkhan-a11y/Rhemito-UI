# Promo Code Module — Mito Money Admin (Backend + Admin UI)

**Spec ID:** PROMO-MITO-v1.0
**Date:** 08 October 2026
**Author:** Mohammad Mumtaz (Business Analyst)
**Target codebase:** Mito Money Admin (`PromoCode` repo — `server/` Express + SQLite, `client/` React + Vite)
**Companion spec:** `PROMO_MODULE_SPEC_RHEMITO.md` (customer side, Rhemito-UI repo). The service API in Section 8 is shared by both specs and must not drift.
**Related:** `REFERRAL_MODULE_SPEC_MITO_ADMIN.md` (referral module). The two modules are independent of each other.

---

## 0. Instructions for the AI coding agent

1. **Nothing that works today may stop working.** This is a refactor and hardening job on a live prototype (deployed on Render from GitHub). Section 11 lists every current consumer of promo code endpoints and tables; each must still work after your change. When in doubt, keep the old behaviour and add the new one beside it.
2. Read this whole document, then the reference implementation in Section 13. Build in the order of Section 12 (phases). Each phase must leave the app working and all tests green.
3. Work on a branch (`feature/promo-module`), small commits, PR at the end. Never push to `main`.
4. Run the whole suite before the PR: `server/tests` (jest/supertest), client Vitest, Playwright `tests/e2e`. Existing promo tests (`server/tests/engines.test.js`, `api.test.js`, `test_cost_incurred.js`, `tests/e2e/global.spec.js`) must keep passing. You may update an assertion only where this spec changes a message on purpose (Section 6.4), and you must say so in the PR.
5. Requirement IDs (`PR-`, `AC-`, `API-`) must appear in test names.
6. Strings in this spec are final copy; use them verbatim.
7. If something is unclear, stop and ask. Items in Section 2.3 are decided.

---

## 1. Purpose and scope

### 1.1 Purpose
Mito Money admins create promo codes that reduce the fee a Rhemito customer pays on a transfer. Mito Money is the single source of truth: it stores the codes, decides whether a code can be used, computes the discount, records each use once per transfer, gives the use back when a transfer fails or is refunded, and reports cost and usage.

### 1.2 What "independent module" means

| The module OWNS | The module must NOT depend on |
|---|---|
| Tables `promo_codes`, `promo_redemptions` (existing) and new `promo_customers`, `promo_transfers`, `promo_audit` | `bonusEngine.js` (today `promoEngine.js` imports `Reject` and `segmentMatches` from it) |
| Validation, discount calculation, redemption, release | `referral_transfers`, `customers`, `credit_ledger` tables (today segment checks read `referral_transfers`) |
| Its own record of customer activity used by audience checks | Referral or Bonus Scheme code |
| Admin page **Financials > Promo Codes** and its modals | |
| Service API used by Rhemito | |

All module code lives in:
- `server/promo/`: `index.js` (register routes), `schema.js`, `engine.js`, `admin.js` (CRUD routes), `service.js` (Rhemito-facing routes), `audience.js`, `ports.js`, `errors.js`, `money.js`.
- `server/promoEngine.js` stays as a **one-line re-export** of `server/promo/engine.js` so existing imports and tests keep working.
- `client/src/pages/Promo/` (page, modals, `lib/` helpers). Keep the route `/financials/promocodes` and the nav item **Financials > Promo Codes**.
- Tests: `server/tests/promo/*.test.js`, `client/src/pages/Promo/**/*.test.js`, `tests/e2e/promo_*.spec.js`.

`server/server.js` keeps only: `const promo = require('./promo'); promo.register(app, db, ports);` (old inline promo routes are moved into the module, same paths).

### 1.3 Integration ports (optional adapters, `server/promo/ports.js`)

| Port | Signature | Default | Purpose |
|---|---|---|---|
| `segmentProvider` | `async getSegment(id) → { id, name, criteria } | null` and `async listSegments() → [...]` | Reads the existing `user_segments` table **read-only** if it exists, else returns none | Lets admins target saved segments (owned by Growth > Bonus Scheme Manager) without the promo module depending on bonus code. |
| `adminIdentity` | `(req) → { name, role }` | prototype resolver: `Admin` | Audit "who changed what". |

With every port at its default the module works fully on its own (audiences `all`, `new_customers`, `existing_customers`, `specific_customers` need no port).

### 1.4 Out of scope
- FX rate boost and bonus-credit promo types (see D6).
- Sending codes by email/SMS (the old "distribute" simulation is retired, Section 7.1).
- Affiliate restrictions (never enforced; removed from the form, D8).

---

## 2. Glossary, statuses, decisions

### 2.1 Glossary

| Term | Meaning |
|---|---|
| Promo code | Text a customer types (e.g. `SAVE20`), 3–20 characters `A–Z 0–9 -`, stored uppercase, unique. |
| Fee | Rhemito's transfer fee **before** any promo, in the send currency. |
| Discount | Amount taken off the fee. Never more than the fee, never negative. |
| Send amount | Amount the customer sends, before fee. Used for the minimum check. |
| Redemption | One use of a code on one transfer. Status `Redeemed` or `Released`. |
| Release | Giving a use back because the transfer was cancelled, failed, refunded, recalled or charged back. |
| Corridor | Send currency → receive currency, stored as `GBP-NGN`. |
| Audience | Who may use a code: everyone, new customers, existing customers, specific customers, or a saved segment. |

### 2.2 Code status

Stored `status`: `Active` | `Disabled`. Shown status is derived (first match wins):

| Shown | Condition | Badge |
|---|---|---|
| Disabled | `status = Disabled` | grey |
| Expired | `end_date` < now | red |
| Scheduled | `start_date` > now | blue |
| Fully redeemed | global limit set and `usage_count` ≥ limit | amber |
| Budget spent | budget set and `total_discount_utilized` ≥ budget | amber |
| Active | otherwise | green |

`GET /api/promocodes` keeps returning `status` (today: `Active`, `Disabled`, or `Expired` when an Active code has ended — **unchanged**) and adds `display_status` with the table above.

### 2.3 Decisions (fixed)

| # | Decision |
|---|---|
| D1 | A promo discount applies to the **fee only** (`appliesTo: "fee"`), as today. |
| D2 | Types: **Fixed** (fixed amount off the fee, capped at the fee), **Percentage** (percent of the fee, optional cap), **Waiver** (whole fee). Same maths as today. |
| D3 | The minimum is on the **send amount** (≥ minimum). |
| D4 | Validation never records anything. Redemption happens only when Rhemito marks the transfer paid, and the discount is recomputed by Mito (never trusted from the caller). |
| D5 | One redemption per (code, transfer). A repeated redeem for the same transfer succeeds without counting twice. A released transfer cannot be redeemed again. |
| D6 | `FX_BOOST` and `BONUS_CREDIT` are not offered for new codes. Existing codes of these types keep today's behaviour exactly (valid, discount 0, display text `+<value> rate boost` / `<CUR> <value> bonus credit`) and are labelled **Legacy** in the admin list. Product decision pending (Section 14, O1). |
| D7 | A code can be edited only while it has never been redeemed (`Redeemed` rows = 0 and `usage_count` = 0), as today. Disable/enable is always allowed (kill switch). Codes are never deleted. |
| D8 | Affiliate restriction is removed from the form; stored values are kept but ignored (as today). |
| D9 | Per-customer limit default 1; "Unlimited" stored as -1. Global limit and budget: blank = unlimited (-1). |
| D10 | Dates are stored as UTC ISO-8601; the admin enters them in their local time (existing behaviour). Shown as `DD/MM/YYYY HH:mm`. |
| D11 | Mito fails closed: if a check cannot run, the code is not accepted. |

---

## 3. Business rules

### 3.1 Validation order (engine `check`)
Run in this order; the first failure is returned (code, HTTP status, customer message — Section 6.4):

| # | Rule | Error code |
|---|---|---|
| PR-1 | Code present (trimmed, uppercased) | `VALIDATION` |
| PR-2 | Code exists | `INVALID_CODE` |
| PR-3 | `status = Active` | `INACTIVE` |
| PR-4 | now ≥ `start_date` | `NOT_STARTED` |
| PR-5 | now ≤ `end_date` | `EXPIRED` |
| PR-6 | global limit not reached (`-1` = unlimited) | `FULLY_REDEEMED` |
| PR-7 | budget not used up (`-1` = unlimited) | `BUDGET_SPENT` |
| PR-8 | currency matches (`currency` or `source_currency` of the request, if the code has a currency) | `CURRENCY` |
| PR-9 | send amount ≥ `min_threshold` (when amount given) | `BELOW_MIN` |
| PR-10 | corridor allowed (when the code lists corridors, `<source>-<dest>` must be in the list) | `CORRIDOR` |
| PR-11 | payment method allowed (when the code lists methods **and** a method is given; aliases below) | `PAYMENT_METHOD` |
| PR-12 | audience matches (Section 3.3) | `NOT_YOUR_CODE` / `SEGMENT` |
| PR-13 | customer's own redemptions < per-customer limit (when user id given; `-1` = unlimited) | `ALREADY_USED` |
| PR-14 | (redeem only) budget left ≥ this discount → otherwise the discount is reduced to the budget left; if that is 0, `BUDGET_SPENT` | `BUDGET_SPENT` |

Payment-method aliases (keep exactly): `banktransfer, bankdeposit, instantbank, manualtransfer, bank → bank`; `card, creditdebitcard, debitcard, creditcard → card`; `mobilemoney`; `ussd`; `wallet`; `cashpickup`. Comparison is on lowercased, non-alphanumerics-removed keys.

### 3.2 Discount
- **PR-20** Fixed: `value`. Percentage: `fee × value / 100` (if `fee` not given, use `amount` — today's fallback, kept for old callers). Waiver: `fee` (0 if not given). Legacy types: 0.
- **PR-21** Apply `max_discount` cap if set; then cap at `fee` when fee is given; then round half-up to the currency's decimals (JPY 0, others 2). Never negative.
- **PR-22** `displayText`: Percentage `<value>% off fees (<CUR> <discount> saved)`; Fixed `<CUR> <discount> off`; Waiver `Fees waived`; FX_BOOST `+<value> rate boost`; BONUS_CREDIT `<CUR> <value> bonus credit`. (Unchanged.)

### 3.3 Audience
Stored in `user_segment` JSON (existing column). Supported shapes:

| Shape | Who matches |
|---|---|
| `{ "type": "all" }` (default) | everyone |
| `{ "type": "new_customers" }` | customers with **0** completed transfers before this one |
| `{ "type": "existing_customers" }` | customers with **≥ 1** completed transfer before this one (same meaning as today) |
| `{ "type": "targeted", "user_id": "<id>" }` | exactly that customer (existing personal codes) |
| `{ "type": "specific_customers", "user_ids": ["..."] }` | any listed customer (max 500 ids) |
| `{ "type": "<segment id>" }` | evaluated with `segmentProvider` criteria (`TRANSACTION_COUNT`, `TRANSACTION_VOLUME`, `NEW_USER`, optional `period_days`, `currency`, `signup_start_date`, `signup_end_date`) against the module's own `promo_transfers` and `promo_customers` |

- **PR-25** Without a user id, any audience other than `all` fails (`SEGMENT`, or `NOT_YOUR_CODE` for targeted/specific).
- **PR-26** Unknown segment id → fails (`SEGMENT`).
- **PR-27** "Before this one": exclude the transfer being validated/redeemed (`transaction_id`) from counts.

### 3.4 Redemption, release, activity
- **PR-30** Redeem (`API-S2`): requires `transaction_id`. Inside one `BEGIN IMMEDIATE` transaction: if a row exists for (code, transfer): `Released` → 409 `RELEASED`; `Redeemed` → return `{ success: true, idempotent: true, discount }`. Else run `check`, apply PR-14, insert the redemption (`Redeemed`, user id, discount, created_at), increment `usage_count` and `total_discount_utilized`.
- **PR-31** Release (`API-S3`): requires `transaction_id`; `code` optional. Every `Redeemed` row for that transfer becomes `Released` with `released_at` and `release_reason`; decrement `usage_count` (not below 0) and `total_discount_utilized` (not below 0). Repeat calls are no-ops (`released: 0`).
- **PR-32** Transfer events (`API-S4`): `CANCELLED`, `FAILED`, `REFUNDED`, `RECALLED`, `CHARGEBACK` → release (reason = status). Every event upserts `promo_transfers` (status, amount, currencies, created_at kept from first event). `COMPLETED` transfers are what audience checks count.
- **PR-33** Customer sync (`API-S5`): upserts `promo_customers` (id, created_at, country, send_currency, account_status). Used for signup-date criteria and for names in reports.

### 3.5 Admin rules
- **PR-40** Field validation in Section 5.2 (server authoritative; client mirrors it).
- **PR-41** Code uniqueness is case-insensitive across all codes, including disabled and expired ones.
- **PR-42** Edit blocked after first use: 409 `IN_USE`, message `This code has already been used, so it cannot be edited. Create a new code instead.` (unchanged text).
- **PR-43** Every create, edit, enable, disable writes `promo_audit` rows (field, old, new, admin, time).
- **PR-44** `usage_count` and `total_discount_utilized` are only changed by redeem/release (and the deprecated `apply` alias, Section 8.3).

---

## 4. Data model

Keep existing tables and columns (other code reads them). Add columns with `ALTER TABLE ... ADD COLUMN` only if missing. Money stays `REAL` (existing); all arithmetic is done in integer minor units in `money.js` and rounded per currency.

### 4.1 `promo_codes` (existing + new columns)
Existing: `id, code UNIQUE, type, value, min_threshold, max_discount, currency, usage_limit_global, usage_limit_per_user, usage_count, total_discount_utilized, budget_limit, start_date, end_date, status, restrictions (JSON: corridors[], payment_methods[], affiliates[]), user_segment (JSON), user_segment_criteria (JSON), created_at`.
Add: `description TEXT` (internal note, max 200), `updated_at TEXT`, `created_by TEXT`, `disabled_at TEXT`.
Note: some old rows have text ids (`pc_...` from the distribute endpoint). Treat `id` as an opaque string in routes and joins.

### 4.2 `promo_redemptions` (existing + new columns)
Existing: `id, promo_code_id (holds the CODE text in rows written by redeem; older rows may hold the numeric id), transaction_id, user_id, discount_amount, status, created_at`; unique index `(promo_code_id, transaction_id)`.
Add: `currency TEXT`, `send_amount REAL`, `fee REAL`, `source_currency TEXT`, `dest_currency TEXT`, `payment_method TEXT`, `released_at TEXT`, `release_reason TEXT`.
Always join codes as `(pr.promo_code_id = pc.code OR pr.promo_code_id = CAST(pc.id AS TEXT))` — keep this for old rows.

### 4.3 New tables
- `promo_customers` — `id TEXT PK, created_at, country, send_currency, account_status, first_name, last_name, email, updated_at`.
- `promo_transfers` — `transfer_id TEXT PK, customer_id, amount REAL, currency, receive_currency, status, created_at, updated_at`; index `(customer_id, status)`.
- `promo_audit` — `id, promo_code_id, field, old_value, new_value, admin_name, created_at`.
- `promo_schema_migrations` — `name PK, applied_at`.

### 4.4 One-off backfill (`promo_module_v1`, idempotent)
- Copy rows from `referral_transfers` into `promo_transfers` (if that table exists), and `customers` (id, created_at, country, send_currency, account_status, names, email) into `promo_customers`, so audience checks give the same answers as today on day one.
- For each redemption with null `currency`, set it from its code.
- Back up the SQLite file first (`database.backup-before-promo-module.sqlite`). Log counts.

---

## 5. Admin UI — Financials > Promo Codes (`/financials/promocodes`)

Keep the existing page location and table look. Replace all `alert()` calls with the shared toasts and `ConfirmDialog` from `components/Feedback.jsx`. Every modal has a close (×) button and closes on Esc.

### 5.1 Page header and summary
- Title `Promo Codes`, subtitle `Configure and monitor your promo codes and discounts.`, primary button `+ Create New`.
- KPI tiles: **Active codes** (display_status Active), **Uses (last 30 days)** (Redeemed redemptions), **Cost incurred** (Σ discount of Redeemed redemptions, one line per currency, never summed across currencies).
- Filters: search (code), Status (All, Active, Scheduled, Expired, Disabled, Fully redeemed, Budget spent), Type, Currency. Filters in the URL query.

### 5.2 Create / Edit modal (Updated 15 Oct 2026 — v1.1)

Title `Create Promo Code` / `Edit Promo Code`. Header includes a disabled `"Generate a batch of codes (Disabled)"` checkbox (batch generation disabled in UI for Phase 1).

**Code details**

| Label | Key | Control | Required | Default | Validation → message |
|---|---|---|---|---|---|
| Promo Code | code | text, uppercased as typed, monospace, placeholder `e.g. SAVE20` | Yes | — | empty → `Enter a promo code.`; not `^[A-Z0-9-]{3,20}$` → `Use 3–20 letters, numbers or hyphens.`; duplicate → `This promo code already exists.` Editable while code has 0 uses. |
| Internal note | description | text, max 200 | No | — | `Keep the note under 200 characters.` |
| Type | type | select: `Fixed amount off the fee`, `Percentage of the fee`, `Fee waiver` (legacy types only shown, disabled, when editing a legacy code) | Yes | Fixed | — |
| Send Currency | currency | select, all 13 supported currencies (GBP, USD, EUR, NGN, CAD, AUD, JPY, CNY, INR, ZAR, KES, GHS, AED) | Yes | GBP | Positioned at top so currency indicator is reflected across all value/threshold/budget fields. |
| Applies to transaction flow | applies_to_flow | select: `Send Money`, `Receive Money`, `Both (Send & Receive)` | Yes | `send` | Stored in `restrictions.applies_to_flow`. |
| Discount Value (`<CUR>` or `%`) | value | number; prefix currency symbol (Fixed) or suffix `%` (Percentage); hidden for Waiver | Fixed/Percentage | — | Fixed: > 0, ≤ 1,000,000, decimals per currency → `Enter an amount greater than 0.`; Percentage: > 0 and ≤ 100, max 2 dp → `Enter a percentage between 0.01 and 100.` |
| Max discount (`<CUR>`, optional) | max_discount | number with currency symbol prefix (Percentage only) | No | blank | if set: > 0 → `Enter a cap greater than 0, or leave it blank.` |
| Minimum send amount (`<CUR>`, optional) | min_threshold | number with currency symbol prefix | No | blank (=0) | ≥ 0 → `Enter 0 or more.` Hint `The customer must send at least this amount.` |

**Limits**

| Label | Key | Default | Validation |
|---|---|---|---|
| Total uses (optional) | usage_limit_global | blank = Unlimited | whole number 1–10,000,000 → `Enter a whole number, or leave it blank for unlimited.` |
| Total budget (`<CUR>`, optional) | budget_limit | blank = Unlimited | number with currency symbol prefix; > 0 → `Enter an amount greater than 0, or leave it blank for unlimited.` Hint `Stops the code when this much discount has been given.` |
| Uses per customer | usage_limit_per_user | 1, with checkbox `Unlimited` | whole number 1–1,000 → `Enter a whole number from 1 to 1,000.` |

**Dates** — Start, End (`datetime-local`, admin's local time, sent as UTC ISO). Start required → `Choose a start date.`; End required → `Choose an end date.`; End ≤ Start → `End date must be after the start date.`; on create, End in the past → `End date must be in the future.`

**Where it can be used**
- Corridors: checkbox `All corridors` (default ticked). Unticked: Send currency select (auto-synced with code's Send Currency) + **Receive currency / country typeahead search box** and dropdown (`Add` button) that adds removable pill tags (`GBP → NGN ×`) below. Unticked with no corridors → `Add at least one corridor, or tick All corridors.` Duplicates ignored.
- Payment methods: checkbox `All payment methods` (default). Unticked: checkboxes `Bank Transfer`, `Card`, `Mobile Money`, `USSD`. None selected → `Choose at least one payment method, or tick All payment methods.`

**Who can use it** (radio)
- `Everyone`
- `New customers only` (hint `No completed transfers yet.`)
- `Existing customers only` (sub-label `(1 or more completed transactions)`)
- `Specific customers`:
  - Copy-paste textarea supporting **Customer Email Addresses or Customer IDs** (comma/newline/semicolon separated, max 500; invalid → `Enter up to 500 valid customer emails or IDs.`)
  - **`Upload CSV / file`** button that parses `.csv`/`.txt` files of emails/IDs and merges them into the list, with a live count pill (`<n> customers selected`).
  - Optional qualification criteria: `Min completed transactions` (`min_transactions`) and `Min transfer volume (<CUR>)` (`min_volume`).
- `Saved segment` (select from `GET /api/promocodes/segments`; hidden if none).

**Preview line** (live): e.g. `Customers sending GBP → NGN by Bank Transfer get 20% off the fee (max £5.00) on transfers of £100.00 or more, once each, until 31/12/2026 23:59.`

Buttons: `Cancel`, `Create Promo Code` / `Save Changes` (disabled while saving: `Saving...`).
- **AC-5.2.1** On submit, show field errors inline and focus the first one; toast `Please correct the highlighted fields.`
- **AC-5.2.2** Success toasts: `Promo code <CODE> created.` / `Promo code <CODE> updated.`
- **AC-5.2.3** Server 409 `IN_USE` while the modal is open → toast with the message, modal closes, list refreshes.
- **AC-5.2.4** Legacy codes open read-only with banner `This is a legacy <FX Rate Boost|Bonus Credit> code. It gives no fee discount. You can disable it or create a new code.`

### 5.3 Codes table
Columns (keep existing order and add two):

| Column | Content |
|---|---|
| Code | code (monospace) + note underneath (grey) + `Legacy` tag where D6 applies |
| Type | `Fixed`, `Percentage`, `Fee waiver`, `FX Boost (legacy)`, `Bonus Credit (legacy)` |
| Value | `£5.00`, `20%` (+ `max £5.00`), `Whole fee` |
| Where | `All corridors` or chips (max 2 then `+n`), payment methods line |
| Who | `Everyone`, `New customers`, `Existing customers`, `1 customer`, `<n> customers`, segment name |
| Cost incurred | `<CUR> <total_discount_utilized>` + ` / <budget>` when set |
| Usage | `<usage_count>/<limit or ∞>` + `(<per user or ∞>/user)` |
| Period | start – end (DD/MM/YY) |
| Status | badge per 2.2, tooltip on Expired `The end date has passed, so customers cannot use this code.` |
| Actions | `Usage`, `Edit` (enabled if `usage_count === 0 && redeemed_count === 0`; rendered `disabled` with tooltip `Only codes that have not been used can be edited` once used), `History`, `Disable`/`Enable` |

- **AC-5.3.1 Disable**: confirm `Disable <CODE>?` / `Customers will not be able to use this code. Transfers already paid keep their discount.` / danger `Disable`. Toast `<CODE> disabled.`
- **AC-5.3.2 Enable**: no confirm. Toast `<CODE> enabled.` If the end date has passed, toast warning `<CODE> is enabled but its end date has passed, so customers still can't use it.`
- **AC-5.3.3 Usage** modal `Where <CODE> was used` (widened dialog `max-width: 1020px` so all columns fit without horizontal scrolling): columns Transfer, Customer (name + id when known), Corridor, Payment method, Discount (code currency), Status (`Redeemed` / `Released (cancelled, failed or refunded)`), Date. Footer totals: `Redeemed: <n> · Discount given: <amount>`. Empty: `This code has not been used on any transfer yet.` Button `Export CSV`.
- **AC-5.3.4 History** panel (`GET /api/promocodes/:id/audit`): merges admin audit rows with transfer redemption events (`Used on a transfer — <Customer>, transfer <Ref>, <CUR> <Amount>`), sorted newest first.
- States: loading `Loading promo codes...`; empty `No promo codes yet. Create your first code.`; error `We couldn't load promo codes.` + `Retry`.
- Export CSV of the codes list (`promo-codes.csv`).

### 5.4 Bulk and personal codes
- `Bulk create` button in the header is **disabled** (`disabled` attribute with tooltip `"Bulk promo code creation is currently disabled"`) per 15 Oct 2026 review.
- The backend `API-A8` (`POST /api/promocodes/bulk`), `/api/promocodes/generate`, and `/api/promocodes/distribute` remain operational for compatibility.

### 5.5 Support / Financials > Transactions & Accountant Reporting (`/support/transactions`)
- **Summary Snapshot (MTO Submissions)**: Collapsible summary table at the top of the Transactions Search page showing per-currency rows (`GBP`, `EUR`, `USD`, `NGN`, etc.) and a `Totals` row with columns: `Currency`, `Transactions`, `Total Send Amount`, `Discount / Rewards Applied`, `Actual Customer Paid`, `Total Fees`, and `Net MTO Submission`.
- **Filters & Accountant Export**:
  - `Rewards / Promo Filter` dropdown (`All Transactions`, `Any Discount / Reward Applied`, `Promo Code Applied`, `Bonus Credit Applied`, `No Discount Applied`).
  - `Export Accountant Report (CSV)` button exporting full transaction financial breakdown (`Send Amount`, `Amount Sent`, `Fee`, `Reward Type`, `Promo Code`, `Discount Applied`, `Actual Customer Paid`, `Exchange Rate`, `Beneficiary Received`).
- **Transaction Search Table — Amount / Payout Column**:
  - Displays the **Send Amount before discount** alongside a `🎁 ⓘ` Rewards/Info badge for discounted transfers.
  - Hovering or clicking `🎁 ⓘ` opens a breakdown popover showing `Send Amount`, `Discount (<CODE>)`, and `Actual Customer Paid`.
- **Transaction Details View (`/support/transactions/:id`)**:
  - Top **Summary Card** always displays a permanent `Discount applied` field: shows a green badge `🏷️ -<CUR> <Discount> (<CODE>)` when a promo/bonus was applied, or `-` (hyphen) when none was applied.
  - **`Download Details (PDF)`** modal & printable receipt lists **Payment Details** in the exact order:
    1. `Payment method`
    2. `Amount sent`
    3. `Discount applied`
    4. `Customer paid`
    5. `Transaction fee`
    6. `Rate (applied to amount sent)`
    7. `Beneficiary received`
    8. `Payment status`

---

## 6. Engine behaviour details

### 6.1 Request normalisation (keep)
Accept snake_case and camelCase: `code, amount, fee, currency, user_id|userId, source_currency|sourceCurrency, dest_currency|destCurrency, payment_method|paymentMethod, transaction_id|transactionId`. Uppercase currencies and code.

### 6.2 Concurrency
Redeem and release run inside `BEGIN IMMEDIATE ... COMMIT` so global limit, budget and per-customer limit cannot be exceeded by two transfers paid at the same moment.

### 6.3 Time
Use one injectable clock (`clock.now()`) for all date checks so tests can move time.

### 6.4 Errors returned to Rhemito
**Compatibility rule:** today Rhemito reads `body.message ?? body.error` as text. Keep `error` as the **customer message** string and add `code`: `{ "error": "<message>", "code": "<CODE>" }`.

| Code | HTTP | Message (customer-facing) |
|---|---|---|
| VALIDATION | 400 | `Enter a promo code.` |
| INVALID_CODE | 404 | `This promo code isn't valid. Check it and try again.` |
| INACTIVE | 400 | `This promo code is not active.` |
| NOT_STARTED | 400 | `This promo code is not valid yet.` |
| EXPIRED | 400 | `This promo code has expired.` |
| FULLY_REDEEMED | 400 | `This promo code has reached its limit.` |
| BUDGET_SPENT | 400 | `This promo code has reached its limit.` |
| CURRENCY | 400 | `This code only works on <CUR> transfers.` |
| BELOW_MIN | 400 | `Send at least <amount formatted> to use this code.` |
| CORRIDOR | 400 | `This code can't be used for this destination.` |
| PAYMENT_METHOD | 400 | `This code can't be used with this payment method.` |
| NOT_YOUR_CODE | 403 | `This code was issued to another customer.` |
| SEGMENT | 403 | `This code is not available for your account.` |
| ALREADY_USED | 400 | `You have already used this promo code.` |
| RELEASED | 409 | `This transfer was cancelled or refunded, so its promo code use was released.` |
| UNAUTHORIZED | 401 | `Not authorised.` |

Messages that differ from today (update the matching test assertions and list them in the PR): INVALID_CODE, FULLY_REDEEMED, BUDGET_SPENT, CURRENCY, BELOW_MIN, CORRIDOR, PAYMENT_METHOD, ALREADY_USED, and the split of `INACTIVE` into `NOT_STARTED`/`EXPIRED` codes (messages unchanged).

---

## 7. Flows

```
Rhemito customer types code ─► Rhemito server ─► API-S1 validate (nothing recorded) ─► discount shown
Customer pays ─────────────────► Rhemito server ─► API-S1 validate (with payment method) ─► API-S2 redeem
Transfer cancelled/failed/refunded ─► Rhemito server ─► API-S4 transfer event ─► release
Customer created / profile changed ─► Rhemito server ─► API-S5 customer sync
```

### 7.1 Retired behaviour
- `POST /api/promocodes/distribute` targeted the `merchants` table and only simulated email. Keep the route working (for any caller) but mark deprecated in code; the UI never calls it (it was unreachable). Phase 2 bulk/personal codes replace it.

---

## 8. API contract

### 8.1 Service API (called by the Rhemito server)

**Auth:** header `X-Promo-Service-Key` must equal env `PROMO_SERVICE_KEY` **when that env var is set**; otherwise open (prototype). 401 `UNAUTHORIZED` on mismatch.

| ID | Method & path | Request | Success response |
|---|---|---|---|
| API-S1 | `POST /api/promocodes/validate` | `{ code, amount, fee, currency, userId, sourceCurrency, destCurrency, paymentMethod?, transactionId? }` | `200 { valid: true, promo, appliedDiscount, appliesTo: "fee", displayText, display_text, currency }` (all existing fields kept) |
| API-S2 | `POST /api/promocodes/redeem` | same + `transactionId` (required) | `200 { success: true, discount }` or `{ success: true, idempotent: true, discount }` |
| API-S3 | `POST /api/promocodes/release` | `{ transaction_id, code?, reason? }` | `200 { success: true, released: <n> }` |
| API-S4 | `POST /api/promocodes/transfer-events` (new) | `{ transfer_id, customer_id, amount, currency, receive_currency, status, created_at }` | `200 { released: <n> }` |
| API-S5 | `POST /api/promocodes/customers` (new) | `{ id, created_at, country, send_currency, account_status, first_name?, last_name?, email? }` | `200 { success: true }` |
| API-S6 | `GET /api/promocodes/customers/:id/redemptions` (new) | — | `200 { data: [{ id, code, transaction_id, discount, currency, status, created_at }], summary: { saved: { <CUR>: n } } }` (Redeemed only in `saved`) |

`promo` in API-S1 is the stored row (kept for compatibility); Rhemito must not depend on internal fields beyond `code`, `type`, `currency`.

### 8.2 Admin API (Mito client)

| ID | Method & path | Notes |
|---|---|---|
| API-A1 | `GET /api/promocodes?status=&type=&currency=&q=` | rows (parsed JSON fields as today) + `display_status`, `is_legacy`, `redeemed_count` |
| API-A2 | `POST /api/promocodes` | 200/201 `{ success: true, id }` (keep `success`); 400 `{ error: <message>, code: "VALIDATION", fields: {...} }`; 409 `{ error: "Promo code already exists", code: "DUPLICATE" }` |
| API-A3 | `PUT /api/promocodes/:id` | edit unused code; 409 `IN_USE` |
| API-A4 | `PUT /api/promocodes/:id/status` | `{ status: "Active" | "Disabled" }`; 400 for any other value |
| API-A5 | `GET /api/promocodes/:id/redemptions` | existing; add `currency, send_amount, source_currency, dest_currency, payment_method, customer_name` |
| API-A6 | `GET /api/promocodes/:id/audit` | audit rows |
| API-A7 | `GET /api/promocodes/summary?from=&to=` | KPI tiles |
| API-A8 | `POST /api/promocodes/bulk` (Phase 2) | `{ config, prefix?, count? , customer_ids? }` → `{ success, created: [{ code, customer_id? }] }` |
| API-A9 | `GET /api/promocodes/segments` | from `segmentProvider.listSegments()` |
| API-A10 | `GET /api/promocodes.csv`, `GET /api/promocodes/:id/redemptions.csv` | CSV exports |

### 8.3 Kept for compatibility (do not remove in this project)

| Route | Behaviour after change |
|---|---|
| `POST /api/promocodes/apply` | Deprecated. If `transaction_id`/`transactionId` given → behaves as redeem. Otherwise keep today's behaviour (increments counters) for the Mito `TestCheckout` page. Log a deprecation warning. |
| `POST /api/promocodes/generate` | Keep; fix the response to `{ success: true, created: <n>, codes: [...] }` after all inserts finish. |
| `POST /api/promocodes/distribute` | Keep as is (deprecated). |
| `promoEngine.validate/redeem/release/check/computeDiscount/normalise` | Same names exported from `server/promoEngine.js` (re-export). |

### 8.4 Read functions for other Mito modules
Export from `server/promo/index.js`: `listRedemptions({ userId?, codeId?, from?, to? })` and `savingsFor(userId)`. Other modules (User Credit Ledger, the shared bonus wallet `/api/wallet/:id` `promo_redemptions` field) must call these instead of querying promo tables directly. Their **output shape must stay the same** (Section 11).

---

## 9. Security and audit
- Admin routes use `adminIdentity` for audit names. Prototype mode (no `ADMIN_USERS`) = `Admin`.
- Never log full customer details; log ids.
- All SQL uses bound parameters (the `distribute` route builds SQL with params already — keep that).
- Rate limit `validate` per user id: 30/min (429 `Too many attempts. Please wait a minute and try again.`).

---

## 10. Non-functional
| # | Requirement |
|---|---|
| NFR-1 | `validate` p95 < 200 ms with 10k codes and 200k redemptions (index on `promo_redemptions(user_id)`, `promo_redemptions(transaction_id)`, `promo_codes(code)`). |
| NFR-2 | Redeem/release idempotent and atomic (6.2). |
| NFR-3 | Starts cleanly on an empty DB and on the current production DB. |
| NFR-4 | Demo seed codes (SAVE20, GLITCH500, BOOSTRATE) still only seeded when `NODE_ENV !== 'production'`. |

---

## 11. Must-not-break checklist (verify each in the PR)

| # | Consumer | What must still work |
|---|---|---|
| C1 | Rhemito `server/promoService.ts` | `POST /api/promocodes/validate` and `/redeem` with camelCase body; reads `appliedDiscount`, `appliesTo`, `displayText`; reads `body.message ?? body.error` on errors |
| C2 | Rhemito `sendMoneyRoutes.ts` pay flow | validate then redeem with `transactionId` = transfer reference; idempotent retry |
| C3 | Rhemito via referral/bonus transfer events | today promo release happens inside the referral route's `afterTransferEvent` hook. Keep that call until Rhemito sends API-S4 (companion spec); both paths are idempotent, so running both is safe. Remove the hook call only in a later PR after confirming Rhemito sends API-S4 in production. |
| C4 | Mito `GET /api/wallet/:customerId` | `promo_redemptions: [{ id, code, amount (negative), currency, transfer_id, created_at }]` same shape (now built from `listRedemptions`) |
| C5 | Mito User Credit Ledger (`server.js` history union) | promo rows still listed with the same columns and filters (now from `listRedemptions`) |
| C6 | Mito `client/src/pages/TestCheckout.jsx` | validate + deprecated apply |
| C7 | Existing tests | `server/tests/engines.test.js` promo cases, `api.test.js`, `test_cost_incurred.js`, `tests/e2e/global.spec.js`, `tests/verify_global_ledger.js` |
| C8 | Existing data | old redemptions whose `promo_code_id` is a numeric id; codes with text ids `pc_...`; `user_segment` stored both top-level and inside `restrictions` (read top-level first, then `restrictions.user_segment`) |
| C9 | Bonus Scheme Manager segments page | unaffected (promo only reads `user_segments`) |

---

## 12. Build phases

| Phase | Content | Exit check |
|---|---|---|
| 1 | Move routes + engine into `server/promo/`, re-export shim, own error class, own audience evaluation with `promo_transfers`/`promo_customers`, backfill, new columns, API-S4/S5/S6, read functions, concurrency. No UI change. | All existing tests green; new engine tests green; C1–C9 checked |
| 2 | Admin UI: validation, toasts/dialogs, derived status, filters, KPIs, usage modal upgrade, history, all 13 currencies, audience options, legacy handling, CSV | Playwright `promo_admin.spec.js` green |
| 3 | Bulk and personal codes (5.4, API-A8), `/generate` response fix | tests green |

---

## 13. Reference implementation (current code)

| Concern | File |
|---|---|
| Engine (validate, redeem, release, discount, aliases) | `server/promoEngine.js` |
| Admin routes (list, create, edit, status, redemptions, generate, distribute, apply), schema and seeds | `server/server.js` (search `promo`) |
| Error class and segment matching to replace | `server/bonusEngine.js` (`Reject`, `segmentMatches`, `customerStats`, `signupDate`) |
| Admin page and modals | `client/src/pages/Financials/PromoCodes.jsx`, `client/src/components/Promo/CreatePromoModal.jsx`, `CreateDistributionModal.jsx` (unreachable) |
| Tests | `server/tests/engines.test.js`, `api.test.js`, `test_cost_incurred.js`, `tests/e2e/global.spec.js` |

## 14. Open items (do not build; listed for the product owner)
| # | Item |
|---|---|
| O1 | FX rate boost and bonus-credit promo types: implement (needs rate engine / wallet integration) or retire legacy codes. |
| O2 | Should a promo discount ever apply to the send amount rather than the fee? |
| O3 | Real delivery of personal codes by email/SMS. |

## 15. Environment variables
| Var | Default | Purpose |
|---|---|---|
| `PROMO_SERVICE_KEY` | unset (open) | Shared secret with Rhemito |
| `ADMIN_USERS` | unset | Admin identities (existing) |

## 16. Definition of done
- Every PR-/AC-/API- item implemented and covered by named tests; full suite green.
- Must-not-break checklist (Section 11) ticked in the PR description with how each was verified.
- Promo module has no `require` of bonus, referral or ledger code.
- Backfill ran on a copy of `server/database.sqlite` with counts logged.
