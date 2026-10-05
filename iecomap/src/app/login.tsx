import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import {
  normalizeEmail,
  normalizeName,
  saveSession,
  suggestEmail,
  validateEmail,
  validateName,
} from "../auth";
import EcoMascot from "../components/EcoMascot";

export default function LoginScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const suggestion = suggestEmail(email);

  async function handleContinue() {
    const nErr = validateName(name);
    const eErr = validateEmail(email);
    setNameError(nErr);
    setEmailError(eErr);
    if (nErr || eErr) return;
    if (suggestion) {
      setEmailError(`Bunu mu demek istedin: ${suggestion}?`);
      return;
    }
    setSubmitting(true);
    try {
      await saveSession({ name: normalizeName(name), email: normalizeEmail(email) });
      // Giriş tamamlanınca kullanıcıyı haritaya değil, doğrudan bildirim
      // formuna götürüyoruz — "replace" kullanmamızın sebebi, bildirim
      // ekranından "Vazgeç" dendiğinde login ekranına değil haritaya
      // dönülmesini sağlamak.
      router.replace("/report");
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      Alert.alert(
        "Bir şeyler ters gitti",
        `Girişin kaydedilemedi, lütfen tekrar dene.\n\nDetay: ${detail}`
      );
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.headerSide}>
          <Text style={styles.cancelText} numberOfLines={1}>
            Vazgeç
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Sorun Bildir
        </Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mascotWrap}>
          <EcoMascot size={130} />
          <Text style={styles.mascotName}>Yeşilcik</Text>
        </View>

        <Text style={styles.introTitle}>
          Elektrik arızalarını ve çevre sorunlarını buradan bildirebilirsin!
        </Text>
        <Text style={styles.introBody}>
          Kaçak atık, bozuk aydınlatma, elektrik arızası ya da başka bir çevre
          sorunu mu gördün? Devam etmek için önce kısa bir profil oluştur —
          şifre gerekmez, bilgilerin sadece bu telefonda saklanır.
        </Text>

        <View style={styles.formCard}>
          <Text style={styles.label}>Adın</Text>
          <TextInput
            style={styles.input}
            placeholder="Örn: Ahmet Yılmaz"
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (nameError) setNameError(null);
            }}
            autoCapitalize="words"
            returnKeyType="next"
          />
          {nameError ? <Text style={styles.error}>{nameError}</Text> : null}

          <Text style={styles.label}>E-posta</Text>
          <TextInput
            style={styles.input}
            placeholder="ornek@eposta.com"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (emailError) setEmailError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
          {emailError ? <Text style={styles.error}>{emailError}</Text> : null}
          {suggestion ? (
            <TouchableOpacity
              onPress={() => {
                setEmail(suggestion);
                setEmailError(null);
              }}
            >
              <Text style={styles.suggest}>✔ {suggestion} olarak düzelt</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.submitButton, submitting && { opacity: 0.6 }]}
            onPress={handleContinue}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>
              {submitting ? "Giriş yapılıyor..." : "Giriş Yap ve Bildirime Başla"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.note}>
          Bu basit bir yerel profildir, gerçek bir hesap oluşturmaz.
        </Text>
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
  content: { padding: 20, paddingBottom: 48, alignItems: "center" },
  mascotWrap: { alignItems: "center", marginTop: 8, marginBottom: 12 },
  mascotName: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "800",
    color: "#2E7D32",
    letterSpacing: 0.5,
  },
  introTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 23,
  },
  introBody: {
    fontSize: 13.5,
    color: "#666",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  formCard: {
    width: "100%",
    backgroundColor: "#F7F9F7",
    borderRadius: 16,
    padding: 18,
  },
  label: { fontSize: 13, fontWeight: "700", color: "#555", marginBottom: 8, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: "white",
  },
  error: { color: "#E53935", fontSize: 12, marginTop: 6, fontWeight: "600" },
  suggest: { color: "#2E7D32", fontSize: 13, marginTop: 6, fontWeight: "700" },
  submitButton: {
    backgroundColor: "#2E7D32",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 22,
    shadowColor: "#2E7D32",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  submitText: { color: "white", fontSize: 15, fontWeight: "700" },
  note: { fontSize: 12, color: "#aaa", marginTop: 16, textAlign: "center" },
});
