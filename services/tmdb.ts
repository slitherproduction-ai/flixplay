import AsyncStorage from "@react-native-async-storage/async-storage";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const CACHE_PREFIX = "elvanoq_tmdb_v1_";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type TmdbMetadata = {
  rating: number | null;
  genres: string[];
  synopsis: string | null;
  cast: { name: string; character: string; photo: string | null }[];
  trailerUrl: string | null;
  source: "TMDB";
};

type CacheEntry = { expiresAt: number; metadata: TmdbMetadata };

function cleanTitle(title: string) {
  return title
    .replace(/\[.*?\]/g, "")
    .replace(/\((?:19|20)\d{2}\)/g, "")
    .replace(/\b(FHD|4K|UHD|HD|HQ|SDR|HDR10?|HEVC|H\.?265|H\.?264|DUBLAD[OA]?|DUB|LEGENDAD[OA]?|LEG|DUAL|NACIONAL|MULTI|COMPLETO?|TEMPORADA|SEASON)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readAccessToken() {
  return process.env.EXPO_PUBLIC_TMDB_ACCESS_TOKEN?.trim() ?? "";
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

function cacheKey(title: string, mediaType: "movie" | "tv") {
  return `${CACHE_PREFIX}${mediaType}_${cleanTitle(title).toLocaleLowerCase("pt-BR")}`;
}

function trailerUrl(videos: unknown) {
  const items = Array.isArray((videos as { results?: unknown[] })?.results)
    ? (videos as { results: Record<string, unknown>[] }).results
    : [];
  const video = items.find((item) => item.site === "YouTube" && item.type === "Trailer")
    ?? items.find((item) => item.site === "YouTube");
  return typeof video?.key === "string" ? `https://www.youtube.com/watch?v=${video.key}` : null;
}

function toMetadata(detail: Record<string, unknown>): TmdbMetadata {
  const credits = detail.credits as { cast?: Record<string, unknown>[] } | undefined;
  const cast = Array.isArray(credits?.cast) ? credits.cast.slice(0, 8).flatMap((person) => {
    if (typeof person.name !== "string") return [];
    return [{
      name: person.name,
      character: typeof person.character === "string" ? person.character : "",
      photo: typeof person.profile_path === "string" ? `https://image.tmdb.org/t/p/w185${person.profile_path}` : null,
    }];
  }) : [];
  const genres = Array.isArray(detail.genres)
    ? detail.genres.flatMap((genre) => typeof (genre as { name?: unknown }).name === "string" ? [(genre as { name: string }).name] : [])
    : [];
  const rating = typeof detail.vote_average === "number" && detail.vote_average > 0
    ? detail.vote_average
    : null;
  const overview = typeof detail.overview === "string" && detail.overview.trim().length > 0
    ? detail.overview.trim()
    : null;
  return { rating, genres, synopsis: overview, cast, trailerUrl: trailerUrl(detail.videos), source: "TMDB" };
}

/** Enriches the IPTV catalogue only when TMDB is configured; failures stay silent to the UI. */
export async function fetchTmdbMetadata(title: string, mediaType: "movie" | "tv"): Promise<TmdbMetadata | null> {
  if (!isTmdbConfigured() || !cleanTitle(title)) return null;
  const key = cacheKey(title, mediaType);
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) {
      const entry = JSON.parse(cached) as CacheEntry;
      if (entry.expiresAt > Date.now()) return entry.metadata;
    }
  } catch { /* cache is optional */ }

  try {
    const query = encodeURIComponent(cleanTitle(title));
    const search = await tmdbFetch(`/search/${mediaType}?query=${query}&language=pt-BR&include_adult=false`);
    const results = Array.isArray(search.results) ? search.results as Record<string, unknown>[] : [];
    const match = results.find((item) => item.id && (
      String(item.title ?? item.name ?? "").localeCompare(cleanTitle(title), "pt-BR", { sensitivity: "base" }) === 0
    )) ?? results[0];
    if (!match?.id) return null;
    const detail = await tmdbFetch(`/${mediaType}/${match.id}?language=pt-BR&append_to_response=credits,videos`);
    const metadata = toMetadata(detail);
    try {
      await AsyncStorage.setItem(key, JSON.stringify({ expiresAt: Date.now() + CACHE_TTL_MS, metadata } satisfies CacheEntry));
    } catch { /* cache is optional */ }
    return metadata;
  } catch {
    return null;
  }
}
