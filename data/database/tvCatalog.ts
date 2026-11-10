import { catalogDatabase } from "./catalogDatabase";
import { createVodUrl } from "@/services/xtream";
import { useAppStore } from "@/store/useAppStore";
import type { SeriesItem, ServerProfile, VodMovie } from "@/store/types";

export type VideoKind = "vodMovies" | "seriesList";
export type VideoItem = VodMovie | SeriesItem;

export function hydrateVideo<T extends VideoItem>(profile: ServerProfile, item: T): T {
  return "streamId" in item
    ? { ...item, streamUrl: createVodUrl(profile, item.streamId, item.containerExtension ?? "mp4") }
    : item;
}

// A Home precisa apenas das recomendações e dos itens pessoais deste servidor.
export async function homeVideos<T extends VideoItem>(profile: ServerProfile, kind: VideoKind): Promise<T[]> {
  const { favoriteMovieIds, favoriteSeriesIds, history } = useAppStore.getState();
  const ids = new Set(kind === "vodMovies" ? favoriteMovieIds : favoriteSeriesIds);
  for (const entry of history) {
    if (entry.serverId && entry.serverId !== profile.id) continue;
    if (kind === "vodMovies" && entry.type === "movie") ids.add(entry.contentId);
    if (kind === "seriesList" && entry.seriesId) {
      ids.add(entry.seriesId);
      ids.add(`series-${entry.seriesId}`);
    }
  }
  const rows = await catalogDatabase.tvPage<T>(profile.id, kind, { sort: "added_desc" }, 0, 48);
  rows.push(...await catalogDatabase.tvPage<T>(profile.id, kind, { sort: "rating_desc" }, 0, 24));
  const personal = [...ids];
  for (let i = 0; i < personal.length; i += 200) {
    rows.push(...await catalogDatabase.tvPage<T>(profile.id, kind, { ids: personal.slice(i, i + 200) }, 0, 200));
  }
  return [...new Map(rows.map(row => [row.id, hydrateVideo(profile, row)])).values()];
}
