/**
 * Corridor configuration — Request Money.
 *
 * Server-owned and authoritative: the frontend retrieves its options from this
 * configuration via the API; it never decides corridor support client-side.
 * A corridor that is not explicitly enabled here cannot create requests, no
 * matter which currencies appear in dropdowns.
 *
 * ⚠️ The entries below are DEVELOPMENT configuration, clearly marked as
 * non-production. Production corridors must come from reviewed configuration
 * with real provider references and approved limits.
 */

export type PayinMethodId = "pay_by_bank" | "card" | "bank_transfer" | "wallet";

export interface CorridorConfig {
  id: string;
  senderCountry: string; // ISO alpha-2
  requesterCountry: string; // ISO alpha-2
  payInCurrency: string;
  payoutCurrency: string;
  methods: PayinMethodId[];
  minAmountMinor: number;
  maxAmountMinor: number;
  requiredKycTier: "mini_kyc"; // single tier today; extensible
  payinProvider: string; // adapter id (dev stubs named "dev:*")
  fxProvider: string;
  payoutProvider: string;
  estimatedDeliveryTime: string;
  enabled: boolean;
  /** User-facing reason shown when disabled. */
  unavailabilityReason?: string;
}

export const CORRIDORS: CorridorConfig[] = [
  {
    id: "GB-GB-GBP",
    senderCountry: "GB",
    requesterCountry: "GB",
    payInCurrency: "GBP",
    payoutCurrency: "GBP",
    methods: ["pay_by_bank", "card", "bank_transfer", "wallet"],
    minAmountMinor: 100,
    maxAmountMinor: 10_000_000,
    requiredKycTier: "mini_kyc",
    payinProvider: "dev:payin-uk",
    fxProvider: "dev:fx",
    payoutProvider: "dev:payout-fps",
    estimatedDeliveryTime: "Typically within minutes",
    enabled: true,
  },
  {
    id: "GB-NG-GBP-NGN",
    senderCountry: "GB",
    requesterCountry: "NG",
    payInCurrency: "GBP",
    payoutCurrency: "NGN",
    methods: ["pay_by_bank", "card", "bank_transfer"],
    minAmountMinor: 100,
    maxAmountMinor: 2_000_000,
    requiredKycTier: "mini_kyc",
    payinProvider: "dev:payin-uk",
    fxProvider: "dev:fx",
    payoutProvider: "dev:payout-nibss",
    estimatedDeliveryTime: "Typically within minutes to 1 hour",
    enabled: true,
  },
  {
    id: "NG-NG-NGN",
    senderCountry: "NG",
    requesterCountry: "NG",
    payInCurrency: "NGN",
    payoutCurrency: "NGN",
    methods: ["bank_transfer", "card", "wallet"],
    minAmountMinor: 10_000,
    maxAmountMinor: 2_000_000_000,
    requiredKycTier: "mini_kyc",
    payinProvider: "dev:payin-ng",
    fxProvider: "dev:fx",
    payoutProvider: "dev:payout-nibss",
    estimatedDeliveryTime: "Typically within minutes",
    enabled: true,
  },
  {
    id: "US-NG-USD-NGN",
    senderCountry: "US",
    requesterCountry: "NG",
    payInCurrency: "USD",
    payoutCurrency: "NGN",
    methods: ["card", "bank_transfer"],
    minAmountMinor: 100,
    maxAmountMinor: 1_500_000,
    requiredKycTier: "mini_kyc",
    payinProvider: "dev:payin-uk",
    fxProvider: "dev:fx",
    payoutProvider: "dev:payout-nibss",
    estimatedDeliveryTime: "Typically within minutes to 1 hour",
    enabled: true,
  },
  {
    id: "EU-NG-EUR-NGN",
    senderCountry: "DE",
    requesterCountry: "NG",
    payInCurrency: "EUR",
    payoutCurrency: "NGN",
    methods: ["card", "bank_transfer"],
    minAmountMinor: 100,
    maxAmountMinor: 1_500_000,
    requiredKycTier: "mini_kyc",
    payinProvider: "dev:payin-uk",
    fxProvider: "dev:fx",
    payoutProvider: "dev:payout-nibss",
    estimatedDeliveryTime: "Typically within minutes to 1 hour",
    enabled: true,
  },
  {
    id: "US-GB-USD-GBP",
    senderCountry: "US",
    requesterCountry: "GB",
    payInCurrency: "USD",
    payoutCurrency: "GBP",
    methods: ["card", "bank_transfer"],
    minAmountMinor: 100,
    maxAmountMinor: 1_500_000,
    requiredKycTier: "mini_kyc",
    payinProvider: "dev:payin-uk",
    fxProvider: "dev:fx",
    payoutProvider: "dev:payout-fps",
    estimatedDeliveryTime: "Typically within minutes",
    enabled: true,
  },
  {
    id: "EU-GB-EUR-GBP",
    senderCountry: "DE",
    requesterCountry: "GB",
    payInCurrency: "EUR",
    payoutCurrency: "GBP",
    methods: ["card", "bank_transfer"],
    minAmountMinor: 100,
    maxAmountMinor: 1_500_000,
    requiredKycTier: "mini_kyc",
    payinProvider: "dev:payin-uk",
    fxProvider: "dev:fx",
    payoutProvider: "dev:payout-fps",
    estimatedDeliveryTime: "Typically within minutes",
    enabled: true,
  },
  {
    id: "NG-GB-NGN-GBP",
    senderCountry: "NG",
    requesterCountry: "GB",
    payInCurrency: "NGN",
    payoutCurrency: "GBP",
    methods: ["bank_transfer", "card"],
    minAmountMinor: 10_000,
    maxAmountMinor: 500_000_000,
    requiredKycTier: "mini_kyc",
    payinProvider: "dev:payin-ng",
    fxProvider: "dev:fx",
    payoutProvider: "dev:payout-fps",
    estimatedDeliveryTime: "Typically within 1 business day",
    enabled: false,
    unavailabilityReason:
      "Nigeria → UK requests are unavailable while the outward-remittance route is being finalised with our local partners.",
  },
];

export function findCorridor(id: string): CorridorConfig | undefined {
  return CORRIDORS.find((c) => c.id === id);
}

export interface CorridorValidation {
  ok: boolean;
  reason?: string;
}

/**
 * Authoritative corridor check used at request creation. The payout account's
 * country/currency must match the corridor exactly; the amount must respect
 * corridor limits.
 */
export function validateCorridor(params: {
  corridor: CorridorConfig;
  requesterCountry: string;
  payoutAccountCountry: string;
  payoutAccountCurrency: string;
  amountMinor: number;
}): CorridorValidation {
  const { corridor, requesterCountry, payoutAccountCountry, payoutAccountCurrency, amountMinor } = params;

  if (!corridor.enabled) {
    return { ok: false, reason: corridor.unavailabilityReason ?? "This corridor is currently unavailable." };
  }
  if (requesterCountry !== corridor.requesterCountry) {
    return { ok: false, reason: "Your account country is not supported for this corridor." };
  }
  if (payoutAccountCountry !== corridor.requesterCountry || payoutAccountCurrency !== corridor.payoutCurrency) {
    return {
      ok: false,
      reason: `This corridor pays out in ${corridor.payoutCurrency} to a ${corridor.requesterCountry} bank account. Select a matching verified payout account.`,
    };
  }
  if (amountMinor < corridor.minAmountMinor) {
    return { ok: false, reason: "The amount is below the minimum for this corridor." };
  }
  if (amountMinor > corridor.maxAmountMinor) {
    return { ok: false, reason: "The amount is above the maximum for this corridor." };
  }
  return { ok: true };
}

/** Corridors available to a given requester country (enabled AND disabled, with reasons). */
export function corridorsForRequester(requesterCountry: string): CorridorConfig[] {
  return CORRIDORS.filter((c) => c.requesterCountry === requesterCountry);
}
