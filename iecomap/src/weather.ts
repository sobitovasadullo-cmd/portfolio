import { TEN_MINUTES, cached, fetchJson } from "./cache";
import { describeWeatherCode } from "./weatherCodes";

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
  label: string;
  emoji: string;
  /** Local time of the observation (ISO, Europe/Istanbul). */
  time: string;
}

export interface DailyForecast {
  date: string; // YYYY-MM-DD
  dayName: string; // Bugün, Yarın, Çarşamba…
  weatherCode: number;
  label: string;
  emoji: string;
  tempMax: number;
  tempMin: number;
  precipProbability: number | null;
  precipSum: number | null;
  windMax: number | null;
}

export interface WeatherData {
  current: CurrentWeather;
  daily: DailyForecast[];
}

const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function dayNameFor(date: string, index: number): string {
  if (index === 0) return "Bugün";
  if (index === 1) return "Yarın";
  const [y, m, d] = date.split("-").map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

interface OpenMeteoForecast {
  current?: Record<string, number | string>;
  daily?: Record<string, (number | null)[] | string[]>;
}

export function fetchWeather(latitude: number, longitude: number): Promise<WeatherData> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max` +
    `&timezone=Europe%2FIstanbul&forecast_days=7`;

  return cached(`weather:${latitude},${longitude}`, TEN_MINUTES, async () => {
    const json = await fetchJson<OpenMeteoForecast>(url);
    const c = json.current;
    if (!c || num(c.temperature_2m) == null) throw new Error("Hava durumu verisi eksik geldi.");
    const code = num(c.weather_code) ?? 0;
    const isDay = num(c.is_day) !== 0;
    const desc = describeWeatherCode(code, isDay);

    const d = json.daily ?? {};
    const dates = (d.time as string[] | undefined) ?? [];
    const daily: DailyForecast[] = dates.map((date, i) => {
      const dc = num((d.weather_code as (number | null)[])?.[i]) ?? 0;
      const dd = describeWeatherCode(dc, true);
      return {
        date,
        dayName: dayNameFor(date, i),
        weatherCode: dc,
        label: dd.label,
        emoji: dd.emoji,
        tempMax: Math.round(num((d.temperature_2m_max as (number | null)[])?.[i]) ?? 0),
        tempMin: Math.round(num((d.temperature_2m_min as (number | null)[])?.[i]) ?? 0),
        precipProbability: num((d.precipitation_probability_max as (number | null)[])?.[i]),
        precipSum: num((d.precipitation_sum as (number | null)[])?.[i]),
        windMax: num((d.wind_speed_10m_max as (number | null)[])?.[i]),
      };
    });

    return {
      current: {
        temperature: Math.round(num(c.temperature_2m) ?? 0),
        apparentTemperature: Math.round(num(c.apparent_temperature) ?? 0),
        humidity: Math.round(num(c.relative_humidity_2m) ?? 0),
        windSpeed: Math.round(num(c.wind_speed_10m) ?? 0),
        weatherCode: code,
        isDay,
        label: desc.label,
        emoji: desc.emoji,
        time: String(c.time ?? ""),
      },
      daily,
    };
  });
}
