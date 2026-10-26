import { readIntroEndSeconds } from "@/features/player/EpisodeAutomation";
import { createSeriesEpisodeUrl } from "@/services/xtream";
import type { ServerProfile } from "@/store/types";

export type SeriesEpisodeNavigation = {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  streamUrl: string;
  introEndSeconds: number | null;
};

type XtreamEpisodeNavigationRaw = {
  id?: string | number;
  episode_num?: string | number;
  title?: string;
  container_extension?: string;
  info?: { intro_end_seconds?: string | number; introEndSeconds?: string | number };
};

/** Builds deterministic previous/next navigation from Xtream's season payload. */
export function parseSeriesEpisodeNavigation(
  raw: unknown,
  seriesId: string,
  profile: ServerProfile,
): SeriesEpisodeNavigation[] {
  if (!raw || typeof raw !== "object") return [];
  const episodes = (raw as { episodes?: Record<string, XtreamEpisodeNavigationRaw[]> | XtreamEpisodeNavigationRaw[] }).episodes;
  if (!episodes) return [];
  const build = (episode: XtreamEpisodeNavigationRaw, seasonNumber: number): SeriesEpisodeNavigation | null => {
    const streamId = String(episode.id ?? "");
    if (!streamId) return null;
    const episodeNumber = Number(episode.episode_num ?? 0);
    return {
      id: `ep-${seriesId}-s${seasonNumber}-e${episodeNumber}`,
      seasonNumber,
      episodeNumber,
      title: episode.title ?? `Episódio ${episodeNumber}`,
      streamUrl: createSeriesEpisodeUrl(profile, streamId, episode.container_extension ?? "mp4"),
      introEndSeconds: readIntroEndSeconds(episode.info),
    };
  };
  const source = Array.isArray(episodes)
    ? [["1", episodes] as const]
    : Object.entries(episodes).sort(([a], [b]) => Number(a) - Number(b));
  return source.flatMap(([season, entries]) =>
    entries.map((episode) => build(episode, Number(season))).filter((episode): episode is SeriesEpisodeNavigation => episode !== null),
  );
}
