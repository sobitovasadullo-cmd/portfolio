// Acil durum ve kamu hizmeti numaraları.
// Her numara resmi/otoriter bir kaynaktan kontrol edildi (aşağıdaki `source`).
// Doğrulanamayan numaralar bilinçli olarak listeye EKLENMEDİ.

export interface EmergencyEntry {
  id: string;
  icon: string;
  name: string;
  description: string;
  /** Number as dialed (digits only, may start with 0). */
  number: string;
  /** Number as displayed. */
  display: string;
  /** Where it was verified (kept for maintainers; not shown in the UI). */
  source: string;
}

export interface EmergencySection {
  title: string;
  entries: EmergencyEntry[];
}

/** Numaraların en son kontrol edildiği tarih (YYYY-MM-DD). */
export const verifiedAt = "2026-10-05";

const VIA_112 =
  "112.gov.tr / İçişleri Bakanlığı: 155, 156, 110, 122, 177 ve 158 numaraları tüm illerde 112 Acil Çağrı Merkezine yönlendirilir.";

export const EMERGENCY_SECTIONS: EmergencySection[] = [
  {
    title: "Acil Yardım",
    entries: [
      {
        id: "112",
        icon: "🚑",
        name: "112 Acil Çağrı Merkezi",
        description: "Ambulans, itfaiye, polis, jandarma, AFAD — tüm acil durumlar için tek numara.",
        number: "112",
        display: "112",
        source: "112.gov.tr, icisleri.gov.tr (112 Acil Çağrı Merkezleri Projesi)",
      },
      {
        id: "155",
        icon: "👮",
        name: "Polis İmdat",
        description: "112 Acil Çağrı Merkezine yönlendirilir.",
        number: "155",
        display: "155",
        source: VIA_112,
      },
      {
        id: "156",
        icon: "🪖",
        name: "Jandarma İmdat",
        description: "112 Acil Çağrı Merkezine yönlendirilir.",
        number: "156",
        display: "156",
        source: VIA_112,
      },
      {
        id: "110",
        icon: "🚒",
        name: "İtfaiye",
        description: "Yangın ihbarı. 112 Acil Çağrı Merkezine yönlendirilir.",
        number: "110",
        display: "110",
        source: VIA_112,
      },
      {
        id: "122",
        icon: "🆘",
        name: "AFAD (Afet ve Acil Durum)",
        description: "Afet ihbarı. 112 Acil Çağrı Merkezine yönlendirilir.",
        number: "122",
        display: "122",
        source: VIA_112,
      },
      {
        id: "177",
        icon: "🌲",
        name: "Orman Yangını İhbar",
        description: "Orman ve anız yangını ihbarı. 112 Acil Çağrı Merkezine yönlendirilir.",
        number: "177",
        display: "177",
        source: VIA_112,
      },
      {
        id: "114",
        icon: "☠️",
        name: "Ulusal Zehir Danışma Merkezi (UZEM)",
        description: "Zehirlenme, ilaç, tarım ilacı, mantar ve hayvan ısırmalarında 7/24 danışma.",
        number: "114",
        display: "114",
        source: "Sağlık Bakanlığı Halk Sağlığı Genel Müdürlüğü; aa.com.tr (UZEM haberi)",
      },
    ],
  },
  {
    title: "Sağlık ve Sosyal",
    entries: [
      {
        id: "182",
        icon: "🏥",
        name: "ALO 182 MHRS",
        description: "Hastane ve aile hekimi randevusu (Merkezi Hekim Randevu Sistemi).",
        number: "182",
        display: "182",
        source: "mhrs.gov.tr; saglik.gov.tr il/hastane sayfaları (ALO 182)",
      },
      {
        id: "184",
        icon: "📞",
        name: "ALO 184 SABİM",
        description: "Sağlık Bakanlığı İletişim Merkezi: sağlık hizmetleri şikâyet, öneri ve bilgi.",
        number: "184",
        display: "184",
        source: "sabim.gov.tr",
      },
      {
        id: "183",
        icon: "🤝",
        name: "ALO 183 Sosyal Destek",
        description: "Aile, kadın, çocuk, engelli ve yaşlılara yönelik 7/24 destek (Aile ve Sosyal Hizmetler Bakanlığı).",
        number: "183",
        display: "183",
        source: "aile.gov.tr (ALO 183 Sosyal Destek)",
      },
    ],
  },
  {
    title: "Çevre ve Altyapı",
    entries: [
      {
        id: "181",
        icon: "🌿",
        name: "ALO 181 Çevre, Şehircilik ve İklim Değişikliği Bakanlığı",
        description: "Çevre kirliliği, atık, hava/su/toprak kirliliği ihbarı; 7/24.",
        number: "181",
        display: "181",
        source: "alo181.gov.tr, 181.csb.gov.tr",
      },
      {
        id: "186",
        icon: "⚡",
        name: "Dicle Elektrik (DEDAŞ) Arıza",
        description: "Elektrik kesintisi/arızası, sokak aydınlatması, kaçak elektrik ihbarı (Mardin dahil).",
        number: "186",
        display: "186",
        source: "dedas.com.tr (Arıza Bildirimi / İletişim)",
      },
      {
        id: "187",
        icon: "🔥",
        name: "Doğal Gaz Acil (ALO 187)",
        description: "Gaz kokusu, kaçak şüphesi ve doğal gaz acil durumları; 7/24.",
        number: "187",
        display: "187",
        source: "Doğal gaz dağıtım şirketlerinin ortak acil hattı (ör. corumgaz.com.tr, kargaz.com.tr 'Doğalgaz Acil 187')",
      },
      {
        id: "185",
        icon: "💧",
        name: "MARSU Su Arıza (ALO 185)",
        description: "Mardin su ve kanalizasyon arızası, su kaçağı, kaçak su ihbarı; 7/24.",
        number: "185",
        display: "185",
        source: "marsu.gov.tr (Alo 185 Beyaz Masa)",
      },
      {
        id: "153",
        icon: "🏛️",
        name: "ALO 153 Belediye (Mardin Büyükşehir)",
        description: "Mardin Büyükşehir Belediyesi istek ve şikâyet hattı.",
        number: "153",
        display: "153",
        source: "mardin.bel.tr ('Alo 153 İstek - Şikayet')",
      },
    ],
  },
  {
    title: "Mardin'e Özel",
    entries: [
      {
        id: "mardin-csb",
        icon: "🌳",
        name: "Mardin Çevre, Şehircilik ve İklim Değişikliği İl Müdürlüğü",
        description: "13 Mart Mah., Emniyet Cd., Artuklu.",
        number: "04822121199",
        display: "0482 212 11 99",
        source: "mardin.csb.gov.tr/iletisim",
      },
      {
        id: "mardin-bel",
        icon: "🏙️",
        name: "Mardin Büyükşehir Belediyesi (Santral)",
        description: "İstasyon Mah. 1. Cd. No:54/A.",
        number: "04822151930",
        display: "0482 215 19 30",
        source: "mardin.bel.tr, turkiye.gov.tr/mardin-buyuksehir-belediyesi",
      },
      {
        id: "mardin-afad",
        icon: "🆘",
        name: "Mardin İl Afet ve Acil Durum Müdürlüğü (AFAD)",
        description: "Santral. Acil durumda 112'yi arayın.",
        number: "04822123740",
        display: "0482 212 37 40",
        source: "mardin.afad.gov.tr/iletisim",
      },
      {
        id: "mardin-saglik",
        icon: "🩺",
        name: "Mardin İl Sağlık Müdürlüğü",
        description: "Santral. 13 Mart Mah., Vali Ozan Cd. No:104.",
        number: "04822127753",
        display: "0482 212 77 53",
        source: "mardinism.saglik.gov.tr (İletişim)",
      },
      {
        id: "marsu",
        icon: "🚰",
        name: "MARSU Genel Müdürlüğü",
        description: "Mardin Su ve Kanalizasyon İdaresi santral. Arıza için 185.",
        number: "04825021200",
        display: "0482 502 12 00",
        source: "marsu.gov.tr (İletişim)",
      },
    ],
  },
];
