import type { ChannelItem, ServerProfile } from "@/store/types";

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

  constructor(message: string, status = 0) {
    super(message);
    this.name = "XtreamApiError";
    this.status = status;
  }
}

/** Timeout in ms before aborting the request */
const REQUEST_TIMEOUT_MS = 15000;

/**
 * User-Agent widely accepted by IPTV servers.
 * Many providers block generic browser / Expo UA strings.
 */
const XTREAM_HEADERS: Record<string, string> = {
  "User-Agent": "IPTVSmartersPro/3.1.5",
  Accept: "application/json, text/plain, */*",
};

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

/** Parse raw fetch Response into a typed body, throwing XtreamApiError on any anomaly. */
async function parseXtreamResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const denied = response.status === 401 || response.status === 403;
    const msg = denied
      ? `Acesso negado pelo servidor (HTTP ${response.status}). Usuário ou senha incorretos.`
      : `Servidor respondeu com status ${response.status}.`;
    throw new XtreamApiError(msg, response.status);
  }

  // Read raw text — some servers prepend a BOM or extra whitespace
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

/** Map a low-level fetch/network error to a user-friendly XtreamApiError. */
function mapFetchError(err: unknown): never {
  if (err instanceof XtreamApiError) throw err;

  if (err instanceof Error) {
    if (err.name === "AbortError") {
      throw new XtreamApiError(
        "Host não respondeu (Timeout após 15s). Verifique a URL e sua conexão.",
        0,
      );
    }
    const lc = err.message.toLowerCase();
    if (
      lc.includes("network request failed") ||
      lc.includes("network") ||
      lc.includes("failed to fetch")
    ) {
      throw new XtreamApiError(
        "Erro de rede. Verifique se o servidor aceita conexões HTTP e sua internet está funcionando.",
        0,
      );
    }
  }

  throw new XtreamApiError("Não foi possível alcançar o servidor Xtream Codes.", 0);
}

async function requestXtream<T>(
  profile: ServerProfile,
  action?: string,
  params: Record<string, string> = {},
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = buildApiUrl(profile, action, params);
    const response = await fetch(url, {
      headers: XTREAM_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return await parseXtreamResponse<T>(response);
  } catch (requestError) {
    clearTimeout(timeoutId);
    console.error("Falha na requisição Xtream Codes", requestError);
    mapFetchError(requestError);
  }
}

export const authenticateXtream = (profile: ServerProfile) =>
  requestXtream<XtreamAuthResponse>(profile);

export const getLiveCategories = (profile: ServerProfile) =>
  requestXtream<XtreamCategory[]>(profile, "get_live_categories");

export const getLiveStreams = (
  profile: ServerProfile,
  categoryId?: string,
) =>
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
    const group =
      metadata.match(/group-title="([^"]*)"/)?.[1] ?? "Geral";
    const logo =
      metadata.match(/tvg-logo="([^"]*)"/)?.[1] ?? "";
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
