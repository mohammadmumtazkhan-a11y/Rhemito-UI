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
import type { NotificationEventType } from "@shared/schema";

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

  // GET /api/notifications/preferences
  app.get("/api/notifications/preferences", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    try {
      const prefs = await getUserPreferences(userId);
      return res.json({ data: prefs });
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

  // PATCH /api/notifications/preferences — update preferences
  app.patch("/api/notifications/preferences", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    try {
      const updated = await updateUserPreferences(userId, req.body);
      // Dispatch a confirmation in-app notification
      await dispatchNotification({ userId, type: "preferences_updated", data: {} });
      return res.json({ data: updated });
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
