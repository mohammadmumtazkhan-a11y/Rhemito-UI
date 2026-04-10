# Rhemito Notification System — Requirements

**Date:** 2026-04-10
**Sprint:** TBD (to be assigned by delivery-orchestrator)
**Status:** APPROVED
**Approved by:** Product Owner
**Design Directive:** Premium, world-class UI/UX, mobile-first across all device screens

---

## Vision

Rhemito's notification system keeps customers informed at every stage of their money transfer journey through four coordinated channels — in-app bell, web push, mobile push, and email. The system must feel premium, timely, and trustworthy. Every notification must serve a clear purpose: either confirming an action, prompting a required step, or warning of an issue. The experience is designed mobile-first and scaled up to larger screens.

---

## Notification Channels

| # | Channel | Description | Signature |
|---|---------|-------------|-----------|
| 1 | **In-App Bell** | Notification centre/panel accessible via bell icon in the app header. Badge shows unread count. | No signature |
| 2 | **Web Browser Push** | Browser push notifications for desktop/mobile web users who grant permission. | No signature |
| 3 | **Mobile Push** | Native push notifications on iOS and Android. | No signature |
| 4 | **Email** | Transactional emails for important events. | "Thank you for using Rhemito,\nThe Rhemito Team" |

---

## Users

| Persona | Description | Primary Goal |
|---------|-------------|--------------|
| Sender | Registered Rhemito customer sending money | Stay informed about transaction status in real time |
| Compliance Admin | Internal staff reviewing flagged transactions | Trigger review/document-request notifications |
| System | Automated processes (auto-cancel, maintenance) | Deliver system-generated alerts reliably |

---

## Compliance Requirements

| Regulation | Applies | Key Requirements |
|-----------|---------|-----------------|
| GDPR | Yes | Explicit opt-in for marketing notifications; transactional notifications permitted under legitimate interest; right to modify preferences; data retention limits enforced |
| PECR (UK) | Yes | Push notification permission must be explicitly granted; easy unsubscribe for non-critical emails |
| WCAG 2.2 AA | Yes | All notification UI accessible — screen reader announcements, keyboard navigation, sufficient contrast, touch targets >= 44x44px |
| App Store Guidelines | Yes (future) | Push permission request must explain value; no spammy notifications |
| Google Play Policy | Yes (future) | Notification channels categorised; respect system notification settings |

---

## Critical Notification Behaviour

The following rules apply globally to all **critical** notifications (payment failures, refund processing, admin cancellations, auto-cancellations, compliance holds, document requests):

1. **Cannot be fully disabled** — user may turn off non-critical notifications but critical ones always deliver
2. **Bypass quiet hours** — critical notifications ignore the user's quiet hours setting
3. **Fallback channel always attempted** — if the primary channel fails, the system attempts the next fallback channel before giving up

---

## User Stories & Acceptance Criteria

---

### US-001: Notification Preference Management

**As a** registered customer, **I want to** manage my notification preferences per channel and event type **so that** I control how and when I am contacted.

**Acceptance Criteria:**
- User can toggle each notification channel (in-app, web push, mobile push, email) independently per event category
- Event categories: Payments, Transactions, Security, Promotions, System
- Quiet hours: user sets a daily time window (e.g., 22:00–07:00) during which non-critical notifications are held and delivered when quiet hours end
- Critical notifications (failures, cancellations, compliance) cannot be disabled and bypass quiet hours
- Default preferences are set automatically during onboarding (all channels enabled, no quiet hours)
- Every preference change is audit-logged with timestamp, previous value, and new value
- Preference screen is mobile-first: clean, grouped by category, toggle-based UI

---

### US-002: Payment Successful

**As a** sender, **I want to** be notified immediately when my payment is received **so that** I know my money is being processed.

**Acceptance Criteria:**
- Trigger: payment gateway webhook confirms successful charge
- Latency SLAs: in-app <= 5 seconds, push <= 10 seconds, email <= 60 seconds
- Content minimum: transaction ID, amount paid, recipient name, exchange rate, recipient amount, payment method
- All four channels fire (subject to user preferences)
- In-app notification deep-links to transaction detail page

**Notification Copy:**

| Channel | Copy |
|---------|------|
| In-App | "Payment of {{Amount_Paid}} for {{Recipient_Name}} received. TXN: {{TXN_ID}}" |
| Web Push | "Payment Received — {{Amount_Paid}} to {{Recipient_Name}} ({{TXN_ID}})" |
| Mobile Push | "Payment Received — {{Amount_Paid}} to {{Recipient_Name}} ({{TXN_ID}})" |
| Email Subject | "Your Payment of {{Amount_Paid}} Has Been Received — {{TXN_ID}}" |

---

### US-002A: Awaiting Payment (Manual Bank Transfer)

**As a** sender who chose bank transfer, **I want to** receive a notification with payment instructions and deadline **so that** I can complete the transfer before auto-cancellation.

**Acceptance Criteria:**
- Trigger: transaction created with payment method = Manual Bank Transfer
- Content minimum: transaction ID, amount to pay, bank details (sort code, account number, reference), expiry deadline (date + time), countdown indicator
- CTA deep-links to the Manual Bank Transfer payment page
- In-app and push fire immediately; email within 60 seconds
- Notification clearly states the 30-minute payment window

**Notification Copy:**

| Channel | Copy |
|---------|------|
| In-App | "Action Required: Complete your bank transfer of {{Amount_Paid}} by {{Expiry_Time_Date}}. TXN: {{TXN_ID}}" |
| Web Push | "Action Required — Transfer {{Amount_Paid}} by {{Expiry_Time_Date}} ({{TXN_ID}})" |
| Mobile Push | "Action Required — Transfer {{Amount_Paid}} by {{Expiry_Time_Date}} ({{TXN_ID}})" |
| Email Subject | "Complete Your Bank Transfer — {{Amount_Paid}} Due by {{Expiry_Time_Date}}" |

---

### US-003: Payment Failed

**As a** sender, **I want to** be notified immediately when my payment fails with a clear reason and next steps **so that** I can retry or choose another method.

**Acceptance Criteria:**
- Trigger: payment gateway webhook returns failure/decline
- Failure reason mapped to user-friendly message (e.g., "insufficient funds" -> "Your card was declined due to insufficient funds")
- CTA: "Retry Payment" deep-links to payment method selection
- All four channels fire; marked as critical (bypasses quiet hours, cannot be disabled)
- Latency SLAs: in-app <= 5 seconds, push <= 10 seconds, email <= 60 seconds

**Notification Copy:**

| Channel | Copy |
|---------|------|
| In-App | "Payment Failed: {{Failure_Reason}}. Tap to retry. TXN: {{TXN_ID}}" |
| Web Push | "Payment Failed — {{Failure_Reason}} ({{TXN_ID}}). Click to retry." |
| Mobile Push | "Payment Failed — {{Failure_Reason}} ({{TXN_ID}}). Tap to retry." |
| Email Subject | "Payment Failed for Transaction {{TXN_ID}} — Action Required" |

---

### US-004: Transaction Successful (Delivered)

**As a** sender, **I want to** be notified when my money has been delivered to the recipient **so that** I have confirmation the transfer is complete.

**Acceptance Criteria:**
- Trigger: PSP (payout service provider) webhook confirms delivery
- Content minimum: transaction ID, recipient name, recipient amount, payout method, delivery timestamp
- All four channels fire (subject to user preferences)
- In-app deep-links to transaction detail showing full delivery timeline

**Notification Copy:**

| Channel | Copy |
|---------|------|
| In-App | "Delivered! {{Recipient_Amount}} sent to {{Beneficiary_Name}}. TXN: {{TXN_ID}}" |
| Web Push | "Money Delivered — {{Recipient_Amount}} to {{Beneficiary_Name}} ({{TXN_ID}})" |
| Mobile Push | "Money Delivered — {{Recipient_Amount}} to {{Beneficiary_Name}} ({{TXN_ID}})" |
| Email Subject | "Your Transfer to {{Beneficiary_Name}} Has Been Delivered — {{TXN_ID}}" |

---

### US-005: Transaction Failed at PSP

**As a** sender, **I want to** be notified when the payout fails with refund information **so that** I know my money is safe and what happens next.

**Acceptance Criteria:**
- Trigger: PSP webhook returns payout failure
- System automatically creates a refund job with ETA
- Failure reason mapped to user-friendly message
- Content minimum: transaction ID, failure reason, refund amount, refund ETA, refund method
- Guidance CTA: "View Refund Status" deep-links to transaction detail
- Marked as critical notification

**Notification Copy:**

| Channel | Copy |
|---------|------|
| In-App | "Payout Failed: {{Failure_Reason}}. A refund of {{Refund_Amount}} is being processed ({{Refund_ETA}}). TXN: {{TXN_ID}}" |
| Web Push | "Payout Failed — Refund of {{Refund_Amount}} processing ({{TXN_ID}})" |
| Mobile Push | "Payout Failed — Refund of {{Refund_Amount}} processing ({{TXN_ID}})" |
| Email Subject | "Payout Failed — Refund in Progress for {{TXN_ID}}" |

---

### US-006: Admin Cancellation

**As a** sender, **I want to** be notified when an admin cancels my transaction with a reason and refund details **so that** I understand what happened and can seek support.

**Acceptance Criteria:**
- Trigger: admin cancels transaction via back-office (audit-logged with admin ID, reason, timestamp)
- If payment was already collected, refund is auto-initiated
- Content minimum: transaction ID, admin reason, refund amount (if applicable), refund ETA, support ticket deep link
- CTA: "Contact Support" deep-links to help/support page with pre-filled context
- SLA: notification delivered within 2 minutes of cancellation
- Marked as critical notification

**Notification Copy:**

| Channel | Copy |
|---------|------|
| In-App | "Transaction {{TXN_ID}} cancelled: {{Admin_Reason}}. Refund of {{Refund_Amount}} in progress ({{Refund_ETA}}). Tap for support." |
| Web Push | "Transaction Cancelled — {{TXN_ID}}. {{Admin_Reason}}. Refund processing." |
| Mobile Push | "Transaction Cancelled — {{TXN_ID}}. {{Admin_Reason}}. Refund processing." |
| Email Subject | "Your Transaction {{TXN_ID}} Has Been Cancelled" |

---

### US-007: Auto-Cancel for Bank Transfer (30-Minute Window)

**As a** sender who chose bank transfer, **I want to** receive reminders before auto-cancellation and a final notice if cancelled **so that** I have every chance to complete payment.

**Acceptance Criteria:**
- Payment window: **30 minutes** from transaction creation
- Reminder 1: sent when **15 minutes remain** — "You have 15 minutes to complete your payment"
- Reminder 2: sent when **5 minutes remain** — "Only 5 minutes left! Complete your payment now"
- Auto-cancel: fires at exactly 30 minutes if payment not received
- Auto-cancel notification confirms cancellation and states refund status (if partial payment received)
- Reminders include {{Countdown_Timer}} placeholder for dynamic time remaining
- Reminders fire on in-app and push channels; auto-cancel fires on all four channels
- All auto-cancel notifications are critical (bypass quiet hours)

**Notification Copy:**

| Channel | Copy |
|---------|------|
| **15-min Reminder** | |
| In-App | "Reminder: {{Countdown_Timer}} left to complete your bank transfer of {{Amount_Paid}}. TXN: {{TXN_ID}}" |
| Web Push | "15 Minutes Left — Complete your {{Amount_Paid}} transfer ({{TXN_ID}})" |
| Mobile Push | "15 Minutes Left — Complete your {{Amount_Paid}} transfer ({{TXN_ID}})" |
| **5-min Reminder** | |
| In-App | "Urgent: Only {{Countdown_Timer}} left! Complete your bank transfer of {{Amount_Paid}} now. TXN: {{TXN_ID}}" |
| Web Push | "Only 5 Minutes Left! Complete your {{Amount_Paid}} transfer ({{TXN_ID}})" |
| Mobile Push | "Only 5 Minutes Left! Complete your {{Amount_Paid}} transfer ({{TXN_ID}})" |
| **Auto-Cancel** | |
| In-App | "Transaction {{TXN_ID}} has been automatically cancelled — payment was not received within 30 minutes." |
| Web Push | "Transaction Auto-Cancelled — {{TXN_ID}} (payment window expired)" |
| Mobile Push | "Transaction Auto-Cancelled — {{TXN_ID}} (payment window expired)" |
| Email Subject | "Transaction {{TXN_ID}} Auto-Cancelled — Payment Window Expired" |

---

### US-008: System Maintenance

**As a** customer, **I want to** be notified in advance about scheduled maintenance **so that** I can plan my transactions accordingly.

**Acceptance Criteria:**
- Advance notices sent at: T-3 days, T-1 day, T-2 hours before maintenance window
- Non-dismissible in-app banner displayed during active maintenance window
- Maintenance mode: blocks creation of new transactions (existing in-flight transactions continue)
- Content minimum: maintenance date, start time, end time, timezone, expected impact
- Completion notice sent when maintenance ends — "All systems are back online"
- Maintenance notifications fire on all four channels

**Notification Copy:**

| Channel | Copy |
|---------|------|
| **T-3 Days** | |
| In-App | "Scheduled Maintenance: {{Maintenance_Date}} from {{Maintenance_Start_Time}} to {{Maintenance_End_Time}} ({{Timezone}}). Plan your transfers accordingly." |
| Web Push | "Maintenance Scheduled — {{Maintenance_Date}} {{Maintenance_Start_Time}}–{{Maintenance_End_Time}} ({{Timezone}})" |
| Mobile Push | "Maintenance Scheduled — {{Maintenance_Date}} {{Maintenance_Start_Time}}–{{Maintenance_End_Time}} ({{Timezone}})" |
| Email Subject | "Scheduled Maintenance on {{Maintenance_Date}} — Plan Ahead" |
| **T-1 Day** | |
| In-App | "Reminder: Maintenance tomorrow, {{Maintenance_Date}} from {{Maintenance_Start_Time}} to {{Maintenance_End_Time}} ({{Timezone}})." |
| Web Push | "Maintenance Tomorrow — {{Maintenance_Start_Time}}–{{Maintenance_End_Time}} ({{Timezone}})" |
| Mobile Push | "Maintenance Tomorrow — {{Maintenance_Start_Time}}–{{Maintenance_End_Time}} ({{Timezone}})" |
| Email Subject | "Reminder: Maintenance Tomorrow — {{Maintenance_Date}}" |
| **T-2 Hours** | |
| In-App | "Maintenance begins in 2 hours ({{Maintenance_Start_Time}} {{Timezone}}). Complete any pending transfers now." |
| Web Push | "Maintenance in 2 Hours — Complete pending transfers now" |
| Mobile Push | "Maintenance in 2 Hours — Complete pending transfers now" |
| **Active Maintenance Banner** | |
| In-App (non-dismissible) | "We are currently undergoing maintenance. New transactions are temporarily unavailable. Expected completion: {{Maintenance_End_Time}} ({{Timezone}})." |
| **Completion** | |
| In-App | "Maintenance complete — all systems are back online. Thank you for your patience." |
| Web Push | "Maintenance Complete — All systems are back online" |
| Mobile Push | "Maintenance Complete — All systems are back online" |
| Email Subject | "Maintenance Complete — Rhemito Is Back Online" |

---

### US-009: Delivery Failure Handling

**As the** system, **I need to** handle notification delivery failures with retries and fallbacks **so that** customers receive critical information even when a channel fails.

**Acceptance Criteria:**
- Every notification delivery attempt is tracked with status (pending, sent, delivered, failed)
- On failure: retry with exponential backoff — 3 attempts at 1 minute, 5 minutes, 15 minutes
- After 3 failed retries on a channel, attempt the fallback channel:
  - Email fails -> fall back to in-app
  - Push fails -> fall back to email
  - In-app fails -> fall back to email
- Hard bounce suppression: if an email hard bounces, mark the email address as invalid and stop sending until the user updates their email
- All delivery attempts and fallback events are logged for audit
- Delivery failures for critical notifications trigger an internal alert to the ops team

---

### US-010: Notification History

**As a** customer, **I want to** view my notification history with filters **so that** I can find past notifications and review important information.

**Acceptance Criteria:**
- Chronological list of all notifications, newest first
- Filters: date range, category (Payments, Transactions, Security, System, Promotions), channel, read/unread
- Detail view for each notification showing: full message, timestamp, delivery timeline (sent -> delivered -> read)
- Read/unread status persists across sessions and devices
- Pagination: load 20 notifications per page, infinite scroll or "Load More" button
- Empty state: friendly message when no notifications match the filter
- Mobile-first layout: full-width cards, swipe gestures for mark-read/delete

---

### US-011: Refund Processed

**As a** sender, **I want to** be notified when my refund has been processed with ETA details **so that** I know when to expect the money back.

**Acceptance Criteria:**
- Trigger: payment gateway confirms refund processed
- Content minimum: transaction ID, refund amount, refund method, ETA based on method
- Refund method ETAs:
  - Card: 3–5 business days
  - E-wallet: up to 24 hours
  - Bank transfer: 1–2 business days
- All four channels fire
- CTA deep-links to transaction detail page showing refund status

**Notification Copy:**

| Channel | Copy |
|---------|------|
| In-App | "Refund of {{Refund_Amount}} processed via {{Refund_Method}}. Expected in your account within {{Refund_ETA}}. TXN: {{TXN_ID}}" |
| Web Push | "Refund Processed — {{Refund_Amount}} via {{Refund_Method}} ({{Refund_ETA}})" |
| Mobile Push | "Refund Processed — {{Refund_Amount}} via {{Refund_Method}} ({{Refund_ETA}})" |
| Email Subject | "Your Refund of {{Refund_Amount}} Has Been Processed — {{TXN_ID}}" |

---

### US-012: Transaction Under Review

**As a** sender, **I want to** be notified when my transaction is under compliance review with an ETA **so that** I know my money is safe and the review is temporary.

**Acceptance Criteria:**
- Trigger: compliance system flags transaction for manual review
- Content minimum: transaction ID, reason (generic — "additional verification required"), review ETA
- Tone: reassuring, not alarming — the user should not feel accused
- CTA: "View Status" deep-links to transaction detail
- Completion notification sent when review concludes, including full delivery timeline
- Marked as critical notification

**Notification Copy:**

| Channel | Copy |
|---------|------|
| **Review Started** | |
| In-App | "Transaction {{TXN_ID}} requires additional verification. Estimated review time: {{Review_ETA}}. Your funds are safe." |
| Web Push | "Transaction Under Review — {{TXN_ID}} (est. {{Review_ETA}})" |
| Mobile Push | "Transaction Under Review — {{TXN_ID}} (est. {{Review_ETA}})" |
| Email Subject | "Your Transaction {{TXN_ID}} Is Being Reviewed" |
| **Review Complete** | |
| In-App | "Review complete for {{TXN_ID}}. Your transaction is now being processed." |
| Web Push | "Review Complete — {{TXN_ID}} is now processing" |
| Mobile Push | "Review Complete — {{TXN_ID}} is now processing" |
| Email Subject | "Review Complete — Transaction {{TXN_ID}} Is Now Processing" |

---

### US-013: Document Upload Request (KYC/AML)

**As a** sender, **I want to** be notified when documents are required for verification with a clear deadline **so that** I can upload them before my transaction is cancelled.

**Acceptance Criteria:**
- Trigger: compliance flags transaction requiring additional documents
- Content minimum: document list required, deadline (date + time), transaction ID
- Urgent task creation in notification centre with visual priority indicator
- Reminders at T-24 hours and T-6 hours before deadline
- Upload confirmation notification sent when all documents received
- Auto-cancel notification if deadline missed (transaction cancelled, refund initiated if paid)
- CTA: "Upload Documents" deep-links to document upload page
- Marked as critical notification

**Notification Copy:**

| Channel | Copy |
|---------|------|
| **Initial Request** | |
| In-App | "Documents Required: Please upload {{Document_List}} by {{Document_Deadline}} for TXN {{TXN_ID}}. Tap to upload." |
| Web Push | "Documents Required — Upload by {{Document_Deadline}} ({{TXN_ID}})" |
| Mobile Push | "Documents Required — Upload by {{Document_Deadline}} ({{TXN_ID}})" |
| Email Subject | "Action Required: Upload Documents by {{Document_Deadline}} — {{TXN_ID}}" |
| **T-24h Reminder** | |
| In-App | "Reminder: {{Review_Time_Required}} left to upload {{Document_List}} for TXN {{TXN_ID}}." |
| Web Push | "24 Hours Left — Upload documents for {{TXN_ID}}" |
| Mobile Push | "24 Hours Left — Upload documents for {{TXN_ID}}" |
| **T-6h Reminder** | |
| In-App | "Urgent: Only {{Review_Time_Required}} left! Upload {{Document_List}} now for TXN {{TXN_ID}}." |
| Web Push | "Only 6 Hours Left! Upload documents for {{TXN_ID}}" |
| Mobile Push | "Only 6 Hours Left! Upload documents for {{TXN_ID}}" |
| **Upload Confirmed** | |
| In-App | "Documents received for TXN {{TXN_ID}}. We are now reviewing your submission." |
| Web Push | "Documents Received — {{TXN_ID}} under review" |
| Mobile Push | "Documents Received — {{TXN_ID}} under review" |
| Email Subject | "Documents Received — Review in Progress for {{TXN_ID}}" |
| **Deadline Missed (Auto-Cancel)** | |
| In-App | "Transaction {{TXN_ID}} cancelled — required documents were not uploaded by the deadline. Refund of {{Refund_Amount}} in progress." |
| Web Push | "Transaction Cancelled — Documents not received ({{TXN_ID}})" |
| Mobile Push | "Transaction Cancelled — Documents not received ({{TXN_ID}})" |
| Email Subject | "Transaction {{TXN_ID}} Cancelled — Document Deadline Missed" |

---

### US-014: Notification Retention

**As a** customer, **I want** my notifications to be retained for a reasonable period with clear archival rules **so that** I can reference past notifications without clutter.

**Acceptance Criteria:**
- Active notification list: last **7 days** — shown in the main notification panel
- Archive: notifications older than 7 days moved to archive, retained for **90 days total**
- Archived notifications accessible via "View Archive" link in notification panel
- Pagination in both active and archive views (20 items per page)
- Read/unread status persists across the full 90-day retention period
- Retention info banner displayed at the bottom of the notification panel: "Notifications are kept for 90 days"
- After 90 days, notifications are permanently deleted (GDPR compliance)
- Bulk actions: "Mark all as read" available in both active and archive views

---

## Non-Functional Requirements

### Performance
- In-app notification delivery: p95 < 5 seconds from trigger event
- Push notification delivery: p95 < 10 seconds from trigger event
- Email delivery: p95 < 60 seconds from trigger event
- Notification panel load time: p95 < 500ms
- Notification history with filters: p95 < 1 second

### Accessibility (WCAG 2.2 AA)
- Notification bell: ARIA live region announces new notification count to screen readers
- Notification panel: fully keyboard navigable (Tab, Enter, Escape to close)
- All notification items: minimum contrast ratio 4.5:1 for text, 3:1 for UI components
- Touch targets: minimum 44x44px on all interactive elements
- Motion: respect `prefers-reduced-motion` for panel animations and badge updates
- Text scaling: notification panel and items survive 200% browser zoom without loss of content

### Security
- Notification content never includes full account numbers, sort codes, or sensitive PII in push/web push channels
- Email notifications include masked transaction details only
- Notification preferences changes require active session (authenticated)
- Internal audit log for all notification events is tamper-proof

### Privacy (GDPR / PECR)
- Push notification permission: explicit opt-in with clear explanation of value
- Email notifications for transactional events: permitted under legitimate interest (no opt-in required)
- Marketing/promotional notifications: require explicit opt-in
- Users can export their notification history (data portability)
- Account deletion removes all notification data within 30 days

### Scalability
- System must handle 10,000 concurrent notification deliveries without degradation
- Notification queue must survive service restart (durable queue)

### Reliability
- Notification delivery success rate target: >= 99.5% for in-app, >= 98% for push, >= 97% for email
- Zero data loss: every notification trigger must be persisted before delivery attempt

---

## Design Directive

The following directive applies to ALL notification-related UI work and must be followed by both `uiux-designer` and `frontend-web-engineer`:

1. **Premium, world-class UI/UX** — notification UI must match or exceed the quality of leading fintech apps (Wise, Revolut, Monzo). Every detail matters: typography, spacing, iconography, animation, empty states.

2. **Mobile-first design** — all notification UI is designed for mobile viewport first, then progressively enhanced for tablet and desktop. This applies to:
   - Notification bell icon and badge
   - Notification panel/centre (slide-in or overlay)
   - Individual notification items (cards)
   - Empty states ("No notifications yet")
   - Notification preference screen
   - Notification history and archive views
   - Retention info banner

3. **Responsive breakpoints** — notification UI must be tested and polished at:
   - Mobile: 320px–480px
   - Large mobile: 481px–767px
   - Tablet: 768px–1023px
   - Desktop: 1024px+

4. **Interaction patterns** — premium micro-interactions:
   - Smooth panel open/close animation
   - Badge count update with subtle animation
   - Swipe-to-dismiss or swipe-to-mark-read on mobile
   - Skeleton loading states (never a blank panel)
   - Pull-to-refresh in notification panel on mobile

---

## Out of Scope

| Item | Reason |
|------|--------|
| SMS notifications | Cost-prohibitive for initial launch; revisit post-MVP |
| WhatsApp notifications | Requires Meta Business API approval; deferred to future sprint |
| In-app chat / live support | Separate feature track |
| Notification analytics dashboard (admin) | Phase 2 — after core notification system is stable |
| Marketing/promotional notification content | Requires marketing team input; only the preference toggle is in scope |
| Recipient-facing notifications | Recipients are not Rhemito users in v1 |

---

## Assumptions

1. Payment gateway and PSP webhooks are available and reliable for triggering notifications
2. Firebase Cloud Messaging (or equivalent) will be used for mobile push; Web Push API for browser push
3. Email delivery via a transactional email provider (e.g., SendGrid, Postmark, SES)
4. The existing session-based auth system will be used to secure notification endpoints
5. Notification preferences are per-user, not per-device
6. All timestamps displayed to users are localised to their timezone

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Push notification permission denial rate > 50% | Medium | Medium | Explain value before requesting permission; time the request after first successful transaction |
| Email deliverability issues (spam filters) | Medium | High | Use authenticated domain (SPF, DKIM, DMARC); warm up sending domain; monitor bounce rates |
| Webhook delays from payment gateway | Low | High | Implement polling fallback for critical payment status checks |
| Notification fatigue (too many notifications) | Medium | Medium | Smart batching for non-critical notifications; clear preference controls |
| 30-minute auto-cancel too aggressive | Low | Medium | Monitor cancellation rates; consider extending to 45 minutes if drop-off is high |

---

## Success Metrics

| Metric | Target | How Measured | Frequency |
|--------|--------|-------------|-----------|
| In-app notification delivery p95 latency | < 5 seconds | Application performance monitoring | Daily |
| Push notification opt-in rate | > 60% | Analytics event tracking | Weekly |
| Email open rate (transactional) | > 70% | Email provider analytics | Weekly |
| Notification preference completion rate | > 80% of users customise at least one setting | Analytics event tracking | Monthly |
| Notification-driven return rate | > 30% of users tap a notification CTA within 24h | Deep link tracking | Weekly |
| Delivery success rate (all channels) | >= 99% aggregate | Notification delivery logs | Daily |

---

## MoSCoW Prioritisation

### Must Have (launch blockers)
1. US-001 — Notification Preference Management (foundation for all other stories)
2. US-002 — Payment Successful
3. US-002A — Awaiting Payment (Bank Transfer)
4. US-003 — Payment Failed
5. US-004 — Transaction Successful (Delivered)
6. US-005 — Transaction Failed at PSP
7. US-007 — Auto-Cancel for Bank Transfer (30-minute window)
8. US-009 — Delivery Failure Handling (retry + fallback)
9. US-014 — Notification Retention (7-day active + 90-day archive)

### Should Have (important, not blocking launch)
10. US-006 — Admin Cancellation
11. US-010 — Notification History (filters + detail view)
12. US-011 — Refund Processed
13. US-012 — Transaction Under Review
14. US-013 — Document Upload Request (KYC/AML)

### Could Have (if time allows)
15. US-008 — System Maintenance (advance notices + banner)

### Won't Have (deferred)
- SMS channel — cost; revisit post-launch
- WhatsApp channel — Meta API approval required
- Admin notification analytics dashboard — Phase 2
- Recipient-facing notifications — recipients are not Rhemito users in v1

---

## Glossary

| Term | Definition |
|------|------------|
| PSP | Payout Service Provider — the partner that delivers funds to the recipient's account |
| Webhook | HTTP callback from an external service (payment gateway, PSP) that triggers notifications |
| Hard bounce | A permanent email delivery failure (e.g., address does not exist) |
| Quiet hours | A user-defined time window during which non-critical notifications are held |
| Critical notification | A notification that cannot be disabled and bypasses quiet hours |
| Fallback channel | An alternative notification channel attempted when the primary channel fails |
| Deep link | A URL that opens the app directly to a specific page/screen |
| Exponential backoff | Progressively increasing delay between retry attempts (1m, 5m, 15m) |

---

*Document version: 1.0 — Approved 2026-04-10*
