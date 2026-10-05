import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { CATEGORIES, PointCategory } from "../types";

// Ana ekrandaki harita katmanı menüsünde sadece gerçek "nokta" kategorileri
// gösterilir. Elektrik Arızası ve Diğer Çevre Sorunu gibi bildirim-only
// kategoriler burada bir harita katmanı değildir; onlar sadece "Sorun Bildir"
// formunda seçilebilir.
const LAYER_CATEGORIES = CATEGORIES.filter((c) => !c.reportOnly);

interface Props {
  visible: boolean;
  activeCategories: Set<PointCategory>;
  onToggle: (category: PointCategory) => void;
  onClose: () => void;
  /** Kullanıcı bildirimleri (elektrik arızası, çevre sorunu, diğer) haritada gösterilsin mi */
  showReports: boolean;
  reportCount: number;
  onToggleReports: () => void;
}

export default function CategoryMenu({
  visible,
  activeCategories,
  onToggle,
  onClose,
  showReports,
  reportCount,
  onToggleReports,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Kategoriler</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>Kapat</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.sectionHeader}>Harita Katmanları</Text>
          {LAYER_CATEGORIES.map((cat) => {
            const active = activeCategories.has(cat.key);
            return (
              <TouchableOpacity
                key={cat.key}
                style={styles.row}
                onPress={() => onToggle(cat.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.emoji}>{cat.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{cat.fullLabel}</Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    active && { backgroundColor: cat.color, borderColor: cat.color },
                  ]}
                >
                  {active ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })}

          <Text style={[styles.sectionHeader, { marginTop: 16 }]}>Bildirimler</Text>
          <TouchableOpacity style={styles.row} onPress={onToggleReports} activeOpacity={0.7}>
            <Text style={styles.emoji}>📣</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Kullanıcı Bildirimleri</Text>
              <Text style={styles.rowSubtitle}>
                Elektrik arızası, çevre sorunu ve diğer bildirimler · {reportCount} kayıt
              </Text>
            </View>
            <View style={[styles.checkbox, showReports && { backgroundColor: "#E53935", borderColor: "#E53935" }]}>
              {showReports ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              ⚡ Elektrik arızası veya başka bir çevre sorunu bildirmek için alttaki
              "Sorun Bildir" butonunu kullan.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: "800" },
  closeText: { color: "#E53935", fontSize: 15, fontWeight: "600" },
  list: { paddingBottom: 32 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#999",
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 4,
    marginLeft: 20,
  },
  infoBox: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
  },
  infoText: {
    fontSize: 12.5,
    color: "#7A4A00",
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  emoji: { fontSize: 22, marginRight: 14 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#222" },
  rowSubtitle: { fontSize: 12, color: "#888", marginTop: 2 },
  chevron: { fontSize: 20, color: "#bbb" },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: { color: "white", fontSize: 14, fontWeight: "800" },
});
