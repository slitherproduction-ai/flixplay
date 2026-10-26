import { readIntroEndSeconds } from "@/features/player/EpisodeAutomation";
import { createSeriesEpisodeUrl } from "@/services/xtream";
import type { EpisodeItem, ServerProfile } from "@/store/types";

type XtreamEpisodeRaw = {
  id?: string | number;
  episode_num?: number | string;
  title?: string;
  container_extension?: string;
  info?: {
    duration_secs?: number;
    duration?: string;
    plot?: string;
    movie_image?: string;
    intro_end_seconds?: string | number;
    introEndSeconds?: string | number;
  };
};

type XtreamSeriesInfoResponse = {
  episodes?: Record<string, XtreamEpisodeRaw[]> | XtreamEpisodeRaw[];
};

/** Normalizes Xtream's array or season-keyed episode payload for the details UI. */
export function parseSeriesEpisodes(
  raw: unknown,
  seriesId: string,
  profile: Pick<ServerProfile, "serverUrl" | "username" | "password">,
): { episodes: EpisodeItem[]; seasonsCount: number } {
  if (!raw || typeof raw !== "object") return { episodes: [], seasonsCount: 1 };
  const episodesRaw = (raw as XtreamSeriesInfoResponse).episodes;
  if (!episodesRaw) return { episodes: [], seasonsCount: 1 };

  const buildEpisode = (episode: XtreamEpisodeRaw, seasonNumber: number): EpisodeItem => {
    const streamId = String(episode.id ?? "");
    const extension = episode.container_extension ?? "mp4";
    const durationSeconds = episode.info?.duration_secs ?? 0;
    const minutes = Math.floor(durationSeconds / 60);
    return {
      id: `ep-${seriesId}-s${seasonNumber}-e${episode.episode_num ?? 0}`,
      seriesId,
      seasonNumber,
      episodeNumber: Number(episode.episode_num ?? 0),
      title: episode.title ?? `Episódio ${episode.episode_num ?? ""}`,
      thumbnail: episode.info?.movie_image ?? "",
      duration: minutes > 0 ? `${minutes}min` : episode.info?.duration ?? "N/A",
      plot: episode.info?.plot ?? "",
      introEndSeconds: readIntroEndSeconds(episode.info),
      streamUrl: streamId
        ? createSeriesEpisodeUrl(profile, streamId, extension)
        : "",
    };
  };

  if (Array.isArray(episodesRaw)) {
    return { episodes: episodesRaw.map((episode) => buildEpisode(episode, 1)), seasonsCount: 1 };
  }

  const seasonKeys = Object.keys(episodesRaw).sort((a, b) => Number(a) - Number(b));
  const episodes = seasonKeys.flatMap((season) => {
    const entries = episodesRaw[season];
    return Array.isArray(entries) ? entries.map((episode) => buildEpisode(episode, Number(season))) : [];
  });
  return { episodes, seasonsCount: seasonKeys.length || 1 };
}
