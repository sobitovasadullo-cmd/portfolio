import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { AQI_BANDS } from "../airQuality";

interface Props {
  loading: boolean;
  error: string | null;
  partialFailure: number;
  onRetry: () => void;
  onClose: () => void;
}

/** Compact color legend shown on the map while the air-quality layer is on. */
export default function AirQualityLegend({ loading, error, partialFailure, onRetry, onClose }: Props) {
  return (
    <View style={styles.box}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>🌫️ Hava Kalitesi (Avrupa AQI)</Text>
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <Text style={styles.close}>Kapat</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingText}>İlçe verileri yükleniyor…</Text>
        </View>
      ) : error ? (
        <View>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.bands}>
            {AQI_BANDS.map((b) => (
              <View key={b.level} style={styles.bandItem}>
                <View style={[styles.swatch, { backgroundColor: b.color }]} />
                <Text style={styles.bandText}>
                  {b.range} {b.label}
                </Text>
              </View>
            ))}
          </View>
          {partialFailure > 0 ? (
            <Text style={styles.error}>{partialFailure} ilçe için veri alınamadı.</Text>
          ) : null}
          <Text style={styles.hint}>Ayrıntı için ilçe etiketine dokunun · Model verisi (CAMS)</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 14,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 12.5, fontWeight: "800", color: "#222" },
  close: { fontSize: 12.5, fontWeight: "700", color: "#E53935" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  loadingText: { fontSize: 12, color: "#666" },
  bands: { flexDirection: "row", flexWrap: "wrap", marginTop: 6, columnGap: 10, rowGap: 4 },
  bandItem: { flexDirection: "row", alignItems: "center" },
  swatch: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
  bandText: { fontSize: 10.5, color: "#333", fontWeight: "600" },
  hint: { fontSize: 10.5, color: "#888", marginTop: 6 },
  error: { fontSize: 12, color: "#C62828", fontWeight: "600", marginTop: 6 },
  retryBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#1E88E5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 6,
  },
  retryText: { color: "white", fontSize: 12, fontWeight: "700" },
});
