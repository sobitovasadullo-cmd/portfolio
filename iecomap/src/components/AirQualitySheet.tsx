import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AQI_BANDS, DistrictAirQuality, formatAqTime } from "../airQuality";

interface Props {
  data: DistrictAirQuality;
  onClose: () => void;
}

function fmt(v: number | null): string {
  return v == null ? "–" : v.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

/** Bottom sheet with the details for one district's modeled air quality. */
export default function AirQualitySheet({ data, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const band = data.band;
  const rows: [string, number | null][] = [
    ["PM2.5", data.pm25],
    ["PM10", data.pm10],
    ["NO₂ (azot dioksit)", data.no2],
    ["O₃ (ozon)", data.o3],
    ["SO₂ (kükürt dioksit)", data.so2],
  ];

  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8, maxHeight: height * 0.7 }]}>
      <View style={styles.handle} />
      <View style={styles.headerRow}>
        <View style={[styles.aqiBadge, { backgroundColor: band?.color ?? "#999" }]}>
          <Text style={styles.aqiValue}>{data.aqi ?? "–"}</Text>
          <Text style={styles.aqiUnit}>AQI</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{data.name} · Hava Kalitesi</Text>
          <Text style={[styles.level, { color: band?.color ?? "#666" }]}>
            {band ? `${band.label} (Avrupa AQI ${band.range})` : "Veri yok"}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
        {band ? (
          <View style={[styles.adviceBox, { borderLeftColor: band.color }]}>
            <Text style={styles.adviceTitle}>Sağlık önerisi</Text>
            <Text style={styles.adviceText}>{band.advice}</Text>
          </View>
        ) : null}

        <View style={styles.table}>
          {rows.map(([label, v]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Text style={styles.rowValue}>{fmt(v)} µg/m³</Text>
            </View>
          ))}
          {data.dust != null ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Toz</Text>
              <Text style={styles.rowValue}>{fmt(data.dust)} µg/m³</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.meta}>Veri zamanı: {formatAqTime(data.time)} (Türkiye saati)</Text>
        <Text style={styles.meta}>
          Kaynak: Open-Meteo / CAMS (model verisi, istasyon ölçümü değildir). İlçe merkezi için yaklaşık
          değerdir.
        </Text>
        <Text style={styles.meta}>
          Bantlar: {AQI_BANDS.map((b) => `${b.range} ${b.label}`).join(" · ")}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#ddd", alignSelf: "center", marginBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  aqiBadge: { width: 58, height: 58, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  aqiValue: { color: "white", fontSize: 22, fontWeight: "800" },
  aqiUnit: { color: "white", fontSize: 10, fontWeight: "700", marginTop: -2 },
  title: { fontSize: 17, fontWeight: "800", color: "#1a1a1a" },
  level: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontSize: 14, color: "#666" },
  adviceBox: { backgroundColor: "#F7F9F7", borderRadius: 10, padding: 12, marginTop: 14, borderLeftWidth: 4 },
  adviceTitle: { fontSize: 12, fontWeight: "800", color: "#555", marginBottom: 4 },
  adviceText: { fontSize: 13.5, color: "#333", lineHeight: 19 },
  table: { backgroundColor: "#f6f6f6", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, marginTop: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 },
  rowLabel: { fontSize: 14, color: "#555" },
  rowValue: { fontSize: 14, fontWeight: "700", color: "#222" },
  meta: { fontSize: 11.5, color: "#999", marginTop: 8, lineHeight: 16 },
});
