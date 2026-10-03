import { useQuery } from "@tanstack/react-query";
import type { RewardsSummary } from "@/lib/rewards";

/** Offer, wallet and referrals for the signed-in customer (or the demo customer). */
export function useRewards() {
  return useQuery<RewardsSummary>({
    queryKey: ["/api/rewards/summary"],
    queryFn: async () => {
      const res = await fetch("/api/rewards/summary", { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message ?? "We couldn't load your rewards. Please try again.");
      return body.data as RewardsSummary;
    },
    retry: 1,
    staleTime: 30_000,
  });
}
