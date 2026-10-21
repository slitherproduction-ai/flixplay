export interface Preferences {
  [key: string]: string | number | boolean | null;
}

export type ContentType = "live" | "movie" | "series" | "episode";

/** Catalogue sections supported by parental category protection. */
export type ParentalCategoryKind = "live" | "movies" | "series";
export type BlockedCategoryIds = Record<ParentalCategoryKind, string[]>;

export interface ServerProfile {
  id: string;
  name: string;
  serverUrl: string;
  username: string;
  password: string;
  isActive: boolean;
  expiryDate: string;
  maxConnections: number | null;
  activeConnections: number | null;
  format: "TS" | "HLS" | "M3U8" | null;
  status?: string | null;
  lastSyncedAt?: string | null;
  addedAt?: string;
  sourceType?: "xtream" | "m3u";
  m3uUrl?: string;
  xmltvUrl?: string;
}

export interface EpgProgram {
  title: string;
  start: string;
  end: string;
  progress: number;
  description?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  isCurrent?: boolean;
}

export interface ChannelItem {
  id: string;
  name: string;
  number: string;
  streamId: string;
  logo: string;
  categoryId: string;
  categoryName: string;
  epgChannelId?: string;
  currentEpg: EpgProgram;
  nextProgram: string;
  epgPrograms?: EpgProgram[];
  epgUpdatedAt?: string;
  /** Provider-declared archive window. Absent means Catch-up must stay unavailable. */
  catchupDays?: number;
  /** M3U catchup-source template. Kept in memory only; catalog persistence strips it. */
  catchupSource?: string;
  streamUrl: string;
}

export interface VodMovie {
  id: string;
  title: string;
  streamId: string;
  poster: string;
  backdrop: string;
  rating: number;
  year: number;
  duration: string;
  genre: string;
  categoryId: string;
  plot: string;
  streamUrl: string;
  /** Non-sensitive hint used to rebuild authenticated URLs only in memory. */
  containerExtension?: string;
  resumePositionMs?: number;
  quality?: "4K" | "FHD" | "HD";
  /** Xtream's `added` value, retained for truthful newest-first ordering. */
  addedAt?: string;
}

export interface SeriesItem {
  id: string;
  title: string;
  seriesId: string;
  poster: string;
  backdrop: string;
  rating: number;
  year: number;
  seasonsCount: number;
  genre: string;
  categoryId: string;
  plot: string;
}

export interface EpisodeItem {
  id: string;
  seriesId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  thumbnail: string;
  duration: string;
  plot: string;
  streamUrl: string;
  resumePositionMs?: number;
}

export interface ContentCache {
  liveCategories: { id: string; name: string }[];
  liveChannels: ChannelItem[];
  vodCategories: { id: string; name: string }[];
  vodMovies: VodMovie[];
  seriesCategories: { id: string; name: string }[];
  seriesList: SeriesItem[];
  lastSyncedAt: string | null;
}

export interface PlayHistory {
  /** Optional for legacy records; newly written items are always scoped. */
  serverId?: string;
  contentId: string;
  type: ContentType;
  title: string;
  subtitle: string;
  thumbnail: string;
  streamUrl?: string;
  seriesId?: string;
  positionMs: number;
  durationMs: number;
  updatedAt: string;
}
