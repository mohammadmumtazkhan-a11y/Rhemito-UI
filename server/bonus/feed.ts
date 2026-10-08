/**
 * Bonus notification feed (BONUS-RHEMITO §5.4, B-40 – B-42). Polls Mito's feed and turns each item into
 * a bell/push notification. The cursor survives restarts only in memory here (the prototype's storage
 * is in-memory too); on first start it jumps to the current end so old items are never replayed.
 */

import { dispatchNotification } from "../notificationService";
import type { NotificationEventType } from "@shared/schema";
import { bonusEnabled, getFeed } from "./client";

type Json = Record<string, any>;

const SYMBOLS: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", NGN: "₦", INR: "₹", JPY: "¥", CNY: "¥", AUD: "A$", CAD: "C$", ZAR: "R", KES: "KSh ", GHS: "GH₵", AED: "AED " };
export function money(amount: number, currency: string): string {
  const dp = currency === "JPY" ? 0 : 2;
  return `${SYMBOLS[currency] ?? `${currency} `}${Number(amount).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}
export const ukDate = (value?: string | null) => (value ? value.slice(0, 10).split("-").reverse().join("/") : "");

/** "Includes £2.00 from referrals." when the payload mixes sources (B-41a). */
function includesLine(p: Json): string {
  const parts = Array.isArray(p.by_source) ? p.by_source : [];
  if (parts.length < 2) return "";
  const referral = parts.find((s: Json) => s.credit_source === "REFERRAL");
  const amount = Number(referral?.amount ?? 0);
  return amount > 0 ? ` Includes ${money(amount, String(p.currency))} from referrals.` : "";
}

export interface BonusNote { type: NotificationEventType; title: string; body: string }

/** Feed item → notification text (B-41). */
export function noteFor(item: Json): BonusNote | null {
  const p: Json = item.payload ?? {};
  const cur = String(p.currency ?? "GBP");
  switch (item.type) {
    case "BONUS_EARNED": {
      const amount = money(p.amount, cur);
      const body = p.credit_source === "MANUAL"
        ? `Rhemito has added ${amount} bonus credit to your account. Use it by ${ukDate(p.expires_on)}.`
        : `Bonus earned: ${p.scheme_name ?? p.source_label ?? "Bonus offer"}. ${amount} bonus credit is ready to use on your next transfer by ${ukDate(p.expires_on)}.`;
      return { type: "bonus_earned", title: `You've earned ${amount} bonus credit`, body };
    }
    case "BONUS_USED":
      return { type: "bonus_used", title: "Bonus used", body: `${money(p.amount, cur)} bonus credit was used on transfer ${p.transfer_id}.${includesLine(p)}` };
    case "BONUS_RETURNED":
      return { type: "bonus_returned", title: "Bonus returned", body: `${money(p.amount, cur)} bonus credit is back in your account because transfer ${p.transfer_id} was cancelled or refunded.${includesLine(p)}` };
    case "BONUS_EXPIRING":
      return { type: "bonus_expiring", title: "Bonus expiring soon", body: `Your ${money(p.remaining ?? p.amount, cur)} bonus credit expires on ${ukDate(p.expires_on)}. Use it on your next transfer.${includesLine(p)}` };
    case "BONUS_EXPIRED":
      return { type: "bonus_expired", title: "Bonus expired", body: `${money(p.amount, cur)} bonus credit expired on ${ukDate(p.expired_on)}.${includesLine(p)}` };
    case "BONUS_REVERSED": {
      const amount = money(Number(p.voided ?? 0) + Number(p.clawed_back ?? 0), cur);
      return { type: "bonus_reversed", title: "Bonus removed", body: `Your ${amount} bonus has been removed because the transfer or request that earned it was cancelled or refunded.` };
    }
    case "BONUS_BLOCK_LIFTED":
      return { type: "bonus_unblocked", title: "You can earn bonus again", body: "Your account can earn bonus credit again." };
    default:
      return null;
  }
}

let cursor: number | null = null;
const delivered = new Set<number>();
export function __resetFeed(): void { cursor = null; delivered.clear(); }

/** Fetch new feed items and notify. Returns how many notifications were sent. */
export async function pollFeed(): Promise<number> {
  if (!bonusEnabled()) return 0;
  if (cursor === null) {
    // B-40: first start — begin at the current end of the feed, never replay history
    let at = 0;
    for (let page = 0; page < 200; page++) {
      const r = await getFeed(at, 500);
      if (!r.ok) return 0;
      const last = Number(r.body.last_id ?? at);
      const count = ((r.body.data as Json[]) ?? []).length;
      at = last;
      if (count < 500) break;
    }
    cursor = at;
    return 0;
  }
  const res = await getFeed(cursor, 100);
  if (!res.ok) return 0;
  let sent = 0;
  for (const item of (res.body.data as Json[]) ?? []) {
    if (!delivered.has(item.id)) {
      delivered.add(item.id);
      const note = noteFor(item);
      if (note) {
        try {
          await dispatchNotification({ userId: String(item.customer_id), type: note.type, data: { title: note.title, message: note.body, feedId: item.id } });
          sent++;
        } catch (err) {
          console.error("[bonus] notification failed:", err);
        }
      }
    }
    cursor = Math.max(cursor, Number(item.id));
  }
  return sent;
}

let timer: NodeJS.Timeout | null = null;
export function startFeedPoller(): void {
  if (timer || process.env.NODE_ENV === "test" || !bonusEnabled()) return;
  const every = Number(process.env.BONUS_POLL_INTERVAL_MS ?? 60_000);
  timer = setInterval(() => { void pollFeed().catch(() => {}); }, every);
  timer.unref();
  void pollFeed().catch(() => {});
}
