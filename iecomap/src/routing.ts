import { PointCategory } from "./types";

export interface Authority {
  name: string;
  hotline?: string;
}

// Mardin için bildirim kategorisi → sorumlu kurum eşlemesi.
// Faz 1'de bildirimler haritada görünür; kuruma otomatik iletim Faz 2 hedefidir.
const ROUTES: Partial<Record<PointCategory, Authority>> = {
  electric_fault: { name: "Dicle Elektrik (DEDAŞ)", hotline: "186" },
  other_issue: { name: "Çevre, Şehircilik ve İklim Değişikliği İl Müdürlüğü", hotline: "181" },
  other: { name: "ilgili kuruma" },
};

export function authorityFor(category: PointCategory): Authority {
  return ROUTES[category] ?? ROUTES.other!;
}
