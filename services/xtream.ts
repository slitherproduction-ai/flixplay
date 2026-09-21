import { Platform } from "react-native";
import type { ChannelItem, SeriesItem, ServerProfile, VodMovie } from "@/store/types";

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface XtreamUserInfo {
  username?: string;
  password?: string;
  /** 1 / "1" / true = authenticated, 0 / "0" / false = rejected */
  auth?: number | string | boolean;
  status?: string;
  exp_date?: string | null;
  max_connections?: string;
  active_cons?: string;
  allowed_output_formats?: string[];
}

export interface XtreamAuthResponse {
  user_info: XtreamUserInfo | null;
  server_info?: {
    url?: string;
    port?: string;
    https_port?: string;
    server_protocol?: string;
    timestamp_now?: number;
  };
}

export interface XtreamLiveStream {
  stream_id: number;
  name: string;
  stream_icon: string;
  epg_channel_id?: string;
  category_id: string;
  tv_archive: number;
  direct_source?: string;
}

export interface XtreamVodStream {
  stream_id: number;
  name: string;
  stream_icon: string;
  rating: string;
  added: string;
  category_id: string;
  container_extension: string;
  plot?: string;
  year?: string;
}

export interface XtreamSeriesStream {
  series_id: number;
  name: string;
  cover: string;
  plot?: string;
  cast?: string;
  rating: string;
  releaseDate?: string;
  category_id: string;
}

export interface XtreamEpgItem {
  id: string;
  title: string;
  start: string;
  end: string;
  start_timestamp: string;
  stop_timestamp: string;
  description?: string;
}

export interface M3uEntry {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
}

export class XtreamApiError extends Error {
  status: number;
  /** Base server URL that was tested — used by the login screen for diagnostics. */
  testedUrl?: string;

  constructor(message: string, status = 0, testedUrl?: string) {
    super(message);
    this.name = "XtreamApiError";
    this.status = status;
    this.testedUrl = testedUrl;
  }
}

/** Total timeout per individual fetch attempt */
const REQUEST_TIMEOUT_MS = 15000;
/** Shorter timeout for CORS proxy attempts (already a fallback) */
const PROXY_TIMEOUT_MS = 10000;

/**
 * User-Agent widely accepted by IPTV servers.
 * Many providers block generic browser / Expo UA strings.
 */
const XTREAM_HEADERS: Record<string, string> = {
  "User-Agent": "IPTVSmartersPro/3.1.5",
  Accept: "application/json, text/plain, */*",
};

/**
 * Public CORS proxies used as fallback on the web preview.
 * On the web, browsers running under HTTPS block plain-HTTP IPTV requests
 * (Mixed Content) and enforce same-origin policy (CORS). These proxies relay
 * the request from an HTTPS origin so the browser accepts the response.
 */
const CORS_PROXIES = [
  "https://corsproxy.io/?url=",
  "https://api.allorigins.win/raw?url=",
] as const;

function buildApiUrl(
  profile: ServerProfile,
  action?: string,
  params: Record<string, string> = {},
) {
  const base = profile.serverUrl.replace(/\/+$/, "");
  const query = new URLSearchParams({
    username: profile.username,
    password: profile.password,
    ...params,
  });
  if (action) query.set("action", action);
  return `${base}/player_api.php?${query.toString()}`;
}

/** Fetch with an independent AbortController timeout so retries get a fresh clock. */
async function timedFetch(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: XTREAM_HEADERS, signal: ctrl.signal });
    clearTimeout(tid);
    return res;
  } catch (err) {
    clearTimeout(tid);
    throw err;
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

/**
 * Web strategy: direct attempt first, then CORS proxy chain.
 * Timeout on the direct attempt means the server is genuinely unreachable —
 * no point routing through a proxy in that case.
 */
async function fetchWebWithProxies(url: string): Promise<Response> {
  try {
    return await timedFetch(url, REQUEST_TIMEOUT_MS);
  } catch (directErr) {
    if (isAbortError(directErr)) {
      throw new XtreamApiError(
        "Host não respondeu (Timeout após 15s). Verifique a URL e sua conexão.",
        0,
      );
    }
  }

  // Direct failed (likely CORS / Mixed Content) — try proxies
  for (const proxy of CORS_PROXIES) {
    try {
      const proxyUrl = `${proxy}${encodeURIComponent(url)}`;
      const res = await timedFetch(proxyUrl, PROXY_TIMEOUT_MS);
      if (res.status < 500) return res;
    } catch {
      // try next proxy
    }
  }

  throw new XtreamApiError(
    "Conexão bloqueada pelo navegador (CORS / Mixed Content). " +
      "Tente HTTPS no campo Host, ou use o aplicativo nativo para conexões HTTP.",
    0,
  );
}

/** Returns true when the error message indicates Android cleartext-HTTP blocking. */
function isCleartextBlockError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  return msg.includes("cleartext") || msg.includes("not permitted by network security");
}

/**
 * Native strategy: direct first, then swap protocol (http↔https) once.
 * Timeout on first attempt = server unreachable, no swap.
 * Specific cleartext blocking errors are surfaced with actionable messages.
 */
async function fetchNativeWithProtocolSwap(url: string): Promise<Response> {
  try {
    return await timedFetch(url, REQUEST_TIMEOUT_MS);
  } catch (firstErr) {
    if (isAbortError(firstErr)) {
      throw new XtreamApiError(
        "Host não respondeu (Timeout após 15s). Verifique a URL e sua conexão.",
        0,
      );
    }
    if (firstErr instanceof XtreamApiError) throw firstErr;
    if (isCleartextBlockError(firstErr)) {
      throw new XtreamApiError(
        "Tráfego HTTP bloqueado pela política de segurança do dispositivo. " +
          "Reconstrua o app para aplicar a nova configuração de rede HTTP.",
        0,
        url.replace(/\/player_api\.php.*$/, ""),
      );
    }
  }

  const altUrl = url.startsWith("https://")
    ? url.replace("https://", "http://")
    : url.replace("http://", "https://");

  try {
    return await timedFetch(altUrl, REQUEST_TIMEOUT_MS);
  } catch (altErr) {
    if (isAbortError(altErr)) {
      throw new XtreamApiError(
        "Host não respondeu (Timeout após 15s). Verifique a URL e sua conexão.",
        0,
      );
    }
    if (altErr instanceof XtreamApiError) throw altErr;
    if (isCleartextBlockError(altErr)) {
      throw new XtreamApiError(
        "Tráfego HTTP bloqueado. Reconstrua o app para aplicar a nova configuração de rede.",
        0,
      );
    }
    throw new XtreamApiError("Não foi possível alcançar o servidor Xtream Codes.", 0);
  }
}

function fetchWithFallbacks(url: string): Promise<Response> {
  return Platform.OS === "web"
    ? fetchWebWithProxies(url)
    : fetchNativeWithProtocolSwap(url);
}

/** Parse raw fetch Response into a typed body, throwing XtreamApiError on any anomaly. */
async function parseXtreamResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const denied = response.status === 401 || response.status === 403;
    const msg = denied
      ? `Acesso negado pelo servidor (HTTP ${response.status}). Usuário ou senha incorretos.`
      : `Servidor respondeu com status ${response.status}.`;
    throw new XtreamApiError(msg, response.status);
  }

  // Read raw text first — some servers prepend a BOM or extra whitespace
  const text = await response.text();
  const cleanText = text.replace(/^﻿/, "").trim();

  if (!cleanText) {
    throw new XtreamApiError("Servidor retornou resposta vazia.");
  }

  let body: unknown;
  try {
    body = JSON.parse(cleanText);
  } catch {
    throw new XtreamApiError(
      "Servidor retornou resposta inválida (não é JSON). Verifique o endereço do servidor.",
    );
  }

  if (body && typeof body === "object" && "error" in body) {
    const raw = (body as Record<string, unknown>).error;
    const message =
      typeof raw === "string" && raw.trim()
        ? raw.trim()
        : "O servidor rejeitou a solicitação.";
    throw new XtreamApiError(message, response.status);
  }

  return body as T;
}

/** Safety net: re-map any unhandled low-level error to XtreamApiError. */
function mapFetchError(err: unknown): never {
  if (err instanceof XtreamApiError) throw err;
  if (isAbortError(err)) {
    throw new XtreamApiError(
      "Host não respondeu (Timeout). Verifique a URL e sua conexão.",
      0,
    );
  }
  const msg =
    err instanceof Error ? err.message.toLowerCase() : "";
  if (
    msg.includes("network request failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("network")
  ) {
    throw new XtreamApiError(
      "Erro de rede. Verifique se o servidor aceita conexões HTTP e sua internet está funcionando.",
      0,
    );
  }
  throw new XtreamApiError("Não foi possível alcançar o servidor Xtream Codes.", 0);
}

async function requestXtream<T>(
  profile: ServerProfile,
  action?: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = buildApiUrl(profile, action, params);
  try {
    const response = await fetchWithFallbacks(url);
    return await parseXtreamResponse<T>(response);
  } catch (err) {
    console.error("Falha na requisição Xtream Codes", err);
    // Attach the clean base URL for diagnostics if not already set
    if (err instanceof XtreamApiError && !err.testedUrl) {
      err.testedUrl = profile.serverUrl;
    }
    mapFetchError(err);
  }
}

/**
 * Normalise auth responses from different Xtream Codes server variants:
 *  - Standard:  { user_info: { auth, username, … }, server_info: { … } }
 *  - Flat:      { auth: 1, username: "…", status: "Active", … }  (non-standard clones)
 *  - Array:     [{ auth: 1, username: "…" }]  (rare legacy format)
 */
function normalizeAuthResponse(raw: unknown): XtreamAuthResponse {
  if (!raw || typeof raw !== "object") return { user_info: null };

  // Standard wrapped format
  if ("user_info" in (raw as Record<string, unknown>)) {
    return raw as XtreamAuthResponse;
  }

  const obj = raw as Record<string, unknown>;

  // Flat format — auth/username/status at root level
  if ("auth" in obj || "username" in obj || "status" in obj) {
    return { user_info: obj as XtreamUserInfo };
  }

  // Array format
  if (Array.isArray(raw) && raw.length > 0 && raw[0] && typeof raw[0] === "object") {
    return { user_info: raw[0] as XtreamUserInfo };
  }

  return { user_info: null };
}

export async function authenticateXtream(profile: ServerProfile): Promise<XtreamAuthResponse> {
  const raw = await requestXtream<unknown>(profile);
  return normalizeAuthResponse(raw);
}

export const getLiveCategories = (profile: ServerProfile) =>
  requestXtream<XtreamCategory[]>(profile, "get_live_categories");

export const getLiveStreams = (profile: ServerProfile, categoryId?: string) =>
  requestXtream<XtreamLiveStream[]>(
    profile,
    "get_live_streams",
    categoryId ? { category_id: categoryId } : {},
  );

export const getVodCategories = (profile: ServerProfile) =>
  requestXtream<XtreamCategory[]>(profile, "get_vod_categories");

export const getVodStreams = (profile: ServerProfile, categoryId?: string) =>
  requestXtream<XtreamVodStream[]>(
    profile,
    "get_vod_streams",
    categoryId ? { category_id: categoryId } : {},
  );

export const getSeriesCategories = (profile: ServerProfile) =>
  requestXtream<XtreamCategory[]>(profile, "get_series_categories");

export const getSeries = (profile: ServerProfile, categoryId?: string) =>
  requestXtream<XtreamSeriesStream[]>(
    profile,
    "get_series",
    categoryId ? { category_id: categoryId } : {},
  );

export const getSeriesInfo = (profile: ServerProfile, seriesId: string) =>
  requestXtream<unknown>(profile, "get_series_info", { series_id: seriesId });

export const getShortEpg = (
  profile: ServerProfile,
  streamId: string,
  limit = 4,
) =>
  requestXtream<{ epg_listings: XtreamEpgItem[] }>(
    profile,
    "get_short_epg",
    { stream_id: streamId, limit: String(limit) },
  );

export const getSimpleDataTable = (
  profile: ServerProfile,
  streamId: string,
) =>
  requestXtream<{ epg_listings: XtreamEpgItem[] }>(
    profile,
    "get_simple_data_table",
    { stream_id: streamId },
  );

export function createStreamUrl(
  profile: ServerProfile,
  streamId: string,
  extension = "m3u8",
) {
  const base = profile.serverUrl.replace(/\/+$/, "");
  return `${base}/live/${encodeURIComponent(profile.username)}/${encodeURIComponent(profile.password)}/${encodeURIComponent(streamId)}.${extension}`;
}

export function createVodUrl(
  profile: ServerProfile,
  streamId: string,
  containerExtension = "mp4",
) {
  const base = profile.serverUrl.replace(/\/+$/, "");
  return `${base}/movie/${encodeURIComponent(profile.username)}/${encodeURIComponent(profile.password)}/${encodeURIComponent(streamId)}.${containerExtension}`;
}

export function createSeriesEpisodeUrl(
  profile: ServerProfile,
  streamId: string,
  containerExtension = "mp4",
) {
  const base = profile.serverUrl.replace(/\/+$/, "");
  return `${base}/series/${encodeURIComponent(profile.username)}/${encodeURIComponent(profile.password)}/${encodeURIComponent(streamId)}.${containerExtension}`;
}

export function mapVodStreamToMovie(
  stream: XtreamVodStream,
  category: XtreamCategory | undefined,
  profile: ServerProfile,
): VodMovie {
  const rating = parseFloat(stream.rating) || 0;
  const year = parseInt(stream.year ?? "0", 10) || new Date().getFullYear();
  return {
    id: `movie-${stream.stream_id}`,
    title: stream.name,
    streamId: String(stream.stream_id),
    poster: stream.stream_icon || "",
    backdrop: stream.stream_icon || "",
    rating: Math.min(10, Math.max(0, rating)),
    year,
    duration: "N/A",
    genre: category?.category_name ?? "Geral",
    plot: stream.plot ?? "",
    streamUrl: createVodUrl(profile, String(stream.stream_id), stream.container_extension || "mp4"),
    quality: "HD",
  };
}

export function mapSeriesStreamToItem(
  stream: XtreamSeriesStream,
  category: XtreamCategory | undefined,
): SeriesItem {
  const rating = parseFloat(stream.rating) || 0;
  const year = stream.releaseDate
    ? parseInt(stream.releaseDate.slice(0, 4), 10) || new Date().getFullYear()
    : new Date().getFullYear();
  return {
    id: `series-${stream.series_id}`,
    title: stream.name,
    seriesId: String(stream.series_id),
    poster: stream.cover || "",
    backdrop: stream.cover || "",
    rating: Math.min(10, Math.max(0, rating)),
    year,
    seasonsCount: 1,
    genre: category?.category_name ?? "Geral",
    plot: stream.plot ?? "",
  };
}

export function parseM3uPlaylist(text: string): M3uEntry[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const entries: M3uEntry[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const metadata = lines[index];
    if (!metadata.startsWith("#EXTINF")) continue;
    const url = lines[index + 1];
    if (!url || url.startsWith("#")) continue;
    const title =
      metadata.split(",").slice(1).join(",").trim() || "Canal sem nome";
    const group = metadata.match(/group-title="([^"]*)"/)?.[1] ?? "Geral";
    const logo = metadata.match(/tvg-logo="([^"]*)"/)?.[1] ?? "";
    const id =
      metadata.match(/tvg-id="([^"]*)"/)?.[1] ?? `m3u-${entries.length + 1}`;
    entries.push({ id, name: title, logo, group, url });
    index += 1;
  }
  return entries;
}

export function mapLiveStreamToChannel(
  stream: XtreamLiveStream,
  category: XtreamCategory,
  profile: ServerProfile,
): ChannelItem {
  return {
    id: `channel-${stream.stream_id}`,
    name: stream.name,
    number: String(stream.stream_id),
    streamId: String(stream.stream_id),
    logo: stream.stream_icon,
    categoryId: category.category_id,
    categoryName: category.category_name,
    currentEpg: {
      title: "Programação ao vivo",
      start: "Agora",
      end: "Em breve",
      progress: 45,
    },
    nextProgram: "Próximo programa",
    streamUrl:
      stream.direct_source ||
      createStreamUrl(profile, String(stream.stream_id)),
  };
}
