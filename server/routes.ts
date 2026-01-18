import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { validatePromoCode, promoStorage, type PromoValidationRequest } from "./promocode";
import { bonusService } from "./bonus";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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

  return httpServer;
}
