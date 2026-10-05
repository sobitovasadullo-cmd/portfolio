import { Alert, Linking } from "react-native";
import * as Location from "expo-location";

function askToContinue(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Vazgeç", style: "cancel", onPress: () => resolve(false) },
      { text: "Devam", onPress: () => resolve(true) },
    ]);
  });
}

function alertOpenSettings(reason: string) {
  Alert.alert(
    "Konum izni kapalı",
    `${reason}\n\nAyarlar'dan EcoMap'e (Expo Go'da test ediyorsanız Expo Go'ya) "Uygulamayı Kullanırken" konum izni verin.`,
    [
      { text: "Vazgeç", style: "cancel" },
      { text: "Ayarları Aç", onPress: () => Linking.openSettings().catch(() => {}) },
    ]
  );
}

/**
 * Ensures foreground location permission. Explains why before the system dialog
 * appears, and offers "Ayarları Aç" when the permission is blocked.
 * `reason` is a short Turkish sentence shown to the user.
 */
export async function ensureLocationPermission(reason: string): Promise<boolean> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.granted) return true;
    if (perm.canAskAgain) {
      if (perm.status === Location.PermissionStatus.UNDETERMINED) {
        const ok = await askToContinue("Konum izni gerekli", reason);
        if (!ok) return false;
      }
      perm = await Location.requestForegroundPermissionsAsync();
      if (perm.granted) return true;
    }
    alertOpenSettings(reason);
    return false;
  } catch (e) {
    Alert.alert("Konum izni alınamadı", e instanceof Error ? e.message : String(e));
    return false;
  }
}

export const NAV_PERMISSION_REASON =
  "Navigasyon sırasında haritanın sizi takip edebilmesi ve adım adım yön tarifi verebilmesi için konumunuza erişmemiz gerekiyor. Konumunuz yalnızca bu telefonda kullanılır.";
