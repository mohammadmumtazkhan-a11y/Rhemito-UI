import { z } from "zod";

// ─── GroupPay funding campaigns (server-owned) ──────────────────────────────
// Campaigns and their contributions live in server-side storage (the same
// MemStorage pattern as invoices and money requests) so shared contribution
// links resolve in any browser, not just the creator's.

export const GROUP_PAY_CAMPAIGN_STATUSES = [
  "active",
  "completed",
  "cancelled",
  "paused",
] as const;
export type GroupPayCampaignStatus = (typeof GROUP_PAY_CAMPAIGN_STATUSES)[number];

export const GROUP_PAY_CONTRIBUTION_STATUSES = [
  "pending",
  "completed",
  "failed",
] as const;
export type GroupPayContributionStatus =
  (typeof GROUP_PAY_CONTRIBUTION_STATUSES)[number];

export const GROUP_PAY_CURRENCIES = ["GBP", "USD", "EUR", "NGN"] as const;
export type GroupPayCurrency = (typeof GROUP_PAY_CURRENCIES)[number];

export interface GroupPayCampaign {
  id: string;
  ownerId: string;
  name: string;
  targetAmount: number;
  currency: string;
  description: string;
  bankAccountId: string;
  bankAccountName: string;
  status: GroupPayCampaignStatus;
  createdAt: Date;
  creatorName: string;
  /** Optional: when set, all contributors must pay this exact amount. */
  fixedContributionAmount?: number | null;
}

export interface GroupPayContribution {
  id: string;
  campaignId: string;
  name: string;
  email: string;
  amount: number;
  paymentDate: Date;
  status: GroupPayContributionStatus;
}

/** Raised-so-far aggregate shown on dashboard, details and contribute views. */
export interface GroupPayCampaignSummary {
  totalRaised: number;
  contributorCount: number;
}

// ─── Request validation ─────────────────────────────────────────────────────

export const createGroupPayCampaignSchema = z.object({
  name: z.string().trim().min(1),
  creatorName: z.string().trim().min(1),
  targetAmount: z.number().positive(),
  currency: z.enum(GROUP_PAY_CURRENCIES),
  description: z.string().trim().min(1),
  bankAccountId: z.string().trim().min(1),
  bankAccountName: z.string().default(""),
  fixedContributionAmount: z.number().positive().nullable().optional(),
});
export type CreateGroupPayCampaignInput = z.infer<
  typeof createGroupPayCampaignSchema
>;

export const updateGroupPayCampaignSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    targetAmount: z.number().positive().optional(),
    currency: z.enum(GROUP_PAY_CURRENCIES).optional(),
    fixedContributionAmount: z.number().positive().nullable().optional(),
    /** true flips active ↔ paused (same semantics as the previous client toggle). */
    toggleStatus: z.boolean().optional(),
  })
  .refine(
    (value) => Object.values(value).some((v) => v !== undefined),
    { message: "At least one field or toggleStatus is required" },
  );
export type UpdateGroupPayCampaignInput = z.infer<
  typeof updateGroupPayCampaignSchema
>;

export const createGroupPayContributionSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  amount: z.number().positive(),
});
export type CreateGroupPayContributionInput = z.infer<
  typeof createGroupPayContributionSchema
>;
