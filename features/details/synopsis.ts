import AsyncStorage from "@react-native-async-storage/async-storage";

const SYNOPSIS_CACHE_PREFIX = "flixplay_synopsis_v1_";

/** Remove tags de qualidade, idioma e ano antes da consulta externa. */
export function cleanTitleForSynopsisSearch(raw: string): string {
  return raw
    .replace(/\[.*?\]/g, "")
    .replace(/\((?:19|20)\d{2}\)/g, "")
    .replace(/\b(FHD|4K|UHD|HD|HQ|SDR|HDR10?|HEVC|H\.?265|H\.?264|DUBLAD[OA]?|DUB|LEGENDAD[OA]?|LEG|DUAL|NACIONAL|MULTI|COMPLETO?|TEMPORADA|SEASON)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchSynopsisFromWikipedia(title: string): Promise<string | null> {
  const encoded = encodeURIComponent(title);
  for (const locale of ["pt", "en"]) {
    try {
      const response = await fetch(`https://${locale}.wikipedia.org/api/rest_v1/page/summary/${encoded}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) continue;
      const data = await response.json() as { extract?: string; type?: string };
      if (data.type !== "disambiguation" && data.extract && data.extract.length > 40) return data.extract;
    } catch {
      // Tenta o próximo idioma ou mantém a sinopse original.
    }
  }
  return null;
}

/** Obtém a sinopse somente quando o provedor não entregou uma descrição útil. */
export async function loadOrFetchSynopsis(contentId: string, rawTitle: string, existingPlot: string): Promise<string | null> {
  const trimmed = existingPlot?.trim() ?? "";
  if (trimmed.length > 30 && trimmed.toLowerCase() !== "n/a") return null;

  const cacheKey = `${SYNOPSIS_CACHE_PREFIX}${contentId}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return cached;
  } catch {
    // Cache indisponível: a busca continua opcionalmente.
  }

  const title = cleanTitleForSynopsisSearch(rawTitle);
  if (!title) return null;
  const synopsis = await fetchSynopsisFromWikipedia(title);
  if (synopsis) {
    try { await AsyncStorage.setItem(cacheKey, synopsis); } catch { /* cache opcional */ }
  }
  return synopsis;
}
