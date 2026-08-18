/**
 * File-backed session store (development only).
 *
 * Extends express-session's Store so sessions survive dev-server restarts —
 * the missing piece behind "we are already logged in". Production uses a
 * proper shared store (e.g. connect-pg-simple over Postgres).
 */

import session from "express-session";
import fs from "fs";
import path from "path";

const STATE_DIR = path.resolve(process.cwd(), ".dev-state");
const SESSIONS_FILE = path.join(STATE_DIR, "sessions.json");

type SessionData = session.SessionData & Record<string, unknown>;

function loadAll(): Record<string, SessionData> {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return {};
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveAll(all: Record<string, SessionData>): void {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(all));
  } catch (err) {
    console.warn("[fileSessionStore] write failed:", err instanceof Error ? err.message : err);
  }
}

let writeTimer: NodeJS.Timeout | null = null;
function persist(all: Record<string, SessionData>): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    saveAll(all);
  }, 200);
  writeTimer.unref?.();
}

export class FileSessionStore extends session.Store {
  private sessions: Record<string, SessionData>;

  constructor() {
    super();
    this.sessions = loadAll();
  }

  override get(sid: string, callback: (err: unknown, session?: SessionData | null) => void): void {
    const data = this.sessions[sid];
    if (!data) return callback(null, null);
    // Expired cookie → treat as absent
    try {
      const expires = data.cookie?.expires ? new Date(data.cookie.expires as unknown as string) : null;
      if (expires && expires.getTime() <= Date.now()) {
        delete this.sessions[sid];
        persist(this.sessions);
        return callback?.(null, null);
      }
    } catch {
      // fall through and return the data
    }
    return callback?.(null, data);
  }

  override set(sid: string, sessionData: SessionData, callback?: (err?: unknown) => void): void {
    this.sessions[sid] = sessionData;
    persist(this.sessions);
    return callback?.(null);
  }

  override destroy(sid: string, callback?: (err?: unknown) => void): void {
    delete this.sessions[sid];
    persist(this.sessions);
    return callback?.(null);
  }

  override touch(sid: string, sessionData: SessionData, callback?: (err?: unknown) => void): void {
    this.sessions[sid] = sessionData;
    persist(this.sessions);
    return callback?.(null);
  }
}
