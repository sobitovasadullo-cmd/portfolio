import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchWeather, WeatherData } from "../weather";

interface Props {
  visible: boolean;
  onClose: () => void;
  cityName: string;
  latitude: number;
  longitude: number;
}

export default function WeatherPanel({ visible, onClose, cityName, latitude, longitude }: Props) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWeather(latitude, longitude)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Veri alınamadı."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  useEffect(() => {
    if (!visible) return;
    setData(null);
    return load();
  }, [visible, load]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            Hava Durumu · {cityName}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={styles.closeText}>Kapat</Text>
          </TouchableOpacity>
        </View>

        {loading && !data && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Hava durumu yükleniyor…</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>Tekrar dene</Text>
            </TouchableOpacity>
          </View>
        )}

        {data && (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.tempCard}>
              <Text style={styles.tempEmoji}>{data.current.emoji}</Text>
              <Text style={styles.tempValue}>{data.current.temperature}°C</Text>
              <Text style={styles.tempLabel}>{data.current.label}</Text>
              <Text style={styles.feelsLike}>Hissedilen {data.current.apparentTemperature}°C</Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statEmoji}>💧</Text>
                <Text style={styles.statValue}>%{data.current.humidity}</Text>
                <Text style={styles.statLabel}>Nem</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statEmoji}>💨</Text>
                <Text style={styles.statValue}>{data.current.windSpeed} km/sa</Text>
                <Text style={styles.statLabel}>Rüzgâr</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>7 Günlük Tahmin</Text>
            <View style={styles.forecastCard}>
              {data.daily.map((d, i) => (
                <View key={d.date} style={[styles.dayRow, i > 0 && styles.dayRowBorder]}>
                  <Text style={styles.dayName}>{d.dayName}</Text>
                  <Text style={styles.dayEmoji}>{d.emoji}</Text>
                  <View style={styles.dayMid}>
                    <Text style={styles.dayLabel} numberOfLines={1}>
                      {d.label}
                    </Text>
                    <Text style={styles.dayPrecip}>
                      ☔ %{d.precipProbability ?? "–"}
                      {d.precipSum ? ` · ${d.precipSum.toLocaleString("tr-TR")} mm` : ""}
                    </Text>
                  </View>
                  <Text style={styles.dayTemps}>
                    <Text style={styles.dayMax}>{d.tempMax}°</Text>
                    <Text style={styles.dayMin}> / {d.tempMin}°</Text>
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.source}>
              Kaynak: Open-Meteo (model tahmini) · Hava kalitesi için ana ekrandaki "🌫️ Hava Kalitesi"
              düğmesini kullanın.
            </Text>
          </ScrollView>
        )}
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
    gap: 12,
  },
  title: { fontSize: 17, fontWeight: "800", flexShrink: 1 },
  closeText: { color: "#E53935", fontSize: 15, fontWeight: "600" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { color: "#888", marginTop: 10 },
  errorText: { color: "#666", fontSize: 14, textAlign: "center" },
  retryBtn: {
    marginTop: 14,
    backgroundColor: "#1E88E5",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: { color: "white", fontWeight: "700" },
  content: { padding: 20, paddingBottom: 40 },
  tempCard: {
    backgroundColor: "#1E88E5",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  tempEmoji: { fontSize: 40 },
  tempValue: { fontSize: 44, fontWeight: "800", color: "white" },
  tempLabel: { fontSize: 15, color: "white", marginTop: 4, fontWeight: "600" },
  feelsLike: { fontSize: 13, color: "#E3F2FD", marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: "#f6f6f6", borderRadius: 12, padding: 14, alignItems: "center" },
  statEmoji: { fontSize: 20, marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: "700", color: "#222" },
  statLabel: { fontSize: 12, color: "#888", marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#555", marginBottom: 8 },
  forecastCard: { backgroundColor: "#f6f6f6", borderRadius: 12, paddingHorizontal: 12 },
  dayRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  dayRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#ddd" },
  dayName: { width: 84, fontSize: 14, fontWeight: "700", color: "#222" },
  dayEmoji: { fontSize: 22, width: 34, textAlign: "center" },
  dayMid: { flex: 1, paddingHorizontal: 6 },
  dayLabel: { fontSize: 12.5, color: "#444", fontWeight: "600" },
  dayPrecip: { fontSize: 11.5, color: "#1E88E5", marginTop: 2 },
  dayTemps: { fontSize: 14 },
  dayMax: { fontWeight: "800", color: "#222" },
  dayMin: { color: "#888", fontWeight: "600" },
  source: { fontSize: 11, color: "#aaa", marginTop: 16, textAlign: "center", lineHeight: 16 },
});
