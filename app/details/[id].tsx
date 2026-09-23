import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";
import { Colors, Radii, Shadows, Type } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText, Chip, EmptyState, IconButton, ScreenState, SectionHeader } from "@/components/ui";
import { useScreenLoad } from "@/hooks/useScreenLoad";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useAppStore } from "@/store/useAppStore";
import { getSeriesInfo, createSeriesEpisodeUrl } from "@/services/xtream";
import type { EpisodeItem, SeriesItem, VodMovie } from "@/store/types";

// ---------------------------------------------------------------------------
// Synopsis auto-fetch from Wikipedia
// ---------------------------------------------------------------------------

const SYNOPSIS_CACHE_PREFIX = "flixplay_synopsis_v1_";

/** Remove noise tags from IPTV titles: [FHD], (2024), 4K, DUBLADO, etc. */
function cleanTitleForSearch(raw: string): string {
  return raw
    .replace(/\[.*?\]/g, "")
    .replace(/\((?:19|20)\d{2}\)/g, "")
    .replace(/\b(FHD|4K|UHD|HD|HQ|SDR|HDR10?|HEVC|H\.?265|H\.?264|DUBLAD[OA]?|DUB|LEGENDAD[OA]?|LEG|DUAL|NACIONAL|MULTI|COMPLETO?|TEMPORADA|SEASON)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchSynopsisFromWikipedia(title: string): Promise<string | null> {
  const encoded = encodeURIComponent(title);
  // Try Portuguese Wikipedia first
  const ptUrl = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
  try {
    const res = await fetch(ptUrl, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json() as { extract?: string; type?: string };
      if (data.type !== "disambiguation" && data.extract && data.extract.length > 40) {
        return data.extract;
      }
    }
  } catch {
    // fall through to English
  }
  // Fallback to English Wikipedia
  const enUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
  try {
    const res = await fetch(enUrl, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json() as { extract?: string; type?: string };
      if (data.type !== "disambiguation" && data.extract && data.extract.length > 40) {
        return data.extract;
      }
    }
  } catch {
    // nothing
  }
  return null;
}

async function loadOrFetchSynopsis(contentId: string, rawTitle: string, existingPlot: string): Promise<string | null> {
  // Don't fetch if the server already returned a valid synopsis
  const trimmed = existingPlot?.trim() ?? "";
  if (trimmed.length > 30 && trimmed.toLowerCase() !== "n/a") return null;

  const cacheKey = `${SYNOPSIS_CACHE_PREFIX}${contentId}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return cached;
  } catch {
    // cache miss
  }

  const clean = cleanTitleForSearch(rawTitle);
  if (!clean) return null;

  const synopsis = await fetchSynopsisFromWikipedia(clean);
  if (synopsis) {
    try {
      await AsyncStorage.setItem(cacheKey, synopsis);
    } catch {
      // ignore storage errors
    }
  }
  return synopsis;
}

// ---------------------------------------------------------------------------
// Xtream series info response types
// ---------------------------------------------------------------------------

interface XtreamEpisodeRaw {
  id?: string | number;
  episode_num?: number | string;
  title?: string;
  container_extension?: string;
  info?: {
    duration_secs?: number;
    duration?: string;
    plot?: string;
    movie_image?: string;
  };
}

interface XtreamSeriesInfoResponse {
  info?: {
    name?: string;
    cover?: string;
    plot?: string;
    cast?: string;
    rating?: string | number;
    releaseDate?: string;
  };
  seasons?: { season_number?: number; name?: string }[];
  episodes?: Record<string, XtreamEpisodeRaw[]> | XtreamEpisodeRaw[];
}

// ---------------------------------------------------------------------------
// Parse raw Xtream series info into normalised EpisodeItem[]
// ---------------------------------------------------------------------------

function parseSeriesInfo(
  raw: unknown,
  seriesId: string,
  profile: { serverUrl: string; username: string; password: string },
): { episodes: EpisodeItem[]; seasonsCount: number } {
  if (!raw || typeof raw !== "object") return { episodes: [], seasonsCount: 1 };

  const data = raw as XtreamSeriesInfoResponse;
  const episodesRaw = data.episodes;

  if (!episodesRaw) return { episodes: [], seasonsCount: 1 };

  const buildEpisode = (
    ep: XtreamEpisodeRaw,
    seasonNumber: number,
  ): EpisodeItem => {
    const streamId = String(ep.id ?? "");
    const ext = ep.container_extension ?? "mp4";
    const durationSecs = ep.info?.duration_secs ?? 0;
    const mins = Math.floor(durationSecs / 60);
    const duration = mins > 0 ? `${mins}min` : ep.info?.duration ?? "N/A";
    return {
      id: `ep-${seriesId}-s${seasonNumber}-e${ep.episode_num ?? 0}`,
      seriesId,
      seasonNumber,
      episodeNumber: Number(ep.episode_num ?? 0),
      title: ep.title ?? `Episódio ${ep.episode_num ?? ""}`,
      thumbnail: ep.info?.movie_image ?? "",
      duration,
      plot: ep.info?.plot ?? "",
      streamUrl: streamId
        ? createSeriesEpisodeUrl(profile as Parameters<typeof createSeriesEpisodeUrl>[0], streamId, ext)
        : "",
    };
  };

  if (Array.isArray(episodesRaw)) {
    const eps = episodesRaw.map((ep) => buildEpisode(ep, 1));
    return { episodes: eps, seasonsCount: 1 };
  }

  // Object indexed by season number
  const allEpisodes: EpisodeItem[] = [];
  const seasonKeys = Object.keys(episodesRaw).sort((a, b) => Number(a) - Number(b));
  for (const key of seasonKeys) {
    const seasonNum = Number(key);
    const epList = (episodesRaw as Record<string, XtreamEpisodeRaw[]>)[key];
    if (Array.isArray(epList)) {
      for (const ep of epList) {
        allEpisodes.push(buildEpisode(ep, seasonNum));
      }
    }
  }
  const seasonsCount = seasonKeys.length || 1;
  return { episodes: allEpisodes, seasonsCount };
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function DetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const { loading, error, retry } = useScreenLoad("os detalhes");
  const tvMode = useTVMode();

  const favoriteMovieIds = useAppStore((state) => state.favoriteMovieIds);
  const favoriteSeriesIds = useAppStore((state) => state.favoriteSeriesIds);
  const toggleFavoriteMovie = useAppStore((state) => state.toggleFavoriteMovie);
  const toggleFavoriteSeries = useAppStore((state) => state.toggleFavoriteSeries);

  const cachedMovies = useAppStore((state) => state.contentCache.vodMovies);
  const cachedSeries = useAppStore((state) => state.contentCache.seriesList);
  const servers = useAppStore((state) => state.servers);
  const activeServerId = useAppStore((state) => state.activeServerId);
  const activeProfile = servers.find((s) => s.id === activeServerId) ?? servers[0];

  const [season, setSeason] = useState(1);
  const [episodesData, setEpisodesData] = useState<EpisodeItem[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [realSeasonsCount, setRealSeasonsCount] = useState<number | null>(null);
  const fetchedSeriesIdRef = useRef<string | null>(null);

  // Auto-fetch synopsis when not provided by server
  const [fetchedSynopsis, setFetchedSynopsis] = useState<string | null>(null);
  const [synopsisLoading, setSynopsisLoading] = useState(false);

  const movie: VodMovie | undefined = cachedMovies.find((m) => m.id === id);
  const show: SeriesItem | undefined = cachedSeries.find((s) => s.id === id);

  const isFavorite = movie
    ? favoriteMovieIds.includes(id)
    : favoriteSeriesIds.includes(id);

  const seasonsCount = realSeasonsCount ?? show?.seasonsCount ?? 1;

  // Fetch series episodes from Xtream API
  useEffect(() => {
    if (!show || !activeProfile) return;
    if (fetchedSeriesIdRef.current === show.seriesId) return;
    fetchedSeriesIdRef.current = show.seriesId;

    setEpisodesLoading(true);
    setEpisodesError(null);

    getSeriesInfo(activeProfile, show.seriesId)
      .then((raw) => {
        const { episodes: parsed, seasonsCount: sc } = parseSeriesInfo(
          raw,
          show.id,
          activeProfile,
        );
        setEpisodesData(parsed);
        setRealSeasonsCount(sc);
        setSeason(1);
      })
      .catch((err: unknown) => {
        console.error("Falha ao carregar episódios", err);
        const msg = err instanceof Error ? err.message : "Não foi possível carregar os episódios.";
        setEpisodesError(msg);
      })
      .finally(() => {
        setEpisodesLoading(false);
      });
  }, [show, activeProfile]);

  const selectedEpisodes = useMemo(
    () => episodesData.filter((ep) => ep.seasonNumber === season),
    [episodesData, season],
  );

  const similar = useMemo(
    () =>
      (show
        ? cachedSeries.filter((item) => item.id !== show.id)
        : cachedMovies.filter((item) => item.id !== movie?.id)
      ).slice(0, 6),
    [movie?.id, show, cachedMovies, cachedSeries],
  );

  // Auto-fetch synopsis when server didn't provide one
  useEffect(() => {
    const item = movie ?? show;
    if (!item) return;
    const existingPlot = item.plot?.trim() ?? "";
    if (existingPlot.length > 30 && existingPlot.toLowerCase() !== "n/a") return;

    let cancelled = false;
    // Defer first setState to satisfy no-synchronous-setState-in-effect rule
    const tid = setTimeout(() => {
      if (cancelled) return;
      setSynopsisLoading(true);
      loadOrFetchSynopsis(item.id, item.title, existingPlot)
        .then((synopsis) => {
          if (!cancelled && synopsis) setFetchedSynopsis(synopsis);
        })
        .catch((err: unknown) => {
          console.error("Falha ao buscar sinopse", err);
        })
        .finally(() => {
          if (!cancelled) setSynopsisLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
  }, [movie, show]);

  const missingError = !movie && !show ? "Este conteúdo não está disponível no catálogo." : null;

  const handlePlay = useCallback(
    (episodeId?: string) => {
      if (movie) {
        router.push({
          pathname: "/player",
          params: {
            id: movie.id,
            title: movie.title,
            type: "movie",
            streamUrl: movie.streamUrl,
            subtitle: "Filme",
            thumbnail: movie.backdrop || movie.poster,
          },
        });
        return;
      }
      const episode = episodesData.find((item) => item.id === episodeId) ?? episodesData[0];
      if (!show || !episode) return;
      router.push({
        pathname: "/player",
        params: {
          id: episode.id,
          title: `${show.title} · T${episode.seasonNumber}:E${episode.episodeNumber}`,
          type: "episode",
          streamUrl: episode.streamUrl,
          subtitle: `${show.title} · T${episode.seasonNumber}:E${episode.episodeNumber}`,
          thumbnail: episode.thumbnail || show.poster,
          seriesId: show.id,
        },
      });
    },
    [movie, router, episodesData, show],
  );

  const handleFavorite = useCallback(() => {
    if (movie) {
      toggleFavoriteMovie(id);
    } else {
      toggleFavoriteSeries(id);
    }
  }, [id, movie, toggleFavoriteMovie, toggleFavoriteSeries]);

  const handleTrailer = useCallback(() => {
    Alert.alert(
      "Trailer",
      "O trailer será reproduzido no player.",
      [{ text: "Assistir", onPress: () => handlePlay() }, { text: "Agora não", style: "cancel" }],
    );
  }, [handlePlay]);

  const handleSimilar = useCallback(
    (similarId: string) => {
      router.push(`/details/${similarId}`);
    },
    [router],
  );

  const handleRetry = useCallback(() => {
    if (missingError) {
      router.back();
      return;
    }
    void retry();
  }, [missingError, retry, router]);

  return (
    <View style={styles.screen}>
      <ScreenState loading={loading} error={error ?? missingError} retry={handleRetry}>
        {movie || show ? (
          <DetailsContent
            movie={movie}
            show={show}
            similar={similar}
            season={season}
            seasonsCount={seasonsCount}
            selectedEpisodes={selectedEpisodes}
            episodesLoading={episodesLoading}
            episodesError={episodesError}
            isFavorite={isFavorite}
            tvMode={tvMode}
            fetchedSynopsis={fetchedSynopsis}
            synopsisLoading={synopsisLoading}
            onBack={router.back}
            onFavorite={handleFavorite}
            onPlay={handlePlay}
            onTrailer={handleTrailer}
            onSeasonChange={setSeason}
            onSimilar={handleSimilar}
          />
        ) : null}
      </ScreenState>
    </View>
  );
}

function DetailsContent({
  movie,
  show,
  similar,
  season,
  seasonsCount,
  selectedEpisodes,
  episodesLoading,
  episodesError,
  isFavorite,
  tvMode,
  fetchedSynopsis,
  synopsisLoading,
  onBack,
  onFavorite,
  onPlay,
  onTrailer,
  onSeasonChange,
  onSimilar,
}: {
  movie?: VodMovie;
  show?: SeriesItem;
  similar: (VodMovie | SeriesItem)[];
  season: number;
  seasonsCount: number;
  selectedEpisodes: EpisodeItem[];
  episodesLoading: boolean;
  episodesError: string | null;
  isFavorite: boolean;
  tvMode: boolean;
  fetchedSynopsis: string | null;
  synopsisLoading: boolean;
  onBack: () => void;
  onFavorite: () => void;
  onPlay: (episodeId?: string) => void;
  onTrailer: () => void;
  onSeasonChange: (season: number) => void;
  onSimilar: (id: string) => void;
}) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, tvMode && styles.tvContent]}
    >
      <ContentSummary
        movie={movie}
        show={show}
        isFavorite={isFavorite}
        fetchedSynopsis={fetchedSynopsis}
        synopsisLoading={synopsisLoading}
        onBack={onBack}
        onFavorite={onFavorite}
      />
      <ContentActions
        isMovie={Boolean(movie)}
        isFavorite={isFavorite}
        onPlay={onPlay}
        onTrailer={onTrailer}
        onFavorite={onFavorite}
      />
      {show ? (
        <EpisodesSection
          show={{ ...show, seasonsCount }}
          season={season}
          selectedEpisodes={selectedEpisodes}
          isLoading={episodesLoading}
          loadError={episodesError}
          onPlay={onPlay}
          onSeasonChange={onSeasonChange}
        />
      ) : null}
      {similar.length > 0 ? (
        <SimilarSection similar={similar} onSimilar={onSimilar} />
      ) : null}
    </ScrollView>
  );
}

function ContentSummary({
  movie,
  show,
  isFavorite,
  fetchedSynopsis,
  synopsisLoading,
  onBack,
  onFavorite,
}: {
  movie?: VodMovie;
  show?: SeriesItem;
  isFavorite: boolean;
  fetchedSynopsis: string | null;
  synopsisLoading: boolean;
  onBack: () => void;
  onFavorite: () => void;
}) {
  const title = movie?.title ?? show?.title ?? "Conteúdo";
  const poster = movie?.poster ?? show?.poster;
  const backdrop = movie?.backdrop ?? show?.backdrop;
  const rating = movie?.rating ?? show?.rating ?? 0;

  const serverPlot = (movie?.plot ?? show?.plot ?? "").trim();
  const hasServerPlot = serverPlot.length > 30 && serverPlot.toLowerCase() !== "n/a";
  const displayPlot = hasServerPlot ? serverPlot : fetchedSynopsis;

  return (
    <>
      <View style={styles.backdrop}>
        <Image source={{ uri: backdrop }} contentFit="cover" style={StyleSheet.absoluteFill} />
        <View style={styles.backdropShade} />
        <View style={styles.topControls}>
          <IconButton icon="chevron-back" label="Voltar" onPress={onBack} />
          <View style={styles.topPill}>
            <Ionicons name="information-circle-outline" size={15} color={Colors.muted} />
            <AppText style={styles.topPillText}>DETALHES</AppText>
          </View>
          <IconButton
            icon={isFavorite ? "bookmark" : "bookmark-outline"}
            label={isFavorite ? "Remover dos favoritos" : "Assistir mais tarde"}
            active={isFavorite}
            onPress={onFavorite}
          />
        </View>
      </View>
      <View style={styles.titleBlock}>
        <View style={styles.poster}>
          <Image source={{ uri: poster }} contentFit="cover" style={StyleSheet.absoluteFill} />
          <View style={styles.posterBadge}>
            <Ionicons name="star" size={10} color={Colors.amber} />
            <AppText style={styles.posterRating}>{rating.toFixed(1)}</AppText>
          </View>
        </View>
        <View style={styles.titleCopy}>
          <AppText style={Type.title}>{title}</AppText>
          <View style={styles.metaRow}>
            <AppText style={styles.meta}>{movie?.year ?? show?.year}</AppText>
            <View style={styles.metaDot} />
            <AppText style={styles.meta}>{movie?.genre ?? show?.genre}</AppText>
            {movie ? (
              <>
                <View style={styles.metaDot} />
                <AppText style={styles.meta}>{movie.duration}</AppText>
              </>
            ) : null}
          </View>
          {displayPlot ? (
            <AppText numberOfLines={4} style={styles.plot}>{displayPlot}</AppText>
          ) : synopsisLoading ? (
            <View style={styles.synopsisLoading}>
              <ActivityIndicator size="small" color={Colors.subtle} />
              <AppText style={styles.synopsisLoadingText}>Buscando sinopse...</AppText>
            </View>
          ) : (
            <AppText style={styles.plotMissing}>Sinopse não disponível.</AppText>
          )}
          {!hasServerPlot && fetchedSynopsis ? (
            <View style={styles.synopsisSource}>
              <Ionicons name="globe-outline" size={10} color={Colors.subtle} />
              <AppText style={styles.synopsisSourceText}>Sinopse via Wikipedia</AppText>
            </View>
          ) : null}
        </View>
      </View>
    </>
  );
}

function ContentActions({
  isMovie,
  isFavorite,
  onPlay,
  onTrailer,
  onFavorite,
}: {
  isMovie: boolean;
  isFavorite: boolean;
  onPlay: () => void;
  onTrailer: () => void;
  onFavorite: () => void;
}) {
  return (
    <View style={styles.actions}>
      <TVFocusable
        accessibilityRole="button"
        hasTVPreferredFocus
        onPress={onPlay}
        style={styles.primaryButton}
      >
        <Ionicons name="play" size={16} color={Colors.white} />
        <AppText style={styles.primaryText}>
          {isMovie ? "Assistir agora" : "Reproduzir"}
        </AppText>
      </TVFocusable>
      <TVFocusable
        accessibilityRole="button"
        onPress={onTrailer}
        style={styles.actionButton}
      >
        <Ionicons name="play-circle-outline" size={17} color={Colors.text} />
        <AppText style={styles.actionText}>Trailer</AppText>
      </TVFocusable>
      <TVFocusable
        accessibilityRole="button"
        onPress={onFavorite}
        style={styles.actionButton}
      >
        <Ionicons
          name={isFavorite ? "bookmark" : "bookmark-outline"}
          size={17}
          color={isFavorite ? Colors.amber : Colors.text}
        />
        <AppText style={styles.actionText}>
          {isFavorite ? "Salvo" : "Mais tarde"}
        </AppText>
      </TVFocusable>
    </View>
  );
}

function EpisodesSection({
  show,
  season,
  selectedEpisodes,
  isLoading,
  loadError,
  onPlay,
  onSeasonChange,
}: {
  show: SeriesItem & { seasonsCount: number };
  season: number;
  selectedEpisodes: EpisodeItem[];
  isLoading: boolean;
  loadError: string | null;
  onPlay: (episodeId?: string) => void;
  onSeasonChange: (season: number) => void;
}) {
  return (
    <View style={styles.episodesSection}>
      <SectionHeader
        title="Episódios"
        subtitle={`${show.seasonsCount} temporada${show.seasonsCount !== 1 ? "s" : ""}`}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.seasonScroller}
        contentContainerStyle={styles.seasonContent}
      >
        {Array.from({ length: show.seasonsCount }, (_, i) => i + 1).map((num) => (
          <Chip
            key={num}
            label={`Temporada ${num}`}
            selected={season === num}
            onPress={() => onSeasonChange(num)}
          />
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.episodesLoading}>
          <ActivityIndicator color={Colors.blueBright} />
          <AppText style={styles.episodesLoadingText}>Carregando episódios...</AppText>
        </View>
      ) : loadError ? (
        <View style={styles.episodesError}>
          <Ionicons name="alert-circle-outline" size={20} color={Colors.amber} />
          <AppText style={styles.episodesErrorText}>{loadError}</AppText>
        </View>
      ) : (
        <View style={styles.episodeList}>
          {selectedEpisodes.length ? (
            selectedEpisodes.map((episode) => (
              <EpisodeCard key={episode.id} episode={episode} onPlay={onPlay} />
            ))
          ) : (
            <EmptyState
              title="Sem episódios nesta temporada"
              body="Os episódios desta temporada ainda não estão disponíveis no servidor."
            />
          )}
        </View>
      )}
    </View>
  );
}

function EpisodeCard({
  episode,
  onPlay,
}: {
  episode: EpisodeItem;
  onPlay: (episodeId?: string) => void;
}) {
  const handlePress = useCallback(() => onPlay(episode.id), [episode.id, onPlay]);
  return (
    <TVFocusable
      accessibilityRole="button"
      accessibilityLabel={`Reproduzir ${episode.title}`}
      onPress={handlePress}
      style={({ pressed }) => [styles.episodeCard, pressed && styles.pressed]}
    >
      <View style={styles.episodeThumb}>
        {episode.thumbnail ? (
          <Image source={{ uri: episode.thumbnail }} contentFit="cover" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={styles.thumbFallback}>
            <Ionicons name="film-outline" size={22} color={Colors.subtle} />
          </View>
        )}
        <View style={styles.thumbShade} />
        <View style={styles.episodePlay}>
          <Ionicons name="play" size={14} color={Colors.white} />
        </View>
        <View style={styles.epNumBadge}>
          <AppText style={styles.epNumText}>
            T{episode.seasonNumber}:E{episode.episodeNumber}
          </AppText>
        </View>
      </View>
      <View style={styles.episodeCopy}>
        <AppText numberOfLines={1} style={styles.episodeTitle}>
          {episode.title}
        </AppText>
        {episode.plot ? (
          <AppText numberOfLines={2} style={styles.episodePlot}>
            {episode.plot}
          </AppText>
        ) : null}
        <View style={styles.episodeBottom}>
          <Ionicons name="time-outline" size={11} color={Colors.subtle} />
          <AppText style={styles.episodeDuration}>{episode.duration}</AppText>
          {episode.resumePositionMs ? (
            <View style={styles.episodeProgress}>
              <View style={[styles.episodeProgressFill, { width: "56%" }]} />
            </View>
          ) : (
            <AppText style={styles.newEpisode}>NOVO</AppText>
          )}
        </View>
      </View>
    </TVFocusable>
  );
}

function SimilarSection({
  similar,
  onSimilar,
}: {
  similar: (VodMovie | SeriesItem)[];
  onSimilar: (id: string) => void;
}) {
  return (
    <View style={styles.similarSection}>
      <SectionHeader title="Você também pode gostar" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.similarScroller}
        contentContainerStyle={styles.similarContent}
      >
        {similar.map((item) => (
          <TVFocusable
            key={item.id}
            accessibilityRole="button"
            onPress={() => onSimilar(item.id)}
            style={styles.similarCard}
          >
            <Image
              source={{ uri: item.poster }}
              contentFit="cover"
              style={styles.similarImage}
            />
            <AppText numberOfLines={1} style={styles.similarTitle}>
              {item.title}
            </AppText>
            <View style={styles.similarMeta}>
              <Ionicons name="star" size={10} color={Colors.amber} />
              <AppText style={styles.similarMetaText}>
                {item.year} · {item.rating.toFixed(1)}
              </AppText>
            </View>
          </TVFocusable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { gap: 18, paddingBottom: 38 },
  tvContent: { gap: 28, paddingBottom: 54 },
  backdrop: { height: 255, overflow: "hidden", backgroundColor: Colors.backgroundRaised },
  backdropShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(7,9,14,0.48)" },
  topControls: {
    position: "absolute",
    top: 18,
    right: 20,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(7,9,14,0.45)",
  },
  topPillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 0.7,
    color: Colors.muted,
  },
  titleBlock: { flexDirection: "row", gap: 14, paddingHorizontal: 20, marginTop: -48 },
  poster: {
    width: 104,
    height: 148,
    overflow: "hidden",
    borderRadius: 15,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.backgroundRaised,
    ...Shadows.card,
  },
  posterBadge: {
    position: "absolute",
    right: 7,
    bottom: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(7,9,14,0.8)",
  },
  posterRating: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.text },
  titleCopy: { flex: 1, justifyContent: "flex-end", gap: 8, paddingBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
  meta: { fontSize: 11, color: Colors.muted },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.subtle },
  plot: { fontSize: 12, lineHeight: 18, color: Colors.muted },
  plotMissing: { fontSize: 12, color: Colors.subtle, fontStyle: "italic" },
  synopsisLoading: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  synopsisLoadingText: { fontSize: 11, color: Colors.subtle },
  synopsisSource: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  synopsisSourceText: { fontSize: 9, color: Colors.subtle },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 20 },
  primaryButton: {
    minHeight: 43,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: Radii.pill,
    backgroundColor: Colors.blue,
  },
  primaryText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.white },
  actionButton: {
    minHeight: 43,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.glassSoft,
  },
  actionText: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.text },
  episodesSection: { gap: 12, paddingHorizontal: 20 },
  seasonScroller: { flexGrow: 0, marginHorizontal: -20 },
  seasonContent: { gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
  episodeList: { gap: 9 },
  episodesLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 18,
    borderRadius: Radii.medium,
    backgroundColor: Colors.glassSoft,
  },
  episodesLoadingText: { fontSize: 13, color: Colors.muted },
  episodesError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 14,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
    backgroundColor: "rgba(245,158,11,0.08)",
  },
  episodesErrorText: { flex: 1, fontSize: 12, color: Colors.amber, lineHeight: 18 },
  episodeCard: {
    minHeight: 118,
    flexDirection: "row",
    gap: 11,
    padding: 9,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.glassSoft,
  },
  pressed: { opacity: 0.74 },
  episodeThumb: {
    width: 124,
    height: 98,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: Colors.backgroundRaised,
  },
  thumbFallback: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.backgroundRaised,
  },
  thumbShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(7,9,14,0.3)" },
  episodePlay: {
    width: 31,
    height: 31,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(59,130,246,0.9)",
  },
  epNumBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: "rgba(7,9,14,0.78)",
  },
  epNumText: { fontFamily: "Inter_600SemiBold", fontSize: 8, color: Colors.muted },
  episodeCopy: { flex: 1, gap: 5 },
  episodeTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  episodePlot: { fontSize: 10, lineHeight: 15, color: Colors.muted },
  episodeBottom: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: "auto" },
  episodeDuration: { fontSize: 10, color: Colors.subtle, marginRight: "auto" },
  episodeProgress: {
    width: 60,
    height: 3,
    overflow: "hidden",
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.17)",
  },
  episodeProgressFill: { height: "100%", backgroundColor: Colors.blueBright },
  newEpisode: { fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.5, color: Colors.green },
  similarSection: { gap: 0, paddingLeft: 20 },
  similarScroller: { flexGrow: 0, marginHorizontal: -20 },
  similarContent: { gap: 12, paddingHorizontal: 20 },
  similarCard: { width: 122, gap: 6 },
  similarImage: {
    width: 122,
    height: 160,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundRaised,
  },
  similarTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  similarMeta: { flexDirection: "row", alignItems: "center", gap: 3 },
  similarMetaText: { fontSize: 10, color: Colors.subtle },
});
