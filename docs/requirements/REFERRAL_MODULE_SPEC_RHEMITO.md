# Referral Module — Rhemito (Customer Front End + Rhemito Server Integration)

**Spec ID:** REF-RHEMITO-v1.1 (one customer balance)
**Date:** 08 October 2026
**Author:** Mohammad Mumtaz (Business Analyst)
**Target codebase:** Rhemito (`Rhemito-UI` repo — React 19 + TypeScript, Wouter, TanStack Query, Tailwind 4 + shadcn/ui, Framer Motion; Express + TypeScript server)
**Companion spec:** `REFERRAL_MODULE_SPEC_MITO_ADMIN.md` (Mito Money Admin — rules, engine, wallet, admin pages). Rhemito holds **no referral rules, referrals or credit balances**. It only calls the Mito Money referral service. The service contract is summarised in Section 4 and defined in full in the companion spec, Section 9.
**Approved visual design:** `docs/design/referral-bonus-spec.md` (direction "Mix", approved 03/10/2026). Reuse its tokens and patterns. New layouts in this spec (the Refer & Earn page, Section 7.5) need the UX approval step in `CLAUDE.md` before coding.

> **v1.1 change — one balance, trackable by source.** Customers have **one bonus credit balance**. Referral rewards go into it alongside bonus-scheme rewards and goodwill credits, and each credit shows how it was earned. The balance, the dashboard pill, the "Use your bonus" step on Send Money and the Bonus & Discounts page belong to the Bonus module (`BONUS_MODULE_SPEC_RHEMITO.md`). This module no longer has its own credit pill, credit tab or "Use referral credit" step; it shows what the customer has earned from referrals and links to the balance. Customer wording is **bonus credit** everywhere.

---

## 0. Instructions for the AI coding agent

1. Follow `CLAUDE.md`: branch first (`feature/referral-module`), UX-first rule for new layouts, toast after every submission, close button on every non-mandatory popup, working back buttons, run unit + E2E tests before the PR, never push to `main`.
2. Read this whole document, then the files in Section 13 (current prototype). Most of the screens exist. Your job is to make referrals an **independent module**: its own folder and its own API namespace. It must not depend on promo codes or bonus-scheme code; referral rewards are paid into the one bonus credit balance owned by the Bonus module.
3. Requirement IDs (`R-`, `AC-`) must appear in test names.
4. All customer-facing text in this spec is final copy. Use it verbatim. Amounts and dates always come from the API; never hard-code `£5`, `£10`, `OLAYINKA2025` or sample rows.
5. If something is unclear, ask one question at a time (per `CLAUDE.md`). Do not invent business rules. The referral engine decides eligibility; Rhemito only displays results.

---

## 1. Purpose and scope

### 1.1 Customer outcomes
- **Referrer** sees the live offer, copies or shares a personal link, follows each friend's progress and receives bonus credit.
- **Referee** arrives through a link (or types a code), sees what they will get, signs up, and later receives bonus credit.
- Referral rewards land in the customer's single bonus credit balance, tagged **Referral**; spending it is handled by the Bonus module.
- Customers get in-app notifications about offers, friends joining, and referral rewards earned or removed (used / expiring / expired notifications come from the Bonus module for the whole balance).

### 1.2 Independence boundary

| The Rhemito referral module OWNS | It must NOT depend on |
|---|---|
| Client folder `client/src/features/referral/` (pages, components, hooks, lib) | Promo-code code (`promoService.ts`, promo UI) |
| Server folder `server/referral/` (service client, routes, hooks, notifier) | Bonus-scheme events (`/api/bonus/events`), loyalty/threshold awards |
| Rhemito API namespace `/api/referral/*` (browser → Rhemito server) | Spending, returning or expiring credit (Bonus module). It only **reads** the wallet's referral breakdown. |
| Referral notification types `referral_*` | Any Mito database access (HTTP only) |

The host app touches the module only at these **integration points** (each is one call into the module):

| # | Host location | Call |
|---|---|---|
| IP-1 | `client/src/App.tsx` router | register routes `/ref/:code`, `/refer-earn` |
| IP-2 | Sign-up form | render `<ReferralSignupBlock />`; submit `referralCode` with the sign-up body |
| IP-3 | `server/auth.ts` email verification | `referral.onCustomerVerified(userId, referralCode)` |
| IP-4 | Profile/KYC/account status changes | `referral.syncCustomer(userId)` |
| IP-5 | `server/sendMoneyRoutes.ts` status change / cancel / refund | `referral.onTransferStatus(...)` |
| IP-6 | Dashboard | render `<ReferralOfferBanner />`, `<ReferEarnCard />` |
| IP-7 | (removed in v1.1 — the Bonus module's "Use your bonus" step covers referral credit) | — |
| IP-8 | Notification service | register `referral_*` types and templates; start the poller |
| IP-9 | Sidebar / header navigation | link "Refer & Earn" → `/refer-earn` |
| IP-10 | Bonus & Discounts page | nothing to render; referral credits appear there through the Bonus module with source **Referral** |

Removing the module = removing those calls; nothing else in Rhemito may break.

### 1.3 Out of scope
Rule configuration and all eligibility logic (Mito Admin). Promo codes and other bonus schemes. Cash payouts. Leaderboards. Social integrations beyond the native share sheet.

---

## 2. Glossary

| Term | Meaning on Rhemito |
|---|---|
| Referral credit | Bonus credit earned from a referral. Part of the customer's one bonus credit balance (Bonus module), tagged source **Referral**. Customers see it as "bonus credit". |
| Offer | The live referral rule for the customer's send currency (and corridor), as returned by Mito, with its ready-made sentence `offer.text`. |
| Floor | Minimum send amount the friend must send for the referral to count. |
| Corridor | Send currency → receive currency, e.g. GBP → NGN. |
| Referral statuses (customer labels) | Joined, In progress, Earned, Expired, Not eligible, Reversed. |

---

## 3. Architecture

```
Browser (React)  ──fetch──►  Rhemito server  /api/referral/*   ──HTTP──►  Mito Money referral service  /api/referral/*
   ▲  X-Device-Id header          │  session → userId                        (rules, referrals, wallet, feeds)
   │                              │  hashes device id
   └── toasts / notifications ◄───┘  polls offer + events feeds → Rhemito notifications
```

- **R-1** The browser never calls Mito directly. All calls go through the Rhemito server, which knows the signed-in user from the session.
- **R-2** Server client `server/referral/client.ts`: base URL `MITO_API_URL` (default `http://localhost:5050`), timeout `MITO_API_TIMEOUT_MS` (default 4000), header `X-Referral-Service-Key: ${REFERRAL_SERVICE_KEY}` when set. Network/timeout errors become `503 REFERRAL_UNAVAILABLE` with message `Referral rewards are unavailable right now. Please try again shortly.` Mito error bodies `{ error, message }` are passed on as `{ error: { code, message } }` (Rhemito's envelope).
- **R-3** Graceful degradation: when Mito is down, sign-up, sign-in and Send Money must still work. Referral UI shows its error state; background calls (sync, events, verification) are logged and retried (Section 5.7), never thrown to the user.
- **R-4** Prototype mode: if there is no session and `demoModeEnabled`, use demo user `user_123` (existing policy). Otherwise 401 `UNAUTHENTICATED` `Please sign in to continue.`

---

## 4. Mito service calls used (summary of the shared contract)

| Use | Mito call |
|---|---|
| Sync customer | `POST /api/referral/customers` |
| Offer + link | `GET /api/referral/offer?customer_id=&currency=&receive_currency=` |
| Validate code | `GET /api/referral/codes/:code` |
| Count link visit | `POST /api/referral/visits` |
| Create referral | `POST /api/referral/referrals` |
| My referrals | `GET /api/referral/referrals?referrer_id=` |
| Transfer status | `POST /api/referral/transfer-events` |
| Referral part of the balance (read only) | `GET /api/wallet/:customerId?currency=` (Bonus module) → `by_source` entry `REFERRAL` |
| Offer feed | `GET /api/referral/offer-notifications?since_id=` |
| Events feed | `GET /api/referral/events?since_id=` |

Types (`Offer`, `MyReferral`, events) are copied into `shared/referral.ts` exactly as in the companion spec Section 9.1 and 8.2.

---

## 5. Rhemito server

### 5.1 Customer sync (IP-4)
- **R-10** `syncCustomer(userId)` sends: `id`, `first_name` (business name for business accounts), `last_name`, `email`, `phone` (`mobileCode + mobileNumber`), `country`, `send_currency` (from country, table below), `kyc_status` (`PASSED` when Rhemito KYC passed, `FAILED` when rejected, else `PENDING`), `account_status` (`SUSPENDED` when blocked, `CLOSED` when closed, else `ACTIVE`), `device_id` (hashed, omitted when unknown).
- **R-11** Call it: after email verification, after KYC status changes, after account status changes, after profile edits of name/email/phone/country, and before every Mito call that depends on customer data (offer, transfer event, apply). Debounce: skip if the same payload was sent in the last 60 s (in-memory cache).

Country → send currency: GB/UK GBP, US USD, NG NGN, CA CAD, GH GHS, KE KES, ZA ZAR, DE EUR, FR EUR, IN INR, CN CNY, AE AED, AU AUD, JP JPY; anything else GBP.

### 5.2 Device ID (self-referral check)
- **R-12** The browser creates a random ID once (`crypto.randomUUID()`), stores it in `localStorage` key `rhemito.deviceId`, and sends it as header `X-Device-Id` on every API request (`apiRequest` in `lib/queryClient.ts`).
- **R-13** Server middleware validates `^[A-Za-z0-9-]{16,64}$`, hashes it `dv_` + first 32 hex of SHA-256, and stores the latest hash per signed-in user (persist in the users table column `last_device_hash`, not only in memory). The raw ID never leaves the Rhemito server.
- **R-14** On sign-up, the hash of the device used for sign-up is stored on the new user before `onCustomerVerified` runs.

### 5.3 Sign-up and referral creation (IP-2, IP-3)
- **R-15** The sign-up endpoint accepts optional `referralCode`. Trim, uppercase; if present and not `^[A-Z0-9]{6,12}$` → 400 `VALIDATION_ERROR` `Referral codes are 6–12 letters and numbers.` (field error on `referralCode`).
- **R-16** Store the code with the pending user (DB column `pending_referral_code`, not an in-memory map) until email verification.
- **R-17** On email verification: `onCustomerVerified(userId, code)` → sync customer → if code, `POST /api/referral/referrals` with `{ code, referee: { id, send_currency, receive_currency? } }`. `receive_currency` is sent only if the user chose a destination during sign-up.
- **R-18** Failures here never block verification. If Mito returns 404/400 (code not found, inactive, own link), log it and clear the code. If Mito is unreachable, keep the code and retry (Section 5.7).
- **R-19** Rhemito does **not** create the friend-joined notification itself; it comes from the events feed (Section 5.6).

### 5.4 Transfers (IP-5)
Map Rhemito Send Money statuses to referral events:

| Rhemito event | Report to Mito |
|---|---|
| Payment received / `paid` | `PAID` |
| `completed` (payout done) | `COMPLETED` (send `PAID` first if it was never sent) |
| `cancelled` | `CANCELLED` |
| `failed` | `FAILED` |
| `refunded` | `REFUNDED` |
| recall / chargeback (when added) | `RECALLED` / `CHARGEBACK` |

- **R-20** Event body: `transfer_id` = transaction reference, `customer_id`, `amount` = send amount (major units, before fee, promo or credit), `currency` = send currency, `receive_currency`, `status`, `created_at` = transaction creation time (ISO).
- **R-21** Report every status change of every transfer of every customer (Mito decides relevance). Fire-and-forget with retry (5.7); never delays the customer's response.
- **R-22** Returning credit used on a failed/cancelled/refunded transfer is the Bonus module's job (one balance). The referral module only needs the event to un-pend or reverse referrals.

### 5.5 Using credit at payment
Removed in v1.1. Customers spend their whole bonus credit balance (including referral credit) through the Bonus module's "Use your bonus" step (`BONUS_MODULE_SPEC_RHEMITO.md` 5.2, 7.5).

### 5.6 Notifications (IP-8)
- **R-40** Poller (every 60 s, not in tests): reads the offer feed and the events feed from the last stored cursor. Cursors persist in DB table `referral_feed_cursors (feed TEXT PK, last_id INTEGER)`. On first ever start, set cursors to the current max id (do not replay history).
- **R-41** Offer feed → for every **active** user whose send currency = `currency`, dispatch `referral_offer`. Corridor offers go to the same users (Rhemito does not know where each customer will send); the message already names the destination. One per user per offer id (dedupe key `offer:<id>:<userId>`).
- **R-42** Events feed → dispatch to `customer_id`:

| Event | Type | Category | Title | Body |
|---|---|---|---|---|
| FRIEND_JOINED (reward > 0) | `referral_friend_joined` | transaction | `A friend joined with your link` | `<friend> joined Rhemito with your link. You'll earn <reward> when they send <floor> or more.` |
| FRIEND_JOINED (reward = 0) | same | transaction | same | `<friend> joined Rhemito with your link.` |
| REWARD_EARNED, REFERRER | `referral_credit_earned` | transaction | `You've earned <amount> bonus credit` | `<friend> completed their first transfer. <amount> bonus credit is ready to use on your next transfer by <DD/MM/YYYY>.` |
| REWARD_EARNED, REFEREE | `referral_credit_earned` | transaction | `You've earned <amount> bonus credit` | `Welcome bonus unlocked! <amount> bonus credit is ready to use on your next transfer by <DD/MM/YYYY>.` |
| CREDIT_REVERSED | `referral_credit_reversed` | transaction | `Referral bonus removed` | `Your <amount> referral bonus has been removed because the related transfer was reversed.` |
| Offer feed | `referral_offer` | marketing (shown in-app even if marketing push is off; push only if allowed) | `<title from Mito>` | `<message from Mito>` |

- **R-43** Icons: Gift (teal) for credit/friend types, Sparkles (primary) for offers. Clicking any `referral_*` notification opens `/refer-earn` (offer, friend → tab `invite`/`referrals`; earned/removed → `/bonus-discounts?source=REFERRAL`). Notification archive gets a **Referrals** category filter.
- **R-44** Migration: existing `reward_*` notification rows stay readable; map them to the new types for display.

### 5.7 Reliability
- **R-45** Outbox: background Mito calls (customer sync, referral creation, transfer events) are written to table `referral_outbox (id, kind, payload JSON, attempts, next_attempt_at, last_error, created_at)` and sent by a worker. Retry with backoff 1, 5, 15, 60 min, then hourly up to 24 attempts; keep order per customer. Transfer events for the same `transfer_id` are sent in the order created.
- **R-46** Calls on the request path (offer, wallet read, referrals, code check) are not queued; they fail fast with R-2 errors.

### 5.8 Rhemito API for the browser

Envelope: success `{ data: ... }`; error `{ error: { code, message } }`.

| ID | Method & path | Auth | Purpose / response `data` |
|---|---|---|---|
| RAPI-1 | `GET /api/referral/summary?currency=` | user | `{ customer: { referralCode, currency }, currency, offer: Offer|null, offers: Offer[], referralCredit: { currency, earned, available, used, expired } (the wallet's `by_source` REFERRAL entry; zeros when none), referrals: { data: MyReferral[], summary }, latestOffer: { id, kind, title, message, createdAt } | null }`. `referral_link` rewritten to `${PUBLIC_BASE_URL}/ref/<code>`. `latestOffer` = newest LIVE/IMPROVED offer for the currency created in the last 7 days, only when an offer exists. |
| RAPI-2 | `GET /api/referral/codes/:code` | public | `{ code, referrerFirstName, offer, offers, signedIn }`; errors pass through (`INVALID_FORMAT`, `NOT_FOUND`, `REFERRER_INACTIVE`) |
| RAPI-3 | `POST /api/referral/visits` `{ code, visitorId, receiveCurrency? }` | public, rate-limited 30/min/IP | `{ counted }` |

Credit use is the Bonus module's job. Remove the old `/api/rewards/*` routes after the client is migrated (keep them as 308 redirects for one release).

---

## 6. Client architecture

```
client/src/features/referral/
  api.ts               // React Query hooks: useReferralSummary, useCodeCheck
  lib/                 // pure helpers (money, dates, status text, credit maths, storage)  — unit tested
  components/          // ReferralOfferBanner, ReferEarnCard, ReferralProgressBar,
                       // ReferralSignupBlock, ReferralRewardsSummary, HowItWorksDialog
  pages/               // ReferralLanding (/ref/:code), ReferEarnPage (/refer-earn)
  index.ts             // public exports used by the host (integration points only)
```

- Query keys: `["referral","summary",currency]`. `staleTime` 30 s. Invalidate it after a payment completes and when a `referral_*` notification arrives.
- Never show sample data. Loading = skeleton; error = message + **Try again**.

---

## 7. Screens

Design tokens, sizes and motion follow `docs/design/referral-bonus-spec.md` (blue-600 primary actions, teal for earned, amber for expiry warnings, rounded-2xl cards, 44 px touch targets, 48 px inputs, `prefers-reduced-motion` respected). Wording uses "referral credit".

### 7.1 Referral link landing — `/ref/:code` (Referee)
Full-screen centred spinner with `Opening your invitation…` (`role="status"`), then:

| Case | Action | Toast |
|---|---|---|
| Code fails format | clear stored code; go to `/sign-in-sign-up?mode=signup` | `This referral link isn't valid` / `You can still sign up.` |
| 404 NOT_FOUND | same | same |
| 404 REFERRER_INACTIVE | same | `This referral link is no longer active` / `You can still sign up.` |
| Visitor already signed in | go to `/` | `Referral links are for new customers only` |
| Valid | save `{ code, referrerFirstName, offer }` (30 days, key `rhemito.referral`); record visit (RAPI-3, fire-and-forget, `visitorId` from `rhemito.visitorId`); go to sign-up | — |
| Network error / 503 | save `{ code }` only; go to sign-up | — |

- **AC-7.1.1** The code is case-insensitive (`olayinka1234` works). Query string `?to=NGN` is passed as `receiveCurrency` on the visit and stored with the referral.
- **AC-7.1.2** A stored code older than 30 days is ignored and deleted.

### 7.2 Sign-up block (Referee)
Rendered above the sign-up form fields.

**With a stored referral and an offer:**
- Bordered box: `**<Name> invited you** – get <referee_reward> bonus credit in 3 steps.` For REFERRER-only offers: `**<Name> invited you** to Rhemito.` (no amount, no strip).
- 3-segment strip: `Join` (filled primary) · `Send <floor>+ in <QW> days` · `Get <referee_reward>`.
- Code row: chip with check icon `<CODE>` + text button `Remove`. Remove clears the stored code and shows the manual field (collapsed state).

**Without a stored referral:** text button `Have a referral code?` expands an optional field:
- Label `Referral code (optional)`, max 12, uppercased on blur, validated on blur via RAPI-2.
- Messages: valid → `Code applied – invited by <Name>` (teal); bad format → `Referral codes are 6–12 letters and numbers.`; not found → `We couldn't find this referral code. Check it or leave the field blank.`; inactive → `This referral link is no longer active. You can still sign up.`; service down → `We couldn't check this code right now. You can still sign up and we'll apply it if it's valid.` (submission allowed).
- An invalid (not found / inactive / bad format) code blocks submit with the message focused; the user can clear it.

- **AC-7.2.1** The code is sent as `referralCode` with the sign-up request; a stored code is cleared after successful **email verification**, not at form submit.
- **AC-7.2.2** Business sign-up shows the same block.
- **AC-7.2.3** If the offer has no corridor match yet (several offers), show the highest `referee_reward` with `up to` : `**<Name> invited you** – get up to <amount> bonus credit.`

### 7.3 Dashboard — offer banner
- Shows when `latestOffer` exists and has not been dismissed. Eyebrow `NEW OFFER`, message, link `View offer` (scrolls to the Refer & Earn card and highlights it for 2 s), close button `aria-label="Dismiss offer"`. Dismissal stored per offer id: `rhemito.referralOfferDismissed.<id>`.

### 7.4 Dashboard — Refer & Earn card (Referrer)
Order: title `Refer & Earn` + text button `How it works` → offer sentence (`offer.text`, amounts bold) → label `Your referral link` + read-only input → buttons `Copy link` (primary) and `Share` (outline; hidden when `navigator.share` is missing) → divider → up to 3 latest referrals with progress bar → link `See all referrals (<n>)` → `/refer-earn?tab=referrals`.

| State | Display |
|---|---|
| No offer (`offer` null and `offers` empty) | card not rendered; layout reflows (no empty column) |
| Several corridor offers | sentence of the first offer + line `Different rewards apply depending on where your friend sends money.` + link `See all offers` → `/refer-earn` |
| Cap reached | `You've reached the maximum referral rewards for this programme. Thank you for spreading the word!`; link and buttons hidden |
| Account not active | card not rendered |
| Loading | skeleton filling the card |
| Error | centred `We couldn't load your referral details.` + `Try again` |
| No referrals | `No referrals yet. Share your link to start earning.` |

- **AC-7.4.1 Copy**: button text becomes `Copied` with a check for 2.5 s; toast `Referral link copied!` / `Share it with friends to earn bonus credit.` On failure: toast `We couldn't copy the link` / `Please copy it manually.` and select the input text.
- **AC-7.4.2 Share**: `navigator.share({ title: "Join me on Rhemito", text: "<offer.text>", url: <link> })`. User cancel = no toast; other errors = copy fallback.
- **AC-7.4.3 Progress bar** (3 segments: Joined → Sent <floor>+ → Earned): REWARDED 3 teal; PENDING 2 primary; REGISTERED 1 primary; EXPIRED/NOT_ELIGIBLE/REVERSED 3 slate-300. `role="img"`, `aria-label="<friend>: <status label>"`. Right-hand status text:

| Status | Text |
|---|---|
| REWARDED | `<credited> earned` (or `Earned` when 0) |
| PENDING | `Transfer in progress` |
| REGISTERED | `Joined · <n> day(s) left` (days to `referrer_deadline`), or `Joined` |
| EXPIRED | `Didn't send <floor> in time` |
| NOT_ELIGIBLE | `Not eligible` |
| REVERSED | `Transfer refunded` |

- **AC-7.4.4 How it works** dialog (close button, Esc): steps `1. Share your link with friends.` `2. Your friend joins and sends <floor> or more within <QW> days.` `3. You get <referrer_reward>, your friend gets <referee_reward>.` (omit the part that is 0) and terms: `Your reward is added to your bonus credit and can be used on transfers in <currency> for <BV> days after it is issued.` `Your friend must be new to Rhemito. Both of you need to complete identity checks.` `Rewards are removed if the qualifying transfer is refunded.` + (if cap) `You can earn up to <cap> rewards in this programme.` + (if end date) `Offer ends on <DD/MM/YYYY>.`

### 7.5 Refer & Earn page — `/refer-earn` (new; needs UX approval)
Header: title `Refer & Earn`, subtitle `Invite friends and track their progress.`, currency selector when the customer has credit in more than one currency. Back button to the previous page. Tabs (`?tab=` selects): **Invite**, **My referrals**, **Your rewards**.

**Invite**
- All live offers for the customer's send currency, one card per corridor (`GBP → NGN`, `GBP → All destinations`), each with its sentence and Floor/QW/BV facts.
- Link box with Copy / Share (as 7.4) and the How-it-works steps inline.

**My referrals**
- Summary line `Joined: <n> · Earned: <n> · Total earned: <amounts per currency>`.
- One card per referral (newest first): masked name, joined date, status pill, help line:

| Status | Help line |
|---|---|
| REGISTERED | `Waiting for their first transfer of <floor> or more · <n> day(s) left` |
| PENDING | `Transfer in progress – you get <reward> when it completes` (REFEREE rules: `Transfer in progress`) |
| REWARDED | `<credited> added to your bonus credit` / `Your friend received their bonus` when 0 |
| EXPIRED | `They didn't send <floor> or more in time` |
| NOT_ELIGIBLE | `This referral didn't meet the programme terms` |
| REVERSED | `The qualifying transfer was refunded` |

- PENDING cards show a vertical 3-step timeline (done = teal circle with check, current = primary ring, upcoming = slate ring).
- Empty: `No referrals yet. Share your link to start earning.` + button `Copy referral link`.

**Your rewards** (`<ReferralRewardsSummary />`, read-only; from `referralCredit`)
- Line: `You've earned <earned> from referrals. <available> of it is still available to use.` (per selected currency; never add currencies).
- If `available` > 0: button `Use it on a transfer` → `/send-money`.
- Link `See all your bonus credit` → `/bonus-discounts?source=REFERRAL`.
- Empty: `No referral rewards yet. Share your link to start earning.`
- Error: `We couldn't load your referral rewards. Please try again.` + `Try again`.

### 7.6 / 7.7 (removed in v1.1)
The dashboard credit pill and the Send Money credit step are the Bonus module's (`BONUS_MODULE_SPEC_RHEMITO.md` 7.1, 7.5) and cover referral credit.

### 7.8 Accessibility
Radix Tabs; real `<button>`s with labels; progress bars `role="img"` with labels; toasts via the existing live region; contrast ≥ 4.5:1; full keyboard flow on sign-up block, card and page; focus returns to the trigger when dialogs close.

---

## 8. Formatting helpers (`features/referral/lib`)
- `formatMoney(amount, currency)` — symbols £ $ € ₦ C$ A$ ¥ ¥ ₹ R `KSh ` GH₵ `AED `, `en-GB` grouping, 0 dp JPY else 2, minus sign `−` for negatives.
- `formatUkDate(value)` — `YYYY-MM-DD` or ISO → `DD/MM/YYYY` in Europe/London.
- `daysUntil(ymd)`, `expiryLabel(ymd)`, `expiringSoon(credits, 14)`.
- `referralStage(status)`, `referralStatusText(r)`, `referralHelpText(r)`.
- `saveReferral / loadReferral / clearReferral` (30-day TTL), `visitorId()`, `deviceId()` — all `localStorage` access wrapped in try/catch.

---

## 9. Copy deck (all strings in one place)
Keep every string from Sections 5 and 7 in `features/referral/lib/copy.ts` so wording can be reviewed in one file. Tests import from it.

---

## 10. Non-functional requirements

| # | Requirement |
|---|---|
| NFR-1 | Dashboard: referral card must not delay the rest of the dashboard (independent query, own skeleton). |
| NFR-2 | RAPI-1 p95 < 800 ms (parallel Mito calls). |
| NFR-3 | Mobile first: all screens work at 360 px width; no horizontal scroll. |
| NFR-4 | No PII from other customers in the client (names masked by Mito). |
| NFR-5 | No referral logic in the client beyond display and the credit maths in Section 8 (server re-checks). |
| NFR-6 | Feature flag `REFERRAL_ENABLED` (server env, default `true`). When `false`, all integration points render nothing and server hooks no-op. |

---

## 11. Test plan

**Vitest (unit)** — every helper in Section 8, including JPY rounding, negative amounts, expiry labels at 0/1/14 days, stage/status text for all six statuses, referral storage TTL.

**Server (Vitest + supertest, Mito mocked with `msw` or a stub server):**
- R-2 error mapping (timeout → 503, Mito 404 passthrough).
- R-15…R-18 sign-up with valid/invalid/unknown code; verification creates the referral; Mito down → outbox retry.
- R-20…R-22 status mapping and event body for each status; order preserved.
- R-40…R-42 poller cursors persist; first start does not replay; one notification per event; correct templates.
- NFR-6 flag off.

**Playwright E2E (Mito responses mocked so Mito Admin need not run):**
1. `/ref/OLAYINKA1234` → sign-up shows invited box → sign up → verify → referral call made with the code.
2. Invalid and inactive links show the right toast and still reach sign-up.
3. Manual code: bad format, not found, valid.
4. Dashboard card: copy, share fallback, cap reached, no offer (card absent, layout reflows), error + Try again.
5. Refer & Earn page tabs via `?tab=`, empty states, multi-currency selector; Your rewards links to Bonus & Discounts filtered by Referral.
6. Notifications: each referral type renders and opens the right place; no duplicate "earned" notification from the Bonus module for a referral reward.

---

## 12. Environment variables

| Var | Default | Purpose |
|---|---|---|
| `MITO_API_URL` | `http://localhost:5050` | Mito Money Admin base URL (set to the live Render URL in production) |
| `MITO_API_TIMEOUT_MS` | `4000` | Per-call timeout |
| `REFERRAL_SERVICE_KEY` | unset | Sent as `X-Referral-Service-Key`; must match Mito |
| `PUBLIC_BASE_URL` | existing setting | Base for referral links |
| `REFERRAL_ENABLED` | `true` | Feature flag |
| `REFERRAL_POLL_INTERVAL_MS` | `60000` | Feed poller interval |

---

## 13. Current prototype to reuse / migrate

| Current file | Becomes |
|---|---|
| `server/rewardsService.ts` | `server/referral/client.ts`, `hooks.ts`, `notifier.ts` — remove `onMoneyRequestPaid`/`onMoneyRequestRefunded` and the `res.bonuses` loyalty handling. Move them, and `applyBonus`, to the Bonus module (`BONUS_MODULE_SPEC_RHEMITO.md`) so loyalty, threshold and request-money bonuses and credit spending keep working |
| `server/rewardsRoutes.ts` | `server/referral/routes.ts` (`/api/referral/*`); old `/api/rewards/*` → 308 redirects for one release |
| `server/deviceId.ts` | keep; persist latest hash on the user (R-13) |
| `server/auth.ts` (`pendingReferralCodes` map) | DB column `pending_referral_code` (R-16) |
| `server/sendMoneyRoutes.ts` | add FAILED/REFUNDED reporting (credit spending moves to the Bonus module) |
| `client/src/lib/rewards.ts` | `features/referral/lib/*` (drop `min_redeem_amount`, `promo_redemptions`, `BONUS_BLOCKED_MESSAGE`) |
| `client/src/components/rewards/*` | `features/referral/components/*` (`BonusRedemption` and `BonusBlockedNotice` go to the Bonus module; `OfferBanner` → `ReferralOfferBanner`, `ReferralSignup` → `ReferralSignupBlock`, `ReferralProgress` → `ReferralProgressBar`) |
| `client/src/pages/ReferralLanding.tsx` | `features/referral/pages/ReferralLanding.tsx` |
| `client/src/pages/BonusAndDiscounts.tsx` | owned by the Bonus module; the "My referrals" tab moves to `/refer-earn?tab=referrals` (keep a link from Bonus & Discounts) |
| `shared/schema.ts` `reward_*` types | add `referral_*` types; keep `reward_*` for old rows (R-44) |
| Tests `client/src/__tests__/rewards.test.ts`, `device-id.test.ts` | move/extend under `features/referral` |

## 14. Definition of done
- All R-/AC- items implemented with named tests; unit, server and E2E suites green.
- Rhemito works end-to-end with Mito Money Admin running the companion spec, and degrades cleanly with Mito stopped.
- No hard-coded referral amounts, codes or sample data anywhere.
- Module can be switched off with `REFERRAL_ENABLED=false` with no errors.
- PR lists env vars to set on Render (`MITO_API_URL`, `REFERRAL_SERVICE_KEY`) and the DB migrations (users columns, `referral_outbox`, `referral_feed_cursors`).
