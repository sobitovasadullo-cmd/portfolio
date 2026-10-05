import React, { useCallback, useState } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import { router, useFocusEffect } from "expo-router";
import ReportScreen from "../screens/ReportScreen";
import { EcoPoint, UserSession } from "../types";
import { loadSession } from "../auth";
import { isNetworkError, submitReport } from "../api/reports";
import { enqueueReport } from "../api/pendingReports";

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
    // Anonim bildirimde ad ve e-posta hiçbir şekilde gönderilmez/saklanmaz.
    const toSend: EcoPoint = { ...point, reporterName: point.anonymous ? undefined : point.reporterName };
    const email = point.anonymous ? undefined : session?.email;
    try {
      const res = await submitReport(toSend, toSend.photoUri, email);
      Alert.alert("Bildiriminiz alındı ✅", `Takip no: ${res.id.slice(0, 8)}`, [
        { text: "Tamam", onPress: () => router.back() },
      ]);
    } catch (e) {
      if (isNetworkError(e)) {
        try {
          await enqueueReport(toSend, email);
          Alert.alert(
            "Çevrimdışı kaydedildi",
            "İnternet yok, bildiriminiz kaydedildi, bağlantı gelince gönderilecek.",
            [{ text: "Tamam", onPress: () => router.back() }]
          );
        } catch (qe) {
          Alert.alert(
            "Bildirim kaydedilemedi",
            `Bildirim ne gönderilebildi ne de telefona kaydedilebildi. Lütfen tekrar deneyin.\n\nDetay: ${
              qe instanceof Error ? qe.message : String(qe)
            }`
          );
        }
        return;
      }
      Alert.alert(
        "Bildirim gönderilemedi",
        `${e instanceof Error ? e.message : String(e)}\n\nLütfen bilgileri kontrol edip tekrar deneyin.`
      );
    }
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
