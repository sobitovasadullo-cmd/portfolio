export interface City {
  name: string;
  latitude: number;
  longitude: number;
}

// Mardin ve başlıca ilçe merkezleri (Google Maps koordinatlarına göre).
export const CITIES: City[] = [
  { name: "Artuklu (Merkez)", latitude: 37.3212, longitude: 40.7245 },
  { name: "Kızıltepe", latitude: 37.1943, longitude: 40.5864 },
  { name: "Midyat", latitude: 37.4156, longitude: 41.3703 },
  { name: "Nusaybin", latitude: 37.0742, longitude: 41.215 },
];

export function findCity(name: string): City | undefined {
  return CITIES.find((c) => c.name.toLocaleLowerCase("tr").startsWith(name.toLocaleLowerCase("tr")));
}
