import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  useVideoPlayer,
  VideoView,
  type AudioTrack,
  type SubtitleTrack,
} from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  forwardRef,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  BackHandler,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { Colors, Shadows } from "@/constants/theme";
import { TVFocusable, type TVFocusableHandle } from "@/components/tv-focusable";
import { AppText, ChannelLogo, GlassCard, IconButton } from "@/components/ui";
import { ParentalGate } from "@/components/parental-gate";
import {
  getTVRemoteEvent,
  useTVRemote,
  type TVKeyDownEvent,
  type TVRemoteEvent,
} from "@/hooks/use-tv-remote";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useChannelEpg } from "@/hooks/useChannelEpg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppStore } from "@/store/useAppStore";
import { reducePlayerUi, type PlayerUiLayer } from "@/store/playerUiState";
import type { ChannelItem, ContentType, EpgProgram, ServerProfile } from "@/store/types";
import { logTechnicalError } from "@/services/security/sanitize";
import {
  buildFallbackUrls,
  buildPlayerHeaders,
  nextChannelNumberInput,
  readPlayerPreferences,
} from "@/features/player/playerConfig";
import { mapPlayerError } from "@/features/player/ErrorMapper";
import {
  decideProgressPersistence,
  shouldResumeAt,
} from "@/features/player/ProgressPolicy";
import { createPlaybackSessionGuard } from "@/features/player/SessionGuard";
import { isPlaybackBlocked } from "@/services/security/parentalPolicy";
import { openInExternalPlayer } from "@/services/externalPlayer";
import { buildCatchupUrl } from "@/services/catchup";
import { createSeriesEpisodeUrl, getSeriesInfo } from "@/services/xtream";

/** Format seconds → hh:mm:ss */
function formatTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return "0:00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Format remaining time as -hh:mm:ss */
function formatRemaining(current: number, total: number): string {
  const remaining = Math.max(0, total - current);
  if (!Number.isFinite(remaining)) return "-0:00:00";
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = Math.floor(remaining % 60);
  return `-${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Panel = "audio" | "subtitles" | "speed" | "ratio" | null;
type ActivePanel = Exclude<Panel, null>;


const SPEED_OPTIONS = [
  { label: "0.5x", value: 0.5 },
  { label: "0.75x", value: 0.75 },
  { label: "1.0x (Normal)", value: 1.0 },
  { label: "1.25x", value: 1.25 },
  { label: "1.5x", value: 1.5 },
  { label: "2.0x", value: 2.0 },
];

type RatioOption = {
  label: string;
  contentFit: "contain" | "cover" | "fill";
  aspectRatio?: number;
};

const RATIO_OPTIONS: RatioOption[] = [
  { label: "Original / Ajustar", contentFit: "contain" },
  { label: "16:9 (Widescreen)", contentFit: "contain", aspectRatio: 16 / 9 },
  { label: "4:3 (TV Clássica)", contentFit: "contain", aspectRatio: 4 / 3 },
  { label: "Zoom / Cobrir", contentFit: "cover" },
  { label: "Esticar", contentFit: "fill" },
];

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// ─── Standalone helpers (reduce cognitive complexity of listener callbacks) ───

type DurationRefs = {
  durationSetRef: React.MutableRefObject<boolean>;
};

function tryReadDuration(
  p: unknown,
  refs: DurationRefs,
  setDuration: (d: number) => void,
) {
  try {
    const dur = (p as { duration?: number }).duration;
    if (dur && Number.isFinite(dur) && dur > 0 && !refs.durationSetRef.current) {
      refs.durationSetRef.current = true;
      setDuration(dur);
    }
  } catch (durErr) {
    logTechnicalError("Player/duration", durErr);
  }
}

// ─── Custom hook: TV remote handling ─────────────────────────────────────────

type RemoteHandlerParams = {
  contentType: ContentType;
  uiLayer: PlayerUiLayer;
  panel: Panel;
  playButtonRef: React.RefObject<TVFocusableHandle | null>;
  handleBackPress: () => void;
  handleSeek: (s: number) => void;
  handleTogglePlayback: () => void;
  openQuickSwitcher: () => void;
  zapPrevious: () => void;
  zapNext: () => void;
  seekStepSeconds: number;
  onDigit: (digit: number) => void;
  onCycleRatio: () => void;
  onOpenEpg: () => void;
  onOpenTracks: () => void;
  onToggleFavorite: () => void;
  showControlsWithTimer: () => void;
  revealTvOsd: (target?: "transport" | "top") => void;
  focusTopControls: () => void;
  setPanel: React.Dispatch<React.SetStateAction<Panel>>;
};

function usePlayerRemote(p: RemoteHandlerParams) {
  return useCallback(
    (event: TVRemoteEvent) => {
      if (event === "back") {
        p.handleBackPress();
        return;
      }
      if (event.startsWith("digit")) {
        p.onDigit(Number(event.slice(5)));
        return;
      }
      if (event === "channelUp") { p.zapPrevious(); return; }
      if (event === "channelDown") { p.zapNext(); return; }
      if (event === "red") { p.onToggleFavorite(); return; }
      if (event === "green") { p.onCycleRatio(); return; }
      if (event === "yellow") { p.onOpenTracks(); return; }
      if (event === "blue") { p.onOpenEpg(); return; }
      if (p.uiLayer !== "osd") {
        if (p.uiLayer === "hidden") {
          // First remote interaction always restores the player interface.
          // Channel switching stays on the dedicated channel +/- keys, so an
          // UP press cannot be swallowed before the OSD becomes navigable.
          p.revealTvOsd(event === "up" ? "top" : "transport");
        }
        return;
      }
      // On Android TV/Fire TV the platform must keep ownership of the D-pad
      // while the OSD is visible.  Intercepting these events here used to open
      // the channel switcher or zap channels before the focused TVFocusable
      // could receive them, making the player controls impossible to navigate.
      p.showControlsWithTimer();
      if (event === "select") {
        // The focused Pressable receives OK/DPAD_CENTER natively and invokes
        // its own action.  Do not duplicate it as a global player shortcut.
        return;
      }
      // Directional keys now move the native TV focus between the visible
      // controls.  Channel zapping and seeking remain available while the OSD
      // is hidden, where no interactive control is focused.
      if (event === "up") {
        p.focusTopControls();
        return;
      }
      if (event === "left" || event === "right" || event === "down") return;
    },
    // eslint dependencies mirror RemoteHandlerParams fields used inside
    [p],
  );
}

function handleSelectEvent(p: RemoteHandlerParams) {
  if (p.panel) {
    p.setPanel(null);
  } else if (p.contentType === "live") {
    p.openQuickSwitcher();
  } else {
    p.handleTogglePlayback();
  }
}

function handleUpEvent(p: RemoteHandlerParams) {
  if (p.contentType === "live") {
    p.zapPrevious();
  }
}

function handleDownEvent(p: RemoteHandlerParams) {
  if (p.contentType === "live") p.zapNext();
  else {
    p.showControlsWithTimer();
    p.setPanel(null);
    setTimeout(() => p.playButtonRef.current?.focus(), 0);
  }
}

// ─── Pure helpers extracted to keep PlayerScreen under complexity budget ──────

function resolveContentType(type: string): ContentType {
  if (type === "live") return "live";
  if (type === "episode") return "episode";
  if (type === "series") return "series";
  return "movie";
}

function computeProgressPct(
  contentType: ContentType,
  currentTime: number,
  duration: number,
): number {
  if (contentType === "live") return 1;
  if (duration <= 0) return 0;
  return Math.min(1, currentTime / duration);
}

type SeriesEpisodeNavigation = {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  streamUrl: string;
};

type XtreamEpisodeNavigationRaw = {
  id?: string | number;
  episode_num?: string | number;
  title?: string;
  container_extension?: string;
};

function parseSeriesEpisodeNavigation(
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
    };
  };
  const source = Array.isArray(episodes)
    ? [["1", episodes] as const]
    : Object.entries(episodes).sort(([a], [b]) => Number(a) - Number(b));
  return source.flatMap(([season, entries]) =>
    entries.map((episode) => build(episode, Number(season))).filter((episode): episode is SeriesEpisodeNavigation => episode !== null),
  );
}

export default function PlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string | string[];
    title?: string | string[];
    type?: string | string[];
    streamUrl?: string | string[];
    subtitle?: string | string[];
    thumbnail?: string | string[];
    seriesId?: string | string[];
  }>();
  const id = readParam(params.id) ?? "";
  const title = readParam(params.title) ?? "Conteúdo";
  const type = readParam(params.type) ?? "movie";
  const streamUrl = readParam(params.streamUrl) ?? "";
  const sourceSubtitle = readParam(params.subtitle) ?? "";
  const sourceThumbnail = readParam(params.thumbnail) ?? "";
  const sourceSeriesId = readParam(params.seriesId);
  const tvMode = useTVMode();
  const insets = useSafeAreaInsets();
  const saveHistory = useAppStore((state) => state.saveHistory);
  const recordContentPlay = useAppStore((state) => state.recordContentPlay);
  const removeHistoryItem = useAppStore((state) => state.removeHistoryItem);
  const allChannels = useAppStore((state) => state.contentCache.liveChannels);
  const activeServerId = useAppStore((state) => state.activeServerId);
  const activeServer = useAppStore((state) => state.servers.find((server) => server.id === activeServerId));
  const favoriteChannelIds = useAppStore((state) => state.favoriteChannelIds);
  const toggleFavoriteChannel = useAppStore((state) => state.toggleFavoriteChannel);
  const isContentBlocked = useAppStore((state) => state.isContentBlocked);
  const cachedMovies = useAppStore((state) => state.contentCache.vodMovies);
  const cachedSeries = useAppStore((state) => state.contentCache.seriesList);
  const activatePip = useAppStore((state) => state.activatePip);
  const preferences = useAppStore((state) => state.preferences);
  const playerPreferences = useMemo(() => readPlayerPreferences(preferences), [preferences]);
  const requestHeaders = useMemo(
    () => buildPlayerHeaders(playerPreferences.userAgent),
    [playerPreferences.userAgent],
  );

  const contentType: ContentType = resolveContentType(type);
  const directPlaybackBlocked = isPlaybackBlocked(id, sourceSeriesId, isContentBlocked);

  // ─── Player state ────────────────────────────────────────────────────────────
  const [uiLayer, dispatchUi] = useReducer(reducePlayerUi, "osd");
  const controlsVisible = uiLayer === "osd";
  const [panel, setPanel] = useState<Panel>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);
  const [brightness, setBrightness] = useState(1);

  // ─── Progress tracking ───────────────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressBarWidthRef = useRef(0);
  const progressBarRef = useRef<View>(null);
  const progressBarPageXRef = useRef(0);
  const dragProgressPctRef = useRef(0);
  const isDraggingRef = useRef(false);
  const durationSetRef = useRef(false);

  // ─── Options state ───────────────────────────────────────────────────────────
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<AudioTrack | null>(null);
  const [selectedSubtitle, setSelectedSubtitle] = useState<SubtitleTrack | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [selectedRatio, setSelectedRatio] = useState<RatioOption>(RATIO_OPTIONS[0]);
  const [channelNumberInput, setChannelNumberInput] = useState("");
  const [pendingProtectedChannelId, setPendingProtectedChannelId] = useState<string | null>(null);
  const [pendingDirectPlayback, setPendingDirectPlayback] = useState(false);
  const [seriesEpisodes, setSeriesEpisodes] = useState<SeriesEpisodeNavigation[]>([]);

  // ─── Overlays ─────────────────────────────────────────────────────────────
  const playButtonRef = useRef<TVFocusableHandle>(null);
  const topControlsRef = useRef<TVFocusableHandle>(null);
  const pendingTvOsdFocusRef = useRef<"transport" | "top">("transport");
  const videoViewRef = useRef<VideoView>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [osdOpacity] = useState(() => new Animated.Value(1));
  const urlAttemptRef = useRef(0);
  const resumeAppliedRef = useRef(false);
  const lastSavedSecondRef = useRef(0);
  const latestPositionRef = useRef(0);
  const latestDurationRef = useRef(0);
  const channelNumberTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChannelIndexRef = useRef<number | null>(null);
  const sessionGuardRef = useRef(createPlaybackSessionGuard());
  const currentChannelIdRef = useRef(id);
  const recordedPlaybackRef = useRef<string | null>(null);
  const [previousChannelId, setPreviousChannelId] = useState<string | null>(null);
  const isCurrentChannelFavorite = contentType === "live" && favoriteChannelIds.includes(id);
  const isCurrentContentBlocked = isContentBlocked(id);

  const fallbackUrls = useMemo(
    () => buildFallbackUrls(streamUrl, contentType, playerPreferences.streamPreference),
    [streamUrl, contentType, playerPreferences.streamPreference],
  );

  const player = useVideoPlayer(
    { uri: fallbackUrls[0] ?? "", headers: requestHeaders },
    (videoPlayer) => {
      videoPlayer.loop = false;
      videoPlayer.timeUpdateEventInterval = 1;
      if (!directPlaybackBlocked) videoPlayer.play();
    },
  );
  // Ref gives mutable access to the player without triggering the
  // react-hooks/immutability rule, which blocks direct mutation of hook values.
  const playerRef = useRef(player);
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  const currentChannel = allChannels.find((ch) => ch.id === id);
  const currentSeries = sourceSeriesId
    ? cachedSeries.find((series) => series.id === sourceSeriesId)
    : undefined;
  const backdrop =
    sourceThumbnail ||
    currentChannel?.logo ||
    cachedMovies.find((movie) => movie.id === id)?.backdrop ||
    "";
  const epg = useChannelEpg(contentType === "live" ? id : undefined);

  useEffect(() => {
    if (contentType !== "episode" || !sourceSeriesId || !currentSeries || !activeServer) {
      setSeriesEpisodes([]);
      return;
    }
    let cancelled = false;
    getSeriesInfo(activeServer, currentSeries.seriesId)
      .then((payload) => {
        if (!cancelled) setSeriesEpisodes(parseSeriesEpisodeNavigation(payload, sourceSeriesId, activeServer));
      })
      .catch((error: unknown) => {
        logTechnicalError("Player/series-navigation", error);
        if (!cancelled) setSeriesEpisodes([]);
      });
    return () => { cancelled = true; };
  }, [activeServer, contentType, currentSeries, sourceSeriesId]);

  const currentEpisodeIndex = seriesEpisodes.findIndex((episode) => episode.id === id);
  const nextEpisode = currentEpisodeIndex >= 0 ? seriesEpisodes[currentEpisodeIndex + 1] : undefined;
  const canSkipIntro = contentType === "episode" && duration > 0 && currentTime < Math.min(180, duration - 5);

  // Live channels do not have progress, but they still belong in the user's
  // recent activity. This lets Home prioritise the channels actually watched
  // without affecting "Continuar assistindo", which intentionally ignores live.
  useEffect(() => {
    if (contentType !== "live" || !id || !streamUrl) return;
    saveHistory({
      contentId: id,
      type: "live",
      title,
      subtitle: currentChannel?.currentEpg?.title ?? "Canal ao vivo",
      thumbnail: sourceThumbnail || currentChannel?.logo || "",
      streamUrl,
      positionMs: 0,
      durationMs: 0,
      updatedAt: new Date().toISOString(),
    });
  }, [contentType, currentChannel?.currentEpg?.title, currentChannel?.logo, id, saveHistory, sourceThumbnail, streamUrl, title]);

  // A history entry is deliberately unique per item, so it only describes the
  // latest progress. Keep an independent counter for the Home "most watched"
  // recommendation, once per real playback session and scoped by server.
  useEffect(() => {
    if (contentType === "live" || !id || !streamUrl || directPlaybackBlocked) return;
    const rankedContentId = contentType === "episode" ? sourceSeriesId ?? id : id;
    const sessionKey = `${contentType}:${id}:${rankedContentId}`;
    if (recordedPlaybackRef.current === sessionKey) return;
    recordedPlaybackRef.current = sessionKey;
    recordContentPlay(rankedContentId);
  }, [contentType, directPlaybackBlocked, id, recordContentPlay, sourceSeriesId, streamUrl]);

  const persistProgress = useCallback(
    (positionSeconds: number, durationSeconds: number) => {
      if (contentType === "live") return;
      const decision = decideProgressPersistence(positionSeconds, durationSeconds);
      if (decision.action === "ignore") return;
      if (decision.action === "remove") {
        removeHistoryItem(id);
        return;
      }
      saveHistory({
        contentId: id,
        type: contentType,
        title,
        subtitle: sourceSubtitle,
        thumbnail: backdrop,
        streamUrl,
        seriesId: sourceSeriesId,
        positionMs: decision.positionMs,
        durationMs: decision.durationMs,
        updatedAt: new Date().toISOString(),
      });
    },
    [backdrop, contentType, id, removeHistoryItem, saveHistory, sourceSeriesId, sourceSubtitle, streamUrl, title],
  );

  useEffect(() => {
    currentChannelIdRef.current = id;
    resumeAppliedRef.current = false;
    lastSavedSecondRef.current = 0;
    latestPositionRef.current = 0;
    latestDurationRef.current = 0;
  }, [id]);

  useEffect(() => {
    if (!directPlaybackBlocked) return;
    try { player.pause(); } catch { /* ignore */ }
    // Schedule UI state after the playback side-effect to avoid a cascading
    // render while React is synchronizing the native player.
    const timer = setTimeout(() => {
      setIsPlaying(false);
      setPendingDirectPlayback(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [directPlaybackBlocked, id, player]);

  const authorizeDirectPlayback = useCallback(() => {
    setPendingDirectPlayback(false);
    try { player.play(); setIsPlaying(true); } catch (cause) { logTechnicalError("Player/parental-unlock", cause); }
  }, [player]);

  // ─── Player event listeners ──────────────────────────────────────────────
  useEffect(() => {
    const sessionGuard = sessionGuardRef.current;
    const sessionToken = sessionGuard.begin();
    urlAttemptRef.current = 0;
    durationSetRef.current = false;

    const durationRefs = { durationSetRef };
    const statusSub = player.addListener("statusChange", (status) => {
      if (!sessionGuard.isCurrent(sessionToken)) return;
      if (status.status === "readyToPlay") {
        setPlayerError(null);
        setIsBuffering(false);
        tryReadDuration(player, durationRefs, setDuration);
        const mediaDuration = player.duration;
        latestDurationRef.current = mediaDuration;
        if (contentType !== "live" && !resumeAppliedRef.current && mediaDuration > 0) {
          resumeAppliedRef.current = true;
          const saved = useAppStore.getState().history.find((item) => item.contentId === id);
          const resumeSeconds = (saved?.positionMs ?? 0) / 1000;
          if (shouldResumeAt(resumeSeconds, mediaDuration)) {
            player.currentTime = resumeSeconds;
            setCurrentTime(resumeSeconds);
            latestPositionRef.current = resumeSeconds;
          }
        }
        return;
      }
      if (status.status !== "error") return;
      const nextAttempt = urlAttemptRef.current + 1;
      if (nextAttempt < fallbackUrls.length) {
        urlAttemptRef.current = nextAttempt;
        try {
          setIsBuffering(true);
          player.replace({ uri: fallbackUrls[nextAttempt], headers: requestHeaders });
          player.play();
        } catch (replaceErr) {
          logTechnicalError("Player/fallback", replaceErr);
          setPlayerError(mapPlayerError(status).message);
        }
      } else {
        logTechnicalError("Player/playback", status);
        setPlayerError(mapPlayerError(status).message);
      }
    });

    const sourceSub = player.addListener("sourceLoad", (payload) => {
      if (!sessionGuard.isCurrent(sessionToken)) return;
      setAudioTracks(payload.availableAudioTracks);
      setSubtitleTracks(payload.availableSubtitleTracks);
      setSelectedAudio(player.audioTrack);
      setSelectedSubtitle(player.subtitleTrack);
    });

    const timeSub = player.addListener(
      "timeUpdate" as Parameters<typeof player.addListener>[0],
      (payload: unknown) => {
        if (!sessionGuard.isCurrent(sessionToken)) return;
        const tp = payload as { currentTime?: number };
        if (typeof tp.currentTime === "number") {
          if (!isDraggingRef.current) setCurrentTime(tp.currentTime);
          setIsBuffering(false);
          latestPositionRef.current = tp.currentTime;
          const mediaDuration = player.duration;
          if (mediaDuration > 0) {
            setDuration(mediaDuration);
            latestDurationRef.current = mediaDuration;
          }
          const wholeSecond = Math.floor(tp.currentTime);
          if (
            contentType !== "live" &&
            mediaDuration > 0 &&
            wholeSecond - lastSavedSecondRef.current >= 10
          ) {
            lastSavedSecondRef.current = wholeSecond;
            persistProgress(tp.currentTime, mediaDuration);
          }
        }
        if (!durationSetRef.current) {
          tryReadDuration(player, durationRefs, setDuration);
        }
      },
    );

    const playingSub = player.addListener("playingChange", (payload) => {
      if (!sessionGuard.isCurrent(sessionToken)) return;
      setIsPlaying(payload.isPlaying);
    });

    const endSub = player.addListener("playToEnd", () => {
      if (!sessionGuard.isCurrent(sessionToken)) return;
      removeHistoryItem(id);
    });

    return () => {
      sessionGuard.end(sessionToken);
      statusSub.remove();
      timeSub.remove();
      sourceSub.remove();
      playingSub.remove();
      endSub.remove();
      persistProgress(latestPositionRef.current, latestDurationRef.current);
    };
  }, [contentType, fallbackUrls, id, persistProgress, player, removeHistoryItem, requestHeaders]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        persistProgress(latestPositionRef.current, latestDurationRef.current);
      }
    });
    return () => subscription.remove();
  }, [persistProgress]);

  // Apply playback rate whenever it changes.
  // Uses playerRef to satisfy react-hooks/immutability (the hook value itself
  // is not mutated in the effect body; the ref is the mutable indirection).
  useEffect(() => {
    try {
      const p = playerRef.current as unknown as Record<string, unknown>;
      if (typeof p["playbackRate"] !== "undefined") {
        p["playbackRate"] = playbackRate;
      }
    } catch (rateErr) {
      logTechnicalError("Player/rate", rateErr);
    }
  }, [playbackRate]);

  // ─── Controls visibility timer ───────────────────────────────────────────
  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const showControlsWithTimer = useCallback(() => {
    dispatchUi({ type: "SHOW_OSD" });
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      if (!isDraggingRef.current) dispatchUi({ type: "AUTO_HIDE" });
    }, playerPreferences.osdTimeoutMs);
  }, [clearHideTimer, playerPreferences.osdTimeoutMs]);

  const revealTvOsd = useCallback((target: "transport" | "top" = "transport") => {
    pendingTvOsdFocusRef.current = target;
    showControlsWithTimer();
  }, [showControlsWithTimer]);

  const focusTopControls = useCallback(() => {
    pendingTvOsdFocusRef.current = "top";
    showControlsWithTimer();
    // The OSD is already mounted, but waiting one frame lets Android TV apply
    // its visible/focusable state before the imperative focus request.
    requestAnimationFrame(() => topControlsRef.current?.focus());
  }, [showControlsWithTimer]);

  useEffect(() => {
    Animated.timing(osdOpacity, {
      toValue: controlsVisible ? 1 : 0,
      duration: controlsVisible ? 160 : 260,
      useNativeDriver: true,
    }).start();
  }, [controlsVisible, osdOpacity]);

  useEffect(() => {
    if (!tvMode || !controlsVisible) return;
    const timer = setTimeout(() => {
      if (pendingTvOsdFocusRef.current === "top") topControlsRef.current?.focus();
      else playButtonRef.current?.focus();
      pendingTvOsdFocusRef.current = "transport";
    }, 20);
    return () => clearTimeout(timer);
  }, [controlsVisible, tvMode]);

  useEffect(() => {
    showControlsWithTimer();
    return clearHideTimer;
  }, [clearHideTimer, showControlsWithTimer]);

  // ─── Seek bar handlers ───────────────────────────────────────────────────
  const handleProgressLayout = useCallback((e: LayoutChangeEvent) => {
    progressBarWidthRef.current = Math.max(1, e.nativeEvent.layout.width);
    requestAnimationFrame(() => {
      progressBarRef.current?.measureInWindow((x) => {
        progressBarPageXRef.current = x;
      });
    });
  }, []);

  const progressPercentFromEvent = useCallback((e: GestureResponderEvent) => {
    const width = Math.max(1, progressBarWidthRef.current);
    const pageX = e.nativeEvent.pageX;
    const relativeX = Number.isFinite(pageX) && progressBarPageXRef.current > 0
      ? pageX - progressBarPageXRef.current
      : e.nativeEvent.locationX;
    return Math.max(0, Math.min(1, relativeX / width));
  }, []);

  const seekToPercent = useCallback(
    (pct: number) => {
      if (contentType === "live" || duration <= 0) return;
      const targetSecs = Math.max(0, Math.min(duration, pct * duration));
      try {
        player.currentTime = targetSecs;
        latestPositionRef.current = targetSecs;
        setCurrentTime(targetSecs);
      } catch (seekErr) {
        logTechnicalError("Player/seekbar", seekErr);
      }
    },
    [contentType, duration, player],
  );

  const handleProgressGrant = useCallback(
    (e: GestureResponderEvent) => {
      isDraggingRef.current = true;
      const pct = progressPercentFromEvent(e);
      dragProgressPctRef.current = pct;
      seekToPercent(pct);
      showControlsWithTimer();
    },
    [progressPercentFromEvent, seekToPercent, showControlsWithTimer],
  );

  const handleProgressMove = useCallback(
    (e: GestureResponderEvent) => {
      if (!isDraggingRef.current) return;
      const pct = progressPercentFromEvent(e);
      dragProgressPctRef.current = pct;
      seekToPercent(pct);
    },
    [progressPercentFromEvent, seekToPercent],
  );

  const handleProgressRelease = useCallback(() => {
    isDraggingRef.current = false;
    seekToPercent(dragProgressPctRef.current);
    showControlsWithTimer();
  }, [seekToPercent, showControlsWithTimer]);

  const handleVolumeChange = useCallback((value: number) => {
    const next = Math.max(0, Math.min(1, value));
    try {
      const mutablePlayer = playerRef.current as unknown as { volume?: number; muted?: boolean };
      mutablePlayer.volume = next;
      if (next > 0) mutablePlayer.muted = false;
      setVolume(next);
    } catch (error) {
      logTechnicalError("Player/volume", error);
    }
  }, []);

  const handleBrightnessChange = useCallback((value: number) => {
    setBrightness(Math.max(0.2, Math.min(1, value)));
  }, []);

  // ─── Playback controls ───────────────────────────────────────────────────
  const handleConfirmExit = useCallback(() => {
    try {
      persistProgress(currentTime, duration);
    } catch (saveError) {
      logTechnicalError("Player/progress", saveError);
    }
    router.back();
  }, [currentTime, duration, persistProgress, router]);

  const handleBackPress = useCallback(() => {
    if (panel) {
      setPanel(null);
      showControlsWithTimer();
      return;
    }
    clearHideTimer();
    dispatchUi({ type: "BACK" });
  }, [clearHideTimer, panel, showControlsWithTimer]);

  const handleRequestExit = useCallback(() => {
    clearHideTimer();
    setPanel(null);
    dispatchUi({ type: "REQUEST_EXIT" });
  }, [clearHideTimer]);

  const handleTogglePlayback = useCallback(() => {
    if (isPlaying) {
      persistProgress(latestPositionRef.current, latestDurationRef.current);
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying, persistProgress, player]);

  const handleSeek = useCallback(
    (seconds: number) => {
      if (contentType === "live") return;
      try {
        const nextTime = Math.max(0, Math.min(duration || Number.POSITIVE_INFINITY, latestPositionRef.current + seconds));
        player.currentTime = nextTime;
        latestPositionRef.current = nextTime;
        setCurrentTime(nextTime);
        showControlsWithTimer();
        setPlayerError(null);
      } catch (seekError) {
        logTechnicalError("Player/seek", seekError);
        setPlayerError("Não foi possível alterar o ponto da reprodução.");
      }
    },
    [contentType, duration, player, showControlsWithTimer],
  );

  const handleSkipIntro = useCallback(() => {
    const target = Math.min(Math.max(0, duration - 2), Math.max(currentTime + 75, 90));
    if (contentType !== "episode" || target <= currentTime) return;
    try {
      player.currentTime = target;
      latestPositionRef.current = target;
      setCurrentTime(target);
      showControlsWithTimer();
    } catch (error) {
      logTechnicalError("Player/skip-intro", error);
    }
  }, [contentType, currentTime, duration, player, showControlsWithTimer]);

  const handleNextEpisode = useCallback(() => {
    if (!nextEpisode) return;
    persistProgress(latestPositionRef.current, latestDurationRef.current);
    const seriesTitle = sourceSubtitle.replace(/\s·\sT\d+:E\d+$/, "") || currentSeries?.title || title;
    router.replace({
      pathname: "/player",
      params: {
        id: nextEpisode.id,
        title: `${seriesTitle} · T${nextEpisode.seasonNumber}:E${nextEpisode.episodeNumber}`,
        type: "episode",
        streamUrl: nextEpisode.streamUrl,
        subtitle: seriesTitle,
        thumbnail: sourceThumbnail || backdrop,
        seriesId: sourceSeriesId,
      },
    });
  }, [backdrop, currentSeries?.title, nextEpisode, persistProgress, router, sourceSeriesId, sourceSubtitle, sourceThumbnail, title]);

  const handlePanel = useCallback((nextPanel: Panel) => {
    setPanel((current) => (current === nextPanel ? null : nextPanel));
    showControlsWithTimer();
  }, [showControlsWithTimer]);

  const handleSwitchChannel = useCallback(
    (channelId: string, parentalApproved = false) => {
      const channel = allChannels.find((item) => item.id === channelId);
      if (!channel) return;
      if (!parentalApproved && isContentBlocked(channel.id)) {
        setPendingProtectedChannelId(channel.id);
        return;
      }
      try {
        const outgoingChannelId = currentChannelIdRef.current;
        if (outgoingChannelId && outgoingChannelId !== channel.id) {
          setPreviousChannelId(outgoingChannelId);
        }
        currentChannelIdRef.current = channel.id;
        sessionGuardRef.current.invalidate();
        const preferredUrl = buildFallbackUrls(
          channel.streamUrl,
          "live",
          playerPreferences.streamPreference,
        )[0] ?? channel.streamUrl;
        urlAttemptRef.current = 0;
        durationSetRef.current = false;
        setIsBuffering(true);
        player.replace({ uri: preferredUrl, headers: requestHeaders });
        player.play();
        setPlayerError(null);
        setIsPlaying(true);
        setCurrentTime(0);
        setDuration(0);
        resumeAppliedRef.current = true;
        router.setParams({
          id: channel.id,
          title: channel.name,
          type: "live",
          streamUrl: channel.streamUrl,
        });
        setPanel(null);
        showControlsWithTimer();
      } catch (switchError) {
        logTechnicalError("Player/zapping", switchError);
        setPlayerError("Não foi possível trocar para este canal.");
      }
    },
    [allChannels, isContentBlocked, player, playerPreferences.streamPreference, requestHeaders, router, showControlsWithTimer],
  );

  const switchAuthorizedChannel = useCallback(() => {
    const channelId = pendingProtectedChannelId;
    setPendingProtectedChannelId(null);
    if (channelId) handleSwitchChannel(channelId, true);
  }, [handleSwitchChannel, pendingProtectedChannelId]);

  const zapByOffset = useCallback(
    (offset: number) => {
      if (allChannels.length === 0) return;
      const currentIndex = allChannels.findIndex((channel) => channel.id === id);
      const baseIndex = pendingChannelIndexRef.current ?? (currentIndex >= 0 ? currentIndex : 0);
      const nextIndex = (baseIndex + offset + allChannels.length) % allChannels.length;
      pendingChannelIndexRef.current = nextIndex;
      if (zapTimerRef.current) clearTimeout(zapTimerRef.current);
      zapTimerRef.current = setTimeout(() => {
        const targetIndex = pendingChannelIndexRef.current;
        pendingChannelIndexRef.current = null;
        if (targetIndex !== null) handleSwitchChannel(allChannels[targetIndex].id);
      }, 120);
    },
    [allChannels, handleSwitchChannel, id],
  );

  const zapPrevious = useCallback(() => zapByOffset(-1), [zapByOffset]);
  const zapNext = useCallback(() => zapByOffset(1), [zapByOffset]);
  const handlePreviousChannel = useCallback(() => {
    if (previousChannelId) handleSwitchChannel(previousChannelId);
  }, [handleSwitchChannel, previousChannelId]);

  const handleChannelDigit = useCallback((digit: number) => {
    if (contentType !== "live") return;
    setChannelNumberInput((current) => {
      const next = nextChannelNumberInput(current, digit);
      if (channelNumberTimerRef.current) clearTimeout(channelNumberTimerRef.current);
      channelNumberTimerRef.current = setTimeout(() => {
        const normalized = String(Number(next));
        const target = allChannels.find((channel) => String(Number(channel.number)) === normalized);
        if (target) handleSwitchChannel(target.id);
        setChannelNumberInput("");
      }, 1500);
      return next;
    });
    showControlsWithTimer();
  }, [allChannels, contentType, handleSwitchChannel, showControlsWithTimer]);

  useEffect(() => () => {
    if (channelNumberTimerRef.current) clearTimeout(channelNumberTimerRef.current);
    if (zapTimerRef.current) clearTimeout(zapTimerRef.current);
  }, []);

  const handleTap = useCallback(() => {
    if (uiLayer === "hidden") {
      showControlsWithTimer();
      return;
    }
    if (uiLayer === "osd") {
      clearHideTimer();
      dispatchUi({ type: "HIDE" });
    }
  }, [clearHideTimer, showControlsWithTimer, uiLayer]);

  const handleRetry = useCallback(() => {
    if (!fallbackUrls[0]) {
      setPlayerError("Endereço do stream não informado.");
      return;
    }
    setPlayerError(null);
    urlAttemptRef.current = 0;
    durationSetRef.current = false;
    setIsBuffering(true);
    try {
      player.replace({ uri: fallbackUrls[0], headers: requestHeaders });
      player.play();
    } catch (retryErr) {
      logTechnicalError("Player/retry", retryErr);
      setPlayerError("Não foi possível reiniciar a reprodução.");
    }
  }, [fallbackUrls, player, requestHeaders]);

  // ─── Option selectors ────────────────────────────────────────────────────
  const handleSelectAudio = useCallback(
    (track: AudioTrack) => {
      playerRef.current.audioTrack = track;
      setSelectedAudio(track);
      setPanel(null);
      showControlsWithTimer();
    },
    [showControlsWithTimer],
  );

  const handleSelectSubtitle = useCallback(
    (track: SubtitleTrack | null) => {
      playerRef.current.subtitleTrack = track;
      setSelectedSubtitle(track);
      setPanel(null);
      showControlsWithTimer();
    },
    [showControlsWithTimer],
  );

  const handleSelectSpeed = useCallback(
    (value: number) => {
      setPlaybackRate(value);
      setPanel(null);
      showControlsWithTimer();
    },
    [showControlsWithTimer],
  );

  const handleSelectRatio = useCallback(
    (option: RatioOption) => {
      setSelectedRatio(option);
      setPanel(null);
      showControlsWithTimer();
    },
    [showControlsWithTimer],
  );

  const handleCycleRatio = useCallback(() => {
    const currentIndex = RATIO_OPTIONS.findIndex((option) => option.label === selectedRatio.label);
    setSelectedRatio(RATIO_OPTIONS[(currentIndex + 1) % RATIO_OPTIONS.length]);
    showControlsWithTimer();
  }, [selectedRatio.label, showControlsWithTimer]);

  const handleOpenTracks = useCallback(() => {
    if (audioTracks.length > 1) setPanel("audio");
    else if (subtitleTracks.length > 0) setPanel("subtitles");
    else return;
    showControlsWithTimer();
  }, [audioTracks.length, showControlsWithTimer, subtitleTracks.length]);

  const handleToggleChannelFavorite = useCallback(() => {
    if (contentType !== "live" || !id) return;
    toggleFavoriteChannel(id);
    showControlsWithTimer();
  }, [contentType, id, showControlsWithTimer, toggleFavoriteChannel]);

  const handleOpenParentalSettings = useCallback(() => {
    showControlsWithTimer();
    router.push("/settings/parental");
  }, [router, showControlsWithTimer]);

  // ─── Native Picture-in-Picture ───────────────────────────────────────────
  const handleTogglePip = useCallback(async () => {
    persistProgress(latestPositionRef.current, latestDurationRef.current);
    if (Platform.OS !== "web") {
      try {
        const videoView = videoViewRef.current;
        if (videoView) {
          await videoView.startPictureInPicture();
          return;
        }
      } catch (pipError) {
        logTechnicalError("Player/PiP", pipError);
      }
    }
    const pipSubtitle = contentType === "live" ? "Canal ao vivo" : sourceSubtitle;
    activatePip(streamUrl, title, contentType, id, backdrop, pipSubtitle);
    router.back();
  }, [activatePip, backdrop, contentType, id, persistProgress, router, sourceSubtitle, streamUrl, title]);

  const handleOpenExternalPlayer = useCallback(async () => {
    try {
      player.pause();
      setIsPlaying(false);
      await openInExternalPlayer(streamUrl);
    } catch (externalError) {
      logTechnicalError("Player/external", externalError);
      setPlayerError(externalError instanceof Error ? externalError.message : "Não foi possível abrir o player externo.");
    }
  }, [player, streamUrl]);

  // ─── TV remote ───────────────────────────────────────────────────────────
  const handleOpenQuickSwitcher = useCallback(() => {
    clearHideTimer();
    setPanel(null);
    dispatchUi({ type: "OPEN_QUICK_ZAPPING" });
  }, [clearHideTimer]);

  const handleCloseQuickSwitcher = useCallback(() => {
    showControlsWithTimer();
  }, [showControlsWithTimer]);

  const handleOpenEpg = useCallback(() => {
    clearHideTimer();
    setPanel(null);
    dispatchUi({ type: "OPEN_EPG" });
  }, [clearHideTimer]);

  const handlePlayCatchup = useCallback((program: EpgProgram) => {
    const catchupUrl = buildCatchupUrl(currentChannel, activeServer, program);
    if (!catchupUrl) return;
    try {
      clearHideTimer();
      durationSetRef.current = false;
      player.replace({ uri: catchupUrl, headers: requestHeaders });
      player.play();
      setIsPlaying(true);
      setCurrentTime(0);
      setDuration(0);
      setPlayerError(null);
      dispatchUi({ type: "HIDE" });
    } catch (catchupError) {
      logTechnicalError("Player/catchup", catchupError);
      setPlayerError("Não foi possível iniciar o programa anterior.");
    }
  }, [activeServer, clearHideTimer, currentChannel, player, requestHeaders]);

  const handleCloseOverlay = useCallback(() => {
    dispatchUi({ type: "HIDE" });
  }, []);

  const remoteParams: RemoteHandlerParams = useMemo(
    () => ({
      contentType,
      uiLayer,
      panel,
      playButtonRef,
      handleBackPress,
      handleSeek,
      handleTogglePlayback,
      openQuickSwitcher: handleOpenQuickSwitcher,
      zapPrevious,
      zapNext,
      seekStepSeconds: playerPreferences.seekStepSeconds,
      onDigit: handleChannelDigit,
      onCycleRatio: handleCycleRatio,
      onOpenEpg: handleOpenEpg,
      onOpenTracks: handleOpenTracks,
      onToggleFavorite: handleToggleChannelFavorite,
      showControlsWithTimer,
      revealTvOsd,
      focusTopControls,
      setPanel,
    }),
    [
      contentType,
      uiLayer,
      panel,
      handleBackPress,
      handleSeek,
      handleTogglePlayback,
      handleOpenQuickSwitcher,
      handleOpenEpg,
      handleChannelDigit,
      handleCycleRatio,
      handleOpenTracks,
      handleToggleChannelFavorite,
      playerPreferences.seekStepSeconds,
      zapNext,
      zapPrevious,
      showControlsWithTimer,
      revealTvOsd,
      focusTopControls,
    ],
  );

  const handleRemoteEvent = usePlayerRemote(remoteParams);

  useTVRemote(handleRemoteEvent, tvMode);

  const handleNativeKeyDown = useCallback(
    (event: TVKeyDownEvent) => {
      if (Platform.OS !== "web" || !tvMode) return;
      const remoteEvent = getTVRemoteEvent(
        event.nativeEvent.key,
        event.nativeEvent.code,
      );
      if (remoteEvent && remoteEvent !== "back") handleRemoteEvent(remoteEvent);
    },
    [handleRemoteEvent, tvMode],
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleRemoteEvent("back");
        return true;
      },
    );
    return () => subscription.remove();
  }, [handleRemoteEvent]);

  const progressPct = computeProgressPct(contentType, currentTime, duration);

  const keyAwareProps = {
    style: styles.screen,
    onKeyDown: handleNativeKeyDown,
  } as unknown as React.ComponentProps<typeof View>;

  return (
    <View {...keyAwareProps}>
      <ParentalGate
        visible={pendingProtectedChannelId !== null}
        onAuthorized={switchAuthorizedChannel}
        onClose={() => setPendingProtectedChannelId(null)}
      />
      <ParentalGate
        visible={pendingDirectPlayback}
        onAuthorized={authorizeDirectPlayback}
        onClose={() => router.back()}
      />
      <Image
        source={{ uri: backdrop }}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.backdropVeil} />
      <VideoView
        ref={videoViewRef}
        player={player}
        style={[
          StyleSheet.absoluteFill,
          selectedRatio.aspectRatio
            ? styles.videoAspectContainer
            : undefined,
        ]}
        contentFit={selectedRatio.contentFit}
        nativeControls={false}
        allowsPictureInPicture
        startsPictureInPictureAutomatically={Platform.OS === "android" && !tvMode}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.brightnessVeil, { opacity: 1 - brightness }]}
      />

      {/* Buffering indicator */}
      {isBuffering ? (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={Colors.blueBright} />
          <AppText style={styles.bufferingText}>Carregando stream...</AppText>
        </View>
      ) : null}

      {channelNumberInput ? (
        <View style={styles.channelNumberOverlay} pointerEvents="none">
          <AppText style={styles.channelNumberLabel}>CANAL</AppText>
          <AppText style={styles.channelNumberValue}>{channelNumberInput}</AppText>
        </View>
      ) : null}

      <Pressable
        accessibilityLabel="Mostrar ou ocultar controles"
        onPress={handleTap}
        accessible={!tvMode}
        focusable={!tvMode}
        style={styles.tapOverlay}
      />

      <View pointerEvents="box-none" style={styles.overlay}>
        <Animated.View
          pointerEvents={controlsVisible ? "box-none" : "none"}
          style={[
            styles.osdLayer,
            {
              opacity: osdOpacity,
              paddingTop: Math.max(16, insets.top + 8),
              paddingBottom: Math.max(18, insets.bottom + 12),
              paddingLeft: Math.max(18, insets.left + 18),
              paddingRight: tvMode
                ? Math.max(18, insets.right + 18)
                : Math.max(52, insets.right + 18),
            },
          ]}
        >
          <LinearGradient
            pointerEvents="none"
            colors={["transparent", "rgba(3,7,14,0.30)", "rgba(3,7,14,0.94)"]}
            locations={[0.36, 0.68, 1]}
            style={StyleSheet.absoluteFill}
          />
          <PlayerTopBar
            topControlsRef={topControlsRef}
            contentType={contentType}
            onBack={handleRequestExit}
            onToggleQuickSwitcher={handleOpenQuickSwitcher}
            onTogglePip={handleTogglePip}
            onOpenTracks={handleOpenTracks}
            onCycleRatio={handleCycleRatio}
            favorite={isCurrentChannelFavorite}
            onToggleFavorite={handleToggleChannelFavorite}
            protectedContent={isCurrentContentBlocked}
            onOpenParentalSettings={handleOpenParentalSettings}
          />
          {!tvMode ? (
            <SideAdjustments
              volume={volume}
              brightness={brightness}
              onVolumeChange={handleVolumeChange}
              onBrightnessChange={handleBrightnessChange}
              onInteraction={showControlsWithTimer}
              safeLeft={insets.left}
              safeRight={insets.right}
            />
          ) : null}
          <PlayerCenterControls
            playButtonRef={playButtonRef}
            isPlaying={isPlaying}
            isLive={contentType === "live"}
            onTogglePlayback={handleTogglePlayback}
            onBackward={contentType === "live" ? zapPrevious : () => handleSeek(-10)}
            onForward={contentType === "live" ? zapNext : () => handleSeek(10)}
          />
          <PlayerBottomPanel
            title={title}
            subtitle={sourceSubtitle}
            artwork={currentChannel?.logo ?? backdrop}
            contentType={contentType}
            isPlaying={isPlaying}
            panel={panel}
            currentTime={currentTime}
            duration={duration}
            progressPct={progressPct}
            selectedAudio={selectedAudio}
            selectedSubtitle={selectedSubtitle}
            audioTracks={audioTracks}
            subtitleTracks={subtitleTracks}
            playbackRate={playbackRate}
            selectedRatio={selectedRatio}
            currentEpg={epg.current}
            onProgressLayout={handleProgressLayout}
            onProgressGrant={handleProgressGrant}
            onProgressMove={handleProgressMove}
            onProgressRelease={handleProgressRelease}
            progressBarRef={progressBarRef}
            canSkipIntro={canSkipIntro}
            onSkipIntro={handleSkipIntro}
            nextEpisode={nextEpisode}
            onNextEpisode={handleNextEpisode}
            onSelectAudio={handleSelectAudio}
            onSelectSubtitle={handleSelectSubtitle}
            onSelectSpeed={handleSelectSpeed}
            onSelectRatio={handleSelectRatio}
          />
        </Animated.View>

        <QuickSwitcher
          visible={uiLayer === "quick-zapping"}
          channels={allChannels}
          favoriteChannelIds={favoriteChannelIds}
          currentId={id}
          onSwitch={handleSwitchChannel}
          onClose={handleCloseQuickSwitcher}
        />

        <PlayerStatus
          loading={!playerError && player.status === "loading"}
          error={playerError}
          onRetry={handleRetry}
        />
      </View>

      {/* EPG Modal */}
      <Modal
        visible={uiLayer === "epg"}
        transparent
        animationType="slide"
        onRequestClose={handleCloseOverlay}
      >
        <EpgPanel
          channelName={title}
          programs={epg.programs}
          isLoading={epg.isLoading}
          error={epg.error}
          canPlayCatchup={(program) => buildCatchupUrl(currentChannel, activeServer, program) !== null}
          onPlayCatchup={handlePlayCatchup}
          onClose={handleCloseOverlay}
        />
      </Modal>

      <Modal
        visible={uiLayer === "exit-confirmation"}
        transparent
        animationType="fade"
        onRequestClose={handleCloseOverlay}
      >
        <View style={styles.exitBackdrop}>
          <View style={styles.exitCard}>
            <Ionicons name="exit-outline" size={30} color={Colors.blueBright} />
            <AppText style={styles.exitTitle}>Sair deste conteúdo?</AppText>
            <AppText style={styles.exitBody}>
              Seu progresso será salvo automaticamente.
            </AppText>
            <View style={styles.exitActions}>
              <TVFocusable
                hasTVPreferredFocus
                onPress={handleCloseOverlay}
                style={styles.exitSecondaryButton}
              >
                <AppText style={styles.exitSecondaryText}>Continuar assistindo</AppText>
              </TVFocusable>
              <TVFocusable onPress={handleConfirmExit} style={styles.exitPrimaryButton}>
                <AppText style={styles.exitPrimaryText}>Sair</AppText>
              </TVFocusable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Player Top Bar ──────────────────────────────────────────────────────────

function PlayerTopBar({
  topControlsRef,
  contentType,
  onBack,
  onToggleQuickSwitcher,
  onTogglePip,
  onOpenTracks,
  onCycleRatio,
  favorite,
  onToggleFavorite,
  protectedContent,
  onOpenParentalSettings,
}: {
  topControlsRef: Ref<TVFocusableHandle>;
  contentType: ContentType;
  onBack: () => void;
  onToggleQuickSwitcher: () => void;
  onTogglePip: () => void;
  onOpenTracks: () => void;
  onCycleRatio: () => void;
  favorite: boolean;
  onToggleFavorite: () => void;
  protectedContent: boolean;
  onOpenParentalSettings: () => void;
}) {
  return (
    <View pointerEvents="box-none" style={styles.topBar}>
      <PlayerTopAction icon="arrow-back" label="Voltar" onPress={onBack} />
      <View style={styles.topSpacer} />
      <View style={styles.topActions}>
        <PlayerTopAction ref={topControlsRef} icon="musical-note" label="Faixas de áudio e legendas" onPress={onOpenTracks} />
        {contentType === "live" ? (
          <PlayerTopAction icon="list" label="Abrir grade de canais" onPress={onToggleQuickSwitcher} />
        ) : null}
        <PlayerTopAction
          icon="phone-portrait-outline"
          label="Picture-in-Picture"
          onPress={onTogglePip}
        />
        {contentType === "live" ? (
          <PlayerTopAction
            icon={favorite ? "heart" : "heart-outline"}
            label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            onPress={onToggleFavorite}
            active={favorite}
          />
        ) : null}
        <PlayerTopAction
          icon={protectedContent ? "lock-closed" : "lock-open-outline"}
          label={protectedContent ? "Conteúdo protegido: abrir controle parental" : "Abrir controle parental"}
          onPress={onOpenParentalSettings}
          active={protectedContent}
        />
        <PlayerTopAction icon="scan-outline" label="Alterar proporção de tela" onPress={onCycleRatio} />
      </View>
    </View>
  );
}

type PlayerTopActionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
};

const PlayerTopAction = forwardRef<TVFocusableHandle, PlayerTopActionProps>(function PlayerTopAction({ icon, label, onPress, active = false }, ref) {
  return (
    <TVFocusable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      focusStyle={styles.playerTopActionFocused}
      style={({ pressed }) => [styles.playerTopAction, pressed && styles.playerTopActionPressed]}
    >
      <Ionicons name={icon} size={26} color={active ? Colors.blueBright : Colors.white} />
    </TVFocusable>
  );
});

/** The reference transport cluster stays centered over the video, independent
 * from the program details and progress rail at the bottom. */
function PlayerCenterControls({
  playButtonRef,
  isPlaying,
  isLive,
  onTogglePlayback,
  onBackward,
  onForward,
}: {
  playButtonRef: Ref<TVFocusableHandle>;
  isPlaying: boolean;
  isLive: boolean;
  onTogglePlayback: () => void;
  onBackward: () => void;
  onForward: () => void;
}) {
  return (
    <View pointerEvents="box-none" style={styles.centerControls}>
      <TVFocusable
        accessibilityRole="button"
        accessibilityLabel={isLive ? "Canal anterior" : "Retroceder 10 segundos"}
        onPress={onBackward}
        focusStyle={styles.centerControlFocused}
        style={styles.centerTransportButton}
      >
        <Ionicons name="play-skip-back" size={34} color={Colors.white} />
      </TVFocusable>
      <TVFocusable
        ref={playButtonRef}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? "Pausar" : "Reproduzir"}
        onPress={onTogglePlayback}
        hasTVPreferredFocus
        focusStyle={styles.centerControlFocused}
        style={styles.centerPlayButton}
      >
        <Ionicons name={isPlaying ? "pause" : "play"} size={42} color={Colors.white} />
      </TVFocusable>
      <TVFocusable
        accessibilityRole="button"
        accessibilityLabel={isLive ? "Próximo canal" : "Avançar 10 segundos"}
        onPress={onForward}
        focusStyle={styles.centerControlFocused}
        style={styles.centerTransportButton}
      >
        <Ionicons name="play-skip-forward" size={34} color={Colors.white} />
      </TVFocusable>
    </View>
  );
}

/** Compact touch controls that sit above the bottom OSD instead of inside it. */
function SideAdjustments({
  volume,
  brightness,
  onVolumeChange,
  onBrightnessChange,
  onInteraction,
  safeLeft,
  safeRight,
}: {
  volume: number;
  brightness: number;
  onVolumeChange: (value: number) => void;
  onBrightnessChange: (value: number) => void;
  onInteraction: () => void;
  safeLeft: number;
  safeRight: number;
}) {
  return (
    <>
      <VerticalAdjustment
        side="left"
        icon="sunny-outline"
        value={brightness}
        accessibilityLabel="Ajustar brilho visual"
        onChange={onBrightnessChange}
        onInteraction={onInteraction}
        edgeInset={safeLeft}
      />
      <VerticalAdjustment
        side="right"
        icon={volume === 0 ? "volume-mute-outline" : "volume-high-outline"}
        value={volume}
        accessibilityLabel="Ajustar volume"
        onChange={onVolumeChange}
        onInteraction={onInteraction}
        edgeInset={safeRight}
      />
    </>
  );
}

function VerticalAdjustment({
  side,
  icon,
  value,
  accessibilityLabel,
  onChange,
  onInteraction,
  edgeInset,
}: {
  side: "left" | "right";
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  accessibilityLabel: string;
  onChange: (value: number) => void;
  onInteraction: () => void;
  edgeInset: number;
}) {
  const heightRef = useRef(1);
  const update = useCallback((y: number) => {
    onChange(1 - Math.max(0, Math.min(1, y / heightRef.current)));
    onInteraction();
  }, [onChange, onInteraction]);
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      onLayout={(event) => { heightRef.current = Math.max(1, event.nativeEvent.layout.height); }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => update(event.nativeEvent.locationY)}
      onResponderMove={(event) => update(event.nativeEvent.locationY)}
      style={[
        styles.sideAdjustment,
        side === "left"
          ? [styles.sideAdjustmentLeft, { left: Math.max(18, edgeInset + 18) }]
          : [styles.sideAdjustmentRight, { right: Math.max(50, edgeInset + 18) }],
      ]}
    >
      <Ionicons name={icon} size={25} color={Colors.white} />
      <View style={styles.adjustmentTrack}>
        <View style={[styles.adjustmentFill, { height: `${Math.round(value * 100)}%` }]} />
        <View style={[styles.adjustmentKnob, { bottom: `${Math.round(value * 100)}%` }]} />
      </View>
    </View>
  );
}

// ─── Quick Switcher ───────────────────────────────────────────────────────────

function QuickSwitcher({
  visible,
  channels: channelList,
  favoriteChannelIds,
  currentId,
  onSwitch,
  onClose,
}: {
  visible: boolean;
  channels: ChannelItem[];
  favoriteChannelIds: string[];
  currentId: string;
  onSwitch: (channelId: string) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState("Todos");
  const categories = useMemo(
    () => ["Todos", "Favoritos", ...Array.from(new Set(channelList.map((channel) => channel.categoryName)))],
    [channelList],
  );
  const visibleChannels = useMemo(() => {
    const filtered = category === "Todos"
      ? channelList
      : category === "Favoritos"
        ? channelList.filter((channel) => favoriteChannelIds.includes(channel.id))
        : channelList.filter((channel) => channel.categoryName === category);
    const current = filtered.find((channel) => channel.id === currentId);
    const others = filtered.filter((channel) => channel.id !== currentId);
    return current ? [current, ...others] : others;
  }, [category, channelList, currentId, favoriteChannelIds]);

  if (!visible) return null;
  return (
    <GlassCard style={styles.quickSwitcher} intensity={32}>
      <View style={styles.quickHeader}>
        <View>
          <AppText style={styles.quickKicker}>ZAPPING RÁPIDO</AppText>
          <AppText style={styles.quickTitle}>Escolha a grade de canais</AppText>
        </View>
        <IconButton
          icon="close"
          label="Fechar canais recentes"
          size={34}
          onPress={onClose}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickCategoryScroll} contentContainerStyle={styles.quickCategories}>
        {categories.map((item) => (
          <TVFocusable key={item} onPress={() => setCategory(item)} style={[styles.quickCategory, category === item && styles.quickCategoryActive]}>
            <AppText style={[styles.quickCategoryText, category === item && styles.quickCategoryTextActive]}>{item}</AppText>
          </TVFocusable>
        ))}
      </ScrollView>
      <FlatList
        data={visibleChannels}
        keyExtractor={(channel) => channel.id}
        numColumns={2}
        initialNumToRender={20}
        maxToRenderPerBatch={25}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
        showsVerticalScrollIndicator={false}
        style={styles.quickChannelScroll}
        contentContainerStyle={styles.quickGrid}
        columnWrapperStyle={styles.quickGridRow}
        renderItem={({ item: channel }) => (
          <QuickChannel
            channelId={channel.id}
            name={channel.name}
            logo={channel.logo}
            program={channel.currentEpg.title}
            progress={channel.currentEpg.progress}
            active={channel.id === currentId}
            onSwitch={onSwitch}
          />
        )}
        ListEmptyComponent={<AppText style={styles.quickEmpty}>Nenhum canal disponível nesta grade.</AppText>}
      />
    </GlassCard>
  );
}

function QuickChannel({
  channelId,
  name,
  logo,
  program,
  progress,
  active,
  onSwitch,
}: {
  channelId: string;
  name: string;
  logo: string;
  program: string;
  progress: number;
  active: boolean;
  onSwitch: (channelId: string) => void;
}) {
  const handlePress = useCallback(() => {
    onSwitch(channelId);
  }, [channelId, onSwitch]);

  return (
    <TVFocusable
      accessibilityRole="button"
      onPress={handlePress}
      style={({ pressed }) => [
        styles.quickChannel,
        active && styles.quickChannelActive,
        pressed && styles.pressed,
      ]}
    >
      <ChannelLogo image={logo} name={name} size={36} />
      <View style={styles.quickCopy}>
        <AppText style={styles.quickChannelName}>{name}</AppText>
        <AppText numberOfLines={1} style={styles.quickProgram}>
          {program}
        </AppText>
        <View style={styles.quickProgress}>
          <View style={[styles.quickProgressFill, { width: `${progress}%` }]} />
        </View>
      </View>
      {active ? (
        <Ionicons name="radio" size={16} color={Colors.blueBright} />
      ) : null}
    </TVFocusable>
  );
}

// ─── Player Status ─────────────────────────────────────────────────────────

function PlayerStatus({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <>
      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.white} />
          <AppText style={styles.loadingText}>Preparando reprodução...</AppText>
        </View>
      ) : null}
      {error ? (
        <View style={styles.playerError}>
          <Ionicons name="warning-outline" size={17} color={Colors.amber} />
          <AppText style={styles.playerErrorText}>{error}</AppText>
          <TVFocusable
            accessibilityRole="button"
            onPress={onRetry}
            style={styles.retryButton}
          >
            <AppText style={styles.playerRetry}>Tentar</AppText>
          </TVFocusable>
        </View>
      ) : null}
    </>
  );
}

// ─── Player Bottom Panel ──────────────────────────────────────────────────────

function PlayerBottomPanel({
  title,
  subtitle,
  artwork,
  contentType,
  isPlaying,
  panel,
  currentTime,
  duration,
  progressPct,
  selectedAudio,
  selectedSubtitle,
  audioTracks,
  subtitleTracks,
  playbackRate,
  selectedRatio,
  currentEpg,
  onProgressLayout,
  onProgressGrant,
  onProgressMove,
  onProgressRelease,
  progressBarRef,
  canSkipIntro,
  onSkipIntro,
  nextEpisode,
  onNextEpisode,
  onSelectAudio,
  onSelectSubtitle,
  onSelectSpeed,
  onSelectRatio,
}: {
  title: string;
  subtitle: string;
  artwork: string;
  contentType: ContentType;
  isPlaying: boolean;
  panel: Panel;
  currentTime: number;
  duration: number;
  progressPct: number;
  selectedAudio: AudioTrack | null;
  selectedSubtitle: SubtitleTrack | null;
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  playbackRate: number;
  selectedRatio: RatioOption;
  currentEpg: EpgProgram | null;
  onProgressLayout: (e: LayoutChangeEvent) => void;
  onProgressGrant: (e: GestureResponderEvent) => void;
  onProgressMove: (e: GestureResponderEvent) => void;
  onProgressRelease: () => void;
  progressBarRef: Ref<View>;
  canSkipIntro: boolean;
  onSkipIntro: () => void;
  nextEpisode?: SeriesEpisodeNavigation;
  onNextEpisode: () => void;
  onSelectAudio: (option: AudioTrack) => void;
  onSelectSubtitle: (option: SubtitleTrack | null) => void;
  onSelectSpeed: (value: number) => void;
  onSelectRatio: (option: RatioOption) => void;
}) {
  const isLive = contentType === "live";
  const liveProgressPct = Math.max(2, Math.min(100, currentEpg?.progress ?? 2));

  const leftLabel = isLive
    ? currentTime > 0
      ? new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "AO VIVO"
    : formatTime(currentTime);

  const rightLabel = isLive ? "AO VIVO" : formatRemaining(currentTime, duration);

  return (
    <View style={styles.bottomPanel}>
      <View style={styles.mediaSummary}>
        <ChannelLogo image={artwork} name={title} size={52} />
        <View style={styles.mediaSummaryCopy}>
          <AppText numberOfLines={1} style={styles.mediaSummaryMeta}>
            {isLive ? "10 · Grupo: Canais" : contentType === "episode" ? "SÉRIE" : "FILME"}
            {!isLive && subtitle ? ` · ${subtitle}` : ""}
          </AppText>
          <AppText numberOfLines={1} style={styles.mediaSummaryTitle}>{title}</AppText>
          <AppText numberOfLines={1} style={styles.mediaSummaryProgram}>
            {isLive ? currentEpg?.title ?? "Programação não informada" : isPlaying ? "Reproduzindo" : "Pausado"}
          </AppText>
        </View>
        {isLive ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveBadgeDot} />
            <AppText style={styles.liveBadgeText}>LIVE</AppText>
          </View>
        ) : null}
      </View>
      {contentType === "episode" && (canSkipIntro || nextEpisode) ? (
        <View style={styles.episodeActions}>
          {canSkipIntro ? (
            <TVFocusable
              accessibilityRole="button"
              accessibilityLabel="Pular abertura"
              onPress={onSkipIntro}
              focusStyle={styles.whiteActionFocused}
              style={styles.episodeActionPrimary}
            >
              <Ionicons name="play-skip-forward-outline" size={16} color={Colors.black} />
              <AppText style={styles.episodeActionPrimaryText}>Pular abertura</AppText>
            </TVFocusable>
          ) : null}
          {nextEpisode ? (
            <TVFocusable
              accessibilityRole="button"
              accessibilityLabel={`Próximo episódio: ${nextEpisode.title}`}
              onPress={onNextEpisode}
              style={styles.episodeActionSecondary}
            >
              <AppText numberOfLines={1} style={styles.episodeActionSecondaryText}>
                Próximo episódio
              </AppText>
              <Ionicons name="play-skip-forward-outline" size={16} color={Colors.white} />
            </TVFocusable>
          ) : null}
        </View>
      ) : null}
      {/* Progress / Timeline */}
      <View style={styles.timelineRow}>
        <AppText style={styles.timeText}>{leftLabel}</AppText>
        <View
          ref={progressBarRef}
          onLayout={onProgressLayout}
          onStartShouldSetResponder={() => !isLive}
          onMoveShouldSetResponder={() => !isLive}
          onResponderGrant={onProgressGrant}
          onResponderMove={onProgressMove}
          onResponderRelease={onProgressRelease}
          onResponderTerminationRequest={() => true}
          style={[styles.timeline, isLive && styles.timelineLive]}
        >
          <View
            style={[
              styles.timelineFill,
              isLive
                ? [styles.timelineFillLive, { width: `${liveProgressPct}%` }]
                : { width: `${Math.round(progressPct * 100)}%` },
            ]}
          />
          {!isLive ? (
            <View
              style={[
                styles.timelineKnob,
                { left: `${Math.round(Math.max(0, progressPct * 100 - 1))}%` },
              ]}
            />
          ) : null}
        </View>
        <AppText style={styles.timeText}>{rightLabel}</AppText>
      </View>

      {panel ? (
        <ActivePanelSection
          panel={panel}
          selectedAudio={selectedAudio}
          selectedSubtitle={selectedSubtitle}
          audioTracks={audioTracks}
          subtitleTracks={subtitleTracks}
          playbackRate={playbackRate}
          selectedRatio={selectedRatio}
          onSelectAudio={onSelectAudio}
          onSelectSubtitle={onSelectSubtitle}
          onSelectSpeed={onSelectSpeed}
          onSelectRatio={onSelectRatio}
        />
      ) : null}
    </View>
  );
}

type ActivePanelSectionProps = {
  panel: ActivePanel;
  selectedAudio: AudioTrack | null;
  selectedSubtitle: SubtitleTrack | null;
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  playbackRate: number;
  selectedRatio: RatioOption;
  onSelectAudio: (o: AudioTrack) => void;
  onSelectSubtitle: (o: SubtitleTrack | null) => void;
  onSelectSpeed: (v: number) => void;
  onSelectRatio: (o: RatioOption) => void;
};

function trackKey(track: AudioTrack | SubtitleTrack): string {
  return track.id ?? `${track.language}:${track.label}:${track.name ?? ""}`;
}

function trackLabel(track: AudioTrack | SubtitleTrack): string {
  const name = track.name?.trim() || track.label?.trim();
  const language = track.language?.trim();
  if (name && language && name.toLocaleLowerCase() !== language.toLocaleLowerCase()) {
    return `${name} (${language})`;
  }
  return name || language || "Faixa padrão";
}

function ActivePanelSection(props: ActivePanelSectionProps) {
  const { panel, selectedAudio, selectedSubtitle, audioTracks, subtitleTracks, playbackRate, selectedRatio,
    onSelectAudio, onSelectSubtitle, onSelectSpeed, onSelectRatio } = props;

  if (panel === "audio") {
    return (
      <OptionPanel title="Faixa de Áudio">
        {audioTracks.map((track) => (
          <OptionChip key={trackKey(track)} label={trackLabel(track)} selected={selectedAudio ? trackKey(track) === trackKey(selectedAudio) : track.isDefault === true} onSelect={() => onSelectAudio(track)} />
        ))}
      </OptionPanel>
    );
  }
  if (panel === "subtitles") {
    return (
      <OptionPanel title="Legendas">
        <OptionChip label="Desativadas" selected={selectedSubtitle === null} onSelect={() => onSelectSubtitle(null)} />
        {subtitleTracks.map((track) => (
          <OptionChip key={trackKey(track)} label={trackLabel(track)} selected={selectedSubtitle ? trackKey(track) === trackKey(selectedSubtitle) : false} onSelect={() => onSelectSubtitle(track)} />
        ))}
      </OptionPanel>
    );
  }
  if (panel === "speed") {
    return (
      <OptionPanel title="Velocidade de Reprodução">
        {SPEED_OPTIONS.map((opt) => (
          <OptionChip key={opt.label} label={opt.label} selected={opt.value === playbackRate} onSelect={() => onSelectSpeed(opt.value)} />
        ))}
      </OptionPanel>
    );
  }
  if (panel === "ratio") {
    return (
      <OptionPanel title="Proporção de Tela">
        {RATIO_OPTIONS.map((opt) => (
          <OptionChip key={opt.label} label={opt.label} selected={opt.label === selectedRatio.label} onSelect={() => onSelectRatio(opt)} />
        ))}
      </OptionPanel>
    );
  }
  return null;
}

function PlayerOptionButton({
  icon,
  label,
  panel,
  active,
  onPanelChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  panel: ActivePanel;
  active: boolean;
  onPanelChange: (panel: Panel) => void;
}) {
  const handlePress = useCallback(() => {
    onPanelChange(panel);
  }, [onPanelChange, panel]);

  return (
    <TVFocusable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.optionButton,
        active && styles.optionButtonActive,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={18}
        color={active ? Colors.blueBright : Colors.text}
      />
      <AppText style={[styles.optionLabel, active && styles.optionLabelActive]}>
        {label}
      </AppText>
    </TVFocusable>
  );
}

function OptionPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <GlassCard style={styles.optionMenu} intensity={28}>
      <AppText style={styles.optionMenuTitle}>{title}</AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={styles.optionValues}
      >
        {children}
      </ScrollView>
    </GlassCard>
  );
}

function OptionChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const handlePress = useCallback(() => {
    onSelect();
  }, [onSelect]);

  return (
    <TVFocusable
      accessibilityRole="button"
      onPress={handlePress}
      style={[styles.optionValue, selected && styles.optionValueSelected]}
    >
      <AppText
        style={[
          styles.optionValueText,
          selected && styles.optionValueTextSelected,
        ]}
      >
        {label}
      </AppText>
      {selected ? (
        <Ionicons name="checkmark" size={14} color={Colors.blueBright} />
      ) : null}
    </TVFocusable>
  );
}

// ─── EPG Panel ────────────────────────────────────────────────────────────────

function EpgPanel({
  channelName,
  programs,
  isLoading,
  error,
  canPlayCatchup,
  onPlayCatchup,
  onClose,
}: {
  channelName: string;
  programs: EpgProgram[];
  isLoading: boolean;
  error: string | null;
  canPlayCatchup: (program: EpgProgram) => boolean;
  onPlayCatchup: (program: EpgProgram) => void;
  onClose: () => void;
}) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();

  return (
    <View style={styles.modalBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <GlassCard style={styles.epgSheet} intensity={34}>
        {/* Header */}
        <View style={styles.epgHeader}>
          <View style={styles.epgHeaderLeft}>
            <View style={styles.epgLiveDot} />
            <AppText style={styles.epgKicker}>GUIA DE PROGRAMAÇÃO</AppText>
          </View>
          <AppText style={styles.epgChannelName} numberOfLines={1}>
            {channelName}
          </AppText>
          <TVFocusable onPress={onClose} style={styles.epgCloseBtn} accessibilityLabel="Fechar guia">
            <Ionicons name="close" size={20} color={Colors.text} />
          </TVFocusable>
        </View>

        {/* Live time indicator */}
        <View style={styles.epgTimeRow}>
          <Ionicons name="time-outline" size={14} color={Colors.blueBright} />
          <AppText style={styles.epgCurrentTime}>
            {String(currentHour).padStart(2, "0")}:
            {String(currentMin).padStart(2, "0")} — Horário atual
          </AppText>
        </View>

        {/* Program list */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.epgList}
        >
          {isLoading && programs.length === 0 ? (
            <View style={styles.epgState}>
              <ActivityIndicator color={Colors.blueBright} />
              <AppText style={styles.epgStateText}>Buscando programação real...</AppText>
            </View>
          ) : null}
          {!isLoading && programs.length === 0 ? (
            <View style={styles.epgState}>
              <Ionicons name="calendar-outline" size={24} color={Colors.subtle} />
              <AppText style={styles.epgStateText}>{error ?? "Este canal não forneceu dados de EPG."}</AppText>
            </View>
          ) : null}
          {programs.map((entry) => (
            <EpgProgramRow
              key={`${entry.startTimestamp ?? entry.start}-${entry.title}`}
              entry={entry}
              canPlayCatchup={canPlayCatchup(entry)}
              onPlayCatchup={onPlayCatchup}
            />
          ))}
        </ScrollView>
      </GlassCard>
    </View>
  );
}

function EpgProgramRow({ entry, canPlayCatchup, onPlayCatchup }: { entry: EpgProgram; canPlayCatchup: boolean; onPlayCatchup: (program: EpgProgram) => void }) {
  return (
    <View
      style={[styles.epgEntry, entry.isCurrent && styles.epgEntryCurrent]}
    >
      <View style={styles.epgEntryTime}>
        <AppText
          style={[
            styles.epgTime,
            entry.isCurrent && styles.epgTimeCurrent,
          ]}
        >
          {entry.start}
        </AppText>
        <AppText style={styles.epgTimeEnd}>{entry.end}</AppText>
      </View>
      <View style={styles.epgEntryContent}>
        <View style={styles.epgEntryHeader}>
          {entry.isCurrent ? (
            <View style={styles.epgNowBadge}>
              <AppText style={styles.epgNowText}>AO VIVO</AppText>
            </View>
          ) : null}
          <AppText
            style={[
              styles.epgTitle,
              entry.isCurrent && styles.epgTitleCurrent,
            ]}
            numberOfLines={1}
          >
            {entry.title}
          </AppText>
        </View>
        {entry.isCurrent ? (
          <View style={styles.epgProgressBar}>
            <View
              style={[
                styles.epgProgressFill,
                { width: `${entry.progress}%` },
              ]}
            />
          </View>
        ) : null}
        <AppText style={styles.epgDescription} numberOfLines={2}>
          {entry.description}
        </AppText>
        {canPlayCatchup ? (
          <TVFocusable onPress={() => onPlayCatchup(entry)} style={styles.catchupButton} accessibilityLabel={`Assistir ${entry.title} desde o início`}>
            <Ionicons name="play-back-outline" size={14} color={Colors.blueBright} />
            <AppText style={styles.catchupButtonText}>Assistir do início</AppText>
          </TVFocusable>
        ) : null}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden", backgroundColor: Colors.black },
  backdropVeil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.44)",
  },
  brightnessVeil: { backgroundColor: Colors.black },
  tapOverlay: { ...StyleSheet.absoluteFill },
  videoAspectContainer: { alignSelf: "center" },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  osdLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
  },
  exitBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  exitCard: {
    width: "100%",
    maxWidth: 430,
    alignItems: "center",
    gap: 12,
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: "rgba(15, 23, 42, 0.98)",
    ...Shadows.card,
  },
  exitTitle: { fontFamily: "Inter_700Bold", fontSize: 21, color: Colors.text },
  exitBody: { fontSize: 13, color: Colors.muted, textAlign: "center" },
  exitActions: { width: "100%", flexDirection: "row", gap: 12, marginTop: 8 },
  exitSecondaryButton: {
    flex: 1,
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  exitSecondaryText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  exitPrimaryButton: {
    minWidth: 92,
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 24,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.82)",
    backgroundColor: Colors.white,
  },
  exitPrimaryText: { fontFamily: "Inter_700Bold", fontSize: 12, color: Colors.background },

  // Buffering
  bufferingOverlay: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    alignItems: "center",
    gap: 8,
    padding: 18,
    borderRadius: 16,
    backgroundColor: "rgba(7,9,14,0.72)",
  },
  bufferingText: {
    fontSize: 11,
    color: Colors.text,
  },
  channelNumberOverlay: {
    position: "absolute",
    top: 34,
    right: 34,
    minWidth: 104,
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.62)",
    backgroundColor: "rgba(7,9,14,0.90)",
  },
  channelNumberLabel: { fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 1.3, color: Colors.blueBright },
  channelNumberValue: { fontFamily: "Inter_700Bold", fontSize: 28, color: Colors.white },

  // Top bar — bare glyphs preserve the light, floating reference composition.
  topBar: { flexDirection: "row", alignItems: "center" },
  topSpacer: { flex: 1 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  playerTopAction: {
    width: 28,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  playerTopActionPressed: { opacity: 0.64 },
  playerTopActionFocused: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.82)",
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.18)",
    transform: [{ scale: 1 }],
    shadowOpacity: 0,
    elevation: 0,
  },

  // Center transport: visually detached from the lower information region.
  centerControls: {
    position: "absolute",
    top: "43%",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 90,
  },
  centerTransportButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "transparent",
  },
  centerPlayButton: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: "transparent",
  },
  centerControlFocused: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.78)",
    backgroundColor: "rgba(0,0,0,0.18)",
    transform: [{ scale: 1 }],
    shadowOpacity: 0,
    elevation: 0,
  },

  // Side sliders stay outside the information block, leaving them reachable on phones.
  sideAdjustment: {
    position: "absolute",
    top: "27%",
    bottom: "34%",
    zIndex: 20,
    width: 32,
    alignItems: "center",
    gap: 10,
    paddingVertical: 2,
  },
  sideAdjustmentLeft: { left: 14 },
  sideAdjustmentRight: { right: 14 },
  adjustmentTrack: {
    flex: 1,
    width: 3,
    overflow: "visible",
    justifyContent: "flex-end",
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.48)",
  },
  adjustmentFill: { width: "100%", borderRadius: 2, backgroundColor: Colors.white },
  adjustmentKnob: {
    position: "absolute",
    alignSelf: "center",
    width: 14,
    height: 14,
    borderRadius: 7,
    marginBottom: -7,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: "rgba(7,9,14,0.48)",
  },

  // Quick switcher
  quickSwitcher: {
    position: "absolute",
    top: 75,
    right: 18,
    left: 18,
    padding: 12,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(17,23,36,0.82)",
    ...Shadows.card,
  },
  quickHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  quickKicker: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 8,
    letterSpacing: 1,
    color: Colors.blueBright,
  },
  quickTitle: {
    marginTop: 3,
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: Colors.white,
  },
  quickCategoryScroll: { flexGrow: 0, marginBottom: 8 },
  quickCategories: { gap: 6, paddingRight: 8 },
  quickCategory: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  quickCategoryActive: {
    borderColor: "rgba(96,165,250,0.6)",
    backgroundColor: "rgba(59,130,246,0.22)",
  },
  quickCategoryText: { fontSize: 10, color: Colors.muted },
  quickCategoryTextActive: { color: Colors.white },
  quickChannelScroll: { maxHeight: 230 },
  quickGrid: { gap: 6 },
  quickGridRow: { gap: 6 },
  quickEmpty: { paddingVertical: 20, textAlign: "center", color: Colors.subtle },
  quickChannel: {
    flex: 1,
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 7,
    borderRadius: 12,
  },
  quickChannelActive: { backgroundColor: "rgba(59,130,246,0.15)" },
  quickCopy: { flex: 1, gap: 3 },
  quickChannelName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.white,
  },
  quickProgram: { fontSize: 10, color: "rgba(255,255,255,0.68)" },
  quickProgress: {
    height: 3,
    overflow: "hidden",
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  quickProgressFill: { height: "100%", backgroundColor: Colors.blueBright },

  // Loading / Error
  loadingOverlay: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    alignItems: "center",
    gap: 10,
    padding: 17,
    borderRadius: 16,
    backgroundColor: "rgba(7,9,14,0.65)",
  },
  loadingText: { fontSize: 12, color: Colors.white },
  playerError: {
    position: "absolute",
    top: "44%",
    right: 24,
    left: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(7,9,14,0.84)",
  },
  playerErrorText: { flex: 1, fontSize: 11, color: Colors.text },
  playerRetry: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.blueBright,
  },
  retryButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 8,
    borderRadius: 9,
  },

  // Bottom panel
  bottomPanel: {
    width: "100%",
    alignSelf: "stretch",
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
  mediaSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 2,
  },
  mediaSummaryCopy: { flex: 1, gap: 2 },
  mediaSummaryMeta: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    lineHeight: 14,
    color: "rgba(255,255,255,0.82)",
  },
  mediaSummaryTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    lineHeight: 31,
    color: Colors.white,
  },
  mediaSummaryProgram: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 16,
    color: "rgba(255,255,255,0.86)",
  },
  episodeActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    paddingLeft: 64,
  },
  episodeActionPrimary: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: 17,
    backgroundColor: Colors.white,
  },
  whiteActionFocused: { backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.blueBright, opacity: 1, transform: [{ scale: 1.025 }] },
  episodeActionPrimaryText: { fontFamily: "Inter_700Bold", fontSize: 11, color: Colors.black },
  episodeActionSecondary: {
    minHeight: 34,
    maxWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    backgroundColor: "rgba(7,9,14,0.48)",
  },
  episodeActionSecondaryText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.white },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 5,
    backgroundColor: "rgba(7,9,14,0.72)",
  },
  liveBadgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.red },
  liveBadgeText: { fontFamily: "Inter_700Bold", fontSize: 11, color: Colors.white },
  liveEpgBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  liveEpgNow: { flex: 1.25, flexDirection: "row", alignItems: "center", gap: 6 },
  liveEpgNext: { flex: 1, gap: 2 },
  liveEpgDivider: { width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.12)" },
  liveEpgLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.8,
    color: Colors.blueBright,
  },
  liveEpgCopy: { flex: 1, gap: 2 },
  liveEpgTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, lineHeight: 18, color: Colors.white },
  liveEpgNextTitle: { fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 17, color: Colors.text },
  liveEpgTime: { fontSize: 12, color: Colors.subtle },

  // Timeline / seek bar
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeText: {
    minWidth: 48,
    fontVariant: ["tabular-nums"],
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.white,
  },
  timeline: {
    flex: 1,
    height: 4,
    overflow: "visible",
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  timelineLive: {},
  timelineFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: Colors.white,
  },
  timelineFillLive: {
    backgroundColor: Colors.blueBright,
  },
  timelineKnob: {
    position: "absolute",
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.3)",
  },

  // Option row
  optionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  optionButton: {
    minWidth: 58,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 8,
    borderRadius: 9,
  },
  optionButtonActive: { backgroundColor: "rgba(59,130,246,0.16)" },
  optionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 8,
    color: "rgba(255,255,255,0.72)",
  },
  optionLabelActive: { color: Colors.blueBright },

  // Option panel
  optionMenu: {
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  optionMenuTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.white,
  },
  optionValues: { flexDirection: "row", gap: 7, paddingBottom: 2 },
  optionValue: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  optionValueSelected: {
    borderColor: "rgba(96,165,250,0.5)",
    backgroundColor: "rgba(59,130,246,0.2)",
  },
  optionValueText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.muted,
  },
  optionValueTextSelected: { color: Colors.white },

  // EPG Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  epgSheet: {
    maxHeight: "75%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // Keep this translucent: EpgPanel is a GlassCard and an opaque surface
    // here would visually cancel the BlurView behind its contents.
    backgroundColor: "rgba(13,17,26,0.78)",
    borderTopWidth: 1,
    borderTopColor: "rgba(173,216,255,0.24)",
    paddingTop: 4,
    paddingBottom: 30,
    ...Shadows.card,
  },
  epgHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  epgHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  epgLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.red,
  },
  epgKicker: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.blueBright,
  },
  epgChannelName: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.text,
  },
  epgCloseBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  epgTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  epgCurrentTime: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.blueBright,
  },
  epgList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 8,
  },
  epgState: { alignItems: "center", paddingVertical: 34, gap: 10 },
  epgStateText: { fontSize: 11, textAlign: "center", color: Colors.muted },
  epgEntry: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  epgEntryCurrent: {
    borderColor: "rgba(96,165,250,0.4)",
    backgroundColor: "rgba(59,130,246,0.1)",
  },
  epgEntryTime: {
    width: 46,
    alignItems: "flex-end",
    gap: 3,
    paddingTop: 2,
  },
  epgTime: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.muted,
  },
  epgTimeCurrent: { color: Colors.blueBright },
  epgTimeEnd: { fontSize: 10, color: Colors.subtle },
  epgEntryContent: { flex: 1, gap: 6 },
  epgEntryHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  epgNowBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: Colors.red,
  },
  epgNowText: {
    fontFamily: "Inter_700Bold",
    fontSize: 8,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  epgTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  epgTitleCurrent: { color: Colors.white },
  epgProgressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
  },
  epgProgressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: Colors.blueBright,
  },
  epgDescription: { fontSize: 11, lineHeight: 16, color: Colors.muted },
  catchupButton: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(59,130,246,0.13)" },
  catchupButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.blueBright },

  pressed: { opacity: 0.72 },
});
