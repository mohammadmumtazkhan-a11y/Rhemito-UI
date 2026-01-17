import { randomUUID } from "crypto";

export interface PromoCode {
  id: string;
  code: string;
  type: "Percentage" | "Fixed" | "FX_BOOST" | "BONUS_CREDIT";
  value: number;
  minThreshold: number;
  maxDiscount?: number;
  currency: string;
  usageLimitGlobal: number; // -1 for unlimited
  usageLimitPerUser: number;
  usageCount: number;
  totalDiscountUtilized: number;
  budgetLimit: number; // -1 for unlimited
  startDate: string;
  endDate: string;
  status: "Active" | "Disabled";
  restrictions: {
    corridors?: string[];
    paymentMethods?: string[];
    affiliates?: string[];
  };
}

export interface PromoRedemption {
  id: string;
  promoCodeId: string;
  transactionId: string;
  userId: string;
  discountAmount: number;
  status: string;
  createdAt: string;
}

export interface PromoValidationRequest {
  code: string;
  amount: number;
  currency: string;
  userId: string;
  sourceCurrency: string;
  destCurrency: string;
  paymentMethod: string;
}

export interface PromoValidationResponse {
  valid: boolean;
  error?: string;
  promo?: PromoCode;
  appliedDiscount?: number;
  displayText?: string;
}

// In-memory storage for demo (replace with real DB in production)
class PromoStorage {
  private promoCodes: Map<string, PromoCode> = new Map();
  private redemptions: Map<string, PromoRedemption> = new Map();
  private userRedemptions: Map<string, Set<string>> = new Map(); // userId -> Set<promoCodeId>

  constructor() {
    this.seedDemoData();
  }

  private seedDemoData() {
    // SAVE20 - 20% off fees
    const save20: PromoCode = {
      id: randomUUID(),
      code: "SAVE20",
      type: "Percentage",
      value: 20,
      minThreshold: 100,
      currency: "GBP",
      usageLimitGlobal: 1000,
      usageLimitPerUser: 1,
      usageCount: 0,
      totalDiscountUtilized: 0,
      budgetLimit: -1,
      startDate: "2024-01-01T00:00:00Z",
      endDate: "2024-12-31T23:59:59Z",
      status: "Active",
      restrictions: {},
    };
    this.promoCodes.set("SAVE20", save20);

    // WELCOME - £5 off
    const welcome: PromoCode = {
      id: randomUUID(),
      code: "WELCOME",
      type: "Fixed",
      value: 5,
      minThreshold: 50,
      currency: "GBP",
      usageLimitGlobal: -1,
      usageLimitPerUser: 1,
      usageCount: 0,
      totalDiscountUtilized: 0,
      budgetLimit: 10000,
      startDate: "2024-01-01T00:00:00Z",
      endDate: "2025-12-31T23:59:59Z",
      status: "Active",
      restrictions: {},
    };
    this.promoCodes.set("WELCOME", welcome);

    // BOOSTRATE - FX boost
    const boostRate: PromoCode = {
      id: randomUUID(),
      code: "BOOSTRATE",
      type: "FX_BOOST",
      value: 5.0,
      minThreshold: 500,
      currency: "GBP",
      usageLimitGlobal: -1,
      usageLimitPerUser: 3,
      usageCount: 0,
      totalDiscountUtilized: 0,
      budgetLimit: -1,
      startDate: "2024-06-01T00:00:00Z",
      endDate: "2024-08-31T23:59:59Z",
      status: "Active",
      restrictions: {},
    };
    this.promoCodes.set("BOOSTRATE", boostRate);
  }

  getPromoByCode(code: string): PromoCode | undefined {
    return this.promoCodes.get(code.toUpperCase());
  }

  getUserRedemptionCount(userId: string, promoCodeId: string): number {
    const userRedemptions = this.userRedemptions.get(userId);
    if (!userRedemptions) return 0;
    
    // Count how many times this user has redeemed this specific promo
    return Array.from(this.redemptions.values()).filter(
      (r) => r.userId === userId && r.promoCodeId === promoCodeId
    ).length;
  }

  applyPromoCode(promoCodeId: string, transactionId: string, userId: string, discountAmount: number): void {
    const promo = Array.from(this.promoCodes.values()).find((p) => p.id === promoCodeId);
    if (!promo) return;

    // Update usage count and discount utilized
    promo.usageCount += 1;
    promo.totalDiscountUtilized += discountAmount;

    // Record redemption
    const redemption: PromoRedemption = {
      id: randomUUID(),
      promoCodeId,
      transactionId,
      userId,
      discountAmount,
      status: "Redeemed",
      createdAt: new Date().toISOString(),
    };
    this.redemptions.set(redemption.id, redemption);

    // Track user redemptions
    if (!this.userRedemptions.has(userId)) {
      this.userRedemptions.set(userId, new Set());
    }
    this.userRedemptions.get(userId)!.add(promoCodeId);
  }
}

export const promoStorage = new PromoStorage();

export function validatePromoCode(req: PromoValidationRequest): PromoValidationResponse {
  const { code, amount, currency, userId, sourceCurrency, destCurrency, paymentMethod } = req;

  const promo = promoStorage.getPromoByCode(code);
  if (!promo) {
    return { valid: false, error: "Invalid promo code" };
  }

  const now = new Date();
  if (promo.status !== "Active") {
    return { valid: false, error: "Promo code is inactive" };
  }

  if (new Date(promo.startDate) > now) {
    return { valid: false, error: "Promo code not yet active" };
  }

  if (new Date(promo.endDate) < now) {
    return { valid: false, error: "Promo code expired" };
  }

  // Global usage limit (count)
  if (promo.usageLimitGlobal !== -1 && promo.usageCount >= promo.usageLimitGlobal) {
    return { valid: false, error: "Promo code fully redeemed (usage limit reached)" };
  }

  // Budget limit
  if (promo.budgetLimit !== -1 && promo.totalDiscountUtilized >= promo.budgetLimit) {
    return { valid: false, error: "Promo code fully redeemed (budget exhausted)" };
  }

  // Per-user limit
  const userUsageCount = promoStorage.getUserRedemptionCount(userId, promo.id);
  if (userUsageCount >= promo.usageLimitPerUser) {
    return { valid: false, error: "You have already used this promo code" };
  }

  // Minimum threshold
  if (amount < promo.minThreshold) {
    return { valid: false, error: `Minimum transfer amount is ${promo.currency} ${promo.minThreshold}` };
  }

  // Check corridor restrictions
  if (promo.restrictions.corridors && promo.restrictions.corridors.length > 0) {
    const corridorKey = `${sourceCurrency}-${destCurrency}`;
    if (!promo.restrictions.corridors.includes(corridorKey)) {
      return { valid: false, error: "Promo code not valid for this currency corridor" };
    }
  }

  // Check payment method restrictions
  if (promo.restrictions.paymentMethods && promo.restrictions.paymentMethods.length > 0) {
    if (!promo.restrictions.paymentMethods.includes(paymentMethod)) {
      return { valid: false, error: "Promo code not valid for this payment method" };
    }
  }

  // Calculate discount
  const discount = calculateDiscount(promo, amount, currency);

  return {
    valid: true,
    promo,
    appliedDiscount: discount,
    displayText: formatDiscountText(promo, discount),
  };
}

function calculateDiscount(promo: PromoCode, amount: number, currency: string): number {
  let discount = 0;

  switch (promo.type) {
    case "Percentage":
      // Percentage off the transaction fee (assuming fee is included in amount or separate)
      // For simplicity, let's assume we're discounting a standard £5 fee
      const standardFee = 5;
      discount = (standardFee * promo.value) / 100;
      break;

    case "Fixed":
      discount = promo.value;
      break;

    case "FX_BOOST":
      // FX boost gives better exchange rate, not a direct discount on fees
      // For display purposes, we'll show the value but actual calculation would differ
      discount = 0; // FX boost doesn't reduce the payment amount
      break;

    case "BONUS_CREDIT":
      // Bonus credit is applied to sender's wallet, not a discount
      discount = 0;
      break;
  }

  // Apply max discount cap if set
  if (promo.maxDiscount && discount > promo.maxDiscount) {
    discount = promo.maxDiscount;
  }

  return Math.round(discount * 100) / 100; // Round to 2 decimal places
}

function formatDiscountText(promo: PromoCode, discount: number): string {
  switch (promo.type) {
    case "Percentage":
      return `${promo.value}% off fees (${promo.currency} ${discount.toFixed(2)} saved)`;
    case "Fixed":
      return `${promo.currency} ${discount.toFixed(2)} off`;
    case "FX_BOOST":
      return `+${promo.value} NGN/GBP rate boost`;
    case "BONUS_CREDIT":
      return `${promo.currency} ${promo.value} bonus credit`;
    default:
      return "Discount applied";
  }
}
