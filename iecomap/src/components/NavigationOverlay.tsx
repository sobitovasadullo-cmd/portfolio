import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
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
import { NavProgress, SIM_SPEED_MULTIPLIER } from "../hooks/useTurnByTurn";

interface Props {
  route: RouteResult;
  progress: NavProgress | null;
  arrived: boolean;
  simulated: boolean;
  rerouting: boolean;
  error: string | null;
  destinationTitle: string;
  onStop: () => void;
}

/** Top maneuver banner + bottom summary panel shown while navigating. */
export default function NavigationOverlay({
  route,
  progress,
  arrived,
  simulated,
  rerouting,
  error,
  destinationTitle,
  onStop,
}: Props) {
  const insets = useSafeAreaInsets();

  let icon = "⬆️";
  let main = "Rota hazırlanıyor…";
  let road = "";
  if (arrived) {
    icon = "🏁";
    main = "Hedefe ulaştınız 🎉";
    road = destinationTitle;
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

  return (
    <>
      <View style={[styles.banner, { paddingTop: insets.top + 10 }, arrived && styles.bannerArrived]}>
        <View style={styles.bannerRow}>
          <View style={styles.iconBox}>
            <Text style={styles.icon}>{icon}</Text>
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
        {simulated ? (
          <Text style={styles.simBadge}>
            🧪 Simülasyon modu · {SIM_SPEED_MULTIPLIER}× hız · gerçek konum kullanılmıyor
          </Text>
        ) : null}
        {!route.real ? <Text style={styles.warnText}>⚠️ Tahmini rota (kuş uçuşu çizgi)</Text> : null}
        {error && !arrived ? <Text style={styles.warnText}>{error}</Text> : null}
        {rerouting ? (
          <View style={styles.rerouteRow}>
            <ActivityIndicator color="white" size="small" />
            <Text style={styles.rerouteText}>Rotadan çıktınız, rota yeniden hesaplanıyor…</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
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
  simBadge: {
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: "#FFB300",
    color: "#3E2723",
    fontSize: 11.5,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  warnText: { color: "#FFE082", fontSize: 12, fontWeight: "600", marginTop: 6 },
  rerouteRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  rerouteText: { color: "white", fontSize: 12.5, fontWeight: "600" },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    flexDirection: "row",
    alignItems: "center",
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
});
