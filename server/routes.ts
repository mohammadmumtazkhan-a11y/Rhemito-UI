import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // Promo Code Validation
  app.post("/api/promocodes/validate", async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ valid: false, message: "Code required" });

    const promo = await storage.getPromoCode(code);
    if (!promo || promo.status !== 'active') {
      return res.json({ valid: false, message: "Invalid or expired promo code" });
    }

    res.json({
      valid: true,
      promo: {
        code: promo.code,
        type: promo.type,
        value: promo.value,
        text: "Code Valid"
      }
    });
  });

  // Apply Promo Code
  app.post("/api/promocodes/apply", async (req, res) => {
    const { code } = req.body;
    if (code) {
      await storage.applyPromoCode(code);
    }
    res.json({ success: true });
  });

  return httpServer;
}
