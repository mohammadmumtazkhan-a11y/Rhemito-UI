/**
 * GroupPay Routes — funding campaigns & contributions
 *
 * Campaigns live in server-side storage (the same MemStorage pattern as
 * invoices and money requests) so shared /contribute/:campaignId links
 * resolve in any browser, not just the creator's. Follows the conventions of
 * invoiceRoutes.ts: inline Express handlers, session auth with the prototype
 * demo-user fallback, and the { error: { code, message } } error shape.
 */

import type { Express, Request, Response } from "express";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import { serverConfig } from "./config";
import { rateLimit, clientIpOf } from "./rateLimit";
import {
  createGroupPayCampaignSchema,
  updateGroupPayCampaignSchema,
  createGroupPayContributionSchema,
  contributionStatusForPaymentMethod,
  type GroupPayCampaign,
  type GroupPayCampaignSummary,
} from "@shared/groupPay";

/** Same prototype guard pattern as routes.ts — falls back to the demo user. */
function requireAuth(req: Request): string {
  return req.session?.userId ?? "user_123";
}

/** Public endpoint rate limiting (mirrors invoiceRoutes' pattern). */
function enforceRateLimit(
  req: Request,
  res: Response,
  name: keyof typeof serverConfig.rateLimits,
): boolean {
  const { limit, windowMs } = serverConfig.rateLimits[name];
  const result = rateLimit(`group-pay:${name}:${clientIpOf(req)}`, limit, windowMs);
  if (!result.allowed) {
    res.setHeader("Retry-After", Math.ceil(result.retryAfterMs / 1000));
    res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again shortly." } });
    return false;
  }
  return true;
}

function firstZodMessage(err: { issues: { message: string }[] }): string {
  return err.issues[0]?.message ?? "Invalid request.";
}

/** Opaque share-link token, same ~22-char lowercase shape the client used. */
function generateCampaignId(): string {
  return randomBytes(11).toString("hex");
}

function generateContributionId(): string {
  return randomBytes(8).toString("hex");
}

/** Raised-so-far aggregate — completed contributions only (matches the old client summary). */
async function campaignSummary(campaignId: string): Promise<GroupPayCampaignSummary> {
  const contributions = await storage.listGroupPayContributions(campaignId);
  const completed = contributions.filter((c) => c.status === "completed");
  return {
    totalRaised: completed.reduce((sum, c) => sum + c.amount, 0),
    contributorCount: completed.length,
  };
}

export function registerGroupPayRoutes(app: Express): void {
  // ─── Creator endpoints (dashboard) ────────────────────────────────────────

  app.post("/api/group-pay/campaigns", async (req: Request, res: Response) => {
    try {
      const ownerId = requireAuth(req);
      const parsed = createGroupPayCampaignSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: firstZodMessage(parsed.error) } });
      }
      const campaign = await storage.createGroupPayCampaign({
        id: generateCampaignId(),
        ownerId,
        name: parsed.data.name,
        targetAmount: parsed.data.targetAmount,
        currency: parsed.data.currency,
        description: parsed.data.description,
        bankAccountId: parsed.data.bankAccountId,
        bankAccountName: parsed.data.bankAccountName,
        status: "active",
        createdAt: new Date(),
        creatorName: parsed.data.creatorName,
        fixedContributionAmount: parsed.data.fixedContributionAmount ?? null,
      });
      return res.status(201).json({ data: campaign });
    } catch (err) {
      console.error("[groupPayRoutes] create campaign error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create the campaign. Please try again." } });
    }
  });

  app.get("/api/group-pay/campaigns", async (req: Request, res: Response) => {
    try {
      const ownerId = requireAuth(req);
      const campaigns = await storage.listGroupPayCampaignsByOwner(ownerId);
      const data = await Promise.all(
        campaigns.map(async (campaign) => ({
          ...campaign,
          summary: await campaignSummary(campaign.id),
        })),
      );
      return res.json({ data });
    } catch (err) {
      console.error("[groupPayRoutes] list campaigns error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load campaigns." } });
    }
  });

  app.get("/api/group-pay/campaigns/:id", async (req: Request, res: Response) => {
    try {
      const campaign = await storage.getGroupPayCampaignById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found." } });
      }
      return res.json({
        data: {
          campaign: { ...campaign, summary: await campaignSummary(campaign.id) },
          contributors: await storage.listGroupPayContributions(campaign.id),
        },
      });
    } catch (err) {
      console.error("[groupPayRoutes] get campaign error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load the campaign." } });
    }
  });

  app.patch("/api/group-pay/campaigns/:id", async (req: Request, res: Response) => {
    try {
      const campaign = await storage.getGroupPayCampaignById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found." } });
      }
      const parsed = updateGroupPayCampaignSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: firstZodMessage(parsed.error) } });
      }

      const patch: Partial<Omit<GroupPayCampaign, "id">> = {};
      const { name, description, targetAmount, currency, fixedContributionAmount, toggleStatus } = parsed.data;
      if (name !== undefined) patch.name = name;
      if (description !== undefined) patch.description = description;
      if (targetAmount !== undefined) patch.targetAmount = targetAmount;
      if (currency !== undefined) patch.currency = currency;
      // undefined = untouched, null = clear (same optionality the client type has)
      if (fixedContributionAmount !== undefined) patch.fixedContributionAmount = fixedContributionAmount;
      if (toggleStatus) {
        // Only flips between active and paused — same rule as the old client toggle
        if (campaign.status === "active") patch.status = "paused";
        else if (campaign.status === "paused") patch.status = "active";
      }

      const updated = await storage.updateGroupPayCampaign(req.params.id, patch);
      return res.json({ data: updated });
    } catch (err) {
      console.error("[groupPayRoutes] update campaign error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update the campaign." } });
    }
  });

  app.delete("/api/group-pay/campaigns/:id", async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteGroupPayCampaign(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found." } });
      }
      return res.json({ success: true });
    } catch (err) {
      console.error("[groupPayRoutes] delete campaign error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete the campaign." } });
    }
  });

  // ─── Public contribution endpoints (share links) ─────────────────────────

  app.get("/api/public/group-pay/campaigns/:campaignId", async (req: Request, res: Response) => {
    try {
      if (!enforceRateLimit(req, res, "publicLookup")) return;
      const campaign = await storage.getGroupPayCampaignById(req.params.campaignId);
      if (!campaign) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found." } });
      }
      return res.json({
        data: { campaign: { ...campaign, summary: await campaignSummary(campaign.id) } },
      });
    } catch (err) {
      console.error("[groupPayRoutes] public campaign lookup error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load the campaign." } });
    }
  });

  app.post("/api/public/group-pay/campaigns/:campaignId/contributions", async (req: Request, res: Response) => {
    try {
      if (!enforceRateLimit(req, res, "paymentIntent")) return;
      const campaign = await storage.getGroupPayCampaignById(req.params.campaignId);
      if (!campaign) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found." } });
      }
      const parsed = createGroupPayContributionSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: firstZodMessage(parsed.error) } });
      }
      // Instant/card settle immediately; manual bank transfers stay pending
      // until the creator confirms receipt.
      const contribution = await storage.addGroupPayContribution({
        id: generateContributionId(),
        campaignId: campaign.id,
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        amount: parsed.data.amount,
        paymentDate: new Date(),
        status: contributionStatusForPaymentMethod(parsed.data.paymentMethod),
      });
      return res.status(201).json({
        data: { contribution, summary: await campaignSummary(campaign.id) },
      });
    } catch (err) {
      console.error("[groupPayRoutes] add contribution error:", err);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to record the contribution." } });
    }
  });

  // ─── Contribution confirmation (creator marks a manual transfer received) ─

  app.post(
    "/api/group-pay/campaigns/:id/contributions/:contributionId/confirm",
    async (req: Request, res: Response) => {
      try {
        const campaign = await storage.getGroupPayCampaignById(req.params.id);
        if (!campaign) {
          return res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found." } });
        }
        const contribution = await storage.getGroupPayContributionById(req.params.contributionId);
        if (!contribution || contribution.campaignId !== campaign.id) {
          return res.status(404).json({ error: { code: "NOT_FOUND", message: "Contribution not found." } });
        }
        if (contribution.status !== "pending") {
          return res.status(409).json({ error: { code: "INVALID_STATE", message: "Only pending contributions can be marked as received." } });
        }
        const updated = await storage.updateGroupPayContribution(contribution.id, { status: "completed" });
        return res.json({
          data: { contribution: updated, summary: await campaignSummary(campaign.id) },
        });
      } catch (err) {
        console.error("[groupPayRoutes] confirm contribution error:", err);
        return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to confirm the contribution." } });
      }
    },
  );
}
