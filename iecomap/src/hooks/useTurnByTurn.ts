import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import type MapView from "react-native-maps";

import {
  LatLng,
  RouteResult,
  TravelMode,
  bearingDegrees,
  cumulativeDistances,
  distanceMeters,
  fetchRoute,
  pointAlong,
  projectOnPolyline,
  routeSpeedMps,
} from "../navigation";

// --- Tuning ----------------------------------------------------------------
/** Fixes less accurate than this are ignored (except the very first one). */
const MAX_ACCURACY_M = 40;
/** GPS accuracy at or below this counts as "iyi" in the status chip. */
const GOOD_ACCURACY_M = 20;
/** Displayed marker snaps onto the route when within this distance. */
const SNAP_M = 25;
/** Off-route when farther than this from the route … */
const OFF_ROUTE_M = 40;
/** … for this many consecutive fixes. */
const OFF_ROUTE_FIXES = 3;
/** Minimum time between two reroute requests. */
const REROUTE_COOLDOWN_MS = 10_000;
/** Within this distance of the destination → arrived. */
const ARRIVAL_M = 20;
/** Advance past a maneuver when this close to it (or once it's behind us). */
const STEP_ADVANCE_M: Record<TravelMode, number> = { walking: 15, bicycling: 30, driving: 30 };
const FOLLOW_ZOOM: Record<TravelMode, number> = { walking: 18, bicycling: 17.5, driving: 17 };
const FOLLOW_ALTITUDE: Record<TravelMode, number> = { walking: 250, bicycling: 350, driving: 450 };
const FOLLOW_PITCH = 45;
/** Above this speed (m/s) the GPS course is used for heading, below it the compass. */
const COURSE_MIN_SPEED = 1;
/** Low-pass filter factors (0 = frozen, 1 = no smoothing). */
const HEADING_ALPHA = 0.25;
const POSITION_ALPHA = 0.6;
/** A position jump larger than this resets the position filter. */
const POSITION_RESET_M = 30;

/** Demo simulation runs this many times faster than real time. */
export const SIM_SPEED_MULTIPLIER = 5;
const SIM_TICK_MS = 500;
const KEEP_AWAKE_TAG = "ecomap-navigation";

export type GpsQuality = "searching" | "good" | "weak" | "simulated";

export interface NavProgress {
  /** Position shown on the map (snapped to the route when close). */
  position: LatLng;
  heading: number;
  /** Distance travelled along the route polyline (m). */
  along: number;
  remainingM: number;
  remainingS: number;
  /** Index into route.steps of the upcoming maneuver, or -1 if none. */
  nextStepIdx: number;
  /** Distance along the route to the upcoming maneuver (m). */
  distToNextM: number;
}

interface Prepared {
  route: RouteResult;
  cum: number[];
  total: number;
  stepAlong: number[];
}

function prepare(route: RouteResult): Prepared {
  const cum = cumulativeDistances(route.coords);
  const stepAlong: number[] = [];
  let seg = 0;
  for (const s of route.steps) {
    const p = projectOnPolyline(s.location, route.coords, cum, seg);
    stepAlong.push(p.along);
    seg = p.segment;
  }
  return { route, cum, total: cum[cum.length - 1] ?? 0, stepAlong };
}

/** Signed smallest difference b − a in degrees (−180…180). */
function angleDiff(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

interface StartArgs {
  route: RouteResult;
  destination: LatLng;
  simulated: boolean;
}

export function useTurnByTurn(mapRef: RefObject<MapView | null>) {
  const [active, setActive] = useState(false);
  const [simulated, setSimulatedState] = useState(false);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [progress, setProgress] = useState<NavProgress | null>(null);
  const [arrived, setArrived] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowingState] = useState(true);
  const [gps, setGps] = useState<{ quality: GpsQuality; accuracy: number | null }>({
    quality: "searching",
    accuracy: null,
  });

  const prepRef = useRef<Prepared | null>(null);
  const destRef = useRef<LatLng | null>(null);
  const activeRef = useRef(false);
  const arrivedRef = useRef(false);
  const followingRef = useRef(true);
  // Tracking state
  const lastSegRef = useRef(0);
  const stepIdxRef = useRef(-1);
  const offRouteCountRef = useRef(0);
  const lastRerouteRef = useRef(0);
  const reroutingRef = useRef(false);
  const filteredPosRef = useRef<LatLng | null>(null);
  const headingRef = useRef<number | null>(null);
  const compassRef = useRef<number | null>(null);
  const hadFixRef = useRef(false);
  const simAlongRef = useRef(0);
  const progressRef = useRef<NavProgress | null>(null);

  const moveCamera = useCallback(
    (pos: LatLng, heading: number, force = false) => {
      if (!followingRef.current && !force) return;
      const mode = prepRef.current?.route.mode ?? "driving";
      mapRef.current?.animateCamera(
        {
          center: pos,
          heading,
          pitch: FOLLOW_PITCH,
          zoom: FOLLOW_ZOOM[mode],
          altitude: FOLLOW_ALTITUDE[mode],
        },
        { duration: 800 }
      );
    },
    [mapRef]
  );

  const applyRoute = useCallback((r: RouteResult) => {
    prepRef.current = prepare(r);
    lastSegRef.current = 0;
    stepIdxRef.current = -1;
    offRouteCountRef.current = 0;
    setRoute(r);
    setError(r.real ? null : r.error ?? null);
  }, []);

  const reroute = useCallback(
    async (from: LatLng) => {
      const dest = destRef.current;
      const prep = prepRef.current;
      if (!dest || !prep || reroutingRef.current) return;
      reroutingRef.current = true;
      lastRerouteRef.current = Date.now();
      setRerouting(true);
      try {
        const r = await fetchRoute(from, dest, prep.route.mode);
        if (!activeRef.current) return;
        // Keep a real route over a fallback if the network just dropped.
        if (r.real || !prep.route.real) applyRoute(r);
        else setError(r.error ?? null);
      } catch (e) {
        setError(`Rota yeniden hesaplanamadı: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        reroutingRef.current = false;
        setRerouting(false);
      }
    },
    [applyRoute]
  );

  /** Smoothed heading update; returns the new heading. */
  const smoothHeading = useCallback((target: number): number => {
    const prev = headingRef.current;
    const next = prev == null ? target : (prev + HEADING_ALPHA * angleDiff(prev, target) + 360) % 360;
    headingRef.current = next;
    return next;
  }, []);

  /**
   * Core update — fed by GPS (real mode) or by the simulation timer.
   * `rawHeading` is the GPS course / simulated bearing, or null to use the compass.
   */
  const update = useCallback(
    (pos: LatLng, rawHeading: number | null, fromSim: boolean) => {
      const prep = prepRef.current;
      const dest = destRef.current;
      if (!prep || !dest || arrivedRef.current || !activeRef.current) return;
      const { route: r, cum, total, stepAlong } = prep;

      // Projection, biased forward so we don't snap back onto an earlier part of the route.
      let proj = projectOnPolyline(pos, r.coords, cum, Math.max(0, lastSegRef.current - 2));
      if (proj.offset > OFF_ROUTE_M) {
        const full = projectOnPolyline(pos, r.coords, cum, 0);
        if (full.offset < proj.offset) proj = full;
      }
      lastSegRef.current = proj.segment;

      const onRoute = r.real && r.coords.length > 1 && proj.offset <= SNAP_M;
      const routePoint = r.coords.length > 1 ? pointAlong(r.coords, cum, proj.along) : null;
      const shown = onRoute && routePoint ? routePoint.point : pos;

      // Heading: GPS course when moving, else compass, else direction of the route.
      const target =
        rawHeading ?? compassRef.current ?? routePoint?.bearing ?? bearingDegrees(pos, dest);
      const heading = smoothHeading(target);

      const along = r.real ? proj.along : Math.max(0, total - distanceMeters(pos, dest));
      const remainingM = r.real ? Math.max(0, total - along) : distanceMeters(pos, dest);
      const remainingS = total > 0 ? (r.durationS * remainingM) / total : 0;

      // Step progression (monotonic): skip maneuvers we're close to or already past.
      const advanceM = STEP_ADVANCE_M[r.mode];
      let idx = Math.max(stepIdxRef.current, 0);
      while (idx < r.steps.length - 1) {
        const s = r.steps[idx];
        const passed = s.type === "depart" || stepAlong[idx] <= along;
        const close = distanceMeters(pos, s.location) <= advanceM;
        if (passed || close) idx++;
        else break;
      }
      stepIdxRef.current = r.steps.length ? idx : -1;
      const nextStepIdx = stepIdxRef.current;
      const distToNextM = nextStepIdx >= 0 ? Math.max(0, stepAlong[nextStepIdx] - along) : remainingM;

      const next = { position: shown, heading, along, remainingM, remainingS, nextStepIdx, distToNextM };
      progressRef.current = next;
      setProgress(next);
      moveCamera(shown, heading);

      if (distanceMeters(pos, dest) <= ARRIVAL_M) {
        arrivedRef.current = true;
        setArrived(true);
        return;
      }

      if (fromSim) return;
      if (r.real) {
        offRouteCountRef.current = proj.offset > OFF_ROUTE_M ? offRouteCountRef.current + 1 : 0;
        const cooled = Date.now() - lastRerouteRef.current > REROUTE_COOLDOWN_MS;
        if (offRouteCountRef.current >= OFF_ROUTE_FIXES && cooled) {
          offRouteCountRef.current = 0;
          reroute(pos);
        }
      } else if (Date.now() - lastRerouteRef.current > 30_000) {
        // A straight-line fallback is retried periodically in case the network came back.
        reroute(pos);
      }
    },
    [moveCamera, reroute, smoothHeading]
  );

  /** Handles a raw GPS fix: accuracy gate, light smoothing, GPS chip. */
  const onGpsFix = useCallback(
    (loc: Location.LocationObject) => {
      const acc = loc.coords.accuracy ?? null;
      setGps({ quality: acc != null && acc <= GOOD_ACCURACY_M ? "good" : "weak", accuracy: acc });
      if (hadFixRef.current && acc != null && acc > MAX_ACCURACY_M) return;
      hadFixRef.current = true;

      const raw = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      const prev = filteredPosRef.current;
      const pos =
        prev && distanceMeters(prev, raw) < POSITION_RESET_M
          ? {
              latitude: prev.latitude + POSITION_ALPHA * (raw.latitude - prev.latitude),
              longitude: prev.longitude + POSITION_ALPHA * (raw.longitude - prev.longitude),
            }
          : raw;
      filteredPosRef.current = pos;

      const speed = loc.coords.speed ?? 0;
      const course = loc.coords.heading;
      update(pos, speed > COURSE_MIN_SPEED && course != null && course >= 0 ? course : null, false);
    },
    [update]
  );

  const resetTracking = () => {
    lastSegRef.current = 0;
    stepIdxRef.current = -1;
    offRouteCountRef.current = 0;
    filteredPosRef.current = null;
    headingRef.current = null;
    compassRef.current = null;
    hadFixRef.current = false;
  };

  const start = useCallback(
    ({ route: r, destination, simulated: sim }: StartArgs) => {
      destRef.current = destination;
      arrivedRef.current = false;
      activeRef.current = true;
      followingRef.current = true;
      lastRerouteRef.current = Date.now();
      simAlongRef.current = 0;
      resetTracking();
      applyRoute(r);
      setArrived(false);
      progressRef.current = null;
      setProgress(null);
      setFollowingState(true);
      setGps({ quality: sim ? "simulated" : "searching", accuracy: null });
      setSimulatedState(sim);
      setActive(true);
    },
    [applyRoute]
  );

  const stop = useCallback(() => {
    activeRef.current = false;
    prepRef.current = null;
    destRef.current = null;
    setActive(false);
    setSimulatedState(false);
    setRoute(null);
    progressRef.current = null;
    setProgress(null);
    setArrived(false);
    setError(null);
  }, []);

  /** Switch between real GPS and the demo simulation while navigating. */
  const setSimulated = useCallback((sim: boolean) => {
    // Continue the simulation from the current progress along the route.
    simAlongRef.current = progressRef.current?.along ?? 0;
    resetTracking();
    offRouteCountRef.current = 0;
    lastRerouteRef.current = Date.now();
    setGps({ quality: sim ? "simulated" : "searching", accuracy: null });
    setSimulatedState(sim);
  }, []);

  const setFollowing = useCallback(
    (f: boolean) => {
      followingRef.current = f;
      setFollowingState(f);
      const p = progressRef.current;
      if (f && p) moveCamera(p.position, p.heading, true);
    },
    [moveCamera]
  );

  // Keep the screen awake while navigating.
  useEffect(() => {
    if (!active) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [active]);

  // Real GPS tracking (+ compass for heading when standing still / walking slowly).
  useEffect(() => {
    if (!active || simulated || arrived) return;
    const subs: Location.LocationSubscription[] = [];
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) {
          setError("Canlı takip için konum izni gerekli. Ayarlar'dan konum iznini açın.");
          return;
        }
        const pos = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
          onGpsFix,
          (reason) => setError(`Konum takibi hatası: ${reason}`)
        );
        if (cancelled) pos.remove();
        else subs.push(pos);
      } catch (e) {
        setError(`Konum takibi başlatılamadı: ${e instanceof Error ? e.message : String(e)}`);
      }
      try {
        const head = await Location.watchHeadingAsync((h) => {
          const v = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (v >= 0) compassRef.current = v;
        });
        if (cancelled) head.remove();
        else subs.push(head);
      } catch {
        // Compass unavailable: heading falls back to the route direction.
      }
    })();
    return () => {
      cancelled = true;
      subs.forEach((s) => s.remove());
    };
  }, [active, simulated, arrived, onGpsFix]);

  // Demo simulation: move along the route polyline at the route's average speed × multiplier.
  useEffect(() => {
    if (!active || !simulated || arrived) return;
    const tick = () => {
      const prep = prepRef.current;
      if (!prep || arrivedRef.current) return;
      const p = pointAlong(prep.route.coords, prep.cum, simAlongRef.current);
      update(p.point, p.bearing, true);
    };
    tick();
    const id = setInterval(() => {
      const prep = prepRef.current;
      if (!prep) return;
      const speed = routeSpeedMps(prep.route) * SIM_SPEED_MULTIPLIER;
      simAlongRef.current = Math.min(prep.total, simAlongRef.current + speed * (SIM_TICK_MS / 1000));
      tick();
    }, SIM_TICK_MS);
    return () => clearInterval(id);
  }, [active, simulated, arrived, update]);

  return {
    active,
    simulated,
    route,
    progress,
    arrived,
    rerouting,
    error,
    following,
    gps,
    start,
    stop,
    setSimulated,
    setFollowing,
  };
}
