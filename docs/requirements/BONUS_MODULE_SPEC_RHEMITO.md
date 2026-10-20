# Bonus Scheme Module — Rhemito (Customer Front End + Rhemito Server Integration)

**Spec ID:** BONUS-RHEMITO-v1.1 (one customer balance)
**Date:** 08 October 2026
**Author:** Mohammad Mumtaz (Business Analyst)
**Target codebase:** Rhemito (`Rhemito-UI` repo — React 19 + TypeScript, Wouter, TanStack Query, Tailwind 4 + shadcn/ui; Express + TypeScript server)
**Companion spec:** `BONUS_MODULE_SPEC_MITO_ADMIN.md` (Mito Money Admin — schemes, eligibility, bonus wallet, blocks, admin pages). Rhemito holds **no schemes, no balances and no eligibility logic**. It reports activity, shows the wallet and lets the customer spend bonus credit. The contract is summarised in Section 4 and defined in full in the companion spec, Section 9.
**Related specs (independent modules):** `REFERRAL_MODULE_SPEC_RHEMITO.md`, `PROMO_MODULE_SPEC_RHEMITO.md`.
**Approved visual design:** `docs/design/referral-bonus-spec.md` (sections 3, 4, 6, 7 — bonus card, Bonus & Discounts, Send Money bonus step, notifications). Any new layout (Section 7.4 "Ways to earn") needs the UX approval step in `CLAUDE.md` first.

> **v1.1 change — one balance, trackable by source.** The customer has **one bonus credit balance** per currency. Referral rewards, bonus-offer rewards and goodwill credits all go into it and are spent together. Every credit shows **how it was earned** — **Referrals**, **Bonus offers** or **From Rhemito** — and the customer can see a breakdown and filter by it. This module owns that balance on Rhemito: the dashboard pill, the Bonus & Discounts balance views and the single "Use your bonus" step on Send Money. The referral module only shows referral progress and links here.

---

## 0. Instructions for the AI coding agent

1. **Nothing that works today may stop working.** Today a customer can: see bonus credit on the Dashboard pill and on Bonus & Discounts (Overview, History), use it on Send Money as Pay less / Send more, get it back if the transfer is cancelled, earn loyalty/threshold bonus on completed transfers and Request Money bonus on paid money requests, get notifications, and see the "not qualified" message when blocked. Section 11 is the must-not-break checklist; tick it in the PR.
2. Follow `CLAUDE.md`: branch `feature/bonus-module`, UX-first for visual changes, toast after every submission, close button on popups, working back buttons, unit + E2E tests before the PR, never push to `main`.
3. Read this document, then the files in Section 12. Build in the phase order of Section 10.
4. Requirement IDs (`B-`, `AC-`) appear in test names.
5. Customer-facing text here is final copy. Amounts, currencies and dates come from the API; never hard-code `£`, `GBP` or sample rows.
6. Ask one question at a time if unclear. Mito decides who earns what; Rhemito only reports and displays.

---

## 1. Purpose and scope

### 1.1 Customer outcomes
- Earn bonus credit automatically for loyalty, large transfers and paid money requests, and be told when it happens.
- See one available bonus credit balance, what was earned, used and expired, and what expires soon — and **how it was earned** (Referrals, Bonus offers, From Rhemito).
- See which bonus offers are live ("Ways to earn").
- Spend bonus credit on a transfer as **Pay less** or **Send more**; get it back if the transfer is cancelled, fails or is refunded.
- If blocked from earning, see a clear message telling them to contact support.

### 1.2 Independence boundary

| The Rhemito bonus module OWNS | It must NOT depend on |
|---|---|
| `server/bonus/` (Mito client, routes, hooks, feed poller, outbox) | `server/rewardsService.ts` / referral code |
| `client/src/features/bonus/` (components, hooks, helpers) | Promo code code |
| Rhemito endpoints `/api/bonus/*` | Any Mito database access (HTTP only) |
| Notification types `bonus_*` | |

Integration points (single calls into the module):

| # | Host location | Call |
|---|---|---|
| IP-1 | `server/sendMoneyRoutes.ts` status changes | `bonus.onTransferStatus(userId, tx, status)` |
| IP-2 | `server/sendMoneyRoutes.ts` pay | `bonus.applyForPayment(userId, tx, bonusCredit)` before marking paid; `bonus.releaseForPayment(...)` if payment fails after |
| IP-3 | `server/requestService.ts` money request paid / refunded | `bonus.onMoneyRequestPaid(...)`, `bonus.onMoneyRequestRefunded(...)` (moved from `rewardsService.ts`) |
| IP-4 | Sign-up verification, profile, KYC/account status changes | `bonus.syncCustomer(userId)` |
| IP-5 | `server/notificationService.ts` | register `bonus_*` types/templates; start feed poller |
| IP-6 | Dashboard | `<BonusCreditPill />`, `<BonusBlockedNotice />` |
| IP-7 | Send Money payment step | `<UseBonusCredit />`; summary line; pay payload |
| IP-8 | `client/src/pages/BonusAndDiscounts.tsx` | `<BonusOverview />`, `<BonusHistory />`, `<WaysToEarn />` |
| IP-9 | `server/routes.ts` | `bonus.registerRoutes(app)` |

### 1.3 Out of scope
Scheme setup and eligibility (Mito). Deciding referral rewards and referral progress screens (referral module; its rewards still land in this one balance). Promo codes (promo module). Cash-out.

---

## 2. Glossary and decisions

| Term | Meaning |
|---|---|
| Bonus credit | Value earned from Mito bonus schemes (and admin goodwill credits), per currency, usable on transfers in that currency until it expires. |
| Pay less | Reduces Total to pay by the credit used. |
| Send more | Adds the credit used to the amount converted, so the recipient gets more. |
| Blocked | Mito has stopped the customer earning bonus until support approves them. |

| # | Decision |
|---|---|
| D1 | Promo discount applies first (to the fee), then bonus credit (existing order: promo → credit). |
| D2 | Bonus credit used can never exceed the send amount; Total to pay never below 0. |
| D3 | **One balance** (decided 08/10/2026). Referral rewards, bonus-offer rewards and goodwill credits are one bonus credit balance per currency, spent together (soonest expiry first, whatever the source). Each credit is tagged with how it was earned so it can be tracked. |
| D4 | No minimum send amount to use bonus credit. |
| D5 | Blocked customers see only the fixed message (Section 7.2); never the reason. |

---

## 3. Architecture

```
Browser ──► Rhemito /api/bonus/*  ──HTTP──► Mito /api/wallet/*, /api/bonus/*
Send Money status change ─► outbox ─► POST /api/bonus/transfer-events
Money request paid/refunded ─► outbox ─► POST /api/bonus/events
Feed poller (60 s) ◄── GET /api/bonus/feed ─► Rhemito notifications
```

- **B-1** Mito client `server/bonus/client.ts`: `MITO_API_URL` (default `http://localhost:5050`), `MITO_API_TIMEOUT_MS` (default 4000), header `X-Bonus-Service-Key: ${BONUS_SERVICE_KEY}` when set. Own config read; no import from `rewardsService.ts`.
- **B-2** Network/timeout → `503 BONUS_UNAVAILABLE` `Bonus credit is unavailable right now. Please try again shortly.` Mito errors passed on as `{ error: { code, message } }` (Rhemito envelope). Read Mito messages as `message ?? error`.
- **B-3** Graceful degradation: Mito down → Dashboard, Bonus & Discounts and Send Money still load; bonus parts show their error state or hide; payments without bonus work; background calls go through the outbox.
- **B-4** User id always from the session (demo mode `user_123`, existing policy).

---

## 4. Mito calls used (summary)

| Use | Mito call |
|---|---|
| Wallet | `GET /api/wallet/:customerId?currency=` → `{ balances[{ currency, available, earned, used, expired, outstanding_debt, used_transfer_count, referral_credit_count, other_credit_count }], bonus_blocked, unused[], credits[], history[], promo_redemptions[] }` |
| Use credit | `POST /api/wallet/:customerId/apply` `{ amount, currency, transfer_id, send_amount }` → `{ applied, available }`; 409 `ALREADY_APPLIED` / `BALANCE_CHANGED`; 400 send-amount check |
| Return credit | `POST /api/wallet/:customerId/release` `{ transfer_id }` → `{ returned }` |
| Transfer events | `POST /api/bonus/transfer-events` `{ transfer_id, customer_id, amount, currency, receive_currency, status, created_at }` |
| Money request events | `POST /api/bonus/events` `{ type: "MONEY_REQUEST_PAID", customer_id, event_id, amount, currency }` / `{ type: "MONEY_REQUEST_REFUNDED", customer_id, event_id }` |
| Customer sync | `POST /api/bonus/customers` `{ id, created_at, country, send_currency, account_status, first_name, last_name, email }` |
| Live offers | `GET /api/bonus/offers?currency=` → `[{ id, name, type, currency, summary, end_date }]` |
| Feed | `GET /api/bonus/feed?since_id=` → `{ data[{ id, customer_id, type, payload }], last_id }` |

---

## 5. Rhemito server

### 5.1 Activity reporting (IP-1, IP-3)
- **B-10** Send Money status → event status: paid (instant; `completed` in the prototype) → `PAID` then `COMPLETED`; manual transfer later completed → `COMPLETED`; `cancelled` → `CANCELLED`; `failed` → `FAILED`; refunded (when added) → `REFUNDED`. Body: `transfer_id = reference`, `amount = send amount` (major units, before fee/discounts), `currency`, `receive_currency`, `created_at`.
- **B-11** Money request paid → `MONEY_REQUEST_PAID` with `customer_id = requester`, `event_id = request number`, `amount`, `currency`. Refunded → `MONEY_REQUEST_REFUNDED`. (Same bodies as today's `onMoneyRequestPaid` / `onMoneyRequestRefunded`.)
- **B-12** All sent through `bonus_outbox` (id, kind, payload, attempts, next_attempt_at, last_error): retry 1, 5, 15, 60 min, then hourly up to 24; ordered per transfer/request. Never blocks or fails the customer's request.
- **B-13** **Transition (must not break):** keep today's `rewardsService.onTransferEvent` call to `POST /api/referral/transfer-events` unchanged — Mito still runs bonus logic from that hook. Sending both is safe (Mito is idempotent). The rewards call is removed only in a later PR after Mito confirms API-S1 traffic in production.
- **B-14** Notifications for awards come from the feed (5.4). While the old rewards path also notifies from its response (`res.bonuses`), suppress duplicates with the shared dedupe key `be:<credit_id>`; when both exist, the feed wins.

### 5.2 Using credit at payment (IP-2)
- **B-20** Pay request (`POST /api/send-money/transactions/:id/pay`) accepts optional `bonusCredit: { mode: "pay_less" | "send_more", amount }`. The current separate call (`POST /api/rewards/apply` from the browser) keeps working until the client is switched (Phase 2), then is kept as a deprecated alias for one release.
- **B-21** Order: validate transaction → promo redeem (promo module) → bonus apply → mark paid. If a later step fails, release what was applied earlier (bonus `release`, promo release) and return the error.
- **B-22** Server re-checks: `0 < amount ≤ min(available, sendAmount)`, rounded to currency decimals. `available` is the whole balance (all sources).
- **B-23** Error mapping: `BALANCE_CHANGED` → 409 `BONUS_CHANGED` `Your bonus balance has changed. Please review your transfer.`; `ALREADY_APPLIED` → success (retry); send-amount error → 400 `Bonus cannot be more than the amount you send.`; 503 → 503 `Bonus credit can't be used right now. Choose "Don't use bonus" to continue, or try again shortly.` The transfer is not paid in these cases.
- **B-24** Store on the transaction `bonusCreditMinor`, `bonusCreditMode`; receipts and transaction details show `Bonus credit −<amount>` (Pay less) or `Bonus credit (to recipient) +<amount>` (Send more).
- **B-25** Cancel/fail/refund returns credit automatically through B-10 (Mito releases applied bonus on those statuses). No separate call needed.

### 5.3 Customer sync (IP-4)
**B-30** Post id, account `createdAt`, country, send currency (country→currency table: GB/UK GBP, US USD, NG NGN, CA CAD, GH GHS, KE KES, ZA ZAR, DE/FR EUR, IN INR, CN CNY, AE AED, AU AUD, JP JPY, else GBP), account status (`ACTIVE`/`SUSPENDED`/`CLOSED`), names, email — after email verification, on profile/KYC/status change. Through the outbox; debounced 60 s.

### 5.4 Notifications (IP-5)
- **B-40** Feed poller every 60 s (`BONUS_POLL_INTERVAL_MS`, off in tests); cursor persisted in `bonus_feed_cursor`; on first ever start set to current `last_id` (no replay).
- **B-41** Types and copy (category: transaction; Gift icon, teal; click opens `/bonus-discounts`):

| Feed type | Notification type | Title | Body |
|---|---|---|---|
| BONUS_EARNED (bonus offers, goodwill) | `bonus_earned` | `You've earned <amount> bonus credit` | Bonus offer: `Bonus earned: <scheme name>. <amount> bonus credit is ready to use on your next transfer by <DD/MM/YYYY>.` Goodwill: `Rhemito has added <amount> bonus credit to your account. Use it by <DD/MM/YYYY>.` |
| BONUS_USED | `bonus_used` | `Bonus used` | `<amount> bonus credit was used on transfer <id>.` |
| BONUS_RETURNED | `bonus_returned` | `Bonus returned` | `<amount> bonus credit is back in your account because transfer <id> was cancelled or refunded.` |
| BONUS_EXPIRING | `bonus_expiring` | `Bonus expiring soon` | `Your <amount> bonus credit expires on <DD/MM/YYYY>. Use it on your next transfer.` |
| BONUS_EXPIRED | `bonus_expired` | `Bonus expired` | `<amount> bonus credit expired on <DD/MM/YYYY>.` |
| BONUS_REVERSED | `bonus_reversed` | `Bonus removed` | `Your <amount> bonus has been removed because the transfer or request that earned it was cancelled or refunded.` |
| BONUS_BLOCK_LIFTED | `bonus_unblocked` | `You can earn bonus again` | `Your account can earn bonus credit again.` |

- **B-41a** Referral rewards earned/removed are announced by the referral module (Mito does not send BONUS_EARNED/BONUS_REVERSED for them). Used, returned, expiring and expired notifications cover the whole balance; when the payload's `by_source` has more than one source, add a second line `Includes <amount> from referrals.` only for the referral part when it is > 0.
- **B-42** Existing `reward_*` notifications stay readable (map them to the same display). The archive's Rewards filter includes `bonus_*`.

### 5.5 Browser endpoints

| ID | Method & path | Response `data` |
|---|---|---|
| B-50 | `GET /api/bonus/summary?currency=&source=` | `{ currency, currencies[], wallet: Wallet (incl. `by_source` and per-row `credit_source`, `credit_source_detail`, `credit_source_label`), blocked: boolean, offers: Offer[] }`; `source` (`REFERRAL`, `SCHEME`, `MANUAL`) filters the lists, never the balance totals (wallet straight from Mito; `currencies` = currencies with any balance, plus the customer's send currency) |
| B-51 | `GET /api/bonus/wallet?currency=` | `Wallet` (light call for Send Money) |
| B-52 | `POST /api/rewards/apply` | kept (deprecated after Phase 2) — same behaviour as today |
| B-53 | `GET /api/rewards/summary` | kept unchanged until Dashboard/Bonus & Discounts/Send Money use B-50/B-51 (Phase 2); the referral module may still use it |

---

## 6. Client architecture

```
client/src/features/bonus/
  api.ts            // useBonusSummary(currency), useBonusWallet(currency)
  components/       // BonusCreditPill, BonusBlockedNotice, UseBonusCredit, BonusOverview, BonusHistory, WaysToEarn
  lib/bonus.ts      // pure helpers (money, dates, statuses, maths) — unit tested
  lib/copy.ts       // all strings
  index.ts
```
Query keys `["bonus","summary",currency]`, `["bonus","wallet",currency]`; staleTime 30 s; invalidate after payment and when a `bonus_*` notification arrives. Never show sample data.

---

## 7. Screens

### 7.1 Dashboard — bonus credit pill (IP-6)
- Shown when available bonus credit in the customer's currency > 0: `You have <amount> bonus credit. Create a transaction to use it.` — "Create a transaction" links to `/send-money`. Amber suffix ` <amount> expires in <n> days.` when any credit expires within 14 days.
- Replaces today's text `You have earned £X Referral Bonus Credit` (wrong now that credits have several sources). One pill for the one balance; there is no separate referral pill.
- Hidden when 0, loading, or the service is down.

### 7.2 Blocked notice
When `blocked` is true, show on Dashboard, Bonus & Discounts (above the tiles) and in the Send Money bonus step: amber box, info icon, text `You're not qualified to get bonus. Please contact support for more information.` and link `Contact support` → help tickets. Held credit can still be used (blocking only stops earning).

### 7.3 Bonus & Discounts (`/bonus-discounts`) — Overview and History (IP-8)
Keep the current page and approved design; bonus module supplies these parts:
- **Currency selector** when the customer has credit in more than one currency.
- **Tiles**: Available (`Ready for your next transfer`; button `Send money` when > 0), Total earned (`From <n> bonuses`), Used (`Across <n> transfers`), Expired (`Use your bonus before it expires`). Per currency; never add currencies.
- **How you earned it** (new, under the tiles; from `by_source`): one row per source with anything earned — **Referrals**, **Bonus offers**, **From Rhemito** — each showing `Earned <earned> · <available> left`, a thin bar of its share of the total earned, and the link `View` which applies that source filter to the lists below. Rows add up to the tiles exactly. Hidden when only one source exists (then a single line `All earned from <source>.`).
- **Outstanding repayment** line when `outstanding_debt > 0`: `<amount> of future bonus will go towards bonus that was removed after a cancelled or refunded transfer.`
- **Unused bonus** list (soonest expiry first): source tag chip (`Referrals` / `Bonus offers` / `From Rhemito`) + description from `credit_source_label` (e.g. `Referral bonus – Sarah S.`, `Welcome bonus – invited by Olayinka A.`, `Loyalty bonus – Loyal Sender`, `Goodwill credit from Rhemito`; returned credit adds ` (returned after a cancelled transfer)`), `<remaining> left of <amount>` when partly used, `Earned DD/MM/YYYY · expires DD/MM/YYYY`, amber pill `Expires in <n> days` / `Expires tomorrow` / `Expires today` (≤ 14 days).
- **History** chips `All`, `Earned`, `Used`, `Expired` (+ `Promo codes` provided by the promo module), plus a **Source** select (`All sources`, `Referrals`, `Bonus offers`, `From Rhemito`). URL query `?source=REFERRAL|SCHEME|MANUAL` preselects it (the referral module links here with `?source=REFERRAL`). Rows: source tag chip, description, date, status pill (Unused teal, Partly used amber, Used slate, Expired slate, Reversed red, Returned teal), signed amount.
- Empty: `No bonuses yet. See ways to earn below.` Error: `We couldn't load your bonus credit. Please try again.` + `Try again`.

### 7.4 Ways to earn (new; UX approval required)
Section on Bonus & Discounts under Overview, from `offers`: one card per live scheme in the customer's currency — title (scheme name), sentence (`summary` from Mito, e.g. `Complete 3 transfers within 30 days and get £10.00 bonus credit.`), `Ends DD/MM/YYYY` when set. Hidden when there are no offers or when blocked.

### 7.5 Send Money — "Use your bonus" (IP-7) — keep the approved design
- Shown when available bonus credit in the transfer's **send currency** > 0 (today hard-coded to GBP — use the real currency).
- Header `Use your bonus` + `<available> available`.
- Options: **Pay less** `Save <credit> now` (+ `. <rest> will stay in your bonus credit.` when credit < available); **Send more** `Recipient gets <credit × rate> more`; **Don't use bonus** (default).
- `credit = min(available, sendAmount)`, where `available` is the whole balance (all sources).
- Under the header, a small line when the balance has more than one source: `Includes <referral part> from referrals` (and/or `<bonus-offer part> from bonus offers`, `<goodwill part> from Rhemito`).
- Expiry note when ≤ 14 days: `<amount> of this expires on <DD/MM/YYYY> – it's used first.`
- Remove the "Send £X or more to use your bonus" minimum message and the `minRedeem` prop (D4; the field no longer exists).
- Summary rows: `Bonus credit −<credit>` (Pay less) or `Bonus credit (to recipient) +<credit>` (Send more), after the promo row.
- Toasts on choice: `<credit> bonus applied` / `You'll pay <credit> less.`; `<credit> bonus added` / `Your recipient will get more.`
- The choice is sent with the pay request (B-20). On `BONUS_CHANGED`: error toast, choice resets to `Don't use bonus`, wallet refetched, stay on payment step.
- Blocked customers still see this card (they can spend held credit) with the blocked notice above it.

### 7.6 Accessibility
Radio group with labels; 56 px rows; tabs via Radix; status pills have text; contrast ≥ 4.5:1; works at 360 px; toasts announced by the existing live region.

---

## 8. Helpers (`lib/bonus.ts`, unit tested)
`formatMoney` (symbols £ $ € ₦ C$ A$ ¥ ¥ ₹ R `KSh ` GH₵ `AED `; JPY 0 dp; `−` for negatives), `formatUkDate`, `daysUntil`, `expiryLabel`, `expiringSoon(credits, 14)`, `balanceFor(wallet, currency)`, `creditToApply(available, sendAmount, currency)`, `totalToPay(send, fee, promo, bonusPayLess)` (never below 0), `amountConverted(send, sendMoreCredit)`, `sourceGroupLabel(credit_source)` (`REFERRAL`→`Referrals`, `SCHEME`→`Bonus offers`, `MANUAL`→`From Rhemito`), `breakdownRows(by_source)` (sums equal totals), `describeCredit(row)` (prefer `credit_source_label`; fall back to today's wording rules from notes), `CREDIT_STATUS_LABEL`.

---

## 9. Test plan
**Vitest:** all helpers (JPY, multi-currency, totals never negative, breakdown rows sum to totals, source labels), component states (pill hidden at 0; blocked notice; Use your bonus with/without expiry, "Includes … from referrals" line).

**Server (Vitest + supertest, Mito stubbed):** B-10 mapping and bodies; outbox retry/order; B-13 old rewards call still made; B-11 money request paid/refunded; B-20…B-24 pay with bonus (success, BALANCE_CHANGED → not paid, retry idempotent, failure after apply → release, order with promo); B-50 `source` filter keeps totals complete; feed poller cursor, no replay, dedupe with old path; B-50/B-51 shapes; Mito down → 503 and pages still render.

**Playwright (Mito mocked):**
1. Dashboard pill shows real amount and links to Send Money; hidden at 0.
2. Blocked customer: notice on Dashboard, Bonus & Discounts, Send Money.
3. Bonus & Discounts: tiles, **How you earned it** breakdown adds up to the tiles, source chips on rows, Source filter and `?source=REFERRAL` link from Refer & Earn, history chips, currency selector, Ways to earn.
4. Send Money Pay less and Send more: summary rows and totals; with a promo code applied too; balance made of referral + bonus-offer credit is used as one amount, soonest expiry first.
5. Balance changed at pay → error toast, choice reset, stays on step.
6. Cancel a paid manual-transfer transaction → bonus returned notification.
7. Existing specs still green: `tests/e2e/rewards.spec.js`, send-money specs, `client/src/__tests__/rewards.test.ts`, `send-money.test.ts`.

---

## 10. Build phases
| Phase | Content | Exit check |
|---|---|---|
| 1 | Server module: client, outbox, B-10 events (alongside the old path), money-request hooks moved (same bodies), customer sync, feed poller + `bonus_*` types, B-50/B-51 | all existing tests green; new server tests |
| 2 | Client module: pill, blocked notice, Overview/History, Use your bonus (real currency, no minimum), pay-request apply (B-20) with old `/api/rewards/apply` kept as alias | E2E 1–5 |
| 3 | Ways to earn (after UX approval); receipt lines (B-24) | E2E 3, 6 |
| 4 | Clean-up PR: remove the old rewards transfer-event bonus handling and `res.bonuses` notifications once Mito confirms API-S1 traffic | full suite |

---

## 11. Must-not-break checklist (tick each in the PR)

| # | Behaviour | Check |
|---|---|---|
| R1 | Loyalty/threshold bonus earned on a completed transfer, with notification | server test + E2E |
| R2 | Request Money bonus earned when a money request is paid; removed when refunded | server test |
| R3 | Bonus used on Send Money (Pay less / Send more) and totals correct | E2E 4 |
| R4 | Bonus returned when the transfer is cancelled | E2E 6 |
| R5 | Bonus & Discounts tiles, unused list, history, promo chip | E2E 3 |
| R6 | Dashboard pill and blocked notice | E2E 1–2 |
| R7 | Referral Refer & Earn card and referral notifications unaffected | `rewards.spec.js` |
| R8 | Promo code on Send Money unaffected and still applied before bonus | E2E 4 |
| R9 | Mito down: Dashboard, Bonus & Discounts and Send Money still work without bonus | E2E |

---

## 12. Current code to reuse / migrate

| Current | Becomes |
|---|---|
| `server/rewardsService.ts` `onMoneyRequestPaid`, `onMoneyRequestRefunded`, `res.bonuses` notifications, `applyBonus` | `server/bonus/hooks.ts`, `server/bonus/payment.ts`, feed notifier |
| `server/rewardsRoutes.ts` `/api/rewards/apply`, wallet part of `/api/rewards/summary` | `server/bonus/routes.ts` (B-50, B-51); old routes kept per B-52/B-53 |
| `server/requestService.ts` calls | point to `bonus.*` |
| `client/src/components/rewards/BonusRedemption.tsx` | `features/bonus/components/UseBonusCredit.tsx` (no `minRedeem`, real currency, other-credit cap) |
| `client/src/components/rewards/BonusBlockedNotice.tsx` | `features/bonus/components/BonusBlockedNotice.tsx` |
| `client/src/pages/Dashboard.tsx` bonus pill | `<BonusCreditPill />` |
| `client/src/pages/BonusAndDiscounts.tsx` overview/history | `<BonusOverview />`, `<BonusHistory />`, `<WaysToEarn />` |
| `client/src/lib/rewards.ts` wallet helpers | `features/bonus/lib/bonus.ts` (referral helpers stay with the referral module) |
| `shared/schema.ts` notification types | add `bonus_*` |
| `shared/sendMoney.ts` | add `bonusCreditMinor`, `bonusCreditMode` (optional) |

## 13. Environment variables
| Var | Default | Purpose |
|---|---|---|
| `MITO_API_URL` | `http://localhost:5050` | Mito base URL (live Render URL in production) |
| `MITO_API_TIMEOUT_MS` | `4000` | Timeout |
| `BONUS_SERVICE_KEY` | unset | Sent as `X-Bonus-Service-Key`; must match Mito |
| `BONUS_POLL_INTERVAL_MS` | `60000` | Feed poller |
| `BONUS_ENABLED` | `true` | Feature flag: when `false`, bonus UI hidden, pay ignores `bonusCredit`, hooks no-op (the old rewards path is untouched) |

## 14. Definition of done
- All B-/AC- items built and tested; unit, server and E2E suites green.
- Must-not-break checklist ticked with evidence.
- `server/bonus` and `features/bonus` import nothing from referral or promo code.
- No hard-coded bonus amounts, currencies or sample data.
- PR lists env vars for Render and new DB tables/fields (`bonus_outbox`, `bonus_feed_cursor`, transaction bonus fields).
