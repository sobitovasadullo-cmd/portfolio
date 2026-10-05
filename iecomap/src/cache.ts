// Tiny in-memory TTL cache for API responses (lost on app restart, by design).
// Concurrent callers for the same key share one in-flight promise.

interface Entry<T> {
  at: number;
  value?: T;
  pending?: Promise<T>;
}

const store = new Map<string, Entry<unknown>>();

export const TEN_MINUTES = 10 * 60 * 1000;

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit?.value !== undefined && Date.now() - hit.at < ttlMs) return hit.value;
  if (hit?.pending) return hit.pending;
  const pending = load().then(
    (value) => {
      store.set(key, { at: Date.now(), value });
      return value;
    },
    (err) => {
      store.delete(key);
      throw err;
    }
  );
  store.set(key, { at: hit?.at ?? 0, value: hit?.value, pending });
  return pending;
}

/** fetch + JSON with timeout; throws a Turkish, user-presentable Error on failure. */
export async function fetchJson<T>(url: string, timeoutMs = 10_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Sunucu hatası (HTTP ${res.status}).`);
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("İstek zaman aşımına uğradı. İnternet bağlantınızı kontrol edin.");
    }
    if (e instanceof Error && e.message.startsWith("Sunucu hatası")) throw e;
    throw new Error("Veri alınamadı. İnternet bağlantınızı kontrol edin.");
  } finally {
    clearTimeout(timer);
  }
}
