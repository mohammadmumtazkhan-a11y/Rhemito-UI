/**
 * Notification Service — Rhemito
 *
 * Prototype implementation using in-memory storage, matching the rest of the
 * server-side architecture. All channel dispatchers beyond in_app are stubs
 * that console.log — ready to be replaced with real providers (SendGrid,
 * Firebase FCM, Web Push API) without changing the public interface.
 */

import { randomUUID } from "crypto";
import type {
  Notification,
  NotificationPreferences,
  NotificationDeliveryLog,
  NotificationEventType,
  NotificationChannel,
} from "@shared/schema";

// ─── In-memory stores ─────────────────────────────────────────────────────────

const notificationsStore = new Map<string, Notification>();
const preferencesStore = new Map<string, NotificationPreferences>();
const deliveryLogStore = new Map<string, NotificationDeliveryLog>();

// ─── Active reminder timers (keyed by txnId) ─────────────────────────────────

const activeTimers = new Map<string, NodeJS.Timeout[]>();

// ─── Critical types — cannot be suppressed by preferences or quiet hours ──────

export const CRITICAL_TYPES: NotificationEventType[] = [
  "payment_failed",
  "transaction_cancelled_admin",
  "document_required",
  "under_review",
];

// ─── Event → category mapping (for preference gating) ────────────────────────

type EventCategory =
  | "paymentEvents"
  | "transactionEvents"
  | "refundEvents"
  | "kycEvents"
  | "securityEvents"
  | "maintenanceEvents"
  | "marketingEvents";

const EVENT_CATEGORY_MAP: Record<NotificationEventType, EventCategory> = {
  payment_received: "paymentEvents",
  awaiting_payment: "paymentEvents",
  payment_failed: "paymentEvents",
  transaction_complete: "transactionEvents",
  transaction_failed: "transactionEvents",
  transaction_cancelled_customer: "transactionEvents",
  transaction_cancelled_admin: "transactionEvents",
  transaction_cancelled_timeout: "transactionEvents",
  auto_cancel_reminder_15: "transactionEvents",
  auto_cancel_reminder_5: "transactionEvents",
  refund_processed: "refundEvents",
  under_review: "kycEvents",
  review_complete: "kycEvents",
  document_required: "kycEvents",
  document_received: "kycEvents",
  maintenance_scheduled: "maintenanceEvents",
  maintenance_complete: "maintenanceEvents",
  preferences_updated: "securityEvents",
};

// ─── Notification copy templates ──────────────────────────────────────────────

interface NotificationContent {
  title: string;
  body: string;
}

export function buildNotificationContent(
  type: NotificationEventType,
  data: Record<string, unknown>
): NotificationContent {
  const txnId = String(data.txnId ?? "");
  const recipient = String(data.recipientName ?? data.recipient ?? "Recipient");
  const amount = String(data.amount ?? "");
  const currency = String(data.currency ?? "GBP");
  const reason = String(data.reason ?? "");
  const minutesLeft = String(data.minutesLeft ?? "");
  const windowStart = String(data.windowStart ?? "");
  const windowEnd = String(data.windowEnd ?? "");

  const templates: Record<NotificationEventType, NotificationContent> = {
    payment_received: {
      title: "Payment Received",
      body: `We've received your payment of ${amount} ${currency} for transaction ${txnId} to ${recipient}. Your transfer is now being processed.`,
    },
    awaiting_payment: {
      title: "Awaiting Your Payment",
      body: `Your transaction ${txnId} to ${recipient} is waiting for payment of ${amount} ${currency}. Please complete your bank transfer to avoid cancellation.`,
    },
    payment_failed: {
      title: "Payment Failed",
      body: `Your payment of ${amount} ${currency} for transaction ${txnId} could not be processed. Please try again or use a different payment method.`,
    },
    transaction_complete: {
      title: "Transfer Complete",
      body: `Great news! Your transfer of ${amount} ${currency} to ${recipient} (${txnId}) has been completed successfully.`,
    },
    transaction_failed: {
      title: "Transfer Failed",
      body: `Unfortunately your transfer of ${amount} ${currency} to ${recipient} (${txnId}) could not be completed.${reason ? ` Reason: ${reason}.` : ""} Please contact support if you need help.`,
    },
    transaction_cancelled_customer: {
      title: "Transfer Cancelled",
      body: `Your transfer ${txnId} to ${recipient} has been cancelled as requested. A refund will be processed within 3–5 business days.`,
    },
    transaction_cancelled_admin: {
      title: "Transfer Cancelled by Rhemito",
      body: `Your transfer ${txnId} to ${recipient} has been cancelled by our operations team.${reason ? ` Reason: ${reason}.` : ""} Please contact support for more information.`,
    },
    transaction_cancelled_timeout: {
      title: "Transfer Cancelled — Payment Not Received",
      body: `Your transfer ${txnId} to ${recipient} has been automatically cancelled because we did not receive your payment within the required window. Please create a new transfer to try again.`,
    },
    auto_cancel_reminder_15: {
      title: "Action Required — 15 Minutes Left",
      body: `Your transfer ${txnId} to ${recipient} will be automatically cancelled in 15 minutes if payment is not received. Please complete your bank transfer now.`,
    },
    auto_cancel_reminder_5: {
      title: "Urgent — 5 Minutes Left",
      body: `Your transfer ${txnId} to ${recipient} will be cancelled in just 5 minutes. Complete your payment immediately to avoid cancellation.`,
    },
    refund_processed: {
      title: "Refund Processed",
      body: `Your refund of ${amount} ${currency} for transaction ${txnId} has been processed and should arrive in your account within 3–5 business days.`,
    },
    under_review: {
      title: "Transfer Under Review",
      body: `Your transfer ${txnId} is currently under review by our compliance team. We may contact you for additional information. No action is needed at this time.`,
    },
    review_complete: {
      title: "Review Complete",
      body: `The review for your transfer ${txnId} is complete. Your transfer is now being processed.`,
    },
    document_required: {
      title: "Document Required",
      body: `We need additional documents to process your transfer ${txnId}. Please log in and upload the requested documents to avoid delays.`,
    },
    document_received: {
      title: "Documents Received",
      body: `We have received your documents for transfer ${txnId}. Our team will review them shortly and update you on the status.`,
    },
    maintenance_scheduled: {
      title: "Scheduled Maintenance",
      body: `Rhemito will undergo scheduled maintenance${windowStart ? ` from ${windowStart}` : ""}${windowEnd ? ` to ${windowEnd}` : ""}. Some services may be temporarily unavailable during this period.`,
    },
    maintenance_complete: {
      title: "Maintenance Complete",
      body: "Rhemito services have been fully restored. Thank you for your patience.",
    },
    preferences_updated: {
      title: "Notification Preferences Updated",
      body: "Your notification preferences have been successfully updated.",
    },
  };

  return templates[type] ?? { title: "Notification", body: "You have a new notification." };
}

// ─── Quiet hours check ────────────────────────────────────────────────────────

export function isInQuietHours(prefs: NotificationPreferences): boolean {
  if (!prefs.quietHoursEnabled || !prefs.quietHoursStart || !prefs.quietHoursEnd) {
    return false;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const parseTime = (t: string): number => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m ?? 0);
  };

  const start = parseTime(prefs.quietHoursStart);
  const end = parseTime(prefs.quietHoursEnd);

  // Handle overnight range e.g. 22:00 → 08:00
  if (start > end) {
    return currentMinutes >= start || currentMinutes < end;
  }
  return currentMinutes >= start && currentMinutes < end;
}

// ─── Default preferences factory ─────────────────────────────────────────────

function defaultPreferences(userId: string): NotificationPreferences {
  return {
    id: randomUUID(),
    userId,
    inAppEnabled: true,
    emailEnabled: true,
    webPushEnabled: false,
    mobilePushEnabled: false,
    paymentEvents: true,
    transactionEvents: true,
    refundEvents: true,
    kycEvents: true,
    securityEvents: true,
    maintenanceEvents: true,
    marketingEvents: false,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    updatedAt: new Date(),
  };
}

// ─── Channel dispatchers ──────────────────────────────────────────────────────

function dispatchInApp(
  userId: string,
  type: NotificationEventType,
  content: NotificationContent,
  metadata: Record<string, unknown> | null
): Notification {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

  const notification: Notification = {
    id: randomUUID(),
    userId,
    type,
    channel: "in_app",
    title: content.title,
    body: content.body,
    status: "delivered",
    isRead: false,
    metadata: metadata ?? null,
    createdAt: now,
    expiresAt,
    archivedAt: null,
  };

  notificationsStore.set(notification.id, notification);

  // Log delivery
  const logEntry: NotificationDeliveryLog = {
    id: randomUUID(),
    notificationId: notification.id,
    channel: "in_app",
    status: "delivered",
    attemptCount: "1",
    lastAttemptAt: now,
    failureReason: null,
    createdAt: now,
  };
  deliveryLogStore.set(logEntry.id, logEntry);

  return notification;
}

function dispatchEmail(
  userId: string,
  content: NotificationContent
): void {
  console.log(
    `[EMAIL STUB] To: userId=${userId} | Subject: ${content.title} | Body: ${content.body}`
  );
}

function dispatchWebPush(
  userId: string,
  content: NotificationContent
): void {
  console.log(
    `[WEB PUSH STUB] To: userId=${userId} | Title: ${content.title} | Body: ${content.body}`
  );
}

function dispatchMobilePush(
  userId: string,
  content: NotificationContent
): void {
  console.log(
    `[MOBILE PUSH STUB] To: userId=${userId} | Title: ${content.title} | Body: ${content.body}`
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Dispatch a notification to a user across their enabled channels.
 * Critical event types bypass preference and quiet-hours checks.
 */
export async function dispatchNotification(params: {
  userId: string;
  type: NotificationEventType;
  data: Record<string, unknown>;
}): Promise<void> {
  const { userId, type, data } = params;
  const prefs = await getUserPreferences(userId);
  const content = buildNotificationContent(type, data);
  const isCritical = CRITICAL_TYPES.includes(type);
  const category = EVENT_CATEGORY_MAP[type];
  const categoryEnabled = prefs[category as keyof NotificationPreferences] as boolean;
  const quietHours = isInQuietHours(prefs);
  const metadata = Object.keys(data).length > 0 ? data : null;

  // Suppress non-critical events if the category is disabled
  if (!isCritical && !categoryEnabled) {
    return;
  }

  // In-app: always deliver (not gated on quiet hours)
  if (prefs.inAppEnabled || isCritical) {
    dispatchInApp(userId, type, content, metadata);
  }

  // Email: suppress during quiet hours unless critical
  if (prefs.emailEnabled && (isCritical || !quietHours)) {
    dispatchEmail(userId, content);
  }

  // Web push: suppress during quiet hours unless critical
  if (prefs.webPushEnabled && (isCritical || !quietHours)) {
    dispatchWebPush(userId, content);
  }

  // Mobile push: suppress during quiet hours unless critical
  if (prefs.mobilePushEnabled && (isCritical || !quietHours)) {
    dispatchMobilePush(userId, content);
  }
}

/** Mark a single notification as read (only if it belongs to the user). */
export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<void> {
  const n = notificationsStore.get(notificationId);
  if (!n || n.userId !== userId) return;
  notificationsStore.set(notificationId, { ...n, isRead: true });
}

/** Mark all active notifications as read for a user. */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  for (const [id, n] of Array.from(notificationsStore.entries())) {
    if (n.userId === userId && !n.isRead && !n.archivedAt) {
      notificationsStore.set(id, { ...n, isRead: true });
    }
  }
}

/** Soft-delete (archive) a notification (only if it belongs to the user). */
export async function dismissNotification(
  notificationId: string,
  userId: string
): Promise<void> {
  const n = notificationsStore.get(notificationId);
  if (!n || n.userId !== userId) return;
  notificationsStore.set(notificationId, { ...n, archivedAt: new Date() });
}

/**
 * Get active notifications for a user.
 * Active = not archived AND (expiresAt is null OR expiresAt > now).
 * Sorted by createdAt DESC. Paginated: 20 per page.
 */
export async function getActiveNotifications(
  userId: string,
  page = 1
): Promise<Notification[]> {
  const now = new Date();
  const PAGE_SIZE = 20;
  const all = Array.from(notificationsStore.values())
    .filter(
      (n) =>
        n.userId === userId &&
        n.channel === "in_app" &&
        !n.archivedAt &&
        (n.expiresAt === null || (n.expiresAt && n.expiresAt > now))
    )
    .sort((a, b) => {
      const aTime = a.createdAt ? a.createdAt.getTime() : 0;
      const bTime = b.createdAt ? b.createdAt.getTime() : 0;
      return bTime - aTime;
    });

  const offset = (page - 1) * PAGE_SIZE;
  return all.slice(offset, offset + PAGE_SIZE);
}

/**
 * Get archived notifications for a user.
 * Archived = archivedAt is set OR expiresAt is in the past.
 * Sorted by createdAt DESC. Paginated: 20 per page.
 */
export async function getArchivedNotifications(
  userId: string,
  page = 1
): Promise<Notification[]> {
  const now = new Date();
  const PAGE_SIZE = 20;
  const all = Array.from(notificationsStore.values())
    .filter(
      (n) =>
        n.userId === userId &&
        n.channel === "in_app" &&
        (n.archivedAt !== null || (n.expiresAt !== null && n.expiresAt && n.expiresAt <= now))
    )
    .sort((a, b) => {
      const aTime = a.createdAt ? a.createdAt.getTime() : 0;
      const bTime = b.createdAt ? b.createdAt.getTime() : 0;
      return bTime - aTime;
    });

  const offset = (page - 1) * PAGE_SIZE;
  return all.slice(offset, offset + PAGE_SIZE);
}

/** Get a single notification by id (only if it belongs to the user). */
export async function getNotificationById(
  notificationId: string,
  userId: string
): Promise<Notification | null> {
  const n = notificationsStore.get(notificationId);
  if (!n || n.userId !== userId) return null;
  return n;
}

/** Get unread count for a user (active, in-app, not archived). */
export async function getUnreadCount(userId: string): Promise<number> {
  const now = new Date();
  let count = 0;
  for (const n of Array.from(notificationsStore.values())) {
    if (
      n.userId === userId &&
      n.channel === "in_app" &&
      !n.isRead &&
      !n.archivedAt &&
      (n.expiresAt === null || (n.expiresAt && n.expiresAt > now))
    ) {
      count++;
    }
  }
  return count;
}

/** Get (or create with defaults) notification preferences for a user. */
export async function getUserPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const existing = preferencesStore.get(userId);
  if (existing) return existing;

  const defaults = defaultPreferences(userId);
  preferencesStore.set(userId, defaults);
  return defaults;
}

/** Update notification preferences for a user. */
export async function updateUserPreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const existing = await getUserPreferences(userId);
  const updated: NotificationPreferences = {
    ...existing,
    ...prefs,
    userId, // prevent overwriting userId
    id: existing.id, // prevent overwriting id
    updatedAt: new Date(),
  };
  preferencesStore.set(userId, updated);
  return updated;
}

// ─── Bank transfer reminder scheduler ────────────────────────────────────────

/**
 * Schedule automatic cancellation reminder notifications for a bank transfer.
 *
 * @param userId        The user's ID
 * @param txnId         The transaction ID
 * @param recipientName Recipient display name
 * @param amount        Amount being sent (string, e.g. "250.00")
 * @param expiryTime    Absolute Date when the payment window closes (30 min from creation)
 * @returns             A cancel function — call it when the user pays or manually cancels
 */
export function scheduleTransactionReminders(
  userId: string,
  txnId: string,
  recipientName: string,
  amount: string,
  expiryTime: Date
): () => void {
  const now = Date.now();
  const expiryMs = expiryTime.getTime();
  const windowMs = expiryMs - now; // total remaining window

  // Reminder at 15-min mark = fire when 15 min of the window remain
  const fifteenMinMark = windowMs - 15 * 60 * 1000;
  // Reminder at 5-min mark = fire when 5 min of the window remain
  const fiveMinMark = windowMs - 5 * 60 * 1000;

  const timers: NodeJS.Timeout[] = [];
  const data = { txnId, recipientName, recipient: recipientName, amount };

  if (fifteenMinMark > 0) {
    timers.push(
      setTimeout(async () => {
        await dispatchNotification({
          userId,
          type: "auto_cancel_reminder_15",
          data: { ...data, minutesLeft: "15" },
        });
      }, fifteenMinMark)
    );
  }

  if (fiveMinMark > 0) {
    timers.push(
      setTimeout(async () => {
        await dispatchNotification({
          userId,
          type: "auto_cancel_reminder_5",
          data: { ...data, minutesLeft: "5" },
        });
      }, fiveMinMark)
    );
  }

  activeTimers.set(txnId, timers);

  // Return a cancel function
  return () => {
    const existingTimers = activeTimers.get(txnId);
    if (existingTimers) {
      existingTimers.forEach((t) => clearTimeout(t));
      activeTimers.delete(txnId);
    }
  };
}
