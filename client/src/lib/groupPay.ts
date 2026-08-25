/**
 * GroupPay API client — server-owned campaigns.
 *
 * Campaigns used to live in browser localStorage (see pages/GroupPay/mockData),
 * which is why /contribute/:campaignId links only resolved in the creator's
 * browser. They now live behind these Express endpoints, following the same
 * apiRequest pattern as lib/invoices.ts.
 */

import { apiRequest } from "@/lib/queryClient";
import type { Campaign, Contributor } from "@/pages/GroupPay/types";
import type {
  GroupPayCampaign,
  GroupPayCampaignSummary,
  GroupPayContribution,
  GroupPayPaymentMethod,
} from "@shared/groupPay";

/** Contribution link for a campaign id — identical to the previous client-side builder. */
export function buildCampaignLink(campaignId: string): string {
  return `${window.location.origin}/contribute/${campaignId}`;
}

export interface CampaignWithSummary extends Campaign {
  summary: GroupPayCampaignSummary;
}

function toCampaign(c: GroupPayCampaign): Campaign {
  return {
    id: c.id,
    name: c.name,
    targetAmount: c.targetAmount,
    currency: c.currency,
    description: c.description,
    bankAccountId: c.bankAccountId,
    bankAccountName: c.bankAccountName,
    status: c.status,
    createdAt: new Date(c.createdAt),
    uniqueLink: buildCampaignLink(c.id),
    creatorName: c.creatorName,
    fixedContributionAmount: c.fixedContributionAmount ?? undefined,
  };
}

function toContributor(c: GroupPayContribution): Contributor {
  return {
    id: c.id,
    campaignId: c.campaignId,
    name: c.name,
    email: c.email,
    amount: c.amount,
    paymentDate: new Date(c.paymentDate),
    status: c.status,
  };
}

export interface CreateCampaignPayload {
  name: string;
  creatorName: string;
  targetAmount: number;
  currency: string;
  description: string;
  bankAccountId: string;
  bankAccountName: string;
  fixedContributionAmount?: number;
}

export async function fetchCampaigns(): Promise<CampaignWithSummary[]> {
  const res = await apiRequest("GET", "/api/group-pay/campaigns");
  const json = (await res.json()) as {
    data: Array<GroupPayCampaign & { summary: GroupPayCampaignSummary }>;
  };
  return json.data.map((c) => ({ ...toCampaign(c), summary: c.summary }));
}

export async function fetchCampaign(
  id: string,
): Promise<{ campaign: CampaignWithSummary; contributors: Contributor[] }> {
  const res = await apiRequest("GET", `/api/group-pay/campaigns/${encodeURIComponent(id)}`);
  const json = (await res.json()) as {
    data: {
      campaign: GroupPayCampaign & { summary: GroupPayCampaignSummary };
      contributors: GroupPayContribution[];
    };
  };
  return {
    campaign: { ...toCampaign(json.data.campaign), summary: json.data.campaign.summary },
    contributors: json.data.contributors.map(toContributor),
  };
}

export async function createCampaign(payload: CreateCampaignPayload): Promise<Campaign> {
  const res = await apiRequest("POST", "/api/group-pay/campaigns", payload);
  const json = (await res.json()) as { data: GroupPayCampaign };
  return toCampaign(json.data);
}

export interface UpdateCampaignPayload {
  name?: string;
  description?: string;
  targetAmount?: number;
  /** null clears the fixed amount (undefined leaves it untouched). */
  fixedContributionAmount?: number | null;
  toggleStatus?: boolean;
}

export async function updateCampaign(id: string, payload: UpdateCampaignPayload): Promise<Campaign> {
  const res = await apiRequest("PATCH", `/api/group-pay/campaigns/${encodeURIComponent(id)}`, payload);
  const json = (await res.json()) as { data: GroupPayCampaign };
  return toCampaign(json.data);
}

export async function deleteCampaign(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/group-pay/campaigns/${encodeURIComponent(id)}`);
}

/** Public share-link lookup used by the contributor view (404 → null). */
export async function fetchPublicCampaign(campaignId: string): Promise<CampaignWithSummary | null> {
  const res = await fetch(`/api/public/group-pay/campaigns/${encodeURIComponent(campaignId)}`, {
    credentials: "include",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load the campaign. Please try again.");
  const json = (await res.json()) as {
    data: { campaign: GroupPayCampaign & { summary: GroupPayCampaignSummary } };
  };
  return { ...toCampaign(json.data.campaign), summary: json.data.campaign.summary };
}

export interface AddContributionPayload {
  name: string;
  email: string;
  /** Net amount in the campaign currency (matches the previous local record). */
  amount: number;
  /**
   * How the contributor paid. The server derives the status: manual bank
   * transfers are recorded as "pending" until the creator confirms receipt.
   */
  paymentMethod?: GroupPayPaymentMethod;
}

export async function addContribution(
  campaignId: string,
  payload: AddContributionPayload,
): Promise<{ contribution: Contributor; summary: GroupPayCampaignSummary }> {
  const res = await apiRequest(
    "POST",
    `/api/public/group-pay/campaigns/${encodeURIComponent(campaignId)}/contributions`,
    payload,
  );
  const json = (await res.json()) as {
    data: { contribution: GroupPayContribution; summary: GroupPayCampaignSummary };
  };
  return { contribution: toContributor(json.data.contribution), summary: json.data.summary };
}

/** Creator action: mark a pending manual-transfer contribution as received. */
export async function confirmContribution(
  campaignId: string,
  contributionId: string,
): Promise<{ contribution: Contributor; summary: GroupPayCampaignSummary }> {
  const res = await apiRequest(
    "POST",
    `/api/group-pay/campaigns/${encodeURIComponent(campaignId)}/contributions/${encodeURIComponent(contributionId)}/confirm`,
  );
  const json = (await res.json()) as {
    data: { contribution: GroupPayContribution; summary: GroupPayCampaignSummary };
  };
  return { contribution: toContributor(json.data.contribution), summary: json.data.summary };
}
