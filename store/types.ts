export interface Preferences {
  [key: string]: string | number | boolean | null;
}

export type ContentType = "live" | "movie" | "series" | "episode";

export interface ServerProfile {
  id: string;
  name: string;
  serverUrl: string;
  username: string;
  password: string;
  isActive: boolean;
  expiryDate: string;
  maxConnections: number;
  activeConnections: number;
  format: "TS" | "HLS" | "M3U8";
  addedAt?: string;
}

export interface EpgProgram {
  title: string;
  start: string;
  end: string;
  progress: number;
}

export interface ChannelItem {
  id: string;
  name: string;
  number: string;
  streamId: string;
  logo: string;
  categoryId: string;
  categoryName: string;
  currentEpg: EpgProgram;
  nextProgram: string;
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
  plot: string;
  streamUrl: string;
  resumePositionMs?: number;
  quality: "4K" | "FHD" | "HD";
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

export interface TraktConfig {
  isConnected: boolean;
  username: string;
  accessToken: string;
  autoScrobble: boolean;
}

export interface PlayHistory {
  contentId: string;
  type: ContentType;
  title: string;
  subtitle: string;
  thumbnail: string;
  positionMs: number;
  durationMs: number;
  updatedAt: string;
}
