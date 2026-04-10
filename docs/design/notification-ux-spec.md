# Notification System -- Complete UX Design Specification

**Designer:** uiux-designer
**Date:** 2026-04-10
**Status:** AWAITING APPROVAL
**Benchmarks:** Wise, Revolut, Monzo, Linear, Stripe

---

## Design Philosophy

The Rhemito notification system follows a "calm confidence" design language. Notifications inform without alarming, guide without nagging, and celebrate without distracting. Every element earns its place on screen. The visual language borrows from:

- **Monzo** -- real-time transaction narrative with high-contrast status labels
- **Revolut** -- clean card-based layout, generous white space, vibrant but restrained accent colours
- **Linear** -- minimal dropdown panel, disciplined typography, smooth motion
- **Stripe** -- systematic icon-colour mapping, structured information hierarchy

---

## Design Tokens Reference

All specs reference these project CSS variables. Never use raw colour values.

```
--primary: 217 91% 60%            Blue (brand)
--primary-foreground: 0 0% 100%   White on blue
--destructive: 0 84% 60%          Red (errors, failures)
--destructive-foreground: 0 0% 100%
--teal: 168 76% 42%               Teal (success)
--teal-foreground: 0 0% 100%
--purple: 258 90% 66%             Purple (accent, info)
--purple-foreground: 0 0% 100%
--background: 210 20% 98%         Page bg
--foreground: 222 47% 11%         Primary text
--card: 0 0% 100%                 Card/surface
--card-foreground: 222 47% 11%
--muted: 210 40% 96%              Muted bg
--muted-foreground: 215 16% 47%   Secondary text
--border: 214 32% 91%             Borders
--ring: 217 91% 60%               Focus ring
--radius: 0.75rem                 Base radius (12px)
--font-display: 'Plus Jakarta Sans'
--font-sans: 'Inter'

Additional semantic tokens (to be added to index.css):
--amber: 38 92% 50%               Amber (warnings, pending)
--amber-foreground: 0 0% 100%
```

**Note on Amber:** The project currently lacks an amber token. This spec requires adding `--amber: 38 92% 50%` and `--amber-foreground: 0 0% 100%` to the theme. This is the only new colour introduced and it is necessary for the warning/pending state -- a standard fintech convention (Wise, Revolut, and Monzo all use amber/yellow for pending states).

---

## Screen 1: Bell Badge (Header)

### Layout

The bell icon lives in the existing `Header.tsx` component, replacing the current static bell + red dot.

| Property | Value |
|----------|-------|
| Container | `button`, 40x40px (mobile) / 40x40px (desktop) |
| Icon | Lucide `Bell`, 20x20px, `text-muted-foreground` |
| Padding | 8px (p-2) |
| Border radius | `var(--radius)` (0.75rem) |
| Touch target | 40x40px min (meets 44px with padding/margin) |

### Badge States

**Zero unread -- no badge**
- Bell icon only, `text-muted-foreground`
- No dot, no badge, no indicator

**1-9 unread -- numeric pill badge**
- Position: absolute, top: -2px, right: -2px
- Size: 18px height, min-width 18px, padding 0 5px
- Background: `hsl(var(--destructive))`
- Text: 11px / font-weight 700 / `hsl(var(--destructive-foreground))`
- Font: `var(--font-sans)` (Inter)
- Border: 2px solid `hsl(var(--card))` (white ring to separate from bg)
- Border radius: 9999px (full pill)
- Content: the number (e.g., "3")

**10+ unread -- capped badge**
- Same styling as above
- Content: "9+"
- Min-width: 22px (wider for two chars)

### Interaction States

| State | Style |
|-------|-------|
| Default | `bg-transparent`, icon `text-muted-foreground` |
| Hover | `bg-muted`, icon `text-foreground`, transition 150ms ease |
| Active/pressed | `bg-muted` scale(0.95), transition 100ms ease |
| Panel open | `bg-primary/10`, icon `text-primary` |
| Focus visible | `ring-2 ring-ring ring-offset-2 ring-offset-background`, outline none |
| Disabled | Not applicable -- bell is always active |

### Badge Entrance Animation

- Trigger: when unread count changes from 0 to > 0
- Animation: scale from 0 to 1.2 to 1.0
- Duration: 300ms
- Easing: cubic-bezier(0.34, 1.56, 0.64, 1) (spring overshoot)
- `prefers-reduced-motion`: skip scale animation, badge appears instantly with `opacity 0 -> 1` over 150ms

### Badge Count Update Animation

- Trigger: when unread count changes (but stays > 0)
- Animation: badge scales to 1.15 then back to 1.0
- Duration: 200ms
- Easing: ease-out

### Accessibility

- `aria-label`: "Notifications, {count} unread" (dynamic)
- When count is 0: `aria-label`: "Notifications"
- Role: `button`
- The badge count is announced via `aria-live="polite"` on a visually-hidden span near the bell
- Keyboard: Enter/Space opens notification panel

---

## Screen 2: Notification Panel

### Responsive Strategy

- **Mobile (< 640px):** Bottom sheet (using `Drawer` from vaul, already installed)
- **Desktop (>= 640px):** Dropdown popover anchored to bell icon

---

### 2A: Mobile Bottom Sheet (< 640px)

| Property | Value |
|----------|-------|
| Container | Drawer (vaul) |
| Max height | 85vh |
| Background | `hsl(var(--card))` |
| Border radius | 16px 16px 0 0 (top corners) |
| Backdrop | `bg-black/60` |
| Z-index | 50 |

**Drag Handle**
- Width: 36px, height: 4px
- Background: `hsl(var(--muted-foreground) / 0.3)`
- Border radius: 9999px
- Centered, margin top: 8px, margin bottom: 4px

**Panel Header**
- Padding: 16px 16px 12px
- Border bottom: 1px solid `hsl(var(--border))`
- Layout: flex, justify-between, align-center
- Title: "Notifications" -- font-display, 18px/1.3, font-weight 700, `text-foreground`
- "Mark all read" button: font-sans, 13px, font-weight 500, `text-primary`, no bg, padding 6px 10px, border-radius var(--radius-sm), hover `bg-primary/5`
  - Only visible when unread count > 0
  - Touch target: min 44x44px (achieved via padding)

**Retention Info Banner**
- Position: below header, above notification list
- Padding: 8px 16px
- Background: `hsl(var(--muted))`
- Text: "Notifications available for 7 days, then archived" -- font-sans, 12px/1.4, font-weight 400, `text-muted-foreground`
- Icon: `Info` (Lucide), 14px, `text-muted-foreground`, inline left of text
- Border bottom: 1px solid `hsl(var(--border))`

**Notification List Area**
- Padding: 0
- Overflow-y: auto, custom scrollbar
- Max height: calc(85vh - header - footer - banner)
- Each item separated by 1px `hsl(var(--border))` divider

**Panel Footer**
- Padding: 12px 16px
- Border top: 1px solid `hsl(var(--border))`
- Background: `hsl(var(--card))`
- Position: sticky bottom
- CTA: "View Archived Notifications" -- centered text link
  - Font: font-sans, 13px, font-weight 500, `text-primary`
  - Icon: `Archive` (Lucide), 14px, inline left, gap 6px
  - Padding: 10px, full width
  - Hover: `bg-primary/5`, border-radius var(--radius-sm)

**Entrance Animation (Mobile)**
- Drawer slides up from bottom
- Duration: 350ms
- Easing: cubic-bezier(0.32, 0.72, 0, 1) (iOS-like spring)
- Backdrop fades in: 200ms ease
- `prefers-reduced-motion`: no slide, opacity 0 to 1 over 200ms

**Exit Animation (Mobile)**
- Drawer slides down
- Duration: 250ms
- Easing: ease-in
- Backdrop fades out: 150ms
- Dismiss: drag down past 30% threshold, or tap backdrop

---

### 2B: Desktop Dropdown (>= 640px)

| Property | Value |
|----------|-------|
| Width | 380px |
| Max height | 480px |
| Background | `hsl(var(--card))` |
| Border | 1px solid `hsl(var(--border))` |
| Border radius | `var(--radius-lg)` (0.75rem) |
| Shadow | `var(--shadow-lg)` |
| Z-index | 50 |
| Anchor | Right-aligned to bell icon, 8px gap below |

**Panel Header** -- same spec as mobile, padding 16px

**Retention Info Banner** -- same spec as mobile

**Notification List Area**
- Overflow-y: auto, custom scrollbar (project's thin scrollbar)
- Max height: calc(480px - header - footer - banner)

**Panel Footer** -- same spec as mobile

**Entrance Animation (Desktop)**
- Origin: top-right (from bell position)
- Transform: translateY(-8px) + opacity 0 to translateY(0) + opacity 1
- Duration: 200ms
- Easing: ease-out
- `prefers-reduced-motion`: opacity only, 150ms

**Exit Animation (Desktop)**
- Reverse of entrance
- Duration: 150ms
- Easing: ease-in

**Click Outside to Close:** Yes
**Escape key to Close:** Yes
**Focus trap:** Yes, focus cycles through panel items when open

---

## Screen 3: Notification Item

### Item Anatomy

Each notification item follows this consistent layout:

```
+------------------------------------------------------------------+
|  [Icon]   Title Text                      [Timestamp]  [Dismiss] |
|  (40px)   Body copy text that can wrap                           |
|           to two lines maximum...                                |
+------------------------------------------------------------------+
```

| Property | Value |
|----------|-------|
| Padding | 14px 16px |
| Min height | 72px |
| Gap (icon to content) | 12px |
| Layout | flex, align-start |
| Separator | 1px solid `hsl(var(--border))` bottom |
| Cursor | pointer (entire item is tappable, deep-links) |

### Icon Container

| Property | Value |
|----------|-------|
| Size | 36px x 36px |
| Border radius | var(--radius) (0.75rem / 12px) |
| Display | flex, items-center, justify-center |
| Icon size | 18px x 18px |
| Flex shrink | 0 |

The icon container background uses a 10% opacity tint of the notification's semantic colour:

| Colour Category | Container Background | Icon Colour |
|----------------|---------------------|-------------|
| Destructive (red) | `hsl(var(--destructive) / 0.1)` | `hsl(var(--destructive))` |
| Teal (green) | `hsl(var(--teal) / 0.1)` | `hsl(var(--teal))` |
| Amber (warning) | `hsl(var(--amber) / 0.1)` | `hsl(var(--amber))` |
| Purple (accent) | `hsl(var(--purple) / 0.1)` | `hsl(var(--purple))` |

### Content Area

| Property | Value |
|----------|-------|
| Title | font-sans (Inter), 13px/1.4, font-weight 600, `text-foreground` |
| Body | font-sans (Inter), 13px/1.5, font-weight 400, `text-muted-foreground` |
| Body max lines | 2 (line-clamp-2) |
| Timestamp | font-sans, 12px/1.3, font-weight 400, `text-muted-foreground` |
| Timestamp position | absolute top-right of content area, or flex end |

### Timestamp Display Rules

- < 1 min: "Just now"
- 1-59 min: "Xm ago"
- 1-23 hours: "Xh ago"
- 1-6 days: "Xd ago"
- 7+ days: "DD MMM" (e.g., "10 Apr")

### Dismiss Button

| Property | Value |
|----------|-------|
| Icon | Lucide `X`, 14px |
| Container | 28x28px, rounded-full |
| Position | top-right of item, shown on hover (desktop) or always visible (mobile) |
| Colour | `text-muted-foreground` |
| Hover | `bg-muted`, `text-foreground` |
| Opacity (desktop) | 0 by default, 1 on item hover |
| Touch target | 44x44px (padding extends hit area) |

### Unread vs Read States

| State | Left indicator | Background | Title weight |
|-------|---------------|------------|-------------|
| Unread | 3px solid `hsl(var(--primary))` left border | `hsl(var(--primary) / 0.03)` | font-weight 600 |
| Read | No left border | `transparent` | font-weight 500 |

Transition between states: background-color 200ms ease.

### Hover State (Desktop only)

- Background: `hsl(var(--muted) / 0.5)`
- Transition: 150ms ease
- Dismiss button fades in

### Urgent Item Variant

For urgent notifications (Document Upload Required, 5-min Payment Reminder):
- Left border: 3px solid `hsl(var(--destructive))` (instead of primary)
- Background (unread): `hsl(var(--destructive) / 0.03)`
- An "Urgent" micro-badge appears next to the title:
  - Text: "Urgent"
  - Font: 10px, font-weight 700, uppercase, letter-spacing 0.05em
  - Background: `hsl(var(--destructive) / 0.1)`
  - Colour: `hsl(var(--destructive))`
  - Padding: 1px 6px
  - Border-radius: 4px

---

### Notification Type Mapping Table

| Notification Type | Lucide Icon | Colour Category | Icon Container Bg | Title Pattern | Body Pattern |
|-------------------|-------------|-----------------|-------------------|---------------|--------------|
| Transaction Cancelled (user) | `XCircle` | Destructive | `destructive/0.1` | "Transaction Cancelled" | "Your transaction {TXN_ID} has been cancelled." |
| Payment Received | `CheckCircle2` | Teal | `teal/0.1` | "Payment Received" | "Payment of {Amount} for {Recipient} received. TXN: {TXN_ID}" |
| Awaiting Payment | `Clock` | Amber | `amber/0.1` | "Action Required" | "Complete your bank transfer of {Amount} by {Expiry}. TXN: {TXN_ID}" |
| Payment Failed | `AlertTriangle` | Destructive | `destructive/0.1` | "Payment Failed" | "{Failure_Reason}. Tap to retry. TXN: {TXN_ID}" |
| Transaction Complete | `CheckCircle2` | Teal | `teal/0.1` | "Money Delivered" | "{Amount} sent to {Beneficiary}. TXN: {TXN_ID}" |
| Transaction Failed PSP | `XCircle` | Destructive | `destructive/0.1` | "Payout Failed" | "{Failure_Reason}. Refund of {Amount} processing ({ETA}). TXN: {TXN_ID}" |
| Admin Cancellation | `ShieldAlert` | Destructive | `destructive/0.1` | "Transaction Cancelled" | "{Admin_Reason}. Refund of {Amount} in progress. TXN: {TXN_ID}" |
| Auto-Cancel Timeout | `Clock` | Amber | `amber/0.1` | "Transaction Auto-Cancelled" | "Payment was not received within 30 minutes. TXN: {TXN_ID}" |
| Maintenance Scheduled | `Wrench` | Purple | `purple/0.1` | "Scheduled Maintenance" | "{Date} from {Start} to {End} ({TZ}). Plan your transfers accordingly." |
| Maintenance Complete | `Wrench` | Teal | `teal/0.1` | "Maintenance Complete" | "All systems are back online." |
| Refund Processed | `ArrowLeftRight` | Teal | `teal/0.1` | "Refund Processed" | "Refund of {Amount} via {Method}. Expected within {ETA}. TXN: {TXN_ID}" |
| Under Review | `Eye` | Purple | `purple/0.1` | "Transaction Under Review" | "Additional verification required. Est. review: {ETA}. Your funds are safe." |
| Review Complete | `Eye` | Teal | `teal/0.1` | "Review Complete" | "Your transaction is now being processed. TXN: {TXN_ID}" |
| Document Upload Required | `Upload` | Amber (Urgent) | `amber/0.1` | "Documents Required" | "Upload {Doc_List} by {Deadline}. TXN: {TXN_ID}" |
| KYC Complete | `Shield` | Teal | `teal/0.1` | "Verification Complete" | "Your identity verification is complete." |
| Payment Reminder 15min | `Clock` | Amber | `amber/0.1` | "Payment Reminder" | "{Time} left to complete your bank transfer of {Amount}. TXN: {TXN_ID}" |
| Payment Reminder 5min | `Clock` | Destructive (Urgent) | `destructive/0.1` | "Urgent: Payment Expiring" | "Only {Time} left! Complete your transfer of {Amount} now. TXN: {TXN_ID}" |
| Documents Received | `Upload` | Teal | `teal/0.1` | "Documents Received" | "We are now reviewing your submission. TXN: {TXN_ID}" |
| Doc Deadline Missed | `Upload` | Destructive | `destructive/0.1` | "Transaction Cancelled" | "Required documents not uploaded by deadline. Refund of {Amount} in progress." |

---

## Screen 4: Empty State (Active Notifications)

### Layout

Centred within the notification panel content area.

| Property | Value |
|----------|-------|
| Container | flex column, items-center, justify-center, min-height 280px |
| Padding | 32px 24px |

### Elements

**Icon**
- Lucide `BellOff`, 48px
- Colour: `hsl(var(--muted-foreground) / 0.3)`
- Margin bottom: 16px

**Title**
- "All caught up"
- Font: font-display, 18px/1.3, font-weight 700, `text-foreground`
- Margin bottom: 6px

**Body**
- "You have no new notifications."
- Font: font-sans, 14px/1.5, font-weight 400, `text-muted-foreground`
- Max width: 240px, text-center
- Margin bottom: 20px

**CTA**
- "View Archive"
- Style: ghost button variant
- Font: font-sans, 13px, font-weight 500
- Colour: `text-primary`
- Icon: `Archive` (Lucide), 14px, inline left, gap 6px
- Padding: 8px 16px
- Border-radius: var(--radius-sm)
- Hover: `bg-primary/5`

### Entrance Animation

- Icon: opacity 0 to 1, translateY(8px) to 0, 300ms ease-out, delay 100ms
- Title + body: same, delay 200ms
- CTA: same, delay 300ms
- `prefers-reduced-motion`: all appear immediately, no motion

---

## Screen 5: Notification Preferences Screen

### Route

`/settings/notifications`

### Page Layout

| Property | Mobile (< 640px) | Desktop (>= 640px) |
|----------|-------------------|---------------------|
| Container | Full width, padding 16px | max-width 640px, margin auto, padding 24px |
| Background | `hsl(var(--background))` | same |

### Page Header

| Property | Value |
|----------|-------|
| Back button | Lucide `ArrowLeft`, 20px, `text-muted-foreground`, 40x40 touch target |
| Title | "Notification Preferences" -- font-display, 22px/1.3, font-weight 700 |
| Subtitle | "Control how and when you receive notifications" -- font-sans, 14px/1.5, font-weight 400, `text-muted-foreground` |
| Spacing | back button mb-4, title mb-2, subtitle mb-24px |

---

### Section 1: Notification Channels

**Section Header**
- "Channels" -- font-display, 16px/1.3, font-weight 600, `text-foreground`
- Margin bottom: 12px

**Channel Cards** -- one card per channel, stacked vertically, gap 8px

| Property | Value |
|----------|-------|
| Container | Card, padding 16px, border-radius var(--radius-lg), border 1px `hsl(var(--border))`, bg `hsl(var(--card))` |
| Layout | flex, justify-between, items-center |
| Left side | Icon (24px, `text-muted-foreground`) + column (title + description) |
| Icon gap | 12px |
| Title | font-sans, 14px/1.3, font-weight 500, `text-foreground` |
| Description | font-sans, 12px/1.4, font-weight 400, `text-muted-foreground` |
| Right side | Switch toggle + status badge |

**Channels:**

| Channel | Icon | Description |
|---------|------|-------------|
| In-App | `Bell` | "Bell icon notifications" |
| Browser Push | `Globe` | "Desktop browser alerts" |
| Email | `Mail` | "Transactional emails" |
| Mobile Push | `Smartphone` | "Phone notifications" |

**Status Badge** (below the switch, right-aligned)
- Enabled: text "Enabled", font-sans 11px font-weight 500, `text-teal`
- Disabled: text "Disabled", font-sans 11px font-weight 500, `text-muted-foreground`

**Browser Push: Permission State**
- If permission not yet granted: show a "Grant Permission" link below the description
  - Font: 12px, font-weight 500, `text-primary`, underline on hover

---

### Section 2: Event Type Preferences

**Section Header**
- "Event Types" -- font-display, 16px/1.3, font-weight 600
- Margin top: 28px, margin bottom: 12px

**Event Category Cards** -- stacked, gap 8px

Each card:
| Property | Value |
|----------|-------|
| Container | Card, padding 16px |
| Layout | flex, justify-between, items-center |
| Left | Category name + description |
| Right | Switch toggle |
| Title | font-sans, 14px, font-weight 500 |
| Description | font-sans, 12px, `text-muted-foreground` |

**Categories:**

| Category | Description | Can Disable? |
|----------|-------------|-------------|
| Payment Updates | "Payment received, failed, retries" | Yes |
| Transaction Status | "Delivery confirmations, payout failures" | Yes |
| Refund Notifications | "Refund processed, refund status" | Yes |
| KYC / Compliance | "Document requests, review status" | No (critical) |
| Security Alerts | "Login attempts, password changes" | No (critical) |
| System / Maintenance | "Scheduled downtime, system updates" | Yes |
| Marketing | "Promotions, offers, new features" | Yes (explicit consent) |

**Critical Category Treatment**
- Switch is checked and disabled (greyed out thumb)
- Below description: "This category cannot be disabled for your security."
  - Font: 11px, font-weight 400, `text-muted-foreground`, italic
  - Icon: `Lock`, 12px, inline, `text-muted-foreground`, gap 4px

**Marketing Category Treatment**
- Switch defaults to OFF
- Below description: GDPR note
  - "By enabling, you consent to receiving promotional communications. You can opt out at any time."
  - Font: 11px, font-weight 400, `text-muted-foreground`
  - Container: padding 8px 12px, bg `hsl(var(--muted))`, border-radius var(--radius-sm), margin-top 8px

---

### Section 3: Quiet Hours

**Section Header**
- "Quiet Hours" -- font-display, 16px/1.3, font-weight 600
- Margin top: 28px, margin bottom: 4px
- Description: "Pause non-critical notifications during rest hours" -- font-sans, 12px, `text-muted-foreground`, margin bottom 12px

**Quiet Hours Card**

| Property | Value |
|----------|-------|
| Container | Card, padding 16px |

**Enable Toggle Row**
- Layout: flex, justify-between, items-center
- Left: "Enable Quiet Hours" -- 14px, font-weight 500
- Right: Switch

**Time Range (shown when enabled)**
- Appears with slide-down animation: height 0 to auto, opacity 0 to 1, 250ms ease-out
- Layout: two time pickers side by side, gap 12px
- Labels: "From" and "To" -- font-sans, 12px, font-weight 500, `text-muted-foreground`
- Time inputs: styled select/input, 48px height, full width, border `hsl(var(--border))`, border-radius var(--radius)
- Default: 22:00 to 07:00

**Timezone Display**
- Below time pickers, margin-top 8px
- Text: "Timezone: Europe/London (GMT+1)" -- font-sans, 12px, `text-muted-foreground`
- Auto-detected from browser, non-editable (display only)

**Next Quiet Window Preview**
- Below timezone, margin-top 12px
- Container: bg `hsl(var(--muted))`, padding 10px 12px, border-radius var(--radius-sm)
- Icon: `Moon` (Lucide), 14px, `text-purple`, inline left
- Text: "Next quiet window: Tonight, 22:00 -- Tomorrow, 07:00" -- font-sans, 12px, font-weight 500, `text-foreground`

**Critical Override Note**
- Below the card, margin-top 8px
- Icon: `ShieldAlert` (Lucide), 14px, `text-amber`
- Text: "Critical notifications (payment failures, security alerts) will always be delivered, even during quiet hours."
- Font: 12px, `text-muted-foreground`
- Layout: flex, gap 8px, items-start

---

### Save Button

| Property | Mobile | Desktop |
|----------|--------|---------|
| Position | Fixed bottom, padding 16px, bg `hsl(var(--card))`, border-top 1px, z-40 | Static, margin-top 32px |
| Width | Full width (calc 100% - 32px) | auto, min-width 200px |
| Height | 48px | 44px |
| Style | Primary button variant, bg `hsl(var(--primary))`, `text-primary-foreground` |
| Font | font-sans, 14px, font-weight 600 |
| Border radius | var(--radius) |
| Disabled state | opacity 0.5, cursor not-allowed (when no changes made) |
| Loading state | spinner + "Saving..." text |

**Success Confirmation**
- On save: button text changes to "Preferences Saved" with a checkmark icon for 2 seconds
- Button bg transitions to `hsl(var(--teal))` for 2 seconds, then back to primary
- Also fire a toast: "Notification preferences saved" -- success variant

---

## Screen 6: Notification History / Archive Page

### Route

`/notifications/archive`

### Page Header

| Property | Value |
|----------|-------|
| Back button | `ArrowLeft`, links to previous page |
| Title | "Notification Archive" -- font-display, 22px/1.3, font-weight 700 |
| Subtitle | "Notifications from the past 90 days" -- font-sans, 14px, `text-muted-foreground` |
| "Mark all read" | Right-aligned, same style as panel header button |

---

### Filter Bar

| Property | Mobile (< 640px) | Desktop (>= 640px) |
|----------|-------------------|---------------------|
| Layout | Horizontal scroll, single row | Flex wrap, gap 8px |
| Padding | 0 16px (with scroll) | 0 |
| Margin bottom | 16px | 20px |
| Sticky | Yes, top: header height + 8px, z-30, bg background with blur | Same |

**Filter Chips/Controls:**

1. **Date Range** -- select dropdown or popover date picker
   - Options: "Last 7 days", "Last 30 days", "Last 90 days", "Custom range"
   - Style: bordered pill, 36px height, padding 0 12px, font-sans 13px font-weight 500
   - Active: bg `hsl(var(--primary) / 0.1)`, border `hsl(var(--primary))`, `text-primary`

2. **Category** -- select dropdown
   - Options: "All", "Payments", "Transactions", "Security", "System", "Promotions"
   - Same chip style

3. **Channel** -- select dropdown
   - Options: "All", "In-App", "Push", "Email"
   - Same chip style

4. **Status** -- toggle
   - Options: "All", "Unread", "Read"
   - Same chip style

**Active Filter Indicator**
- When any filter is active (not default), show a "Clear filters" text link
  - Font: 13px, `text-primary`, font-weight 500
  - Position: end of filter row

---

### Notification List (Archive)

- Uses same `NotificationItem` component from Screen 3
- Items show date group headers when the date changes:
  - "Today", "Yesterday", "Mon, 7 Apr", etc.
  - Font: font-sans, 12px, font-weight 600, `text-muted-foreground`, uppercase, letter-spacing 0.05em
  - Padding: 12px 16px 6px
  - Background: `hsl(var(--background))`

**Pagination**
- "Load More" button at bottom (not infinite scroll -- more predictable for archive)
- Style: ghost variant, full width on mobile, centered on desktop
- Font: 13px, font-weight 500, `text-primary`
- Height: 44px
- Shows "Showing 20 of 145 notifications" counter above the button
  - Font: 12px, `text-muted-foreground`, text-center

**Skeleton Loading**
- 5 skeleton items visible while loading
- Each skeleton: 72px height, same layout as notification item
- Animated shimmer using Tailwind `animate-pulse`
- Icon: 36px circle skeleton
- Title: 60% width bar, 12px height
- Body: 85% width bar, 12px height
- Timestamp: 40px bar, 10px height, right-aligned

---

### Notification Detail View

Tapping a notification in the archive opens a detail view.

**Mobile:** Full-screen slide-in from right (Sheet, side="right")
**Desktop:** Inline expansion below the item, or a side panel (380px right)

| Property | Value |
|----------|-------|
| Header | Same icon + title as item, larger: icon 44px, title 16px font-weight 600 |
| Body | Full message text (not truncated), 14px/1.6, `text-foreground` |
| Metadata section | |
| - Notification ID | font-mono, 12px, `text-muted-foreground` |
| - Sent at | "10 Apr 2026, 14:32 GMT" -- 13px, `text-muted-foreground` |
| - Channel | Badge: "In-App" / "Email" / "Push" -- outline badge variant |
| - Status | "Delivered" / "Read" -- teal badge / muted badge |
| CTA button | If deep-link exists: "View Transaction" -- primary button, full width on mobile |
| Close | `X` button top right, or back arrow on mobile |

---

### Empty Archive State

| Property | Value |
|----------|-------|
| Icon | `Archive`, 48px, `hsl(var(--muted-foreground) / 0.3)` |
| Title | "No archived notifications" -- font-display, 18px, font-weight 700 |
| Body | "Notifications older than 7 days will appear here." -- font-sans, 14px, `text-muted-foreground` |
| Layout | Same as Screen 4 empty state |

**Empty State with Active Filters**
| Title | "No matching notifications" |
| Body | "Try adjusting your filters." |
| CTA | "Clear Filters" -- ghost button, `text-primary` |

---

## Screen 7: In-App Notification Banner

### 7A: Maintenance Active Banner (Non-Dismissible)

| Property | Value |
|----------|-------|
| Position | Fixed top, below header (top: header height), full width |
| Z-index | 35 (below header z-40, above content) |
| Height | auto, min 44px |
| Padding | 10px 16px |
| Background | `hsl(var(--purple))` |
| Text colour | `hsl(var(--purple-foreground))` (white) |
| Layout | flex, items-center, justify-center, gap 8px |
| Icon | `Wrench`, 16px, white |
| Text | "We are currently undergoing maintenance. New transactions are temporarily unavailable. Expected completion: {time} ({TZ})." |
| Font | font-sans, 13px/1.4, font-weight 500 |
| Close button | None (non-dismissible) |
| Border bottom | none |

**Desktop modification:**
- Max-width container for text: 800px, centered
- Padding: 10px 24px

**Content pushes down:**
- The main content area gains a `padding-top` equal to banner height to avoid overlap

**Entrance Animation**
- SlideDown: translateY(-100%) to translateY(0), 300ms ease-out
- `prefers-reduced-motion`: opacity 0 to 1, 200ms

---

### 7B: Maintenance Complete Banner (Dismissible)

| Property | Value |
|----------|-------|
| Same layout as 7A except: |
| Background | `hsl(var(--teal))` |
| Text colour | `hsl(var(--teal-foreground))` (white) |
| Icon | `CheckCircle2`, 16px, white |
| Text | "Maintenance complete -- all systems are back online. Thank you for your patience." |
| Close button | `X`, 16px, white, 36x36 touch target, right side |
| Close hover | bg `white/10`, border-radius 9999px |

**Dismiss Behaviour**
- Click X: banner slides up and out, 200ms ease-in
- Auto-dismiss: after 30 seconds, same animation
- `prefers-reduced-motion`: opacity fade, 150ms

---

## Accessibility Specification

### Bell Icon
- `role="button"`
- `aria-label="Notifications, {count} unread"` (dynamic)
- `aria-haspopup="dialog"`
- `aria-expanded={isOpen}`
- Keyboard: Enter or Space to toggle panel

### Notification Panel
- `role="dialog"`
- `aria-label="Notification center"`
- `aria-modal="true"` (mobile bottom sheet only)
- Focus trap when open (Tab cycles within panel)
- Escape closes panel, returns focus to bell
- On open: focus moves to first notification item (or "Mark all read" if exists)

### Notification Items
- `role="article"` (within a list: `role="list"`)
- `aria-label="{title}. {body}. {timestamp}."` (full announcement)
- `tabindex="0"` -- each item is focusable
- Enter: activates deep-link (same as click)
- Dismiss button: `aria-label="Dismiss notification"`

### "Mark All Read" Button
- `aria-label="Mark all notifications as read"`

### Preferences Page
- All switches use `<Switch>` with proper `aria-checked`
- Critical (disabled) switches: `aria-disabled="true"`, `aria-label="{category} notifications -- cannot be disabled"`
- Form uses `role="form"` with `aria-label="Notification preferences"`
- Save button: `aria-live="polite"` announces "Preferences saved" on success

### Maintenance Banner
- `role="alert"` (non-dismissible) or `role="status"` (dismissible)
- `aria-live="assertive"` for maintenance active
- `aria-live="polite"` for maintenance complete
- Dismiss button (7B): `aria-label="Dismiss maintenance notification"`

### Motion
- All animations respect `prefers-reduced-motion: reduce`
- Reduced motion fallback: use opacity transitions only, no transforms
- Duration capped at 150ms under reduced motion

### Colour Contrast Verification

| Element | Foreground | Background | Ratio | Pass? |
|---------|-----------|------------|-------|-------|
| Body text on card | foreground on card | 222,47%,11% on white | ~15:1 | AA |
| Muted text on card | muted-fg on card | 215,16%,47% on white | ~5.5:1 | AA |
| White on primary (blue) | white on 217,91%,60% | | ~3.8:1 | AA Large |
| White on destructive | white on 0,84%,60% | | ~4.1:1 | AA Large |
| White on teal | white on 168,76%,42% | | ~3.3:1 | AA Large |
| White on purple | white on 258,90%,66% | | ~3.6:1 | AA Large |
| White on amber | white on 38,92%,50% | | ~2.1:1 | Fails -- use dark text |

**Amber accessibility fix:** For amber backgrounds (e.g., the maintenance banner if amber were used), use dark foreground text `hsl(var(--foreground))` instead of white. For amber icon containers (10% opacity bg), the amber icon colour on white card bg passes at ~3.4:1 for UI components (AA compliant for non-text).

---

## Component Inventory

### Existing shadcn/ui Components (reuse as-is)

| Component | File | Usage |
|-----------|------|-------|
| Badge | `ui/badge.tsx` | Status badges, filter chips |
| Button | `ui/button.tsx` | CTAs, save, mark all read |
| Card | `ui/card.tsx` | Preference cards, channel cards |
| Drawer | `ui/drawer.tsx` | Mobile bottom sheet panel |
| Popover | `ui/popover.tsx` | Desktop dropdown panel |
| ScrollArea | `ui/scroll-area.tsx` | Panel scrollable list |
| Separator | `ui/separator.tsx` | Dividers |
| Skeleton | `ui/skeleton.tsx` | Loading states |
| Switch | `ui/switch.tsx` | Preference toggles |
| Tooltip | `ui/tooltip.tsx` | Bell icon tooltip |
| Select | `ui/select.tsx` | Filter dropdowns, time pickers |
| Sheet | `ui/sheet.tsx` | Detail view slide-in |

### New Components to Build

| Component | Description |
|-----------|-------------|
| `NotificationBell` | Bell button + badge + unread count logic |
| `NotificationPanel` | Responsive wrapper: Drawer (mobile) / Popover (desktop) |
| `NotificationItem` | Single notification card with icon, content, timestamp, dismiss |
| `NotificationEmptyState` | Empty state for panel and archive |
| `NotificationBanner` | Top-bar banner for maintenance (dismissible and non-dismissible variants) |
| `NotificationPreferences` | Full preferences page |
| `NotificationArchive` | Archive page with filters and pagination |
| `NotificationDetail` | Detail view for individual notification |
| `NotificationFilterBar` | Filter chips row for archive |
| `NotificationDateGroup` | Date heading separator in notification lists |

### New shadcn/ui Components to Install

None required. All necessary primitives are already available.

---

## Responsive Behaviour Summary

| Screen | Mobile (< 640px) | Tablet (640-1023px) | Desktop (1024px+) |
|--------|-------------------|---------------------|---------------------|
| Bell Badge | 40x40, icon 20px | Same | Same |
| Panel | Bottom sheet, 85vh | Dropdown, 380px wide | Dropdown, 380px wide |
| Notification Item | Full width, dismiss always visible | Same | Dismiss on hover only |
| Preferences | Full width, fixed save button | max-width 640px centered | Same |
| Archive | Full width cards, sticky filters | 2-col possible if space | max-width 800px centered |
| Banner | Full width, text wraps | Same | Text contained in 800px |
| Detail View | Full-screen sheet (right) | Side panel 380px | Side panel 380px |

---

## Skeleton / Loading States

Every screen has a skeleton state -- the panel never shows blank or spinner-only:

**Panel skeleton:** 5 items with shimmer animation matching the notification item anatomy (circle + two bars).

**Archive skeleton:** Same item skeletons + shimmer filter chips (3 pill shapes).

**Preferences skeleton:** 4 card skeletons (rectangles with switch-shaped shimmer on right).

---

## Swipe Gestures (Mobile Only)

**Swipe Left on Notification Item:**
- Reveals "Dismiss" action, bg `hsl(var(--destructive))`, white `Trash2` icon
- Threshold: 80px swipe distance
- Spring back if < 80px
- Item slides off screen and collapses (height 0, margin 0, 200ms ease-in)

**Swipe Right on Notification Item:**
- Reveals "Mark Read" action, bg `hsl(var(--primary))`, white `Check` icon
- Same threshold behaviour
- Item transitions from unread to read state

**Pull to Refresh (Panel):**
- Pull down from top of list, 60px threshold
- Shows spinner during refresh
- `prefers-reduced-motion`: spinner only, no pull animation

---

## Motion Specification Summary

| Animation | Duration | Easing | Reduced Motion |
|-----------|----------|--------|---------------|
| Badge entrance | 300ms | spring(0.34,1.56,0.64,1) | opacity 150ms |
| Badge count bounce | 200ms | ease-out | none |
| Panel open (mobile) | 350ms | cubic-bezier(0.32,0.72,0,1) | opacity 200ms |
| Panel close (mobile) | 250ms | ease-in | opacity 150ms |
| Panel open (desktop) | 200ms | ease-out | opacity 150ms |
| Panel close (desktop) | 150ms | ease-in | opacity 100ms |
| Item dismiss (swipe) | 200ms | ease-in | opacity 150ms |
| Item state change | 200ms | ease | instant |
| Banner entrance | 300ms | ease-out | opacity 200ms |
| Banner dismiss | 200ms | ease-in | opacity 150ms |
| Empty state stagger | 300ms each, 100ms stagger | ease-out | instant |
| Save confirmation | 2000ms hold | linear | same |
| Quiet hours expand | 250ms | ease-out | instant |

---

*Specification version: 1.0 -- 2026-04-10*
*Status: AWAITING USER APPROVAL*
