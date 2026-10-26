import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, InteractionManager, Modal, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Colors, Radii, Shadows, Type } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText, EmptyState, ErrorState, IconButton, SectionHeader } from "@/components/ui";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useAppStore } from "@/store/useAppStore";
import { getSeriesInfo } from "@/services/xtream";
import { parseSeriesEpisodes } from "@/features/details/seriesEpisodes";
import { verifyParentalPin } from "@/services/security/parentalControl";
import { fetchTmdbMetadata, isTmdbConfigured, type TmdbMetadata } from "@/services/tmdb";
import type { EpisodeItem, ParentalCategoryKind, PlayHistory, SeriesItem, VodMovie } from "@/store/types";
import { loadOrFetchSynopsis } from "@/features/details/synopsis";

// ---------------------------------------------------------------------------
// Synopsis auto-fetch from Wikipedia
// ---------------------------------------------------------------------------

function getHistoryProgress(entry?: PlayHistory): number {
  if (!entry || entry.durationMs <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((entry.positionMs / entry.durationMs) * 100)));
}

function isResumable(entry?: PlayHistory): boolean {
  const progress = getHistoryProgress(entry);
  return Boolean(entry && entry.positionMs >= 5_000 && progress > 0 && progress < 95);
}

export default function DetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const tvMode = useTVMode();

  const favoriteMovieIds = useAppStore((state) => state.favoriteMovieIds);
  const favoriteSeriesIds = useAppStore((state) => state.favoriteSeriesIds);
  const toggleFavoriteMovie = useAppStore((state) => state.toggleFavoriteMovie);
  const toggleFavoriteSeries = useAppStore((state) => state.toggleFavoriteSeries);
  const toggleContentBlocked = useAppStore((state) => state.toggleContentBlocked);
  const history = useAppStore((state) => state.history);
  const isContentBlocked = useAppStore((state) => state.isContentBlocked);
  const isCategoryBlocked = useAppStore((state) => state.isCategoryBlocked);

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
  const [tmdbMetadata, setTmdbMetadata] = useState<TmdbMetadata | null>(null);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [pendingEpisodeId, setPendingEpisodeId] = useState<string | null>(null);
  const [parentalPin, setParentalPin] = useState("");
  const [parentalError, setParentalError] = useState("");

  const movie: VodMovie | undefined = cachedMovies.find((m) => m.id === id);
  const show: SeriesItem | undefined = cachedSeries.find((s) => s.id === id);

  const isFavorite = movie
    ? favoriteMovieIds.includes(id)
    : favoriteSeriesIds.includes(id);
  const parentalCategoryKind: ParentalCategoryKind = movie ? "movies" : "series";
  const parentalCategoryId = movie?.categoryId ?? show?.categoryId ?? "";
  const isBlocked = isContentBlocked(id) || isCategoryBlocked(parentalCategoryKind, parentalCategoryId);

  const seasonsCount = realSeasonsCount ?? show?.seasonsCount ?? 1;
  const resumeEntry = useMemo(() => {
    if (movie) return history.find((entry) => entry.type === "movie" && entry.contentId === movie.id);
    if (!show) return undefined;
    return history
      .filter((entry) => entry.type === "episode" && entry.seriesId === show.id)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  }, [history, movie, show]);

  // Fetch series episodes from Xtream API
  useEffect(() => {
    if (!show || !activeProfile) return;
    if (fetchedSeriesIdRef.current === show.seriesId) return;
    fetchedSeriesIdRef.current = show.seriesId;
    const controller = new AbortController();
    let cancelled = false;

    setEpisodesLoading(true);
    setEpisodesError(null);

    getSeriesInfo(activeProfile, show.seriesId, controller.signal)
      .then((raw) => {
        if (cancelled) return;
        const { episodes: parsed, seasonsCount: sc } = parseSeriesEpisodes(
          raw,
          show.id,
          activeProfile,
        );
        setEpisodesData(parsed);
        setRealSeasonsCount(sc);
        setSeason(1);
      })
      .catch((err: unknown) => {
        if (cancelled || (err instanceof Error && err.name === "AbortError")) return;
        console.error("Falha ao carregar episódios", err);
        const msg = err instanceof Error ? err.message : "Não foi possível carregar os episódios.";
        setEpisodesError(msg);
      })
      .finally(() => {
        if (!cancelled) setEpisodesLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [show, activeProfile]);

  const selectedEpisodes = useMemo(
    () => episodesData.filter((ep) => ep.seasonNumber === season),
    [episodesData, season],
  );

  const similar = useMemo(
    () => {
      // Catalogues can have tens of thousands of entries. `filter().slice()`
      // allocated a second full catalogue every time a detail screen opened,
      // which can cause GC pauses or process eviction on Fire TV devices.
      const source = show ? cachedSeries : cachedMovies;
      const currentId = show?.id ?? movie?.id;
      const result: (VodMovie | SeriesItem)[] = [];
      for (const item of source) {
        if (item.id === currentId) continue;
        result.push(item);
        if (result.length === 6) break;
      }
      return result;
    },
    [movie?.id, show?.id, cachedMovies, cachedSeries],
  );

  // Optional Internet metadata must not compete with episode loading during
  // the navigation transition. Run it after the first frame and serially.
  useEffect(() => {
    const item = movie ?? show;
    if (!item) return;
    const existingPlot = item.plot?.trim() ?? "";
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        const needsSynopsis = existingPlot.length <= 30 || existingPlot.toLowerCase() === "n/a";
        if (needsSynopsis) {
          setSynopsisLoading(true);
          try {
            const synopsis = await loadOrFetchSynopsis(item.id, item.title, existingPlot);
            if (!cancelled && synopsis) setFetchedSynopsis(synopsis);
          } catch (err) {
            console.error("Falha ao buscar sinopse", err);
          } finally {
            if (!cancelled) setSynopsisLoading(false);
          }
        }

        if (cancelled || !isTmdbConfigured()) return;
        setTmdbLoading(true);
        try {
          const metadata = await fetchTmdbMetadata(item.title, movie ? "movie" : "tv");
          if (!cancelled) setTmdbMetadata(metadata);
        } finally {
          if (!cancelled) setTmdbLoading(false);
        }
      })();
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [movie, show]);

  const missingError = !movie && !show ? "Este conteúdo não está disponível no catálogo." : null;

  const performPlay = useCallback(
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
            parentalCategoryKind: "movies",
            parentalCategoryId: movie.categoryId,
          },
        });
        return;
      }
      const episode = episodesData.find((item) => item.id === episodeId)
        ?? (isResumable(resumeEntry)
          ? episodesData.find((item) => item.id === resumeEntry?.contentId)
          : undefined)
        ?? episodesData[0];
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
          parentalCategoryKind: "series",
          parentalCategoryId: show.categoryId,
          ...(episode.introEndSeconds ? { introEndSeconds: String(episode.introEndSeconds) } : {}),
        },
      });
    },
    [movie, router, episodesData, resumeEntry, show],
  );

  const requestParentalPin = useCallback((pendingAction: string) => {
    setParentalError("");
    setParentalPin("");
    setPendingEpisodeId(pendingAction);
  }, []);

  const handlePlay = useCallback((episodeId?: string) => {
    if (isBlocked) {
      requestParentalPin(episodeId ?? "__movie__");
      return;
    }
    performPlay(episodeId);
  }, [isBlocked, performPlay, requestParentalPin]);

  const handleToggleBlocked = useCallback(() => {
    requestParentalPin("__toggle_block__");
  }, [requestParentalPin]);

  const unlockAndPlay = useCallback(async () => {
    try {
      const result = await verifyParentalPin(parentalPin);
      if (!result.success) { setParentalError(result.lockedUntil > Date.now() ? "PIN temporariamente bloqueado." : "PIN incorreto."); return; }
      if (pendingEpisodeId === "__toggle_block__") {
        toggleContentBlocked(id);
        setPendingEpisodeId(null);
        setParentalPin("");
        return;
      }
      const episode = pendingEpisodeId === "__movie__" ? undefined : pendingEpisodeId ?? undefined;
      setPendingEpisodeId(null);
      setParentalPin("");
      performPlay(episode);
    } catch (error) { setParentalError(error instanceof Error ? error.message : "Não foi possível validar o PIN."); }
  }, [id, parentalPin, pendingEpisodeId, performPlay, toggleContentBlocked]);

  const handleFavorite = useCallback(() => {
    if (movie) {
      toggleFavoriteMovie(id);
    } else {
      toggleFavoriteSeries(id);
    }
  }, [id, movie, toggleFavoriteMovie, toggleFavoriteSeries]);

  const handleSimilar = useCallback(
    (similarId: string) => {
      router.push(`/details/${similarId}`);
    },
    [router],
  );

  const handleRetry = useCallback(() => router.back(), [router]);

  return (
    <View style={styles.screen}>
      <Modal visible={pendingEpisodeId !== null} transparent animationType="fade" onRequestClose={() => setPendingEpisodeId(null)}>
        <View style={styles.parentalBackdrop}>
          <View style={styles.parentalDialog}>
            <AppText style={styles.parentalTitle}>
              {pendingEpisodeId === "__toggle_block__" ? "Confirmar alteração" : "Conteúdo protegido"}
            </AppText>
            <AppText style={styles.parentalBody}>
              {pendingEpisodeId === "__toggle_block__"
                ? "Informe o PIN parental para alterar a proteção deste conteúdo."
                : "Informe o PIN parental para continuar."}
            </AppText>
            <TextInput
              value={parentalPin}
              onChangeText={setParentalPin}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={8}
              style={styles.parentalInput}
              accessibilityLabel="PIN parental"
            />
            <AppText style={styles.parentalError}>{parentalError}</AppText>
            <View style={styles.parentalActions}>
              <TVFocusable onPress={() => setPendingEpisodeId(null)} style={styles.parentalCancel}>
                <AppText style={styles.actionText}>Cancelar</AppText>
              </TVFocusable>
              <TVFocusable onPress={() => void unlockAndPlay()} style={styles.primaryButton}>
                <AppText style={styles.primaryText}>Confirmar</AppText>
              </TVFocusable>
            </View>
          </View>
        </View>
      </Modal>
      {missingError ? <ErrorState message={missingError} onRetry={handleRetry} /> : null}
        {movie || show ? (
          <DetailsContent
            movie={movie}
            show={show}
            similar={similar}
            season={season}
            seasonsCount={seasonsCount}
            selectedEpisodes={selectedEpisodes}
            history={history}
            resumeEntry={resumeEntry}
            episodesLoading={episodesLoading}
            episodesError={episodesError}
            isFavorite={isFavorite}
            isBlocked={isBlocked}
            tvMode={tvMode}
            fetchedSynopsis={fetchedSynopsis}
            synopsisLoading={synopsisLoading}
            tmdbMetadata={tmdbMetadata}
            tmdbLoading={tmdbLoading}
            onBack={router.back}
            onFavorite={handleFavorite}
            onToggleBlocked={handleToggleBlocked}
            onPlay={handlePlay}
            onSeasonChange={setSeason}
            onSimilar={handleSimilar}
          />
        ) : null}
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
  history,
  resumeEntry,
  episodesLoading,
  episodesError,
  isFavorite,
  isBlocked,
  tvMode,
  fetchedSynopsis,
  synopsisLoading,
  tmdbMetadata,
  tmdbLoading,
  onBack,
  onFavorite,
  onToggleBlocked,
  onPlay,
  onSeasonChange,
  onSimilar,
}: {
  movie?: VodMovie;
  show?: SeriesItem;
  similar: (VodMovie | SeriesItem)[];
  season: number;
  seasonsCount: number;
  selectedEpisodes: EpisodeItem[];
  history: PlayHistory[];
  resumeEntry?: PlayHistory;
  episodesLoading: boolean;
  episodesError: string | null;
  isFavorite: boolean;
  isBlocked: boolean;
  tvMode: boolean;
  fetchedSynopsis: string | null;
  synopsisLoading: boolean;
  tmdbMetadata: TmdbMetadata | null;
  tmdbLoading: boolean;
  onBack: () => void;
  onFavorite: () => void;
  onToggleBlocked: () => void;
  onPlay: (episodeId?: string) => void;
  onSeasonChange: (season: number) => void;
  onSimilar: (id: string) => void;
}) {
  const { isTablet } = useResponsiveLayout();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, tvMode && styles.tvContent, isTablet && styles.tabletContent]}
    >
      <ContentSummary
        movie={movie}
        show={show}
        tvMode={tvMode}
        isFavorite={isFavorite}
        fetchedSynopsis={fetchedSynopsis}
        synopsisLoading={synopsisLoading}
        tmdbMetadata={tmdbMetadata}
        tmdbLoading={tmdbLoading}
        onBack={onBack}
        onFavorite={onFavorite}
      />
      <ContentActions
        isMovie={Boolean(movie)}
        tvMode={tvMode}
        isFavorite={isFavorite}
        isBlocked={isBlocked}
        canResume={isResumable(resumeEntry)}
        onPlay={onPlay}
        onFavorite={onFavorite}
        onToggleBlocked={onToggleBlocked}
      />
      {show ? (
        <EpisodesSection
          show={{ ...show, seasonsCount }}
          season={season}
          selectedEpisodes={selectedEpisodes}
          history={history}
          isLoading={episodesLoading}
          loadError={episodesError}
          onPlay={onPlay}
          onSeasonChange={onSeasonChange}
          tvMode={tvMode}
        />
      ) : null}
      {similar.length > 0 ? (
        <SimilarSection similar={similar} onSimilar={onSimilar} tvMode={tvMode} />
      ) : null}
    </ScrollView>
  );
}

function ContentSummary({
  movie,
  show,
  tvMode,
  isFavorite,
  fetchedSynopsis,
  synopsisLoading,
  tmdbMetadata,
  tmdbLoading,
  onBack,
  onFavorite,
}: {
  movie?: VodMovie;
  show?: SeriesItem;
  tvMode: boolean;
  isFavorite: boolean;
  fetchedSynopsis: string | null;
  synopsisLoading: boolean;
  tmdbMetadata: TmdbMetadata | null;
  tmdbLoading: boolean;
  onBack: () => void;
  onFavorite: () => void;
}) {
  const { isTablet, isTabletLandscape } = useResponsiveLayout();
  const title = movie?.title ?? show?.title ?? "Conteúdo";
  const poster = movie?.poster ?? show?.poster;
  const backdrop = movie?.backdrop ?? show?.backdrop;
  const rating = tmdbMetadata?.rating ?? movie?.rating ?? show?.rating ?? 0;

  const serverPlot = (movie?.plot ?? show?.plot ?? "").trim();
  const hasServerPlot = serverPlot.length > 30 && serverPlot.toLowerCase() !== "n/a";
  const displayPlot = tmdbMetadata?.synopsis ?? (hasServerPlot ? serverPlot : fetchedSynopsis);
  const genres = tmdbMetadata?.genres.length ? tmdbMetadata.genres.join(" · ") : movie?.genre ?? show?.genre;
  const openTrailer = () => { if (tmdbMetadata?.trailerUrl) void WebBrowser.openBrowserAsync(tmdbMetadata.trailerUrl); };

  return (
    <>
      <View style={[styles.backdrop, tvMode && styles.tvBackdrop, isTablet && styles.tabletBackdrop, isTabletLandscape && styles.tabletLandscapeBackdrop]}>
        <Image source={{ uri: backdrop || poster }} contentFit="cover" style={StyleSheet.absoluteFill} />
        {/* Keep the artwork clear at the top, then transition into a deep
            readable stage instead of placing a hard dark block over it. */}
        <LinearGradient
          colors={tvMode ? ["rgba(5,8,13,0.02)", "rgba(5,8,13,0.12)", "rgba(5,8,13,0.92)"] : ["rgba(5,8,13,0.02)", "rgba(5,8,13,0.18)", "rgba(5,8,13,0.97)"]}
          locations={[0, 0.38, 1]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={tvMode ? ["rgba(5,8,13,0.70)", "rgba(5,8,13,0.24)", "transparent"] : ["rgba(5,8,13,0.10)", "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.topControls, tvMode && styles.tvTopControls]}>
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
      <View style={[styles.titleBlock, tvMode && styles.tvTitleBlock, isTablet && styles.tabletTitleBlock]}>
        {!tvMode ? (
          <View style={[styles.poster, isTablet && styles.tabletPoster]}>
            <Image source={{ uri: poster }} contentFit="cover" style={StyleSheet.absoluteFill} />
            <View style={styles.posterBadge}>
              <Ionicons name="star" size={10} color={Colors.amber} />
              <AppText style={styles.posterRating}>{rating.toFixed(1)}</AppText>
            </View>
          </View>
        ) : null}
        <View style={[styles.titleCopy, tvMode && styles.tvTitleCopy]}>
          <AppText style={tvMode ? styles.tvTitle : Type.title}>{title}</AppText>
          <View style={styles.metaRow}>
            {tvMode ? <Ionicons name="tv-outline" size={15} color={Colors.text} /> : null}
            <AppText style={[styles.meta, tvMode && styles.tvMeta]}>{(movie?.year ?? show?.year ?? 0) > 0 ? (movie?.year ?? show?.year) : "Ano não informado"}</AppText>
            <View style={styles.metaDot} />
            <AppText style={[styles.meta, tvMode && styles.tvMeta]}>{genres}</AppText>
            {movie ? (
              <>
                <View style={styles.metaDot} />
                <AppText style={[styles.meta, tvMode && styles.tvMeta]}>{movie.duration}</AppText>
              </>
            ) : null}
          </View>
          {displayPlot ? (
            <AppText numberOfLines={tvMode ? 3 : 4} style={[styles.plot, tvMode && styles.tvPlot]}>{displayPlot}</AppText>
          ) : synopsisLoading ? (
            <View style={styles.synopsisLoading}>
              <ActivityIndicator size="small" color={Colors.subtle} />
              <AppText style={styles.synopsisLoadingText}>Buscando sinopse...</AppText>
            </View>
          ) : (
            <AppText style={styles.plotMissing}>Sinopse não disponível.</AppText>
          )}
          {tmdbLoading ? (
            <View style={styles.synopsisLoading}><ActivityIndicator size="small" color={Colors.subtle} /><AppText style={styles.synopsisLoadingText}>Atualizando dados do TMDB...</AppText></View>
          ) : null}
          {tmdbMetadata?.trailerUrl ? (
            <TVFocusable onPress={openTrailer} focusStyle={styles.whiteActionFocused} style={[styles.trailerButton, tvMode && styles.tvTrailerButton]} accessibilityLabel="Abrir trailer">
              <Ionicons name="play-circle-outline" size={17} color={Colors.background} />
              <AppText style={[styles.trailerButtonText, tvMode && styles.tvTrailerButtonText]}>Trailer</AppText>
            </TVFocusable>
          ) : null}
          {tmdbMetadata?.cast.length ? (
            <View style={[styles.castSection, tvMode && styles.tvCastSection]}>
              <AppText style={styles.castTitle}>ELENCO</AppText>
              <AppText numberOfLines={2} style={styles.castText}>{tmdbMetadata.cast.map((person) => person.character ? `${person.name} (${person.character})` : person.name).join(" · ")}</AppText>
            </View>
          ) : null}
          {tmdbMetadata ? (
            <View style={styles.synopsisSource}><Ionicons name="film-outline" size={10} color={Colors.subtle} /><AppText style={styles.synopsisSourceText}>Informações via TMDB</AppText></View>
          ) : !hasServerPlot && fetchedSynopsis ? (
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
  tvMode,
  isFavorite,
  isBlocked,
  canResume,
  onPlay,
  onFavorite,
  onToggleBlocked,
}: {
  isMovie: boolean;
  tvMode: boolean;
  isFavorite: boolean;
  isBlocked: boolean;
  canResume: boolean;
  onPlay: () => void;
  onFavorite: () => void;
  onToggleBlocked: () => void;
}) {
  const { isTablet } = useResponsiveLayout();
  return (
    <View style={[styles.actions, tvMode && styles.tvActions, isTablet && styles.tabletActions]}>
      <TVFocusable
        accessibilityRole="button"
        accessibilityLabel={canResume ? "Continuar reprodução" : isMovie ? "Assistir agora" : "Reproduzir série"}
        hasTVPreferredFocus
        onPress={onPlay}
        focusStyle={styles.whiteActionFocused}
        style={[styles.primaryButton, tvMode && styles.tvPrimaryButton]}
      >
        <Ionicons name="play" size={16} color={Colors.background} />
        <AppText style={[styles.primaryText, tvMode && styles.tvPrimaryText]}>
          {canResume ? "Continuar" : isMovie ? "Assistir agora" : "Reproduzir"}
        </AppText>
      </TVFocusable>
      <TVFocusable
        accessibilityRole="button"
        accessibilityLabel={isBlocked ? "Remover bloqueio parental" : "Bloquear conteúdo"}
        accessibilityState={{ selected: isBlocked }}
        onPress={onToggleBlocked}
        focusStyle={styles.whiteActionFocused}
        style={[styles.actionButton, isBlocked && styles.actionButtonCritical, tvMode && styles.tvActionButton]}
      >
        <Ionicons
          name={isBlocked ? "lock-closed" : "lock-open-outline"}
          size={17}
          color={isBlocked ? "#B4232B" : Colors.background}
        />
        <AppText style={[styles.actionText, isBlocked && styles.actionTextCritical]}>{isBlocked ? "Bloqueado" : "Bloquear"}</AppText>
      </TVFocusable>
      <TVFocusable
        accessibilityRole="button"
        accessibilityLabel={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        accessibilityState={{ selected: isFavorite }}
        onPress={onFavorite}
        focusStyle={styles.whiteActionFocused}
        style={[styles.actionButton, isFavorite && styles.actionButtonActive, tvMode && styles.tvActionButton]}
      >
        <Ionicons
          name={isFavorite ? "bookmark" : "bookmark-outline"}
          size={17}
          color={isFavorite ? "#9A6700" : Colors.background}
        />
        <AppText style={[styles.actionText, isFavorite && styles.actionTextActive]}>
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
  history,
  isLoading,
  loadError,
  onPlay,
  onSeasonChange,
  tvMode,
}: {
  show: SeriesItem & { seasonsCount: number };
  season: number;
  selectedEpisodes: EpisodeItem[];
  history: PlayHistory[];
  isLoading: boolean;
  loadError: string | null;
  onPlay: (episodeId?: string) => void;
  onSeasonChange: (season: number) => void;
  tvMode: boolean;
}) {
  const { isTablet, isTabletLandscape } = useResponsiveLayout();
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);
  const selectSeason = useCallback((nextSeason: number) => {
    onSeasonChange(nextSeason);
    setSeasonMenuOpen(false);
  }, [onSeasonChange]);

  return (
    <View style={[styles.episodesSection, tvMode && styles.tvEpisodesSection, isTablet && styles.tabletEpisodesSection]}>
      <SectionHeader
        title="Episódios"
        subtitle={`${show.seasonsCount} temporada${show.seasonsCount !== 1 ? "s" : ""}`}
      />
      {tvMode ? (
        <View style={styles.tvSeasonSelectorArea}>
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel={`Selecionar temporada. Atual: temporada ${season}`}
            accessibilityState={{ expanded: seasonMenuOpen }}
            onPress={() => setSeasonMenuOpen((open) => !open)}
            style={styles.tvSeasonSelector}
            focusStyle={styles.tvSeasonSelectorFocused}
          >
            <Ionicons name="albums-outline" size={16} color={Colors.background} />
            <AppText style={styles.tvSeasonSelectorText}>Temporada {season}</AppText>
            <Ionicons name={seasonMenuOpen ? "chevron-up" : "chevron-down"} size={18} color={Colors.background} />
          </TVFocusable>
          {seasonMenuOpen ? (
            <View style={styles.tvSeasonMenu}>
              {Array.from({ length: show.seasonsCount }, (_, i) => i + 1).map((num) => (
                <TVFocusable
                  key={num}
                  accessibilityRole="button"
                  accessibilityLabel={`Temporada ${num}`}
                  accessibilityState={{ selected: season === num }}
                  onPress={() => selectSeason(num)}
                  style={[styles.tvSeasonOption, season === num && styles.tvSeasonOptionSelected]}
                  focusStyle={styles.tvSeasonOptionFocused}
                >
                  <AppText style={[styles.tvSeasonOptionText, season === num && styles.tvSeasonOptionTextSelected]}>
                    Temporada {num}
                  </AppText>
                  {season === num ? <Ionicons name="checkmark" size={15} color={Colors.blueBright} /> : null}
                </TVFocusable>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.mobileSeasonSelectorArea}>
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel={`Selecionar temporada. Atual: temporada ${season}`}
            accessibilityState={{ expanded: seasonMenuOpen }}
            onPress={() => setSeasonMenuOpen((open) => !open)}
            style={styles.mobileSeasonSelector}
          >
            <Ionicons name="albums-outline" size={17} color={Colors.background} />
            <AppText style={styles.mobileSeasonSelectorText}>Temporada {season}</AppText>
            <Ionicons name={seasonMenuOpen ? "chevron-up" : "chevron-down"} size={18} color={Colors.background} />
          </TVFocusable>
          {seasonMenuOpen ? (
            <View style={styles.mobileSeasonList}>
              {Array.from({ length: show.seasonsCount }, (_, i) => i + 1).map((num) => (
                <TVFocusable
                  key={num}
                  accessibilityRole="button"
                  accessibilityLabel={`Temporada ${num}`}
                  accessibilityState={{ selected: season === num }}
                  onPress={() => selectSeason(num)}
                  style={[styles.mobileSeasonOption, season === num && styles.mobileSeasonOptionSelected]}
                >
                  <AppText style={[styles.mobileSeasonOptionText, season === num && styles.mobileSeasonOptionTextSelected]}>
                    Temporada {num}
                  </AppText>
                  {season === num ? <Ionicons name="checkmark" size={17} color={Colors.blueBright} /> : null}
                </TVFocusable>
              ))}
            </View>
          ) : null}
        </View>
      )}

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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.episodeList, tvMode ? styles.tvEpisodeList : styles.mobileEpisodeList]}
        >
          {selectedEpisodes.length ? (
            selectedEpisodes.map((episode) => (
              <EpisodeCard
                key={episode.id}
                episode={episode}
                historyEntry={history.find((entry) => entry.contentId === episode.id)}
                onPlay={onPlay}
                tvMode={tvMode}
                tabletMode={isTablet}
                tabletLandscape={isTabletLandscape}
              />
            ))
          ) : (
            <EmptyState
              title="Sem episódios nesta temporada"
              body="Os episódios desta temporada ainda não estão disponíveis no servidor."
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

function EpisodeCard({
  episode,
  historyEntry,
  onPlay,
  tvMode,
  tabletMode,
  tabletLandscape,
}: {
  episode: EpisodeItem;
  historyEntry?: PlayHistory;
  onPlay: (episodeId?: string) => void;
  tvMode: boolean;
  tabletMode: boolean;
  tabletLandscape: boolean;
}) {
  const handlePress = useCallback(() => onPlay(episode.id), [episode.id, onPlay]);
  const progress = getHistoryProgress(historyEntry);
  const hasProgress = isResumable(historyEntry);
  return (
    <TVFocusable
      accessibilityRole="button"
      accessibilityLabel={`${hasProgress ? "Continuar" : "Reproduzir"} ${episode.title}${hasProgress ? `, ${progress}% assistido` : ""}`}
      onPress={handlePress}
      style={({ pressed }) => [styles.episodeCard, tvMode ? styles.tvEpisodeCard : tabletLandscape ? styles.tabletLandscapeEpisodeCard : tabletMode ? styles.tabletEpisodeCard : styles.mobileEpisodeCard, pressed && styles.pressed]}
    >
      <View style={[styles.episodeThumb, tvMode ? styles.tvEpisodeThumb : tabletMode ? styles.tabletEpisodeThumb : styles.mobileEpisodeThumb]}>
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
      <View style={[styles.episodeCopy, tvMode ? styles.tvEpisodeCopy : tabletMode ? styles.tabletEpisodeCopy : styles.mobileEpisodeCopy]}>
        <AppText numberOfLines={1} style={[styles.episodeTitle, tvMode && styles.tvEpisodeTitle]}>
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
          {hasProgress ? (
            <View style={styles.episodeProgress}>
              <View style={[styles.episodeProgressFill, { width: `${progress}%` }]} />
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
  tvMode,
}: {
  similar: (VodMovie | SeriesItem)[];
  onSimilar: (id: string) => void;
  tvMode: boolean;
}) {
  const { isTablet, isTabletLandscape } = useResponsiveLayout();
  return (
    <View style={[styles.similarSection, tvMode && styles.tvSimilarSection, isTablet && styles.tabletSimilarSection]}>
      <SectionHeader title="Você também pode gostar" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.similarScroller}
        contentContainerStyle={[styles.similarContent, tvMode && styles.tvSimilarContent, isTablet && styles.tabletSimilarContent]}
      >
        {similar.map((item) => (
          <TVFocusable
            key={item.id}
            accessibilityRole="button"
            onPress={() => onSimilar(item.id)}
            style={[styles.similarCard, tvMode && styles.tvSimilarCard, isTablet && styles.tabletSimilarCard]}
          >
            <Image
              source={{ uri: item.poster }}
              contentFit="cover"
              style={[styles.similarImage, tvMode && styles.tvSimilarImage, isTablet && styles.tabletSimilarImage, isTabletLandscape && styles.tabletLandscapeSimilarImage]}
            />
            <AppText numberOfLines={1} style={styles.similarTitle}>
              {item.title}
            </AppText>
            <View style={styles.similarMeta}>
              <Ionicons name="star" size={10} color={Colors.amber} />
              <AppText style={styles.similarMetaText}>
                {item.year > 0 ? item.year : "Ano não informado"} · {item.rating.toFixed(1)}
              </AppText>
            </View>
          </TVFocusable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  parentalBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.72)" },
  parentalDialog: { width: "100%", maxWidth: 420, gap: 12, padding: 22, borderRadius: 18, backgroundColor: Colors.backgroundRaised, borderWidth: 1, borderColor: Colors.border },
  parentalTitle: { color: Colors.text, fontSize: 20, fontWeight: "700" },
  parentalBody: { color: Colors.muted, lineHeight: 20 },
  parentalInput: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, color: Colors.text, paddingHorizontal: 14, fontSize: 18 },
  parentalError: { color: "#FF8B91", minHeight: 18 },
  parentalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  parentalCancel: { minWidth: 104, minHeight: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { gap: 18, paddingBottom: 38 },
  tvContent: { gap: 18, paddingBottom: 42 },
  tabletContent: { width: "100%", maxWidth: 1180, alignSelf: "center", gap: 22, paddingBottom: 48 },
  backdrop: { height: 286, overflow: "hidden", backgroundColor: Colors.backgroundRaised },
  // Keep the artwork cinematic without consuming the whole first TV viewport.
  // Actions and the season selector should begin within the initial scroll
  // position on 720p and 1080p televisions.
  tvBackdrop: { height: 448 },
  tabletBackdrop: { height: 338 },
  tabletLandscapeBackdrop: { height: 390 },
  topControls: {
    position: "absolute",
    top: 18,
    right: 20,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tvTopControls: { top: 26, right: 42, left: 42 },
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
  titleBlock: { flexDirection: "row", gap: 14, paddingHorizontal: 20, marginTop: -62 },
  tabletTitleBlock: { paddingHorizontal: 32, marginTop: -78 },
  // TV uses an editorial streaming composition: the artwork remains the
  // stage, while metadata and actions are compact and anchored in the
  // lower-left safe area rather than spanning the entire display.
  tvTitleBlock: {
    width: "54%",
    minHeight: 176,
    marginTop: -224,
    paddingHorizontal: 0,
    marginLeft: 62,
  },
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
  tabletPoster: { width: 124, height: 178 },
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
  tvTitleCopy: { justifyContent: "flex-start", gap: 6, paddingBottom: 0 },
  tvTitle: { fontFamily: "Inter_700Bold", fontSize: 24, lineHeight: 29, color: Colors.white, letterSpacing: -0.45 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
  meta: { fontSize: 11, color: Colors.muted },
  tvMeta: { fontFamily: "Inter_500Medium", fontSize: 10, color: "rgba(255,255,255,0.84)" },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.subtle },
  plot: { fontSize: 12, lineHeight: 18, color: Colors.muted },
  tvPlot: { maxWidth: 620, fontSize: 11, lineHeight: 16, color: "rgba(255,255,255,0.9)" },
  plotMissing: { fontSize: 12, color: Colors.subtle, fontStyle: "italic" },
  synopsisLoading: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  synopsisLoadingText: { fontSize: 11, color: Colors.subtle },
  trailerButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, minHeight: 43, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.78)", backgroundColor: Colors.white },
  trailerButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.background },
  tvTrailerButton: { minHeight: 38, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, borderColor: "rgba(255,255,255,0.86)", backgroundColor: Colors.white },
  tvTrailerButtonText: { fontSize: 11 },
  castSection: { gap: 3, marginTop: 2 },
  tvCastSection: { maxWidth: 900, marginTop: 5 },
  castTitle: { fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 0.8, color: Colors.subtle },
  castText: { fontSize: 10, lineHeight: 15, color: Colors.muted },
  synopsisSource: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  synopsisSourceText: { fontSize: 9, color: Colors.subtle },
  // Mobile keeps labels and comfortable touch targets, but avoids a dominant
  // full-width call-to-action.  On narrow phones the secondary actions wrap
  // naturally instead of squeezing the title action into an oversized rail.
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, paddingHorizontal: 20 },
  tabletActions: { paddingHorizontal: 32, gap: 12 },
  tvActions: { alignSelf: "flex-start", gap: 9, paddingHorizontal: 0, marginLeft: 62, marginTop: -3 },
  primaryButton: {
    minHeight: 43,
    flexGrow: 0,
    minWidth: 156,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: Radii.pill,
    backgroundColor: Colors.white,
  },
  tvPrimaryButton: { flex: 0, width: 166, minHeight: 38, borderRadius: 9, backgroundColor: Colors.white },
  whiteActionFocused: { backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.blueBright, opacity: 1, transform: [{ scale: 1.025 }] },
  primaryText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.background },
  tvPrimaryText: { fontSize: 11, color: Colors.background },
  actionButton: {
    minHeight: 43,
    minWidth: 104,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.82)",
    backgroundColor: Colors.white,
  },
  tvActionButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 9, borderColor: "rgba(255,255,255,0.86)", backgroundColor: Colors.white },
  actionButtonActive: { borderColor: "rgba(154,103,0,0.68)", backgroundColor: Colors.white },
  actionButtonCritical: { borderColor: "rgba(180,35,43,0.70)", backgroundColor: Colors.white },
  actionText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.background },
  actionTextActive: { color: "#725000" },
  actionTextCritical: { color: "#9A2027" },
  episodesSection: { gap: 12, paddingHorizontal: 20 },
  tabletEpisodesSection: { paddingHorizontal: 32, gap: 14 },
  tvEpisodesSection: { gap: 10, paddingHorizontal: 62, paddingTop: 4 },
  tvSeasonSelectorArea: { alignSelf: "flex-start", minWidth: 230, zIndex: 3 },
  tvSeasonSelector: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(238,244,252,0.94)" },
  tvSeasonSelectorFocused: { borderWidth: 2, borderColor: Colors.blueBright, backgroundColor: Colors.white, transform: [{ scale: 1 }] },
  tvSeasonSelectorText: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.background },
  tvSeasonMenu: { gap: 2, marginTop: 5, padding: 5, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.80)", backgroundColor: Colors.white },
  tvSeasonOption: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, borderRadius: 6, backgroundColor: Colors.white },
  tvSeasonOptionSelected: { backgroundColor: "rgba(47,132,205,0.13)" },
  tvSeasonOptionFocused: { borderWidth: 2, borderColor: Colors.blueBright, backgroundColor: Colors.white, transform: [{ scale: 1 }] },
  tvSeasonOptionText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.background },
  tvSeasonOptionTextSelected: { fontFamily: "Inter_700Bold" },
  // The selector expands in place, keeping the current detail context visible.
  mobileSeasonSelectorArea: { alignSelf: "stretch", gap: 7 },
  mobileSeasonSelector: {
    minHeight: 44,
    alignSelf: "flex-start",
    minWidth: 188,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.82)",
    backgroundColor: Colors.white,
  },
  mobileSeasonSelectorText: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.background },
  mobileSeasonList: { gap: 4, padding: 5, borderRadius: 11, borderWidth: 1, borderColor: Colors.border, backgroundColor: "rgba(17,28,45,0.90)" },
  mobileSeasonOption: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderRadius: 8 },
  mobileSeasonOptionSelected: { backgroundColor: "rgba(44,143,222,0.20)" },
  mobileSeasonOptionText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.muted },
  mobileSeasonOptionTextSelected: { fontFamily: "Inter_700Bold", color: Colors.text },
  episodeList: { gap: 10, paddingBottom: 2 },
  mobileEpisodeList: { flexDirection: "row", paddingRight: 20 },
  tvEpisodeList: { flexDirection: "row", gap: 12, paddingRight: 40 },
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
    minHeight: 108,
    flexDirection: "row",
    gap: 12,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(19,29,45,0.82)",
  },
  tvEpisodeCard: {
    width: 210,
    minHeight: 0,
    flexDirection: "column",
    gap: 8,
    padding: 0,
    overflow: "hidden",
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  mobileEpisodeCard: {
    width: 238,
    minHeight: 0,
    flexDirection: "column",
    gap: 0,
    padding: 0,
    overflow: "hidden",
  },
  tabletEpisodeCard: { width: 276, minHeight: 0, flexDirection: "column", gap: 0, padding: 0, overflow: "hidden" },
  tabletLandscapeEpisodeCard: { width: 300, minHeight: 0, flexDirection: "column", gap: 0, padding: 0, overflow: "hidden" },
  pressed: { opacity: 0.74 },
  episodeThumb: {
    width: 132,
    height: 92,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: Colors.backgroundRaised,
  },
  tvEpisodeThumb: { width: 210, height: 118, borderRadius: 8 },
  mobileEpisodeThumb: { width: "100%", height: 134, borderRadius: 0 },
  tabletEpisodeThumb: { width: "100%", height: 155, borderRadius: 0 },
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
  episodeCopy: { flex: 1, gap: 4, paddingVertical: 2 },
  mobileEpisodeCopy: { gap: 5, paddingHorizontal: 10, paddingTop: 9, paddingBottom: 10 },
  tabletEpisodeCopy: { gap: 6, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 12 },
  tvEpisodeCopy: { minHeight: 42, gap: 2, paddingHorizontal: 2 },
  episodeTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, lineHeight: 17, color: Colors.text },
  tvEpisodeTitle: { fontSize: 11, color: Colors.white },
  episodePlot: { fontSize: 11, lineHeight: 15, color: Colors.muted },
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
  tabletSimilarSection: { paddingLeft: 32 },
  tvSimilarSection: { gap: 8, paddingLeft: 62 },
  similarScroller: { flexGrow: 0, marginHorizontal: -20 },
  similarContent: { gap: 12, paddingHorizontal: 20 },
  tabletSimilarContent: { gap: 14, paddingHorizontal: 32 },
  tvSimilarContent: { gap: 16, paddingHorizontal: 62, paddingRight: 40 },
  similarCard: { width: 122, gap: 6 },
  tvSimilarCard: { width: 164, gap: 6 },
  tabletSimilarCard: { width: 150, gap: 7 },
  similarImage: {
    width: 122,
    height: 160,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundRaised,
  },
  tvSimilarImage: { width: 164, height: 92, borderRadius: 8 },
  tabletSimilarImage: { width: 150, height: 214, borderRadius: 12 },
  tabletLandscapeSimilarImage: { width: 150, height: 108, borderRadius: 10 },
  similarTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  similarMeta: { flexDirection: "row", alignItems: "center", gap: 3 },
  similarMetaText: { fontSize: 10, color: Colors.subtle },
});
