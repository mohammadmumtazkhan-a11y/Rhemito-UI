// Group Pay constants — FX, fees and formatting shared by the campaign pages.
// Campaign records themselves live server-side (see @/lib/groupPay); only the
// pure display/calculation constants remain here.

import { BankAccount } from './types';

// Supported currencies for contributions
export const SUPPORTED_CURRENCIES = ['GBP', 'USD', 'EUR', 'NGN'] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

// Mock FX rates (cross-currency conversion rates)
export const MOCK_FX_RATES: Record<string, Record<string, number>> = {
    GBP: { GBP: 1, USD: 1.27, EUR: 1.17, NGN: 1950 },
    USD: { GBP: 0.79, USD: 1, EUR: 0.92, NGN: 1535 },
    EUR: { GBP: 0.85, EUR: 1, USD: 1.09, NGN: 1667 },
    NGN: { GBP: 0.00051, USD: 0.00065, EUR: 0.0006, NGN: 1 },
};

// Mito fee configuration
export const MITO_FEE_CONFIG = {
    PERCENTAGE: 0.015, // 1.5%
    MIN_FEE: 0.50,     // Minimum fee in campaign currency
};

// Currency symbols
export const CURRENCY_SYMBOLS: Record<string, string> = {
    GBP: '£', USD: '$', EUR: '€', NGN: '₦'
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
