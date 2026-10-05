import { Share } from "react-native";

// In-app routing + turn-by-turn helpers. The routing provider (currently the
// public OSRM demo server) is isolated in `fetchRoute` / `parseOsrmRoute`, so it
// can be swapped for another provider (Valhalla, GraphHopper, own OSRM…) later.

export type TravelMode = "driving" | "walking" | "bicycling";

export const MODE_LABEL: Record<TravelMode, string> = {
  driving: "🚗 Araç",
  walking: "🚶 Yürüyüş",
  bicycling: "🚲 Bisiklet",
};

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Mardin il merkezi (Artuklu) — "Mardin dışındasınız" kontrolü ve test konumu için. */
export const MARDIN_CENTER: LatLng = { latitude: 37.3212, longitude: 40.7245 };
/** Bu mesafeden uzaktaysa kullanıcı Mardin dışında sayılır (metre). */
export const OUTSIDE_MARDIN_M = 100_000;

export function isOutsideMardin(loc: LatLng): boolean {
  return distanceMeters(loc, MARDIN_CENTER) > OUTSIDE_MARDIN_M;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const R_EARTH = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** İki nokta arası kuş uçuşu mesafe (metre) — haversine. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** a → b yönü, kuzeyden saat yönünde derece (0–360). */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Cumulative distance (m) from the start of the polyline to each vertex. */
export function cumulativeDistances(coords: LatLng[]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) {
    out.push(out[i - 1] + distanceMeters(coords[i - 1], coords[i]));
  }
  return out;
}

export interface Projection {
  /** Distance from the point to the polyline (m). */
  offset: number;
  /** Distance along the polyline to the projected point (m). */
  along: number;
  /** Index of the segment start vertex. */
  segment: number;
}

/**
 * Projects `p` onto the polyline. Segments are treated as planar in a local
 * equirectangular frame, which is accurate enough at city scale.
 * `fromSegment` lets callers bias the search forward (avoids snapping back
 * onto an earlier part of a route that loops near itself).
 */
export function projectOnPolyline(
  p: LatLng,
  coords: LatLng[],
  cum: number[],
  fromSegment = 0
): Projection {
  if (coords.length < 2) {
    return { offset: coords[0] ? distanceMeters(p, coords[0]) : Infinity, along: 0, segment: 0 };
  }
  const kx = Math.cos(toRad(p.latitude)) * 111320;
  const ky = 110540;
  let best: Projection = { offset: Infinity, along: 0, segment: 0 };
  const start = Math.max(0, Math.min(fromSegment, coords.length - 2));
  for (let i = start; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const ax = (a.longitude - p.longitude) * kx;
    const ay = (a.latitude - p.latitude) * ky;
    const bx = (b.longitude - p.longitude) * kx;
    const by = (b.latitude - p.latitude) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? -(ax * dx + ay * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d = Math.sqrt(cx * cx + cy * cy);
    if (d < best.offset) {
      best = { offset: d, along: cum[i] + t * (cum[i + 1] - cum[i]), segment: i };
    }
  }
  return best;
}

/** Point (and travel bearing) at `along` metres from the polyline start. */
export function pointAlong(
  coords: LatLng[],
  cum: number[],
  along: number
): { point: LatLng; bearing: number; segment: number } {
  const total = cum[cum.length - 1] ?? 0;
  const target = Math.max(0, Math.min(total, along));
  let i = 0;
  while (i < cum.length - 2 && cum[i + 1] < target) i++;
  const a = coords[i];
  const b = coords[Math.min(i + 1, coords.length - 1)];
  const segLen = cum[Math.min(i + 1, cum.length - 1)] - cum[i];
  const t = segLen > 0 ? (target - cum[i]) / segLen : 0;
  return {
    point: {
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    },
    bearing: bearingDegrees(a, b),
    segment: i,
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(0, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`;
}

/** Yaklaşık süre: kuş uçuşu mesafeye yol eğriliği katsayısı uygulanır (tahmini). */
export function estimateMinutes(meters: number, mode: TravelMode): number {
  return Math.max(1, Math.round(((meters * 1.3) / 1000 / MODE_SPEED_KMH[mode]) * 60));
}

const MODE_SPEED_KMH: Record<TravelMode, number> = { driving: 35, bicycling: 14, walking: 4.8 };

export function formatMinutes(min: number): string {
  const m = Math.max(1, Math.round(min));
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} sa ${rest} dk` : `${h} sa`;
}

export function formatClock(d: Date): string {
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// Turn-by-turn instructions (Turkish), generated from OSRM maneuvers
// ---------------------------------------------------------------------------

export interface RouteStep {
  /** Maneuver point (where the action happens). */
  location: LatLng;
  type: string;
  modifier?: string;
  exit?: number;
  /** Road name after the maneuver ("" if unnamed). */
  name: string;
  /** Distance (m) of this step, i.e. from this maneuver to the next one. */
  distance: number;
}

export interface Instruction {
  /** Instruction as a sentence fragment starting lowercase, e.g. "sağa dönün". */
  text: string;
  /** Road name to show after the instruction (may be empty). */
  road: string;
  icon: string;
}

function turnPhrase(modifier?: string): string {
  switch (modifier) {
    case "uturn":
      return "geri dönün (U dönüşü)";
    case "sharp right":
      return "keskin sağa dönün";
    case "right":
      return "sağa dönün";
    case "slight right":
      return "hafif sağa dönün";
    case "sharp left":
      return "keskin sola dönün";
    case "left":
      return "sola dönün";
    case "slight left":
      return "hafif sola dönün";
    case "straight":
    default:
      return "düz devam edin";
  }
}

function sideWord(modifier?: string): "sağ" | "sol" | null {
  if (!modifier) return null;
  if (modifier.includes("right")) return "sağ";
  if (modifier.includes("left")) return "sol";
  return null;
}

export function maneuverIcon(type: string, modifier?: string): string {
  if (type === "arrive") return "🏁";
  if (type === "roundabout" || type === "rotary" || type === "roundabout turn") return "🔄";
  switch (modifier) {
    case "uturn":
      return "↩️";
    case "sharp right":
      return "↪️";
    case "right":
      return "➡️";
    case "slight right":
      return "↗️";
    case "sharp left":
      return "↩️";
    case "left":
      return "⬅️";
    case "slight left":
      return "↖️";
    default:
      return "⬆️";
  }
}

/** Builds a Turkish instruction for an OSRM step maneuver. */
export function instructionFor(step: RouteStep): Instruction {
  const { type, modifier, exit } = step;
  const road = step.name ?? "";
  const icon = maneuverIcon(type, modifier);
  const side = sideWord(modifier);
  let text: string;
  switch (type) {
    case "depart":
      text = road ? "rotaya başlayın" : "rotaya başlayın, yol boyunca ilerleyin";
      break;
    case "arrive":
      text = side === "sağ" ? "hedefe vardınız, hedef sağınızda" : side === "sol" ? "hedefe vardınız, hedef solunuzda" : "hedefe vardınız";
      break;
    case "roundabout":
    case "rotary":
      text = exit ? `kavşakta ${exit}. çıkıştan çıkın` : "kavşağa girin";
      break;
    case "roundabout turn":
      text = `kavşakta ${turnPhrase(modifier)}`;
      break;
    case "exit roundabout":
    case "exit rotary":
      text = "kavşaktan çıkın";
      break;
    case "fork":
      text = side ? `yol ayrımında ${side}dan devam edin` : "yol ayrımında düz devam edin";
      break;
    case "merge":
      text = side ? `${side}dan ana yola katılın` : "ana yola katılın";
      break;
    case "on ramp":
      text = side ? `${side}daki bağlantı yoluna girin` : "bağlantı yoluna girin";
      break;
    case "off ramp":
      text = side ? `${side}daki çıkışı kullanın` : "çıkışı kullanın";
      break;
    case "end of road":
      text = `yolun sonunda ${turnPhrase(modifier)}`;
      break;
    case "turn":
    case "new name":
    case "continue":
    case "use lane":
    case "notification":
    default:
      text = turnPhrase(modifier);
      break;
  }
  return { text, road, icon };
}

export function capitalizeTr(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase("tr") + s.slice(1) : s;
}

/** "300 m sonra sağa dönün" / "Şimdi sağa dönün" / "Hedefe vardınız". */
export function spokenInstruction(ins: Instruction, distanceToManeuver: number): string {
  const arriving = ins.text.startsWith("hedefe vardınız");
  if (distanceToManeuver < 30) return capitalizeTr(arriving ? ins.text : `şimdi ${ins.text}`);
  if (arriving) return `${formatDistance(distanceToManeuver)} sonra hedefe varacaksınız`;
  return `${formatDistance(distanceToManeuver)} sonra ${ins.text}`;
}

// ---------------------------------------------------------------------------
// Route fetching (OSRM)
// ---------------------------------------------------------------------------

export interface RouteResult {
  coords: LatLng[];
  distanceM: number;
  durationMin: number;
  /** Seconds, unrounded — used for remaining time / simulation speed. */
  durationS: number;
  steps: RouteStep[];
  /** true ise OSRM'den gerçek yol geometrisi geldi; false ise düz çizgi tahmini */
  real: boolean;
  /** Kullanıcıya gösterilecek hata mesajı (yalnızca real=false iken). */
  error?: string;
  mode: TravelMode;
}

const OSRM_BASE = "https://router.project-osrm.org/route/v1";
const OSRM_PROFILE: Record<TravelMode, string> = {
  driving: "driving",
  bicycling: "cycling",
  walking: "foot",
};
const TIMEOUT_MS = 8000;

function osrmUrl(from: LatLng, to: LatLng, mode: TravelMode): string {
  return (
    `${OSRM_BASE}/${OSRM_PROFILE[mode]}/` +
    `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
    `?overview=full&geometries=geojson&steps=true`
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseOsrmRoute(json: any, mode: TravelMode): RouteResult | null {
  const r = json?.routes?.[0];
  if (!r?.geometry?.coordinates?.length) return null;
  const coords: LatLng[] = r.geometry.coordinates.map(([lng, lat]: [number, number]) => ({
    latitude: lat,
    longitude: lng,
  }));
  const steps: RouteStep[] = [];
  for (const leg of r.legs ?? []) {
    for (const s of leg.steps ?? []) {
      const [lng, lat] = s.maneuver?.location ?? [];
      if (typeof lat !== "number" || typeof lng !== "number") continue;
      steps.push({
        location: { latitude: lat, longitude: lng },
        type: s.maneuver.type ?? "turn",
        modifier: s.maneuver.modifier,
        exit: s.maneuver.exit,
        name: s.name || s.ref || "",
        distance: s.distance ?? 0,
      });
    }
  }
  return {
    coords,
    distanceM: r.distance,
    durationS: r.duration,
    durationMin: Math.max(1, Math.round(r.duration / 60)),
    steps,
    real: true,
    mode,
  };
}

/** Düz çizgi + tahmini süre (rota servisine ulaşılamadığında). */
export function straightLineRoute(from: LatLng, to: LatLng, mode: TravelMode, error?: string): RouteResult {
  const d = distanceMeters(from, to);
  const min = estimateMinutes(d, mode);
  return {
    coords: [from, to],
    distanceM: d,
    durationMin: min,
    durationS: min * 60,
    steps: [],
    real: false,
    error,
    mode,
  };
}

/** Uygulama içi rota. Servise ulaşılamazsa düz çizgi + tahmini süreye düşer (hata mesajıyla). */
export async function fetchRoute(from: LatLng, to: LatLng, mode: TravelMode): Promise<RouteResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(osrmUrl(from, to, mode), { signal: ctrl.signal });
    if (!res.ok) {
      return straightLineRoute(from, to, mode, `Rota servisi yanıt vermedi (HTTP ${res.status}). Tahmini düz çizgi gösteriliyor.`);
    }
    const json = await res.json();
    const parsed = parseOsrmRoute(json, mode);
    if (parsed) return parsed;
    return straightLineRoute(from, to, mode, "Bu noktaya yol bulunamadı. Tahmini düz çizgi gösteriliyor.");
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return straightLineRoute(
      from,
      to,
      mode,
      aborted
        ? "Rota servisi zaman aşımına uğradı. İnternet bağlantınızı kontrol edin; tahmini düz çizgi gösteriliyor."
        : "Rota alınamadı. İnternet bağlantınızı kontrol edin; tahmini düz çizgi gösteriliyor."
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Average travel speed for a route (m/s), used by the demo simulation. */
export function routeSpeedMps(route: RouteResult): number {
  if (route.durationS > 0 && route.distanceM > 0) return route.distanceM / route.durationS;
  return (MODE_SPEED_KMH[route.mode] * 1000) / 3600;
}

export async function shareLocation(latitude: number, longitude: number, title: string) {
  const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
  try {
    await Share.share({
      message: `${title}\n📍 Konum: ${mapsUrl}`,
      url: mapsUrl,
      title,
    });
  } catch {
    // kullanıcı paylaşımı iptal etmiş olabilir
  }
}
