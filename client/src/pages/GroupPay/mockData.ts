// Mock Data for Group Pay Campaigns

import { Campaign, Contributor, BankAccount } from './types';

// Generate unique ID
export const generateId = (): string => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Generate unique campaign link
export const generateCampaignLink = (campaignId: string): string => {
    return `${window.location.origin}/contribute/${campaignId}`;
};

// Mock Bank Accounts (from existing payout accounts)
export const mockBankAccounts: BankAccount[] = [
    { id: '1', name: 'John Doe', bank: 'Access Bank Nigeria Plc', accountNumber: '12312300011', currency: 'NGN' },
    { id: '2', name: 'John Doe', bank: 'Barclays', accountNumber: '12312300011', currency: 'GBP' },
    { id: '3', name: 'John Doe', bank: 'Chase', accountNumber: '12312300011', currency: 'USD' },
];

export const FEE_CONFIG = {
    PERCENTAGE: 0.025, // 2.5%
    FIXED_FEE: 0.30,   // Fixed amount (e.g. 0.30 currency units)
};

// In-memory campaign storage
let campaigns: Campaign[] = [
    {
        id: 'demo-campaign-1',
        name: 'Office Birthday Collection',
        targetAmount: 500,
        currency: 'GBP',
        description: 'Collecting funds for Jane\'s surprise birthday party. Let\'s make it special!',
        bankAccountId: '2',
        bankAccountName: 'John Doe - Barclays',
        status: 'active',
        createdAt: new Date('2026-01-20'),
        uniqueLink: `${window.location.origin}/contribute/demo-campaign-1`,
    },
    {
        id: 'demo-campaign-2',
        name: 'Team Trip Fund',
        targetAmount: 2000,
        currency: 'GBP',
        description: 'Saving up for our annual team outing. Everyone chip in what you can!',
        bankAccountId: '2',
        bankAccountName: 'John Doe - Barclays',
        status: 'active',
        createdAt: new Date('2026-01-15'),
        uniqueLink: `${window.location.origin}/contribute/demo-campaign-2`,
    },
];

// In-memory contributors storage
let contributors: Contributor[] = [
    { id: 'c1', campaignId: 'demo-campaign-1', name: 'Alice Smith', email: 'alice@example.com', amount: 50, paymentDate: new Date('2026-01-21T10:30:00'), status: 'completed' },
    { id: 'c2', campaignId: 'demo-campaign-1', name: 'Bob Johnson', email: 'bob@example.com', amount: 75, paymentDate: new Date('2026-01-22T14:15:00'), status: 'completed' },
    { id: 'c3', campaignId: 'demo-campaign-2', name: 'Charlie Brown', email: 'charlie@example.com', amount: 100, paymentDate: new Date('2026-01-18T09:00:00'), status: 'completed' },
];

// CRUD Operations

export const getAllCampaigns = (): Campaign[] => {
    return [...campaigns];
};

export const getCampaignById = (id: string): Campaign | undefined => {
    return campaigns.find(c => c.id === id);
};

export const createCampaign = (campaignData: Omit<Campaign, 'id' | 'createdAt' | 'uniqueLink' | 'status'>): Campaign => {
    const id = generateId();
    const newCampaign: Campaign = {
        ...campaignData,
        id,
        status: 'active',
        createdAt: new Date(),
        uniqueLink: generateCampaignLink(id),
    };
    campaigns = [...campaigns, newCampaign];
    return newCampaign;
};

export const getContributorsByCampaignId = (campaignId: string): Contributor[] => {
    return contributors.filter(c => c.campaignId === campaignId);
};

export const addContributor = (contributorData: Omit<Contributor, 'id' | 'paymentDate' | 'status'>): Contributor => {
    const newContributor: Contributor = {
        ...contributorData,
        id: generateId(),
        paymentDate: new Date(),
        status: 'completed',
    };
    contributors = [...contributors, newContributor];
    return newContributor;
};

export const toggleCampaignStatus = (id: string): Campaign | undefined => {
    const campaign = campaigns.find(c => c.id === id);
    if (campaign) {
        // Only toggle between active and paused (or completed if needed, but usually manual pause)
        if (campaign.status === 'active') {
            campaign.status = 'paused';
        } else if (campaign.status === 'paused') {
            campaign.status = 'active';
        }
    }
    return campaign;
};

export const deleteCampaign = (id: string): boolean => {
    const initialLength = campaigns.length;
    campaigns = campaigns.filter(c => c.id !== id);
    return campaigns.length < initialLength;
};

export const updateCampaign = (id: string, updates: Partial<Omit<Campaign, 'id' | 'createdAt' | 'uniqueLink'>>): Campaign | undefined => {
    const index = campaigns.findIndex(c => c.id === id);
    if (index !== -1) {
        campaigns[index] = { ...campaigns[index], ...updates };
        return campaigns[index];
    }
    return undefined;
};

export const getCampaignSummary = (campaignId: string): { totalRaised: number; contributorCount: number } => {
    const campaignContributors = getContributorsByCampaignId(campaignId);
    const totalRaised = campaignContributors
        .filter(c => c.status === 'completed')
        .reduce((sum, c) => sum + c.amount, 0);
    return {
        totalRaised,
        contributorCount: campaignContributors.filter(c => c.status === 'completed').length,
    };
};
