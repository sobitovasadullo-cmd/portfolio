import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";

import { EcoPoint } from "../types";
import { isNetworkError, submitReport } from "./reports";

// Offline queue: reports that could not be sent are kept in AsyncStorage (photo
// copied to the document directory so the OS can't purge it from the cache)
// and retried on app start and whenever the map screen gains focus.

const QUEUE_KEY = "ecomap_pending_reports_v1";

export interface PendingReport {
  point: EcoPoint;
  reporterEmail?: string;
  queuedAt: string;
  attempts: number;
  /** Last server-side rejection message, if any (network errors are not stored). */
  lastError?: string;
}

async function readQueue(): Promise<PendingReport[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PendingReport[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Bekleyen bildirimler okunamadı:", e);
    return [];
  }
}

async function writeQueue(queue: PendingReport[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn("Bekleyen bildirimler kaydedilemedi:", e);
  }
}

/** Copies the picked photo to a persistent folder; falls back to the original URI. */
function persistPhoto(id: string, uri?: string): string | undefined {
  if (!uri) return undefined;
  try {
    const dir = new Directory(Paths.document, "pending-photos");
    if (!dir.exists) dir.create({ idempotent: true });
    const target = new File(dir, `${id}.jpg`);
    if (!target.exists) new File(uri).copy(target);
    return target.uri;
  } catch (e) {
    console.warn("Fotoğraf kalıcı klasöre kopyalanamadı:", e);
    return uri;
  }
}

function deletePersistedPhoto(uri?: string) {
  if (!uri || !uri.includes("pending-photos")) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // dosya zaten yoksa sorun değil
  }
}

export async function enqueueReport(point: EcoPoint, reporterEmail?: string): Promise<void> {
  const queue = await readQueue();
  if (queue.some((q) => q.point.id === point.id)) return;
  const photoUri = persistPhoto(point.id, point.photoUri);
  queue.push({ point: { ...point, photoUri }, reporterEmail, queuedAt: new Date().toISOString(), attempts: 0 });
  await writeQueue(queue);
}

/** Pending reports as map points (shown with a "waiting to send" badge). */
export async function loadPendingPoints(): Promise<EcoPoint[]> {
  const queue = await readQueue();
  return queue.map((q) => ({ ...q.point, pending: true }));
}

let flushing: Promise<number> | null = null;

/**
 * Tries to send every queued report. Stops at the first network failure (we're
 * offline). Returns how many were sent. Concurrent calls share one run.
 */
export function flushPendingReports(): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    try {
      const queue = await readQueue();
      if (queue.length === 0) return 0;
      const remaining: PendingReport[] = [];
      let offline = false;
      for (const item of queue) {
        if (offline) {
          remaining.push(item);
          continue;
        }
        try {
          await submitReport(item.point, item.point.photoUri, item.reporterEmail);
          deletePersistedPhoto(item.point.photoUri);
          sent++;
        } catch (e) {
          if (isNetworkError(e)) offline = true;
          remaining.push({
            ...item,
            attempts: item.attempts + 1,
            lastError: isNetworkError(e) ? item.lastError : e instanceof Error ? e.message : String(e),
          });
        }
      }
      // Re-read so reports queued while we were sending are not lost.
      const latest = await readQueue();
      const handled = new Set(queue.map((q) => q.point.id));
      await writeQueue([...remaining, ...latest.filter((q) => !handled.has(q.point.id))]);
    } catch (e) {
      console.warn("Bekleyen bildirimler gönderilemedi:", e);
    }
    return sent;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
