# Change Note v1.1 — One Customer Balance (Rhemito)

**Applies to:** `REFERRAL_MODULE_SPEC_RHEMITO.md` (v1.0 → v1.1), `BONUS_MODULE_SPEC_RHEMITO.md` (v1.0 → v1.1), and one line of `PROMO_MODULE_SPEC_RHEMITO.md`.
**Decision (08/10/2026):** the customer has **one bonus credit balance** per currency. Referral rewards, bonus-offer rewards and goodwill credits all go into it, are spent together, and each credit shows **how it was earned**: **Referrals**, **Bonus offers** or **From Rhemito**. Customer wording is **"bonus credit"** everywhere.

If you have already read the v1.0 specs, read only this note. Everything not listed here is unchanged. The full v1.1 specs are the source of truth if anything here is unclear.

---

## A. Bonus module (`BONUS_MODULE_SPEC_RHEMITO.md`) — now owns the one balance on Rhemito

### A1. Decisions (§2)
- **D1:** promo discount first (to the fee), then bonus credit. There is no separate referral-credit step.
- **D2:** bonus credit used ≤ send amount; Total to pay never below 0.
- **D3 (replaced):** **One balance.** Referral, bonus-offer and goodwill credits form one balance per currency, spent together (soonest expiry first, whatever the source). Each credit is tagged with how it was earned.
- §1.3 out of scope: only *deciding* referral rewards and the referral progress screens belong to the referral module. Its rewards still land in this one balance.

### A2. Payment (§5.2)
- **B-21:** order is validate → promo redeem → bonus apply → mark paid. On failure, release bonus and promo. The referral-credit step is removed.
- **B-22:** `0 < amount ≤ min(available, sendAmount)`, where `available` is the **whole** balance (all sources).

### A3. Notifications (§5.4)
- `BONUS_EARNED` copy:
  - bonus offer: `Bonus earned: <scheme name>. <amount> bonus credit is ready to use on your next transfer by <DD/MM/YYYY>.`
  - goodwill: `Rhemito has added <amount> bonus credit to your account. Use it by <DD/MM/YYYY>.`
- **New B-41a:** referral rewards earned or removed are announced by the referral module; Mito sends no `BONUS_EARNED`/`BONUS_REVERSED` for them. Used, returned, expiring and expired notifications cover the whole balance. When the payload's `by_source` has a referral part > 0, add the line `Includes <amount> from referrals.`

### A4. Browser API (§5.5)
**B-50** `GET /api/bonus/summary?currency=&source=`:
- `wallet` now includes `by_source` and, on each row, `credit_source`, `credit_source_detail`, `credit_source_label`.
- `source` (`REFERRAL`, `SCHEME`, `MANUAL`) filters the lists, never the totals.

### A5. Screens (§7)
- **Dashboard pill (7.1):** one pill for the one balance. The combined "bonus + referral credit" line is removed; there is no separate referral pill.
- **Bonus & Discounts (7.3):**
  - **New "How you earned it"** section under the tiles, from `by_source`. One row per source with anything earned (**Referrals**, **Bonus offers**, **From Rhemito**), each showing `Earned <earned> · <available> left`, a thin bar of its share of total earned, and a `View` link that applies that source filter. The rows add up exactly to the tiles. If only one source exists, show a single line: `All earned from <source>.`
  - **Unused bonus** list: each row gets a source tag chip and its description from `credit_source_label` (e.g. `Referral bonus – Sarah S.`, `Welcome bonus – invited by Olayinka A.`, `Loyalty bonus – Loyal Sender`, `Goodwill credit from Rhemito`). Returned credit adds ` (returned after a cancelled transfer)`.
  - **History:** add a **Source** select (`All sources`, `Referrals`, `Bonus offers`, `From Rhemito`); URL `?source=REFERRAL|SCHEME|MANUAL` preselects it. Each row gets a source tag chip.
- **Send Money "Use your bonus" (7.5):**
  - `credit = min(available, sendAmount)` using the whole balance. The "Your other credit already covers this transfer" state is removed.
  - When the balance has more than one source, show a small line under the header: `Includes <x> from referrals` (and/or `<y> from bonus offers`, `<z> from Rhemito`).
  - Summary row sits after the promo row only.

### A6. Helpers and tests (§8, §9)
- Helpers:
  - `creditToApply(available, sendAmount, currency)` drops the `otherCredit` parameter;
  - `totalToPay(send, fee, promo, bonusPayLess)`;
  - `amountConverted(send, sendMoreCredit)`;
  - new `sourceGroupLabel(credit_source)` (`REFERRAL`→`Referrals`, `SCHEME`→`Bonus offers`, `MANUAL`→`From Rhemito`);
  - new `breakdownRows(by_source)` (rows sum to the totals);
  - `describeCredit(row)` prefers `credit_source_label`, falling back to today's wording rules.
- Tests:
  - Vitest: the breakdown sums to the totals; source labels; the "Includes … from referrals" line.
  - Server: the `source` filter keeps totals complete.
  - E2E 3: "How you earned it", source chips, Source filter, and the `?source=REFERRAL` link from Refer & Earn.
  - E2E 4: a balance made of referral and bonus-offer credit is used as one amount.

---

## B. Referral module (`REFERRAL_MODULE_SPEC_RHEMITO.md`) — no balance of its own

### B1. Removed
- **§5.5 Using credit at payment** (R-30…R-35): the `referralCredit` pay field, the apply/release calls, `REFERRAL_CREDIT_CHANGED`, and the transaction `referralCredit*` columns and receipt lines.
- **§7.6 Referral credit pill** and **§7.7 "Use referral credit"** step. The bonus module covers both.
- Components `ReferralCreditPill`, `UseReferralCredit`, `ReferralCreditSummary`; hook `useReferralWallet`; query key `["referral","wallet",…]`; **RAPI-4** `/api/referral/wallet`.
- Mito calls to `/api/referral/wallet/...`, `/apply`, `/release`.
- Notifications `referral_credit_used`, `referral_credit_expiring`, `referral_credit_expired`. The bonus module sends these for the whole balance.
- Helpers `creditToApply`, `totalToPay`, `amountConverted`, and their tests. Server tests for R-30…R-34. Old E2E 6 (Send Money).
- Integration points: IP-7 is removed. IP-5 is now only `referral.onTransferStatus(...)`. IP-6 is now only `<ReferralOfferBanner />` and `<ReferEarnCard />`. IP-10: nothing to render on Bonus & Discounts.
- `sendMoneyRoutes.ts` migration row: only FAILED/REFUNDED reporting remains. `BonusRedemption` and `BonusBlockedNotice` go to the bonus module. The `SendMoney.tsx` row is removed.

### B2. Changed
- **RAPI-1** `GET /api/referral/summary`: the `wallet` field is replaced by `referralCredit: { currency, earned, available, used, expired }`. It is the `REFERRAL` entry of Mito's `GET /api/wallet/:customerId` `by_source`, with zeros when there is none (read only).
- **R-22:** returning credit on a failed transfer is the bonus module's job.
- **Refer & Earn page tab "Referral credit" → "Your rewards"** (`<ReferralRewardsSummary />`, read only):
  - line `You've earned <earned> from referrals. <available> of it is still available to use.`;
  - button `Use it on a transfer` → `/send-money` when available > 0;
  - link `See all your bonus credit` → `/bonus-discounts?source=REFERRAL`;
  - empty state `No referral rewards yet. Share your link to start earning.`;
  - error `We couldn't load your referral rewards. Please try again.` + `Try again`.
- Page subtitle: `Invite friends and track their progress.` Tabs: **Invite**, **My referrals**, **Your rewards**.
- **Copy: "referral credit" → "bonus credit":**
  - sign-up box (`get <x> bonus credit in 3 steps`, `get up to <x> bonus credit`);
  - copy-link toast (`Share it with friends to earn bonus credit.`);
  - My referrals help line (`<x> added to your bonus credit`);
  - How it works term (`Your reward is added to your bonus credit and can be used on transfers in <currency> for <BV> days after it is issued.`).
- **Notifications:**
  - `referral_credit_earned` title becomes `You've earned <amount> bonus credit`, and the body says "bonus credit".
  - `referral_credit_reversed` becomes `Referral bonus removed` / `Your <amount> referral bonus has been removed because the related transfer was reversed.`
  - Clicking earned or removed opens `/bonus-discounts?source=REFERRAL`.
- **Bonus & Discounts:** owned by the bonus module. The old "My referrals" tab moves to `/refer-earn?tab=referrals`; keep a link to it from Bonus & Discounts.
- **E2E:**
  - test 5 also checks that Your rewards links to Bonus & Discounts filtered by Referral;
  - new test 6: each referral notification opens the right place, and there is no duplicate "earned" notification from the bonus module.
- DoD: the transaction credit columns are dropped from the migration list.

---

## C. Promo module (`PROMO_MODULE_SPEC_RHEMITO.md`) — one line
Must-not-break **R9** now reads: `Bonus credit (one balance incl. referral rewards; Pay less / Send more) still combines with a promo, promo first.`
Nothing else changes: promo codes are a fee discount, not credit, so they are not part of the balance.
