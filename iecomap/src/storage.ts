import AsyncStorage from "@react-native-async-storage/async-storage";
import { EcoPoint } from "./types";

const REPORTS_KEY = "iecomap_user_reports_v1";

export async function loadUserReports(): Promise<EcoPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EcoPoint[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Bildirimler okunamadı:", e);
    return [];
  }
}

export async function saveUserReport(point: EcoPoint): Promise<void> {
  const current = await loadUserReports();
  const next = [point, ...current];
  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(next));
}

export async function deleteUserReport(id: string): Promise<void> {
  const current = await loadUserReports();
  const next = current.filter((p) => p.id !== id);
  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(next));
}
