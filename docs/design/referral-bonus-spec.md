# Refer & Earn and Bonus & Discounts — Screen Specification

**Feature:** Referral & Bonus (customer side)
**Status:** Approved (direction "Mix": A layout + C friend progress), 03/10/2026
**Requirements:** Mito Admin repo `Docs/Requirements/referral-and-bonus-user-stories.md` (US-2.x, US-3.x, US-5.x, US-6.x)
**Benchmarks:** Wise (invite page: plain offer sentence, link + share), Monzo (per-friend progress), Revolut (rewards in notifications)
**Design canvas:** "Rhemito Refer & Earn — Design Directions" (Mix row)

---

## Design rationale

Money-transfer customers need to trust a reward before they share it, so the offer is one plain sentence built from the live rule (Wise). The most common support question — "why haven't I been paid?" — is answered on the card itself with a three-stage progress bar per friend (Monzo). Everything else stays calm and data-first, in the existing Rhemito card style.

## Tokens (no new colours)

| Use | Token / value |
|---|---|
| Primary action | `bg-blue-600 hover:bg-blue-700 text-white` (primary hue, darker for 4.5:1 on white text) |
| Success / earned | `teal` (`hsl(var(--teal))`) for fills; text `text-teal-700` |
| In progress | `primary` (`bg-primary`) |
| Not started | `bg-slate-200` |
| Expiry warning | `bg-amber-100 text-amber-800` |
| Cards | `rounded-2xl border border-slate-200 bg-white`, padding 20px |
| Headings | `font-display` (Plus Jakarta Sans) 18–24px bold; body Inter 15px |

Touch targets ≥ 44px; inputs 48px high, 16px text. Focus ring: `focus-visible:ring-2 ring-primary ring-offset-2`. All motion respects `prefers-reduced-motion` (Framer Motion `useReducedMotion`).

---

## 1. Dashboard — Offer banner (US-6.1 AC-6.1.5)

- Shown when the latest offer notification for the customer's currency is < 7 days old and not dismissed.
- Layout: `bg-blue-50 border border-blue-200 rounded-xl p-3.5`; eyebrow "NEW OFFER" (13px bold, blue-700), message (15px), link "View offer" scrolls to the Refer & Earn card and highlights it for 2 s (ring-2 ring-primary).
- Close (X) button, 44×44, `aria-label="Dismiss offer"`; dismissal stored per offer id in `localStorage` (`rhemito.offerDismissed.<id>`).
- Enter: fade + 6px slide, 200ms ease-out.

## 2. Dashboard — Refer & Earn card (US-2.1, US-2.2, US-2.3)

Order inside the card:
1. Title "Refer & Earn" (18px bold) and "How it works" text button (opens dialog with the 3 steps and terms).
2. Offer sentence from the API (`offer.text`), amounts in bold.
3. Label "Your referral link" + read-only input (48px, `font-display` 15px semibold) with the full link.
4. Two buttons in a 2-column grid: **Copy link** (primary, Copy icon) and **Share** (outline, Share icon). Share uses `navigator.share`; the button is hidden when unsupported.
   - Copy success: label → "Copied" with check icon for 2.5 s; toast "Referral link copied! Share it with friends to earn bonus credit."
   - Copy failure: toast "We couldn't copy the link. Please copy it manually." and select the input text.
5. Divider, then up to 3 latest referrals: name ("Sarah S."), status text on the right, and a 3-segment bar (Joined → Sent £50+ → Earned; 6px high, 4px gap, rounded). Legend row under the bars (12px slate-500). Link "See all referrals (n)" → `/bonus-discounts?tab=referrals`.
   - Segment colours: earned = teal ×3; in progress (PENDING) = primary ×2; joined (REGISTERED) = primary ×1; expired / not eligible / reversed = slate-300 ×3 with status text in slate-600.
   - Empty: "No referrals yet. Share your link to start earning."

States:
- **No active rule:** card not rendered (AC-2.1.5).
- **Cap reached:** sentence "You've reached the maximum referral rewards for this programme. Thank you for spreading the word!", link and buttons hidden.
- **Loading:** skeleton (3 bars) inside the card frame.
- **Error:** "We couldn't load your referral details." + "Retry" text button.

## 3. Dashboard — Bonus credit card and header pill

- Separate card under Refer & Earn (whole card is a link to `/bonus-discounts`): "Bonus credit ready to use" (13px), amount (22px extra-bold), amber line "£2.00 expires in 9 days" when any credit expires within 14 days, right-aligned "Send money" (blue, 15px semibold).
- Hidden when available = 0.
- The header pill "You have earned £X Referral Bonus Credit. Create a Transaction to use it." uses the real balance and is hidden when 0 (AC-5.1.1). "Create a Transaction" links to `/send-money`.

## 4. Bonus & Discounts page (US-5.1)

- Header: title, subtitle "Track your rewards, referrals and savings.", currency selector (shadcn Select) when the customer has credit in more than one currency.
- Tabs (shadcn Tabs, segmented style, 3 equal tabs, 40px): **Overview**, **History**, **My referrals**. `?tab=` query param selects the tab.

**Overview**
- 2×2 grid (4 across from `md`): Available (teal-700 amount, "Ready for your next transfer", primary button "Send money" when > 0, else outline "Refer a friend" that copies the link), Total earned ("From X referrals and Y other bonuses"), Used ("Across X transfers"), Expired ("Use your bonus before it expires").
- Line: "You've saved £Z in total with bonuses and promo codes."
- "Unused bonus" list: source, "£2.00 left of £10.00" when partly used, "Earned DD/MM/YYYY · expires DD/MM/YYYY", amber pill "Expires in X days" when ≤ 14 days, sorted soonest expiry first.

**History**
- Filter chips: All, Earned, Used, Expired, Promo codes (`aria-pressed`).
- Rows: description, date (DD/MM/YYYY), status pill (Unused teal, Partly used amber, Used slate, Expired slate, Reversed red), signed amount (+ teal-700 / − slate-900).

**My referrals**
- Summary "Joined: X · Earned: Y · Total earned: £Z".
- One card per referral; PENDING cards show a vertical 3-step timeline (done = teal circle with check, current = primary ring, upcoming = slate ring); other statuses show one help line (US-2.3 table).
- Empty: "No referrals yet. Share your link to start earning." + "Copy referral link".

Loading: skeletons; error: "We couldn't load your rewards. Please try again." + Retry. Never show sample data.

## 5. Sign-up with a referral (US-3.1, US-3.2)

- `/ref/:code` validates the code, records a visit, stores the code for 30 days, then opens `/sign-in-sign-up?mode=signup`. Invalid → toast "This referral link isn't valid. You can still sign up."; inactive referrer → "This referral link is no longer active. You can still sign up."; signed-in customer → dashboard + toast "Referral links are for new customers only."
- Above the form: bordered box (rounded-2xl, p-4) "**Olayinka invited you** – get £10.00 bonus credit in 3 steps." and a 3-segment strip (Join = primary, others slate-200) with labels Join / Send £50.00+ in 30 days / Get £10.00.
- Referral code row: prefilled code chip with check icon, "Remove" text button. Without a link: collapsed text button "Have a referral code?" reveals the optional field (6–12 letters/numbers, uppercased on blur, validated on blur: "Code applied – invited by Olayinka" / "Referral codes are 6–12 letters and numbers." / "We couldn't find this referral code. Check it or leave the field blank.").

## 6. Send Money — bonus step (US-5.2, US-5.3)

- Card "Use your bonus" with "£7.00 available" (teal-700).
- RadioGroup (56px rows): **Pay less** ("Save £X now"), **Send more** ("Recipient gets ₦Y more"), **Don't use bonus** (default).
- Note under options when a credit expires in ≤ 14 days: "£2.00 of this expires on DD/MM/YYYY – it's used first."
- Below minimum: options disabled, text "Send £20.00 or more to use your £7.00 bonus."
- Summary: separate row "Referral bonus −£X" (Pay less) or "Referral bonus (recipient) +£X" (Send more); Total to Pay = send + fee − promo − bonus, never below 0.
- Applying: toasts "£X bonus applied. You'll pay £X less." / "£X bonus added. Your recipient will get more."
- Balance changed on payment: error toast "Your bonus balance has changed. Please review your transfer." and the option resets.

## 7. Notifications (US-6.1, US-6.2)

New types with a Gift icon (teal) or Sparkles (offer, primary): `reward_offer`, `reward_friend_joined`, `reward_earned`, `reward_bonus_used`, `reward_bonus_expiring`, `reward_bonus_expired`, `reward_bonus_reversed`. Archive gets a "Rewards" category filter. Clicking a reward notification opens `/bonus-discounts`.

## Accessibility checklist

- Tabs: Radix Tabs (roving focus, `aria-selected`).
- Progress bars: wrapper `role="img"` with `aria-label="Sarah S.: earned"` etc.
- Copy/Share/Close are real `<button>`s with labels; live region via the existing toaster.
- Contrast: all text ≥ 4.5:1 (white only on blue-600 or darker).
