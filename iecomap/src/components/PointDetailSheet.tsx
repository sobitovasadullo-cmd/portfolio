import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EcoPoint, categoryInfo } from "../types";
import {
  LatLng,
  MODE_LABEL,
  OUTSIDE_MARDIN_M,
  RouteResult,
  TravelMode,
  distanceMeters,
  estimateMinutes,
  formatDistance,
  formatMinutes,
  isOutsideMardin,
  shareLocation,
} from "../navigation";

interface Props {
  point: EcoPoint;
  onClose: () => void;
  /** Kullanıcının etkin konumu (gerçek veya simülasyon) — mesafe/süre hesabı için */
  userLocation?: LatLng | null;
  /** true ise userLocation, demo için ayarlanmış test konumudur */
  simulatedLocation: boolean;
  onUseTestLocation: () => void;
  onUseRealLocation: () => void;
  /** Aktif rota önizlemesi (harita üzerinde çizilir) */
  route?: RouteResult | null;
  routeLoading?: boolean;
  mode: TravelMode;
  onModeChange: (mode: TravelMode) => void;
  onShowRoute: () => void;
  onStartNavigation: () => void;
}

const MODES: TravelMode[] = ["driving", "walking", "bicycling"];

export default function PointDetailSheet({
  point,
  onClose,
  userLocation,
  simulatedLocation,
  onUseTestLocation,
  onUseRealLocation,
  route,
  routeLoading,
  mode,
  onModeChange,
  onShowRoute,
  onStartNavigation,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const info = categoryInfo(point.category);
  const straight = userLocation ? distanceMeters(userLocation, point) : null;
  const meters = route ? route.distanceM : straight;
  const minutes = route ? route.durationMin : straight != null ? estimateMinutes(straight, mode) : null;
  const date = new Date(point.createdAt);
  // Absürt mesafeleri (ör. 1075 km) bağlamsız göstermemek için.
  const outside =
    !!userLocation && (isOutsideMardin(userLocation) || (meters != null && meters > OUTSIDE_MARDIN_M));

  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8, maxHeight: height * 0.66 }]}>
      <View style={styles.handle} />
      <View style={styles.headerRow}>
        <Text style={styles.emoji}>{info.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{point.title}</Text>
          <Text style={[styles.badge, { color: info.color }]}>{info.fullLabel}</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {point.photoUri ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: point.photoUri }} style={styles.photo} />
            <View style={styles.locationBadge}>
              <Text style={styles.locationBadgeText}>
                📍 {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
              </Text>
            </View>
          </View>
        ) : null}

        {point.description ? <Text style={styles.description}>{point.description}</Text> : null}

        {point.address ? <Text style={styles.info}>📍 {point.address}</Text> : null}
        {point.phone ? <Text style={styles.info}>📞 {point.phone}</Text> : null}
        {point.hours ? <Text style={styles.info}>🕒 {point.hours}</Text> : null}

        {simulatedLocation ? (
          <View style={styles.simBox}>
            <Text style={styles.simText}>🧪 Simülasyon modu — test konumu: Artuklu merkez</Text>
            <TouchableOpacity onPress={onUseRealLocation} hitSlop={8}>
              <Text style={styles.simLink}>Gerçek konuma dön</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {outside && !simulatedLocation ? (
          <View style={styles.outsideBox}>
            <Text style={styles.outsideTitle}>📍 Mardin dışındasınız</Text>
            <Text style={styles.outsideBody}>
              Mesafe ve rota yalnızca Mardin içinden hesaplanır. Sunum/deneme için Mardin'de bir test
              konumu kullanabilirsiniz.
            </Text>
            <TouchableOpacity style={styles.testBtn} onPress={onUseTestLocation} activeOpacity={0.85}>
              <Text style={styles.testBtnText}>📍 Mardin'de test konumu kullan</Text>
            </TouchableOpacity>
          </View>
        ) : meters != null && minutes != null ? (
          <Text style={styles.distance}>
            🧭 {formatDistance(meters)} · {formatMinutes(minutes)}
            {!route || !route.real ? " (tahmini)" : ""}
          </Text>
        ) : (
          <Text style={styles.meta}>Mesafe için konum iznini açın (📍 düğmesi).</Text>
        )}

        {route && !route.real && route.error ? <Text style={styles.routeError}>⚠️ {route.error}</Text> : null}

        <View style={styles.modeRow}>
          {MODES.map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => onModeChange(m)}
              style={[styles.modeChip, mode === m && styles.modeChipActive]}
            >
              <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>{MODE_LABEL[m]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.meta}>
          {point.source ? `Kaynak: ${point.source} · ` : ""}
          {date.toLocaleDateString("tr-TR")} ·{" "}
          {point.isUserReport
            ? `Kullanıcı bildirimi${point.reporterName ? " · " + point.reporterName : ""}`
            : "Kayıtlı nokta"}
        </Text>
      </ScrollView>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: "#00897B" }]}
          onPress={onShowRoute}
          disabled={routeLoading}
          activeOpacity={0.85}
        >
          {routeLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.actionButtonText} numberOfLines={1} adjustsFontSizeToFit>
              🗺️ Rotayı Göster
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: "#1E88E5" }]}
          onPress={onStartNavigation}
          disabled={routeLoading}
          activeOpacity={0.85}
        >
          <Text style={styles.actionButtonText} numberOfLines={1} adjustsFontSizeToFit>
            🧭 Başlat
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.shareButton]}
          onPress={() => shareLocation(point.latitude, point.longitude, point.title)}
          activeOpacity={0.85}
        >
          <Text style={styles.actionButtonText} numberOfLines={1} adjustsFontSizeToFit>
            📤 Paylaş
          </Text>
        </TouchableOpacity>
      </View>
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
  scroll: { flexGrow: 0 },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ddd",
    alignSelf: "center",
    marginBottom: 12,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start" },
  emoji: { fontSize: 28, marginRight: 10 },
  title: { fontSize: 17, fontWeight: "700", color: "#1a1a1a" },
  badge: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontSize: 14, color: "#666" },
  photoWrap: { marginTop: 12 },
  photo: { width: "100%", height: 160, borderRadius: 12 },
  locationBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  locationBadgeText: { color: "white", fontSize: 11, fontWeight: "600" },
  description: { fontSize: 14, color: "#444", marginTop: 12, lineHeight: 20 },
  meta: { fontSize: 12, color: "#999", marginTop: 12 },
  info: { fontSize: 13, color: "#333", marginTop: 6 },
  distance: { fontSize: 14, fontWeight: "700", color: "#1E88E5", marginTop: 10 },
  routeError: { fontSize: 12, color: "#B26A00", marginTop: 6, fontWeight: "600" },
  outsideBox: { backgroundColor: "#FFF3E0", borderRadius: 12, padding: 12, marginTop: 12 },
  outsideTitle: { fontSize: 14, fontWeight: "800", color: "#7A4A00" },
  outsideBody: { fontSize: 12.5, color: "#7A4A00", marginTop: 4, lineHeight: 18 },
  testBtn: {
    backgroundColor: "#FB8C00",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  testBtnText: { color: "white", fontSize: 13.5, fontWeight: "800" },
  simBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF8E1",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 12,
    gap: 8,
  },
  simText: { flex: 1, fontSize: 12, fontWeight: "700", color: "#6D4C00" },
  simLink: { fontSize: 12, fontWeight: "700", color: "#1E88E5" },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  modeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: "#f0f0f0" },
  modeChipActive: { backgroundColor: "#1E88E5" },
  modeText: { fontSize: 12, fontWeight: "600", color: "#333" },
  modeTextActive: { color: "white" },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  shareButton: { backgroundColor: "#43A047", flex: 0.8 },
  actionButtonText: { color: "white", fontSize: 13.5, fontWeight: "700" },
});
