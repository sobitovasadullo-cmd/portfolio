// WMO weather interpretation codes (WW) as returned by Open-Meteo, mapped to
// Turkish labels and emoji. The code list is the exact subset Open-Meteo emits,
// taken from the official docs table ("WMO Weather interpretation codes") in
// open-meteo/open-meteo-website (src/lib/components/variables/wmo-codes-table.svelte):
// 0,1,2,3,45,48,51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,97,99.
// Run `node scripts/check-weather-codes.mjs` to verify every code resolves.
//
// Keep this file free of imports and non-erasable TS syntax (no enums) so the
// sanity script can load it directly with Node's type stripping.

export interface WeatherCodeInfo {
  label: string;
  /** Emoji for daytime. */
  day: string;
  /** Emoji at night (only differs for clear / mostly clear skies). */
  night: string;
}

export const WMO_CODES: Readonly<Record<number, WeatherCodeInfo>> = {
  0: { label: "Açık", day: "☀️", night: "🌙" },
  1: { label: "Çoğunlukla açık", day: "🌤️", night: "🌙" },
  2: { label: "Parçalı bulutlu", day: "⛅", night: "☁️" },
  3: { label: "Kapalı", day: "☁️", night: "☁️" },
  45: { label: "Sisli", day: "🌫️", night: "🌫️" },
  48: { label: "Kırağılı sis", day: "🌫️", night: "🌫️" },
  51: { label: "Hafif çiseleyen yağmur", day: "🌦️", night: "🌧️" },
  53: { label: "Orta çiseleyen yağmur", day: "🌦️", night: "🌧️" },
  55: { label: "Yoğun çiseleyen yağmur", day: "🌧️", night: "🌧️" },
  56: { label: "Hafif donan çisenti", day: "🌧️", night: "🌧️" },
  57: { label: "Yoğun donan çisenti", day: "🌧️", night: "🌧️" },
  61: { label: "Hafif yağmurlu", day: "🌦️", night: "🌧️" },
  63: { label: "Orta yağmurlu", day: "🌧️", night: "🌧️" },
  65: { label: "Şiddetli yağmurlu", day: "🌧️", night: "🌧️" },
  66: { label: "Hafif donan yağmur", day: "🌧️", night: "🌧️" },
  67: { label: "Şiddetli donan yağmur", day: "🌧️", night: "🌧️" },
  71: { label: "Hafif kar yağışı", day: "🌨️", night: "🌨️" },
  73: { label: "Orta kar yağışı", day: "🌨️", night: "🌨️" },
  75: { label: "Yoğun kar yağışı", day: "❄️", night: "❄️" },
  77: { label: "Kar taneleri", day: "🌨️", night: "🌨️" },
  80: { label: "Hafif sağanak yağış", day: "🌦️", night: "🌧️" },
  81: { label: "Orta sağanak yağış", day: "🌧️", night: "🌧️" },
  82: { label: "Şiddetli sağanak yağış", day: "⛈️", night: "⛈️" },
  85: { label: "Hafif kar sağanağı", day: "🌨️", night: "🌨️" },
  86: { label: "Yoğun kar sağanağı", day: "❄️", night: "❄️" },
  95: { label: "Gök gürültülü fırtına", day: "⛈️", night: "⛈️" },
  96: { label: "Hafif dolulu gök gürültülü fırtına", day: "⛈️", night: "⛈️" },
  97: { label: "Şiddetli gök gürültülü fırtına", day: "⛈️", night: "⛈️" },
  99: { label: "Yoğun dolulu gök gürültülü fırtına", day: "⛈️", night: "⛈️" },
};

/** Every code Open-Meteo documents as possible output. */
export const OPEN_METEO_CODES: readonly number[] = [
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 97, 99,
];

/** Label + emoji for a WMO code. Unknown codes (never emitted by Open-Meteo) get a neutral fallback. */
export function describeWeatherCode(code: number, isDay = true): { label: string; emoji: string } {
  const info = WMO_CODES[code];
  if (!info) return { label: "Hava durumu", emoji: "🌡️" };
  return { label: info.label, emoji: isDay ? info.day : info.night };
}
