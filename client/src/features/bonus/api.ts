import { useQuery } from "@tanstack/react-query";
import type { BonusOffer, BonusWallet } from "./lib/bonus";

export interface BonusSummary {
  currency: string;
  currencies: string[];
  wallet: BonusWallet;
  blocked: boolean;
  offers: BonusOffer[];
}

async function getJson<T>(url: string, fallback: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message ?? fallback);
  return body.data as T;
}

/** Wallet, currencies, blocked flag and live offers for one currency (B-50). `source` only filters the lists. */
export function useBonusSummary(currency?: string, enabled = true) {
  return useQuery<BonusSummary>({
    queryKey: ["bonus", "summary", currency ?? "home"],
    queryFn: () => getJson<BonusSummary>(`/api/bonus/summary${currency ? `?currency=${encodeURIComponent(currency)}` : ""}`, "We couldn't load your bonus credit. Please try again."),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}

/** Light wallet call for Send Money (B-51). */
export function useBonusWallet(currency?: string, enabled = true) {
  return useQuery<BonusWallet>({
    queryKey: ["bonus", "wallet", currency ?? "home"],
    queryFn: () => getJson<BonusWallet>(`/api/bonus/wallet${currency ? `?currency=${encodeURIComponent(currency)}` : ""}`, "We couldn't load your bonus credit."),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}
