import React, { useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import ReportScreen from "../screens/ReportScreen";
import { EcoPoint, UserSession } from "../types";
import { saveUserReport } from "../storage";
import { loadSession } from "../auth";

export default function ReportRoute() {
  const [session, setSession] = useState<UserSession | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadSession().then((s) => {
        if (cancelled) return;
        setSession(s);
        if (!s) {
          router.replace("/login");
        }
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  async function handleSubmit(point: EcoPoint) {
    // Anonim bildirimde ad hiçbir şekilde saklanmaz.
    const toSave: EcoPoint = { ...point, reporterName: point.anonymous ? undefined : point.reporterName };
    await saveUserReport(toSave);
    router.back();
  }

  if (!session) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ReportScreen onCancel={() => router.back()} onSubmit={handleSubmit} defaultName={session.name} />
  );
}
