import "react-native-url-polyfill/auto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Values come from .env (EXPO_PUBLIC_* are inlined at build time). See README.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const PHOTO_BUCKET = "sazecomap";

/** Default request timeout; photo uploads get a longer one. */
const REQUEST_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 45_000;

/** fetch with a timeout, so an unreachable server never hangs the UI. */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const timeout = url.includes("/storage/v1/object/") ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  const outer = init?.signal;
  if (outer) {
    if (outer.aborted) ctrl.abort();
    else outer.addEventListener("abort", () => ctrl.abort());
  }
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
};

let client: SupabaseClient | null = null;

/** Returns the shared client, or null if .env is missing (the app keeps working offline). */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("Supabase yapılandırılmamış: .env dosyasında EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY eksik.");
    return null;
  }
  // No Supabase Auth: the anon (publishable) key is used for every request.
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchWithTimeout },
  });
  return client;
}
