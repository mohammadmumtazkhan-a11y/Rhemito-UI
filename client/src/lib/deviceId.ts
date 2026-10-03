/**
 * Device ID — a random, anonymous ID kept in this browser so the referral engine
 * can tell when a "new" customer is signing up from the same device as their referrer.
 * It holds no personal data and is only sent to Rhemito's own API.
 */

const STORAGE_KEY = "rhemito.deviceId";
export const DEVICE_ID_HEADER = "X-Device-Id";

let memoryId: string | null = null;

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Returns this browser's device ID, creating it on first use. Never throws. */
export function getDeviceId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    const id = makeId();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // Storage blocked (private mode etc.) — keep one ID for this page session
    memoryId ??= makeId();
    return memoryId;
  }
}

function isOwnApiCall(input: RequestInfo | URL): boolean {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (raw.startsWith("/api/")) return true;
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

let installed = false;

/** Adds the device ID header to every request this app makes to its own /api. Safe to call twice. */
export function installDeviceIdHeader(): void {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isOwnApiCall(input)) return originalFetch(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has(DEVICE_ID_HEADER)) headers.set(DEVICE_ID_HEADER, getDeviceId());
    return originalFetch(input, { ...init, headers });
  };
}
