import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";

import { getSupabase, PHOTO_BUCKET } from "./supabase";
import { authorityFor } from "../routing";
import { EcoPoint, PointCategory, ReportStatus } from "../types";

/** Categories the `reports` table accepts (check constraint). */
const DB_CATEGORIES: PointCategory[] = ["electric_fault", "other_issue", "other"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Thrown for failures where retrying later can help (no network, timeout, 5xx). */
export class ReportNetworkError extends Error {}
/** Thrown when the server rejected the report or the app is misconfigured; retrying won't help. */
export class ReportRejectedError extends Error {}

export interface SubmittedReport {
  id: string;
  photoUrl: string | null;
  authority: string;
}

interface SupabaseLikeError {
  message?: string;
  code?: string;
  status?: number;
  statusCode?: string | number;
}

function looksLikeNetworkError(err: unknown): boolean {
  const e = err as SupabaseLikeError | undefined;
  const msg = String(e?.message ?? err ?? "");
  if (/network request failed|failed to fetch|fetch failed|networkerror|abort|timed? ?out|load failed/i.test(msg)) {
    return true;
  }
  const status = Number(e?.status ?? e?.statusCode ?? NaN);
  return status === 0 || status >= 500;
}

function toError(err: unknown, what: string): Error {
  if (err instanceof ReportNetworkError || err instanceof ReportRejectedError) return err;
  if (looksLikeNetworkError(err)) {
    return new ReportNetworkError(`${what}: sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.`);
  }
  const detail = (err as SupabaseLikeError)?.message ?? String(err);
  return new ReportRejectedError(`${what}: sunucu isteği reddetti (${detail}).`);
}

export function isNetworkError(err: unknown): boolean {
  return err instanceof ReportNetworkError;
}

export function newReportId(): string {
  return Crypto.randomUUID();
}

function isAlreadyExists(err: unknown): boolean {
  const e = err as SupabaseLikeError | undefined;
  const msg = String(e?.message ?? "");
  return e?.code === "23505" || String(e?.statusCode) === "409" || /already exists|duplicate/i.test(msg);
}

async function uploadPhoto(id: string, photoUri: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new ReportRejectedError("Sunucu ayarları eksik (.env).");

  let body: ArrayBuffer;
  try {
    body = await new File(photoUri).arrayBuffer();
  } catch (e) {
    throw new ReportRejectedError(`Fotoğraf okunamadı: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Random, unguessable file name (the report uuid) under a date folder.
  const path = `reports/${new Date().toISOString().slice(0, 10)}/${id}.jpg`;
  try {
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, body, { contentType: "image/jpeg", upsert: false });
    // A retry after a lost response finds the file already there — that's fine.
    if (error && !isAlreadyExists(error)) throw error;
  } catch (e) {
    throw toError(e, "Fotoğraf yüklenemedi");
  }
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Uploads the photo (if any) and inserts the report. The uuid is generated on
 * the client (anon has no SELECT on `reports`, so we never read the row back),
 * which also makes retries idempotent: re-sending the same id is a duplicate.
 */
export async function submitReport(
  point: EcoPoint,
  photoUri?: string,
  reporterEmail?: string
): Promise<SubmittedReport> {
  const supabase = getSupabase();
  if (!supabase) throw new ReportRejectedError("Sunucu ayarları eksik (.env dosyası bulunamadı).");
  if (!DB_CATEGORIES.includes(point.category)) {
    throw new ReportRejectedError("Bu kategori sunucuya gönderilemez.");
  }

  const id = UUID_RE.test(point.id) ? point.id : newReportId();
  const authority = authorityFor(point.category).name;
  const photoUrl = photoUri ? await uploadPhoto(id, photoUri) : null;
  const anonymous = !!point.anonymous;

  try {
    const { error } = await supabase.from("reports").insert({
      id,
      category: point.category,
      title: point.title,
      description: point.description ?? null,
      latitude: point.latitude,
      longitude: point.longitude,
      photo_url: photoUrl,
      anonymous,
      reporter_name: anonymous ? null : point.reporterName ?? null,
      reporter_email: anonymous ? null : reporterEmail ?? null,
      authority,
    });
    // Duplicate id = an earlier attempt already got through.
    if (error && !isAlreadyExists(error)) throw error;
  } catch (e) {
    throw toError(e, "Bildirim kaydedilemedi");
  }
  return { id, photoUrl, authority };
}

interface PublicReportRow {
  id: string;
  created_at: string;
  category: PointCategory;
  title: string;
  description: string | null;
  latitude: number;
  longitude: number;
  photo_url: string | null;
  anonymous: boolean;
  reporter_name: string | null;
  authority: string | null;
  status: ReportStatus | null;
}

/** Latest public reports from every phone, newest first. */
export async function fetchReports(): Promise<EcoPoint[]> {
  const supabase = getSupabase();
  if (!supabase) throw new ReportRejectedError("Sunucu ayarları eksik (.env dosyası bulunamadı).");
  try {
    const { data, error } = await supabase
      .from("public_reports")
      .select("id,created_at,category,title,description,latitude,longitude,photo_url,anonymous,reporter_name,authority,status")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return ((data ?? []) as PublicReportRow[])
      .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
      .map((r) => ({
        id: r.id,
        category: r.category,
        title: r.title,
        description: r.description ?? undefined,
        latitude: r.latitude,
        longitude: r.longitude,
        createdAt: r.created_at,
        photoUri: r.photo_url ?? undefined,
        isUserReport: true,
        anonymous: r.anonymous,
        reporterName: r.anonymous ? undefined : r.reporter_name ?? undefined,
        authority: r.authority ?? undefined,
        status: r.status ?? "yeni",
      }));
  } catch (e) {
    throw toError(e, "Bildirimler yüklenemedi");
  }
}
