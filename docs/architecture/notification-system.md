# Technical Specification: Notification System

Version: 1.0
Date: 2026-04-10
Status: DRAFT
Approved by: _pending_

---

## 1. Executive Summary

The Notification System delivers timely, multi-channel alerts to Rhemito customers across their money transfer journey. The architecture uses an event-driven dispatch pattern layered onto the existing Express + Drizzle + React stack, with an in-process event emitter for the prototype and a clear migration path to a durable job queue (BullMQ + Redis) for production. The prototype fully implements the In-App Bell channel with database-backed persistence, stubs Email and Web Push channels with console logging, and defers Mobile Push entirely. All 14 user stories from the requirements document are covered in the data model and service design; MoSCoW prioritisation determines implementation order.

---

## 2. Architectural Drivers

| # | Driver | Source Requirement | Impact on Design |
|---|--------|-------------------|-----------------|
| 1 | Multi-channel delivery with per-user preferences | US-001, US-009 | Requires a dispatcher abstraction per channel, a preferences table, and a delivery log |
| 2 | 30-minute bank transfer window with timed reminders | US-007 | Requires a scheduler (setTimeout for prototype; BullMQ delayed jobs for production) |
| 3 | Critical notifications bypass quiet hours and cannot be disabled | Global rule, US-003/005/006/007/012/013 | Event types must carry an `isCritical` flag; preference checks must respect it |
| 4 | Retry with exponential backoff and fallback channels | US-009 | Delivery log tracks attempts; retry logic with 1m/5m/15m delays; fallback chain |
| 5 | 7-day active + 90-day archive retention with GDPR delete | US-014 | Separate active/archive query patterns; scheduled cleanup job |

---

## 3. System Architecture

### 3.1 Architecture Pattern

**Event-Driven Dispatch with In-Process Event Emitter (Prototype) / Job Queue (Production)**

The system follows a three-stage pipeline:

1. **Trigger** -- A business event occurs (payment received, transaction failed, admin action). The triggering code calls `NotificationService.dispatch(eventType, userId, data)`.
2. **Route** -- The service checks user preferences, quiet hours, and critical override rules. It determines which channels to fire on.
3. **Deliver** -- Per-channel dispatchers (InApp, Email, Push) handle formatting and delivery. Each attempt is logged. Failures trigger retries and eventual fallback.

**Why this pattern:**
- Decouples business logic from notification delivery -- transaction code does not know about channels.
- The in-process EventEmitter is zero-dependency for the prototype. Replacing it with BullMQ later requires changing only the queue adapter, not the dispatch interface.
- Avoids introducing Redis/BullMQ infrastructure for a prototype while keeping the same API surface.

**Honest limitations of the prototype approach:**
- `setTimeout`-based scheduling is lost on server restart (not durable).
- No concurrency control -- a single Node.js process handles all dispatches.
- No dead-letter queue -- failed deliveries after 3 retries are logged but not recoverable without manual intervention.

### 3.2 System Diagram

```
+------------------+     dispatch(event, userId, data)
| Business Logic   | ----------------------------------------+
| (routes.ts,      |                                         |
|  schedulers)     |                                         v
+------------------+                              +---------------------+
                                                  | NotificationService |
                                                  |---------------------|
                                                  | - checkPreferences  |
                                                  | - checkQuietHours   |
                                                  | - resolveChannels   |
                                                  | - formatMessage     |
                                                  +---------+-----------+
                                                            |
                              +-----------------------------+-----------------------------+
                              |                             |                             |
                    +---------v---------+       +-----------v-----------+     +-----------v-----------+
                    | InAppDispatcher   |       | EmailDispatcher       |     | PushDispatcher        |
                    |-------------------|       |-----------------------|     |-----------------------|
                    | - writes to       |       | - PROTOTYPE: console  |     | - PROTOTYPE: console  |
                    |   notifications   |       |   .log() stub         |     |   .log() stub         |
                    |   table           |       | - PROD: SendGrid/SES  |     | - PROD: FCM/Web Push  |
                    +-------------------+       +-----------------------+     +-----------------------+
                              |
                              v
                    +-------------------+
                    | PostgreSQL        |
                    |-------------------|
                    | notifications     |
                    | notif_preferences |
                    | notif_delivery_log|
                    +-------------------+
                              ^
                              |  TanStack Query (poll every 30s)
                    +---------+---------+
                    | React Frontend    |
                    |-------------------|
                    | NotificationBell  |
                    | NotificationPanel |
                    | PreferencesPage   |
                    +-------------------+
```

### 3.3 Component Responsibilities

| Component | Technology | Responsibility | Owns | Depends On |
|-----------|-----------|----------------|------|------------|
| NotificationService | TypeScript class (server) | Dispatch, preference resolution, quiet hours, critical override | Notification lifecycle | Drizzle ORM, channel dispatchers |
| InAppDispatcher | TypeScript class (server) | Write notification rows to DB | In-app delivery | PostgreSQL via Drizzle |
| EmailDispatcher | TypeScript class (server) | Send transactional email (stubbed in prototype) | Email delivery | SendGrid/SES (production) |
| PushDispatcher | TypeScript class (server) | Send browser/mobile push (stubbed in prototype) | Push delivery | FCM / Web Push API (production) |
| NotificationScheduler | TypeScript class (server) | Schedule timed events (reminders, auto-cancel, maintenance) | Timer lifecycle | NotificationService, setTimeout (prototype) / BullMQ (production) |
| DeliveryRetryManager | TypeScript class (server) | Retry failed deliveries with exponential backoff, trigger fallbacks | Retry logic | NotificationService, delivery log table |
| Notification API routes | Express routes (server) | REST endpoints for CRUD, preferences, dispatch | API surface | NotificationService, session auth |
| NotificationBell | React component (client) | Bell icon + unread badge + panel toggle | UI entry point | useNotifications hook |
| NotificationPanel | React component (client) | Slide-in panel showing notification list | Notification display | useNotifications hook, TanStack Query |
| NotificationPreferences | React page (client) | Preference management UI | Preference UI | API endpoints |
| useNotifications | React hook (client) | Polling, state, and mutation wrappers | Client-side notification state | TanStack Query, apiRequest |

---

## 4. Tech Stack Decisions

| Layer | Technology | Version | Rationale | Rejected Alternatives |
|-------|-----------|---------|-----------|----------------------|
| Database | PostgreSQL (existing) | 16+ | Already in stack; JSONB support for notification metadata | SQLite (no JSONB, not production-grade) |
| ORM | Drizzle (existing) | 0.30+ | Already in stack; type-safe schema definitions | Prisma (would introduce a second ORM) |
| Event Bus (prototype) | Node.js EventEmitter | Built-in | Zero dependency; sufficient for single-process prototype | BullMQ (requires Redis, overkill for prototype) |
| Event Bus (production) | BullMQ + Redis | deferred | Durable, distributed, delayed jobs, retry built-in | Agenda.js (less maintained), pg-boss (adds DB load) |
| Email (production) | SendGrid or Postmark | deferred | Industry standard for transactional email | SES (more setup), Mailgun (less UK-friendly) |
| Push (production) | Firebase Cloud Messaging | deferred | Cross-platform (web + mobile), free tier generous | OneSignal (adds vendor dependency), raw Web Push (no mobile) |
| Client Polling | TanStack Query | 5 (existing) | Already in stack; `refetchInterval` for polling | WebSocket (more complex for prototype), SSE (Express support limited) |

---

## 5. Database Design

### 5.1 Entity-Relationship Overview

```
auth_users (1) ---< notifications (many)
auth_users (1) ---< notification_preferences (many, one per category)
notifications (1) ---< notification_delivery_log (many, one per channel attempt)
```

### 5.2 Schema (Drizzle ORM Definitions)

Add the following to `shared/schema.ts`:

```typescript
import { pgTable, varchar, text, boolean, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Notification Event Types ─────────────────────────────────────
// These map 1:1 to the 14 user stories + sub-events

export const NOTIFICATION_EVENT_TYPES = {
  // Payments
  PAYMENT_SUCCESSFUL: "payment_successful",           // US-002
  AWAITING_PAYMENT: "awaiting_payment",               // US-002A
  PAYMENT_FAILED: "payment_failed",                   // US-003 (critical)

  // Transactions
  TRANSACTION_DELIVERED: "transaction_delivered",       // US-004
  TRANSACTION_FAILED_PSP: "transaction_failed_psp",   // US-005 (critical)
  ADMIN_CANCELLATION: "admin_cancellation",             // US-006 (critical)
  AUTO_CANCEL_REMINDER_15: "auto_cancel_reminder_15",   // US-007
  AUTO_CANCEL_REMINDER_5: "auto_cancel_reminder_5",     // US-007
  AUTO_CANCEL_EXECUTED: "auto_cancel_executed",         // US-007 (critical)
  REFUND_PROCESSED: "refund_processed",                 // US-011

  // Compliance
  TRANSACTION_UNDER_REVIEW: "transaction_under_review", // US-012 (critical)
  REVIEW_COMPLETE: "review_complete",                   // US-012
  DOCUMENT_REQUEST: "document_request",                 // US-013 (critical)
  DOCUMENT_REMINDER_24H: "document_reminder_24h",       // US-013 (critical)
  DOCUMENT_REMINDER_6H: "document_reminder_6h",         // US-013 (critical)
  DOCUMENT_RECEIVED: "document_received",               // US-013
  DOCUMENT_DEADLINE_MISSED: "document_deadline_missed", // US-013 (critical)

  // System
  MAINTENANCE_ADVANCE: "maintenance_advance",           // US-008
  MAINTENANCE_ACTIVE: "maintenance_active",             // US-008
  MAINTENANCE_COMPLETE: "maintenance_complete",         // US-008
} as const;

export type NotificationEventType = typeof NOTIFICATION_EVENT_TYPES[keyof typeof NOTIFICATION_EVENT_TYPES];

// Events that are critical -- cannot be disabled, bypass quiet hours
export const CRITICAL_EVENT_TYPES: NotificationEventType[] = [
  NOTIFICATION_EVENT_TYPES.PAYMENT_FAILED,
  NOTIFICATION_EVENT_TYPES.TRANSACTION_FAILED_PSP,
  NOTIFICATION_EVENT_TYPES.ADMIN_CANCELLATION,
  NOTIFICATION_EVENT_TYPES.AUTO_CANCEL_EXECUTED,
  NOTIFICATION_EVENT_TYPES.TRANSACTION_UNDER_REVIEW,
  NOTIFICATION_EVENT_TYPES.DOCUMENT_REQUEST,
  NOTIFICATION_EVENT_TYPES.DOCUMENT_REMINDER_24H,
  NOTIFICATION_EVENT_TYPES.DOCUMENT_REMINDER_6H,
  NOTIFICATION_EVENT_TYPES.DOCUMENT_DEADLINE_MISSED,
];

// Notification categories for preference grouping
export const NOTIFICATION_CATEGORIES = {
  PAYMENTS: "payments",
  TRANSACTIONS: "transactions",
  SECURITY: "security",
  PROMOTIONS: "promotions",
  SYSTEM: "system",
} as const;

export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[keyof typeof NOTIFICATION_CATEGORIES];

// Map event types to categories
export const EVENT_TYPE_TO_CATEGORY: Record<NotificationEventType, NotificationCategory> = {
  payment_successful: "payments",
  awaiting_payment: "payments",
  payment_failed: "payments",
  transaction_delivered: "transactions",
  transaction_failed_psp: "transactions",
  admin_cancellation: "transactions",
  auto_cancel_reminder_15: "transactions",
  auto_cancel_reminder_5: "transactions",
  auto_cancel_executed: "transactions",
  refund_processed: "payments",
  transaction_under_review: "security",
  review_complete: "security",
  document_request: "security",
  document_reminder_24h: "security",
  document_reminder_6h: "security",
  document_received: "security",
  document_deadline_missed: "security",
  maintenance_advance: "system",
  maintenance_active: "system",
  maintenance_complete: "system",
};

export const NOTIFICATION_CHANNELS = {
  IN_APP: "in_app",
  EMAIL: "email",
  WEB_PUSH: "web_push",
  MOBILE_PUSH: "mobile_push",
} as const;

export type NotificationChannel = typeof NOTIFICATION_CHANNELS[keyof typeof NOTIFICATION_CHANNELS];

// ─── Notifications Table ──────────────────────────────────────────

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),       // NotificationEventType
  category: text("category").notNull(),           // NotificationCategory
  title: text("title").notNull(),
  body: text("body").notNull(),
  isCritical: boolean("is_critical").notNull().default(false),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  isDismissed: boolean("is_dismissed").notNull().default(false),
  dismissedAt: timestamp("dismissed_at"),
  // Deep link target (e.g., "/transactions/TXN123")
  actionUrl: text("action_url"),
  actionLabel: text("action_label"),              // e.g., "View Transaction", "Retry Payment"
  // Flexible metadata for event-specific data
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  // Retention
  expiresAt: timestamp("expires_at"),             // 7 days from creation (active window)
  archivedAt: timestamp("archived_at"),           // set when moved to archive
  deleteAfter: timestamp("delete_after"),         // 90 days from creation (hard delete)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_notifications_user_active").on(table.userId, table.isDismissed, table.archivedAt),
  index("idx_notifications_user_created").on(table.userId, table.createdAt),
  index("idx_notifications_expires").on(table.expiresAt),
  index("idx_notifications_delete_after").on(table.deleteAfter),
]);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Notification Preferences Table ───────────────────────────────

export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  category: text("category").notNull(),           // NotificationCategory
  // Per-channel toggles
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  webPushEnabled: boolean("web_push_enabled").notNull().default(true),
  mobilePushEnabled: boolean("mobile_push_enabled").notNull().default(true),
  // Quiet hours (apply to non-critical only)
  quietHoursEnabled: boolean("quiet_hours_enabled").notNull().default(false),
  quietHoursStart: text("quiet_hours_start"),     // "22:00" (HH:mm, user's local time)
  quietHoursEnd: text("quiet_hours_end"),         // "07:00"
  quietHoursTimezone: text("quiet_hours_timezone"), // "Europe/London"
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_notif_prefs_user").on(table.userId),
  // Unique constraint: one row per user per category
  index("idx_notif_prefs_user_category").on(table.userId, table.category),
]);

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;

// ─── Notification Delivery Log ────────────────────────────────────
// Tracks every delivery attempt per channel for audit and retry logic

export const notificationDeliveryLog = pgTable("notification_delivery_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  notificationId: varchar("notification_id").notNull().references(() => notifications.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),             // NotificationChannel
  status: text("status").notNull().default("pending"), // "pending" | "sent" | "delivered" | "failed" | "bounced"
  attemptNumber: integer("attempt_number").notNull().default(1),
  errorMessage: text("error_message"),
  // Fallback tracking
  isFallback: boolean("is_fallback").notNull().default(false),
  fallbackFromChannel: text("fallback_from_channel"), // which channel failed to trigger this fallback
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  failedAt: timestamp("failed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_delivery_log_notification").on(table.notificationId),
  index("idx_delivery_log_status").on(table.status),
]);

export type NotificationDeliveryLogEntry = typeof notificationDeliveryLog.$inferSelect;
export type InsertNotificationDeliveryLogEntry = typeof notificationDeliveryLog.$inferInsert;
```

### 5.3 Zod Validation Schemas

Add to `shared/schema.ts`:

```typescript
// ─── Notification Zod Schemas ─────────────────────────────────────

export const notificationPreferencesUpdateSchema = z.object({
  category: z.enum(["payments", "transactions", "security", "promotions", "system"]),
  inAppEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  webPushEnabled: z.boolean().optional(),
  mobilePushEnabled: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursTimezone: z.string().optional(),
});

export const notificationDispatchSchema = z.object({
  eventType: z.string(),
  userId: z.string(),
  data: z.record(z.unknown()),
});
```

### 5.4 Data Migration Strategy

- New tables only -- no existing tables are modified.
- Migration creates `notifications`, `notification_preferences`, and `notification_delivery_log` tables.
- On first login after deployment, if a user has no preference rows, seed 5 rows (one per category) with all channels enabled and quiet hours disabled. This is handled in the `ensureDefaultPreferences()` method of NotificationService.
- The `deleteAfter` column is set to `NOW() + 90 days` on insert. A daily cleanup job (or server-startup sweep) deletes rows past this date.
- The `expiresAt` column is set to `NOW() + 7 days`. Notifications past this date are not deleted but are excluded from the active query and included only in the archive query.

---

## 6. API Contract

### 6.1 API Design Principles

- All notification endpoints require an authenticated session (`req.session.userId`).
- Every query filters by `userId` from session -- users can never access another user's notifications.
- Pagination uses cursor-based approach (`?cursor=<lastId>&limit=20`) for stable pagination during real-time updates.
- All responses follow the existing pattern: JSON body, appropriate HTTP status codes, error messages in `{ message: string }`.

### 6.2 Endpoint Inventory

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | Yes | Active notifications (last 7 days, not archived, not dismissed) |
| GET | `/api/notifications/archive` | Yes | Archived notifications (7-90 days old) |
| GET | `/api/notifications/unread-count` | Yes | Unread count for badge (lightweight) |
| PATCH | `/api/notifications/:id/read` | Yes | Mark single notification as read |
| PATCH | `/api/notifications/read-all` | Yes | Mark all notifications as read |
| DELETE | `/api/notifications/:id` | Yes | Dismiss a notification (soft delete -- sets isDismissed) |
| GET | `/api/notifications/preferences` | Yes | Get all preference rows for current user |
| PATCH | `/api/notifications/preferences` | Yes | Update preferences for a single category |
| POST | `/api/notifications/dispatch` | Internal | Dispatch a notification event (called by server code, not exposed to client) |

### 6.3 Key Request/Response Shapes

**GET /api/notifications**

Query params: `?cursor=<id>&limit=20&category=payments&readStatus=unread`

```typescript
// Response 200
{
  notifications: [
    {
      id: "uuid",
      eventType: "payment_successful",
      category: "payments",
      title: "Payment Received",
      body: "Payment of GBP 500.00 for John Doe received. TXN: TXN-ABC123",
      isCritical: false,
      isRead: false,
      actionUrl: "/transactions/TXN-ABC123",
      actionLabel: "View Transaction",
      metadata: {
        txnId: "TXN-ABC123",
        amount: "500.00",
        currency: "GBP",
        recipientName: "John Doe"
      },
      createdAt: "2026-04-10T14:30:00Z"
    }
  ],
  nextCursor: "uuid-of-last-item" | null,
  totalUnread: 5
}
```

**GET /api/notifications/unread-count**

```typescript
// Response 200
{ count: 5 }
```

**PATCH /api/notifications/:id/read**

```typescript
// Response 200
{ success: true }
```

**PATCH /api/notifications/read-all**

```typescript
// Response 200
{ updatedCount: 12 }
```

**GET /api/notifications/preferences**

```typescript
// Response 200
{
  preferences: [
    {
      category: "payments",
      inAppEnabled: true,
      emailEnabled: true,
      webPushEnabled: true,
      mobilePushEnabled: false,
      quietHoursEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      quietHoursTimezone: "Europe/London"
    },
    // ... one per category (5 total)
  ]
}
```

**PATCH /api/notifications/preferences**

```typescript
// Request body
{
  category: "payments",
  emailEnabled: false,
  quietHoursEnabled: true,
  quietHoursStart: "23:00",
  quietHoursEnd: "08:00",
  quietHoursTimezone: "Europe/London"
}

// Response 200
{ success: true }
```

---

## 7. Notification Service Design

### 7.1 NotificationService Class

File: `server/services/notification-service.ts`

```typescript
class NotificationService {
  // Core dispatch -- called by business logic
  async dispatch(
    eventType: NotificationEventType,
    userId: string,
    data: Record<string, unknown>
  ): Promise<void>;

  // Query methods
  async getActive(userId: string, options: PaginationOptions): Promise<PaginatedNotifications>;
  async getArchive(userId: string, options: PaginationOptions): Promise<PaginatedNotifications>;
  async getUnreadCount(userId: string): Promise<number>;

  // Mutation methods
  async markRead(notificationId: string, userId: string): Promise<void>;
  async markAllRead(userId: string): Promise<number>;
  async dismiss(notificationId: string, userId: string): Promise<void>;

  // Preference methods
  async getPreferences(userId: string): Promise<NotificationPreference[]>;
  async updatePreferences(userId: string, update: PreferenceUpdate): Promise<void>;
  async ensureDefaultPreferences(userId: string): Promise<void>;

  // Internal
  private resolveChannels(eventType: NotificationEventType, userId: string): Promise<NotificationChannel[]>;
  private isQuietHours(userId: string, category: NotificationCategory): Promise<boolean>;
  private formatMessage(eventType: NotificationEventType, channel: NotificationChannel, data: Record<string, unknown>): { title: string; body: string };
}
```

### 7.2 Dispatch Flow (Pseudocode)

```
dispatch(eventType, userId, data):
  1. isCritical = CRITICAL_EVENT_TYPES.includes(eventType)
  2. category = EVENT_TYPE_TO_CATEGORY[eventType]
  3. channels = resolveChannels(eventType, userId)
     - Load user preferences for this category
     - If isCritical: force all enabled channels regardless of preference toggles
     - If not isCritical AND isQuietHours: defer (store with scheduled delivery time)
     - Filter to channels the user has enabled (unless critical)
  4. For each channel in channels:
     a. { title, body } = formatMessage(eventType, channel, data)
     b. Create notification row in DB (for in_app channel)
     c. Create delivery_log entry with status "pending"
     d. Call channelDispatcher.send(channel, userId, title, body, data)
     e. Update delivery_log: status = "sent" or "failed"
     f. If failed: schedule retry via DeliveryRetryManager
```

### 7.3 Event Type Enum

Defined in schema as `NOTIFICATION_EVENT_TYPES` (see Section 5.2). Each event type maps to:
- A category (for preference lookup)
- A criticality flag
- A message template per channel (title + body with `{{placeholder}}` interpolation)

### 7.4 Channel Dispatcher Pattern

```typescript
// Base interface
interface ChannelDispatcher {
  channel: NotificationChannel;
  send(userId: string, title: string, body: string, data: Record<string, unknown>): Promise<DispatchResult>;
}

// DispatchResult
interface DispatchResult {
  success: boolean;
  externalId?: string;  // e.g., SendGrid message ID
  error?: string;
}
```

**InAppDispatcher**: Writes to the `notifications` table. Always succeeds (DB write). This is the primary channel for the prototype.

**EmailDispatcher (PROTOTYPE)**: Logs the email content to `console.log` with a `[EMAIL STUB]` prefix. Returns success. Production: calls SendGrid/Postmark API.

**PushDispatcher (PROTOTYPE)**: Logs push content to `console.log` with a `[PUSH STUB]` prefix. Returns success. Production: calls FCM for mobile, Web Push API for browser.

### 7.5 Quiet Hours Enforcement

```
isQuietHours(userId, category):
  1. Load preference row for userId + category
  2. If quietHoursEnabled is false: return false
  3. Convert current server time to user's timezone (quietHoursTimezone)
  4. Check if current local time falls within [quietHoursStart, quietHoursEnd]
     - Handle overnight ranges (e.g., 22:00-07:00 wraps past midnight)
  5. Return true/false
```

When quiet hours are active for a non-critical notification:
- The notification is still created in the DB (so it appears when the user next opens the app).
- Email and push delivery are deferred: a `scheduledFor` timestamp is set to `quietHoursEnd` and the delivery is queued.
- For the prototype, this deferral uses `setTimeout`. For production, it uses a BullMQ delayed job.

### 7.6 Critical Override

Critical notifications skip these checks entirely:
- Preference toggles are ignored (all enabled channels fire)
- Quiet hours are ignored (immediate delivery)
- The notification row has `isCritical: true` for UI distinction (e.g., red accent)

### 7.7 Message Templates

File: `server/services/notification-templates.ts`

A lookup table mapping `(eventType, channel)` to a template object:

```typescript
const TEMPLATES: Record<NotificationEventType, Record<NotificationChannel, { title: string; body: string }>> = {
  payment_successful: {
    in_app: {
      title: "Payment Received",
      body: "Payment of {{amount_paid}} for {{recipient_name}} received. TXN: {{txn_id}}"
    },
    email: {
      title: "Your Payment of {{amount_paid}} Has Been Received - {{txn_id}}",
      body: "..." // Full email body template
    },
    web_push: {
      title: "Payment Received",
      body: "{{amount_paid}} to {{recipient_name}} ({{txn_id}})"
    },
    mobile_push: {
      title: "Payment Received",
      body: "{{amount_paid}} to {{recipient_name}} ({{txn_id}})"
    }
  },
  // ... all 20 event types
};
```

Template interpolation replaces `{{key}}` with values from the `data` object. The exact copy for each event type is specified in the requirements document (US-002 through US-013) and must be implemented verbatim.

### 7.8 Delivery Retry Manager

File: `server/services/delivery-retry-manager.ts`

```typescript
class DeliveryRetryManager {
  private readonly RETRY_DELAYS = [60_000, 300_000, 900_000]; // 1m, 5m, 15m
  private readonly MAX_ATTEMPTS = 3;

  async scheduleRetry(deliveryLogId: string, attemptNumber: number): Promise<void>;
  async executeFallback(notificationId: string, failedChannel: NotificationChannel): Promise<void>;
}
```

**Fallback chain:**
- Email fails --> fall back to In-App
- Web Push fails --> fall back to Email
- Mobile Push fails --> fall back to Email
- In-App fails --> fall back to Email

After all retries on all channels are exhausted, the delivery log entry is marked `status: "failed"`. For critical notifications, an internal alert is logged (prototype: console.error; production: PagerDuty/Slack webhook).

---

## 8. Notification Scheduler

File: `server/services/notification-scheduler.ts`

Handles time-based notification events.

### 8.1 Bank Transfer Auto-Cancel (US-007)

When a transaction is created with `paymentMethod = "bank_transfer"`:

```
onTransactionCreated(txnId, userId, createdAt):
  expiresAt = createdAt + 30 minutes

  // Schedule reminder at 15 minutes remaining
  setTimeout(() => {
    if (txn still unpaid):
      NotificationService.dispatch("auto_cancel_reminder_15", userId, { txnId, amount, expiresAt })
  }, 15 * 60 * 1000)

  // Schedule reminder at 5 minutes remaining
  setTimeout(() => {
    if (txn still unpaid):
      NotificationService.dispatch("auto_cancel_reminder_5", userId, { txnId, amount, expiresAt })
  }, 25 * 60 * 1000)

  // Schedule auto-cancel at 30 minutes
  setTimeout(() => {
    if (txn still unpaid):
      cancelTransaction(txnId)
      NotificationService.dispatch("auto_cancel_executed", userId, { txnId, amount })
  }, 30 * 60 * 1000)
```

**Production migration**: Replace `setTimeout` with three BullMQ delayed jobs. Each job checks payment status before dispatching. Jobs survive server restart.

### 8.2 Document Upload Reminders (US-013)

Same pattern: schedule reminders at T-24h and T-6h before the document deadline.

### 8.3 Maintenance Notices (US-008)

Admin-triggered: when a maintenance window is created, schedule notices at T-3d, T-1d, T-2h.

### 8.4 Retention Cleanup

On server startup and then every 6 hours:

```
cleanupExpiredNotifications():
  1. UPDATE notifications SET archivedAt = NOW()
     WHERE expiresAt < NOW() AND archivedAt IS NULL
  2. DELETE FROM notifications WHERE deleteAfter < NOW()
```

---

## 9. Frontend Architecture

### 9.1 useNotifications Hook

File: `client/src/hooks/use-notifications.ts`

```typescript
function useNotifications() {
  // Polls GET /api/notifications/unread-count every 30 seconds
  const unreadCountQuery = useQuery({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // Fetches full notification list on demand (when panel is opened)
  const notificationsQuery = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: false, // only fetch when panel opens
  });

  // Mutations
  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  return {
    unreadCount: unreadCountQuery.data?.count ?? 0,
    notifications: notificationsQuery.data?.notifications ?? [],
    isLoading: notificationsQuery.isLoading,
    fetchNotifications: () => notificationsQuery.refetch(),
    markRead: markReadMutation.mutate,
    markAllRead: markAllReadMutation.mutate,
    dismiss: dismissMutation.mutate,
  };
}
```

### 9.2 Component Hierarchy

```
Header.tsx
  +-- NotificationBell (bell icon + badge)
        +-- NotificationPanel (slide-in overlay, Framer Motion)
              +-- NotificationFilters (category, read/unread)
              +-- NotificationList
              |     +-- NotificationItem (individual card)
              +-- NotificationEmpty (empty state)
              +-- ArchiveLink ("View Archive")

Pages:
  NotificationArchivePage (/notifications/archive)
  NotificationPreferencesPage (/notifications/preferences)
```

### 9.3 Bell Badge + Unread Count

The bell icon in `Header.tsx` is replaced with the `NotificationBell` component:

- Badge shows the numeric unread count (max display: "99+")
- Badge is hidden when count is 0
- Badge updates every 30 seconds via the polling query
- Subtle scale animation on count change (Framer Motion, respects `prefers-reduced-motion`)
- ARIA live region: `<span role="status" aria-live="polite" className="sr-only">{count} unread notifications</span>`

### 9.4 Polling vs WebSocket Decision

**Prototype**: HTTP polling every 30 seconds via TanStack Query `refetchInterval`.

- Simple, no new infrastructure.
- Unread count endpoint is lightweight (single `COUNT(*)` query).
- 30-second delay is acceptable for a prototype; most notifications are not time-critical to the second in the UI (the SLA is for backend delivery, not UI refresh).

**Production migration**: Replace polling with Server-Sent Events (SSE) or WebSocket for sub-second UI updates. The hook interface remains the same -- only the data source changes internally.

---

## 10. Security Architecture

### 10.1 Authentication and Authorization

- All `/api/notifications/*` endpoints require `req.session.userId` to be set (existing session auth pattern).
- Every database query includes `WHERE user_id = $sessionUserId` -- no user can access another user's notifications.
- The `/api/notifications/dispatch` endpoint is internal-only: it is not registered as a client-facing route. It is called only by server-side code (e.g., `notificationService.dispatch()` method call, not an HTTP request).
- Preference changes are audit-logged with timestamp and previous values (stored in a `preference_audit` JSONB column or a separate audit log table; for prototype, console.log is sufficient).

### 10.2 Data Security

- **In transit**: HTTPS enforced by Render. All API requests use `credentials: "include"` for secure session cookies.
- **At rest**: PostgreSQL on Render uses encrypted storage.
- **PII in notifications**: Push notification payloads (Web Push, Mobile Push) must contain only reference IDs (transaction ID), never amounts, names, or account details. The full notification content is fetched from the API when the user taps the notification.
- **Email notifications**: Mask sensitive data. Show only last 4 digits of account numbers. Never include full sort codes or IBANs.

### 10.3 OWASP Top 10 Mitigations

| Threat | Mitigation |
|--------|------------|
| A01 Broken Access Control | Every query scoped to `req.session.userId`; no admin endpoints exposed to client |
| A02 Cryptographic Failures | Session cookies are `httpOnly`, `secure`, `sameSite: strict` |
| A03 Injection | Drizzle ORM parameterized queries; Zod validation on all inputs |
| A04 Insecure Design | Critical notifications cannot be silenced by user preference manipulation |
| A05 Security Misconfiguration | No notification content in error responses; structured error messages only |
| A07 XSS | Notification body is rendered as text content, never `dangerouslySetInnerHTML` |
| A08 Software Integrity | Template interpolation uses allowlisted keys only, not arbitrary user input |
| A09 Logging Failures | Every delivery attempt logged with status in `notification_delivery_log` |

### 10.4 GDPR Compliance

- **Right to erasure**: `DELETE FROM notifications WHERE user_id = $id` and `DELETE FROM notification_preferences WHERE user_id = $id` when account is deleted. Cascading delete is configured via `onDelete: "cascade"` on foreign keys.
- **Data portability**: A `GET /api/notifications/export` endpoint (deferred to post-prototype) returns all notification data as JSON.
- **Retention limits**: Hard delete at 90 days, enforced by the cleanup job.
- **Consent**: Push notification permission requested via browser Notification API with clear value explanation. Marketing/promotional notifications require explicit opt-in toggle (default: off).

---

## 11. Scalability Design

### 11.1 Current Scale Target (Prototype)

- Single Render web service (Express.js)
- Single PostgreSQL instance (Render managed)
- Target: up to 100 concurrent users, ~1,000 notifications/day

### 11.2 Scaling Strategy

**At 10x load (1,000 users, 10,000 notifications/day):**
- Add Redis + BullMQ for durable job queue (replaces setTimeout)
- Add database indexes on `(user_id, created_at DESC)` for query performance (already defined)
- Consider connection pooling (pgBouncer or Drizzle connection pool config)
- Move email sending to a background worker process

**At 100x load (10,000+ users, 100,000+ notifications/day):**
- Separate notification service into its own microservice
- Add WebSocket/SSE gateway for real-time delivery (replace polling)
- Partition notifications table by `created_at` (monthly partitions)
- Add read replicas for notification queries
- CDN for email template assets
- Rate limiting on notification dispatch to prevent spam

### 11.3 Scale-Up Triggers

| Metric | Threshold | Action |
|--------|-----------|--------|
| Notification query p95 | > 200ms | Add composite indexes, review query plans |
| Unread count query p95 | > 50ms | Add materialized count or Redis cache |
| Delivery backlog | > 100 pending | Scale worker, increase concurrency |
| Table size | > 1M rows | Implement table partitioning |

---

## 12. Render Deployment Architecture

| Service | Type | Plan | Purpose |
|---------|------|------|---------|
| rhemito-web | Web Service | Free/Starter | Express.js + React (existing) |
| rhemito-db | PostgreSQL | Free/Starter | Main database (existing) |

No additional Render services required for the prototype. The notification system runs in-process within the existing Express server.

**Production additions (deferred):**

| Service | Type | Purpose |
|---------|------|---------|
| rhemito-redis | Redis | BullMQ job queue for durable scheduling |
| rhemito-worker | Background Worker | Process notification queue, retries, cleanup |

**Environment variables required (notification-specific):**

| Variable | Purpose | Required For |
|----------|---------|-------------|
| `SENDGRID_API_KEY` | Email delivery | Production email channel |
| `SENDGRID_FROM_EMAIL` | Sender address for transactional emails | Production email channel |
| `VAPID_PUBLIC_KEY` | Web Push VAPID key (public) | Production web push |
| `VAPID_PRIVATE_KEY` | Web Push VAPID key (private) | Production web push |
| `FCM_SERVER_KEY` | Firebase Cloud Messaging key | Production mobile push |

None of these are needed for the prototype (all channels except in-app are stubbed).

**Health check**: The existing `GET /api/health` endpoint is sufficient. No notification-specific health checks needed for the prototype.

---

## 13. Prototype Implementation Plan

### 13.1 What Is Fully Implemented

| Component | Scope |
|-----------|-------|
| Drizzle schema (3 tables) | Full -- all fields, indexes, relations |
| Notification API (8 endpoints) | Full -- all CRUD, preferences, pagination |
| NotificationService class | Full -- dispatch, preferences, quiet hours, critical override |
| InAppDispatcher | Full -- writes to DB |
| Message templates | Full -- all 20 event types, in-app channel copy from requirements |
| NotificationBell component | Full -- badge, panel, list, mark read, dismiss |
| NotificationPreferencesPage | Full -- toggle UI for all categories and channels |
| Notification archive page | Full -- paginated archive view |
| Retention cleanup job | Full -- runs on server startup + setInterval every 6 hours |

### 13.2 What Is Simulated (Stubbed)

| Component | Prototype Behavior | Production Behavior |
|-----------|-------------------|---------------------|
| EmailDispatcher | `console.log("[EMAIL] To: user@example.com, Subject: ...")` | SendGrid/Postmark API call |
| PushDispatcher (web) | `console.log("[WEB PUSH] ...")` | Web Push API with VAPID |
| PushDispatcher (mobile) | Not called (mobile push channel ignored) | FCM API call |
| Scheduled reminders | `setTimeout` (lost on restart) | BullMQ delayed jobs (durable) |
| Delivery retry | `setTimeout` with exponential backoff (lost on restart) | BullMQ retry with backoff (durable) |
| Preference audit log | `console.log` | Separate audit table or external audit service |

### 13.3 What Is Deferred

| Component | Reason |
|-----------|--------|
| Service Worker for Web Push | Requires VAPID keys, HTTPS service worker registration |
| Mobile Push (FCM) | Requires native mobile app |
| Email HTML templates | Requires design approval from uiux-designer |
| Notification export (GDPR portability) | Post-prototype feature |
| WebSocket/SSE real-time delivery | Polling is sufficient for prototype |
| BullMQ + Redis infrastructure | Not needed until production scale |

### 13.4 Implementation Order

Phase 1 (Foundation):
1. Add Drizzle schema + run migration
2. Implement NotificationService core (dispatch, templates, preferences)
3. Implement InAppDispatcher
4. Implement API routes (all 8 endpoints)

Phase 2 (Frontend):
5. Implement useNotifications hook
6. Implement NotificationBell + NotificationPanel
7. Implement NotificationPreferencesPage
8. Implement NotificationArchivePage

Phase 3 (Scheduling + Retry):
9. Implement NotificationScheduler (setTimeout-based)
10. Implement DeliveryRetryManager (setTimeout-based)
11. Wire scheduler to transaction creation flow (bank transfer)

Phase 4 (Integration):
12. Wire dispatch calls into existing transaction flows
13. Stub EmailDispatcher + PushDispatcher
14. End-to-end testing

---

## 14. Architecture Decision Records

### ADR-001: In-Process Event Emitter Over Job Queue for Prototype

- **Date**: 2026-04-10
- **Status**: Accepted
- **Context**: The notification system needs to dispatch events asynchronously. Production systems typically use BullMQ/Redis for durable queuing. However, the project is a prototype deployed on Render free/starter tier.
- **Decision**: Use Node.js `EventEmitter` and `setTimeout` for the prototype. Design the service interface so that swapping to BullMQ requires changing only the queue adapter, not the dispatch API.
- **Alternatives considered**:
  - BullMQ + Redis: Rejected -- requires a Redis instance on Render ($7/month minimum), overkill for prototype scale.
  - pg-boss (PostgreSQL-based queue): Rejected -- adds polling load to the database, and the library is less actively maintained.
  - Direct synchronous dispatch: Rejected -- would block the request thread during email/push sends.
- **Consequences**: Scheduled jobs (reminders, auto-cancel) are lost on server restart. Acceptable for prototype; documented as a known limitation.

### ADR-002: HTTP Polling Over WebSocket/SSE for Real-Time Updates

- **Date**: 2026-04-10
- **Status**: Accepted
- **Context**: Notifications need to appear in the bell badge with reasonable timeliness.
- **Decision**: Poll `GET /api/notifications/unread-count` every 30 seconds using TanStack Query `refetchInterval`. Full notification list fetched on-demand when the panel opens.
- **Alternatives considered**:
  - WebSocket: Rejected -- requires sticky sessions on Render, adds complexity for managing connection lifecycle, overkill for prototype.
  - Server-Sent Events (SSE): Rejected -- Express SSE support is limited without additional middleware; Render free tier may not handle long-lived connections well.
- **Consequences**: Up to 30-second delay between notification dispatch and badge update. Acceptable for prototype.

### ADR-003: Single Notifications Table Over Separate Active/Archive Tables

- **Date**: 2026-04-10
- **Status**: Accepted
- **Context**: Requirements specify a 7-day active window and 90-day archive retention.
- **Decision**: Use a single `notifications` table with `expiresAt` and `archivedAt` columns. Active query: `WHERE expiresAt > NOW() AND archivedAt IS NULL`. Archive query: `WHERE archivedAt IS NOT NULL AND deleteAfter > NOW()`.
- **Alternatives considered**:
  - Two tables (active + archive) with a cron job to move rows: Rejected -- adds complexity for the prototype; partitioning achieves the same at scale.
  - Time-series table partitioning: Rejected -- PostgreSQL on Render free tier does not support declarative partitioning easily; deferred to 100x scale.
- **Consequences**: A single table may become large over time. Mitigated by the `deleteAfter` cleanup job and proper indexing.

### ADR-004: Cursor-Based Pagination Over Offset-Based

- **Date**: 2026-04-10
- **Status**: Accepted
- **Context**: Notifications are real-time -- new items are inserted frequently. Offset-based pagination produces duplicate or skipped items when the underlying data changes between page requests.
- **Decision**: Use cursor-based pagination (`?cursor=<lastId>&limit=20`). The cursor is the `id` of the last item on the current page. The next page query is `WHERE id < cursor ORDER BY created_at DESC LIMIT 20`.
- **Alternatives considered**:
  - Offset/limit: Rejected -- unstable with real-time inserts.
  - Keyset pagination on `createdAt`: Rejected -- timestamps can have duplicates; UUID-based cursor is unique.
- **Consequences**: Cannot jump to arbitrary page numbers. Acceptable for notification UIs which are always scrolled sequentially.

---

## 15. Non-Functional Requirements Traceability

| NFR | Requirement | Technical Approach | How Measured |
|-----|------------|-------------------|--------------|
| In-app latency | p95 < 5s from trigger | Direct DB write in InAppDispatcher; no queue hop | Server-side timing logs |
| Push latency | p95 < 10s from trigger | Async dispatch via event emitter | Delivery log timestamps |
| Email latency | p95 < 60s from trigger | Async dispatch; email provider SLA | Delivery log timestamps |
| Panel load time | p95 < 500ms | Indexed query, 20-item limit, no joins | Client-side performance API |
| Accessibility | WCAG 2.2 AA | ARIA live regions, keyboard nav, 44px touch targets, reduced-motion | Automated a11y audit (axe-core) |
| Retention | 7-day active, 90-day total | `expiresAt` + `deleteAfter` columns, cleanup job | Automated test |
| Delivery reliability | >= 99.5% in-app | Retry manager, fallback channels, delivery log | Delivery log success rate query |

---

## 16. Open Questions

| # | Question | Blocks | Owner |
|---|----------|--------|-------|
| 1 | Should the notification panel be a slide-in drawer or a dropdown popover? | Frontend implementation (Phase 2) | uiux-designer |
| 2 | Should quiet hours be global (one setting for all categories) or per-category? | Preference schema (currently per-category) | Product Owner |
| 3 | What is the email "from" address and domain for transactional emails? | Production email setup | Product Owner |
| 4 | Should notification preferences be accessible from a dedicated page or a section within Settings? | Routing + navigation | uiux-designer |
| 5 | For the prototype, should dispatching a test notification be possible from a dev/debug panel? | DX convenience | Engineer |

---

## 17. Out of Scope

- SMS notifications (cost-prohibitive; deferred post-launch)
- WhatsApp notifications (requires Meta Business API approval)
- Admin notification analytics dashboard (Phase 2)
- Recipient-facing notifications (recipients are not Rhemito users in v1)
- Rich email HTML templates (requires uiux-designer approval; prototype uses plain text stubs)
- Service Worker registration for Web Push (requires VAPID infrastructure)
- Native mobile push integration (requires mobile app)
- Notification batching/digests (Phase 2 optimization)
- Real-time WebSocket/SSE delivery (prototype uses polling)

---

*End of Technical Specification*
