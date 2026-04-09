# EPIC-MBT-CANCEL: Customer-Initiated Transaction Cancellation

## Epic Overview

As a Rhemito customer who has created a money transfer transaction using the Manual Bank Transfer payment method, I need the ability to cancel that transaction while it is still awaiting my payment. This feature prevents customers from being locked into transactions they no longer wish to complete, reduces support tickets for manual cancellations, and ensures the transaction lifecycle is transparent and fully within the customer's control during the pre-payment window.

**Scope:** Dashboard Recent Transactions table, Transaction Detail page, cancellation confirmation modal, post-cancellation state management, and email notification.

**Payment Method Applicability:** Manual Bank Transfer only. All other payment methods (Instant Pay By Bank, Card, Wallet) process immediately upon creation and are not eligible for customer-initiated cancellation.

**Cancellable Status:** "Awaiting Payment" only. Transactions in any other status (Processing, Completed, Failed, Cancelled) cannot be cancelled by the customer.

---

## US-CANCEL-01: Cancel Button Visibility in Transaction List

**As a** sender,
**I want** to see a "Cancel" button in the Actions column only for transactions that are awaiting my payment,
**So that** I can clearly identify which transactions I am able to cancel without confusion.

### Acceptance Criteria

#### AC-CANCEL-01.01 — Cancel button displayed for Awaiting Payment transactions
**Given** I am on the Dashboard and the Recent Transactions table is visible
**When** a transaction has the status "Awaiting Payment"
**Then** a "Cancel" button is displayed in the Actions column for that transaction, alongside the existing "Resend" button

#### AC-CANCEL-01.02 — Cancel button hidden for Processing transactions
**Given** I am on the Dashboard and the Recent Transactions table is visible
**When** a transaction has the status "Processing"
**Then** no "Cancel" button is displayed in the Actions column for that transaction
**And** the "Resend" button remains visible

#### AC-CANCEL-01.03 — Cancel button hidden for Completed transactions
**Given** I am on the Dashboard and the Recent Transactions table is visible
**When** a transaction has the status "Completed"
**Then** no "Cancel" button is displayed in the Actions column for that transaction

#### AC-CANCEL-01.04 — Cancel button hidden for Failed transactions
**Given** I am on the Dashboard and the Recent Transactions table is visible
**When** a transaction has the status "Failed"
**Then** no "Cancel" button is displayed in the Actions column for that transaction

#### AC-CANCEL-01.05 — Cancel button hidden for already Cancelled transactions
**Given** I am on the Dashboard and the Recent Transactions table is visible
**When** a transaction has the status "Cancelled"
**Then** no "Cancel" button is displayed in the Actions column for that transaction

#### AC-CANCEL-01.06 — Cancel button only for Manual Bank Transfer payment method
**Given** I am on the Dashboard and the Recent Transactions table is visible
**When** a transaction was created using a payment method other than Manual Bank Transfer (e.g. Instant Pay By Bank, Card, Wallet)
**Then** no "Cancel" button is displayed in the Actions column for that transaction, regardless of its status

#### AC-CANCEL-01.07 — Multiple Awaiting Payment transactions
**Given** I am on the Dashboard and the Recent Transactions table contains multiple transactions with status "Awaiting Payment"
**When** I view the table
**Then** each "Awaiting Payment" transaction displays its own independent "Cancel" button in the Actions column

#### AC-CANCEL-01.08 — Cancel button visual styling
**Given** I am on the Dashboard and a transaction displays a "Cancel" button
**When** I view the Actions column
**Then** the "Cancel" button is visually distinct from the "Resend" button (using the destructive colour token)
**And** the button label reads "Cancel"
**And** the button meets the minimum touch target size of 44x44px on mobile viewports

#### AC-CANCEL-01.09 — Cancel button accessibility
**Given** I am navigating the Dashboard using a keyboard or screen reader
**When** I reach the Actions column of an "Awaiting Payment" transaction
**Then** the "Cancel" button is focusable via keyboard (Tab key)
**And** the button has an accessible label that includes the transaction reference (e.g. "Cancel transaction RHM-20260409-001")
**And** activating the button via Enter or Space opens the cancellation confirmation modal

---

## US-CANCEL-02: Cancellation Confirmation Modal

**As a** sender,
**I want** to be asked to confirm before my transaction is cancelled,
**So that** I do not accidentally cancel a transaction I still intend to pay.

### Acceptance Criteria

#### AC-CANCEL-02.01 — Modal appears on Cancel button tap
**Given** I am on the Dashboard and I see a "Cancel" button for an "Awaiting Payment" transaction
**When** I tap or click the "Cancel" button
**Then** a confirmation modal appears overlaying the page
**And** the background content is dimmed and non-interactive

#### AC-CANCEL-02.02 — Modal content and messaging
**Given** the cancellation confirmation modal is displayed
**When** I read the modal content
**Then** the modal displays a clear heading: "Cancel Transaction"
**And** the modal displays the transaction reference number
**And** the modal displays the recipient name and amount
**And** the modal displays a warning message: "Are you sure you want to cancel this transaction? This action cannot be undone."
**And** the modal displays two action buttons: "Yes, Cancel Transaction" (destructive style) and "Go Back" (secondary/outline style)

#### AC-CANCEL-02.03 — Abort cancellation via Go Back button
**Given** the cancellation confirmation modal is displayed
**When** I tap or click the "Go Back" button
**Then** the modal closes
**And** the transaction status remains "Awaiting Payment"
**And** the "Cancel" button remains visible in the Actions column
**And** no API call is made to cancel the transaction

#### AC-CANCEL-02.04 — Abort cancellation via close icon
**Given** the cancellation confirmation modal is displayed
**When** I tap or click the close (X) icon in the top-right corner of the modal
**Then** the modal closes
**And** the transaction remains unchanged

#### AC-CANCEL-02.05 — Abort cancellation via backdrop click
**Given** the cancellation confirmation modal is displayed
**When** I click outside the modal (on the dimmed backdrop)
**Then** the modal closes
**And** the transaction remains unchanged

#### AC-CANCEL-02.06 — Abort cancellation via Escape key
**Given** the cancellation confirmation modal is displayed
**When** I press the Escape key
**Then** the modal closes
**And** the transaction remains unchanged

#### AC-CANCEL-02.07 — Modal focus trap for accessibility
**Given** the cancellation confirmation modal is displayed
**When** I navigate using the Tab key
**Then** focus is trapped within the modal (cannot Tab to background elements)
**And** focus is initially placed on the "Go Back" button (safe default)
**And** when the modal closes, focus returns to the "Cancel" button that triggered it

#### AC-CANCEL-02.08 — Modal accessible attributes
**Given** the cancellation confirmation modal is displayed
**When** a screen reader announces the modal
**Then** the modal has role="alertdialog" and an appropriate aria-labelledby referencing the heading
**And** the warning message is announced to screen readers

#### AC-CANCEL-02.09 — Prevent duplicate submission
**Given** the cancellation confirmation modal is displayed
**When** I tap "Yes, Cancel Transaction"
**Then** the button is immediately disabled and shows a loading state (e.g. spinner with text "Cancelling...")
**And** I cannot tap the button again until the API response is received

---

## US-CANCEL-03: Successful Cancellation Outcome

**As a** sender,
**I want** my transaction to be cancelled immediately when I confirm, with clear feedback and a confirmation email,
**So that** I have confidence the cancellation was processed and I have a record of it.

### Acceptance Criteria

#### AC-CANCEL-03.01 — Status update on successful cancellation
**Given** I have confirmed the cancellation via the confirmation modal
**When** the API returns a success response
**Then** the transaction status in the Recent Transactions table updates to "Cancelled"
**And** the status dot colour changes to the cancelled indicator (red/grey as per design)
**And** the "Cancel" button is removed from the Actions column for that transaction
**And** the "Resend" button remains visible

#### AC-CANCEL-03.02 — Success toast notification
**Given** I have confirmed the cancellation and the API returns a success response
**When** the modal closes
**Then** a success toast notification is displayed with the message: "Transaction [Ref No.] has been cancelled successfully."
**And** the toast auto-dismisses after the standard duration

#### AC-CANCEL-03.03 — Confirmation modal closes after success
**Given** I have confirmed the cancellation and the API returns a success response
**When** the status update is complete
**Then** the confirmation modal closes automatically
**And** I remain on the Dashboard page

#### AC-CANCEL-03.04 — Email notification sent on cancellation
**Given** I have successfully cancelled a transaction
**When** the cancellation is processed by the server
**Then** a cancellation confirmation email is sent to my registered email address
**And** the email includes the transaction reference number, recipient name, amount, and date/time of cancellation

#### AC-CANCEL-03.05 — API failure during cancellation
**Given** I have confirmed the cancellation via the confirmation modal
**When** the API returns an error response (e.g. network failure, server error, timeout)
**Then** the modal remains open
**And** the "Yes, Cancel Transaction" button is re-enabled
**And** an error message is displayed within the modal: "We could not cancel this transaction. Please try again. If the problem persists, contact support."
**And** the transaction status remains "Awaiting Payment"

#### AC-CANCEL-03.06 — Race condition: transaction already processed
**Given** I have confirmed the cancellation via the confirmation modal
**When** the API returns an error indicating the transaction is no longer in "Awaiting Payment" status (e.g. payment was received in the interim)
**Then** the modal displays a message: "This transaction can no longer be cancelled as its status has changed."
**And** a "Close" button is displayed
**When** I tap "Close"
**Then** the modal closes
**And** the transaction row in the table refreshes to reflect the current status

#### AC-CANCEL-03.07 — Cancellation is irreversible
**Given** a transaction has been successfully cancelled
**When** I view that transaction in the Recent Transactions table
**Then** no "Cancel" button is displayed
**And** there is no option to reverse or undo the cancellation from the UI

#### AC-CANCEL-03.08 — Query cache invalidation
**Given** a transaction has been successfully cancelled
**When** the success response is received
**Then** the transactions query cache is invalidated so that subsequent page loads and navigations reflect the updated status without requiring a manual refresh

---

## US-CANCEL-04: Transaction Detail Page Cancel Option

**As a** sender,
**I want** to be able to cancel an "Awaiting Payment" transaction from the Transaction Detail page as well,
**So that** I can cancel the transaction regardless of which screen I am viewing it on.

### Acceptance Criteria

#### AC-CANCEL-04.01 — Cancel button on Transaction Detail page
**Given** I am viewing the Transaction Detail page for a transaction with status "Awaiting Payment" and payment method "Manual Bank Transfer"
**When** the page loads
**Then** a "Cancel Transaction" button is displayed prominently on the page (destructive style)

#### AC-CANCEL-04.02 — Cancel button hidden for non-cancellable transactions on detail page
**Given** I am viewing the Transaction Detail page for a transaction that does not have status "Awaiting Payment"
**When** the page loads
**Then** no "Cancel Transaction" button is displayed

#### AC-CANCEL-04.03 — Same confirmation flow on detail page
**Given** I am on the Transaction Detail page and I tap the "Cancel Transaction" button
**When** the button is tapped
**Then** the same cancellation confirmation modal as described in US-CANCEL-02 is displayed
**And** the same confirmation, abort, success, and error flows apply

#### AC-CANCEL-04.04 — Detail page state after successful cancellation
**Given** I have successfully cancelled a transaction from the Transaction Detail page
**When** the cancellation is complete
**Then** the transaction status on the detail page updates to "Cancelled"
**And** the "Cancel Transaction" button is removed
**And** a success toast is displayed
**And** the 30-minute payment window timer (if displayed) stops and is replaced with a "Transaction Cancelled" indicator

#### AC-CANCEL-04.05 — Bank Transfer Details page state after cancellation
**Given** I have cancelled a transaction that was awaiting Manual Bank Transfer payment
**When** I navigate to the Bank Transfer Details page for that transaction (e.g. via a link or direct URL)
**Then** the payment details and timer are not shown
**And** a clear message is displayed: "This transaction has been cancelled."
**And** a "Back to Dashboard" link or button is displayed

---

## US-CANCEL-05: Cancel Button Absence for Non-Cancellable Statuses

**As a** sender,
**I want** to clearly understand which transactions cannot be cancelled,
**So that** I do not waste time looking for a cancel option that does not exist.

### Acceptance Criteria

#### AC-CANCEL-05.01 — No cancel for immediately processed payment methods
**Given** I am on the Dashboard and the Recent Transactions table contains a transaction created via Instant Pay By Bank
**When** I view the Actions column
**Then** no "Cancel" button is displayed, regardless of the transaction status

#### AC-CANCEL-05.02 — No cancel for Card payment transactions
**Given** I am on the Dashboard and the Recent Transactions table contains a transaction created via Card payment
**When** I view the Actions column
**Then** no "Cancel" button is displayed, regardless of the transaction status

#### AC-CANCEL-05.03 — No cancel for Wallet payment transactions
**Given** I am on the Dashboard and the Recent Transactions table contains a transaction created via Wallet payment
**When** I view the Actions column
**Then** no "Cancel" button is displayed, regardless of the transaction status

#### AC-CANCEL-05.04 — Status-based cancel restriction verified server-side
**Given** a malicious or erroneous API request is sent to cancel a transaction that is not in "Awaiting Payment" status
**When** the server receives the cancellation request
**Then** the server rejects the request with an appropriate error response (HTTP 422 or 409)
**And** the transaction status remains unchanged

#### AC-CANCEL-05.05 — Payment method-based cancel restriction verified server-side
**Given** a malicious or erroneous API request is sent to cancel a transaction whose payment method is not "Manual Bank Transfer"
**When** the server receives the cancellation request
**Then** the server rejects the request with an appropriate error response (HTTP 422 or 409)
**And** the transaction status remains unchanged

---

## US-CANCEL-06: Post-Cancellation State Persistence

**As a** sender,
**I want** the cancelled status to persist correctly across page refreshes, navigation, and re-login,
**So that** I always see the accurate state of my transactions.

### Acceptance Criteria

#### AC-CANCEL-06.01 — Cancelled status persists on page refresh
**Given** I have cancelled a transaction and the status shows "Cancelled" in the table
**When** I refresh the browser page (F5 or pull-to-refresh on mobile)
**Then** the transaction still displays the status "Cancelled"
**And** no "Cancel" button is shown for that transaction

#### AC-CANCEL-06.02 — Cancelled status persists on navigation
**Given** I have cancelled a transaction on the Dashboard
**When** I navigate away to another page and then return to the Dashboard
**Then** the transaction still displays the status "Cancelled"
**And** no "Cancel" button is shown for that transaction

#### AC-CANCEL-06.03 — Cancelled status persists across sessions
**Given** I have cancelled a transaction
**When** I log out and log back in
**Then** the transaction displays the status "Cancelled" in the Recent Transactions table
**And** no "Cancel" button is shown for that transaction

#### AC-CANCEL-06.04 — Cancelled transaction in transaction history/filters
**Given** I have cancelled a transaction
**When** I filter or search transactions by status "Cancelled" (if filtering is available)
**Then** the cancelled transaction appears in the filtered results with the correct status and details

#### AC-CANCEL-06.05 — Real-time consistency across tabs
**Given** I have the Dashboard open in two browser tabs
**When** I cancel a transaction in Tab 1
**And** I refresh or revisit Tab 2
**Then** Tab 2 reflects the transaction as "Cancelled" upon the next data fetch

---

## Appendix: Edge Cases and Boundary Conditions

| Scenario | Expected Behaviour |
|----------|-------------------|
| User cancels during the last seconds of the 30-minute payment window | If the timer expires before the API processes the cancellation, the server determines the final state; the UI reflects whatever the server returns |
| Network disconnects after user taps "Yes, Cancel Transaction" | The modal shows an error message; user can retry when connectivity is restored |
| Two users on the same account cancel simultaneously | Server enforces idempotency; only the first request succeeds, the second receives a "status already changed" response |
| Transaction status changes server-side while modal is open | Upon API call, the server rejects with a status conflict; the modal displays an appropriate message and refreshes the row |
| User navigates away while cancellation API is in-flight | The API call completes in the background; upon return, the transaction reflects the final state |

---

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Cancellation API response time | p95 < 500ms |
| Modal render time | < 100ms after button tap |
| Accessibility | WCAG 2.2 Level AA compliant (focus management, screen reader announcements, keyboard navigation, colour contrast) |
| Email notification delivery | Within 2 minutes of successful cancellation |
| Server-side validation | All cancellation rules enforced server-side; client-side visibility is a UX convenience, not a security boundary |
