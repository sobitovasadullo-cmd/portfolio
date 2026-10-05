import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  MODE_LABEL,
  RouteResult,
  capitalizeTr,
  formatClock,
  formatDistance,
  formatMinutes,
  instructionFor,
  spokenInstruction,
} from "../navigation";
import { GpsQuality, NavProgress, SIM_SPEED_MULTIPLIER } from "../hooks/useTurnByTurn";

interface Props {
  route: RouteResult;
  progress: NavProgress | null;
  arrived: boolean;
  simulated: boolean;
  rerouting: boolean;
  error: string | null;
  destinationTitle: string;
  gps: { quality: GpsQuality; accuracy: number | null };
  following: boolean;
  onRecenter: () => void;
  onToggleSimulation: (sim: boolean) => void;
  onStop: () => void;
}

const GPS_CHIP: Record<GpsQuality, { label: string; bg: string; fg: string }> = {
  searching: { label: "GPS: aranıyor…", bg: "#ECEFF1", fg: "#455A64" },
  good: { label: "GPS: iyi", bg: "#E8F5E9", fg: "#2E7D32" },
  weak: { label: "GPS: zayıf", bg: "#FFF3E0", fg: "#E65100" },
  simulated: { label: "GPS: simülasyon", bg: "#FFF8E1", fg: "#6D4C00" },
};

/** Top maneuver banner + bottom summary panel shown while navigating. */
export default function NavigationOverlay({
  route,
  progress,
  arrived,
  simulated,
  rerouting,
  error,
  destinationTitle,
  gps,
  following,
  onRecenter,
  onToggleSimulation,
  onStop,
}: Props) {
  const insets = useSafeAreaInsets();
  const [panelHeight, setPanelHeight] = useState(150);

  let icon = "⬆️";
  let main = simulated ? "Rota hazırlanıyor…" : "Konumunuz bekleniyor…";
  let road = "";
  if (arrived) {
    icon = "🏁";
    main = "Hedefe ulaştınız 🎉";
    road = destinationTitle;
  } else if (rerouting) {
    icon = "🔄";
    main = "Rota yeniden hesaplanıyor…";
  } else if (progress) {
    const step = progress.nextStepIdx >= 0 ? route.steps[progress.nextStepIdx] : undefined;
    if (step) {
      const ins = instructionFor(step);
      icon = ins.icon;
      main = spokenInstruction(ins, progress.distToNextM);
      road = ins.road;
    } else {
      // Straight-line fallback: no maneuvers, just head towards the destination.
      icon = "🧭";
      main = `${formatDistance(progress.remainingM)} — hedefe doğru ilerleyin (tahmini)`;
      road = destinationTitle;
    }
  }

  const remainingM = progress?.remainingM ?? route.distanceM;
  const remainingS = progress?.remainingS ?? route.durationS;
  const eta = new Date(Date.now() + remainingS * 1000);
  const chip = GPS_CHIP[gps.quality];

  return (
    <>
      <View style={[styles.banner, { paddingTop: insets.top + 10 }, arrived && styles.bannerArrived]}>
        <View style={styles.bannerRow}>
          <View style={styles.iconBox}>
            {rerouting ? <ActivityIndicator color="white" /> : <Text style={styles.icon}>{icon}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mainText} numberOfLines={2}>
              {capitalizeTr(main)}
            </Text>
            {road ? (
              <Text style={styles.roadText} numberOfLines={1}>
                {road}
              </Text>
            ) : null}
          </View>
        </View>
        {!route.real ? <Text style={styles.warnText}>⚠️ Tahmini rota (kuş uçuşu çizgi)</Text> : null}
        {error && !arrived ? <Text style={styles.warnText}>{error}</Text> : null}
      </View>

      <View style={[styles.floatingRow, { bottom: panelHeight + 10 }]} pointerEvents="box-none">
        <View style={[styles.gpsChip, { backgroundColor: chip.bg }]}>
          <Text style={[styles.gpsChipText, { color: chip.fg }]}>
            {chip.label}
            {gps.accuracy != null && !simulated ? ` (±${Math.round(gps.accuracy)} m)` : ""}
          </Text>
        </View>
        {!following && !arrived ? (
          <TouchableOpacity style={styles.recenterBtn} onPress={onRecenter} activeOpacity={0.85}>
            <Text style={styles.recenterText}>📍 Takip et</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View
        style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
        onLayout={(e) => setPanelHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.panelTop}>
          <View style={{ flex: 1 }}>
            {arrived ? (
              <Text style={styles.panelBig}>Varış noktası</Text>
            ) : (
              <Text style={styles.panelBig}>
                {formatMinutes(remainingS / 60)} · {formatDistance(remainingM)}
              </Text>
            )}
            <Text style={styles.panelSub} numberOfLines={1}>
              {arrived ? destinationTitle : `Varış ${formatClock(eta)} · ${MODE_LABEL[route.mode]}`}
            </Text>
          </View>
          <TouchableOpacity style={styles.stopBtn} onPress={onStop} activeOpacity={0.85}>
            <Text style={styles.stopText}>Bitir</Text>
          </TouchableOpacity>
        </View>
        {!arrived ? (
          <View style={styles.simRow}>
            <Text style={styles.simLabel} numberOfLines={1}>
              Simülasyon modu{simulated ? ` · ${SIM_SPEED_MULTIPLIER}× hız` : ""}
            </Text>
            <Switch
              value={simulated}
              onValueChange={onToggleSimulation}
              trackColor={{ true: "#FFB300", false: "#CFD8DC" }}
              accessibilityLabel="Simülasyon modu"
            />
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    backgroundColor: "#1B5E20",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 10,
  },
  bannerArrived: { backgroundColor: "#2E7D32" },
  bannerRow: { flexDirection: "row", alignItems: "center" },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  icon: { fontSize: 30 },
  mainText: { color: "white", fontSize: 19, fontWeight: "800", lineHeight: 24 },
  roadText: { color: "#C8E6C9", fontSize: 14, fontWeight: "600", marginTop: 2 },
  warnText: { color: "#FFE082", fontSize: 12, fontWeight: "600", marginTop: 6 },
  floatingRow: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 41,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gpsChip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  gpsChipText: { fontSize: 12, fontWeight: "800" },
  recenterBtn: {
    backgroundColor: "#1E88E5",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  recenterText: { color: "white", fontSize: 14, fontWeight: "800" },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 12,
  },
  panelTop: { flexDirection: "row", alignItems: "center" },
  panelBig: { fontSize: 20, fontWeight: "800", color: "#1B5E20" },
  panelSub: { fontSize: 13, color: "#666", marginTop: 2, fontWeight: "600" },
  stopBtn: {
    backgroundColor: "#E53935",
    borderRadius: 14,
    paddingHorizontal: 26,
    paddingVertical: 14,
    marginLeft: 12,
  },
  stopText: { color: "white", fontSize: 16, fontWeight: "800" },
  simRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5e5",
  },
  simLabel: { fontSize: 12.5, color: "#888", fontWeight: "600", flex: 1 },
});
