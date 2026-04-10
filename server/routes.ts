import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { validatePromoCode, promoStorage, type PromoValidationRequest } from "./promocode";
import { bonusService } from "./bonus";
import { registerAuthRoutes } from "./auth";
import {
  dispatchNotification,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  getActiveNotifications,
  getArchivedNotifications,
  getNotificationById,
  getUnreadCount,
  getUserPreferences,
  updateUserPreferences,
} from "./notificationService";
import type { NotificationEventType, NotificationPreferences as DBPrefs } from "@shared/schema";

// ─── Preferences shape adapter ───────────────────────────────────────────────
// The DB stores a flat structure (inAppEnabled, paymentEvents, quietHoursEnabled, …).
// The client works in a nested shape ({ channels, eventTypes, quietHours }).
// These two helpers translate between the wire format and the DB format so
// the client and server never have to care about the other side's layout.

interface ClientPrefs {
  channels: {
    inApp: boolean;
    browserPush: boolean;
    email: boolean;
    mobilePush: boolean;
  };
  eventTypes: {
    payment: boolean;
    transactionStatus: boolean;
    refund: boolean;
    kyc: boolean;
    security: boolean;
    system: boolean;
    marketing: boolean;
  };
  quietHours: {
    enabled: boolean;
    from: string;
    to: string;
    timezone: string;
  };
}

function dbToClientPrefs(p: DBPrefs): ClientPrefs {
  return {
    channels: {
      inApp: p.inAppEnabled,
      browserPush: p.webPushEnabled,
      email: p.emailEnabled,
      mobilePush: p.mobilePushEnabled,
    },
    eventTypes: {
      payment: p.paymentEvents,
      transactionStatus: p.transactionEvents,
      refund: p.refundEvents,
      kyc: p.kycEvents,
      security: p.securityEvents,
      system: p.maintenanceEvents,
      marketing: p.marketingEvents,
    },
    quietHours: {
      enabled: p.quietHoursEnabled,
      from: p.quietHoursStart ?? "22:00",
      to: p.quietHoursEnd ?? "08:00",
      timezone: "UTC",
    },
  };
}

function clientToDbPrefs(c: Partial<ClientPrefs>): Partial<DBPrefs> {
  const out: Partial<DBPrefs> = {};
  if (c.channels) {
    if (c.channels.inApp !== undefined) out.inAppEnabled = c.channels.inApp;
    if (c.channels.browserPush !== undefined) out.webPushEnabled = c.channels.browserPush;
    if (c.channels.email !== undefined) out.emailEnabled = c.channels.email;
    if (c.channels.mobilePush !== undefined) out.mobilePushEnabled = c.channels.mobilePush;
  }
  if (c.eventTypes) {
    // AC 1.5 — critical categories (payment, transactionStatus, kyc) cannot be
    // turned off via this endpoint. Even if the client sends false, force true.
    out.paymentEvents = true;
    out.transactionEvents = true;
    out.kycEvents = true;
    if (c.eventTypes.refund !== undefined) out.refundEvents = c.eventTypes.refund;
    if (c.eventTypes.security !== undefined) out.securityEvents = c.eventTypes.security;
    if (c.eventTypes.system !== undefined) out.maintenanceEvents = c.eventTypes.system;
    if (c.eventTypes.marketing !== undefined) out.marketingEvents = c.eventTypes.marketing;
  }
  if (c.quietHours) {
    if (c.quietHours.enabled !== undefined) out.quietHoursEnabled = c.quietHours.enabled;
    if (c.quietHours.from !== undefined) out.quietHoursStart = c.quietHours.from;
    if (c.quietHours.to !== undefined) out.quietHoursEnd = c.quietHours.to;
  }
  return out;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth routes
  registerAuthRoutes(app);
  // Promo Code Validation Endpoint
  app.post("/api/promocodes/validate", (req, res) => {
    try {
      const validationReq: PromoValidationRequest = {
        code: req.body.code,
        amount: parseFloat(req.body.amount),
        currency: req.body.currency,
        userId: req.body.userId || "user_123", // Default user for demo
        sourceCurrency: req.body.sourceCurrency,
        destCurrency: req.body.destCurrency,
        paymentMethod: req.body.paymentMethod,
      };

      const result = validatePromoCode(validationReq);

      if (result.valid) {
        return res.json({
          valid: true,
          appliedDiscount: result.appliedDiscount,
          displayText: result.displayText,
          promo: result.promo,
        });
      } else {
        return res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error("Promo validation error:", error);
      return res.status(500).json({ error: "Failed to validate promo code" });
    }
  });

  // Promo Code Application Endpoint (called on transaction submission)
  app.post("/api/promocodes/apply", (req, res) => {
    try {
      const { code, userId, transactionId, discountAmount } = req.body;

      const promo = promoStorage.getPromoByCode(code);
      if (!promo) {
        return res.status(404).json({ error: "Promo code not found" });
      }

      // Apply the promo code (increment usage, track redemption)
      promoStorage.applyPromoCode(
        promo.id,
        transactionId || `txn_${Date.now()}`,
        userId || "user_123",
        discountAmount || 0
      );

      return res.json({ success: true, message: "Promo code applied successfully" });
    } catch (error) {
      console.error("Promo application error:", error);
      return res.status(500).json({ error: "Failed to apply promo code" });
    }
  });

  // --- Bonus Redemption Endpoints ---

  app.get("/api/bonus/balance", (req, res) => {
    const userId = (req.query.userId as string) || "user_123";
    const balance = bonusService.getBalance(userId);
    res.json({ balance });
  });

  app.post("/api/bonus/redeem", (req, res) => {
    const { amount, userId } = req.body;
    const success = bonusService.redeem(parseFloat(amount), userId || "user_123");

    if (success) {
      res.json({ success: true, message: "Bonus redeemed successfully" });
    } else {
      res.status(400).json({ success: false, message: "Insufficient bonus balance" });
    }
  });

  // ─── Notification Routes ─────────────────────────────────────────────────

  /**
   * Auth guard — reusable inline helper.
   * Falls back to a default prototype user when no session is present,
   * matching the pattern used by /api/promocodes/validate and /api/bonus/balance.
   * Swap this for a strict check when the auth flow is wired end-to-end.
   */
  function requireAuth(req: Request, _res: Response): string | null {
    return req.session?.userId ?? "user_123";
  }

  // GET /api/notifications — active list, paginated
  app.get("/api/notifications", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
      const notifications = await getActiveNotifications(userId, page);
      const unreadCount = await getUnreadCount(userId);
      return res.json({ data: notifications, meta: { page, pageSize: 20, unreadCount } });
    } catch (err) {
      console.error("GET /api/notifications error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch notifications" } });
    }
  });

  // GET /api/notifications/unread-count
  app.get("/api/notifications/unread-count", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    try {
      const count = await getUnreadCount(userId);
      return res.json({ count });
    } catch (err) {
      console.error("GET /api/notifications/unread-count error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch unread count" } });
    }
  });

  // GET /api/notifications/preferences — returns the client nested shape
  app.get("/api/notifications/preferences", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    try {
      const prefs = await getUserPreferences(userId);
      // Return as a bare nested object so useQuery can read prefs.channels.inApp directly
      return res.json(dbToClientPrefs(prefs));
    } catch (err) {
      console.error("GET /api/notifications/preferences error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch preferences" } });
    }
  });

  // GET /api/notifications/archive — archived list, paginated
  app.get("/api/notifications/archive", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
      const notifications = await getArchivedNotifications(userId, page);
      return res.json({ data: notifications, meta: { page, pageSize: 20 } });
    } catch (err) {
      console.error("GET /api/notifications/archive error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch archive" } });
    }
  });

  // PATCH /api/notifications/read-all — mark all read
  app.patch("/api/notifications/read-all", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    try {
      await markAllNotificationsRead(userId);
      return res.json({ success: true });
    } catch (err) {
      console.error("PATCH /api/notifications/read-all error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to mark all as read" } });
    }
  });

  // PATCH /api/notifications/preferences — accepts client nested shape
  app.patch("/api/notifications/preferences", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    try {
      const patch = clientToDbPrefs(req.body ?? {});
      const updated = await updateUserPreferences(userId, patch);
      // Dispatch a confirmation in-app notification
      await dispatchNotification({ userId, type: "preferences_updated", data: {} });
      return res.json(dbToClientPrefs(updated));
    } catch (err) {
      console.error("PATCH /api/notifications/preferences error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update preferences" } });
    }
  });

  // GET /api/notifications/:id — fetch a single notification
  app.get("/api/notifications/:id", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    try {
      const notification = await getNotificationById(req.params.id, userId);
      if (!notification) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification not found" } });
      }
      return res.json({ data: notification });
    } catch (err) {
      console.error("GET /api/notifications/:id error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch notification" } });
    }
  });

  // PATCH /api/notifications/:id/read — mark one read
  app.patch("/api/notifications/:id/read", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    try {
      await markNotificationRead(req.params.id, userId);
      return res.json({ success: true });
    } catch (err) {
      console.error("PATCH /api/notifications/:id/read error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to mark notification as read" } });
    }
  });

  // DELETE /api/notifications/:id — dismiss (soft archive)
  app.delete("/api/notifications/:id", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    try {
      await dismissNotification(req.params.id, userId);
      return res.status(204).send();
    } catch (err) {
      console.error("DELETE /api/notifications/:id error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to dismiss notification" } });
    }
  });

  // POST /api/notifications/dispatch — client-triggered notification dispatch
  app.post("/api/notifications/dispatch", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    try {
      const { type, data = {} } = req.body as { type: NotificationEventType; data: Record<string, unknown> };
      if (!type) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "type is required" } });
      }
      await dispatchNotification({ userId, type, data });
      const count = await getUnreadCount(userId);
      return res.json({ success: true, unreadCount: count });
    } catch (err) {
      console.error("POST /api/notifications/dispatch error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to dispatch notification" } });
    }
  });

  // POST /api/notifications/test — DEV ONLY: dispatch a test notification
  app.post("/api/notifications/test", async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
    }

    const userId = requireAuth(req, res);
    if (!userId) return;

    try {
      const { type, data = {} } = req.body as { type: NotificationEventType; data: Record<string, unknown> };
      if (!type) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "type is required" } });
      }
      await dispatchNotification({ userId, type, data });
      const count = await getUnreadCount(userId);
      return res.json({ success: true, unreadCount: count });
    } catch (err) {
      console.error("POST /api/notifications/test error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to dispatch test notification" } });
    }
  });

  return httpServer;
}
