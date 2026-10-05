// Haritada gösterilen ve/veya bildirilebilen nokta kategorileri
export type PointCategory =
  | "recycling" // Geri dönüşüm noktası
  | "ewaste" // Pil ve elektronik atık toplama noktası
  | "green" // Yeşil alan / park
  | "bike" // Bisiklet yolu
  | "waste" // Atık toplama noktası
  | "charging" // Araç şarj istasyonu
  | "electric_fault" // Elektrik arızası bildirimi
  | "other_issue" // Diğer çevre sorunu bildirimi
  | "other"; // Diğer (genel) bildirim

export interface CategoryInfo {
  key: PointCategory;
  label: string; // Kısa, menüde/çipte görünen ad
  fullLabel: string; // Detay ekranında görünen tam açıklayıcı ad
  emoji: string;
  color: string;
  /** true ise bu kategori sadece kullanıcı bildirimiyle oluşur, önceden yerleşik noktası olmaz */
  reportOnly?: boolean;
}

export const CATEGORIES: CategoryInfo[] = [
  {
    key: "recycling",
    label: "Geri Dönüşüm",
    fullLabel: "Geri Dönüşüm Noktası",
    emoji: "♻️",
    color: "#2E7D32",
  },
  {
    key: "ewaste",
    label: "Pil / Elektronik",
    fullLabel: "Pil ve Elektronik Atık Toplama Noktası",
    emoji: "🔋",
    color: "#F9A825",
  },
  {
    key: "green",
    label: "Yeşil Alan",
    fullLabel: "Yeşil Alan / Park",
    emoji: "🌳",
    color: "#43A047",
  },
  {
    key: "bike",
    label: "Bisiklet Yolu",
    fullLabel: "Bisiklet Yolu",
    emoji: "🚲",
    color: "#1E88E5",
  },
  {
    key: "waste",
    label: "Atık Toplama",
    fullLabel: "Atık Toplama Noktası",
    emoji: "🗑️",
    color: "#6D4C41",
  },
  {
    key: "charging",
    label: "Araç Şarj",
    fullLabel: "Elektrikli Araç Şarj İstasyonu",
    emoji: "🔌",
    color: "#8E24AA",
  },
  {
    key: "electric_fault",
    label: "Elektrik Arızası",
    fullLabel: "Elektrik Arızası Bildirimi",
    emoji: "⚡",
    color: "#FB8C00",
    reportOnly: true,
  },
  {
    key: "other_issue",
    label: "Çevre Sorunu",
    fullLabel: "Diğer Çevre Sorunu Bildirimi",
    emoji: "⚠️",
    color: "#E53935",
    reportOnly: true,
  },
  {
    key: "other",
    label: "Diğer",
    fullLabel: "Diğer Bildirim",
    emoji: "📝",
    color: "#546E7A",
    reportOnly: true,
  },
];

export function categoryInfo(key: PointCategory): CategoryInfo {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];
}

/** Bildirim formunda seçilebilen kategoriler (harita katmanları burada yer almaz). */
export const REPORTABLE_CATEGORY_KEYS: PointCategory[] = ["electric_fault", "other_issue", "other"];
export const REPORTABLE_CATEGORIES: CategoryInfo[] = REPORTABLE_CATEGORY_KEYS.map(categoryInfo);

export interface EcoPoint {
  id: string;
  category: PointCategory;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  createdAt: string; // ISO string
  photoUri?: string;
  isUserReport?: boolean;
  reporterName?: string;
  anonymous?: boolean;
  address?: string;
  phone?: string;
  hours?: string;
  district?: string;
  /** Verinin kaynağı (ör. "Google Maps") */
  source?: string;
  /** Bildirimin işlem durumu (sunucudaki `status`) */
  status?: ReportStatus;
  /** Bildirimin yönlendirildiği kurum */
  authority?: string;
  /** true ise bildirim henüz sunucuya gönderilemedi (çevrimdışı kuyrukta) */
  pending?: boolean;
  /** true ise kullanıcının haritaya uzun basarak bıraktığı geçici hedef */
  custom?: boolean;
}

export type ReportStatus = "yeni" | "iletildi" | "cozuldu";

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  yeni: "Yeni",
  iletildi: "İlgili kuruma iletildi",
  cozuldu: "Çözüldü",
};

export interface UserSession {
  name: string;
  email: string;
}
