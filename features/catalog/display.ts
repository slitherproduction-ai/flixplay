// ---------------------------------------------------------------------------
// Exibição de títulos e categorias vindos da lista IPTV.
//
// Listas costumam trazer marcações técnicas ("Devorador [L]", "Filmes |
// Mais Assistidos", "Drama |"). Aqui elas viram texto limpo e uma etiqueta
// discreta, e versões do mesmo título (dublado/legendado) são agrupadas num
// único cartão — a versão é escolhida nos Detalhes.
//
// DESEMPENHO: estas funções rodam sobre catálogos de dezenas de milhares de
// títulos no motor Hermes. Por isso:
//   • a chave de agrupamento é calculada com operações simples de texto (sem
//     expressões regulares com /i e \b, que são lentas no Hermes);
//   • todos os resultados ficam em cache por título;
//   • o índice de versões é montado uma vez por lista (WeakMap).
// Uma versão anterior usava várias regex por título e travava a interface
// por segundos em listas grandes (toques e barra de abas sem resposta).
// ---------------------------------------------------------------------------

export type TitleVariantKind = "leg" | "dub" | "nac" | "default";

export const VARIANT_LABEL: Record<TitleVariantKind, string> = {
  leg: "Legendado",
  dub: "Dublado",
  nac: "Nacional",
  default: "Padrão",
};

const CACHE_LIMIT = 150_000;

function cached<V>(cache: Map<string, V>, key: string, compute: () => V): V {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = compute();
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, value);
  return value;
}

/** Separa trechos entre colchetes e parênteses ("[L]", "(2019)", "(Parte Dois)"). */
function stripEnclosed(value: string): { text: string; enclosed: string[] } {
  if (value.indexOf("[") < 0 && value.indexOf("(") < 0) return { text: value, enclosed: [] };
  let text = "";
  const enclosed: string[] = [];
  let depth = 0;
  let current = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "[" || char === "(") {
      if (depth === 0) current = "";
      depth += 1;
      continue;
    }
    if ((char === "]" || char === ")") && depth > 0) {
      depth -= 1;
      if (depth === 0) enclosed.push(current);
      text += " ";
      continue;
    }
    if (depth > 0) current += char;
    else text += char;
  }
  return { text, enclosed };
}

const ACCENTS: Record<string, string> = {
  á: "a", à: "a", â: "a", ã: "a", ä: "a", å: "a",
  é: "e", è: "e", ê: "e", ë: "e",
  í: "i", ì: "i", î: "i", ï: "i",
  ó: "o", ò: "o", ô: "o", õ: "o", ö: "o",
  ú: "u", ù: "u", û: "u", ü: "u",
  ç: "c", ñ: "n", ý: "y", ÿ: "y",
};
// Expressões simples (sem /i nem \b), rápidas no Hermes.
const NON_ASCII = /[^\x00-\x7f]/;
const ACCENT_RE = /[áàâãäåéèêëíìîïóòôõöúùûüçñýÿ]/g;
const SPLIT_RE = /[^a-z0-9]+/;

/** Divide em palavras minúsculas, sem acentos e sem pontuação. */
function words(value: string): string[] {
  let lower = value.toLowerCase();
  if (NON_ASCII.test(lower)) lower = lower.replace(ACCENT_RE, (char) => ACCENTS[char] ?? char);
  return lower.split(SPLIT_RE).filter(Boolean);
}

// Dentro de colchetes/parênteses as marcações podem ser curtas ([L], [DUB]);
// fora deles só valem palavras inteiras e inequívocas ("Leg Day" não é legendado).
const LEG_SHORT = new Set(["l", "leg", "legendado", "legendada", "sub", "legendas"]);
const DUB_SHORT = new Set(["d", "dub", "dublado", "dublada"]);
const NAC_SHORT = new Set(["nac", "nacional"]);
const LEG_WORDS = new Set(["legendado", "legendada"]);
const DUB_WORDS = new Set(["dublado", "dublada"]);
const NAC_WORDS = new Set(["nacional"]);
/** Marcações técnicas ignoradas fora de colchetes/parênteses. */
const NOISE_WORDS = new Set([
  "fhd", "4k", "uhd", "hd", "hq", "sdr", "hdr", "hdr10", "hevc", "h265", "h264", "x265", "x264",
  "dublado", "dublada", "legendado", "legendada", "dual",
]);
const YEAR_RE = /^(19|20)\d\d$/;

/** Trecho entre colchetes/parênteses que é só marcação técnica, versão ou ano. */
function isTagOnly(part: string): boolean {
  const tokens = words(part);
  return tokens.every((token) => NOISE_WORDS.has(token) || LEG_SHORT.has(token) || DUB_SHORT.has(token) || NAC_SHORT.has(token) || YEAR_RE.test(token));
}

const variantCache = new Map<string, TitleVariantKind>();

function classify(tokens: string[], leg: Set<string>, dub: Set<string>, nac: Set<string>): TitleVariantKind | null {
  for (const token of tokens) {
    if (leg.has(token)) return "leg";
    if (dub.has(token)) return "dub";
    if (nac.has(token)) return "nac";
  }
  return null;
}

export function titleVariant(title: string): TitleVariantKind {
  return cached(variantCache, title, () => {
    const { text, enclosed } = stripEnclosed(title);
    for (const part of enclosed) {
      const kind = classify(words(part), LEG_SHORT, DUB_SHORT, NAC_SHORT);
      if (kind) return kind;
    }
    return classify(words(text), LEG_WORDS, DUB_WORDS, NAC_WORDS) ?? "default";
  });
}

const displayTitleCache = new Map<string, string>();
const TRAILING_SEPARATORS = new Set(["|", "·", "•", "-", "–", " "]);

/** Título sem marcações técnicas: "Devorador [L]" → "Devorador"; mantém "Duna (Parte Dois)". */
export function displayTitle(title: string): string {
  return cached(displayTitleCache, title, () => {
    let result = "";
    if (title.indexOf("[") >= 0 || title.indexOf("(") >= 0) {
      // Remove apenas trechos que são marcação; preserva os que fazem parte do nome.
      let depth = 0;
      let open = "";
      let part = "";
      for (let index = 0; index < title.length; index += 1) {
        const char = title[index];
        if ((char === "[" || char === "(") && depth === 0) { depth = 1; open = char; part = ""; continue; }
        if (depth > 0) {
          if ((open === "[" && char === "]") || (open === "(" && char === ")")) {
            depth = 0;
            if (!isTagOnly(part)) result += `${open}${part}${open === "[" ? "]" : ")"}`;
            result += " ";
          } else {
            part += char;
          }
          continue;
        }
        result += char;
      }
      if (depth > 0) result += `${open}${part}`;
    } else {
      result = title;
    }
    // Remove as palavras "Dublado"/"Legendado" soltas no título.
    result = result.split(" ").filter((word) => {
      const lower = word.toLowerCase();
      return !LEG_WORDS.has(lower) && !DUB_WORDS.has(lower);
    }).join(" ");
    result = result.replace(/\s+/g, " ").trim();
    while (result.length && TRAILING_SEPARATORS.has(result[result.length - 1])) result = result.slice(0, -1).trimEnd();
    return result || title.trim();
  });
}

const categoryCache = new Map<string, string>();
const CATEGORY_PREFIXES = new Set(["filme", "filmes", "movie", "movies", "vod", "serie", "series", "tv shows", "tvshows", "tv show"]);

/**
 * Nome de categoria sem o prefixo do provedor: "Filmes | Mais Assistidos" →
 * "Mais Assistidos"; "Drama |" → "Drama".
 */
export function displayCategory(name?: string | null): string {
  if (!name) return "";
  return cached(categoryCache, name, () => {
    const parts = name.split("|").join("│").split("│").map((part) => part.trim()).filter(Boolean);
    const meaningful = parts.filter((part) => !CATEGORY_PREFIXES.has(words(part).join(" ")));
    const result = (meaningful.length ? meaningful : parts).join(" · ");
    return result || name.trim();
  });
}

const groupKeyCache = new Map<string, string>();

/** Chave do título: palavras sem marcações, acentos e pontuação. */
function titleKey(title: string): string {
  return cached(groupKeyCache, title, () => {
    const { text, enclosed } = stripEnclosed(title);
    const meaningful = enclosed.filter((part) => !isTagOnly(part)).join(" ");
    return words(meaningful ? `${text} ${meaningful}` : text).filter((token) => !NOISE_WORDS.has(token)).join(" ");
  });
}

/** Chave de comparação de títulos (busca e recomendações), rápida e em cache. */
export function catalogTitleKey(title: string): string {
  return titleKey(title);
}

function groupKey(title: string, year: number) {
  return `${titleKey(title)}#${year > 0 ? year : ""}`;
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

const variantIndexCache = new WeakMap<object, Map<string, { id: string; title: string; year: number }[]>>();

/** Todas as versões do título informado, na ordem de preferência. */
export function findTitleVariants<T extends { id: string; title: string; year: number }>(items: T[], reference: T): T[] {
  // O índice é montado uma vez por lista; aberturas seguintes de Detalhes
  // consultam o grupo diretamente.
  let index = variantIndexCache.get(items) as Map<string, T[]> | undefined;
  if (!index) {
    index = new Map<string, T[]>();
    for (const item of items) {
      const key = groupKey(item.title, item.year);
      const group = index.get(key);
      if (group) group.push(item);
      else index.set(key, [item]);
    }
    variantIndexCache.set(items, index as Map<string, { id: string; title: string; year: number }[]>);
  }
  const variants = [...(index.get(groupKey(reference.title, reference.year)) ?? [reference])];
  return variants.sort((a, b) => VARIANT_PRIORITY[titleVariant(a.title)] - VARIANT_PRIORITY[titleVariant(b.title)]);
}

/** `true` quando todas as chaves desta lista já estão em cache. */
export function titleKeysReady(titles: string[]): boolean {
  for (const title of titles) {
    if (!groupKeyCache.has(title)) return false;
  }
  return true;
}

/**
 * Calcula as chaves em lotes pequenos, devolvendo o controle à interface
 * entre eles. Em listas de dezenas de milhares de títulos isso evita
 * congelar toques e navegação enquanto o cache é preparado.
 */
export function warmTitleKeys(titles: string[], batchSize = 1200): { promise: Promise<void>; cancel: () => void } {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const promise = new Promise<void>((resolve) => {
    let index = 0;
    const step = () => {
      if (cancelled) return resolve();
      const end = Math.min(titles.length, index + batchSize);
      for (; index < end; index += 1) titleKey(titles[index]);
      if (index < titles.length) timer = setTimeout(step, 0);
      else resolve();
    };
    step();
  });
  return {
    promise,
    cancel: () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
  };
}

export function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}
