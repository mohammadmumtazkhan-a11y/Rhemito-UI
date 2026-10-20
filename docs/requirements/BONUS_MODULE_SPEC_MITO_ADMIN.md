# Bonus Scheme Module — Mito Money Admin (Backend + Admin UI)

**Spec ID:** BONUS-MITO-v1.1 (one customer balance)
**Date:** 08 October 2026
**Author:** Mohammad Mumtaz (Business Analyst)
**Target codebase:** Mito Money Admin (`PromoCode` repo — `server/` Express + SQLite, `client/` React + Vite)
**Companion spec:** `BONUS_MODULE_SPEC_RHEMITO.md` (customer side). The service API in Section 9 is shared by both specs and must not drift.
**Related specs (independent modules):** `REFERRAL_MODULE_SPEC_MITO_ADMIN.md`, `PROMO_MODULE_SPEC_MITO_ADMIN.md`. Where they mention "the bonus module", "Bonus Blocks", "Bonus Debt", `user_segments` or `POST /api/bonus/transfer-events`, this spec is the definition.

> **v1.1 change — one balance, trackable by source.** This module owns the customer's **single bonus credit wallet**. Every credit in it — from bonus schemes, referrals, goodwill/manual grants, and credit returned after a cancelled transfer — records **how it was earned** (`credit_source` + `credit_credit_source_detail`, Section 3.11). Customers see and spend one balance; admins and customers can break it down by source. The referral module pays its rewards into this wallet through the public wallet functions in Section 1.3.

---

## 0. Instructions for the AI coding agent

1. **Nothing that works today may stop working.** This is a refactor and hardening of a live prototype (GitHub → Render). Section 11 lists every current consumer of bonus endpoints, tables and functions; each must still work. When in doubt, keep the old behaviour and add the new one beside it.
2. Read the whole document, then the current code in Section 13. Build in the phase order of Section 12. Each phase leaves the app working with all tests green.
3. Branch `feature/bonus-module`; small commits; PR at the end; never push to `main`.
4. Run the full suite before the PR: `server/tests` (incl. `engines.test.js`, `test_tiered_calculation.js`, `test_cost_incurred.js`, `referral.test.js`), client Vitest, Playwright (`tiered_bonus.spec.js`, `bonus_ledger.spec.js`, `global_ledger.spec.js`, `global.spec.js`). Update an assertion only where this spec changes a message on purpose, and list it in the PR.
5. Requirement IDs (`BS-`, `AC-`, `API-`) appear in test names.
6. Strings here are final copy; use them verbatim.
7. Ask if unclear. Items in Section 2.3 are decided.

---

## 1. Purpose and scope

### 1.1 Purpose
Mito Money admins set up **bonus schemes** that reward Rhemito customers with **bonus credit** for activity: being loyal (several transfers in a period), sending a large transfer, or getting a money request paid. Mito Money decides eligibility, computes and records the credit in the customer's **bonus wallet**, lets the customer spend it on a later transfer, expires it, reverses it when the earning activity is cancelled or refunded, and blocks customers who repeatedly cause such reversals. Admins can also grant or remove credit manually and audit everything in the ledger. The same wallet also holds referral rewards (issued by the referral module), so the customer has **one balance**, and every credit shows where it came from.

### 1.2 What "independent module" means

| The module OWNS | The module must NOT depend on |
|---|---|
| `bonus_schemes`, `user_segments`, `credit_ledger` (**the one customer bonus wallet, all sources**), `bonus_strikes`, `bonus_blocks` | Referral code (`referral.js`, `referral_*` tables) — today scheme eligibility reads `referral_transfers`, and the wallet routes and expiry job live in `referral.js` |
| Scheme rules, eligibility, award, reversal, clawback debt, blocks | Promo code code/tables — today the ledger history and wallet join `promo_*` tables directly |
| Wallet for every source: balance, source breakdown, apply, release, expiry, expiry reminders, manual adjustments | `customers` / `merchants` tables (used today for signup dates and names) |
| Own record of customer activity (`bonus_customers`, `bonus_transfers`) | |
| Admin pages: Bonus Scheme Manager (+ User Segments tab), Bonus Wallet / Ledger, Blocked Customers | |
| Service API for Rhemito and the bonus notifications feed | |

Code layout:
- `server/bonus/`: `index.js` (register), `schema.js`, `schemes.js` (CRUD + validation), `segments.js`, `engine.js` (eligibility, award, events, reversal), `wallet.js` (balance, apply, release, expiry, manual), `debt.js`, `blocks.js`, `jobs.js`, `ledger.js` (admin history), `feed.js`, `errors.js`, `money.js`, `time.js`, `ports.js`.
- Keep `server/bonusEngine.js`, `server/bonusDebt.js`, `server/bonusBlocks.js` as **re-export shims** of the new files (other code and tests import them).
- Client: `client/src/pages/Bonus/` (move `BonusSchemeManager.jsx`, `UserCreditLedger.jsx`, `BonusBlocks.jsx` here; keep their routes `/growth/bonus-schemes`, `/growth/credit-ledger`, `/growth/bonus-blocks` and nav labels).
- Tests: `server/tests/bonus/*.test.js`, `client/src/pages/Bonus/**/*.test.js`, `tests/e2e/bonus_*.spec.js`.

### 1.3 Ports (optional) and public functions

Ports (`server/bonus/ports.js`), defaults keep the module standalone:

| Port | Default | Purpose |
|---|---|---|
| `historySources` | `[]` | Extra read-only rows to merge into the admin ledger history (e.g. promo redemptions via the promo module's `listRedemptions`). Each source returns rows in the ledger row shape with `source_type` ≠ `BONUS`. |
| `adminIdentity` | prototype resolver (`Demo Growth Manager`) | Who acts, for audit and role checks. |

Public functions other modules may call (exported from `server/bonus/index.js`; they never call back into those modules):

| Function | Used by |
|---|---|
| `isEarningBlocked(customerId) → { blocked, reason }` | Referral module's `eligibilityGuard` port |
| `recordStrike({ customerId, eventId, kind, outcome, amountLost, currency })` | Referral module, when a referral reward is reversed |
| `listSegments()`, `getSegment(id)`, `segmentMatches(segId, customerId, ctx)` | Promo module's `segmentProvider` port |
| `issueCredit({ customerId, amount, currency, validityDays, creditSource, creditSourceDetail, referralId?, ruleId?, schemeId?, referenceId, notes, actor })` → `{ creditId }` | Referral module's `rewardWallet` port (`creditSource: 'REFERRAL'`). Idempotent on `referenceId`. Settles clawback debt like any new credit. |
| `voidCredit(creditId, { reason, notes, eventId, clawback })` → `{ voided, spent }` | Referral module on reversal (`reason: 'REFERRAL_REVERSAL'`, `clawback: false`) |
| `creditSummary({ referralIds? , schemeIds? })` → per currency `{ issued, used, returned, expired, voided }` | Referral performance report |

### 1.4 Out of scope
Deciding referral rewards (referral module — it only calls `issueCredit`/`voidCredit`). Promo codes (promo module). Paying bonus as cash. Changing exchange rates.

---

## 2. Glossary, statuses, decisions

### 2.1 Glossary

| Term | Meaning |
|---|---|
| Scheme types | `LOYALTY_CREDIT` (enough completed transfers in a period), `TRANSACTION_THRESHOLD_CREDIT` (one completed transfer at or above a minimum), `REQUEST_MONEY` (a paid money request at or above a minimum). `REFERRAL_CREDIT` is legacy, read-only. |
| Reward method | `FIXED` (credit amount), `PERCENTAGE` (percent of the activity amount), optionally **tiered** (bands of activity amount, each with a fixed amount or a percentage). |
| Bonus credit | Value in the bonus wallet in one currency, usable on transfers in that currency, until it expires. |
| Validity | Days a credit can be used after it is earned (`eligibility_rules.validityDays`, default 90). |
| One-time | A customer can earn a scheme only once (`eligibility_rules.oneTimeOnly`, default true). |
| Segment | Saved audience (`user_segments`): signup date range and/or transaction count or volume, lifetime or in the last N days. Built-ins: `all`, `existing_customers`. |
| Strike | A cancelled, refunded, recalled or charged-back transfer that cost Mito bonus. |
| Block | After N strikes (default 3) the customer cannot earn bonus until a Growth Manager approves them. |
| Clawback debt | Bonus already spent when its earning transfer is reversed; repaid automatically from the customer's next bonus credits. |

### 2.2 Scheme status
Stored `status`: `ACTIVE`, `INACTIVE`, `EXPIRED`, `ARCHIVED` (existing values). Shown status (derived, first match): `Archived` → `Inactive` (INACTIVE) → `Ended` (EXPIRED stored, or end_date < today) → `Scheduled` (start_date > today) → `Active`. Only shown-`Active` schemes award. `GET /api/bonus-schemes` keeps `status` unchanged and adds `display_status`.

### 2.3 Decisions (fixed)

| # | Decision |
|---|---|
| D1 | Bonus credit is in the **scheme's currency** and only reacts to activity in that currency. |
| D2 | Loyalty schemes are always for existing customers (≥ 1 earlier completed transfer), whatever segment is stored. |
| D3 | Awards are tied to the event (`evt:<schemeId>:<eventId>`); the same event never pays a scheme twice. |
| D4 | Credit is issued when the transfer is **COMPLETED** or the money request is **paid**. |
| D5 | Reversal: unused part of a credit is voided; spent part becomes clawback debt **when `BONUS_CLAWBACK` is on (default on — today's behaviour)**. |
| D6 | Strikes count for CANCELLED, REFUNDED, RECALLED, CHARGEBACK only (not FAILED), and only when bonus was actually lost. Limit `BONUS_BLOCK_STRIKES` (default 3). |
| D7 | Blocked customers are told only: `You're not qualified to get bonus. Please contact support for more information.` The reason is for admins only. |
| D8 | Blocking stops new earning only. It does not remove held credit, does not affect promo codes, does not stop manual credits. |
| D9 | Spending order: soonest expiry first, then oldest. No minimum send amount to use bonus. Bonus used on a transfer cannot exceed its send amount. |
| D10 | Credit used on a transfer that is later cancelled/failed/refunded is **returned**, keeping its original expiry if still in the future, otherwise today + 14 days. |
| D11 | Schemes are archived, never hard-deleted (`DELETE` archives — today's behaviour). |
| D12 | Days and dates use UK calendar days (`Europe/London`), shown `DD/MM/YYYY`. |
| D13 | **One balance.** All credit, whatever its source, is one balance per currency and is spent in D9 order regardless of source. Every credit keeps its source so it can be tracked (Section 3.11). |

---

## 3. Business rules

### 3.1 Scheme configuration
- **BS-1** Field rules in Section 5.2 (server authoritative, client mirrors).
- **BS-2** `REFERRAL_CREDIT` cannot be created or edited (400 `Referral rewards are managed in Growth > Referral Settings.` — unchanged). Existing ones show read-only with label `Legacy – managed in Referral Settings` and never award.
- **BS-3** Create honours the submitted status (`ACTIVE` default, or `INACTIVE`). Today create always forces ACTIVE; changing this is intended — note it in the PR.
- **BS-4** Editing a scheme never changes credits already issued.
- **BS-5** Every create, change, status change and archive writes `bonus_scheme_audit` rows (field, old, new, admin, time).
- **BS-6** Name unique (case-insensitive) among non-archived schemes.

### 3.2 Eligibility (engine `checkEligibility`), in this order — first failure wins

| # | Rule | Code | Admin-facing message |
|---|---|---|---|
| BS-10 | Customer not blocked | `BONUS_BLOCKED` | `Bonus is blocked for this customer: <reason>` |
| BS-11 | Scheme ACTIVE | `SCHEME_INACTIVE` | `Bonus scheme "<name>" is not active (status: <status>)` |
| BS-12 | today ≥ start_date | `SCHEME_NOT_STARTED` | `Bonus scheme "<name>" has not started yet (starts <DD/MM/YYYY>)` |
| BS-13 | today ≤ end_date | `SCHEME_EXPIRED` | `Bonus scheme "<name>" ended on <DD/MM/YYYY>` |
| BS-14 | activity currency = scheme currency (if both known) | `CURRENCY_MISMATCH` | `Bonus scheme "<name>" applies to <CUR>, not <CUR>.` |
| BS-15 | Threshold / Request Money: amount ≥ minimum (when minimum > 0 and amount known) | `BELOW_THRESHOLD` | `Amount <amount> is below the <minimum> minimum for "<name>".` |
| BS-16 | Loyalty: completed transfers (in scheme currency for events) in the last `time_period_days` ≥ `min_transactions` | `LOYALTY_NOT_MET` | `Customer has <n> of the <need> transactions needed in <days> days for "<name>".` |
| BS-17 | Segment: customer matches at least one listed segment (`all` passes; loyalty adds `existing_customers`) | `USER_INELIGIBLE` | `Customer does not meet the requirements for this bonus segment.` |
| BS-18 | One-time: no earlier EARNED from this scheme for this customer | `ALREADY_EARNED` | `Customer already earned "<name>" on <DD/MM/YYYY>. This is a one-time bonus.` |

Customer stats (count/volume) come from the module's own `bonus_transfers` (status COMPLETED), excluding the current event. Signup dates come from `bonus_customers`. Segment evaluation rules: as today (`NEW_USER` with no range checks signup dates only; `TRANSACTION_COUNT`/`TRANSACTION_VOLUME` with min/max, optional `period_days`, volume optionally in a currency; min/max inclusive; blank max = unlimited).

### 3.3 Amount
- **BS-20** Tiered: needs the activity amount; pick the tier with `min ≤ amount ≤ max` (blank max = ∞); tier value is a fixed amount or a percentage (by `commission_type`). No match → `TIER_MISMATCH`.
- **BS-21** Percentage: `amount × percentage / 100`; needs the amount (`TXN_REQUIRED`).
- **BS-22** Fixed: `credit_amount`.
- **BS-23** Optional cap `max_award` (new field): award = min(computed, cap).
- **BS-24** Round half-up to currency decimals (JPY 0, others 2). An award of 0 is skipped (`ZERO_AMOUNT`).
- **BS-25** Legacy fallback kept: if no amount is given but a `transaction_id` is, look up the old `transactions` table as today (admin manual award only).

### 3.4 Award
- **BS-30** Write `credit_ledger` EARNED: `id crd_…`, `user_id`, `amount`, `currency` (scheme), `scheme_id`, `reference_id` (`evt:<scheme>:<event>` for events, `idem_<key>` for idempotent manual awards, else transaction id or `bonus_<id>`), `reason_code SCHEME_BONUS`, `notes` = scheme name, `admin_user` (`System` for events), `expires_at` = today + validity, `transfer_id` = event id for transfer events.
- **BS-31** Then settle any clawback debt in that currency (Section 3.7).
- **BS-32** Emit feed item `BONUS_EARNED` (Section 8).
- **BS-33** All of BS-10…BS-32 for one scheme run in one DB transaction; the unique index `ux_credit_scheme_event` (keep) prevents double awards under concurrency.

### 3.5 Events
- **BS-40** `TRANSFER_COMPLETED` evaluates every ACTIVE `LOYALTY_CREDIT` and `TRANSACTION_THRESHOLD_CREDIT` scheme; `MONEY_REQUEST_PAID` evaluates every ACTIVE `REQUEST_MONEY` scheme. Each scheme returns `AWARDED` or `SKIPPED` with `reason` and `message` (not an error).
- **BS-41** Transfer events (`API-S1`): every event upserts `bonus_transfers`. `COMPLETED` → evaluate (BS-40). `CANCELLED`, `FAILED`, `REFUNDED`, `RECALLED`, `CHARGEBACK` → (a) return bonus applied to that transfer (D10), (b) reverse bonus earned by that transfer (BS-45).
- **BS-42** `MONEY_REQUEST_PAID` / `MONEY_REQUEST_REFUNDED` via `POST /api/bonus/events` (existing, unchanged body).
- **BS-43** A failure inside bonus evaluation never fails the caller's request: return `{ awards: [], error: "..." }` with 200 and log it.

### 3.6 Reversal
- **BS-45** For every EARNED credit with `reference_id LIKE 'evt:%:<eventId>'` not yet reversed: void the unused remainder (`VOIDED`, reason `SCHEME_REVERSAL`, notes `Bonus removed – <eventId> was cancelled or refunded`, `source_credit_id` = credit); record clawback debt for the spent part (if enabled); if anything was lost and outcome ≠ FAILED, record a strike. Emit `BONUS_REVERSED`. Idempotent.

### 3.7 Clawback debt (keep today's mechanics)
- **BS-50** Debt = `CLAWBACK` rows (negative, `reference_id clawback:<creditId>`, no `source_credit_id`). Never makes the usable balance negative.
- **BS-51** Settle: on every new credit in that currency, offset outstanding debt from usable credits soonest-expiry first: a `VOIDED` row (`CLAWBACK_OFFSET`, on the credit) + a `CLAWBACK_SETTLED` positive row.
- **BS-52** `BONUS_CLAWBACK=off` disables new debt (void unused only).

### 3.8 Blocks
- **BS-55** Strike per (customer, event), idempotent. When strikes since the last lift ≥ limit and no active block → create block with reason `<n> transfers that earned bonus were cancelled or refunded: <event> (<outcome> <YYYY-MM-DD>, <CUR> <amount> lost); …. Bonus is blocked until a Growth Manager approves the customer.`
- **BS-56** Lift: GROWTH_MANAGER only, reason 10–250 chars, approver from identity; strike count restarts.
- **BS-57** Emit `BONUS_BLOCK_LIFTED` to the customer feed when lifted (new; lets Rhemito tell the customer).

### 3.9 Wallet
- **BS-60** `remaining(credit) = amount + Σ rows with source_credit_id = credit.id`.
- **BS-61** Available (per currency) = Σ remaining of EARNED credits (incl. `BONUS_RETURNED`) with remaining > 0, not expired, not reversed.
- **BS-62** Apply (`API-S4`): `amount > 0`; ≤ `send_amount` → else 400 `Bonus cannot be more than the send amount.`; once per (customer, transfer) → else 409 `ALREADY_APPLIED` `Bonus has already been applied to this transfer.`; ≤ available → else 409 `BALANCE_CHANGED` `Your bonus balance has changed. Please review your transfer.` with `available`. Consume D9 order with `APPLIED` rows (`BONUS_REDEMPTION`, `transfer_id`). In one `BEGIN IMMEDIATE` transaction. Emit `BONUS_USED`.
- **BS-63** Release (`API-S5` or BS-41a): add `EARNED` rows with reason `BONUS_RETURNED`, `reference_id return:<transferId>`, expiry per D10; idempotent.
- **BS-64** Credit status per credit: `REVERSED` (VOIDED with `SCHEME_REVERSAL`/`REFERRAL_REVERSAL` child) → `EXPIRED` → `USED` → `PARTLY_USED` → `UNUSED`.
- **BS-65** Daily job (timer hourly, acts once per UK day, and `POST /api/bonus/run-jobs`): expire remaining of every EARNED credit with `expires_at` < today (`EXPIRED`, reason `EXPIRY`, notes `Unused bonus credit expired on DD/MM/YYYY`) — emit `BONUS_EXPIRED`; credits expiring in exactly 7 days — emit `BONUS_EXPIRING` once per credit. This is the **only** credit-expiry job, for every source (the referral module no longer expires credits; remove the credit-expiry part of `referral.js runJobs` in the same PR, and keep the skip-if-already-EXPIRED check so a run of the old job during deployment does no harm).

### 3.10 Manual adjustments (admin)
- **BS-70** Grant (`EARNED`): customer id, amount > 0, currency (default GBP for old callers), reason code (`GOODWILL`, `LOYALTY`, `CORRECTION`, `MANUAL_ADJUSTMENT`), notes 10–500 chars, optional scheme link, validity days (default 90) → `expires_at`. Not affected by blocks. Settles debt.
- **BS-71** Remove (`VOIDED`): customer, currency, amount ≤ available in that currency (else 400 `You can remove at most <available>.`), reason, notes. Voids from credits in D9 order with `source_credit_id` set, so balances stay correct. (Today a manual VOIDED row has no source credit — that is the bug being fixed.)
- **BS-72** Idempotency key: `reference_id = idem_<key>`; repeat returns the first result (today's behaviour).
- **BS-73** Admin name from identity, not the body (body `admin_user` ignored when `ADMIN_USERS` is set; used as before in prototype mode).

### 3.11 Source tracking (one balance, trackable)
- **BS-80** Every positive (`EARNED`) row has `credit_source` and `credit_source_detail`:

| How it was earned | `credit_source` | `credit_source_detail` | Links | Customer label |
|---|---|---|---|---|
| Loyalty scheme | `SCHEME` | `LOYALTY_CREDIT` | `scheme_id` | `Loyalty bonus – <scheme name>` |
| Large transfer scheme | `SCHEME` | `TRANSACTION_THRESHOLD_CREDIT` | `scheme_id` | `Transfer bonus – <scheme name>` |
| Request Money scheme | `SCHEME` | `REQUEST_MONEY` | `scheme_id` | `Request money bonus – <scheme name>` |
| Referral, as referrer | `REFERRAL` | `REFERRER` | `referral_id`, `referral_rule_id` | `Referral bonus – <friend masked name>` |
| Referral, as new customer | `REFERRAL` | `REFEREE` | `referral_id`, `referral_rule_id` | `Welcome bonus – invited by <masked name>` |
| Manual grant | `MANUAL` | `GOODWILL` / `LOYALTY` / `CORRECTION` / `MANUAL_ADJUSTMENT` | `admin_user` | `Goodwill credit from Rhemito` |

- **BS-81** Credit returned after a cancelled/failed/refunded transfer (`BONUS_RETURNED`) keeps the **source of the credit it came from** (one returned row per original credit used, with `returned_from_credit_id`), so tracking survives a round trip.
- **BS-82** Negative rows (APPLIED, EXPIRED, VOIDED) always carry `source_credit_id`, so used/expired/removed amounts are known per source.
- **BS-83** Customer source groups (used in breakdowns and filters): `REFERRAL` → **Referrals**, `SCHEME` → **Bonus offers**, `MANUAL` → **From Rhemito**.
- **BS-84** Breakdown (per currency, per source group): `earned` (Σ EARNED excl. returned), `used` (Σ|APPLIED| − Σ returned), `expired`, `removed` (voided by reversal or admin), `available` (Σ remaining of usable credits). Groups add up to the currency totals exactly.
- **BS-85** Clawback debt and its settlement rows are not a source; they reduce the credits they are taken from (shown as `removed`).

---

## 4. Data model (keep existing tables; add only)

- `bonus_schemes` (existing): add `max_award REAL`, `description TEXT`, `created_by TEXT`, `archived_at TEXT`. `eligibility_rules` JSON keeps `segments[]`, `oneTimeOnly`, `validityDays`.
- `user_segments` (existing): add `updated_at`. `criteria` JSON unchanged.
- `credit_ledger` (existing): columns used — `id, user_id, amount, type (EARNED|APPLIED|EXPIRED|VOIDED|CLAWBACK|CLAWBACK_SETTLED), scheme_id, reference_id, reason_code, notes, admin_user, admin_user_id, expires_at, created_at, currency, referral_id, referral_rule_id, source_credit_id, transfer_id`. **Add** `credit_source TEXT`, `credit_source_detail TEXT`, `returned_from_credit_id TEXT`; index `(user_id, currency, credit_source)`. Keep index `ux_credit_scheme_event`. Add indexes `(user_id, currency, type)`, `(source_credit_id)`, `(transfer_id)`.
- `bonus_strikes`, `bonus_blocks` (existing, unchanged).
- New: `bonus_customers (id PK, created_at, country, send_currency, account_status, first_name, last_name, email, updated_at)`, `bonus_transfers (transfer_id PK, customer_id, amount, currency, receive_currency, status, created_at, updated_at)`, `bonus_scheme_audit (id, scheme_id, field, old_value, new_value, admin_name, created_at)`, `bonus_feed (id INTEGER PK, customer_id, type, payload JSON, dedupe_key UNIQUE, created_at)`, `bonus_job_state (name PK, value)`.
- Backfill `bonus_v1` (idempotent, back up DB first to `database.backup-before-bonus-module.sqlite`): copy `referral_transfers` → `bonus_transfers` and `customers` → `bonus_customers` so eligibility answers are the same on day one. Set `credit_source`/`credit_source_detail` on every existing EARNED row: `REFERRAL_REWARD` → `REFERRAL` + (`REFERRER` if `reference_id` ends `:referrer`, else `REFEREE`); `SCHEME_BONUS` → `SCHEME` + the scheme's `bonus_type`; manual reason codes → `MANUAL` + reason; `BONUS_RETURNED` → source of the credit its matching APPLIED row came from (fallback `MANUAL`/`CORRECTION` when unknown, logged); `LOYALTY` seed rows → `MANUAL`/`LOYALTY`. Log counts per source.

---

## 5. Admin UI

Shared: replace every `alert()` with toasts and `ConfirmDialog` (`components/Feedback.jsx`); every modal has × and Esc; tooltips on column headers (`ColHead`).

### 5.1 Bonus Scheme Manager (`/growth/bonus-schemes`) — tabs **Bonus Schemes** and **User Segments** (keep)

### 5.2 Scheme form

| Label | Key | Required | Default | Validation → message |
|---|---|---|---|---|
| Bonus Name | name | Yes | — | empty → `Enter a bonus name.`; 3–60 chars → `Use 3–60 characters.`; duplicate → `A scheme with this name already exists.` |
| Internal note | description | No | — | ≤ 200 → `Keep the note under 200 characters.` |
| Bonus Type | bonus_type | Yes | Loyalty | options `Loyalty Credit`, `Transaction Threshold Credit`, `Request Money Credit` |
| Currency | currency | Yes | GBP | 13 supported currencies; hint `Only activity in this currency earns this bonus, and the bonus is paid in it.` |
| Reward method | commission_type | Yes | Fixed | `Fixed amount`, `Percentage of the amount` |
| Tiered | is_tiered | — | off | toggle `Different rewards for different amounts` |
| Credit Amount | credit_amount | Fixed, not tiered | — | > 0, decimals per currency → `Enter an amount greater than 0.` |
| Percentage | commission_percentage | Percentage, not tiered | — | 0.01–100 → `Enter a percentage between 0.01 and 100.` |
| Maximum bonus (optional) | max_award | No | blank | > 0 → `Enter an amount greater than 0, or leave it blank.` (shown for Percentage or Tiered) |
| Tiers | tiers[] {min, max, value} | Tiered | 1 row | each min ≥ 0; max blank only on the last tier; max > min → `Max must be more than Min.`; tiers sorted, no gaps or overlaps → `Tiers must follow on from each other with no gaps or overlaps.`; value > 0 (≤ 100 if percentage) |
| Minimum transfer amount | min_transaction_threshold | Threshold | — | > 0 → `Enter a minimum greater than 0.` |
| Minimum requested amount | min_transaction_threshold | Request Money | 0 | ≥ 0 → `Enter 0 or more.` |
| Number of Transactions | min_transactions | Loyalty | — | whole 1–1,000 → `Enter a whole number from 1 to 1,000.` (existing message `Number of Transactions is required for Loyalty Credit` kept server-side when missing) |
| Time Period (Days) | time_period_days | Loyalty | — | whole 1–3,650 → `Enter a whole number of days from 1 to 3,650.` |
| Bonus valid for (days) | eligibility_rules.validityDays | Yes | 90 | whole 1–730 → `Enter a whole number of days from 1 to 730.` |
| Can a customer earn this more than once? | eligibility_rules.oneTimeOnly | Yes | No (once only) | radio `Once only` / `Every time they qualify` |
| Start Date / End Date | start_date, end_date | Yes | — | `Choose a start date.` / `Choose an end date.`; end ≤ start → `Start date must be before end date.` (existing wording) |
| Status | status | Yes | Active | `Active`, `Inactive` (Expired/Archived not selectable) |
| Who can earn it | eligibility_rules.segments[0] | Yes | All Users | `All Users`, `Existing customers`, saved segments; Loyalty: locked to Existing customers with note `ⓘ Loyalty Credit is only for Existing Customers` (existing); Request Money: same options (today hidden — now shown) |

- Live summary line, e.g. `Customers who complete 3 GBP transfers within 30 days earn £10.00 bonus credit, valid for 90 days, once only.`
- **AC-5.2.1** Inline errors, focus first, toast `Please correct the highlighted fields.`
- **AC-5.2.2** Toasts `Bonus scheme created.` / `Bonus scheme updated.`
- **AC-5.2.3** Editing a scheme that has awards → confirm `This scheme has paid <n> bonuses. Changes apply only to new awards. Continue?`

### 5.3 Schemes table
Columns: Scheme (name + currency chip, `Tiered (n)` / `Legacy` tags), Type, Reward (`£10.00`, `5%` (max £20.00), tier list), Minimum / Rule (threshold or `3 in 30 days`), Validity (`DD/MM/YYYY – DD/MM/YYYY`, `valid 90d`, `once`/`repeat`), Who, Awards (`<n>` and bonus issued per currency — from ledger), Status (derived pill), Actions (`Edit`, `Activate`/`Deactivate`, `Archive`, `History`). Filters (keep): search, type, status, date range. Fix today's name cell showing `name-currency` → name with a currency chip.
- Archive confirm: `Archive '<name>'?` / `It will stop paying new bonuses. Bonuses already paid are not affected.` → toast `Scheme archived.`

### 5.4 User Segments tab (keep fields)
Name*, Description, Criteria Type (`New User (Signup Date)`, `Transaction Count`, `Transaction Volume`), Min, Max (empty = ∞), Currency (volume), Evaluation Period (`Since Registration (Lifetime)` / `In Past N Days` + days), Signed Up From/Until.
- Validation: name 3–60 unique → `A segment with this name already exists.`; min ≥ 0, max ≥ min → `Max must be at least Min.`; days 1–3,650; signup until ≥ from.
- Delete: blocked when a non-archived scheme (or promo code, via usage count passed by the promo module's read function if available) uses it → `This segment is used by <n> scheme(s). Remove it from them first.` Otherwise confirm and delete (existing behaviour).
- New: `Preview` button → `GET /api/user-segments/:id/preview` → `<n> customers match today.` (from `bonus_customers`/`bonus_transfers`).

### 5.5 Bonus Wallet / Ledger (`/growth/credit-ledger`) — keep everything that exists
- Filters (keep): date from/to, type (`Earned`, `Applied`, `Expired`, `Voided` + new `Clawback`, `Clawback repaid`), **Source** (new: `All`, `Referrals`, `Bonus offers`, `From Rhemito`), scheme (bonus schemes; referral rules and promo codes groups keep working through `historySources`), customer ID.
- KPI: **Cost incurred** per currency (keep), **Outstanding bonus** (available, per currency, new) with a per-source split, **Outstanding clawback debt** (per currency, new).
- When one customer is selected: a **Balance by source** strip (BS-84) above the table.
- Table (keep columns) + **Source** column (group + detail, e.g. `Referrals · Referrer`) + **Running balance** when one customer is selected (keep) + **Credit status** for EARNED rows.
- Blocked banner when the selected customer is blocked (keep).
- **Manual Credit Adjustment** modal: Type (`Grant credit` / `Remove credit`), Customer ID*, Currency*, Amount*, Reason code* (`Goodwill`, `Loyalty`, `Correction`, `Manual adjustment`), Bonus valid for (days, grant only, default 90), Link to scheme (optional), Notes* (10–500). Show the customer's available balance for the chosen currency. Toast `Credit of <amount> granted to <customer>.` / `<amount> removed from <customer>.`
- Export CSV (`bonus-ledger.csv`).

### 5.6 Blocked Customers (`/growth/bonus-blocks`) — keep
Status filter (`Blocked now`, `Approved (unblocked)`, `All`), columns Customer, Blocked on, Strikes, Why the bonus was blocked, Status, action `Approve` (reason 10–250, access token field only when admin credentials are configured). Toast `Bonus unblocked for <id>.` Add customer names from `bonus_customers` (today read from `customers`).

---

## 6. Flows

```
Rhemito transfer status ─► POST /api/bonus/transfer-events
    COMPLETED ─► evaluate loyalty + threshold ─► EARNED ─► settle debt ─► feed BONUS_EARNED
    CANCELLED/FAILED/REFUNDED/... ─► return applied bonus ─► reverse earned bonus ─► debt ─► strike ─► (block)
Rhemito money request paid / refunded ─► POST /api/bonus/events
Rhemito payment with bonus ─► POST /api/wallet/:id/apply  (on failure: /release)
Daily job ─► expire ─► expiring reminders
```

Transition (must not break): today Rhemito sends transfer events only to `POST /api/referral/transfer-events`, whose hook calls the bonus engine and the promo release. Keep that hook working (it now calls `bonus.handleTransferEvent`) until Rhemito sends `POST /api/bonus/transfer-events` in production (companion spec). Every step is idempotent, so both paths running is safe. Remove the hook only in a later PR.

---

## 7. Error format
Keep today's shapes so callers don't break:
- Engine refusals with `plain` (validation-style): `{ "error": "<message>" }`.
- Business refusals: `{ "error": "<CODE>", "message": "<message>" }`.
- New endpoints use `{ "error": "<CODE>", "message": "<message>", "fields"?: {...} }`.

---

## 8. Customer feed (for Rhemito notifications)
`GET /api/bonus/feed?since_id=&limit=` → `{ data: [{ id, customer_id, type, payload, created_at }], last_id }`, oldest first, max 500.

| Type | Payload | dedupe_key |
|---|---|---|
| BONUS_EARNED | `{ credit_id, credit_source, credit_source_detail, source_label, scheme_name, amount, currency, expires_on }` | `be:<credit_id>` |
| BONUS_USED | `{ amount, currency, transfer_id }` | `bu:<customer>:<transfer_id>` |
| BONUS_RETURNED | `{ amount, currency, transfer_id, expires_on }` | `br:<customer>:<transfer_id>` |
| BONUS_EXPIRING | `{ credit_id, remaining, currency, expires_on }` | `bx7:<credit_id>` |
| BONUS_EXPIRED | `{ credit_id, amount, currency, expired_on }` | `bx:<credit_id>` |
| BONUS_REVERSED | `{ event_id, voided, clawed_back, currency }` | `bv:<customer>:<event_id>` |
| BONUS_BLOCK_LIFTED | `{}` | `bl:<block_id>` |

`BONUS_USED`, `BONUS_RETURNED`, `BONUS_EXPIRING` and `BONUS_EXPIRED` cover the whole balance, every source (payloads add `by_source: [{ credit_source, amount }]`). `BONUS_EARNED` and `BONUS_REVERSED` are **not** emitted for `REFERRAL` credits — the referral module's own feed announces those with referral wording — so a customer never gets two notifications for one reward.

---

## 9. API contract

Service auth: header `X-Bonus-Service-Key` = env `BONUS_SERVICE_KEY` **when set**; otherwise open (prototype). 401 on mismatch.

### 9.1 Service API (Rhemito server)

| ID | Method & path | Request | Response |
|---|---|---|---|
| API-S1 | `POST /api/bonus/transfer-events` (new) | `{ transfer_id, customer_id, amount, currency, receive_currency, status, created_at }` | `200 { awards: [...], returned: <amount>, reversed: [...] }` |
| API-S2 | `POST /api/bonus/events` (existing) | `{ type: MONEY_REQUEST_PAID, customer_id, event_id, amount, currency }` or `{ type: MONEY_REQUEST_REFUNDED, event_id }` | `200 { awards: [...] }` (unchanged) |
| API-S3 | `GET /api/wallet/:customerId?currency=` (existing path, moved into this module) | — | Same shape as today: `{ customer_id, balances: [{ currency, available, earned, used, expired, outstanding_debt, used_transfer_count, referral_credit_count, other_credit_count, by_source: [{ credit_source, label, earned, used, expired, removed, available }] }], bonus_blocked, unused, credits, history, promo_redemptions }`. New fields only: `by_source` per balance, and `credit_source`, `credit_source_detail`, `source_label` on each `unused`, `credits` and `history` row (history negative rows take them from their source credit). Optional filter `?credit_source=REFERRAL|SCHEME|MANUAL` limits `unused`/`credits`/`history` (balances stay complete). `promo_redemptions` now comes from `historySources`/promo read function; if unavailable return `[]`. |
| API-S4 | `POST /api/wallet/:customerId/apply` (existing) | `{ amount, currency, transfer_id, send_amount }` | `{ applied, available }` (unchanged) |
| API-S5 | `POST /api/wallet/:customerId/release` (existing) | `{ transfer_id }` | `{ returned }` (unchanged) |
| API-S6 | `POST /api/bonus/customers` (new) | `{ id, created_at, country, send_currency, account_status, first_name, last_name, email }` | `{ success: true }` |
| API-S7 | `GET /api/bonus/feed` (new) | Section 8 | |
| API-S8 | `GET /api/bonus/offers?currency=` (new) | — | Live schemes customers can see: `[{ id, name, type, currency, summary, end_date }]` where `summary` is the plain sentence from 5.2 (e.g. `Complete 3 transfers within 30 days and get £10.00 bonus credit.`) |

Aliases (same handlers): `/api/bonus/wallet/:customerId`, `/apply`, `/release`.

### 9.2 Admin API (existing paths kept)

| ID | Method & path | Notes |
|---|---|---|
| API-A1 | `GET /api/bonus-schemes` | + `display_status`, `awards_count`, `issued_by_currency` |
| API-A2 | `POST /api/bonus-schemes` | `{ success, id }` (keep); 400 `{ error: <message>, fields }` |
| API-A3 | `PUT /api/bonus-schemes/:id` | full update; REFERRAL_CREDIT refused |
| API-A4 | `PATCH /api/bonus-schemes/:id/status` (new) | `{ status: ACTIVE | INACTIVE }` |
| API-A5 | `DELETE /api/bonus-schemes/:id` | archives (keep) |
| API-A6 | `GET /api/bonus-schemes/:id/audit` (new) | |
| API-A7 | `GET/POST/PUT/DELETE /api/user-segments[/:id]` (keep) + `GET /api/user-segments/:id/preview` (new) | |
| API-A8 | `GET /api/credits/:userId` (keep; `all` = everyone) | same response fields (`balance, cost_incurred, cost_by_currency, currency, history[]` with `running_balance`), filters `startDate, endDate, eventType, schemeId (incl. rr_<id>), customerId` + new `creditSource`, `referralId`; rows add `credit_source`, `credit_source_detail`, `credit_source_label` (the existing `source_type` field — `BONUS`/`PROMO` row kind — is unchanged; do not confuse the two); promo/referral rows via `historySources` |
| API-A9 | `POST /api/credits/manual` (keep) | BS-70…73; old bodies (no currency) still accepted |
| API-A10 | `POST /api/credits/award-bonus` (keep) | admin award for one scheme + customer |
| API-A11 | `GET /api/bonus-blocks`, `GET /api/bonus-blocks/:customerId`, `POST /api/bonus-blocks/:customerId/lift` (keep) | |
| API-A12 | `POST /api/bonus/run-jobs` (new) | `{ credits_expired, expiring_reminders }` |
| API-A13 | `GET /api/credits/all.csv` (new) | export |

All SQL uses bound parameters.

---

## 10. Non-functional
| # | Requirement |
|---|---|
| NFR-1 | Award, apply, release, reversal, manual adjustments: one DB transaction each; idempotent where stated. |
| NFR-2 | Wallet p95 < 300 ms with 200k ledger rows (indexes in Section 4). |
| NFR-3 | Seed schemes/ledger rows only when `NODE_ENV !== 'production'` (today's seeds unchanged otherwise). |
| NFR-4 | No PII in logs; ids only. |
| NFR-5 | Starts on an empty DB and on the current production DB. |

---

## 11. Must-not-break checklist (tick each in the PR)

| # | Consumer | Must still work |
|---|---|---|
| C1 | Rhemito `rewardsService.onTransferEvent` → `POST /api/referral/transfer-events` | loyalty/threshold awards still returned in `bonuses`; cancellations still reverse bonus and release applied bonus |
| C2 | Rhemito `onMoneyRequestPaid` / `onMoneyRequestRefunded` → `POST /api/bonus/events` | same request/response |
| C3 | Rhemito `/api/rewards/summary` → `GET /api/wallet/:id` | same response shape incl. `bonus_blocked`, `unused`, `credits`, `history`, `promo_redemptions`, `outstanding_debt` |
| C4 | Rhemito `/api/rewards/apply` → `POST /api/wallet/:id/apply` | same errors (`ALREADY_APPLIED`, `BALANCE_CHANGED`, send-amount check) |
| C5 | Referral module | `blocks.activeBlock` / `recordStrike` and `debt.clawback` / `settle` still callable via shims; referral credits stay in `credit_ledger` (one balance) and are issued/voided through `issueCredit`/`voidCredit` once the referral module is refactored; until then `referral.js` keeps writing them directly and the backfill tags them |
| C6 | Promo module | reads `user_segments` / `segmentMatches` |
| C7 | Admin pages | Bonus Scheme Manager, User Segments, Bonus Wallet / Ledger (incl. referral-rule and promo filters), Blocked Customers |
| C8 | Expiry | all credits still expire daily; the bonus module's job becomes the only credit-expiry job (BS-65) |
| C9 | Tests | `engines.test.js`, `test_tiered_calculation.js`, `test_cost_incurred.js`, `referral.test.js`, e2e `tiered_bonus`, `bonus_ledger`, `global_ledger`, `global`, `tests/verify_scheme_creation.js`, `tests/verify_global_ledger.js` |

---

## 12. Build phases
| Phase | Content | Exit check |
|---|---|---|
| 1 | Move code into `server/bonus/` with shims; own stats tables + backfill; wallet routes moved out of `referral.js` (same paths, same shapes); own expiry job; `historySources` port; API-S1, S6, S7, S8, A12; feed; fix manual VOIDED; transactions/locks | all existing tests green + new engine/wallet tests; C1–C9 |
| 2 | Admin UI: scheme form validation and new fields, derived status, toasts/dialogs, audit, awards columns, segment validation/preview/delete guard, ledger KPIs, manual adjustment upgrade, CSV | Playwright `bonus_admin.spec.js` green |
| 3 | Remove the referral-route hook coupling after Rhemito ships API-S1 (separate PR) | tests green |

---

## 13. Current code (reference)

| Concern | File |
|---|---|
| Eligibility, award, events, reversal, stats, segments | `server/bonusEngine.js` |
| Clawback debt | `server/bonusDebt.js` |
| Strikes and blocks + routes | `server/bonusBlocks.js` |
| Scheme CRUD, segments CRUD, credits history, manual credit, award-bonus, bonus events, seeds | `server/server.js` (search `bonus`, `user-segments`, `credits`) |
| Wallet routes (`/api/wallet/...`), apply, release, credit expiry job | `server/referral.js` (`applyBonus`, `releaseBonus`, `creditsWithRemaining`, `runJobs`, wallet routes) |
| Referral → bonus hook (transfer events) | `server/server.js` `registerReferralRoutes(..., { afterTransferEvent })` |
| Admin pages | `client/src/pages/Growth/BonusSchemeManager.jsx`, `UserCreditLedger.jsx`, `BonusBlocks.jsx` |
| Docs | `BONUS_SCHEME.md` (update to point to this spec) |

## 14. Environment variables
| Var | Default | Purpose |
|---|---|---|
| `BONUS_SERVICE_KEY` | unset (open) | Shared secret with Rhemito |
| `BONUS_CLAWBACK` | `on` | `off` = void unused only |
| `BONUS_BLOCK_STRIKES` | `3` | Strikes before a block |
| `BONUS_JOBS_INTERVAL_MIN` | `60` | Job timer; `0` disables |
| `ADMIN_USERS` | unset | Admin identities (existing) |

## 15. Open items (product owner)
| # | Item |
|---|---|
| O1 | Should a customer be told when a block is applied (today only a passive message)? |
| O2 | Should clawback debt ever be collected in cash? (today: no) |
| O3 | ~~One balance or two?~~ **Decided 08/10/2026: one balance, trackable by source** (D13, Section 3.11). |

## 16. Definition of done
- All BS-/AC-/API- items built and tested; full suite green.
- Must-not-break checklist ticked with evidence.
- `server/bonus/` has no `require` of referral or promo code.
- Backfill ran on a copy of the production DB with counts logged.
- `BONUS_SCHEME.md` updated to point to this spec.
