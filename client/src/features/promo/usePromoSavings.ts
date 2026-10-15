import { useQuery } from "@tanstack/react-query";

export interface PromoSavingItem { id: string; code: string; amount: number; currency: string | null; transferId: string; createdAt: string }
export interface PromoSavings { items: PromoSavingItem[]; saved: Record<string, number> }

/**
 * What the customer saved with promo codes (PROMO-RHEMITO P-12, P-50).
 * `notAvailable` is true when Mito has no savings endpoint yet (404) so callers can fall back (P-53).
 */
export function usePromoSavings() {
  const q = useQuery<{ savings: PromoSavings | null; notAvailable: boolean }>({
    queryKey: ["promo", "savings"],
    queryFn: async () => {
      const res = await fetch("/api/promocodes/savings", { credentials: "include" });
      if (res.status === 404) return { savings: null, notAvailable: true };
      if (!res.ok) throw new Error("PROMO_SAVINGS_UNAVAILABLE");
      return { savings: ((await res.json()) as { data: PromoSavings }).data, notAvailable: false };
    },
    staleTime: 30_000,
    retry: false,
  });
  return { ...q, savings: q.data?.savings ?? null, notAvailable: q.data?.notAvailable ?? false };
}
