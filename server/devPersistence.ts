/**
 * Development persistence — Rhemito prototype.
 *
 * The prototype stores everything in memory, which means every dev-server
 * restart logs everyone out (and drops pending registrations). This module
 * adds a lightweight file-backed snapshot for exactly the data login
 * continuity needs — auth users, OTP codes and sessions — so "already logged
 * in" survives restarts during development. It is DEV/TEST ONLY: production
 * uses real infrastructure (Postgres session store etc.) and never this file.
 */

import fs from "fs";
import path from "path";
import type { EventEmitter } from "events";

const SNAPSHOT_DIR = path.resolve(process.cwd(), ".dev-state");
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, "auth-snapshot.json");

export interface DevSnapshot {
  authUsers: Array<Record<string, unknown>>;
  otpCodes: Array<Record<string, unknown>>;
  groupPayCampaigns: Array<Record<string, unknown>>;
  groupPayContributions: Array<Record<string, unknown>>;
  sessions: Record<string, Record<string, unknown>>;
  // Receive-money continuity: invoices (with their documents, events and
  // client emails), money requests and payout accounts survive restarts so
  // mid-test journeys are not lost. Sequence counters keep numbering stable.
  invoices: Array<Record<string, unknown>>;
  invoiceDocuments: Array<Record<string, unknown>>;
  invoiceEvents: Array<Record<string, unknown>>;
  clientEmails: Array<Record<string, unknown>>;
  moneyRequests: Array<Record<string, unknown>>;
  payoutAccounts: Array<Record<string, unknown>>;
  sequences: { invoice: number; moneyRequest: number };
}

/** Date-valued fields per collection (revived on load). */
const DATE_FIELDS: Record<string, string[]> = {
  authUsers: ["createdAt"],
  otpCodes: ["expiresAt", "createdAt"],
  groupPayCampaigns: ["createdAt"],
  groupPayContributions: ["paymentDate"],
  invoices: [
    "paymentInitiatedAt", "expiresAt", "sentAt", "paidAt", "expiredAt", "cancelledAt",
    "dueReminderSentAt", "expiryReminderSentAt", "newLinkRequestedAt", "createdAt",
  ],
  invoiceDocuments: ["uploadedAt", "expiresAt"],
  invoiceEvents: ["createdAt"],
  clientEmails: ["lastAttemptAt", "createdAt"],
  moneyRequests: [
    "expiresAt", "viewedAt", "sessionExpiresAt", "paymentInitiatedAt", "fundedAt",
    "payoutSubmittedAt", "paidOutAt", "cancelledAt", "createdAt",
  ],
  payoutAccounts: ["createdAt", "verifiedAt"],
};

function revive(collection: string, row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  for (const field of DATE_FIELDS[collection] ?? []) {
    const value = out[field];
    if (typeof value === "string") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) out[field] = date;
    }
  }
  return out;
}

export function loadSnapshot(): DevSnapshot | null {
  try {
    if (!fs.existsSync(SNAPSHOT_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf-8")) as Partial<DevSnapshot>;
    return {
      authUsers: (raw.authUsers ?? []).map((r) => revive("authUsers", r)),
      otpCodes: (raw.otpCodes ?? []).map((r) => revive("otpCodes", r)),
      groupPayCampaigns: (raw.groupPayCampaigns ?? []).map((r) => revive("groupPayCampaigns", r)),
      groupPayContributions: (raw.groupPayContributions ?? []).map((r) => revive("groupPayContributions", r)),
      sessions: raw.sessions ?? {},
      invoices: (raw.invoices ?? []).map((r) => revive("invoices", r)),
      invoiceDocuments: (raw.invoiceDocuments ?? []).map((r) => revive("invoiceDocuments", r)),
      invoiceEvents: (raw.invoiceEvents ?? []).map((r) => revive("invoiceEvents", r)),
      clientEmails: (raw.clientEmails ?? []).map((r) => revive("clientEmails", r)),
      moneyRequests: (raw.moneyRequests ?? []).map((r) => revive("moneyRequests", r)),
      payoutAccounts: (raw.payoutAccounts ?? []).map((r) => revive("payoutAccounts", r)),
      sequences: {
        invoice: Number(raw.sequences?.invoice ?? 0) || 0,
        moneyRequest: Number(raw.sequences?.moneyRequest ?? 0) || 0,
      },
    };
  } catch (err) {
    console.warn("[devPersistence] snapshot load failed (starting fresh):", err instanceof Error ? err.message : err);
    return null;
  }
}

let writeTimer: NodeJS.Timeout | null = null;
let latestSnapshot: DevSnapshot | null = null;

export function queuePersist(build: () => DevSnapshot, emitter?: EventEmitter): void {
  if (process.env.NODE_ENV === "production") return;
  latestSnapshot = build();
  if (writeTimer) return; // debounced write-through
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
      fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(latestSnapshot ?? build(), null, 2));
    } catch (err) {
      console.warn("[devPersistence] snapshot write failed:", err instanceof Error ? err.message : err);
    }
  }, 250);
  writeTimer.unref?.();
}

export const SNAPSHOT_FILE_PATH = SNAPSHOT_FILE;
