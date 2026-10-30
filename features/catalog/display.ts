import { normalizeCatalogTitle } from "@/services/tmdb";

// ---------------------------------------------------------------------------
// Exibição de títulos e categorias vindos da lista IPTV.
//
// Listas costumam trazer marcações técnicas ("Devorador [L]", "Filmes |
// Mais Assistidos", "Drama |"). Aqui elas viram texto limpo e uma etiqueta
// discreta, e versões do mesmo título (dublado/legendado) são agrupadas num
// único cartão — a versão é escolhida nos Detalhes.
// ---------------------------------------------------------------------------

export type TitleVariantKind = "leg" | "dub" | "nac" | "default";

const VARIANT_PATTERNS: { kind: Exclude<TitleVariantKind, "default">; pattern: RegExp }[] = [
  { kind: "leg", pattern: /\[(?:L|LEG|LEGENDADO|SUB)\]|\((?:L|LEG|LEGENDADO|SUB)\)|\bLEGENDAD[OA]\b|\bLEG\b/i },
  { kind: "dub", pattern: /\[(?:D|DUB|DUBLADO)\]|\((?:D|DUB|DUBLADO)\)|\bDUBLAD[OA]\b|\bDUB\b/i },
  { kind: "nac", pattern: /\[(?:NAC|NACIONAL)\]|\((?:NAC|NACIONAL)\)|\bNACIONAL\b/i },
];

export const VARIANT_LABEL: Record<TitleVariantKind, string> = {
  leg: "Legendado",
  dub: "Dublado",
  nac: "Nacional",
  default: "Padrão",
};

export const VARIANT_BADGE: Record<TitleVariantKind, string | null> = {
  leg: "LEG",
  dub: "DUB",
  nac: "NAC",
  default: null,
};

export function titleVariant(title: string): TitleVariantKind {
  for (const { kind, pattern } of VARIANT_PATTERNS) {
    if (pattern.test(title)) return kind;
  }
  return "default";
}

/** Título sem marcações técnicas: "Devorador [L]" → "Devorador". */
export function displayTitle(title: string): string {
  const cleaned = title
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\((?:L|D|LEG|DUB|SUB|NAC|LEGENDADO|DUBLADO|NACIONAL)\)/gi, " ")
    .replace(/\b(?:LEGENDAD[OA]|DUBLAD[OA])\b/gi, " ")
    .replace(/\s*[|·•\-–]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || title.trim();
}

/**
 * Nome de categoria sem o prefixo do provedor: "Filmes | Mais Assistidos" →
 * "Mais Assistidos"; "Drama |" → "Drama".
 */
export function displayCategory(name: string): string {
  const parts = name.split(/\s*[|│]\s*/).map((part) => part.trim()).filter(Boolean);
  const meaningful = parts.filter((part) => !/^(?:filmes?|movies?|vod|s[ée]ries?|tv\s*shows?)$/i.test(part));
  const result = (meaningful.length ? meaningful : parts).join(" · ");
  return result || name.trim();
}

function groupKey(title: string, year: number) {
  return `${normalizeCatalogTitle(displayTitle(title))}#${year > 0 ? year : ""}`;
}

/** Ordem de preferência do cartão que representa o grupo. */
const VARIANT_PRIORITY: Record<TitleVariantKind, number> = { dub: 0, default: 1, nac: 2, leg: 3 };

/**
 * Agrupa versões do mesmo título (mesmo nome limpo e ano). Mantém a posição
 * da primeira ocorrência; o representante é a versão dublada/padrão.
 */
export function dedupeTitleVariants<T extends { title: string; year: number }>(items: T[]): T[] {
  const indexByKey = new Map<string, number>();
  const result: T[] = [];
  for (const item of items) {
    const key = groupKey(item.title, item.year);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, result.length);
      result.push(item);
      continue;
    }
    const current = result[existingIndex];
    if (VARIANT_PRIORITY[titleVariant(item.title)] < VARIANT_PRIORITY[titleVariant(current.title)]) {
      result[existingIndex] = item;
    }
  }
  return result;
}

/** Todas as versões do título informado, na ordem de preferência. */
export function findTitleVariants<T extends { id: string; title: string; year: number }>(items: T[], reference: T): T[] {
  const key = groupKey(reference.title, reference.year);
  const variants = items.filter((item) => groupKey(item.title, item.year) === key);
  return variants.sort((a, b) => VARIANT_PRIORITY[titleVariant(a.title)] - VARIANT_PRIORITY[titleVariant(b.title)]);
}

export function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}
