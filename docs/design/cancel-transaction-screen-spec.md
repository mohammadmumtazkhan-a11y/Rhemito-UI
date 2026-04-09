# Cancel Transaction -- Screen Specification

**Feature:** Cancel Transaction (Awaiting Payment only)
**Status:** Approved
**Benchmark:** Wise (cancel transfer flow), Stripe (destructive confirmation modals), Linear (inline status transitions)
**Date:** 2026-04-09

---

## Design Rationale

Wise allows cancellation only before payment is completed -- Rhemito mirrors this by restricting Cancel to "Awaiting Payment" (Manual Bank Transfer) rows. The confirmation modal follows Stripe's pattern of showing transaction context + explicit destructive CTA with a secondary escape route. The post-cancellation state follows Linear's approach of quiet inline status updates paired with a brief toast.

---

## Screen 1: Dashboard Transaction Row -- Cancel Button Visible

### When it appears
The Cancel button renders in the Actions column ONLY when `status === "awaiting_payment"`. All other statuses show only the existing Resend button.

### Actions column layout (Awaiting Payment rows)

Two buttons side by side, with Resend on the left and Cancel on the right:

| Property | Resend Button (existing) | Cancel Button (new) |
|----------|-------------------------|---------------------|
| Variant | Filled (gradient) | Ghost / text-only |
| Colour | `bg-gradient-to-r from-blue-600 to-indigo-600` (unchanged) | Text: `text-gray-400` idle, `text-destructive` on hover |
| Background | Gradient fill | `transparent` idle, `bg-red-50` on hover |
| Border | None (shadow) | None |
| Height | `h-8` (32px) | `h-8` (32px) |
| Padding | `px-4` | `px-3` |
| Font | `text-xs font-medium` (Inter) | `text-xs font-medium` (Inter) |
| Border radius | `rounded-lg` | `rounded-lg` |
| Icon | None | None (text label only -- "Cancel") |
| Gap between buttons | `gap-2` (8px) |

**Why ghost style for Cancel:** A destructive action should not compete visually with the primary action (Resend/Pay). Wise and Stripe both de-emphasise the cancel affordance to prevent accidental clicks. The button only reveals its destructive intent on hover via colour shift.

### Hover / Focus states

- **Cancel idle:** `text-gray-400`, transparent background
- **Cancel hover:** `text-destructive` (#ef4444), `bg-red-50`, transition `150ms ease-out`
- **Cancel focus-visible:** `ring-2 ring-destructive ring-offset-2`
- **Cancel active (pressed):** `bg-red-100`

### Mobile (< 640px / `sm` breakpoint)

The Actions column is already hidden on mobile (`hidden sm:table-cell`). On mobile, the cancel action is accessed by tapping the transaction row to open the Transaction Detail page (see Screen 4), where the Cancel button is prominently placed.

No changes needed to the mobile table layout.

### Accessibility
- `aria-label="Cancel transaction {refNo}"` on the Cancel button
- Minimum touch target: 44x32px -- the `px-3 h-8` gives adequate width; ensure the cell padding does not reduce the target
- Keyboard: Tab order is Resend then Cancel within the row

---

## Screen 2: Cancellation Confirmation Modal

### Trigger
User clicks the Cancel button (Screen 1 or Screen 4). The modal appears immediately.

### Component
Use shadcn `AlertDialog` (not `Dialog`) -- it traps focus and requires explicit user action. This prevents dismissal by clicking the overlay, which is appropriate for a destructive action.

### Overlay
- `bg-black/50` with `backdrop-blur-sm`
- Entrance: fade in `200ms ease-out`
- Exit: fade out `150ms ease-in`

### Modal container
- Width: `max-w-md` (448px)
- Background: `bg-card` (white)
- Border radius: `rounded-xl` (--radius-xl)
- Shadow: `shadow-xl`
- Padding: `p-6` (24px)
- Entrance animation (Framer Motion): `opacity: 0 -> 1`, `scale: 0.95 -> 1`, `duration: 200ms`, `ease: [0.16, 1, 0.3, 1]` (spring-like ease-out)
- Exit: `opacity: 1 -> 0`, `scale: 1 -> 0.98`, `duration: 150ms`

### Content layout (top to bottom)

#### 1. Icon (optional but recommended)
- Lucide `AlertTriangle` icon
- Size: `w-10 h-10` (40px)
- Colour: `text-destructive` (#ef4444)
- Container: `w-12 h-12` (48px) circle, `bg-red-50`, centered
- Margin bottom: `mb-4`

#### 2. Title
- Text: "Cancel Transaction?"
- Font: Plus Jakarta Sans (`font-display`)
- Size: `text-lg` (18px), `font-semibold`
- Colour: `text-foreground`
- Margin bottom: `mb-2`

#### 3. Description
- Text: "This action cannot be undone. The following transaction will be permanently cancelled."
- Font: Inter (`font-sans`)
- Size: `text-sm` (14px), `leading-relaxed`
- Colour: `text-muted-foreground`
- Margin bottom: `mb-5`

#### 4. Transaction details card
- Background: `bg-muted` (gray-50 equivalent)
- Border: `border border-border`
- Border radius: `rounded-lg`
- Padding: `p-4`
- Margin bottom: `mb-6`

Contents (each row is a flex `justify-between` line):

| Label (left) | Value (right) |
|---|---|
| "Reference" | `{refNo}` -- `text-sm font-semibold text-foreground` |
| "Recipient" | `{recipientName}` -- `text-sm font-medium text-foreground` |
| "Amount" | `{amount}` -- `text-sm font-bold text-foreground` |
| "Service" | `{service}` -- `text-sm text-muted-foreground` |

- Labels: `text-sm text-muted-foreground`
- Row spacing: `space-y-2.5`

#### 5. Action buttons
- Layout: `flex gap-3` -- two buttons side by side, equal width (`flex-1`)
- Order: secondary (left), destructive (right)

**"Keep Transaction" button (secondary):**
- Variant: `outline`
- Classes: `h-11 rounded-lg text-sm font-medium border-border`
- Hover: `hover:bg-accent`
- This is the safe/escape action

**"Cancel Transaction" button (destructive):**
- Variant: `destructive`
- Classes: `h-11 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground`
- Hover: `hover:bg-red-600` (slightly darker)
- Shadow: `shadow-sm`

### Loading state (API call in progress)

When the user clicks "Cancel Transaction":
1. Button text changes to a `Loader2` spinner icon (Lucide) + "Cancelling..." text
2. Button is disabled: `opacity-80 pointer-events-none`
3. "Keep Transaction" button is also disabled
4. Overlay remains -- modal cannot be dismissed during the API call
5. Spinner: `animate-spin w-4 h-4 mr-2`

### Error state

If the API call fails:
- Modal stays open
- Both buttons re-enable
- A small inline error message appears below the buttons: `text-destructive text-xs mt-3` -- "Something went wrong. Please try again."
- Toast also fires (see standard error toast pattern)

### Reduced motion
- When `prefers-reduced-motion: reduce`, remove the scale animation. Use opacity-only fade `150ms`.

---

## Screen 3: Post-Cancellation State

### 3a. Transaction row update

After successful cancellation, the row updates in place (no page reload).

**Status badge changes:**

| Property | Before (Awaiting Payment) | After (Cancelled) |
|---|---|---|
| Dot colour | `bg-amber-500` (yellow) | `bg-gray-400` (neutral grey) |
| Badge bg | `bg-amber-50` | `bg-gray-50` |
| Badge text colour | `text-amber-700` | `text-gray-500` |
| Badge border | `border-amber-200` | `border-gray-200` |
| Label | "Pending" | "Cancelled" |

**Why grey, not red:** Red implies failure/error. Cancellation is a deliberate user action, not an error. Grey conveys "inactive/terminated" -- consistent with Wise and Linear's approach. Red is reserved for "Failed" transactions.

**Actions column after cancellation:**
- Cancel button: removed (not rendered)
- Resend button: removed (a cancelled transaction cannot be resent)
- The cell is empty, or shows a muted "---" placeholder in `text-gray-300`

**Row transition animation (Framer Motion):**
- The status badge cross-fades: `opacity 0 -> 1`, `duration: 300ms`
- The Cancel button fades out: `opacity 1 -> 0`, `duration: 200ms`
- Use `AnimatePresence` + `layout` prop on the actions cell for smooth reflow

### 3b. Toast notification

- Position: top-right (existing Toaster position)
- Variant: `default` (not destructive -- the action succeeded)
- Title: "Transaction cancelled"
- Description: "Ref {refNo} has been cancelled successfully."
- Duration: `4000ms` (4 seconds)
- Icon: Lucide `CheckCircle` in `text-teal` (success colour) -- because the cancellation action itself succeeded
- Auto-dismiss with progress indicator

### 3c. Modal dismissal

- Modal closes with exit animation (fade + scale down, 150ms)
- Focus returns to the row that triggered the action (or the table if the button no longer exists)

---

## Screen 4: Transaction Detail Page -- Cancel Option

### Context
When a user clicks the Ref No. link in the dashboard table, they navigate to a transaction detail view. Note: there is currently no dedicated transaction detail page in the codebase -- this spec covers the Cancel button placement for when one is built.

### Cancel button placement

The Cancel button sits in the **page header actions area** (top-right on desktop, full-width bottom-fixed on mobile).

**Desktop layout (>= 768px):**
- Header area: transaction ref + status badge on the left, action buttons on the right
- Buttons: "Resend" (primary, filled) + "Cancel Transaction" (outline, destructive-on-hover)
- Button styles match Screen 1 logic but at standard size: `h-10 px-5 text-sm`
- Cancel button: `variant="outline"` with `border-gray-200`, `text-gray-500` idle
- Cancel hover: `text-destructive border-destructive/30 bg-red-50`

**Mobile layout (< 768px):**
- Fixed bottom bar: `fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-border`
- Two buttons: `flex gap-3`, each `flex-1 h-12`
- Resend: primary filled
- Cancel: outline, same hover treatment as desktop
- Safe area padding: `pb-[env(safe-area-inset-bottom)]`

### Confirmation modal
Reuse the exact same `AlertDialog` modal from Screen 2. Same component, same props, same behaviour. The only difference is the trigger source.

---

## Colour Token Reference

| Usage | Token / Class | Hex |
|---|---|---|
| Cancel button text (idle) | `text-gray-400` | #9ca3af |
| Cancel button text (hover) | `text-destructive` | #ef4444 |
| Cancel button bg (hover) | `bg-red-50` | #fef2f2 |
| Cancelled status dot | `bg-gray-400` | #9ca3af |
| Cancelled badge bg | `bg-gray-50` | #f9fafb |
| Cancelled badge text | `text-gray-500` | #6b7280 |
| Cancelled badge border | `border-gray-200` | #e5e7eb |
| Modal destructive CTA | `bg-destructive` | #ef4444 |
| Success toast icon | `text-teal` | #10b981 |
| Warning icon in modal | `text-destructive` | #ef4444 |
| Warning icon bg | `bg-red-50` | #fef2f2 |

---

## Animation Summary

| Element | Property | From | To | Duration | Easing |
|---|---|---|---|---|---|
| Modal overlay | opacity | 0 | 1 | 200ms | ease-out |
| Modal container enter | opacity, scale | 0, 0.95 | 1, 1 | 200ms | [0.16, 1, 0.3, 1] |
| Modal container exit | opacity, scale | 1, 1 | 0, 0.98 | 150ms | ease-in |
| Cancel button hover | color, bg | gray-400, transparent | destructive, red-50 | 150ms | ease-out |
| Status badge swap | opacity | 0 | 1 | 300ms | ease-out |
| Cancel button removal | opacity | 1 | 0 | 200ms | ease-in |
| Toast enter | translateX, opacity | 100%, 0 | 0, 1 | 300ms | ease-out |
| Reduced motion fallback | opacity only | 0 | 1 | 150ms | linear |

---

## Edge Cases

1. **Double-click prevention:** Disable the "Cancel Transaction" CTA immediately on first click. Use a loading state lock.
2. **Network timeout:** If the API call takes > 10 seconds, show inline text "This is taking longer than expected..." below the spinner.
3. **Concurrent tab:** If the transaction status changes (e.g., payment received) between opening the modal and confirming, the API should return an error. Display: "This transaction can no longer be cancelled." and close the modal after 3 seconds, refreshing the row status.
4. **Session expiry:** If the user's session expires during the modal, redirect to login after the API 401 response.
5. **Keyboard navigation:** `Escape` key closes the modal (same as "Keep Transaction"). `Enter` should NOT trigger the destructive action -- focus starts on "Keep Transaction" to prevent accidental cancellation.
6. **Auto-cancellation note:** Transactions not paid within 14 days are auto-cancelled (following Wise's pattern). This is a backend concern but the status should update to "Cancelled" with the same grey badge.

---

## Benchmark Sources

- [Wise: How to cancel a transfer](https://wise.com/help/articles/2971625/how-do-i-cancel-my-transfer)
- [Wise iOS cancellation flow on Mobbin](https://mobbin.com/explore/flows/3f1e63b3-b397-4ed5-b30a-d84233539629)
- Stripe Dashboard: destructive confirmation modal pattern (delete webhook, cancel subscription)
- Linear: inline status transitions with muted colour states
