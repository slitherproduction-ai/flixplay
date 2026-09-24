import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { DEMO_STREAM_URL } from "@/data/demo";
import { Colors, Shadows } from "@/constants/theme";
import { TVFocusable, type TVFocusableHandle } from "@/components/tv-focusable";
import { AppText, ChannelLogo, GlassCard, IconButton } from "@/components/ui";
import { useScreenLoad } from "@/hooks/useScreenLoad";
import {
  getTVRemoteEvent,
  useTVRemote,
  type TVKeyDownEvent,
  type TVRemoteEvent,
} from "@/hooks/use-tv-remote";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useChannelEpg } from "@/hooks/useChannelEpg";
import { useAppStore } from "@/store/useAppStore";
import { reducePlayerUi, type PlayerUiLayer } from "@/store/playerUiState";
import type { ChannelItem, ContentType, EpgProgram } from "@/store/types";

const IPTV_HEADERS = { "User-Agent": "IPTVSmartersPro/3.1.5" };
const OSD_AUTO_HIDE_MS = 4000;

function buildFallbackUrls(url: string, contentType: ContentType): string[] {
  if (contentType !== "live") return [url];
  const base = url.replace(/\.(m3u8|ts)$/i, "");
  if (/\.m3u8$/i.test(url)) return [url, `${base}.ts`];
  if (/\.ts$/i.test(url)) return [url, `${base}.m3u8`];
  return [`${url}.m3u8`, `${url}.ts`, url];
}

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

type Panel = "audio" | "subtitles" | "speed" | "ratio" | "buffer" | null;
type ActivePanel = Exclude<Panel, null>;


const AUDIO_OPTIONS = [
  "Português (Original)",
  "Inglês (Dublado)",
  "Espanhol",
  "Áudio 2",
];

const SUBTITLE_OPTIONS = [
  "Desativadas",
  "Português",
  "Inglês",
  "Espanhol",
];

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

const BUFFER_OPTIONS = [
  {
    label: "Rápido (1s)",
    desc: "Baixa latência — ideal para eventos ao vivo",
    value: "Rápido",
  },
  {
    label: "Normal (3s)",
    desc: "Equilibrado — padrão recomendado",
    value: "Normal",
  },
  {
    label: "Estável / Alto (8s)",
    desc: "Anti-travamento — conexões instáveis",
    value: "Estável",
  },
];

type CastDevice = {
  id: string;
  name: string;
  type: "chromecast" | "smarttv" | "appletv" | "androidtv";
  status: "available" | "connected" | "busy";
};

const MOCK_CAST_DEVICES: CastDevice[] = [
  { id: "cc1", name: "Chromecast Sala", type: "chromecast", status: "available" },
  { id: "lg1", name: "Smart TV LG WebOS", type: "smarttv", status: "available" },
  { id: "atv1", name: "Apple TV 4K", type: "appletv", status: "available" },
  { id: "atv2", name: "Android TV Quarto", type: "androidtv", status: "available" },
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
    console.error("Não foi possível ler duração do player", durErr);
  }
}

function extractErrorMessage(status: unknown): string {
  return (
    (status as { error?: { message?: string } }).error?.message ??
    "O stream não pôde ser reproduzido."
  );
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
  showControlsWithTimer: () => void;
  setPanel: React.Dispatch<React.SetStateAction<Panel>>;
};

function usePlayerRemote(p: RemoteHandlerParams) {
  return useCallback(
    (event: TVRemoteEvent) => {
      if (event === "back") {
        p.handleBackPress();
        return;
      }
      if (p.uiLayer !== "osd") {
        if (p.uiLayer === "hidden") p.showControlsWithTimer();
        return;
      }
      p.showControlsWithTimer();
      if (event === "select") {
        handleSelectEvent(p);
        return;
      }
      if (event === "left") { p.handleSeek(-10); return; }
      if (event === "right") { p.handleSeek(10); return; }
      if (event === "up") { handleUpEvent(p); return; }
      if (event === "down") { handleDownEvent(p); return; }
    },
    // eslint dependencies mirror RemoteHandlerParams fields used inside
    [p],
  );
}

function handleSelectEvent(p: RemoteHandlerParams) {
  if (p.panel) {
    p.setPanel(null);
  } else {
    p.handleTogglePlayback();
  }
}

function handleUpEvent(p: RemoteHandlerParams) {
  if (p.contentType === "live") {
    p.openQuickSwitcher();
  }
}

function handleDownEvent(p: RemoteHandlerParams) {
  p.showControlsWithTimer();
  p.setPanel(null);
  setTimeout(() => p.playButtonRef.current?.focus(), 0);
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
  const id = readParam(params.id) ?? "demo-player";
  const title = readParam(params.title) ?? "FlixPlay Demo";
  const type = readParam(params.type) ?? "movie";
  const streamUrl = readParam(params.streamUrl) ?? DEMO_STREAM_URL;
  const sourceSubtitle = readParam(params.subtitle) ?? "Retomar reprodução";
  const sourceThumbnail = readParam(params.thumbnail) ?? "";
  const sourceSeriesId = readParam(params.seriesId);
  const { loading, error, retry } = useScreenLoad("o player");
  const tvMode = useTVMode();
  const saveHistory = useAppStore((state) => state.saveHistory);
  const removeHistoryItem = useAppStore((state) => state.removeHistoryItem);
  const preferences = useAppStore((state) => state.preferences);
  const allChannels = useAppStore((state) => state.contentCache.liveChannels);
  const favoriteChannelIds = useAppStore((state) => state.favoriteChannelIds);
  const cachedMovies = useAppStore((state) => state.contentCache.vodMovies);
  const activatePip = useAppStore((state) => state.activatePip);

  const contentType: ContentType = resolveContentType(type);

  // ─── Player state ────────────────────────────────────────────────────────────
  const [uiLayer, dispatchUi] = useReducer(reducePlayerUi, "osd");
  const controlsVisible = uiLayer === "osd";
  const [panel, setPanel] = useState<Panel>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  // ─── Progress tracking ───────────────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressBarWidthRef = useRef(0);
  const isDraggingRef = useRef(false);
  const durationSetRef = useRef(false);

  // ─── Options state ───────────────────────────────────────────────────────────
  const [selectedAudio, setSelectedAudio] = useState(AUDIO_OPTIONS[0]);
  const [selectedSubtitle, setSelectedSubtitle] = useState(SUBTITLE_OPTIONS[0]);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [selectedRatio, setSelectedRatio] = useState<RatioOption>(RATIO_OPTIONS[0]);
  const bufferMode =
    typeof preferences.bufferMode === "string"
      ? preferences.bufferMode
      : "Normal";
  const setPreference = useAppStore((state) => state.setPreference);

  // ─── Overlays ─────────────────────────────────────────────────────────────
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
  const playButtonRef = useRef<TVFocusableHandle>(null);
  const videoViewRef = useRef<VideoView>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const osdOpacity = useRef(new Animated.Value(1)).current;
  const urlAttemptRef = useRef(0);
  const resumeAppliedRef = useRef(false);
  const lastSavedSecondRef = useRef(0);
  const latestPositionRef = useRef(0);
  const latestDurationRef = useRef(0);

  const fallbackUrls = useMemo(
    () => buildFallbackUrls(streamUrl, contentType),
    [streamUrl, contentType],
  );

  const player = useVideoPlayer(
    { uri: fallbackUrls[0], headers: IPTV_HEADERS },
    (videoPlayer) => {
      videoPlayer.loop = false;
      videoPlayer.timeUpdateEventInterval = 1;
      videoPlayer.play();
    },
  );
  // Ref gives mutable access to the player without triggering the
  // react-hooks/immutability rule, which blocks direct mutation of hook values.
  const playerRef = useRef(player);
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  const currentChannel = allChannels.find((ch) => ch.id === id);
  const backdrop =
    sourceThumbnail ||
    currentChannel?.logo ||
    cachedMovies.find((movie) => movie.id === id)?.backdrop ||
    "";
  const epg = useChannelEpg(contentType === "live" ? id : undefined);

  const persistProgress = useCallback(
    (positionSeconds: number, durationSeconds: number) => {
      if (contentType === "live" || durationSeconds <= 0 || positionSeconds < 5) return;
      const progress = positionSeconds / durationSeconds;
      if (progress >= 0.95 || durationSeconds - positionSeconds <= 60) {
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
        positionMs: Math.round(positionSeconds * 1000),
        durationMs: Math.round(durationSeconds * 1000),
        updatedAt: new Date().toISOString(),
      });
    },
    [backdrop, contentType, id, removeHistoryItem, saveHistory, sourceSeriesId, sourceSubtitle, streamUrl, title],
  );

  useEffect(() => {
    resumeAppliedRef.current = false;
    lastSavedSecondRef.current = 0;
    latestPositionRef.current = 0;
    latestDurationRef.current = 0;
  }, [id]);

  // ─── Player event listeners ──────────────────────────────────────────────
  useEffect(() => {
    urlAttemptRef.current = 0;
    durationSetRef.current = false;

    const durationRefs = { durationSetRef };
    const statusSub = player.addListener("statusChange", (status) => {
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
          if (resumeSeconds >= 5 && resumeSeconds < mediaDuration * 0.95) {
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
          player.replace({ uri: fallbackUrls[nextAttempt], headers: IPTV_HEADERS });
          player.play();
        } catch (replaceErr) {
          console.error("Falha ao tentar URL de fallback", replaceErr);
          setPlayerError(extractErrorMessage(status));
        }
      } else {
        setPlayerError(extractErrorMessage(status));
      }
    });

    const timeSub = player.addListener(
      "timeUpdate" as Parameters<typeof player.addListener>[0],
      (payload: unknown) => {
        const tp = payload as { currentTime?: number };
        if (typeof tp.currentTime === "number") {
          setCurrentTime(tp.currentTime);
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

    return () => {
      statusSub.remove();
      timeSub.remove();
    };
  }, [contentType, fallbackUrls, id, persistProgress, player]);

  useEffect(() => {
    const endSub = player.addListener("playToEnd", () => removeHistoryItem(id));
    return () => {
      endSub.remove();
      persistProgress(latestPositionRef.current, latestDurationRef.current);
    };
  }, [id, persistProgress, player, removeHistoryItem]);

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
      console.error("Falha ao definir velocidade de reprodução", rateErr);
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
    }, OSD_AUTO_HIDE_MS);
  }, [clearHideTimer]);

  useEffect(() => {
    Animated.timing(osdOpacity, {
      toValue: controlsVisible ? 1 : 0,
      duration: controlsVisible ? 160 : 260,
      useNativeDriver: true,
    }).start();
  }, [controlsVisible, osdOpacity]);

  useEffect(() => {
    showControlsWithTimer();
    return clearHideTimer;
  }, [clearHideTimer, showControlsWithTimer]);

  // ─── Seek bar handlers ───────────────────────────────────────────────────
  const handleProgressLayout = useCallback((e: LayoutChangeEvent) => {
    progressBarWidthRef.current = e.nativeEvent.layout.width;
  }, []);

  const seekToPercent = useCallback(
    (pct: number) => {
      if (contentType === "live" || duration <= 0) return;
      const targetSecs = Math.max(0, Math.min(duration, pct * duration));
      const delta = targetSecs - currentTime;
      try {
        player.seekBy(delta);
        setCurrentTime(targetSecs);
      } catch (seekErr) {
        console.error("Falha ao buscar posição no seek bar", seekErr);
      }
    },
    [contentType, currentTime, duration, player],
  );

  const handleProgressGrant = useCallback(
    (e: GestureResponderEvent) => {
      isDraggingRef.current = true;
      const x = e.nativeEvent.locationX;
      const pct = Math.max(0, Math.min(1, x / Math.max(1, progressBarWidthRef.current)));
      seekToPercent(pct);
      showControlsWithTimer();
    },
    [seekToPercent, showControlsWithTimer],
  );

  const handleProgressMove = useCallback(
    (e: GestureResponderEvent) => {
      if (!isDraggingRef.current) return;
      const x = e.nativeEvent.locationX;
      const pct = Math.max(0, Math.min(1, x / Math.max(1, progressBarWidthRef.current)));
      // Update visual immediately, seek throttled
      if (duration > 0) setCurrentTime(pct * duration);
      seekToPercent(pct);
    },
    [duration, seekToPercent],
  );

  const handleProgressRelease = useCallback(() => {
    isDraggingRef.current = false;
    showControlsWithTimer();
  }, [showControlsWithTimer]);

  // ─── Playback controls ───────────────────────────────────────────────────
  const handleConfirmExit = useCallback(() => {
    try {
      persistProgress(currentTime, duration);
    } catch (saveError) {
      console.error("Falha ao salvar histórico do player", saveError);
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
      player.pause();
    } else {
      player.play();
    }
    setIsPlaying((v) => !v);
  }, [isPlaying, player]);

  const handleSeek = useCallback(
    (seconds: number) => {
      if (contentType === "live") return;
      try {
        player.seekBy(seconds);
        setCurrentTime((t) => Math.max(0, t + seconds));
        showControlsWithTimer();
        setPlayerError(null);
      } catch (seekError) {
        console.error("Falha ao buscar no stream", seekError);
        setPlayerError("Não foi possível alterar o ponto da reprodução.");
      }
    },
    [contentType, player, showControlsWithTimer],
  );

  const handlePanel = useCallback((nextPanel: Panel) => {
    setPanel((current) => (current === nextPanel ? null : nextPanel));
    showControlsWithTimer();
  }, [showControlsWithTimer]);

  const handleSwitchChannel = useCallback(
    (channelId: string) => {
      const channel = allChannels.find((item) => item.id === channelId);
      if (!channel) return;
      try {
        urlAttemptRef.current = 0;
        durationSetRef.current = false;
        player.replace({ uri: channel.streamUrl, headers: IPTV_HEADERS });
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
        console.error("Falha ao trocar de canal", switchError);
        setPlayerError("Não foi possível trocar para este canal.");
      }
    },
    [allChannels, player, router, showControlsWithTimer],
  );

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
    setPlayerError(null);
    urlAttemptRef.current = 0;
    durationSetRef.current = false;
    try {
      player.replace({ uri: fallbackUrls[0], headers: IPTV_HEADERS });
      player.play();
    } catch (retryErr) {
      console.error("Falha ao reiniciar reprodução", retryErr);
      void retry();
    }
  }, [fallbackUrls, player, retry]);

  // ─── Option selectors ────────────────────────────────────────────────────
  const handleSelectAudio = useCallback(
    (option: string) => {
      setSelectedAudio(option);
      setPanel(null);
      showControlsWithTimer();
    },
    [showControlsWithTimer],
  );

  const handleSelectSubtitle = useCallback(
    (option: string) => {
      setSelectedSubtitle(option);
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

  const handleSelectBuffer = useCallback(
    (value: string) => {
      setPreference("bufferMode", value);
      setPanel(null);
      showControlsWithTimer();
    },
    [setPreference, showControlsWithTimer],
  );

  // ─── Native Picture-in-Picture ───────────────────────────────────────────
  const handleTogglePip = useCallback(async () => {
    if (Platform.OS !== "web") {
      try {
        await videoViewRef.current?.startPictureInPicture();
        return;
      } catch (pipError) {
        console.error("PiP nativo indisponível; ativando miniplayer interno", pipError);
      }
    }
    const pipSubtitle = contentType === "live" ? "Canal ao vivo" : sourceSubtitle;
    activatePip(streamUrl, title, contentType, id, backdrop, pipSubtitle);
    persistProgress(currentTime, duration);
    router.back();
  }, [activatePip, backdrop, contentType, currentTime, duration, id, persistProgress, router, sourceSubtitle, streamUrl, title]);

  // ─── Cast ─────────────────────────────────────────────────────────────────
  const handleCastConnect = useCallback((deviceId: string) => {
    setConnectedDevice((prev) => (prev === deviceId ? null : deviceId));
  }, []);

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

  const handleOpenCast = useCallback(() => {
    clearHideTimer();
    setPanel(null);
    dispatchUi({ type: "OPEN_CAST" });
  }, [clearHideTimer]);

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
      showControlsWithTimer,
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
      showControlsWithTimer,
    ],
  );

  const handleRemoteEvent = usePlayerRemote(remoteParams);

  useTVRemote(handleRemoteEvent, tvMode);

  const handleNativeKeyDown = useCallback(
    (event: TVKeyDownEvent) => {
      if (Platform.OS === "web" || !tvMode) return;
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

      {/* Subtitle overlay */}
      {selectedSubtitle !== "Desativadas" ? (
        <View style={styles.subtitleOverlay} pointerEvents="none">
          <AppText style={styles.subtitleText}>
            [Legenda {selectedSubtitle} — aguardando stream]
          </AppText>
        </View>
      ) : null}

      {/* Buffering indicator */}
      {isBuffering ? (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={Colors.blueBright} />
          <AppText style={styles.bufferingText}>
            Buffering — {bufferMode}
          </AppText>
        </View>
      ) : null}

      <Pressable
        accessibilityLabel="Mostrar ou ocultar controles"
        onPress={handleTap}
        style={styles.tapOverlay}
      />

      <View pointerEvents="box-none" style={styles.overlay}>
        <Animated.View
          pointerEvents={controlsVisible ? "box-none" : "none"}
          style={[styles.osdLayer, { opacity: osdOpacity }]}
        >
          <PlayerTopBar
            title={title}
            contentType={contentType}
            connectedDevice={connectedDevice}
            onBack={handleRequestExit}
            onToggleQuickSwitcher={handleOpenQuickSwitcher}
            onTogglePip={handleTogglePip}
            onOpenEpg={handleOpenEpg}
            onOpenCast={handleOpenCast}
          />
          <PlayerBottomPanel
            playButtonRef={playButtonRef}
            contentType={contentType}
            isPlaying={isPlaying}
            panel={panel}
            currentTime={currentTime}
            duration={duration}
            progressPct={progressPct}
            selectedAudio={selectedAudio}
            selectedSubtitle={selectedSubtitle}
            playbackRate={playbackRate}
            selectedRatio={selectedRatio}
            bufferMode={bufferMode}
            currentEpg={epg.current}
            nextEpg={epg.next}
            epgLoading={epg.isLoading}
            onTogglePlayback={handleTogglePlayback}
            onSeek={handleSeek}
            onPanelChange={handlePanel}
            onProgressLayout={handleProgressLayout}
            onProgressGrant={handleProgressGrant}
            onProgressMove={handleProgressMove}
            onProgressRelease={handleProgressRelease}
            onSelectAudio={handleSelectAudio}
            onSelectSubtitle={handleSelectSubtitle}
            onSelectSpeed={handleSelectSpeed}
            onSelectRatio={handleSelectRatio}
            onSelectBuffer={handleSelectBuffer}
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
          loading={loading}
          error={playerError ?? error}
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
          onClose={handleCloseOverlay}
        />
      </Modal>

      {/* Cast Modal */}
      <Modal
        visible={uiLayer === "cast"}
        transparent
        animationType="slide"
        onRequestClose={handleCloseOverlay}
      >
        <CastModal
          devices={MOCK_CAST_DEVICES}
          connectedDevice={connectedDevice}
          onConnect={handleCastConnect}
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
          <GlassCard style={styles.exitCard} intensity={36}>
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
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

// ─── Player Top Bar ──────────────────────────────────────────────────────────

function PlayerTopBar({
  title,
  contentType,
  connectedDevice,
  onBack,
  onToggleQuickSwitcher,
  onTogglePip,
  onOpenEpg,
  onOpenCast,
}: {
  title: string;
  contentType: ContentType;
  connectedDevice: string | null;
  onBack: () => void;
  onToggleQuickSwitcher: () => void;
  onTogglePip: () => void;
  onOpenEpg: () => void;
  onOpenCast: () => void;
}) {
  return (
    <View pointerEvents="box-none" style={styles.topBar}>
      <IconButton icon="chevron-back" label="Voltar" onPress={onBack} />
      <View style={styles.titleBar}>
        <AppText numberOfLines={1} style={styles.playerTitle}>
          {title}
        </AppText>
        <View style={styles.liveLine}>
          <View
            style={[
              styles.playerLiveDot,
              contentType !== "live" && { backgroundColor: Colors.blue },
            ]}
          />
          <AppText style={styles.playerMeta}>
            {contentType === "live" ? "AO VIVO" : "FLIXPLAY DEMO"}
          </AppText>
        </View>
      </View>
      <View style={styles.topActions}>
        {contentType === "live" ? (
          <IconButton
            icon="calendar-outline"
            label="Guia de programação EPG"
            onPress={onOpenEpg}
          />
        ) : null}
        <IconButton
          icon="phone-portrait-outline"
          label="Picture-in-Picture"
          onPress={onTogglePip}
        />
        <IconButton
          icon="wifi-outline"
          label="Espelhar / Cast"
          active={connectedDevice !== null}
          onPress={onOpenCast}
        />
        <IconButton
          icon="albums-outline"
          label="Abrir canais recentes"
          onPress={onToggleQuickSwitcher}
        />
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
    return current ? [current, ...others].slice(0, 12) : others.slice(0, 12);
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
      <ScrollView showsVerticalScrollIndicator={false} style={styles.quickChannelScroll}>
        <View style={styles.quickGrid}>
          {visibleChannels.map((channel) => (
            <QuickChannel
              key={channel.id}
              channelId={channel.id}
              name={channel.name}
              logo={channel.logo}
              program={channel.currentEpg.title}
              progress={channel.currentEpg.progress}
              active={channel.id === currentId}
              onSwitch={onSwitch}
            />
          ))}
        </View>
        {visibleChannels.length === 0 ? <AppText style={styles.quickEmpty}>Nenhum canal disponível nesta grade.</AppText> : null}
      </ScrollView>
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
  playButtonRef,
  contentType,
  isPlaying,
  panel,
  currentTime,
  duration,
  progressPct,
  selectedAudio,
  selectedSubtitle,
  playbackRate,
  selectedRatio,
  bufferMode,
  currentEpg,
  nextEpg,
  epgLoading,
  onTogglePlayback,
  onSeek,
  onPanelChange,
  onProgressLayout,
  onProgressGrant,
  onProgressMove,
  onProgressRelease,
  onSelectAudio,
  onSelectSubtitle,
  onSelectSpeed,
  onSelectRatio,
  onSelectBuffer,
}: {
  playButtonRef: Ref<TVFocusableHandle>;
  contentType: ContentType;
  isPlaying: boolean;
  panel: Panel;
  currentTime: number;
  duration: number;
  progressPct: number;
  selectedAudio: string;
  selectedSubtitle: string;
  playbackRate: number;
  selectedRatio: RatioOption;
  bufferMode: string;
  currentEpg: EpgProgram | null;
  nextEpg: EpgProgram | null;
  epgLoading: boolean;
  onTogglePlayback: () => void;
  onSeek: (seconds: number) => void;
  onPanelChange: (panel: Panel) => void;
  onProgressLayout: (e: LayoutChangeEvent) => void;
  onProgressGrant: (e: GestureResponderEvent) => void;
  onProgressMove: (e: GestureResponderEvent) => void;
  onProgressRelease: () => void;
  onSelectAudio: (option: string) => void;
  onSelectSubtitle: (option: string) => void;
  onSelectSpeed: (value: number) => void;
  onSelectRatio: (option: RatioOption) => void;
  onSelectBuffer: (value: string) => void;
}) {
  const handleBackward = useCallback(() => onSeek(-10), [onSeek]);
  const handleForward = useCallback(() => onSeek(10), [onSeek]);
  const isLive = contentType === "live";

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
      {isLive ? (
        <View style={styles.liveEpgBar}>
          <View style={styles.liveEpgNow}>
            <AppText style={styles.liveEpgLabel}>AGORA</AppText>
            <View style={styles.liveEpgCopy}>
              <AppText style={styles.liveEpgTitle} numberOfLines={1}>
                {epgLoading && !currentEpg ? "Carregando programação..." : currentEpg?.title ?? "Programação não informada"}
              </AppText>
              {currentEpg ? <AppText style={styles.liveEpgTime}>{currentEpg.start}–{currentEpg.end}</AppText> : null}
            </View>
          </View>
          <View style={styles.liveEpgDivider} />
          <View style={styles.liveEpgNext}>
            <AppText style={styles.liveEpgLabel}>A SEGUIR</AppText>
            <AppText style={styles.liveEpgNextTitle} numberOfLines={1}>{nextEpg?.title ?? "Programação não informada"}</AppText>
            {nextEpg ? <AppText style={styles.liveEpgTime}>{nextEpg.start}</AppText> : null}
          </View>
        </View>
      ) : null}
      {/* Progress / Timeline */}
      <View style={styles.timelineRow}>
        <AppText style={styles.timeText}>{leftLabel}</AppText>
        <View
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
                ? styles.timelineFillLive
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

      {/* Main controls */}
      <View style={styles.mainControls}>
        <TVFocusable
          accessibilityRole="button"
          accessibilityLabel="Retroceder 10 segundos"
          onPress={handleBackward}
          style={[styles.controlButton, isLive && styles.controlButtonDisabled]}
          disabled={isLive}
        >
          <Ionicons
            name="play-back-outline"
            size={22}
            color={isLive ? Colors.subtle : Colors.white}
          />
          <AppText
            style={[styles.controlHint, isLive && { color: Colors.subtle }]}
          >
            10
          </AppText>
        </TVFocusable>

        <TVFocusable
          ref={playButtonRef}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? "Pausar" : "Reproduzir"}
          onPress={onTogglePlayback}
          hasTVPreferredFocus
          style={styles.playButton}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={26}
            color={Colors.background}
          />
        </TVFocusable>

        <TVFocusable
          accessibilityRole="button"
          accessibilityLabel="Avançar 10 segundos"
          onPress={handleForward}
          style={[styles.controlButton, isLive && styles.controlButtonDisabled]}
          disabled={isLive}
        >
          <Ionicons
            name="play-forward-outline"
            size={22}
            color={isLive ? Colors.subtle : Colors.white}
          />
          <AppText
            style={[styles.controlHint, isLive && { color: Colors.subtle }]}
          >
            10
          </AppText>
        </TVFocusable>
      </View>

      {/* Option buttons row */}
      <View style={styles.optionRow}>
        <PlayerOptionButton
          icon="musical-notes-outline"
          label="Áudio"
          panel="audio"
          active={panel === "audio"}
          onPanelChange={onPanelChange}
        />
        <PlayerOptionButton
          icon="chatbox-ellipses-outline"
          label="Legendas"
          panel="subtitles"
          active={panel === "subtitles"}
          onPanelChange={onPanelChange}
        />
        <PlayerOptionButton
          icon="speedometer-outline"
          label="Velocidade"
          panel="speed"
          active={panel === "speed"}
          onPanelChange={onPanelChange}
        />
        <PlayerOptionButton
          icon="scan-outline"
          label="Proporção"
          panel="ratio"
          active={panel === "ratio"}
          onPanelChange={onPanelChange}
        />
        {isLive ? (
          <PlayerOptionButton
            icon="wifi-outline"
            label="Buffer"
            panel="buffer"
            active={panel === "buffer"}
            onPanelChange={onPanelChange}
          />
        ) : null}
      </View>

      {panel ? (
        <ActivePanelSection
          panel={panel}
          selectedAudio={selectedAudio}
          selectedSubtitle={selectedSubtitle}
          playbackRate={playbackRate}
          selectedRatio={selectedRatio}
          bufferMode={bufferMode}
          onSelectAudio={onSelectAudio}
          onSelectSubtitle={onSelectSubtitle}
          onSelectSpeed={onSelectSpeed}
          onSelectRatio={onSelectRatio}
          onSelectBuffer={onSelectBuffer}
        />
      ) : null}
    </View>
  );
}

type ActivePanelSectionProps = {
  panel: ActivePanel;
  selectedAudio: string;
  selectedSubtitle: string;
  playbackRate: number;
  selectedRatio: RatioOption;
  bufferMode: string;
  onSelectAudio: (o: string) => void;
  onSelectSubtitle: (o: string) => void;
  onSelectSpeed: (v: number) => void;
  onSelectRatio: (o: RatioOption) => void;
  onSelectBuffer: (v: string) => void;
};

function ActivePanelSection(props: ActivePanelSectionProps) {
  const { panel, selectedAudio, selectedSubtitle, playbackRate, selectedRatio, bufferMode,
    onSelectAudio, onSelectSubtitle, onSelectSpeed, onSelectRatio, onSelectBuffer } = props;

  if (panel === "audio") {
    return (
      <OptionPanel title="Faixa de Áudio">
        {AUDIO_OPTIONS.map((opt) => (
          <OptionChip key={opt} label={opt} selected={opt === selectedAudio} onSelect={() => onSelectAudio(opt)} />
        ))}
      </OptionPanel>
    );
  }
  if (panel === "subtitles") {
    return (
      <OptionPanel title="Legendas">
        {SUBTITLE_OPTIONS.map((opt) => (
          <OptionChip key={opt} label={opt} selected={opt === selectedSubtitle} onSelect={() => onSelectSubtitle(opt)} />
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
  return (
    <OptionPanel title="Buffer / Latência (Canais ao Vivo)">
      {BUFFER_OPTIONS.map((opt) => (
        <OptionChipDetail key={opt.value} label={opt.label} detail={opt.desc} selected={opt.value === bufferMode} onSelect={() => onSelectBuffer(opt.value)} />
      ))}
    </OptionPanel>
  );
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
    <View style={styles.optionMenu}>
      <AppText style={styles.optionMenuTitle}>{title}</AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={styles.optionValues}
      >
        {children}
      </ScrollView>
    </View>
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

function OptionChipDetail({
  label,
  detail,
  selected,
  onSelect,
}: {
  label: string;
  detail: string;
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
      style={[
        styles.optionValueDetail,
        selected && styles.optionValueSelected,
      ]}
    >
      <View style={styles.optionValueDetailInner}>
        <AppText
          style={[
            styles.optionValueText,
            selected && styles.optionValueTextSelected,
          ]}
        >
          {label}
        </AppText>
        <AppText style={styles.optionValueDetailDesc}>{detail}</AppText>
      </View>
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
  onClose,
}: {
  channelName: string;
  programs: EpgProgram[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();

  return (
    <View style={styles.modalBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.epgSheet}>
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
            <EpgProgramRow key={`${entry.startTimestamp ?? entry.start}-${entry.title}`} entry={entry} />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function EpgProgramRow({ entry }: { entry: EpgProgram }) {
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
      </View>
    </View>
  );
}

// ─── Cast Modal ───────────────────────────────────────────────────────────────

const CAST_ICONS: Record<CastDevice["type"], keyof typeof Ionicons.glyphMap> = {
  chromecast: "logo-google",
  smarttv: "tv-outline",
  appletv: "logo-apple",
  androidtv: "logo-android",
};

function CastModal({
  devices,
  connectedDevice,
  onConnect,
  onClose,
}: {
  devices: CastDevice[];
  connectedDevice: string | null;
  onConnect: (deviceId: string) => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.modalBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.castSheet}>
        <View style={styles.castHeader}>
          <View>
            <AppText style={styles.castKicker}>ESPELHAMENTO / CAST</AppText>
            <AppText style={styles.castTitle}>Dispositivos Disponíveis</AppText>
          </View>
          <TVFocusable onPress={onClose} style={styles.epgCloseBtn} accessibilityLabel="Fechar Cast">
            <Ionicons name="close" size={20} color={Colors.text} />
          </TVFocusable>
        </View>

        {connectedDevice ? (
          <View style={styles.castConnectedBanner}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.green} />
            <AppText style={styles.castConnectedText}>
              Transmitindo para:{" "}
              {devices.find((d) => d.id === connectedDevice)?.name ?? ""}
            </AppText>
          </View>
        ) : (
          <View style={styles.castScanRow}>
            <ActivityIndicator size="small" color={Colors.blueBright} />
            <AppText style={styles.castScanText}>
              Buscando dispositivos na rede...
            </AppText>
          </View>
        )}

        <View style={styles.castDeviceList}>
          {devices.map((device) => (
            <CastDeviceRow
              key={device.id}
              device={device}
              isConnected={connectedDevice === device.id}
              onConnect={onConnect}
            />
          ))}
        </View>

        <View style={styles.castFooter}>
          <Ionicons
            name="information-circle-outline"
            size={14}
            color={Colors.subtle}
          />
          <AppText style={styles.castFooterText}>
            Certifique-se de que os dispositivos estão na mesma rede Wi-Fi
          </AppText>
        </View>
      </View>
    </View>
  );
}

function CastDeviceRow({
  device,
  isConnected,
  onConnect,
}: {
  device: CastDevice;
  isConnected: boolean;
  onConnect: (deviceId: string) => void;
}) {
  const handlePress = useCallback(() => {
    onConnect(device.id);
  }, [device.id, onConnect]);

  return (
    <TVFocusable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.castDevice,
        isConnected && styles.castDeviceConnected,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.castDeviceIcon,
          isConnected && styles.castDeviceIconActive,
        ]}
      >
        <Ionicons
          name={CAST_ICONS[device.type]}
          size={20}
          color={isConnected ? Colors.white : Colors.blueBright}
        />
      </View>
      <View style={styles.castDeviceCopy}>
        <AppText style={styles.castDeviceName}>{device.name}</AppText>
        <AppText style={styles.castDeviceType}>
          {device.type === "chromecast"
            ? "Chromecast"
            : device.type === "smarttv"
            ? "Smart TV"
            : device.type === "appletv"
            ? "Apple TV"
            : "Android TV"}
        </AppText>
      </View>
      <View style={[styles.castConnectBtn, isConnected && styles.castConnectBtnActive]}>
        <AppText style={[styles.castConnectText, isConnected && styles.castConnectTextActive]}>
          {isConnected ? "Desconectar" : "Conectar"}
        </AppText>
      </View>
    </TVFocusable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden", backgroundColor: Colors.black },
  backdropVeil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.44)",
  },
  tapOverlay: { ...StyleSheet.absoluteFill },
  videoAspectContainer: { alignSelf: "center" },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  osdLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
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
  },
  exitTitle: { fontFamily: "Inter_700Bold", fontSize: 21, color: Colors.text },
  exitBody: { fontSize: 13, color: Colors.muted, textAlign: "center" },
  exitActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  exitSecondaryButton: {
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
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 24,
    borderRadius: 23,
    backgroundColor: Colors.blue,
  },
  exitPrimaryText: { fontFamily: "Inter_700Bold", fontSize: 12, color: Colors.white },

  // Subtitle overlay
  subtitleOverlay: {
    position: "absolute",
    bottom: 130,
    left: 30,
    right: 30,
    alignItems: "center",
  },
  subtitleText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.white,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.72)",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },

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

  // Top bar
  topBar: { flexDirection: "row", alignItems: "center", gap: 11 },
  titleBar: { flex: 1, gap: 4 },
  playerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.white,
  },
  liveLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  playerLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.red,
  },
  playerMeta: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 0.7,
    color: "rgba(255,255,255,0.7)",
  },
  topActions: { flexDirection: "row", gap: 7 },

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
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  quickEmpty: { paddingVertical: 20, textAlign: "center", color: Colors.subtle },
  quickChannel: {
    width: "49%",
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
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.17)",
    backgroundColor: "rgba(7,9,14,0.82)",
  },
  liveEpgBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  liveEpgNow: { flex: 1.25, flexDirection: "row", alignItems: "center", gap: 9 },
  liveEpgNext: { flex: 1, gap: 2 },
  liveEpgDivider: { width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.12)" },
  liveEpgLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 8,
    letterSpacing: 0.8,
    color: Colors.blueBright,
  },
  liveEpgCopy: { flex: 1, gap: 2 },
  liveEpgTitle: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.white },
  liveEpgNextTitle: { fontFamily: "Inter_500Medium", fontSize: 10, color: Colors.text },
  liveEpgTime: { fontSize: 9, color: Colors.subtle },

  // Timeline / seek bar
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  timeText: {
    minWidth: 46,
    fontVariant: ["tabular-nums"],
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: Colors.white,
  },
  timeline: {
    flex: 1,
    height: 6,
    overflow: "visible",
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  timelineLive: {},
  timelineFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: Colors.white,
  },
  timelineFillLive: {
    width: "100%",
    backgroundColor: Colors.red,
  },
  timelineKnob: {
    position: "absolute",
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.3)",
  },

  // Main controls
  mainControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  controlButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  controlButtonDisabled: { opacity: 0.35 },
  controlHint: {
    fontFamily: "Inter_700Bold",
    fontSize: 8,
    color: Colors.white,
  },
  playButton: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: Colors.white,
  },

  // Option row
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 5,
  },
  optionButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 3,
    borderRadius: 11,
  },
  optionButtonActive: { backgroundColor: "rgba(59,130,246,0.16)" },
  optionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
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
  optionValueDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    minWidth: 160,
  },
  optionValueDetailInner: { flex: 1, gap: 2 },
  optionValueDetailDesc: { fontSize: 9, color: Colors.subtle },

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
    backgroundColor: "#0D111A",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
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

  // Cast Modal
  castSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#0D111A",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    paddingBottom: 36,
    ...Shadows.card,
  },
  castHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  castKicker: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.blueBright,
  },
  castTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
    marginTop: 2,
  },
  castConnectedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    backgroundColor: "rgba(16,185,129,0.1)",
  },
  castConnectedText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#6EE7B7",
  },
  castScanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  castScanText: { fontSize: 12, color: Colors.muted },
  castDeviceList: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  castDevice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  castDeviceConnected: {
    borderColor: "rgba(96,165,250,0.4)",
    backgroundColor: "rgba(59,130,246,0.12)",
  },
  castDeviceIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "rgba(59,130,246,0.15)",
  },
  castDeviceIconActive: {
    backgroundColor: Colors.blue,
  },
  castDeviceCopy: { flex: 1, gap: 3 },
  castDeviceName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
  },
  castDeviceType: { fontSize: 11, color: Colors.subtle },
  castConnectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.4)",
    backgroundColor: "rgba(59,130,246,0.1)",
  },
  castConnectBtnActive: {
    borderColor: "rgba(229,9,20,0.4)",
    backgroundColor: "rgba(229,9,20,0.1)",
  },
  castConnectText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.blueBright,
  },
  castConnectTextActive: { color: Colors.red },
  castFooter: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginHorizontal: 20,
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  castFooterText: { flex: 1, fontSize: 11, color: Colors.subtle, lineHeight: 16 },

  pressed: { opacity: 0.72 },
});
