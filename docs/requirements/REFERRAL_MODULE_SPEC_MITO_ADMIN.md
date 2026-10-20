# Referral Module — Mito Money Admin (Backend + Admin UI)

**Spec ID:** REF-MITO-v1.1 (one customer balance)
**Date:** 08 October 2026
**Author:** Mohammad Mumtaz (Business Analyst)
**Target codebase:** Mito Money Admin (`PromoCode` repo — `server/` Express + SQLite, `client/` React + Vite)
**Companion spec:** `REFERRAL_MODULE_SPEC_RHEMITO.md` (customer side, Rhemito-UI repo). The API contract in Section 9 is shared by both specs and must not drift.
**Source requirements:** `Docs/Requirements/referral-and-bonus-user-stories.md` v2.1 (US-1.x, US-4.x, US-6.1). Where this spec and that document disagree, **this spec wins**.
**Wallet:** referral rewards are paid into the **single customer bonus wallet** owned by the Bonus module (`BONUS_MODULE_SPEC_MITO_ADMIN.md`, Section 3.11). Read that section before the wallet parts of this spec.

> **v1.1 change — one balance, trackable by source.** The customer has one bonus credit balance. Referral rewards, bonus-scheme rewards and goodwill credits all go into it, and every credit records how it was earned (source `REFERRAL`, detail `REFERRER` or `REFEREE`, with the referral id and rule id). The referral module no longer has its own ledger, redemption, return or credit-expiry logic; it issues and voids credits through the `rewardWallet` port. Everything else in this spec is unchanged.

---

## 0. Instructions for the AI coding agent

1. Read this whole document before writing code. Then read the reference implementation listed in Section 14 — it already does most of this, but it is entangled with the Bonus Scheme, Promo Code, Bonus Block and Bonus Debt features. Your job is to deliver referrals as an **independent module** exactly as specified here.
2. Work on a new branch (e.g. `feature/referral-module`). Do not push to `main`. Commit in small steps. Open a pull request when all tests pass.
3. Do not break other features (Promo Codes, Bonus Schemes, Rate Manager, Support portal, OBO). Run the whole test suite (`server/tests`, `client` Vitest, Playwright `tests/e2e`) before opening the PR.
4. Requirement IDs (`BR-`, `AC-`, `API-`) must appear in test names so coverage can be traced.
5. Every customer- or admin-facing string in this spec is final copy. Use it verbatim.
6. If something is ambiguous, stop and ask; do not invent business rules. Items already decided are in Section 2.3 — do not re-open them.
7. The app is a working prototype: there is no admin sign-in screen. Keep the existing "prototype mode" (Section 11) but build role checks so they switch on when credentials are configured.

---

## 1. Purpose and scope

### 1.1 Purpose
Mito Money admins configure referral programmes per corridor. An existing Rhemito customer (Referrer) shares a link/code. A new customer (Referee) registers with it and makes a qualifying transfer. The Referrer, the Referee or both receive **Referral Credit** that they can spend on a later transfer.

### 1.2 What "independent module" means
The Referral module is a self-contained unit inside the Mito Money Admin server and client:

| The module OWNS | The module does NOT depend on |
|---|---|
| Referral rules (config, status, audit) | Bonus Scheme Manager (`bonusEngine.js`, `bonus_schemes`) |
| Customer referral profiles and referral codes | Promo Codes (`promoEngine.js`, `promo_*` tables) |
| Referral link visits | Bonus scheme logic, `bonus_*` tables (it only calls the `rewardWallet` port) |
| Referrals and their lifecycle | Bonus Blocks (`bonusBlocks.js`) and Bonus Debt (`bonusDebt.js`) |
| Issuing referral credits into the customer wallet, and voiding them on reversal (through `rewardWallet`) | Any Rhemito code or database |
| Offer notifications feed and customer reward-events feed | |
| Admin pages: Settings, Tracking, Performance | |
| Service API used by Rhemito | |

Coupling to the rest of Mito Admin is allowed **only** through the ports in Section 1.3. `rewardWallet` is required (its default is the Bonus module's wallet); every other port is optional.

All module code lives in:
- `server/referral/` (new folder): `index.js` (route registration), `schema.js`, `rules.js`, `engine.js`, `jobs.js`, `reporting.js`, `notifications.js`, `ports.js`, `time.js`, `money.js`.
- `client/src/pages/Referral/` (move the Growth referral pages here) plus `client/src/pages/Referral/lib/`.
- Tests: `server/tests/referral/*.test.js`, `client/src/pages/Referral/**/*.test.js`, `tests/e2e/referral_*.spec.js`.

`server/server.js` may only contain: `const referral = require('./referral'); referral.register(app, db, ports);`

### 1.3 Integration ports (optional adapters)

Defined in `server/referral/ports.js`. Each has a default that keeps the module standalone.

| Port | Signature | Default | Purpose |
|---|---|---|---|
| `rewardWallet` (**required**) | `issueCredit({ customerId, amount, currency, validityDays, creditSource: 'REFERRAL', creditSourceDetail: 'REFERRER'|'REFEREE', referralId, ruleId, referenceId, notes, actor }) → { creditId }` (idempotent on `referenceId`); `voidCredit(creditId, { reason: 'REFERRAL_REVERSAL', notes, eventId, clawback: false }) → { voided, spent }`; `creditSummary({ referralIds }) → { issued, used, returned, expired, voided }` per currency | Bonus module's public wallet functions (in-process) | One customer balance. Referral credits are stored with their source so they can be tracked. |
| `eligibilityGuard` | `async isEarningBlocked(customerId) → { blocked: boolean, reason?: string }` | always `{ blocked: false }` | Lets the host plug in Bonus Blocks. When blocked, the referral becomes Not Eligible (BR-34). |
| `onRewardIssued` | `async (event) → void` | no-op | Lets the host mirror referral credits into another ledger or analytics. Errors are logged, never thrown. |
| `onSpentCreditReversed` | `async ({ customerId, currency, amount, referralId, transferId }) → void` | no-op | Called when a reversed referral's credit was already spent (BR-42). Host may record a debt. The module itself never claws back spent credit. |
| `adminIdentity` | `(req) → { name, role }` | prototype resolver (Section 11) | Who is acting, for audit and role checks. |

### 1.4 Out of scope
- Percentage-based or tiered rewards; paying rewards as cash.
- Leaderboards, social-network integrations beyond the native share sheet (customer side).
- Loyalty, threshold, money-request bonus schemes and promo codes (they stay in their own modules).
- Clawing back credit that was already spent (only a port is provided).

---

## 2. Glossary, statuses and fixed decisions

### 2.1 Glossary

| Term | Meaning |
|---|---|
| Referrer | Existing customer who shares their link or code. |
| Referee | New customer who registers using a link or code. |
| Corridor | Send currency → receive currency, written `GBP → NGN`. |
| Send-currency rule | A rule with no receive currency. It covers every destination for that send currency, except corridors that have their own rule. Displayed as `GBP → All`. |
| Floor | Minimum Transaction Amount. A transfer qualifies if its send amount is **≥** the Floor. The only minimum on a rule. |
| Qualification Window (QW) | Days after the Referee's registration within which the qualifying transfer must happen for the **Referrer** to be rewarded. Default 30. |
| Bonus Validity (BV) | (a) Days a Referral Credit can be used after it is issued; (b) days after registration within which the **Referee** can still earn their own bonus. Default 90. |
| Qualifying Transfer | The Referee's first transfer that is on the rule's corridor, has send amount ≥ Floor, and is created on or before the referral's overall deadline. |
| Referral Credit | Bonus credit earned from a referral. It sits in the customer's single bonus wallet (Bonus module) with source `REFERRAL`, and is spent, returned and expired with the rest of that balance. |
| UK day | A calendar date in `Europe/London`. All day-based rules use UK days. |

### 2.2 Statuses

**Rule status** (derived, never stored; evaluated in this order):

| Status | Condition | Admin label |
|---|---|---|
| `ARCHIVED` | `is_archived = 1` | Archived |
| `ENDED` | `end_date` < today (UK) | Ended |
| `INACTIVE` | `is_enabled = 0` | Inactive |
| `SCHEDULED` | `start_date` > today (UK) | Scheduled |
| `ACTIVE` | otherwise | Active |

A rule is **live** only when status is `ACTIVE`.

**Referral status** (stored):

| Code | Admin label | Customer label | Meaning |
|---|---|---|---|
| `REGISTERED` | Registered | Joined | Referee verified email; no qualifying transfer yet. |
| `PENDING` | Pending | In progress | Qualifying transfer paid but not completed, or completed and waiting for KYC. |
| `REWARDED` | Rewarded | Earned | Credits issued (to one or both parties). Terminal unless reversed. |
| `EXPIRED` | Expired | Expired | Deadline passed without qualifying. Terminal. |
| `NOT_ELIGIBLE` | Not eligible | Not eligible | Failed a check. Can become `REWARDED` only via admin approval. |
| `REVERSED` | Reversed | Reversed | Qualifying transfer refunded/recalled/charged back after reward. Terminal. |

Allowed transitions (anything else is a bug and must be rejected):

```
REGISTERED  → PENDING        (qualifying transfer PAID/COMPLETED)
REGISTERED  → EXPIRED        (daily job, deadline passed)
PENDING     → REGISTERED     (qualifying transfer CANCELLED/FAILED/REFUNDED before reward)
PENDING     → REWARDED       (transfer COMPLETED and all checks pass)
PENDING     → NOT_ELIGIBLE   (eligibility guard blocks a party)
PENDING     → EXPIRED        (KYC still missing 30 days after overall deadline)
REWARDED    → REVERSED       (qualifying transfer REFUNDED/RECALLED/CHARGEBACK)
NOT_ELIGIBLE→ REWARDED       (Growth Manager approval)
(created as) REGISTERED | NOT_ELIGIBLE
```

**Credit status**: derived by the Bonus module wallet (`UNUSED`, `PARTLY_USED`, `USED`, `EXPIRED`, `REVERSED`).

### 2.3 Fixed decisions (do not re-open)

| # | Decision |
|---|---|
| D1 | Floor is inclusive (≥). |
| D2 | Only the first qualifying transfer counts; a referral is rewarded once. Earlier transfers below the Floor or on another corridor do not stop a later one from qualifying. |
| D3 | A rule applies either to a send currency alone or to one corridor. A corridor rule beats the send-currency rule for that corridor. At most one non-archived rule per (send, receive) pair, and at most one send-currency rule per send currency. |
| D4 | Rule values are snapshotted onto the referral at registration (or at binding, BR-22). Later edits, deactivation or archiving never change an existing referral. |
| D5 | Credit is issued only when the qualifying transfer reaches `COMPLETED`. |
| D6 | Credit is always in the **send** currency of the rule. |
| D7 | The Referee earns their bonus on the first transfer ≥ Floor made before **registration + max(QW, BV)** days. The Referrer is rewarded only if that transfer is within **registration + QW** days. |
| D8 | Both parties must have passed KYC before their credit is issued. |
| D9 | On reversal, the unused part of each referral credit is voided (`voidCredit` with `clawback: false`). Spent referral credit is not recovered (the host may wire `onSpentCreditReversed` to Bonus Debt). |
| D10 | Rules are archived, never deleted. |
| D11 | Referral Settings is the only place referral rewards are configured. The Bonus Scheme Manager must not offer a referral bonus type. |
| D12 | There is no minimum send amount to **use** credit (spending is handled by the Bonus module wallet). The old "Minimum Send Amount to Redeem" field is removed. |
| D13 | Admin wording is "Bonus", never "Commission". |
| D14 | All dates shown as `DD/MM/YYYY` (UK). |

---

## 3. Business rules

### 3.1 Rules (configuration)
- **BR-1** Fields and validation are in Section 5.2. Server validation is authoritative; the client mirrors it.
- **BR-2** Uniqueness among non-archived rules: (a) one rule per `(base_currency, receive_currency)`; (b) one rule per `(base_currency, receive_currency IS NULL)`; (c) name unique case-insensitively.
- **BR-3** `reward_type` = `BOTH` | `REFERRER` | `REFEREE`. For `REFERRER`, `referee_reward` is stored as 0; for `REFEREE`, `referrer_reward` is stored as 0.
- **BR-4** A rule with `end_date` in the past cannot be enabled (error `RULE_ENDED`).
- **BR-5** Archived rules are read-only. Archiving also sets `is_enabled = 0`.
- **BR-6** Every create, field change, status change and archive writes one audit row per changed field with old value, new value, admin name, timestamp.
- **BR-7** Editing a rule that has `REGISTERED`/`PENDING` referrals is allowed; those referrals keep their snapshot (D4).

### 3.2 Rule selection
- **BR-10** `liveRulesForSend(send)` = all live rules with that `base_currency`.
- **BR-11** `liveRuleFor(send, receive)` = the live rule whose `receive_currency = receive`; otherwise the live send-currency rule; otherwise none.
- **BR-12** Offer for a customer: if `receive_currency` is given, return `liveRuleFor`; otherwise return every live rule for the send currency (one offer per rule).

### 3.3 Customers and codes
- **BR-15** The module keeps a mirror of each Rhemito customer in `referral_customers`, upserted by Rhemito (API-S1). Fields: id, first/last name, email, phone, country, send_currency, kyc_status (`PENDING`|`PASSED`|`FAILED`), account_status (`ACTIVE`|`SUSPENDED`|`CLOSED`), device_id (hashed), payment_fingerprints (array of hashes).
- **BR-16** Every customer gets exactly one referral code on first upsert. Format: first name uppercased, non-alphanumerics removed, max 8 chars (fallback `RHEMITO`; if fewer than 2 chars, append `RM`), followed by 4 random digits. Must be unique; retry up to 50 times, then fail with 500.
- **BR-17** Code lookup accepts any case and trims spaces; valid format is `^[A-Z0-9]{6,12}$` after uppercasing.
- **BR-18** Lookup results: `INVALID_FORMAT` (400), `NOT_FOUND` (404), `REFERRER_INACTIVE` when referrer `account_status ≠ ACTIVE` (404), else valid.
- **BR-19** A KYC change to `PASSED` on upsert re-evaluates that customer's `PENDING` referrals waiting for KYC (BR-31).

### 3.4 Registration (creating a referral)
Triggered by Rhemito when the Referee **verifies their email** (API-S6).

- **BR-20** Idempotent: if a referral already exists for the referee, return it unchanged (200, not 201).
- **BR-21** Rule choice: `send = referee.send_currency`; if `receive_currency` given → `liveRuleFor(send, receive)`; else if exactly one live rule for `send` → that rule; else if more than one → **deferred** (no rule yet); else none.
- **BR-22** Deferred binding: at the referee's first transfer that is `PAID`/`COMPLETED` with send currency = referral currency and a receive currency, find `liveRuleFor(send, receive)`. If found **and** amount ≥ its Floor **and** the transfer's UK date ≤ registration + max(QW, BV) of that rule, snapshot that rule onto the referral (deadlines recomputed from the registration day). Otherwise stay deferred.
- **BR-23** While deferred, `qualification_deadline` = the latest overall deadline across the live rules for the send currency, and `referrer_deadline` = the latest QW deadline; these drive expiry.
- **BR-24** Initial status checks, in order (first match wins):
  1. No rule and not deferred → `NOT_ELIGIBLE`, reason `No active referral programme for <corridor>`.
  2. Same identity as referrer → `NOT_ELIGIBLE`, reason `Self-referral: same <email|phone number|device|payment method>`. Match rules: email case-insensitive; phone digits only; device hash equal; any shared payment fingerprint.
  3. Referee's email or phone matches a `CLOSED` customer (other id) → `NOT_ELIGIBLE`, reason `Returning customer`.
  4. Otherwise `REGISTERED`.
- **BR-25** Referrer = Referee id → 400 `OWN_LINK`, message `You cannot use your own referral link.` (no referral created).
- **BR-26** Snapshot at creation: rule_id, currency, receive_currency, reward_type, referrer_reward, referee_reward, floor, QW, BV, `referrer_deadline = regDay + QW`, `qualification_deadline = regDay + (reward_type = REFERRER ? QW : max(QW, BV))`. Referral id format `REF-` + 8 uppercase hex.
- **BR-27** When created as `REGISTERED`, append a `FRIEND_JOINED` event for the referrer (Section 8.2). For `REFEREE` rules the payload's `reward` is 0 and Rhemito words the message without an amount. No event is sent for referrals created as `NOT_ELIGIBLE`.

### 3.5 Transfer events and awarding
Rhemito reports every status change of every transfer (API-S8). Statuses: `PAID`, `COMPLETED`, `CANCELLED`, `FAILED`, `REFUNDED`, `RECALLED`, `CHARGEBACK`.

- **BR-30** Store/refresh the transfer in `referral_transfers` (keep the first `created_at`; update status). Unknown customers are accepted.
- **BR-31** Qualifying check on `PAID` or `COMPLETED` while the referral is `REGISTERED` (after BR-22): `rule_id` set, transfer send currency = referral currency, (referral has no receive currency OR transfer receive currency = referral receive currency), amount ≥ floor, transfer UK date ≤ `qualification_deadline`. If true → `PENDING`, store `qualifying_transfer_id`, `qualifying_amount`, `pending_at`.
- **BR-32** On `COMPLETED` of the qualifying transfer while `PENDING` → run **award** (BR-33…BR-37).
- **BR-33** Entitlements: `referrerEntitled = reward_type ≠ REFEREE AND referrer_reward > 0`; `referrerLate = transfer UK date > referrer_deadline`; `rewardsReferrer = referrerEntitled AND NOT referrerLate`; `rewardsReferee = reward_type ≠ REFERRER AND referee_reward > 0`.
- **BR-34** KYC gate: if `rewardsReferee` and referee KYC ≠ PASSED → stay `PENDING`, reason `Awaiting referee KYC`, stop. If `rewardsReferrer` and referrer is ACTIVE and KYC ≠ PASSED → stay `PENDING`, reason `Awaiting referrer KYC`, stop.
- **BR-35** Eligibility guard (port): if any rewarded party is blocked → `NOT_ELIGIBLE`, reason `Bonus blocked for <referrer|referee> <id>: <port reason>`; stop. With the default port this never happens.
- **BR-36** Issue credits:
  - Referrer: skipped with note `Referrer account not active` if not ACTIVE; skipped with note `Referrer cap reached` if `max_referrals_per_referrer` is set and the referrer already has that many rewarded referrals (referrer_credited > 0) on this rule; else credit `referrer_reward`.
  - Referee: credit `referee_reward`.
  - If referrer was entitled but late, note `Referrer qualification window ended`.
  - Each credit is issued with `rewardWallet.issueCredit`: currency = referral currency, `validityDays` = BV, `creditSource` `REFERRAL`, `creditSourceDetail` `REFERRER`/`REFEREE`, `referralId`, `ruleId`, `referenceId` `<referralId>:referrer|referee`, notes `Referrer reward – referred <Masked name>` / `Referee reward – invited by <Masked name>`. The wallet stores reason `REFERRAL_REWARD`.
- **BR-37** Set `REWARDED`, `rewarded_at`, `referrer_credited`, `referee_credited`, `status_reason` = notes joined with `; ` or null. Emit `REWARD_EARNED` event per credited party. Call `onRewardIssued` per credit.
- **BR-38** Awarding must be idempotent and atomic: wrap BR-33…BR-37 in one DB transaction; a referral already `REWARDED` is never credited again.

### 3.6 Failure, reversal, expiry
- **BR-40** `CANCELLED`/`FAILED`/`REFUNDED`/`RECALLED`/`CHARGEBACK` of the qualifying transfer while `PENDING` → back to `REGISTERED`, clear qualifying fields (the referee may still qualify with another transfer before the deadline).
- **BR-41** `REFUNDED`/`RECALLED`/`CHARGEBACK` of the qualifying transfer while `REWARDED` → for each credit of the referral call `rewardWallet.voidCredit` (reason `REFERRAL_REVERSAL`, notes `Qualifying transfer reversed – unused referral credit removed`, `clawback: false`); set `REVERSED`, reason `Qualifying transfer refunded`, `reversed_at`. Emit `CREDIT_REVERSED` per affected customer with the voided amount.
- **BR-42** If part of a voided credit was already spent, call `onSpentCreditReversed` with the spent amount. The module does nothing else.
- **BR-43** Returning credit spent on a failed/reversed transfer is done by the Bonus module wallet (one balance), not here.
- **BR-44** Daily job: `REGISTERED` referrals with `qualification_deadline` < today → `EXPIRED`, reason `Qualification window ended on DD/MM/YYYY`.
- **BR-45** Daily job: `PENDING` referrals with reason starting `Awaiting` and `qualification_deadline + 30 days` < today → `EXPIRED`, reason `<previous reason> – not completed in time`.

### 3.7 Admin approval
- **BR-47** Only `NOT_ELIGIBLE` referrals can be approved; only role `GROWTH_MANAGER`; reason 10–250 chars (trimmed).
- **BR-48** Rule for approval: the snapshotted rule if `rule_id` set; else `liveRuleFor(currency, receive_currency)` if receive known; else the single live rule for the send currency; else 400 `NO_RULE`.
- **BR-49** Credits as BR-36 but ignoring KYC, cap, lateness and the eligibility guard; notes suffixed ` (approved by <admin name>: <reason>)`. Set `REWARDED`, `approved_by` (from identity, never from the body), `approval_reason`, reason `Approved by admin`. Emit `REWARD_EARNED`. Audit it.

### 3.8 Referral credits in the customer wallet
- **BR-50** The referral module never writes ledger rows itself. It only calls `rewardWallet.issueCredit` (BR-36, BR-49) and `rewardWallet.voidCredit` (BR-41).
- **BR-51** `issueCredit` and the referral status update run in one DB transaction (same SQLite connection); if issuing fails, the referral stays `PENDING` with reason `Reward could not be issued – will retry` and the daily job retries it.
- **BR-52** Spending, returning on cancellation, expiry, expiry reminders, credit status and the customer's balance are the Bonus module's job (`BONUS_MODULE_SPEC_MITO_ADMIN.md` 3.9–3.11), for every source including referrals.
- **BR-53** Reporting figures for referrals (issued, used, expired, unused) come from `rewardWallet.creditSummary`.

### 3.9 Offer notifications
- **BR-60** `LIVE` notification when a rule becomes live through create or activate, unless the admin un-ticked **Notify customers**. Not repeated for the same rule within 7 days.
- **BR-61** `IMPROVED` notification when a live rule stays live and the edit raises either reward or lowers the Floor (and Notify is ticked).
- **BR-62** `ENDING` notification once per rule, by the daily job, when the live rule's `end_date` = today + 3.
- **BR-63** Texts (amounts via BR-80 formatting; `<to>` = ` to NGN` for corridor rules, empty otherwise):

| Kind | Title | Message |
|---|---|---|
| LIVE, BOTH/REFERRER | `New offer: Refer & Earn` | `Invite friends and get <referrer_reward> each time they send <floor> or more<to>.` + (BOTH only) ` Your friend gets <referee_reward> too.` |
| LIVE, REFEREE | `New offer: Refer & Earn` | `Give friends <referee_reward> when they join with your link and send <floor> or more<to>.` |
| IMPROVED, BOTH/REFERRER | `Better offer: Refer & Earn` | `Better offer: you now get <referrer_reward> for every friend who sends <floor> or more<to>.` |
| IMPROVED, REFEREE | `Better offer: Refer & Earn` | `Better offer: your friends now get <referee_reward> when they send <floor> or more<to>.` |
| ENDING | `Refer & Earn ends soon` | `Refer & Earn ends on DD/MM/YYYY. Share your link now.` |

### 3.10 Offer sentence (shown on Rhemito)
- **BR-65** `offer.text` (Rhemito shows it verbatim):
  - REFERRER: `Invite friends with your link and get <r> bonus credit when they send <f> or more<to> within <QW> days of joining.`
  - REFEREE: `Give your friends <e> bonus credit when they join with your link and send <f> or more<to> within <QW> days.`
  - BOTH: `Invite friends with your link. You get <r> and your friend gets <e> in bonus credit when they send <f> or more<to> within <QW> days of joining.` + if BV > QW: ` Your friend can still earn theirs for up to <BV> days.`

### 3.11 Link visits
- **BR-70** A visit is recorded for a valid code with `visitor_id` (max 64 chars, default `anonymous`). Repeat visits by the same visitor for the same code within 24 hours count once. Store referrer id, send currency (the referrer's) and optional receive currency.

### 3.12 Money, time, rounding
- **BR-80** Supported currencies: GBP, USD, EUR, NGN, CAD, AUD, JPY, CNY, INR, ZAR, KES, GHS, AED. JPY has 0 decimals, all others 2. Round half-up to the currency's decimals. Store money as `INTEGER` minor units in new tables; the API uses decimal numbers in major units. Display symbols: £ $ € ₦ C$ A$ ¥ ¥ ₹ R KSh GH₵ `AED `; format with `en-GB` grouping.
- **BR-81** Timestamps stored as UTC ISO-8601. Day-based rules use UK days (`Europe/London`). Date-only fields stored `YYYY-MM-DD`.
- **BR-82** All "today" logic goes through one injectable clock (`time.js`) so tests can move time.

### 3.13 Masking
- **BR-85** Masked name = first name + space + first letter of last name + `.` (e.g. `Sarah S.`); missing first name → `Customer`. Customer-facing APIs never return a counterpart's full name, email, phone or id.

---

## 4. Data model

All tables are new and prefixed `referral_`. Create them in `schema.js` with `CREATE TABLE IF NOT EXISTS` and a `referral_schema_migrations` table for data migrations. Money columns end in `_minor` (INTEGER).

### 4.1 `referral_rules`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT NOT NULL | |
| is_enabled | INTEGER NOT NULL DEFAULT 1 | |
| is_archived | INTEGER NOT NULL DEFAULT 0 | |
| archived_at | TEXT | |
| reward_type | TEXT NOT NULL | BOTH / REFERRER / REFEREE |
| base_currency | TEXT NOT NULL | send currency |
| receive_currency | TEXT NULL | NULL = all destinations |
| referrer_reward_minor | INTEGER NOT NULL DEFAULT 0 | |
| referee_reward_minor | INTEGER NOT NULL DEFAULT 0 | |
| floor_minor | INTEGER NOT NULL | |
| qualification_window_days | INTEGER NOT NULL DEFAULT 30 | |
| bonus_validity_days | INTEGER NOT NULL DEFAULT 90 | |
| max_referrals_per_referrer | INTEGER NULL | NULL = unlimited |
| start_date / end_date | TEXT NULL | YYYY-MM-DD |
| notify_customers | INTEGER NOT NULL DEFAULT 1 | last choice of the form checkbox |
| created_at / updated_at | TEXT | |

Index: `(base_currency, receive_currency, is_archived)`. Uniqueness (BR-2) enforced in code (SQLite treats NULLs as distinct).

### 4.2 `referral_rule_audit`
id, rule_id, field (`created`, `archived`, or a column name), old_value, new_value, admin_name, admin_role, created_at.

### 4.3 `referral_customers`
id TEXT PK (Rhemito user id), first_name, last_name, email, phone, country, send_currency, kyc_status, account_status, device_id, payment_fingerprints (JSON array text, default `[]`), referral_code TEXT UNIQUE, created_at, updated_at. Indexes: lower(email), phone.

### 4.4 `referral_link_visits`
id, code, referrer_id, currency, receive_currency, visitor_id, created_at. Index `(code, visitor_id, created_at)`.

### 4.5 `referrals`
| Column | Notes |
|---|---|
| id TEXT PK | `REF-XXXXXXXX` |
| referrer_id, referee_id (UNIQUE), code | |
| rule_id NULL | NULL while deferred or no rule |
| currency, receive_currency | snapshot |
| reward_type, referrer_reward_minor, referee_reward_minor, floor_minor, qualification_window_days, bonus_validity_days | snapshot |
| referrer_deadline, qualification_deadline | YYYY-MM-DD |
| status, status_reason | |
| registered_at, pending_at, rewarded_at, reversed_at, updated_at | |
| qualifying_transfer_id, qualifying_amount_minor | |
| referrer_credited_minor, referee_credited_minor | DEFAULT 0 |
| approved_by, approval_reason | |

Indexes: referrer_id, status, rule_id, registered_at.

### 4.6 `referral_transfers`
transfer_id TEXT PK, customer_id, amount_minor, currency, receive_currency, status, created_at, updated_at.

### 4.7 (removed in v1.1)
No referral ledger table. Referral credits live in the Bonus module's `credit_ledger` with `credit_source = 'REFERRAL'`, `credit_source_detail`, `referral_id`, `referral_rule_id`.

### 4.8 `referral_offer_notifications`
id INTEGER PK (monotonic, used as cursor), rule_id, currency, receive_currency, kind (LIVE/IMPROVED/ENDING), title, message, created_at.

### 4.9 `referral_events` (customer reward-events feed)
id INTEGER PK (monotonic cursor), customer_id, type (`FRIEND_JOINED`, `REWARD_EARNED`, `CREDIT_REVERSED`), payload (JSON text), dedupe_key UNIQUE, created_at. See Section 8.2 for payloads.

---

## 5. Admin UI

Navigation: a **Referrals** group in the left navigation with four items. Routes:

| Item | Route |
|---|---|
| Referral Settings | `/referrals/settings` |
| Referral Tracking | `/referrals/tracking` |
| Referral Performance | `/referrals/performance` |

Keep redirects from the old routes `/growth/referral-settings`, `/growth/referral-tracking`, `/growth/referral-performance`. Reuse the existing look (`referral.css`, `Feedback.jsx` toasts and ConfirmDialog, `StatusPill`, `ColHead` tooltips). Every column header and KPI has an info tooltip (text given below). Every action shows a toast. Every dialog has Cancel and a close (×) button.

### 5.1 Referral Settings — layout
Two cards: **Create / Edit Referral Rule** (form) above **Existing Rules** (table).

### 5.2 Form fields

| # | Label | Key | Control | Required | Default | Validation → error message |
|---|---|---|---|---|---|---|
| 1 | Rule Name | name | text, max 50, placeholder `e.g. UK Standard Programme` | Yes | — | empty → `Enter a rule name.`; not `^[A-Za-z0-9 &-]{3,50}$` → `Rule name must be 3–50 characters and use letters, numbers, spaces, '-' or '&' only.`; duplicate → `A rule with this name already exists.` |
| 2 | Status | is_enabled | toggle Active/Inactive | Yes | Active | — |
| 3 | Who gets a bonus? | reward_type | select: `Both (Referrer & Referee)`, `Referrer only`, `Referee only` | Yes | Both | missing → `Select who gets a bonus.` |
| 4 | Send Currency | base_currency | select, 13 currencies shown `GBP (United Kingdom)` | Yes | GBP | `Select a send currency.` |
| 5 | Receive Currency | receive_currency | select: first option `All destinations (<SEND> only)` then every currency except the send currency | No | All destinations | equals send → `Receive currency must be different from the send currency.`; duplicate → `A referral rule for <SEND> → <RCV or All> already exists ('<name>'). Edit or archive it first.` Hint: corridor → `Applies only to GBP → NGN transfers.`; blank → `Applies to every GBP transfer, unless a specific corridor has its own rule.` |
| 6 | Referrer Bonus | referrer_reward | money, symbol prefix | if type ≠ Referee only (disabled otherwise, hint `Not used for Referee Only rules.`) | — | `Enter an amount greater than 0 with up to 2 decimal places.` (JPY: `Enter a whole amount greater than 0.`); max 1,000,000 |
| 7 | Referee (New User) Bonus | referee_reward | money | if type ≠ Referrer only (disabled otherwise, hint `Not used for Referrer Only rules.`) | — | same as 6 |
| 8 | Minimum Transaction Amount (Floor) | min_transaction_threshold | money | Yes | — | `Enter a minimum transaction amount greater than 0.`; max 10,000,000. Hint `A transfer equal to or above this amount qualifies.` |
| — | *Section label "Limits & timing"* | | | | | |
| 9 | Qualification Window (days) | qualification_window_days | integer | Yes | 30 | not 1–365 → `Enter a whole number of days from 1 to 365.` Hint `Days after joining for the friend's transfer to count for the referrer.` |
| 10 | Bonus Validity (days) | bonus_validity_days | integer | Yes | 90 | not 1–730 → `Enter a whole number of days from 1 to 730.` Hint `How long credit can be used. The friend can also earn their own bonus within this many days of joining.` |
| 11 | Max Rewarded Referrals per Referrer | max_referrals_per_referrer | integer, placeholder `Unlimited` | No | blank | not 1–10,000 → `Leave blank for unlimited, or enter a whole number from 1 to 10,000.` Hint `Leave blank for unlimited.` |
| 12 | Start Date | start_date | date | No | blank | new rule and past → `Start date cannot be in the past.` Hint `Blank = starts immediately.` |
| 13 | End Date | end_date | date | No | blank | ≤ start (or ≤ today on create when no start) → `End date must be after the start date.` Hint `Blank = no end date.` |
| 14 | (checkbox) Notify customers in the app when this offer goes live or improves | notify | checkbox | — | ticked | — |

Behaviour:
- **AC-5.2.1** Currency symbol prefix follows the send currency. Changing the send currency to the current receive currency clears the receive currency.
- **AC-5.2.2** Validate on blur and on submit; on submit, focus the first invalid field and show toast `Please correct the highlighted fields.`
- **AC-5.2.3** Before saving, run these confirmations in order (each can be cancelled):
  1. If any active bonus > Floor → title `Bonus higher than the minimum amount`, message `The bonus is higher than the minimum transaction amount. Customers could earn more than they send. Do you want to continue?`, button `Create anyway` / `Save anyway`.
  2. If editing and the rule has pending referrals (Registered + Pending) → title `Pending referrals`, message `<n> pending referral(s) will keep their original reward. Only new referrals will use these changes. Continue?`, button `Continue`.
- **AC-5.2.4** Buttons: `Create Rule` / `Save Changes` (+ `Cancel` when editing). While saving: `Creating...` / `Saving...`, button disabled.
- **AC-5.2.5** Success toasts: `Referral rule created.` / `Referral rule updated.` If the response has a notification: info toast `Customers sending <corridor> will be notified: "<title>".`
- **AC-5.2.6** Server errors: field errors under fields; 409 → message from server under the relevant field; other → toast `We couldn't save the rule. Please try again.`

### 5.3 Existing Rules table
Header right: checkbox **Show archived**. Columns:

| Column | Content | Tooltip |
|---|---|---|
| Rule | name; sub-line reward type label | `The rule name and who gets a bonus.` |
| Corridor | chip `GBP → NGN` or `GBP → All` + sub-line `Any destination` | `Send currency → receive currency the rule applies to.` |
| Status | toggle (hidden when archived) + status pill | `Active rules show the offer to customers. Scheduled rules start on their start date.` |
| Bonus | `Referrer £5.00` / `Referee £10.00` (— when not used) | `Credit each party gets when the referral qualifies.` |
| Floor | money | `Minimum send amount for the friend's transfer to qualify.` |
| Timing | `30d window · 90d valid` + sub-line `DD/MM/YYYY – DD/MM/YYYY`, `Now – No end` or `Always on` | `Qualification Window and Bonus Validity, then the start and end dates.` |
| Referrals | `<pending> pending · <total> total` (links to Tracking filtered by rule) | `Referrals registered under this rule.` |
| Actions | `Edit`, `Archive`, `History` (audit) | — |

States: loading `Loading referral rules...`; error `We couldn't load referral rules. Please refresh the page.` + `Retry`; empty `No referral rules yet. Create your first rule above.` Default sort: newest first.

- **AC-5.3.1 Activate**: dialog title `Activate '<name>'?`, message `Customers sending <corridor> will see the Refer & Earn offer.`, checkbox `Notify customers` (ticked), button `Activate`. Toast `Rule activated.`
- **AC-5.3.2 Deactivate**: title `Deactivate '<name>'?`, message `New customers will not be able to join through referral links. Pending referrals will still be rewarded.`, danger button `Deactivate`. Toast `Rule deactivated.`
- **AC-5.3.3 Ended rule**: activating shows server error toast `This rule has ended. Update the end date before activating it.`
- **AC-5.3.4 Archive**: title `Archive '<name>'?`, message `It will stop accepting new referrals. Pending referrals will still be rewarded. This cannot be undone.`, danger button `Archive`. Toast `Rule archived.` Archived rows show no actions except `History`.
- **AC-5.3.5 History**: side panel `Change history – <name>` listing audit rows newest first: date-time (DD/MM/YYYY HH:mm UK), admin, field label, `old → new`.
- **AC-5.3.6** The toggle updates optimistically and rolls back on error with toast `We couldn't update the rule status. Please try again.`

### 5.4 Referral Tracking
KPI tiles (respect filters): **Total referrals**, **Pending** (Registered + Pending), **Rewarded**, **Conversion rate** (Rewarded ÷ Total, 1 dp, sub-line `Rewarded ÷ Registered`, `—` when 0), **Total bonus issued** (one line per currency, never summed across currencies).

Filters: Search (`Name, customer ID, email or referral code`), Status (All + 6 statuses), Send currency, Receive currency, Rule, Registered from, Registered to. Filters are reflected in the URL query (`?status=&currency=&receive_currency=&rule_id=&from=&to=&q=`) so Performance can deep-link. Debounce search 300 ms. Page size 25 with pagination.

Columns and tooltips:

| Column | Content | Tooltip |
|---|---|---|
| Referral ID | id + code below | `Unique number of this referral, with the referral code the new customer joined with underneath.` |
| Referrer | name + id | `The existing customer who shared their link or code. Their reward is paid once their friend qualifies.` |
| Referee | name + id | `The new customer who joined using the referrer's link or code. Their welcome bonus is paid when they qualify.` |
| Rule | rule name + corridor (or `Set at first transfer` when deferred) | `The referral rule this referral falls under, with its corridor underneath. If a customer joins before choosing a destination, the rule is set at their first transfer.` |
| Registered | date | `The date the referee created their account through the referral link or code.` |
| Deadlines | `Referrer: DD/MM/YYYY` and `Referee: DD/MM/YYYY` (one line if equal) | `Last day to qualify. Referrer = end of the Qualification Window; Referee = end of the Bonus Validity period, counted from the registration date.` |
| Qualifying transfer | id + amount | `The first transfer by the referee that met the rule's conditions. Blank until the referee qualifies.` |
| Status | pill + reason underneath | `Registered, Pending, Rewarded, Expired, Not eligible or Reversed.` |
| Referrer bonus / Referee bonus | credited amount (link to the ledger filtered by referral) or grey `<amount> due` while Registered/Pending | `Credit issued. Grey "due" means it will be paid when the referral qualifies.` |
| Rewarded | date | `The date the bonus was paid.` |
| Action | `Approve reward` on Not eligible rows | `Approve reward pays a Not eligible referral, with a recorded reason.` |

- **AC-5.4.1 Approve**: dialog title `Approve referral reward`, message `This referral was marked not eligible: "<reason>". Approving will credit the bonus now.`, textarea **Reason*** (placeholder `Why should this referral be rewarded?`, counter `<n>/250 characters (minimum 10)`), and — only when admin credentials are configured — field **Access token**. Errors: `Enter a reason of 10–250 characters.`; 403 → `Only a Growth Manager can approve referral rewards.` Success toast `Reward approved for referral <id>.` and the row refreshes.
- **AC-5.4.2 Export CSV** downloads `referral-tracking.csv` with the current filters (max 10,000 rows). Columns: Referral ID, Referral Code, Referrer ID, Referrer, Referee ID, Referee, Rule, Send Currency, Receive Currency, Registered On, Referrer Deadline, Referee Deadline, Qualifying Transfer ID, Qualifying Amount, Status, Reason, Referrer Bonus, Referee Bonus, Rewarded On, Approved By, Approval Reason.
- States: loading skeleton rows; empty `No referrals match these filters.`; error `We couldn't load referrals. Please try again.` + `Retry`.

### 5.5 Referral Performance
Date range: `Last 7 days`, `Last 30 days` (default), `This month`, `Custom` (from/to). Figures are for referrals **registered** in the range (visits: created in the range). Checkbox **Show archived**. One row per rule:

| Column | Definition |
|---|---|
| Rule / Corridor / Status | name, corridor chip, status pill |
| Link visits | visits for the rule's send currency; a visit with a receive currency counts only for that corridor's rule and for the send-currency rule; a visit without one counts for every rule of that send currency |
| Registrations | referrals of the rule (all statuses) |
| Pending | Registered + Pending |
| Rewarded | Rewarded |
| Expired / Not eligible | Expired + Not eligible + Reversed |
| Conversion rate | Rewarded ÷ Registrations, 1 dp, `—` when 0 |
| Bonus issued | Σ EARNED REFERRAL_REWARD for the rule's referrals |
| Bonus used | Σ APPLIED − Σ RETURNED of those credits |
| Bonus expired | Σ EXPIRED + Σ VOIDED of those credits |
| Bonus unused | issued − used − expired |
| Referred volume | Σ send amount of the referees' COMPLETED transfers on the rule's corridor |

- **AC-5.5.1** Amounts in the rule's currency; never add currencies together.
- **AC-5.5.2** Clicking Registrations / Pending / Rewarded / Expired opens Tracking filtered by rule and status (`status_group=pending|closed` for grouped columns).
- **AC-5.5.3** Clicking a rule name opens a panel **Top referrers** (top 10 by rewarded, then registrations): customer ID, name, registrations, rewarded, bonus earned.
- **AC-5.5.4** Export CSV `referral-performance.csv` with the visible rows plus From and To columns.

### 5.6 Referral entries in the Bonus Wallet / Ledger
There is no separate referral ledger page. Referral credits appear in **Growth > Bonus Wallet / Ledger** (Bonus module) with Source `Referral` and their rule; the bonus amounts in Tracking link there filtered by referral id.

---

## 6. Engine flows (sequence)

```
Rhemito signup ──(email verified)──► API-S1 upsert customer ─► API-S6 create referral
                                                              └─► FRIEND_JOINED event (referrer)
Rhemito transfer status change ─────► API-S8 transfer event
     PAID/COMPLETED + REGISTERED ─► bind rule (if deferred) ─► qualify? ─► PENDING
     COMPLETED + PENDING ─────────► KYC gate ─► guard ─► credits ─► REWARDED ─► REWARD_EARNED events
     FAILED/CANCELLED + PENDING ──► REGISTERED
     REFUNDED... + REWARDED ──────► void unused ─► REVERSED ─► CREDIT_REVERSED events
     any failure/reversal ────────► return credit applied to that transfer
Daily job (00:15 UK) ─► expire referrals ─► expire credits ─► expiring reminders ─► ENDING offers
```

Jobs run: (a) on a timer every hour (idempotent; only acts when the UK date has changed since the last run or on first start), and (b) on demand via API-A13. Store `last_run_on` in `referral_schema_migrations` or a small `referral_job_state` table.

---

## 7. Validation of incoming service data

| Field | Rule | Error |
|---|---|---|
| customer id | 1–64 chars `[A-Za-z0-9_-]` | 400 `VALIDATION` `Customer id is required.` |
| currency, receive_currency | in supported list (uppercased) | 400 `VALIDATION` `Unsupported currency.` |
| amount | number > 0, decimals per currency | 400 `VALIDATION` `Enter a valid amount.` |
| transfer status | one of the 7 statuses | 400 `VALIDATION` `Unknown transfer status.` |
| created_at | ISO date-time | defaults to now |
| device_id | `^dv_[a-f0-9]{32}$` or absent | ignored if malformed |

---

## 8. Feeds consumed by Rhemito

### 8.1 Offer notifications
`GET /api/referral/offer-notifications?since_id=&currency=&receive_currency=` — rows with id > since_id, oldest first, max 100. `receive_currency` filter returns rows for that corridor plus send-currency rows.

### 8.2 Customer events
`GET /api/referral/events?since_id=&limit=` — rows with id > since_id, oldest first, default 100, max 500. Rhemito turns each into a notification. Payloads (amounts are numbers in major units, plus `currency`):

| Type | Recipient | Payload | dedupe_key |
|---|---|---|---|
| FRIEND_JOINED | referrer | `{ referral_id, friend_name (masked), reward, floor, currency, receive_currency, deadline }` | `fj:<referral_id>` |
| REWARD_EARNED | each credited party | `{ referral_id, role: "REFERRER"|"REFEREE", amount, currency, expires_on, friend_name }` | `re:<referral_id>:<role>` |
| CREDIT_REVERSED | customer | `{ referral_id, amount, currency }` | `cr:<referral_id>:<customer_id>` |

Credit used, returned, expiring and expired notifications come from the Bonus module feed for all sources (one balance). The Bonus module does **not** send `BONUS_EARNED` or `BONUS_REVERSED` for referral credits, so customers never get two notifications for one reward.

---

## 9. API contract

**Envelope.** Success: JSON body as documented. Error: HTTP status + `{ "error": "<CODE>", "message": "<customer-safe text>", "fields"?: { <field>: <message> }, ...extra }`. Codes used: `VALIDATION`, `NOT_FOUND`, `INVALID_FORMAT`, `REFERRER_INACTIVE`, `OWN_LINK`, `DUPLICATE_CORRIDOR`, `DUPLICATE_NAME`, `ARCHIVED`, `RULE_ENDED`, `INVALID_STATUS`, `NO_RULE`, `ALREADY_APPLIED`, `BALANCE_CHANGED`, `AMOUNT_TOO_HIGH`, `FORBIDDEN`, `UNAUTHORIZED`, `SERVER_ERROR`.

**Auth.** Service endpoints (`API-S*`) require header `X-Referral-Service-Key` equal to env `REFERRAL_SERVICE_KEY` **when that env var is set** (401 `UNAUTHORIZED` otherwise). Admin endpoints (`API-A*`) use the admin identity (Section 11).

### 9.1 Service API (called by the Rhemito server only)

| ID | Method & path | Request | Response |
|---|---|---|---|
| API-S1 | `POST /api/referral/customers` | `{ id, first_name, last_name, email, phone, country, send_currency, kyc_status, account_status, device_id?, payment_fingerprints? }` (omitted fields keep stored values) | `200 { data: { id, referral_code, send_currency, kyc_status, account_status } }` |
| API-S2 | `GET /api/referral/customers/:id` | — | `200 { data: {...same} }` / 404 |
| API-S3 | `GET /api/referral/offer?customer_id=&currency=&receive_currency=` | currency defaults to the customer's send currency | `200 { offer: Offer|null, offers: Offer[], reason?: "NO_ACTIVE_RULE"|"ACCOUNT_NOT_ACTIVE"|"MULTIPLE_CORRIDORS" }`. `offer` set only when exactly one. |
| API-S4 | `GET /api/referral/codes/:code?currency=&receive_currency=` | public lookup | `200 { valid: true, code, referrer_first_name, offer: Offer|null, offers: Offer[] }` / 400 INVALID_FORMAT / 404 NOT_FOUND / 404 REFERRER_INACTIVE (all with `valid:false`, `message`) |
| API-S5 | `POST /api/referral/visits` | `{ code, visitor_id, receive_currency? }` | `200 { success: true, counted: boolean }` / 404 |
| API-S6 | `POST /api/referral/referrals` | `{ code, referee: { id, send_currency, receive_currency?, first_name?, last_name?, email?, phone?, device_id? } }` | `201 { data: Referral }` new, `200 { data: Referral }` existing; 400 OWN_LINK / INVALID_FORMAT; 404 NOT_FOUND / REFERRER_INACTIVE |
| API-S7 | `GET /api/referral/referrals?referrer_id=` | — | `200 { data: MyReferral[], summary: { joined, earned_count, total_earned: { [currency]: number } } }` newest first |
| API-S8 | `POST /api/referral/transfer-events` | `{ transfer_id, customer_id, amount, currency, receive_currency, status, created_at }` | `200 { referral: ReferralPublic|null, credit_returned: number }` |
| API-S9…S11 | (removed in v1.1) | Wallet, apply and release are the Bonus module's `/api/wallet/:customerId`, `/apply`, `/release` (one balance). | |
| API-S12 | `GET /api/referral/offer-notifications` | Section 8.1 | `200 { data: OfferNotification[] }` |
| API-S13 | `GET /api/referral/events` | Section 8.2 | `200 { data: Event[], last_id }` |

**Types**

```ts
Offer = { rule_id, name, currency, receive_currency: string|null, corridor: string, reward_type,
          referrer_reward, referee_reward, floor, qualification_window_days, bonus_validity_days,
          max_referrals_per_referrer: number|null, end_date: string|null, text: string,
          // only when customer_id given:
          referral_code?, referral_link?, cap_reached?: boolean }
// referral_link = `${REFERRAL_LINK_BASE_URL}/ref/${code}` (env, default https://rhemito.com). Rhemito may rewrite it.
// cap_reached = reward_type != REFEREE && cap set && rewarded count on that rule >= cap

ReferralPublic = { id, referrer_id, referee_id, status, currency, receive_currency, reward_type,
                   referrer_reward, referee_reward, floor, qualification_deadline, referrer_deadline,
                   referrer_credited, referee_credited, bonus_validity_days }

MyReferral = { id, friend /* masked */, joined_on, status, status_label /* customer label */,
               currency, receive_currency, floor, qualification_deadline, referrer_deadline,
               reward /* credited, else promised referrer reward, 0 for REFEREE rules */, credited }

// Wallet: see BONUS_MODULE_SPEC_MITO_ADMIN.md API-S3 (includes the by_source breakdown)
```

### 9.2 Admin API (called by the Mito Admin client)

| ID | Method & path | Notes |
|---|---|---|
| API-A1 | `GET /api/referral-rules?include_archived=1` | rows + `status`, `pending_count`, `referral_count` |
| API-A2 | `POST /api/referral-rules` | body = form fields + `notify`; 201 `{ success, id, data, notification|null }`; 400 VALIDATION with `fields`; 409 DUPLICATE_* |
| API-A3 | `PUT /api/referral-rules/:id` | full update; 404, 400 ARCHIVED, 400 RULE_ENDED |
| API-A4 | `PATCH /api/referral-rules/:id/status` | `{ is_enabled, notify }` |
| API-A5 | `POST /api/referral-rules/:id/archive` | idempotent; `DELETE /api/referral-rules/:id` is an alias (never hard-deletes) |
| API-A6 | `GET /api/referral-rules/:id/audit` | newest first |
| API-A7 | `GET /api/referral/tracking?status=&status_group=&currency=&receive_currency=&rule_id=&from=&to=&q=&page=&page_size=` | `{ data, total, page, page_size, summary: { total, pending, rewarded, conversion_rate, bonus_issued: {cur: n} } }` |
| API-A8 | `GET /api/referral/tracking.csv` | same filters |
| API-A9 | `POST /api/referral/referrals/:id/approve` | `{ reason }`; GROWTH_MANAGER only (403 FORBIDDEN) |
| API-A10 | `GET /api/referral/performance?from=&to=&include_archived=1` (+ `.csv`) | rows per 5.5 |
| API-A11 | `GET /api/referral/performance/:ruleId/top-referrers` | top 10 |
| API-A12 | (removed in v1.1) | use the Bonus module ledger `GET /api/credits/all?creditSource=REFERRAL&referralId=` |
| API-A13 | `POST /api/referral/run-jobs` | returns `{ referrals_expired, rewards_retried, ending_notifications }`. Admin or service key. |

All SQL must use bound parameters (the reference implementation interpolates dates into SQL in `performance()` — do not copy that).

---

## 10. Changes outside the module (allowed, minimal)

1. `server/server.js`: replace `registerReferralRoutes(...)` with the new `register` call. Remove the `afterTransferEvent` hook coupling from the referral route. Expose that bonus-scheme logic (loyalty, threshold) as a new `POST /api/bonus/transfer-events` endpoint with the same request body; Rhemito's separate bonus service will call it (see companion spec, Section 13). Loyalty and threshold bonuses must keep working.
2. Bonus Scheme Manager: keep `REFERRAL_CREDIT` out of new schemes; existing ones read-only with label `Legacy – managed in Referral Settings` and hint `Referral rewards are managed in Referrals > Referral Settings.`
3. `GET /api/wallet/:customerId` (Bonus module) keeps including referral credits — it is the one balance — and adds the `by_source` breakdown.
4. Host wiring in `server.js`: `rewardWallet` → Bonus module wallet (required); `eligibilityGuard` → Bonus Blocks and strike recording on reversal (recommended, matches today); `onSpentCreditReversed` → Bonus Debt (optional, off by default).

### 10.1 Data migration (one-off, idempotent, name `referral_module_v1`)
- Copy `referral_rules` → new `referral_rules` (amounts to minor units; drop `min_redeem_amount`). Keep ids.
- Copy `customers` rows that have a `referral_code` → `referral_customers`.
- Copy `referrals`, `referral_link_visits`, `referral_transfers`, `referral_offer_notifications`, `referral_rule_audit`.
- Referral rows stay in `credit_ledger`. The Bonus module's backfill sets `credit_source = 'REFERRAL'` and `credit_source_detail` (from the `:referrer`/`:referee` reference suffix) on them (Bonus spec Section 4).
- Back up the SQLite file first (`database.backup-before-referral-module.sqlite`). Log counts.

---

## 11. Roles, identity and audit

- Roles: `ADMIN`, `GROWTH_MANAGER`. Reuse `server/auth.js`.
- Prototype mode (no `ADMIN_USERS` env): every caller is `Demo Growth Manager` (GROWTH_MANAGER). With `ADMIN_USERS` set, the Bearer token identifies the admin.
- When `ADMIN_USERS` is set, rule create/edit/status/archive require ADMIN or GROWTH_MANAGER; approval requires GROWTH_MANAGER.
- Admin name for audit, approvals and ledger `actor` always comes from the identity, never from the request body.

---

## 12. Non-functional requirements

| # | Requirement |
|---|---|
| NFR-1 | Every state-changing engine operation runs in a single DB transaction. |
| NFR-2 | API-S6 and S8 are idempotent for repeated identical calls; credit issuing is idempotent on `referenceId`. |
| NFR-3 | p95 < 300 ms for service endpoints with 50k referrals (add the listed indexes). |
| NFR-4 | No PII in logs (log ids only). Device and payment identifiers are stored only as hashes supplied by Rhemito. |
| NFR-5 | The module starts cleanly on an empty database and on the existing prototype database. |
| NFR-6 | Customer-facing `message` strings never reveal fraud-check details beyond what is listed here. |

---

## 13. Test plan (must pass before PR)

Server (Node test runner / existing style in `server/tests`), with the injectable clock:

| Test | Covers |
|---|---|
| Rule validation: each field's boundaries and messages; JPY whole amounts | BR-1, 5.2 |
| Uniqueness: corridor vs send-currency rule; duplicate name case-insensitive; archived rules ignored | BR-2 |
| Status derivation order; ended rule cannot be enabled; archived read-only | 2.2, BR-4, BR-5 |
| Audit rows per changed field with identity name | BR-6 |
| Rule selection: corridor beats send-currency rule; no rule; multiple corridors → deferred | BR-10…12, BR-21 |
| Code generation format, uniqueness, case-insensitive lookup, inactive referrer | BR-16…18 |
| Registration: idempotent; own link; self-referral by email / phone / device / payment; returning customer; snapshot values & deadlines | BR-20…26 |
| Deferred binding on first corridor transfer; not bound when below Floor | BR-22 |
| Floor inclusive; earlier small transfer then qualifying one | D1, D2 |
| Referrer late but referee within BV → only referee credited, note recorded | D7, BR-33 |
| KYC gate then KYC pass via upsert releases award | BR-34, BR-19 |
| Guard port blocking → Not eligible | BR-35 |
| Cap reached → referee credited, referrer not | BR-36 |
| Pending → failed → Registered → new transfer qualifies | BR-40 |
| Reversal voids unused only; port called with spent part; status Reversed | BR-41, BR-42 |
| Expiry jobs (referrals, KYC wait) | BR-44, BR-45 |
| Credits issued through `rewardWallet` with source REFERRAL / REFERRER or REFEREE, rule and referral ids; idempotent on retry | BR-36, BR-50, BR-51 |
| Reversal calls `voidCredit` with clawback off | BR-41 |
| Approval: role, reason length, NO_RULE, credits with note, identity name | BR-47…49 |
| Offer notifications LIVE (7-day no-repeat), IMPROVED, ENDING, opt-out | BR-60…63 |
| Offer text for all three reward types and BV > QW | BR-65 |
| Visits 24 h dedupe | BR-70 |
| Events feed cursor and dedupe | 8.2 |
| Reporting: tracking summary per currency; performance figures incl. visits rule; CSV escaping | 5.4, 5.5 |
| Service key enforced only when env set | 9 |
| Migration on a copy of `server/database.sqlite`: counts match; referral credits still in the wallet with source REFERRAL | 10.1 |

Client: Vitest for `referralValidation` (mirror of server rules) and helpers. Playwright `tests/e2e/referral_admin.spec.js`: create rule → appears; duplicate corridor error; edit with pending confirmation; activate with notify; archive; tracking filter + approve; performance drill-down; bonus amount links open the Bonus Wallet / Ledger filtered by referral; CSV downloads.

---

## 14. Reference implementation (prototype) to reuse

| Concern | File |
|---|---|
| Engine, rules, routes, wallet, jobs, reporting | `server/referral.js` |
| Roles | `server/auth.js` |
| Coupled parts to remove from the module | `server/bonusBlocks.js`, `server/bonusDebt.js`, `credit_ledger` usage, `promo_redemptions` join in the wallet route |
| Admin pages | `client/src/pages/Growth/ReferralSettings.jsx`, `ReferralTracking.jsx`, `ReferralPerformance.jsx`, `UserCreditLedger.jsx`, `referralUtils.js`, `referralValidation.js`, `StatusPill.jsx`, `ColHead.jsx`, `referral.css` |
| Existing tests | `server/tests/referral.test.js`, `client/src/pages/Growth/referralValidation.test.js`, `tests/e2e/referral_admin.spec.js` |
| Demo seed | `scripts/seed_referral_demo.js` (update to the new tables) |
| Full user stories | `Docs/Requirements/referral-and-bonus-user-stories.md` |

## 15. Environment variables

| Var | Default | Purpose |
|---|---|---|
| `REFERRAL_SERVICE_KEY` | unset (open) | Shared secret with Rhemito |
| `REFERRAL_LINK_BASE_URL` | `https://rhemito.com` | Base for `referral_link` |
| `REFERRAL_JOBS_INTERVAL_MIN` | `60` | Job timer; `0` disables the timer |
| `ADMIN_USERS` | unset (prototype mode) | Admin identities and roles |

## 16. Definition of done
- All BR/AC in this spec implemented and covered by named tests; full suite green.
- Referral works with every optional port at its default; its only dependency is the `rewardWallet` port.
- Migration runs once on the existing database without loss; counts logged.
- `Docs/Requirements/referral-and-bonus-user-stories.md` gets a "Version 3.0 – Independent Referral Module" change table pointing to this spec.
- PR description lists endpoints changed, migration steps and env vars to set on Render.
