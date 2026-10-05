import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EMERGENCY_SECTIONS, EmergencyEntry, verifiedAt } from "../data/emergency";

async function call(entry: Pick<EmergencyEntry, "number" | "display">) {
  try {
    await Linking.openURL(`tel:${entry.number}`);
  } catch {
    Alert.alert("Arama başlatılamadı", `Bu cihaz arama yapamıyor olabilir. Numara: ${entry.display}`);
  }
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

export default function EmergencyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.headerSide}>
          <Text style={styles.closeText} numberOfLines={1}>
            Kapat
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Acil Durum Numaraları
        </Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.topCard}>
          <Text style={styles.topTitle}>🚨 Hayati tehlike varsa önce 112'yi arayın.</Text>
          <Text style={styles.topBody}>
            Ambulans, itfaiye, polis, jandarma ve AFAD için tek numara. Ücretsizdir; hatlı/hatsız tüm
            telefonlardan aranabilir.
          </Text>
          <TouchableOpacity
            style={styles.bigCallBtn}
            onPress={() => call({ number: "112", display: "112" })}
            activeOpacity={0.85}
          >
            <Text style={styles.bigCallText}>📞 112'yi Ara</Text>
          </TouchableOpacity>
        </View>

        {EMERGENCY_SECTIONS.map((section) => (
          <View key={section.title}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.entries.map((e) => (
              <View key={e.id} style={styles.card}>
                <Text style={styles.icon}>{e.icon}</Text>
                <View style={styles.cardBody}>
                  <Text style={styles.name}>{e.name}</Text>
                  <Text style={styles.desc}>{e.description}</Text>
                  <Text style={styles.number} selectable>
                    {e.display}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => call(e)}
                  activeOpacity={0.85}
                  accessibilityLabel={`${e.name} ara`}
                >
                  <Text style={styles.callText}>Ara</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.footer}>
          Son kontrol: {formatDate(verifiedAt)}{"\n"}Numaralar resmî kurum kaynaklarından kontrol
          edilmiştir. Değişmiş olabilir; şüphede 112'yi arayın.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#F7F9F7" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: "white",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  headerSide: { minWidth: 70 },
  closeText: { color: "#E53935", fontSize: 15, fontWeight: "600" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700" },
  content: { padding: 16 },
  topCard: {
    backgroundColor: "#FFEBEE",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#EF9A9A",
  },
  topTitle: { fontSize: 17, fontWeight: "800", color: "#B71C1C" },
  topBody: { fontSize: 13, color: "#5D1A1A", marginTop: 6, lineHeight: 18 },
  bigCallBtn: {
    backgroundColor: "#D32F2F",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 14,
    shadowColor: "#D32F2F",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  bigCallText: { color: "white", fontSize: 18, fontWeight: "900" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2E7D32",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  icon: { fontSize: 26, width: 40, textAlign: "center" },
  cardBody: { flex: 1, paddingHorizontal: 8 },
  name: { fontSize: 14, fontWeight: "800", color: "#1a1a1a" },
  desc: { fontSize: 12, color: "#666", marginTop: 2, lineHeight: 16 },
  number: { fontSize: 20, fontWeight: "900", color: "#1B5E20", marginTop: 4 },
  callBtn: {
    backgroundColor: "#2E7D32",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 64,
    alignItems: "center",
  },
  callText: { color: "white", fontSize: 14, fontWeight: "800" },
  footer: { fontSize: 11.5, color: "#999", textAlign: "center", marginTop: 20, lineHeight: 17 },
});
