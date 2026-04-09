# Manual Bank Transfer — User Stories & Acceptance Criteria

Date: 2026-04-09
Status: DRAFT
Flow: Send Money > Step 5 (Payment Method) > Manual Bank Transfer

> **Deferred to future:** Accessibility (WCAG 2.2 AA), Promo codes & Bonuses integration

---

## US-MBT-01: Payment Method Selection, Confirmation Popup & Transaction Creation

As a sender, I want to select "Manual Bank Transfer", confirm my choice, and have the system create my transaction, so that I can proceed to pay via bank transfer with a unique reference number.

**Acceptance Criteria:**

**Selection:**
- AC-01.01: Given the user is on Step 5 (Payment Method Selection), when the payment options are displayed, then "Manual Bank Transfer" is listed with the description "Send to our local account (Pay within 30 minutes)" and a bank/building icon.
- AC-01.02: Given the user taps/clicks on Manual Bank Transfer, when the option is selected, then it is visually highlighted (border, background, or checkmark) to confirm selection.
- AC-01.03: Given the user has selected Manual Bank Transfer, when they tap/click a different payment method, then the selection switches and Manual Bank Transfer is deselected.

**Confirmation Popup:**
- AC-01.04: Given the user has selected Manual Bank Transfer, when the action is triggered, then a confirmation popup/modal appears with the message: "You have selected Manual Bank Transfer. Send to our local account (Pay within 30 minutes) option for payment. Do you want to proceed?"
- AC-01.05: Given the confirmation popup is displayed, when the user views it, then two buttons are visible: "Cancel" and "Proceed".
- AC-01.06: Given the confirmation popup is displayed, when the user taps "Cancel", then the popup closes and the user remains on Step 5 with their selection intact.
- AC-01.07: Given the confirmation popup is displayed, when the user taps outside the popup or presses the Escape key, then the popup closes (same as Cancel).
- AC-01.08: Given the user taps "Proceed", when the transaction creation begins, then the "Proceed" button shows a loading/spinner state and is disabled to prevent double submission.

**Transaction Creation:**
- AC-01.09: Given the user taps "Proceed", when the transaction creation begins, then a loading state is displayed (simulated submission delay in prototype).
- AC-01.10: Given the transaction is being created, when the loading state is active, then the user cannot navigate away or interact with other elements.
- AC-01.11: Given the transaction creation completes successfully, when the Bank Transfer Details page loads, then a unique transaction reference number is generated (e.g., #24426299).
- AC-01.12: Given the transaction creation completes successfully, when the page loads, then the 30-minute countdown timer starts immediately.
- AC-01.13: Given the transaction creation fails (network error, server error), when the error occurs, then a toast notification is displayed with a user-friendly error message and the user remains on Step 5 to retry.
- AC-01.14: Given the transaction creation fails, when the error toast is shown, then a "Retry" action is available either in the toast or on the page.

---

## US-MBT-02: Bank Details Page Layout, Status Tracker & Transaction Banner

As a sender, I want to see clear bank account details, a visual status tracker, and a transaction confirmation banner, so that I can accurately transfer the correct amount to the correct account and understand where my transaction is in the process.

**Acceptance Criteria:**

**Bank Details Card:**
- AC-02.01: Given the transaction was created successfully, when the Bank Transfer Details page loads, then the following fields are displayed in a branded card with Rhemito logo:
  - Transaction Reference No. (e.g., 24426299)
  - Account Name (e.g., Funtech Global Communications Ltd.)
  - Bank Name (e.g., The Currency Cloud Limited)
  - Bank Account Number (e.g., 1018984719)
  - Sort Code (e.g., 20-45-45)
- AC-02.02: Given the page is loaded, when the user views the amount section, then the text reads "Kindly make a payment of GBP {amount}" where {amount} is the exact total amount due including any applicable fees.
- AC-02.03: Given fees were charged, when the user views the amount, then the displayed amount is the total the user must transfer (send amount + fees), not just the send amount.
- AC-02.04: Given the page is loaded, when the user views the page, then the navigation button "I've noted the details — take me to Dashboard" is visible at the bottom.

**Status Tracker:**
- AC-02.05: Given the Bank Transfer Details page is loaded, when the user views the status tracker, then four steps are displayed: "Transaction Created", "Awaiting Payment", "Payment Received", "Processing Transfer".
- AC-02.06: Given the page has just loaded after transaction creation, when the user views the status tracker, then "Transaction Created" shows a completed state (checkmark/green) and "Awaiting Payment" shows an active/current state (highlighted, pulsing, or with an active indicator).
- AC-02.07: Given "Awaiting Payment" is the active step, when the user views it, then it is visually distinct from completed and upcoming steps.

**Transaction Created Banner:**
- AC-02.08: Given the Bank Transfer Details page loads, when the user views the top of the page, then a banner is displayed with a green checkmark showing the transaction reference number (e.g., "Your transaction has been created! Reference #24426299").
- AC-02.09: Given the banner is displayed, when it includes the receiving amount, then the amount shown is the amount the recipient will receive in the destination currency (e.g., "Recipient will receive NGN 500,000.00").
- AC-02.10: Given the banner is displayed, when the user views it, then a message reads "Please complete your payment below to finalise your transfer."

---

## US-MBT-03: Countdown Timer (Normal, Urgent & Expiry)

As a sender, I want to see a countdown timer that shows how long I have to complete the bank transfer, with visual urgency cues and clear expiry handling, so that I can act within the payment window.

**Acceptance Criteria:**

**Normal State (> 5 minutes):**
- AC-03.01: Given the Bank Transfer Details page loads, when the timer starts, then it displays 30:00 (MM:SS format) and counts down in real-time.
- AC-03.02: Given the timer is running and remaining time is greater than 5 minutes, when the user views the timer, then it is displayed in amber colour with a circular SVG ring that depletes proportionally as time passes.
- AC-03.03: Given the timer is running, when each second elapses, then the displayed time updates smoothly without flicker or jank.
- AC-03.04: Given the timer is running, when the user views the helper text, then it reads "Complete your payment" with the remaining minutes.

**Urgent State (<= 5 minutes):**
- AC-03.05: Given the timer is running, when the remaining time drops to exactly 5:00 or below, then the timer colour changes from amber to red with a smooth transition.
- AC-03.06: Given the timer is in red/urgent state, when the user views it, then a pulsing animation is applied to draw attention.
- AC-03.07: Given the timer is in urgent state, when the user views the helper text, then it reads "Time is running out!" as a warning.
- AC-03.08: Given the user has `prefers-reduced-motion` enabled, when the timer enters urgent state, then the pulsing animation is disabled but the red colour change still applies.

**Expiry (0:00):**
- AC-03.09: Given the timer reaches 0:00, when it expires, then the timer stops and an expiry popup/modal appears immediately.
- AC-03.10: Given the expiry popup is displayed, when the user views it, then the title reads "Transaction Expired" with an alert/warning icon and the body reads "The payment time has expired. This transaction will now be aborted."
- AC-03.11: Given the expiry popup is displayed, when it appears, then a 5-second auto-redirect countdown is shown (e.g., "You will be redirected to the dashboard in 5s") with a visual progress bar.
- AC-03.12: Given the expiry popup is displayed, when 5 seconds elapse, then the user is automatically redirected to the Dashboard.
- AC-03.13: Given the expiry popup is displayed, when the user taps "Go to Dashboard" before the 5-second countdown completes, then the user is immediately redirected.
- AC-03.14: Given the transaction has expired, when the user is redirected to the Dashboard, then a destructive toast notification is displayed: "Transaction Aborted — due to payment timeout. An email notification has been sent to your registered email address."
- AC-03.15: Given the transaction has expired, when the redirect occurs, then all bank transfer states (timer, reference, details) are reset/cleared from local state.
- AC-03.16: Given the expiry popup is displayed, when the user presses Escape or taps outside, then the popup does NOT close (it is a mandatory modal — the user must go to Dashboard).
- AC-03.17: Given the transaction expired, when the system aborts the transaction, then an email notification is sent to the user confirming the abort.

---

## US-MBT-04: Copy Individual Fields & Copy All

As a sender, I want to copy individual bank detail fields or all details at once to my clipboard, so that I can paste them into my banking app without manual re-typing errors.

**Acceptance Criteria:**

**Individual Copy:**
- AC-04.01: Given the Bank Transfer Details page is loaded, when the user views each bank detail field (Reference, Account Name, Bank Name, Account Number, Sort Code), then each field has an individual copy button/icon adjacent to its value.
- AC-04.02: Given the user taps a copy button for a specific field, when the action completes, then the field value is copied to the system clipboard.
- AC-04.03: Given a field value is copied successfully, when the copy completes, then the copy icon changes to a green checkmark for 2 seconds, then reverts to the default copy icon.
- AC-04.04: Given a field value is copied successfully, when the copy completes, then no toast is shown (the inline green checkmark is sufficient feedback).
- AC-04.05: Given the user taps copy, when the field value is copied, then only the value is copied (not the label) — e.g., "24426299" not "Transaction Reference No.: 24426299".

**Copy All:**
- AC-04.06: Given the Bank Transfer Details page is loaded, when the user views the bank details card, then a "Copy All" button is displayed prominently at the top of the card.
- AC-04.07: Given the user taps "Copy All", when the action completes, then all bank detail fields are copied to the clipboard in a structured, readable format:
  ```
  Transaction Reference: 24426299
  Account Name: Funtech Global Communications Ltd.
  Bank Name: The Currency Cloud Limited
  Account Number: 1018984719
  Sort Code: 20-45-45
  Amount: GBP 100.00
  ```
- AC-04.08: Given "Copy All" completes successfully, when the copy is done, then the button shows a green checkmark or "Copied!" text for 2 seconds before reverting.

**Clipboard Fallback:**
- AC-04.09: Given the clipboard API is unavailable (e.g., older browser, insecure context), when the user taps any copy button, then a fallback mechanism is used (e.g., select-all on the text) or a toast explains the text could not be copied.

---

## US-MBT-05: Email Confirmation & Dashboard Navigation

As a sender, I want to receive the bank transfer details via email and navigate to the Dashboard after noting the details, so that I have a persistent reference and can complete payment externally.

**Acceptance Criteria:**

**Email Confirmation:**
- AC-05.01: Given the transaction is created and the Bank Transfer Details page loads, when the page renders, then the system dispatches an email to the user's registered email address containing the full bank details.
- AC-05.02: Given the email is sent, when the user views the Bank Transfer Details page, then a confirmation section with a mail icon reads "Bank details sent to your email" and "We've sent the bank account details to your registered email address for your reference."
- AC-05.03: Given the email is sent, when the user opens the email, then it contains: transaction reference, account name, bank name, account number, sort code, amount to pay, and the 30-minute deadline.
- AC-05.04: Given the email fails to send, when the failure occurs, then a warning is shown on the page (e.g., "We couldn't send the email. Please copy the details manually.") — the transaction is NOT aborted.
- AC-05.05: Given the transaction expires, when the abort occurs, then a second email is sent notifying the user that the transaction was aborted due to timeout.

**Dashboard Navigation:**
- AC-05.06: Given the Bank Transfer Details page is loaded, when the user views the bottom of the page, then a button labelled "I've noted the details — take me to Dashboard" is displayed with subtitle "I'll complete the payment within 30 minutes".
- AC-05.07: Given the user taps the Dashboard button, when the navigation occurs, then the user is redirected to the main Dashboard.
- AC-05.08: Given the user navigates to the Dashboard, when the redirect completes, then the countdown timer continues to run in the background (or the transaction state is preserved so that expiry still triggers abort).
- AC-05.09: Given the user navigates to the Dashboard, when they arrive, then the transaction appears in their recent transactions list with status "Awaiting Payment".

---

## US-MBT-06: Browser Refresh Persistence & Tab Close Warning

As a sender, I want the bank transfer details and timer to persist on page refresh and to be warned before accidentally closing the tab, so that I don't lose my transaction information.

**Acceptance Criteria:**

**Browser Refresh:**
- AC-06.01: Given the user is on the Bank Transfer Details page, when they refresh the browser (F5 / pull-to-refresh), then the page reloads with the same bank details and transaction reference.
- AC-06.02: Given the timer was at 18:32 before refresh, when the page reloads, then the timer resumes from the correct remaining time (based on the original start timestamp, not resetting to 30:00).
- AC-06.03: Given the user refreshes the page after the timer has expired, when the page loads, then the expiry popup is shown immediately (the transaction is already aborted).
- AC-06.04: Given the timer state is preserved, when the system calculates remaining time, then the calculation is based on server-side transaction creation timestamp (or a persisted client-side timestamp) to prevent manipulation.

**Tab Close / Navigate Away:**
- AC-06.05: Given the user is on the Bank Transfer Details page and has NOT yet tapped "I've noted the details", when they attempt to close the browser tab or navigate to a different URL, then a browser-native `beforeunload` confirmation dialog is shown.
- AC-06.06: Given the user confirms they want to leave, when they close the tab, then the transaction remains in "Awaiting Payment" state — it is NOT immediately aborted (the server-side timer handles expiry).
- AC-06.07: Given the user navigates to the Dashboard via the provided button, when the navigation occurs, then no `beforeunload` warning is shown (this is an intentional navigation).

---

## US-MBT-07: Amount Display with Fees & Transaction Reference Number

As a sender, I want the displayed amount to accurately reflect all applicable fees and a unique transaction reference to be generated, so that I transfer the exact correct amount with the right reference.

**Acceptance Criteria:**

**Amount Display:**
- AC-07.01: Given fees are applicable, when the Bank Transfer Details page loads, then the "Amount to pay" includes fees (or fees are shown separately with a clear breakdown).
- AC-07.02: Given the amount is displayed, when the user views it, then it is formatted with the correct currency symbol, thousand separators, and two decimal places (e.g., "GBP 1,250.00").
- AC-07.03: Given the receiving amount is displayed in the banner, when the user views it, then it is in the destination currency with correct formatting (e.g., "NGN 500,000.00").

**Transaction Reference:**
- AC-07.04: Given the transaction is created, when the Bank Transfer Details page loads, then a unique numeric reference number is displayed (e.g., 24426299).
- AC-07.05: Given the reference number is displayed, when the user views it, then it is prefixed with "#" in the banner (e.g., #24426299) but copied without the "#" symbol.
- AC-07.06: Given the reference number is generated, when compared to all other reference numbers, then it is unique across the system.
- AC-07.07: Given the reference number is displayed, when the user views the bank details card, then a note instructs the user to use this reference when making their bank transfer (e.g., "Use this reference as your payment reference").

---

## US-MBT-08: Mobile Responsiveness & Error Handling

As a sender, I want the entire Manual Bank Transfer flow to work well on mobile screens and handle errors gracefully, so that I can complete my transaction on any device even when something goes wrong.

**Acceptance Criteria:**

**Mobile Responsiveness:**
- AC-08.01: Given a viewport width of 320px (smallest supported), when the Bank Transfer Details page is displayed, then all content is readable, no horizontal scrolling is required, and no elements overlap.
- AC-08.02: Given a mobile viewport, when the bank details card is displayed, then it takes full width with appropriate padding and the copy buttons are easily tappable (min 44x44px touch targets).
- AC-08.03: Given a mobile viewport, when the countdown timer is displayed, then it is sized appropriately (not too large consuming the viewport, not too small to read).
- AC-08.04: Given a mobile viewport, when the "I've noted the details" button is displayed, then it is full-width and sticky at the bottom or clearly visible without excessive scrolling.
- AC-08.05: Given the user rotates their device from portrait to landscape, when the page re-renders, then the layout adapts gracefully without breaking.
- AC-08.06: Given the confirmation popup is displayed on mobile, when the user views it, then the popup is fully visible without scrolling and buttons are large enough to tap (min 44x44px).

**Error Handling:**
- AC-08.07: Given the user taps "Proceed" on the confirmation popup, when the network is unavailable, then a toast error is displayed: "Unable to create transaction. Please check your connection and try again."
- AC-08.08: Given the Bank Transfer Details page is loaded, when the user taps a copy button and the clipboard API fails, then a toast or inline message explains the issue and suggests manual copying.
- AC-08.09: Given the Bank Transfer Details page is loaded, when the user's device goes offline, then the already-displayed bank details remain visible (no blank screen) since they are client-side rendered.
- AC-08.10: Given a server error occurs during transaction creation, when the error response is received, then a user-friendly message is shown — never raw error codes or stack traces.
- AC-08.11: Given any error occurs, when the user sees the error message, then a clear recovery action is provided (retry button, link to support, or instruction).

---

## Summary

| ID | Title | ACs | Priority |
|----|-------|-----|----------|
| US-MBT-01 | Payment Method Selection, Confirmation Popup & Transaction Creation | 14 | Must Have |
| US-MBT-02 | Bank Details Page Layout, Status Tracker & Transaction Banner | 10 | Must Have |
| US-MBT-03 | Countdown Timer (Normal, Urgent & Expiry) | 17 | Must Have |
| US-MBT-04 | Copy Individual Fields & Copy All | 9 | Must Have |
| US-MBT-05 | Email Confirmation & Dashboard Navigation | 9 | Should Have |
| US-MBT-06 | Browser Refresh Persistence & Tab Close Warning | 7 | Should Have |
| US-MBT-07 | Amount Display with Fees & Transaction Reference Number | 7 | Must Have |
| US-MBT-08 | Mobile Responsiveness & Error Handling | 11 | Must Have |

**Total: 8 user stories, 84 acceptance criteria**

> **Deferred to future:** Accessibility (WCAG 2.2 AA), Promo codes & Bonuses integration
