import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserSession } from "./types";

const SESSION_KEY = "ecomap_user_session_v1";

// NOT: Bu basit bir yerel oturum sistemidir (sunucu tarafı doğrulama yapmaz).
// Prototip/demo amaçlıdır; gerçek bir üründe Firebase Auth, Supabase gibi bir
// kimlik doğrulama servisiyle değiştirilmelidir.
export async function loadSession(): Promise<UserSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: UserSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

// ---- Doğrulama yardımcıları ----

export function normalizeName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toLocaleUpperCase("tr") + w.slice(1).toLocaleLowerCase("tr"))
    .join(" ");
}

/** En az 2 karakter, yalnızca harf/boşluk/tire/kesme; en az bir harf. */
export function validateName(raw: string): string | null {
  const v = raw.trim().replace(/\s+/g, " ");
  if (v.length < 2) return "Adın en az 2 harf olmalı.";
  if (v.length > 60) return "Ad çok uzun (en fazla 60 karakter).";
  if (!/^[\p{L}][\p{L}\s.'’-]*$/u.test(v)) return "Adın sadece harf içermeli (rakam veya sembol olmasın).";
  return null;
}

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateEmail(raw: string): string | null {
  const v = normalizeEmail(raw);
  if (!v) return "E-posta adresi gerekli.";
  if (/\s/.test(v)) return "E-posta boşluk içeremez.";
  if (!EMAIL_RE.test(v) || v.includes("..")) return "Geçerli bir e-posta yaz (örn: ad@gmail.com).";
  return null;
}

const DOMAIN_FIXES: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.con": "gmail.com",
  "gnail.com": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outlook.con": "outlook.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "icloud.con": "icloud.com",
};

/** Sık yapılan alan adı yazım hatası varsa düzeltilmiş adresi döner. */
export function suggestEmail(raw: string): string | null {
  const v = normalizeEmail(raw);
  const at = v.lastIndexOf("@");
  if (at < 1) return null;
  const fix = DOMAIN_FIXES[v.slice(at + 1)];
  return fix ? `${v.slice(0, at)}@${fix}` : null;
}
