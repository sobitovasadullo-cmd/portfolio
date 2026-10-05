import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import type MapView from "react-native-maps";

import {
  LatLng,
  RouteResult,
  bearingDegrees,
  cumulativeDistances,
  distanceMeters,
  fetchRoute,
  pointAlong,
  projectOnPolyline,
  routeSpeedMps,
} from "../navigation";

/** User farther than this from the route polyline → recompute the route. */
const OFF_ROUTE_M = 50;
/** Within this distance of the destination → arrived. */
const ARRIVAL_M = 25;
/** Maneuver counts as passed once the user is this far beyond it along the route. */
const STEP_PASSED_M = 8;
/** Minimum time between two reroute requests. */
const REROUTE_COOLDOWN_MS = 10_000;
/** Demo simulation runs this many times faster than real time. */
export const SIM_SPEED_MULTIPLIER = 5;
const SIM_TICK_MS = 500;
const KEEP_AWAKE_TAG = "ecomap-navigation";

export interface NavProgress {
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

interface StartArgs {
  route: RouteResult;
  destination: LatLng;
  simulated: boolean;
}

export function useTurnByTurn(mapRef: RefObject<MapView | null>) {
  const [active, setActive] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [progress, setProgress] = useState<NavProgress | null>(null);
  const [arrived, setArrived] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prepRef = useRef<Prepared | null>(null);
  const destRef = useRef<LatLng | null>(null);
  const lastSegRef = useRef(0);
  const lastRerouteRef = useRef(0);
  const reroutingRef = useRef(false);
  const arrivedRef = useRef(false);
  const lastPosRef = useRef<LatLng | null>(null);
  const simAlongRef = useRef(0);
  const activeRef = useRef(false);

  const followCamera = useCallback(
    (pos: LatLng, heading: number) => {
      mapRef.current?.animateCamera(
        { center: pos, heading, pitch: 50, zoom: 17.5, altitude: 450 },
        { duration: 800 }
      );
    },
    [mapRef]
  );

  const applyRoute = useCallback((r: RouteResult) => {
    prepRef.current = prepare(r);
    lastSegRef.current = 0;
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
      } finally {
        reroutingRef.current = false;
        setRerouting(false);
      }
    },
    [applyRoute]
  );

  /** Core update — fed by GPS (real mode) or by the simulation timer. */
  const update = useCallback(
    (pos: LatLng, gpsHeading: number | null, fromSim: boolean) => {
      const prep = prepRef.current;
      const dest = destRef.current;
      if (!prep || !dest || arrivedRef.current) return;
      const { route: r, cum, total, stepAlong } = prep;

      let proj = projectOnPolyline(pos, r.coords, cum, Math.max(0, lastSegRef.current - 2));
      if (proj.offset > OFF_ROUTE_M) {
        const full = projectOnPolyline(pos, r.coords, cum, 0);
        if (full.offset < proj.offset) proj = full;
      }
      lastSegRef.current = proj.segment;

      // Heading: GPS course when moving, else direction of travel along the route.
      let heading: number;
      if (gpsHeading != null && gpsHeading >= 0) heading = gpsHeading;
      else if (r.coords.length > 1) heading = pointAlong(r.coords, cum, proj.along).bearing;
      else heading = bearingDegrees(pos, dest);
      lastPosRef.current = pos;

      const along = r.real ? proj.along : Math.max(0, total - distanceMeters(pos, dest));
      const remainingM = r.real ? Math.max(0, total - along) : distanceMeters(pos, dest);
      const remainingS = total > 0 ? (r.durationS * remainingM) / total : 0;

      let nextStepIdx = -1;
      for (let i = 0; i < r.steps.length; i++) {
        if (r.steps[i].type === "depart") continue;
        if (stepAlong[i] > along + STEP_PASSED_M || i === r.steps.length - 1) {
          nextStepIdx = i;
          break;
        }
      }
      const distToNextM = nextStepIdx >= 0 ? Math.max(0, stepAlong[nextStepIdx] - along) : remainingM;

      setProgress({ position: pos, heading, along, remainingM, remainingS, nextStepIdx, distToNextM });
      followCamera(pos, heading);

      if (distanceMeters(pos, dest) <= ARRIVAL_M || (r.real && remainingM <= 5)) {
        arrivedRef.current = true;
        setArrived(true);
        return;
      }

      if (!fromSim) {
        const cooled = Date.now() - lastRerouteRef.current > REROUTE_COOLDOWN_MS;
        if (r.real && proj.offset > OFF_ROUTE_M && cooled) reroute(pos);
        // A straight-line fallback is retried periodically in case the network came back.
        else if (!r.real && Date.now() - lastRerouteRef.current > 30_000) reroute(pos);
      }
    },
    [followCamera, reroute]
  );

  const start = useCallback(
    ({ route: r, destination, simulated: sim }: StartArgs) => {
      destRef.current = destination;
      arrivedRef.current = false;
      lastRerouteRef.current = Date.now();
      simAlongRef.current = 0;
      activeRef.current = true;
      applyRoute(r);
      setArrived(false);
      setProgress(null);
      setSimulated(sim);
      setActive(true);
    },
    [applyRoute]
  );

  const stop = useCallback(() => {
    activeRef.current = false;
    prepRef.current = null;
    destRef.current = null;
    setActive(false);
    setRoute(null);
    setProgress(null);
    setArrived(false);
    setError(null);
  }, []);

  // Keep the screen awake while navigating.
  useEffect(() => {
    if (!active) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [active]);

  // Real GPS tracking.
  useEffect(() => {
    if (!active || simulated) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Canlı takip için konum izni gerekli.");
        return;
      }
      try {
        const s = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
          (loc) => {
            const moving = (loc.coords.speed ?? 0) > 1;
            update(
              { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
              moving ? loc.coords.heading : null,
              false
            );
          },
          (reason) => setError(`Konum takibi hatası: ${reason}`)
        );
        if (cancelled) s.remove();
        else sub = s;
      } catch (e) {
        setError(`Konum takibi başlatılamadı: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [active, simulated, update]);

  // Demo simulation: move along the route polyline at the route's average speed × multiplier.
  useEffect(() => {
    if (!active || !simulated) return;
    const prep0 = prepRef.current;
    if (prep0) update(prep0.route.coords[0], null, true);
    const id = setInterval(() => {
      const prep = prepRef.current;
      if (!prep || arrivedRef.current) return;
      const speed = routeSpeedMps(prep.route) * SIM_SPEED_MULTIPLIER;
      simAlongRef.current = Math.min(prep.total, simAlongRef.current + speed * (SIM_TICK_MS / 1000));
      const p = pointAlong(prep.route.coords, prep.cum, simAlongRef.current);
      update(p.point, p.bearing, true);
    }, SIM_TICK_MS);
    return () => clearInterval(id);
  }, [active, simulated, update]);

  return { active, simulated, route, progress, arrived, rerouting, error, start, stop };
}
