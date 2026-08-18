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
  sessions: Record<string, Record<string, unknown>>;
}

/** Date-valued fields per collection (revived on load). */
const DATE_FIELDS: Record<string, string[]> = {
  authUsers: ["createdAt"],
  otpCodes: ["expiresAt", "createdAt"],
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
    const raw = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf-8")) as DevSnapshot;
    return {
      authUsers: (raw.authUsers ?? []).map((r) => revive("authUsers", r)),
      otpCodes: (raw.otpCodes ?? []).map((r) => revive("otpCodes", r)),
      sessions: raw.sessions ?? {},
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
