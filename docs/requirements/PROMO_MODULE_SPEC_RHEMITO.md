# Promo Code Module — Rhemito (Customer Front End + Rhemito Server Integration)

**Spec ID:** PROMO-RHEMITO-v1.0
**Date:** 08 October 2026
**Author:** Mohammad Mumtaz (Business Analyst)
**Target codebase:** Rhemito (`Rhemito-UI` repo — React 19 + TypeScript, Wouter, TanStack Query, Tailwind 4 + shadcn/ui; Express + TypeScript server)
**Companion spec:** `PROMO_MODULE_SPEC_MITO_ADMIN.md` (Mito Money Admin — codes, rules, validation, redemption, admin page). Rhemito holds **no promo codes and no promo rules**. It forwards the customer's code to Mito Money and shows the answer. The service contract is summarised in Section 4 and defined in full in the companion spec, Section 8.

---

## 0. Instructions for the AI coding agent

1. **Nothing that works today may stop working.** Customers can already apply a promo code on Send Money → Payment, see the discount in the summary, pay, and have the use recorded in Mito Money. Keep that working at every commit. Section 11 is the must-not-break checklist.
2. Follow `CLAUDE.md`: branch first (`feature/promo-module`), UX-first rule for any visual change (the promo field keeps its current place and style; only states and copy change, listed here), toast after every submission, close button on popups, working back buttons, run unit + E2E tests before the PR, never push to `main`.
3. Read this whole document, then the files in Section 12. Build in the phase order of Section 10.
4. Requirement IDs (`P-`, `AC-`) must appear in test names.
5. All customer-facing text here is final copy. Amounts and currencies come from the transfer and from Mito; never hard-code `GBP`, `NGN` or a code.
6. Ask one question at a time if something is unclear (per `CLAUDE.md`). Rhemito never decides whether a code is valid; Mito does.

---

## 1. Purpose and scope

### 1.1 Customer outcomes
- On the payment step, a customer enters a promo code, sees right away whether it works and how much it saves, and sees the discount in the amount summary.
- When they pay, the code is checked again and recorded once. If it can no longer be used, the payment stops before any money moves and the customer is told what to do.
- If the transfer is cancelled, fails or is refunded, the code use is given back automatically.
- The customer can see how much they have saved with promo codes.

### 1.2 Independence boundary

| The Rhemito promo module OWNS | It must NOT depend on |
|---|---|
| Server folder `server/promo/` (Mito client, routes, payment hook, transfer-event reporter, customer sync) | Referral/rewards code (`rewardsService.ts` — today `promoService.ts` imports `MITO_API_URL` from it) |
| Client folder `client/src/features/promo/` (`PromoCodeField`, `usePromoCode`, helpers) | Bonus wallet data (today promo savings are read from the rewards wallet's `promo_redemptions`) |
| Rhemito endpoints `/api/promocodes/*` | Any Mito database access (HTTP only) |

Integration points (each is a single call into the module):

| # | Host location | Call |
|---|---|---|
| IP-1 | `client/src/pages/SendMoney.tsx` payment step | `<PromoCodeField />` + `usePromoCode(...)`; summary line; create/pay payloads |
| IP-2 | `client/src/pages/MobilePaymentSimulator.tsx` | same component/hook |
| IP-3 | `server/sendMoneyRoutes.ts` pay | `promo.redeemForPayment(tx, userId, paymentMethod)` (moved, same behaviour) |
| IP-4 | `server/sendMoneyRoutes.ts` status changes (paid, completed, cancelled, failed, refunded) | `promo.onTransferStatus(userId, tx, status)` |
| IP-5 | Sign-up / profile / account-status changes | `promo.syncCustomer(userId)` |
| IP-6 | `client/src/pages/BonusAndDiscounts.tsx` | `usePromoSavings(currency)` for the "Promo codes" history chip and saved total |
| IP-7 | `server/routes.ts` | `promo.registerRoutes(app)` (replaces the inline promo routes) |

### 1.3 Out of scope
Creating or changing codes (Mito Admin). FX rate boost and bonus-credit effects (legacy types give no discount; see companion D6). Emailing codes.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| Fee | Rhemito's fee for the transfer before any discount. |
| Promo discount | Amount Mito approves off the fee (never more than the fee). |
| Validate | Ask Mito whether a code works for this transfer. Nothing is recorded. |
| Redeem | Record the use when the transfer is paid. Once per transfer. |
| Release | Give the use back when the transfer is cancelled, fails or is refunded. |

---

## 3. Architecture

```
Browser ──► Rhemito server /api/promocodes/*  ──HTTP──►  Mito Money /api/promocodes/*
              (session → userId; never trusts a userId from the body)
Send Money pay ─► validate (with payment method) ─► compare discount ─► redeem ─► mark paid
Transfer status change ─► POST /api/promocodes/transfer-events (outbox, retried)
```

- **P-1** Mito client `server/promo/client.ts`: base URL `MITO_API_URL` (default `http://localhost:5050`), timeout `MITO_API_TIMEOUT_MS` (default 4000), header `X-Promo-Service-Key: ${PROMO_SERVICE_KEY}` when set. Own copy of the config read — do not import from rewards code.
- **P-2** Fails closed: if Mito cannot be reached, no code is accepted. Message: `Promo codes are unavailable right now. Please try again shortly.` The rest of Send Money keeps working without a code.
- **P-3** Error mapping: read `body.message ?? body.error` as the customer message (today's rule) and `body.code` as the error code when present.
- **P-4** The user id sent to Mito always comes from the session (`req.session.userId`; demo mode `user_123`, existing policy).

---

## 4. Mito calls used (summary of the shared contract)

| Use | Mito call | Body / result |
|---|---|---|
| Validate | `POST /api/promocodes/validate` | `{ code, amount, fee, currency, userId, sourceCurrency, destCurrency, paymentMethod? }` → `{ valid, appliedDiscount, appliesTo, displayText, currency }` or error `{ error: <message>, code }` |
| Redeem | `POST /api/promocodes/redeem` | same + `transactionId` (transfer reference) → `{ success, discount, idempotent? }`; 409 `RELEASED` |
| Release | `POST /api/promocodes/release` | `{ transaction_id, reason }` → `{ released }` |
| Transfer events | `POST /api/promocodes/transfer-events` | `{ transfer_id, customer_id, amount, currency, receive_currency, status, created_at }` |
| Customer sync | `POST /api/promocodes/customers` | `{ id, created_at, country, send_currency, account_status, first_name, last_name, email }` |
| Savings | `GET /api/promocodes/customers/:id/redemptions` | `{ data: [...], summary: { saved: { CUR: n } } }` |

---

## 5. Rhemito server

### 5.1 Endpoints for the browser (keep paths)

| ID | Method & path | Behaviour |
|---|---|---|
| P-10 | `POST /api/promocodes/validate` | Body `{ code, amount, fee, currency, sourceCurrency, destCurrency, paymentMethod? }`. Server adds `userId` from the session. Success `200 { valid: true, appliedDiscount, appliesTo, displayText, currency }` (**same fields as today**). Error `<status> { error: <message>, code: <CODE> }` (**`error` stays a string** — existing clients use it). Rate limit 20/min per session → 429 `Too many attempts. Please wait a minute and try again.` |
| P-11 | `POST /api/promocodes/apply` | Kept for the test checkout pages (deprecated). Requires `transactionId`; forwards to redeem. Same responses as today. |
| P-12 | `GET /api/promocodes/savings?currency=` (new) | `200 { data: { items: [{ id, code, amount, currency, transferId, createdAt }], saved: { CUR: n } } }` from Mito savings. 503 when Mito is down. |

Input checks on P-10 before calling Mito: code trimmed + uppercased, 1–20 chars `A–Z0–9-` else 400 `{ error: "Enter a valid promo code.", code: "VALIDATION" }`; amount > 0 and fee ≥ 0 numbers else 400 `{ error: "Enter the amount you're sending first.", code: "VALIDATION" }`; currencies uppercased 3 letters.

### 5.2 Payment (IP-3) — keep today's logic, moved into the module
`redeemForPayment(tx, userId, paymentMethod)` runs before the transaction is marked paid:

1. **P-20** Build the request from the **stored transaction**, never from the browser: `amount = sendAmount`, `fee = feeBeforePromo ?? fee`, `currency = sourceCurrency = tx.sendCurrency`, `destCurrency = tx.receiveCurrency`, `paymentMethod`, `userId`.
2. **P-21** Validate. On failure → 409 (503 if Mito down) `PROMO_REJECTED`, message `<Mito message> Go back and remove the promo code to continue.` (unchanged).
3. **P-22** If the discount the customer was shown (`feeBeforePromo − fee`) is **greater** than Mito's `appliedDiscount` → 409 `PROMO_CHANGED` `The promo discount has changed. Go back and review your transfer.` (unchanged).
4. **P-23** Redeem with `transactionId = tx.reference`. Idempotent: a retried pay for the same transfer does not count twice. On failure → as P-21.
5. **P-24** If marking the transaction paid fails after a successful redeem, call release (`reason: "PAYMENT_FAILED"`) and return the payment error.
6. **P-25** Store on the transaction: `promoDiscountMinor` (the approved discount) and `promoRedeemedAt`. Transaction views, receipts and the transactions list show `Promo (<CODE>) −<discount>` when present.

### 5.3 Transfer status reporting (IP-4)
- **P-30** On every Send Money status change report to Mito `POST /api/promocodes/transfer-events`:

| Rhemito status change | Status sent |
|---|---|
| paid (instant methods; `completed` in the prototype) | `PAID`, then `COMPLETED` |
| `completed` later (manual transfer confirmed) | `COMPLETED` |
| `cancelled` | `CANCELLED` |
| `failed` | `FAILED` |
| refunded (when added) | `REFUNDED` |

- **P-31** Body: `transfer_id = reference`, `customer_id`, `amount = send amount` (major units), `currency`, `receive_currency`, `status`, `created_at` (ISO).
- **P-32** Sent through an outbox (`promo_outbox` table: id, kind, payload, attempts, next_attempt_at, last_error), retried 1, 5, 15, 60 min then hourly up to 24 attempts, in order per transfer. Never blocks the customer's request.
- **P-33** Transition safety: today release also happens through the rewards transfer event (`rewardsService.onTransferEvent` → Mito referral hook). Keep that call untouched. Both paths are idempotent in Mito, so sending both is safe.

### 5.4 Customer sync (IP-5)
- **P-35** `syncCustomer(userId)` posts id, account `createdAt`, country, send currency (country → currency table: GB/UK GBP, US USD, NG NGN, CA CAD, GH GHS, KE KES, ZA ZAR, DE/FR EUR, IN INR, CN CNY, AE AED, AU AUD, JP JPY, else GBP), account status (`ACTIVE`/`SUSPENDED`/`CLOSED`), names, email. Called after email verification, on profile and status changes, and (debounced 60 s) before validate. Through the outbox; failures never block.
- Mito uses this for "new customers only", "existing customers" and segment codes.

---

## 6. Client

### 6.1 Module layout
```
client/src/features/promo/
  PromoCodeField.tsx     // input + Apply/Remove + message
  usePromoCode.ts        // state machine, validation calls, re-validation
  usePromoSavings.ts     // savings for Bonus & Discounts
  lib/promo.ts           // pure helpers (format, maths, normalise) — unit tested
  lib/copy.ts            // all strings
  index.ts
```

### 6.2 `usePromoCode` state machine
States: `idle` → `checking` → `applied` | `rejected` | `unavailable`; `applied` → `checking` (re-validate) → …; any → `idle` (Remove / edit text).

Input to the hook: `{ amount, fee, sendCurrency, receiveCurrency, paymentMethod? }` from the real transfer (no hard-coded `"GBP"`, `"NGN"` or `"bank_deposit"`).

- **P-40** Apply sends P-10 with the current transfer values. Send `paymentMethod` **only if the customer has chosen one**; otherwise omit it (Mito then skips the method check until payment).
- **P-41** Re-validate automatically (debounced 400 ms) when amount, fee, send/receive currency or payment method changes while a code is applied. If it now fails: state `rejected`, discount 0, message from Mito, toast `Promo code removed` / `<message>`.
- **P-42** Editing the code text clears the applied state (as today).
- **P-43** Output: `{ state, code, discount, displayText, message, apply(), remove() }`. `discount` is 0 unless `applied`.
- **P-44** Discount maths: `effectiveFee = max(0, fee − discount)`; `Total to pay = sendAmount + effectiveFee − (other credits handled elsewhere)`, never below 0. The promo is applied **before** any referral/bonus credit (existing order).

### 6.3 `PromoCodeField` & Step 1 + Step 4 Promo Code Entry (Updated 15 Oct 2026 — v1.1)

Customers can enter and apply a promo code at **two points** in the Send Money flow:
1. **Step 1 (Amount)**:
   - Next to the `You Send` label, a `🏷️ Use Promo Code` button (`data-testid="step1-use-promo-btn"`) opens a modal (`Insert Promo Code`, `data-testid="step1-promo-modal"`) containing `<PromoCodeField promo={promo} bare />` and a `Done` button.
   - Once applied on Step 1, a green pill (`Promo <CODE> (−<discount>)` with `Change` and `×` remove buttons) is shown next to `You Send`, and the right-hand `Amount` summary card immediately displays `Promo (<CODE>) −<discount>` and `Total to Pay`.
2. **Step 4 (Payment Method)**:
   - Renders the `<PromoCodeField promo={promo} />` card above the payment method list.
   - If the customer already applied a promo code on Step 1, Step 4 displays the applied code with its `Remove` button and reflects the discount in the Step 4 `Amount Summary`. If no code was applied on Step 1, the customer can enter and apply one on Step 4.

| Element | Content |
|---|---|
| Card title | `Promo Code` |
| Label | `Have a promo code?` |
| Input | placeholder `Enter promo code`, uppercase, monospace, max 20, `aria-describedby` the message |
| Button | `Apply` (disabled when empty or checking); while checking `Checking...`; when applied the button becomes `Remove` (outline) |
| Success message (green, check icon) | Mito `displayText`, e.g. `20% off fees (GBP 1.50 saved)`; fallback `Promo code applied!` |
| Error message (red, × icon) | Mito message (Section 6.5) |
| Empty submit | `Please enter a promo code.` |
| Unavailable | `Promo codes are unavailable right now. Please try again shortly.` |

- **AC-6.3.1** Enter key in the input = Apply.
- **AC-6.3.2** Apply success toast: `Promo code applied` / `<displayText>`. Remove toast: `Promo code removed`.
- **AC-6.3.3** Message area uses `role="status"` (success) / `role="alert"` (error).
- **AC-6.3.4** Back to earlier steps and forward again keeps the applied code and re-validates (P-41).

### 6.4 Amount summary and confirmation (Steps 1, 2, 3, and 4)
- Row when applied and discount > 0: `Promo (<CODE>)` and `−<discount formatted in send currency>` (green) shown across Steps 1–4.
- If the code is valid but the discount is 0 (legacy code types), show the `displayText` under the field and no summary row.
- Total line note: `Includes promo code` (and existing referral wording when both).
- Confirmation popup copy unchanged except: `Promo Code` → `promo code`.
- Payment errors from P-21/P-22: error toast with the server message, keep the customer on the payment step, set the field to `rejected` with that message, and show a `Remove code` link in the toast.

### 6.5 Error messages shown (from Mito; listed for tests)
`This promo code isn't valid. Check it and try again.` · `This promo code is not active.` · `This promo code is not valid yet.` · `This promo code has expired.` · `This promo code has reached its limit.` · `This code only works on <CUR> transfers.` · `Send at least <amount> to use this code.` · `This code can't be used for this destination.` · `This code can't be used with this payment method.` · `This code was issued to another customer.` · `This code is not available for your account.` · `You have already used this promo code.`
Rhemito shows whatever text Mito returns; tests use the list above with Mito mocked.

### 6.6 Bonus & Discounts page (IP-6)
- **P-50** The "Promo codes" history chip and the "You've saved …" line read promo items from `usePromoSavings(currency)` (P-12) instead of `wallet.promo_redemptions`.
- **P-51** Promo history row: `Promo code <CODE>`, date `DD/MM/YYYY`, amount `−<discount>`, pill `Saved`.
- **P-52** If P-12 fails, the rest of the page still renders; the chip shows `We couldn't load your promo savings.` + `Try again`.
- **P-53** Transition: until P-12 is live in production, fall back to `wallet.promo_redemptions` when P-12 returns 404.

### 6.7 Mobile Payment Simulator (IP-2)
Replace its own promo code with `PromoCodeField` + `usePromoCode`, passing its real amount, fee, currencies and `instant_bank` method. Same copy.

### 6.8 Accessibility and design
Use existing shadcn `Card`, `Input`, `Button`; no new colours. Touch targets ≥ 44 px; input 48 px high on mobile; works at 360 px width; contrast ≥ 4.5:1.

### 6.9 Customer Dashboard / Overview Page Layout (`client/src/pages/Dashboard.tsx`)
- **Account Summary at Top**: The `Account Summary` card (`Sent`, `Wallet Balance`, `Collection Account`) is positioned at the top of the Overview page (`data-testid="section-account-summary"`).
- **Quick Services & Refer & Earn Underneath**: `Quick Services` (`Send Money`, `Receive Money`, `Send Invoice`, `Funding Campaigns`) and `Refer & Earn` are arranged in a 2-column grid directly underneath `Account Summary`, followed by the `Transactions` table.

---

## 7. Shared helpers (`lib/promo.ts`, unit tested)
- `normaliseCode(s)` → trimmed, uppercased.
- `isCodeFormatOk(s)` → `^[A-Z0-9-]{1,20}$`.
- `formatMoney(amount, currency)` — symbols £ $ € ₦ C$ A$ ¥ ¥ ₹ R `KSh ` GH₵ `AED `; JPY 0 dp, others 2; `en-GB` grouping.
- `effectiveFee(fee, discount)`, `totalToPay(send, fee, discount, otherCredit)` — never below 0, rounded per currency.
- `shouldRevalidate(prev, next)` — true when amount, fee, currencies or method changed.

---

## 8. Non-functional
| # | Requirement |
|---|---|
| NFR-1 | Validate round trip p95 < 600 ms; the field shows `Checking...` meanwhile. |
| NFR-2 | No promo logic in the browser beyond display and the maths in Section 7; the server re-checks at payment. |
| NFR-3 | Feature flag `PROMO_ENABLED` (default `true`). When `false`, the field is hidden, P-10 returns 404, and payment ignores any code. |
| NFR-4 | Never log the customer's full details; log user id and transfer reference. |

---

## 9. Test plan

**Vitest (unit):** every helper in Section 7 (JPY, NGN, zero fee, discount > fee clamp, total never negative); `usePromoCode` transitions (apply ok, apply rejected, unavailable, edit clears, re-validate on amount change → rejected, remove).

**Server (Vitest + supertest, Mito stubbed):**
- P-10 uses session user id (body `userId` ignored); keeps response fields; error `error` is a string; input checks; rate limit.
- P-11 forwards to redeem.
- P-20…P-25 pay: success; Mito rejects → not paid; discount shown > approved → `PROMO_CHANGED`, not paid; retry pay → no double count; payment failure after redeem → release called.
- P-30…P-32 events for each status, outbox retry and ordering.
- P-35 sync payload; failure doesn't block sign-up.
- P-33 rewards transfer event still sent (regression).
- NFR-3 flag off.

**Playwright E2E (Mito mocked so Mito Admin need not run):**
1. Apply a valid code → message, summary row `Promo (CODE) −£x`, total reduced → pay → success popup says promo code applied.
2. Invalid code → red message; pay without code still works.
3. Mito down → unavailable message; transfer can still be paid without a code.
4. Change amount below the code's minimum after applying → code removed with message and toast.
5. Choose a payment method the code doesn't allow → removed with message.
6. Pay when Mito now rejects → error toast, stays on payment step, `Remove code` works, then pay succeeds.
7. Bonus & Discounts "Promo codes" chip lists savings.
8. Existing specs still green (`tests/e2e/rewards.spec.js`, send-money specs, `client/src/__tests__/send-money.test.ts`, `server/tests/validate_promo.test.js`, `server/tests/api.test.js`).

---

## 10. Build phases
| Phase | Content | Exit check |
|---|---|---|
| 1 | Server module: client (own config), routes moved (same paths/fields), `redeemForPayment` moved unchanged, P-25 fields, transfer-event outbox, customer sync, P-12 | all existing tests green; new server tests green |
| 2 | Client module: `usePromoCode`, `PromoCodeField`, real currencies/method, re-validation, summary wording, Remove, Simulator | E2E 1–6 green |
| 3 | Bonus & Discounts savings via P-12 (with fallback) | E2E 7 green |
| 4 | Clean-up: delete unrouted admin copies in Rhemito **only after confirming no import/route uses them**: `client/src/pages/Financials/PromoCodes.jsx`, `client/src/components/Promo/*`, `client/src/pages/Campaigns/CampaignManager.jsx`. Remove `promoService.ts`'s import from `rewardsService.ts`. | full suite green |

---

## 11. Must-not-break checklist (tick each in the PR)

| # | What | Check |
|---|---|---|
| R1 | Send Money: apply code, see discount, pay, use recorded in Mito once | E2E 1 + Mito redemption count |
| R2 | Pay without a code | E2E 2 |
| R3 | Pay re-check (`PROMO_REJECTED`, `PROMO_CHANGED`) | server tests |
| R4 | Cancelled transfer gives the code use back (both the old rewards path and the new promo event) | server test + Mito usage modal shows `Released` |
| R5 | `/api/promocodes/validate` response fields and string `error` | server test |
| R6 | Test checkout pages (`TestCheckout.tsx`/`.jsx`) still validate and apply | manual + server test of P-11 |
| R7 | Mobile Payment Simulator promo | E2E/manual |
| R8 | Bonus & Discounts promo chip and saved total | E2E 7 |
| R9 | Bonus credit (one balance incl. referral rewards; Pay less / Send more) still combines with a promo, promo first | E2E with both |
| R10 | Mito down: Send Money still works without a code | E2E 3 |

---

## 12. Current code to reuse / migrate

| Current file | Becomes |
|---|---|
| `server/promoService.ts` | `server/promo/client.ts` (own `MITO_API_URL` read; no import from `rewardsService.ts`) |
| `server/routes.ts` (inline `/api/promocodes/validate`, `/apply`) | `server/promo/routes.ts`, registered via `promo.registerRoutes(app)` |
| `server/sendMoneyRoutes.ts` `redeemPromoForPayment` | `server/promo/payment.ts` `redeemForPayment` (same logic) + P-24/P-25 |
| `client/src/pages/SendMoney.tsx` promo state, `handleApplyPromo`, summary row, confirmation copy | `features/promo` hook + component; SendMoney keeps only the integration |
| `client/src/pages/MobilePaymentSimulator.tsx` promo block | `features/promo` |
| `client/src/pages/BonusAndDiscounts.tsx` promo rows / `promoSaved` | `usePromoSavings` |
| `shared/sendMoney.ts` | add `promoDiscountMinor`, `promoRedeemedAt` (optional fields) |
| Tests `server/tests/validate_promo.test.js`, `api.test.js`, `client/src/__tests__/send-money.test.ts` | keep; extend |

## 13. Environment variables
| Var | Default | Purpose |
|---|---|---|
| `MITO_API_URL` | `http://localhost:5050` | Mito Money base URL (live Render URL in production) |
| `MITO_API_TIMEOUT_MS` | `4000` | Timeout |
| `PROMO_SERVICE_KEY` | unset | Sent as `X-Promo-Service-Key`; must match Mito |
| `PROMO_ENABLED` | `true` | Feature flag |

## 14. Definition of done
- All P-/AC- items implemented with named tests; unit, server and E2E suites green.
- Must-not-break checklist (Section 11) ticked with evidence.
- No hard-coded promo codes, currencies or payment methods in promo code paths.
- `features/promo` and `server/promo` import nothing from rewards/referral code.
- PR lists env vars to set on Render and the new DB fields/tables (`promo_outbox`, transaction promo fields).
