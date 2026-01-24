// Group Pay Campaign Types

export interface Campaign {
    id: string;
    name: string;
    targetAmount: number;
    currency: string;
    description: string;
    bankAccountId: string;
    bankAccountName: string;
    status: 'active' | 'completed' | 'cancelled' | 'paused';
    createdAt: Date;
    uniqueLink: string;
    fixedContributionAmount?: number; // Optional: if set, all contributors must pay this exact amount
}

export interface Contributor {
    id: string;
    campaignId: string;
    name: string;
    email: string;
    amount: number;
    paymentDate: Date;
    status: 'pending' | 'completed' | 'failed';
}

export interface CampaignSummary {
    totalRaised: number;
    targetAmount: number;
    remainingAmount: number;
    contributorCount: number;
}

export interface BankAccount {
    id: string;
    name: string;
    bank: string;
    accountNumber: string;
    currency: string;
}
