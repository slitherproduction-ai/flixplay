import type { ChannelItem, ServerProfile } from "@/store/types";

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface XtreamUserInfo {
  username: string;
  status: string;
  exp_date: string | null;
  max_connections: string;
  active_cons: string;
  allowed_output_formats: string[];
}

export interface XtreamAuthResponse {
  user_info: XtreamUserInfo;
  server_info: {
    url: string;
    port: string;
    https_port: string;
    server_protocol: string;
    timestamp_now: number;
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

function buildApiUrl(profile: ServerProfile, action?: string, params: Record<string, string> = {}) {
  const base = profile.serverUrl.replace(/\/$/, "");
  const query = new URLSearchParams({ username: profile.username, password: profile.password, ...params });
  if (action) query.set("action", action);
  return `${base}/player_api.php?${query.toString()}`;
}

async function requestXtream<T>(profile: ServerProfile, action?: string, params: Record<string, string> = {}): Promise<T> {
  try {
    const response = await fetch(buildApiUrl(profile, action, params));
    if (!response.ok) {
      throw new XtreamApiError(`Servidor respondeu com status ${response.status}.`, response.status);
    }
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body) {
      const message = typeof body.error === "string" ? body.error : "O servidor rejeitou a solicitação.";
      throw new XtreamApiError(message, response.status);
    }
    return body as T;
  } catch (requestError) {
    console.error("Falha na requisição Xtream Codes", requestError);
    if (requestError instanceof XtreamApiError) throw requestError;
    throw new XtreamApiError("Não foi possível alcançar o servidor Xtream Codes.");
  }
}

export const authenticateXtream = (profile: ServerProfile) => requestXtream<XtreamAuthResponse>(profile);

export const getLiveCategories = (profile: ServerProfile) => requestXtream<XtreamCategory[]>(profile, "get_live_categories");

export const getLiveStreams = (profile: ServerProfile, categoryId?: string) =>
  requestXtream<XtreamLiveStream[]>(profile, "get_live_streams", categoryId ? { category_id: categoryId } : {});

export const getVodCategories = (profile: ServerProfile) => requestXtream<XtreamCategory[]>(profile, "get_vod_categories");

export const getVodStreams = (profile: ServerProfile, categoryId?: string) =>
  requestXtream<XtreamVodStream[]>(profile, "get_vod_streams", categoryId ? { category_id: categoryId } : {});

export const getSeriesCategories = (profile: ServerProfile) => requestXtream<XtreamCategory[]>(profile, "get_series_categories");

export const getSeries = (profile: ServerProfile, categoryId?: string) =>
  requestXtream<XtreamSeriesStream[]>(profile, "get_series", categoryId ? { category_id: categoryId } : {});

export const getSeriesInfo = (profile: ServerProfile, seriesId: string) =>
  requestXtream<unknown>(profile, "get_series_info", { series_id: seriesId });

export const getShortEpg = (profile: ServerProfile, streamId: string, limit = 4) =>
  requestXtream<{ epg_listings: XtreamEpgItem[] }>(profile, "get_short_epg", { stream_id: streamId, limit: String(limit) });

export const getSimpleDataTable = (profile: ServerProfile, streamId: string) =>
  requestXtream<{ epg_listings: XtreamEpgItem[] }>(profile, "get_simple_data_table", { stream_id: streamId });

export function createStreamUrl(profile: ServerProfile, streamId: string, extension = "m3u8") {
  const base = profile.serverUrl.replace(/\/$/, "");
  return `${base}/live/${encodeURIComponent(profile.username)}/${encodeURIComponent(profile.password)}/${encodeURIComponent(streamId)}.${extension}`;
}

export function parseM3uPlaylist(text: string): M3uEntry[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const entries: M3uEntry[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const metadata = lines[index];
    if (!metadata.startsWith("#EXTINF")) continue;
    const url = lines[index + 1];
    if (!url || url.startsWith("#")) continue;
    const title = metadata.split(",").slice(1).join(",").trim() || "Canal sem nome";
    const group = metadata.match(/group-title="([^"]*)"/)?.[1] ?? "Geral";
    const logo = metadata.match(/tvg-logo="([^"]*)"/)?.[1] ?? "";
    const id = metadata.match(/tvg-id="([^"]*)"/)?.[1] ?? `m3u-${entries.length + 1}`;
    entries.push({ id, name: title, logo, group, url });
    index += 1;
  }
  return entries;
}

export function mapLiveStreamToChannel(stream: XtreamLiveStream, category: XtreamCategory, profile: ServerProfile): ChannelItem {
  return {
    id: `channel-${stream.stream_id}`,
    name: stream.name,
    number: String(stream.stream_id),
    streamId: String(stream.stream_id),
    logo: stream.stream_icon,
    categoryId: category.category_id,
    categoryName: category.category_name,
    currentEpg: { title: "Programação ao vivo", start: "Agora", end: "Em breve", progress: 45 },
    nextProgram: "Próximo programa",
    streamUrl: stream.direct_source || createStreamUrl(profile, String(stream.stream_id)),
  };
}
