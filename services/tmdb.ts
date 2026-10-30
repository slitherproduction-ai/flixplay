import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
// v2: inclui imagens, data, recomendações e o grau de confiança da correspondência.
const CACHE_PREFIX = "elvanoq_tmdb_v2_";
const PERSON_CACHE_PREFIX = "elvanoq_tmdb_person_v1_";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type TmdbMetadata = {
  rating: number | null;
  genres: string[];
  synopsis: string | null;
  cast: { name: string; character: string; photo: string | null }[];
  trailerUrl: string | null;
  source: "TMDB";
  /**
   * Campos alinhados ao ELVANOQ Play para Roku. Opcionais para manter
   * compatibilidade com consumidores existentes.
   */
  tmdbId?: number;
  title?: string | null;
  releaseDate?: string | null;
  /** Pôster w780, como no Roku. */
  posterUrl?: string | null;
  /** Fundo w1280, como no Roku. */
  backdropUrl?: string | null;
  /** Títulos recomendados pelo TMDB ("Mais como este"). */
  recommendations?: string[];
  /**
   * `true` quando o título (e o ano, se informado) confere com o da lista.
   * Só nesse caso título e imagens do TMDB substituem os da lista, evitando
   * exibir a arte de outra obra com nome parecido.
   */
  confidentMatch?: boolean;
};

export type TmdbPersonFilmography = {
  person: string;
  titles: string[];
};

type CacheEntry = { expiresAt: number; metadata: TmdbMetadata };
type PersonCacheEntry = { expiresAt: number; result: TmdbPersonFilmography | null };

/** Remove marcações de lista IPTV (qualidade, idioma, ano) do título. */
export function cleanCatalogTitle(title: string) {
  return title
    .replace(/\[.*?\]/g, "")
    .replace(/\((?:19|20)\d{2}\)/g, "")
    .replace(/\b(FHD|4K|UHD|HD|HQ|SDR|HDR10?|HEVC|H\.?265|H\.?264|DUBLAD[OA]?|DUB|LEGENDAD[OA]?|LEG|DUAL|NACIONAL|MULTI|COMPLETO?|TEMPORADA|SEASON)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Chave de comparação: sem marcações, acentos, pontuação ou caixa. */
export function normalizeCatalogTitle(title: string) {
  return cleanCatalogTitle(title)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function readAccessToken() {
  // EXPO_PUBLIC values are available to Metro during development, while a
  // standalone Android build reads the same value from Expo's resolved config.
  // Keeping both paths makes TMDB work in preview, release and local builds.
  const fromEnvironment = process.env.EXPO_PUBLIC_TMDB_ACCESS_TOKEN?.trim();
  const fromConfig = Constants.expoConfig?.extra?.tmdbAccessToken;
  return fromEnvironment || (typeof fromConfig === "string" ? fromConfig.trim() : "");
}

export function isTmdbConfigured() {
  return readAccessToken().length > 20;
}

async function tmdbFetch(path: string) {
  const token = readAccessToken();
  if (!token) throw new Error("TMDB não configurado.");
  const response = await fetch(`${TMDB_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    signal: AbortSignal.timeout(9_000),
  });
  if (!response.ok) throw new Error(`TMDB respondeu ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

function cacheKey(title: string, mediaType: "movie" | "tv", year?: number) {
  const suffix = year && year > 0 ? `_${year}` : "";
  return `${CACHE_PREFIX}${mediaType}_${normalizeCatalogTitle(title)}${suffix}`;
}

function imageUrl(path: unknown, size: "w780" | "w1280") {
  return typeof path === "string" && path.startsWith("/") ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : null;
}

function trailerUrl(videos: unknown) {
  const items = Array.isArray((videos as { results?: unknown[] })?.results)
    ? (videos as { results: Record<string, unknown>[] }).results
    : [];
  const video = items.find((item) => item.site === "YouTube" && item.type === "Trailer")
    ?? items.find((item) => item.site === "YouTube");
  // Como no Roku, só endereços HTTPS são aceitos para o trailer.
  return typeof video?.key === "string" ? `https://www.youtube.com/watch?v=${video.key}` : null;
}

function yearOf(value: unknown): number {
  if (typeof value !== "string" || value.length < 4) return 0;
  const year = Number(value.slice(0, 4));
  return Number.isFinite(year) ? year : 0;
}

function toMetadata(detail: Record<string, unknown>, confidentMatch: boolean): TmdbMetadata {
  const credits = detail.credits as { cast?: Record<string, unknown>[] } | undefined;
  const cast = Array.isArray(credits?.cast) ? credits.cast.slice(0, 8).flatMap((person) => {
    if (typeof person.name !== "string") return [];
    return [{
      name: person.name,
      character: typeof person.character === "string" ? person.character : "",
      photo: typeof person.profile_path === "string" ? `https://image.tmdb.org/t/p/w185${person.profile_path}` : null,
    }];
  }) : [];
  // Roku exibe até quatro gêneros.
  const genres = Array.isArray(detail.genres)
    ? detail.genres.flatMap((genre) => typeof (genre as { name?: unknown }).name === "string" ? [(genre as { name: string }).name] : []).slice(0, 4)
    : [];
  const rating = typeof detail.vote_average === "number" && detail.vote_average > 0
    ? Math.round(detail.vote_average * 10) / 10
    : null;
  const overview = typeof detail.overview === "string" && detail.overview.trim().length > 0
    ? detail.overview.trim()
    : null;
  const recommendationsSource = (detail.recommendations as { results?: Record<string, unknown>[] } | undefined)?.results;
  const recommendations = Array.isArray(recommendationsSource)
    ? recommendationsSource.flatMap((item) => {
      const name = item.title ?? item.name;
      return typeof name === "string" && name.trim() ? [name.trim()] : [];
    }).slice(0, 20)
    : [];
  const title = detail.title ?? detail.name;
  const releaseDate = detail.release_date ?? detail.first_air_date;
  return {
    rating,
    genres,
    synopsis: overview,
    cast,
    trailerUrl: trailerUrl(detail.videos),
    source: "TMDB",
    tmdbId: typeof detail.id === "number" ? detail.id : undefined,
    title: typeof title === "string" ? title : null,
    releaseDate: typeof releaseDate === "string" && releaseDate ? releaseDate : null,
    posterUrl: imageUrl(detail.poster_path, "w780"),
    backdropUrl: imageUrl(detail.backdrop_path, "w1280"),
    recommendations,
    confidentMatch,
  };
}

function pickMatch(results: Record<string, unknown>[], title: string, year?: number) {
  const wanted = normalizeCatalogTitle(title);
  const scored = results
    .filter((item) => typeof item.id === "number")
    .map((item, index) => {
      const names = [item.title, item.name, item.original_title, item.original_name]
        .filter((name): name is string => typeof name === "string")
        .map(normalizeCatalogTitle);
      const titleMatches = names.includes(wanted);
      const itemYear = yearOf(item.release_date ?? item.first_air_date);
      const yearMatches = Boolean(year && year > 0 && itemYear > 0 && Math.abs(itemYear - year) <= 1);
      // Título + ano > título > ano > ordem de relevância do TMDB.
      const score = (titleMatches ? 2 : 0) + (yearMatches ? 1 : 0);
      return { item, index, score, confident: titleMatches && (yearMatches || !year || itemYear === 0) };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return scored[0] ?? null;
}

/** Enriches the IPTV catalogue only when TMDB is configured; failures stay silent to the UI. */
export async function fetchTmdbMetadata(title: string, mediaType: "movie" | "tv", year?: number): Promise<TmdbMetadata | null> {
  if (!isTmdbConfigured() || !cleanCatalogTitle(title)) return null;
  const key = cacheKey(title, mediaType, year);
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) {
      const entry = JSON.parse(cached) as CacheEntry;
      if (entry.expiresAt > Date.now()) return entry.metadata;
    }
  } catch { /* cache is optional */ }

  try {
    const query = encodeURIComponent(cleanCatalogTitle(title));
    const search = await tmdbFetch(`/search/${mediaType}?query=${query}&language=pt-BR&include_adult=false`);
    const results = Array.isArray(search.results) ? search.results as Record<string, unknown>[] : [];
    const match = pickMatch(results, title, year);
    if (!match) return null;
    const detail = await tmdbFetch(`/${mediaType}/${match.item.id}?language=pt-BR&append_to_response=credits,videos,recommendations`);
    const metadata = toMetadata(detail, match.confident);
    try {
      await AsyncStorage.setItem(key, JSON.stringify({ expiresAt: Date.now() + CACHE_TTL_MS, metadata } satisfies CacheEntry));
    } catch { /* cache is optional */ }
    return metadata;
  } catch {
    return null;
  }
}

/**
 * Busca por ator, como "Buscar título ou ator" do Roku: quando o texto
 * corresponde a uma pessoa do TMDB, devolve os títulos da filmografia (em
 * português e no idioma original) para serem localizados na lista.
 */
export async function fetchTmdbPersonFilmography(query: string, mediaType: "movie" | "tv"): Promise<TmdbPersonFilmography | null> {
  const term = query.trim();
  if (!isTmdbConfigured() || term.length < 3) return null;
  const key = `${PERSON_CACHE_PREFIX}${mediaType}_${normalizeCatalogTitle(term)}`;
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) {
      const entry = JSON.parse(cached) as PersonCacheEntry;
      if (entry.expiresAt > Date.now()) return entry.result;
    }
  } catch { /* cache is optional */ }

  try {
    const search = await tmdbFetch(`/search/person?query=${encodeURIComponent(term)}&language=pt-BR&include_adult=false`);
    const people = Array.isArray(search.results) ? search.results as Record<string, unknown>[] : [];
    const wanted = normalizeCatalogTitle(term);
    // Só considera ator quando o nome confere; títulos comuns seguem pela busca normal.
    const person = people.find((item) => typeof item.name === "string" && normalizeCatalogTitle(item.name) === wanted)
      ?? people.find((item) => typeof item.name === "string" && normalizeCatalogTitle(item.name).startsWith(wanted) && Number(item.popularity ?? 0) >= 5);
    let result: TmdbPersonFilmography | null = null;
    if (person && typeof person.id === "number" && typeof person.name === "string") {
      const credits = await tmdbFetch(`/person/${person.id}/${mediaType === "movie" ? "movie_credits" : "tv_credits"}?language=pt-BR`);
      const cast = Array.isArray(credits.cast) ? credits.cast as Record<string, unknown>[] : [];
      const titles = new Set<string>();
      for (const entry of cast) {
        for (const name of [entry.title, entry.name, entry.original_title, entry.original_name]) {
          if (typeof name === "string" && name.trim()) titles.add(name.trim());
        }
      }
      result = { person: person.name, titles: [...titles] };
    }
    try {
      await AsyncStorage.setItem(key, JSON.stringify({ expiresAt: Date.now() + CACHE_TTL_MS, result } satisfies PersonCacheEntry));
    } catch { /* cache is optional */ }
    return result;
  } catch {
    return null;
  }
}
