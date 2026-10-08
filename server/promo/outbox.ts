/**
 * Outbox for background calls to Mito (PROMO-RHEMITO P-32): never blocks the customer's
 * request, retries 1, 5, 15, 60 min then hourly up to 24 attempts, and keeps order per key
 * (e.g. per transfer). The prototype keeps it in memory, like the rest of its storage.
 */

export interface OutboxItem {
  id: number;
  kind: string;
  key: string;
  payload: unknown;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  createdAt: number;
}

type Sender = (item: OutboxItem) => Promise<{ ok: boolean; status: number; error?: string }>;

const BACKOFF_MIN = [1, 5, 15, 60];
const MAX_ATTEMPTS = 24;

export function createOutbox(name: string, send: Sender, opts: { intervalMs?: number } = {}) {
  const items: OutboxItem[] = [];
  let seq = 0;
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let again = false;

  const delayFor = (attempts: number) => (BACKOFF_MIN[attempts - 1] ?? 60) * 60_000;

  async function flush(now = Date.now()): Promise<number> {
    if (running) { again = true; return 0; } // picked up when the current run ends
    running = true;
    let sent = 0;
    try {
      const blocked = new Set<string>();
      for (const item of [...items].sort((a, b) => a.id - b.id)) {
        if (blocked.has(item.key)) continue; // keep order per key
        if (item.nextAttemptAt > now) { blocked.add(item.key); continue; }
        let result: { ok: boolean; status: number; error?: string };
        try { result = await send(item); } catch (e) { result = { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) }; }
        // 4xx other than 408/429 will never succeed: drop it so later items for the key can go
        const permanent = !result.ok && result.status >= 400 && result.status < 500 && result.status !== 408 && result.status !== 429;
        if (result.ok || permanent) {
          if (permanent) console.error(`[${name}] dropped ${item.kind} for ${item.key}:`, result.error);
          items.splice(items.indexOf(item), 1);
          sent += result.ok ? 1 : 0;
          continue;
        }
        item.attempts += 1;
        item.lastError = result.error ?? `HTTP ${result.status}`;
        if (item.attempts >= MAX_ATTEMPTS) {
          console.error(`[${name}] gave up on ${item.kind} for ${item.key} after ${item.attempts} attempts:`, item.lastError);
          items.splice(items.indexOf(item), 1);
          continue;
        }
        item.nextAttemptAt = now + delayFor(item.attempts);
        blocked.add(item.key);
      }
    } finally {
      running = false;
    }
    if (again) { again = false; sent += await flush(); }
    return sent;
  }

  function enqueue(kind: string, key: string, payload: unknown): OutboxItem {
    const item: OutboxItem = { id: ++seq, kind, key, payload, attempts: 0, nextAttemptAt: 0, lastError: null, createdAt: Date.now() };
    items.push(item);
    void flush();
    return item;
  }

  function start(): void {
    if (timer || process.env.NODE_ENV === "test") return;
    timer = setInterval(() => { void flush(); }, opts.intervalMs ?? 30_000);
    timer.unref();
  }

  return { enqueue, flush, start, pending: () => items.map((i) => ({ ...i })), clear: () => { items.length = 0; } };
}
