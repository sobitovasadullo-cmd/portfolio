import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Linking,
  Platform,
} from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EcoPoint, PointCategory, REPORTABLE_CATEGORIES } from "../types";
import { authorityFor } from "../routing";
import { normalizeName, validateName } from "../auth";

interface Props {
  onCancel: () => void;
  onSubmit: (point: EcoPoint) => void;
  initialCategory?: PointCategory;
  /** Kayıtlı oturumdaki ad — "Ad Soyad" alanını önceden doldurmak için */
  defaultName?: string;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Permission denied for good → explain and offer to open the system settings. */
function alertOpenSettings(title: string, body: string) {
  Alert.alert(title, body, [
    { text: "Vazgeç", style: "cancel" },
    { text: "Ayarları Aç", onPress: () => Linking.openSettings().catch(() => {}) },
  ]);
}

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.6,
  allowsEditing: true,
};

export default function ReportScreen({
  onCancel,
  onSubmit,
  initialCategory = "other_issue",
  defaultName = "",
}: Props) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<PointCategory>(initialCategory);
  const [name, setName] = useState(defaultName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [anonymous, setAnonymous] = useState(false);

  useEffect(() => {
    fetchLocation();
  }, []);

  async function fetchLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Konum izni gerekli",
          "Bildirimin doğru yere eklenmesi için konum iznine ihtiyacımız var."
        );
        setLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch (e) {
      Alert.alert("Konum alınamadı", "Lütfen tekrar deneyin.");
    } finally {
      setLocating(false);
    }
  }

  async function pickFromLibrary() {
    try {
      Keyboard.dismiss();
      // iOS 14+ sistem fotoğraf seçicisi (PHPicker) ve Android 13+ fotoğraf seçicisi
      // galeri izni olmadan da çalışır; izin yine de istenir ama yalnızca Android'de
      // kalıcı reddedildiyse engeller.
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted && Platform.OS === "android" && !perm.canAskAgain) {
        alertOpenSettings(
          "Galeri izni kapalı",
          "Fotoğraf seçebilmek için Ayarlar'dan EcoMap'e fotoğraf erişimi verin."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
      if (!result.canceled && result.assets?.[0]?.uri) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert("Galeri açılamadı", `Fotoğraf seçilirken bir hata oluştu.\n\nDetay: ${errorMessage(e)}`);
    }
  }

  async function takePhoto() {
    try {
      Keyboard.dismiss();
      let perm = await ImagePicker.getCameraPermissionsAsync();
      if (!perm.granted && perm.canAskAgain) {
        perm = await ImagePicker.requestCameraPermissionsAsync();
      }
      if (!perm.granted) {
        alertOpenSettings(
          "Kamera izni gerekli",
          "Fotoğraf çekebilmek için Ayarlar'dan EcoMap'e (Expo Go'da test ediyorsanız Expo Go'ya) kamera izni verin."
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
      if (!result.canceled && result.assets?.[0]?.uri) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert(
        "Kamera açılamadı",
        `Fotoğraf çekilirken bir hata oluştu. (iOS simülatöründe kamera yoktur; gerçek cihazda deneyin.)\n\nDetay: ${errorMessage(e)}`
      );
    }
  }

  function handleSubmit() {
    if (!anonymous) {
      const nErr = validateName(name);
      setNameError(nErr);
      if (nErr) {
        Alert.alert("Ad Soyad gerekli", nErr);
        return;
      }
    }
    if (!title.trim()) {
      Alert.alert("Başlık gerekli", "Lütfen bildirimine kısa bir başlık yaz.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Açıklama gerekli", "Lütfen sorunu veya noktayı kısaca açıkla.");
      return;
    }
    if (!photoUri) {
      Alert.alert(
        "Fotoğraf gerekli",
        "Bildirimini gönderebilmek için bir fotoğraf çekmen veya galeriden seçmen gerekiyor."
      );
      return;
    }
    if (!coords) {
      Alert.alert("Konum gerekli", "Konum alınamadı, lütfen tekrar deneyin.");
      return;
    }
    setSubmitting(true);
    const point: EcoPoint = {
      id: `report-${Date.now()}`,
      category,
      title: title.trim(),
      description: description.trim(),
      latitude: coords.latitude,
      longitude: coords.longitude,
      createdAt: new Date().toISOString(),
      photoUri,
      isUserReport: true,
      anonymous,
      reporterName: anonymous ? undefined : normalizeName(name),
      district: "Mardin",
    };
    onSubmit(point);
    setSubmitting(false);
  }

  const authority = authorityFor(category);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} hitSlop={10} style={styles.headerSide}>
          <Text style={styles.cancelText} numberOfLines={1}>
            Vazgeç
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Bildirim Oluştur
        </Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>Kategori</Text>
        <View style={styles.categoryRow}>
          {REPORTABLE_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              onPress={() => setCategory(cat.key)}
              style={[
                styles.categoryChip,
                { borderColor: cat.color },
                category === cat.key && { backgroundColor: cat.color },
              ]}
            >
              <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
              <Text
                style={[
                  styles.categoryLabel,
                  category === cat.key && styles.categoryLabelActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>{anonymous ? "Ad Soyad (isteğe bağlı)" : "Ad Soyad *"}</Text>
        <TextInput
          style={[styles.input, nameError && !anonymous ? styles.inputError : null]}
          placeholder="Örn: Ahmet Yılmaz"
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (nameError) setNameError(null);
          }}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={60}
        />
        {nameError && !anonymous ? <Text style={styles.fieldError}>{nameError}</Text> : null}
        {anonymous ? (
          <Text style={styles.fieldHint}>Anonim bildirimde adınız kaydedilmez ve gösterilmez.</Text>
        ) : null}

        <Text style={styles.sectionLabel}>Başlık *</Text>
        <TextInput
          style={styles.input}
          placeholder="Örn: Kaçak atık dökümü"
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />

        <Text style={styles.sectionLabel}>Açıklama *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Sorunu veya noktayı kısaca anlat..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          maxLength={500}
        />

        <Text style={styles.sectionLabel}>Fotoğraf *</Text>
        {photoUri ? (
          <View>
            <View style={styles.photoWrap}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              {coords && (
                <View style={styles.locationBadge}>
                  <Text style={styles.locationBadgeText}>
                    📍 {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => setPhotoUri(undefined)} hitSlop={8} style={styles.removeBtn}>
              <Text style={styles.removePhoto}>🗑️ Kaldır</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoButtonsRow}>
            <TouchableOpacity style={styles.photoButton} onPress={takePhoto} activeOpacity={0.7}>
              <Text style={styles.photoButtonText}>📷 Fotoğraf Çek</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} onPress={pickFromLibrary} activeOpacity={0.7}>
              <Text style={styles.photoButtonText}>🖼️ Galeriden Seç</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionLabel}>Konum</Text>
        <View style={styles.locationBox}>
          {locating ? (
            <ActivityIndicator />
          ) : coords ? (
            <Text style={styles.locationText}>
              📍 {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
            </Text>
          ) : (
            <Text style={styles.locationText}>Konum alınamadı</Text>
          )}
          <TouchableOpacity onPress={fetchLocation}>
            <Text style={styles.refreshText}>Yenile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.routeNote}>
          <Text style={styles.routeNoteText}>
            {category === "other"
              ? "📨 Bu bildirim ilgili kuruma yönlendirilecek."
              : `📨 Bu bildirim ilgili kuruma yönlendirilecek: ${authority.name}${authority.hotline ? ` (Hat: ${authority.hotline})` : ""}`}
          </Text>
        </View>

        <TouchableOpacity style={styles.anonRow} onPress={() => setAnonymous((a) => !a)}>
          <Text style={styles.anonBox}>{anonymous ? "☑" : "☐"}</Text>
          <Text style={styles.anonText}>İsmim görünmeden anonim olarak bildir</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitButton, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>Bildirimi Gönder</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "white" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  headerSide: { minWidth: 70 },
  cancelText: { color: "#E53935", fontSize: 15, fontWeight: "600" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700" },
  content: { padding: 16, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#555",
    marginTop: 18,
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  categoryEmoji: { fontSize: 13, marginRight: 4 },
  categoryLabel: { fontSize: 12, fontWeight: "600", color: "#333" },
  categoryLabelActive: { color: "white" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputError: { borderColor: "#E53935" },
  fieldError: { color: "#E53935", fontSize: 12, marginTop: 6, fontWeight: "600" },
  fieldHint: { color: "#888", fontSize: 12, marginTop: 6 },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  photoButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  photoButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  photoButtonText: { fontSize: 13, fontWeight: "600", color: "#333" },
  photoWrap: {
    position: "relative",
  },
  photoPreview: {
    width: "100%",
    height: 180,
    borderRadius: 12,
  },
  locationBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  locationBadgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
  },
  removeBtn: { alignSelf: "flex-start", marginTop: 8, paddingVertical: 4 },
  removePhoto: { color: "#E53935", fontSize: 13.5, fontWeight: "700" },
  locationBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f6f6f6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  locationText: { fontSize: 13, color: "#333" },
  refreshText: { fontSize: 13, color: "#1E88E5", fontWeight: "600" },
  routeNote: {
    backgroundColor: "#E8F5E9",
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  routeNoteText: { fontSize: 12.5, color: "#1B5E20", fontWeight: "600", lineHeight: 18 },
  anonRow: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  anonBox: { fontSize: 20, marginRight: 8, color: "#2E7D32" },
  anonText: { fontSize: 13.5, color: "#333" },
  submitButton: {
    backgroundColor: "#2E7D32",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 28,
  },
  submitText: { color: "white", fontSize: 15, fontWeight: "700" },
});
