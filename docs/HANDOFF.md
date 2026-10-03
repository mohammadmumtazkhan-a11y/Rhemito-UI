# Handoff — Referral & Bonus (customer side)

**From:** uiux-designer → **To:** frontend-web-engineer / backend-platform-engineer
**Spec:** `docs/design/referral-bonus-spec.md` (approved 03/10/2026, direction "Mix")

## Build
1. Server proxy to the Mito Admin referral engine (`MITO_API_URL`, default `http://localhost:5050`): customer upsert, offer, wallet, referrals, code validation, link visits, transfer events, bonus apply/release.
2. Hooks: registration (referral code → referral on email verification), Send Money pay/cancel (transfer events, bonus apply/release), reward notifications.
3. Client: Dashboard offer banner, Refer & Earn card, bonus credit card + header pill; Bonus & Discounts page (Overview / History / My referrals); `/ref/:code`; sign-up referral strip and code field; Send Money bonus step; notification types.
4. Remove all hard-coded bonus/referral values (£5, £10, OLAYINKA2025, sample history).

## Rules
- Match the spec exactly; any visual change goes back to the designer.
- Every submission shows a toast; every popup has a close button; back buttons keep working.
- Tests: Vitest for helpers, Playwright for the flows (API responses mocked so they do not need Mito Admin running).
