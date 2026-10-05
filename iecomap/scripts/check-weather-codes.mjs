// Sanity check: every WMO code Open-Meteo can return must map to a Turkish label.
// Usage: node scripts/check-weather-codes.mjs   (Node >= 22.18, type stripping)
import { WMO_CODES, OPEN_METEO_CODES, describeWeatherCode } from "../src/weatherCodes.ts";

let failed = 0;
for (const code of OPEN_METEO_CODES) {
  const info = WMO_CODES[code];
  if (!info || !info.label || !info.day || !info.night) {
    console.error(`✗ code ${code} has no complete mapping`);
    failed++;
    continue;
  }
  const d = describeWeatherCode(code, true);
  const n = describeWeatherCode(code, false);
  console.log(`✓ ${String(code).padStart(2)}  ${d.emoji} / ${n.emoji}  ${d.label}`);
}
// No mapping should exist for a code Open-Meteo does not document (typo guard).
for (const key of Object.keys(WMO_CODES).map(Number)) {
  if (!OPEN_METEO_CODES.includes(key)) {
    console.error(`✗ mapping for undocumented code ${key}`);
    failed++;
  }
}
// Codes 0–99 outside the documented set must fall back, not crash.
for (let c = 0; c <= 99; c++) describeWeatherCode(c);

if (failed) {
  console.error(`${failed} problem(s)`);
  process.exit(1);
}
console.log(`All ${OPEN_METEO_CODES.length} Open-Meteo weather codes resolve to a Turkish label.`);
