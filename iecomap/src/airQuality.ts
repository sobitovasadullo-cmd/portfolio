import { TEN_MINUTES, cached, fetchJson } from "./cache";
import { CITIES, City } from "./data/cities";

// European AQI bands exactly as documented by Open-Meteo for `european_aqi`
// (EEA bands revised in 2024): 0–20 Good, 20–40 Fair, 40–60 Moderate,
// 60–80 Poor, 80–100 Very poor, >100 Extremely poor.
// A value sitting exactly on a boundary is assigned to the lower band.
// Turkish labels are the app's own translation (not an official EEA wording).
// Colors are the app's own green→purple scale, not official EEA hex values.

export type AqiLevel = "good" | "fair" | "moderate" | "poor" | "very_poor" | "extremely_poor";

export interface AqiBand {
  level: AqiLevel;
  /** Upper bound (inclusive); Infinity for the last band. */
  max: number;
  range: string;
  label: string;
  /** Official English band name (for reference). */
  official: string;
  color: string;
  advice: string;
}

// Advice follows the EEA's general / sensitive-population recommendations per band.
export const AQI_BANDS: AqiBand[] = [
  {
    level: "good",
    max: 20,
    range: "0–20",
    label: "İyi",
    official: "Good",
    color: "#2E7D32",
    advice: "Hava kalitesi iyi. Açık havada spor ve aktiviteler için uygun.",
  },
  {
    level: "fair",
    max: 40,
    range: "20–40",
    label: "Orta",
    official: "Fair",
    color: "#7CB342",
    advice: "Açık hava aktivitelerinizi normal şekilde sürdürebilirsiniz.",
  },
  {
    level: "moderate",
    max: 60,
    range: "40–60",
    label: "Hassas gruplar için sağlıksız",
    official: "Moderate",
    color: "#FBC02D",
    advice:
      "Herkes için açık hava aktiviteleri genelde uygundur. Astım, KOAH veya kalp rahatsızlığı olanlar belirti hissederse yoğun açık hava egzersizini azaltmalıdır.",
  },
  {
    level: "poor",
    max: 80,
    range: "60–80",
    label: "Sağlıksız",
    official: "Poor",
    color: "#F57C00",
    advice:
      "Göz yanması, öksürük veya boğaz ağrısı hissederseniz dışarıdaki yoğun aktiviteleri azaltın. Hassas gruplar (çocuklar, yaşlılar, solunum/kalp hastaları) özellikle açık havada fiziksel aktiviteyi azaltmalıdır.",
  },
  {
    level: "very_poor",
    max: 100,
    range: "80–100",
    label: "Çok sağlıksız",
    official: "Very poor",
    color: "#D32F2F",
    advice:
      "Açık havada yoğun egzersizden kaçının, özellikle belirti varsa aktiviteyi azaltın. Hassas gruplar dış ortamda fiziksel aktiviteyi azaltmalı; dışarı çıkmak zorundaysanız uygun bir maske (ör. FFP2) faydalı olabilir.",
  },
  {
    level: "extremely_poor",
    max: Infinity,
    range: "100+",
    label: "Tehlikeli",
    official: "Extremely poor",
    color: "#6A1B9A",
    advice:
      "Herkes açık havadaki fiziksel aktiviteyi azaltmalı; hassas gruplar dış ortamda fiziksel aktiviteden tamamen kaçınmalıdır. Pencereleri kapalı tutun, mümkünse içeride kalın.",
  },
];

export function aqiBand(aqi: number): AqiBand {
  return AQI_BANDS.find((b) => aqi <= b.max) ?? AQI_BANDS[AQI_BANDS.length - 1];
}

export interface DistrictAirQuality {
  city: City;
  /** Short district name for map labels. */
  name: string;
  aqi: number | null;
  band: AqiBand | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  so2: number | null;
  dust: number | null;
  /** Local timestamp of the model value (Europe/Istanbul). */
  time: string;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

interface AirResponse {
  current?: Record<string, number | string>;
}

function shortName(city: City): string {
  return city.name.replace(/\s*\(.*\)\s*/, "");
}

async function fetchDistrict(city: City): Promise<DistrictAirQuality> {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.latitude}&longitude=${city.longitude}` +
    `&current=european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,dust&timezone=Europe%2FIstanbul`;
  return cached(`aq:${city.latitude},${city.longitude}`, TEN_MINUTES, async () => {
    const json = await fetchJson<AirResponse>(url);
    const c = json.current ?? {};
    const aqi = num(c.european_aqi);
    return {
      city,
      name: shortName(city),
      aqi: aqi != null ? Math.round(aqi) : null,
      band: aqi != null ? aqiBand(aqi) : null,
      pm25: num(c.pm2_5),
      pm10: num(c.pm10),
      no2: num(c.nitrogen_dioxide),
      o3: num(c.ozone),
      so2: num(c.sulphur_dioxide),
      dust: num(c.dust),
      time: String(c.time ?? ""),
    };
  });
}

/** One request per district, in parallel. Fails only if every district fails. */
export async function fetchMardinAirQuality(): Promise<{ data: DistrictAirQuality[]; failed: number }> {
  const results = await Promise.allSettled(CITIES.map(fetchDistrict));
  const data = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (data.length === 0) {
    const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw first?.reason instanceof Error ? first.reason : new Error("Hava kalitesi verisi alınamadı.");
  }
  return { data, failed: results.length - data.length };
}

/** "2026-10-05T14:00" → "5 Ekim 14:00" */
export function formatAqTime(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso || "–";
  const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[4]}:${m[5]}`;
}
