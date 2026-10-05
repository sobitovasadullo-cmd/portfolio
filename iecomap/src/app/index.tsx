import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import MapView, { Circle, Marker, Polyline, Region } from "react-native-maps";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CATEGORIES, EcoPoint, PointCategory, categoryInfo } from "../types";
import { SEED_POINTS } from "../data/seedPoints";
import { City, findCity } from "../data/cities";
import { loadUserReports } from "../storage";
import { fetchReports } from "../api/reports";
import { flushPendingReports, loadPendingPoints } from "../api/pendingReports";
import { loadSession } from "../auth";
import {
  LatLng,
  MARDIN_CENTER,
  RouteResult,
  TravelMode,
  fetchRoute,
  isOutsideMardin,
} from "../navigation";
import { fetchWeather, WeatherData } from "../weather";
import { DistrictAirQuality, fetchMardinAirQuality } from "../airQuality";
import { useTurnByTurn } from "../hooks/useTurnByTurn";
import CategoryMenu from "../components/CategoryMenu";
import CityPicker from "../components/CityPicker";
import WeatherPanel from "../components/WeatherPanel";
import PointDetailSheet from "../components/PointDetailSheet";
import NavigationOverlay from "../components/NavigationOverlay";
import AirQualitySheet from "../components/AirQualitySheet";
import AirQualityLegend from "../components/AirQualityLegend";

const DEFAULT_CITY: City = findCity("Artuklu")!;
/** Demo/test location used when the device is outside Mardin (Artuklu center). */
const TEST_LOCATION: LatLng = MARDIN_CENTER;
const AQ_RADIUS_M = 5000;

function regionFor(city: City, delta = 0.05): Region {
  return {
    latitude: city.latitude,
    longitude: city.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const nav = useTurnByTurn(mapRef);

  /** Eski sürümde yalnızca bu telefona kaydedilmiş bildirimler (sunucuya gönderilmez). */
  const [userReports, setUserReports] = useState<EcoPoint[]>([]);
  /** Sunucudaki (tüm telefonlardan gelen) bildirimler. */
  const [remoteReports, setRemoteReports] = useState<EcoPoint[]>([]);
  /** Çevrimdışı kuyruktaki, henüz gönderilemeyen bildirimler. */
  const [pendingReports, setPendingReports] = useState<EcoPoint[]>([]);
  const [showReports, setShowReports] = useState(true);
  const reportsFailingRef = useRef(false);
  const [activeCategories, setActiveCategories] = useState<Set<PointCategory>>(
    new Set(CATEGORIES.filter((c) => !c.reportOnly).map((c) => c.key))
  );
  const [selectedPoint, setSelectedPoint] = useState<EcoPoint | null>(null);
  const [selectedCity, setSelectedCity] = useState<City>(DEFAULT_CITY);

  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [simulatedLocation, setSimulatedLocation] = useState<LatLng | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>("driving");
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [topBarHeight, setTopBarHeight] = useState(120);

  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [weatherVisible, setWeatherVisible] = useState(false);
  const [weatherSummary, setWeatherSummary] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const [aqOn, setAqOn] = useState(false);
  const [aqData, setAqData] = useState<DistrictAirQuality[]>([]);
  const [aqLoading, setAqLoading] = useState(false);
  const [aqError, setAqError] = useState<string | null>(null);
  const [aqFailed, setAqFailed] = useState(0);
  const [aqSelected, setAqSelected] = useState<DistrictAirQuality | null>(null);

  const effectiveLocation = simulatedLocation ?? userLocation;

  function showNotice(msg: string, ms = 4500) {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(msg);
    noticeTimer.current = setTimeout(() => setNotice(null), ms);
  }

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  // Seçili ilçe değiştikçe ana ekrandaki hava durumu rozetini tazele (10 dk önbellekli).
  useEffect(() => {
    let cancelled = false;
    setWeatherLoading(true);
    fetchWeather(selectedCity.latitude, selectedCity.longitude)
      .then((data) => {
        if (!cancelled) setWeatherSummary(data);
      })
      .catch(() => {
        if (!cancelled) setWeatherSummary(null);
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCity]);

  // Ekran odaktayken: bekleyen bildirimleri göndermeyi dene, sunucudaki bildirimleri
  // çek ve ~30 sn'de bir tazele. Sunucuya ulaşılamazsa son bilinen veriler kalır.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function refresh() {
        try {
          const sent = await flushPendingReports();
          const [pending, legacy] = await Promise.all([loadPendingPoints(), loadUserReports()]);
          if (cancelled) return;
          setPendingReports(pending);
          setUserReports(legacy);
          if (sent > 0) showNotice(`${sent} bekleyen bildirim gönderildi ✅`, 3500);
        } catch (e) {
          console.warn("Yerel bildirimler okunamadı:", e);
        }
        try {
          const remote = await fetchReports();
          if (cancelled) return;
          setRemoteReports(remote);
          reportsFailingRef.current = false;
        } catch (e) {
          if (cancelled) return;
          // Hata mesajını her 30 sn'de bir değil, yalnızca ilk başarısızlıkta göster.
          if (!reportsFailingRef.current) {
            const msg = e instanceof Error ? e.message : "Bildirimler yüklenemedi.";
            showNotice(`${msg} Son bilinen veriler gösteriliyor.`, 5000);
          }
          reportsFailingRef.current = true;
        }
      }

      refresh();
      const id = setInterval(refresh, 30_000);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }, [])
  );

  const points = useMemo(() => {
    // Aynı id birden fazla kaynakta olabilir (ör. kuyruktan yeni gönderilmiş); sunucudaki kazanır.
    const seen = new Set<string>();
    const out: EcoPoint[] = [];
    for (const p of [...remoteReports, ...pendingReports, ...userReports, ...SEED_POINTS]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
    return out;
  }, [remoteReports, pendingReports, userReports]);

  const reportCount = useMemo(
    () => points.filter((p) => p.isUserReport && categoryInfo(p.category).reportOnly).length,
    [points]
  );

  const filteredPoints = useMemo(
    // Bildirim-only kategoriler (elektrik arızası, çevre sorunu, diğer) ayrı bir
    // "Bildirimler" anahtarıyla gösterilir (varsayılan: açık).
    () =>
      points.filter((p) =>
        p.isUserReport && categoryInfo(p.category).reportOnly ? showReports : activeCategories.has(p.category)
      ),
    [points, activeCategories, showReports]
  );

  function fitToPoints(pts: EcoPoint[]) {
    if (pts.length === 0 || !mapRef.current) return;
    mapRef.current.fitToCoordinates(
      pts.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
      {
        edgePadding: { top: topBarHeight + 40, right: 60, bottom: 220, left: 60 },
        animated: true,
      }
    );
  }

  function toggleCategory(key: PointCategory) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      // Kategori açıldıysa haritayı o kategorideki noktalara yakınlaştır
      const willBeActive = !prev.has(key);
      if (willBeActive) {
        const pts = points.filter((p) => p.category === key);
        if (pts.length === 0) {
          const label = categoryInfo(key).label;
          showNotice(
            `${label} katmanında Mardin için doğrulanmış kayıt henüz yok. Topluluk bildirimleriyle eklenecek.`
          );
        } else {
          setNotice(null);
          setTimeout(() => fitToPoints(pts), 50);
        }
      }
      return next;
    });
  }

  function handleSelectCity(city: City) {
    setSelectedCity(city);
    setCityPickerVisible(false);
    mapRef.current?.animateToRegion(regionFor(city), 600);
  }

  async function handleUseMyLocation() {
    const target = simulatedLocation ?? (await getUserLocation(true));
    if (!target) {
      showNotice("Konum alınamadı. Konum iznini kontrol edin.", 3500);
      return;
    }
    mapRef.current?.animateToRegion({ ...target, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600);
  }

  async function getUserLocation(forceRefresh = false): Promise<LatLng | null> {
    if (userLocation && !forceRefresh) return userLocation;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    try {
      const loc = await Location.getCurrentPositionAsync({});
      const here = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(here);
      return here;
    } catch {
      return null;
    }
  }

  /** Returns the origin for routing, or null (with a notice) if unusable. */
  async function routeOrigin(): Promise<LatLng | null> {
    if (simulatedLocation) return simulatedLocation;
    const from = await getUserLocation();
    if (!from) {
      showNotice("Rota için konum izni gerekli.", 3500);
      return null;
    }
    if (isOutsideMardin(from)) {
      showNotice("Mardin dışındasınız. Rota için \"📍 Mardin'de test konumu kullan\" düğmesine dokunun.");
      return null;
    }
    return from;
  }

  async function loadRoute(mode: TravelMode, fit: boolean): Promise<RouteResult | null> {
    if (!selectedPoint) return null;
    setRouteLoading(true);
    try {
      const from = await routeOrigin();
      if (!from) return null;
      const r = await fetchRoute(from, selectedPoint, mode);
      setRoute(r);
      if (r.error) showNotice(r.error, 6000);
      if (fit) {
        mapRef.current?.fitToCoordinates(r.coords, {
          edgePadding: { top: topBarHeight + 40, right: 60, bottom: 420, left: 60 },
          animated: true,
        });
      }
      return r;
    } finally {
      setRouteLoading(false);
    }
  }

  function handleModeChange(mode: TravelMode) {
    setTravelMode(mode);
    // Rota gösteriliyorsa yeni ulaşım türüyle yeniden hesapla.
    if (route) loadRoute(mode, true);
  }

  async function handleStartNavigation() {
    if (!selectedPoint) return;
    const r = route && route.mode === travelMode ? route : await loadRoute(travelMode, false);
    if (!r) return;
    nav.start({ route: r, destination: selectedPoint, simulated: !!simulatedLocation });
  }

  function handleStopNavigation() {
    nav.stop();
    setRoute(null);
    const center = simulatedLocation ?? userLocation ?? selectedPoint;
    mapRef.current?.animateCamera(
      { heading: 0, pitch: 0, ...(center ? { center } : {}), zoom: 14, altitude: 6000 },
      { duration: 700 }
    );
  }

  function handleUseTestLocation() {
    setSimulatedLocation(TEST_LOCATION);
    setRoute(null);
    mapRef.current?.animateToRegion({ ...TEST_LOCATION, latitudeDelta: 0.06, longitudeDelta: 0.06 }, 600);
  }

  function handleUseRealLocation() {
    setSimulatedLocation(null);
    setRoute(null);
  }

  function closeSheet() {
    setSelectedPoint(null);
    setRoute(null);
  }

  async function handleReportPress() {
    const session = await loadSession();
    if (!session) {
      router.push("/login");
      return;
    }
    router.push("/report");
  }

  const loadAirQuality = useCallback(() => {
    setAqLoading(true);
    setAqError(null);
    fetchMardinAirQuality()
      .then(({ data, failed }) => {
        setAqData(data);
        setAqFailed(failed);
      })
      .catch((e) => setAqError(e instanceof Error ? e.message : "Hava kalitesi verisi alınamadı."))
      .finally(() => setAqLoading(false));
  }, []);

  function toggleAirQuality() {
    if (aqOn) {
      setAqOn(false);
      setAqSelected(null);
      return;
    }
    // Katman, nokta detay kartıyla çakışmasın.
    closeSheet();
    setAqOn(true);
    loadAirQuality();
    mapRef.current?.animateToRegion(
      { latitude: 37.25, longitude: 40.95, latitudeDelta: 0.75, longitudeDelta: 0.75 },
      600
    );
  }

  const displayRoute = nav.active ? nav.route : route;
  const sheetOpen = !!selectedPoint || !!aqSelected;
  const showFloatingButtons = !sheetOpen && !nav.active;
  const weatherCurrent = weatherSummary?.current;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={regionFor(DEFAULT_CITY)}
        showsUserLocation={!simulatedLocation}
        showsMyLocationButton={false}
        showsCompass={!nav.active}
      >
        {!aqOn &&
          filteredPoints.map((point) => {
            const info = categoryInfo(point.category);
            return (
              <Marker
                key={point.id}
                coordinate={{ latitude: point.latitude, longitude: point.longitude }}
                onPress={() => {
                  if (nav.active) return;
                  setRoute(null);
                  setSelectedPoint(point);
                  getUserLocation();
                }}
              >
                <View style={[styles.markerBubble, { borderColor: info.color }]}>
                  <Text style={styles.markerEmoji}>{info.emoji}</Text>
                </View>
              </Marker>
            );
          })}

        {aqOn &&
          aqData.map((d) =>
            d.band ? (
              <Circle
                key={`aqc-${d.name}`}
                center={{ latitude: d.city.latitude, longitude: d.city.longitude }}
                radius={AQ_RADIUS_M}
                fillColor={`${d.band.color}55`}
                strokeColor={d.band.color}
                strokeWidth={2}
              />
            ) : null
          )}
        {aqOn &&
          aqData.map((d) => (
            <Marker
              key={`aqm-${d.name}`}
              coordinate={{ latitude: d.city.latitude, longitude: d.city.longitude }}
              onPress={() => setAqSelected(d)}
            >
              <View style={[styles.aqMarker, { borderColor: d.band?.color ?? "#999" }]}>
                <Text style={[styles.aqMarkerValue, { color: d.band?.color ?? "#666" }]}>{d.aqi ?? "–"}</Text>
                <Text style={styles.aqMarkerName}>{d.name}</Text>
                <Text style={styles.aqMarkerLevel} numberOfLines={1}>
                  {d.band?.label ?? "Veri yok"}
                </Text>
              </View>
            </Marker>
          ))}

        {displayRoute && (
          <Polyline
            coordinates={displayRoute.coords}
            strokeColor={displayRoute.real ? "#1E88E5" : "#FB8C00"}
            strokeWidth={6}
            lineDashPattern={displayRoute.real ? undefined : [12, 10]}
          />
        )}
        {displayRoute && !displayRoute.real && displayRoute.coords.length === 2 && (
          <Marker
            coordinate={{
              latitude: (displayRoute.coords[0].latitude + displayRoute.coords[1].latitude) / 2,
              longitude: (displayRoute.coords[0].longitude + displayRoute.coords[1].longitude) / 2,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.estimateLabel}>
              <Text style={styles.estimateText}>tahmini</Text>
            </View>
          </Marker>
        )}

        {nav.active && nav.progress ? (
          <Marker coordinate={nav.progress.position} anchor={{ x: 0.5, y: 0.5 }} flat zIndex={999}>
            <View style={[styles.navUser, nav.simulated && styles.navUserSim]}>
              <Text style={styles.navUserArrow}>▲</Text>
            </View>
          </Marker>
        ) : simulatedLocation ? (
          <Marker coordinate={simulatedLocation} anchor={{ x: 0.5, y: 0.5 }} zIndex={998}>
            <View style={[styles.navUser, styles.navUserSim]}>
              <Text style={styles.navUserArrow}>●</Text>
            </View>
          </Marker>
        ) : null}
      </MapView>

      {notice && (
        <View style={[styles.notice, { top: (nav.active ? insets.top + 140 : topBarHeight) + 8 }]} pointerEvents="none">
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}

      {!nav.active && (
        <View
          style={[styles.topBar, { paddingTop: insets.top + 8 }]}
          pointerEvents="box-none"
          onLayout={(e) => setTopBarHeight(e.nativeEvent.layout.height)}
        >
          <View style={styles.titleRow}>
            <Text style={styles.appTitle}>EcoMap</Text>
            <TouchableOpacity style={styles.cityButton} onPress={() => setCityPickerVisible(true)}>
              <Text style={styles.appSubtitle} numberOfLines={1}>
                {selectedCity.name}
              </Text>
              <Text style={styles.cityChevron}>▾</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.menuButton} onPress={() => setCategoryMenuVisible(true)}>
              <Text style={styles.menuButtonText}>☰ Kategoriler</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pillRow}>
            <TouchableOpacity style={styles.weatherPill} onPress={() => setWeatherVisible(true)} activeOpacity={0.85}>
              <Text style={styles.weatherPillEmoji}>{weatherCurrent?.emoji ?? "🌡️"}</Text>
              <Text style={styles.weatherPillText} numberOfLines={1}>
                {weatherLoading && !weatherCurrent
                  ? "Yükleniyor…"
                  : weatherCurrent
                    ? `${weatherCurrent.temperature}°C · ${weatherCurrent.label}`
                    : "Hava durumu"}
              </Text>
              <Text style={styles.chevronSmall}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.aqPill, aqOn && styles.aqPillActive]}
              onPress={toggleAirQuality}
              activeOpacity={0.85}
            >
              <Text style={[styles.aqPillText, aqOn && styles.aqPillTextActive]} numberOfLines={1}>
                🌫️ Hava Kalitesi
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sosPill} onPress={() => router.push("/emergency")} activeOpacity={0.85}>
              <Text style={styles.sosPillText}>🚨 Acil</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {aqOn && !nav.active && (
        <View style={[styles.legendWrap, { top: topBarHeight + 8 }]}>
          <AirQualityLegend
            loading={aqLoading}
            error={aqError}
            partialFailure={aqFailed}
            onRetry={loadAirQuality}
            onClose={toggleAirQuality}
          />
        </View>
      )}

      {showFloatingButtons && (
        <>
          <TouchableOpacity
            style={[styles.locateBtn, { bottom: insets.bottom + 92 }]}
            onPress={handleUseMyLocation}
            accessibilityLabel="Konumuma git"
          >
            <Text style={styles.locateBtnText}>📍</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.fab, { bottom: insets.bottom + 20 }]}
            onPress={handleReportPress}
            activeOpacity={0.85}
          >
            <Text style={styles.fabText}>⚠️ Sorun Bildir</Text>
          </TouchableOpacity>
        </>
      )}

      {selectedPoint && !nav.active && !aqOn && (
        <PointDetailSheet
          point={selectedPoint}
          onClose={closeSheet}
          userLocation={effectiveLocation}
          simulatedLocation={!!simulatedLocation}
          onUseTestLocation={handleUseTestLocation}
          onUseRealLocation={handleUseRealLocation}
          route={route}
          routeLoading={routeLoading}
          mode={travelMode}
          onModeChange={handleModeChange}
          onShowRoute={() => loadRoute(travelMode, true)}
          onStartNavigation={handleStartNavigation}
        />
      )}

      {aqOn && aqSelected && <AirQualitySheet data={aqSelected} onClose={() => setAqSelected(null)} />}

      {nav.active && nav.route && (
        <NavigationOverlay
          route={nav.route}
          progress={nav.progress}
          arrived={nav.arrived}
          simulated={nav.simulated}
          rerouting={nav.rerouting}
          error={nav.error}
          destinationTitle={selectedPoint?.title ?? "Hedef"}
          onStop={handleStopNavigation}
        />
      )}

      <CategoryMenu
        visible={categoryMenuVisible}
        activeCategories={activeCategories}
        onToggle={toggleCategory}
        showReports={showReports}
        reportCount={reportCount}
        onToggleReports={() => setShowReports((v) => !v)}
        onClose={() => setCategoryMenuVisible(false)}
      />

      <CityPicker
        visible={cityPickerVisible}
        onClose={() => setCityPickerVisible(false)}
        onSelect={handleSelectCity}
      />

      <WeatherPanel
        visible={weatherVisible}
        onClose={() => setWeatherVisible(false)}
        cityName={selectedCity.name}
        latitude={selectedCity.latitude}
        longitude={selectedCity.longitude}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: "rgba(255,255,255,0.97)",
    paddingBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 6,
  },
  notice: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 50,
    backgroundColor: "rgba(26,26,26,0.92)",
    borderRadius: 12,
    padding: 12,
  },
  noticeText: { color: "white", fontSize: 13, fontWeight: "600" },
  pillRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 10, gap: 8 },
  weatherPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F8FF",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
    shadowColor: "#1E88E5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  weatherPillEmoji: { fontSize: 16, marginRight: 6 },
  weatherPillText: { flex: 1, fontSize: 12.5, fontWeight: "700", color: "#1a4d7a" },
  chevronSmall: { fontSize: 16, color: "#8fb8d9", marginLeft: 4 },
  aqPill: {
    backgroundColor: "#ECEFF1",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: "#CFD8DC",
  },
  aqPillActive: { backgroundColor: "#455A64", borderColor: "#455A64" },
  aqPillText: { fontSize: 12.5, fontWeight: "700", color: "#37474F" },
  aqPillTextActive: { color: "white" },
  sosPill: { backgroundColor: "#D32F2F", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 9 },
  sosPillText: { fontSize: 12.5, fontWeight: "800", color: "white" },
  legendWrap: { position: "absolute", left: 12, right: 12, zIndex: 15 },
  titleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  appTitle: { fontSize: 20, fontWeight: "800", color: "#1a1a1a", marginRight: 10 },
  cityButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 1,
  },
  appSubtitle: { fontSize: 13, color: "#333", fontWeight: "700", flexShrink: 1 },
  cityChevron: { fontSize: 12, color: "#666", marginLeft: 4 },
  menuButton: { backgroundColor: "#1a1a1a", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginLeft: 8 },
  menuButtonText: { color: "white", fontSize: 12, fontWeight: "700" },
  markerBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "white",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  markerEmoji: { fontSize: 16 },
  aqMarker: {
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 2.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 150,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  aqMarkerValue: { fontSize: 18, fontWeight: "900" },
  aqMarkerName: { fontSize: 11.5, fontWeight: "800", color: "#222" },
  aqMarkerLevel: { fontSize: 10, fontWeight: "600", color: "#555" },
  estimateLabel: { backgroundColor: "#FB8C00", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  estimateText: { color: "white", fontSize: 11, fontWeight: "800" },
  navUser: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#1E88E5",
    borderWidth: 3,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  navUserSim: { backgroundColor: "#FB8C00" },
  navUserArrow: { color: "white", fontSize: 12, fontWeight: "900", marginTop: -1 },
  // Bottom-right, well below the vertical middle of the right edge where the
  // Expo Go developer-tools button floats.
  locateBtn: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  locateBtnText: { fontSize: 20 },
  fab: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 10,
    backgroundColor: "#E53935",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  fabText: { color: "white", fontSize: 15, fontWeight: "700" },
});
