import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText, ChannelLogo, HorizontalScroller, IconButton, PosterCard, SectionHeader } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";
import { CatalogBackground } from "@/components/catalog-background";
import { ParentalGate } from "@/components/parental-gate";
import { EPG_HOME_PRELOAD_LIMIT, useEpgPreload } from "@/hooks/useEpgPreload";
import { useSyncStatus } from "@/hooks/useXtreamSync";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useAppStore } from "@/store/useAppStore";
import { isPlaybackBlocked } from "@/services/security/parentalPolicy";
import type { PlayHistory, SeriesItem, VodMovie } from "@/store/types";

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

function computePosterWidth(tvMode: boolean, width: number): number {
  if (!tvMode && width <= 700) return 142;
  const visibleCards = tvMode
    ? (width >= 1500 ? 10 : width >= 1100 ? 8 : 7)
    : (width >= 1500 ? 7 : width >= 1100 ? 6 : 5);
  const horizontalPadding = tvMode ? 64 : 40;
  const gap = 12;
  return Math.floor((width - horizontalPadding - gap * (visibleCards - 1)) / visibleCards);
}

function seasonsMeta(count: number): string {
  if (count <= 0) return "Temporadas não informadas";
  return `${count} temporada${count !== 1 ? "s" : ""}`;
}

function yearMeta(year: number): string {
  return year > 0 ? String(year) : "Ano não informado";
}

type HeroContent = {
  id: string;
  type: "movie" | "series";
  title: string;
  poster: string;
  backdrop: string;
  rating: number;
  year: number;
  duration: string;
  genre: string;
  plot: string;
  streamUrl?: string;
  featureKind: "most-watched" | "top-rated";
  playCount?: number;
};

function toHeroMovie(movie: VodMovie): Omit<HeroContent, "featureKind" | "playCount"> {
  return { ...movie, type: "movie" };
}

function toHeroSeries(series: SeriesItem): Omit<HeroContent, "featureKind" | "playCount"> {
  return {
    ...series,
    type: "series",
    duration: seasonsMeta(series.seasonsCount),
  };
}

function selectFeaturedContent(movies: VodMovie[], seriesList: SeriesItem[], playCounts: Record<string, number>): HeroContent | null {
  const candidates = [...movies.map(toHeroMovie), ...seriesList.map(toHeroSeries)];
  if (candidates.length === 0) return null;

  const watched = candidates
    .filter((item) => (playCounts[item.id] ?? 0) > 0)
    .sort((a, b) => (playCounts[b.id] ?? 0) - (playCounts[a.id] ?? 0) || b.rating - a.rating)[0];
  if (watched) {
    return { ...watched, featureKind: "most-watched", playCount: playCounts[watched.id] };
  }

  const topRated = [...candidates].sort((a, b) => b.rating - a.rating || b.year - a.year)[0];
  return { ...topRated, featureKind: "top-rated" };
}

interface HeroBannerProps {
  hero: HeroContent;
  height: number;
  tvMode: boolean;
  onPlay: () => void;
  onDetails: () => void;
}

function HeroBanner({ hero, height, tvMode, onPlay, onDetails }: HeroBannerProps) {
  const featureLabel = hero.featureKind === "most-watched" ? "MAIS ASSISTIDO POR VOCÊ" : "MELHOR AVALIADO";
  const featureIcon = hero.featureKind === "most-watched" ? "flame" : "star";
  const playLabel = hero.type === "series" ? "Ver episódios" : "Assistir agora";
  return (
    <View style={[styles.heroWrap, tvMode && styles.tvHeroWrap, { height }]}>
      <Image source={{ uri: hero.backdrop || hero.poster }} contentFit="cover" transition={300} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={tvMode ? ["rgba(4,7,12,0.52)", "rgba(4,7,12,0.05)", "rgba(4,7,12,0.25)"] : ["rgba(4,7,12,0.08)", "rgba(4,7,12,0.14)", "rgba(4,7,12,0.94)"]}
        locations={[0, 0.44, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(4,7,12,0.88)", "rgba(4,7,12,0.36)", "transparent"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[StyleSheet.absoluteFill, !tvMode && styles.heroSideGradient]}
      />
      <View style={styles.heroEdge} />
      <View style={[styles.heroContent, tvMode && styles.tvHeroContent]}>
        <View style={[styles.heroTag, tvMode && styles.tvHeroTag]}>
          <Ionicons name={featureIcon} size={12} color={Colors.blueBright} />
          <AppText style={styles.heroTagText}>{featureLabel}</AppText>
        </View>
        <AppText style={[styles.heroTitle, tvMode && styles.tvHeroTitle]}>{hero.title}</AppText>
        <AppText numberOfLines={2} style={[styles.heroDescription, tvMode && styles.tvHeroDescription]}>{hero.plot}</AppText>
        <View style={styles.heroMeta}>
          <AppText style={[styles.heroMetaText, tvMode && styles.tvHeroMetaText]}>{yearMeta(hero.year)}</AppText>
          <View style={styles.metaDot} />
          <AppText style={[styles.heroMetaText, tvMode && styles.tvHeroMetaText]}>{hero.type === "series" ? hero.genre || hero.duration : hero.duration}</AppText>
          <View style={styles.metaDot} />
          <AppText style={[styles.heroRating, tvMode && styles.tvHeroRating]}>
            <Ionicons name="star" size={11} color={Colors.amber} /> {hero.rating.toFixed(1)}
          </AppText>
        </View>
        <View style={[styles.heroActions, tvMode && styles.tvHeroActions]}>
          <TVFocusable accessibilityRole="button" hasTVPreferredFocus onPress={onPlay} focusStyle={styles.whiteActionFocused} style={[styles.primaryButton, tvMode && styles.tvPrimaryButton]}>
            <Ionicons name="play" size={16} color={Colors.background} />
            <AppText style={[styles.primaryButtonText, tvMode && styles.tvPrimaryButtonText]}>{playLabel}</AppText>
          </TVFocusable>
          <TVFocusable accessibilityRole="button" onPress={onDetails} style={[styles.secondaryButton, tvMode && styles.tvSecondaryButton]}>
            <Ionicons name="information-circle-outline" size={17} color={Colors.text} />
            <AppText style={[styles.secondaryButtonText, tvMode && styles.tvSecondaryButtonText]}>Detalhes</AppText>
          </TVFocusable>
        </View>
      </View>
    </View>
  );
}

function EmptyHomeState({ onSync }: { onSync: () => void }) {
  return (
    <View style={styles.emptyHome}>
      <Ionicons name="cloud-download-outline" size={36} color={Colors.subtle} />
      <AppText style={styles.emptyHomeTitle}>Catálogo vazio</AppText>
      <AppText style={styles.emptyHomeBody}>
        Toque em Sincronizar para baixar os canais e o catálogo do servidor.
      </AppText>
      <TVFocusable onPress={onSync} focusStyle={styles.whiteActionFocused} style={styles.syncBtn} accessibilityLabel="Sincronizar conteúdo">
        <Ionicons name="refresh" size={15} color={Colors.background} />
        <AppText style={styles.syncBtnText}>Sincronizar agora</AppText>
      </TVFocusable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function HomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const tvMode = useTVMode();
  const history = useAppStore((state) => state.history);
  const playCounts = useAppStore((state) => state.playCounts);
  const isContentBlocked = useAppStore((state) => state.isContentBlocked);
  const [pendingHistoryItem, setPendingHistoryItem] = useState<PlayHistory | null>(null);
  const channels = useAppStore((state) => state.contentCache.liveChannels);
  const movies = useAppStore((state) => state.contentCache.vodMovies);
  const seriesList = useAppStore((state) => state.contentCache.seriesList);
  const { isSyncing, syncProgress, refresh } = useSyncStatus();

  const posterWidth = computePosterWidth(tvMode, width);
  const heroHeight = tvMode
    ? Math.round(Math.min(420, Math.max(300, height * 0.40)))
    : Math.round(Math.min(310, Math.max(238, height * 0.31)));
  const syncLabel = syncProgress ?? "Sincronizando conteúdo...";

  // The hero is data-driven: user playback wins, then the best TMDB rating
  // keeps first access useful without pretending an arbitrary catalogue item is
  // a weekly highlight.
  const hero = useMemo(
    () => selectFeaturedContent(movies, seriesList, playCounts),
    [movies, playCounts, seriesList],
  );

  const handleSearch = useCallback(() => { router.push("/search"); }, [router]);
  const handleContinueWatchingAll = useCallback(() => { router.push("/continue-watching"); }, [router]);
  const handleWatchLaterAll = useCallback(() => { router.push("/watch-later"); }, [router]);
  const handleHeroDetails = useCallback(() => {
    if (hero) router.push(`/details/${hero.id}`);
  }, [hero, router]);
  const handleHeroPlay = useCallback(() => {
    if (!hero) return;
    if (hero.type === "movie" && hero.streamUrl) {
      router.push({ pathname: "/player", params: { id: hero.id, title: hero.title, type: "movie", streamUrl: hero.streamUrl } });
      return;
    }
    router.push(`/details/${hero.id}`);
  }, [hero, router]);
  const handleOpenLive = useCallback(() => { router.push("/live"); }, [router]);
  const handleOpenMovies = useCallback(() => { router.push("/movies"); }, [router]);
  const handleOpenSeries = useCallback(() => { router.push("/series"); }, [router]);
  const handleContent = useCallback((id: string) => { router.push(`/details/${id}`); }, [router]);

  const handleLive = useCallback((channelId: string) => {
    const channel = channels.find((item) => item.id === channelId);
    if (!channel) return;
    router.push({ pathname: "/player", params: { id: channel.id, title: channel.name, type: "live", streamUrl: channel.streamUrl } });
  }, [channels, router]);

  const handleHistory = useCallback((item: PlayHistory) => {
    if (isPlaybackBlocked(item.contentId, item.seriesId, isContentBlocked)) {
      setPendingHistoryItem(item);
      return;
    }
    if (item.streamUrl) {
      router.push({
        pathname: "/player",
        params: {
          id: item.contentId,
          title: item.title,
          type: item.type,
          streamUrl: item.streamUrl,
          subtitle: item.subtitle,
          thumbnail: item.thumbnail,
          seriesId: item.seriesId,
        },
      });
      return;
    }
    router.push(`/details/${item.seriesId ?? item.contentId}`);
  }, [isContentBlocked, router]);

  const openAuthorizedHistory = useCallback(() => {
    const item = pendingHistoryItem;
    setPendingHistoryItem(null);
    if (!item) return;
    if (item.streamUrl) {
      router.push({ pathname: "/player", params: { id: item.contentId, title: item.title, type: item.type, streamUrl: item.streamUrl, subtitle: item.subtitle, thumbnail: item.thumbnail, seriesId: item.seriesId } });
      return;
    }
    router.push(`/details/${item.seriesId ?? item.contentId}`);
  }, [pendingHistoryItem, router]);

  const favoriteMovieIds = useAppStore((state) => state.favoriteMovieIds);
  const favoriteSeriesIds = useAppStore((state) => state.favoriteSeriesIds);

  // Deduplicate episodes per series — keep only the most recently watched episode per show
  const dedupedHistory = useMemo(() => {
    const sorted = history
      .filter((h) =>
        h.type !== "live" &&
        h.durationMs > 0 &&
        h.positionMs >= 5000 &&
        h.positionMs / h.durationMs < 0.95,
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const seenSeriesIds = new Set<string>();
    return sorted.filter((item) => {
      if (item.type !== "episode") return true;
      const match = item.contentId.match(/^ep-(.+?)-s\d+-e\d+$/);
      if (!match) return true;
      const seriesKey = match[1];
      if (seenSeriesIds.has(seriesKey)) return false;
      seenSeriesIds.add(seriesKey);
      return true;
    });
  }, [history]);

  const recentMovies = useMemo(() => movies.slice(0, 5), [movies]);
  const popularSeries = useMemo(() => seriesList.slice(0, 4), [seriesList]);
  const recentLiveChannels = useMemo(() => {
    const byId = new Map(channels.map((channel) => [channel.id, channel]));
    const seen = new Set<string>();
    const result = [] as typeof channels;

    history
      .filter((item) => item.type === "live")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .forEach((item) => {
        if (seen.has(item.contentId)) return;
        const channel = byId.get(item.contentId);
        if (!channel) return;
        seen.add(item.contentId);
        result.push(channel);
      });

    return result.slice(0, 5);
  }, [channels, history]);
  // First access has no live history, so preserve the server's original order.
  const featuredChannels = recentLiveChannels.length > 0 ? recentLiveChannels : channels.slice(0, 5);
  const liveSubtitle = recentLiveChannels.length > 0
    ? "Últimos canais assistidos"
    : "Programação ao vivo agora";
  // The Home row remains compact, but its visible cards are hydrated from a
  // larger queue started immediately after the catalogue is available.
  useEpgPreload(channels, EPG_HOME_PRELOAD_LIMIT);
  const showEmpty = !isSyncing && channels.length === 0 && movies.length === 0;

  const favoriteMovies = useMemo(
    () => movies.filter((m) => favoriteMovieIds.includes(m.id)).slice(0, 6),
    [movies, favoriteMovieIds],
  );
  const favoriteSeries = useMemo(
    () => seriesList.filter((s) => favoriteSeriesIds.includes(s.id)).slice(0, 6),
    [seriesList, favoriteSeriesIds],
  );
  const hasFavorites = favoriteMovies.length > 0 || favoriteSeries.length > 0;

  return (
    <View style={styles.screen} testID="home-screen">
      <CatalogBackground />
      <ParentalGate visible={pendingHistoryItem !== null} onAuthorized={openAuthorizedHistory} onClose={() => setPendingHistoryItem(null)} />
      <View style={styles.ambientBlue} />
      <View style={styles.ambientRed} />

      {isSyncing ? (
        <View style={styles.syncBanner}>
          <ActivityIndicator size="small" color={Colors.blueBright} />
          <AppText style={styles.syncText}>{syncLabel}</AppText>
        </View>
      ) : null}

      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, tvMode && styles.tvContent]}>
        {/* Top bar */}
        <View style={[styles.topBar, tvMode && styles.tvTopBar]}>
          {!tvMode ? (
            <View style={styles.brandBlock}>
              <AppText style={styles.eyebrow}>SUA CENTRAL DE ENTRETENIMENTO</AppText>
              <BrandLogo variant="logo" accessibilityLabel="ELVANOQ" style={styles.brandLogo} />
            </View>
          ) : <View />}
          <View style={styles.topActions}>
            <IconButton icon="search" label="Buscar conteúdo" onPress={handleSearch} />
          </View>
        </View>

        {hero ? <HeroBanner hero={hero} height={heroHeight} tvMode={tvMode} onPlay={handleHeroPlay} onDetails={handleHeroDetails} /> : null}

        {dedupedHistory.length > 0 ? (
          <View style={[styles.sectionBlock, tvMode && styles.tvSectionBlock]}>
            <SectionHeader title="Continuar Assistindo" subtitle="Retome de onde parou" onPress={handleContinueWatchingAll} />
            <HorizontalScroller>
              {dedupedHistory.slice(0, 8).map((item) => (
                <TVFocusable key={item.contentId} accessibilityRole="button" accessibilityLabel={`Continuar ${item.title}`} onPress={() => handleHistory(item)} style={styles.continueCard}>
                  <View style={styles.continueImage}>
                    <Image source={{ uri: item.thumbnail }} contentFit="cover" style={StyleSheet.absoluteFill} />
                    <View style={styles.continueShade} />
                    <View style={styles.continuePlay}><Ionicons name="play" size={15} color={Colors.white} /></View>
                  </View>
                  <AppText numberOfLines={1} style={styles.continueTitle}>{item.title}</AppText>
                  <AppText numberOfLines={1} style={styles.continueSubtitle}>{item.subtitle}</AppText>
                  <View style={styles.continueTrack}>
                    <View style={[styles.continueFill, { width: `${Math.min(100, Math.max(0, Math.round((item.positionMs / item.durationMs) * 100)))}%` }]} />
                  </View>
                </TVFocusable>
              ))}
            </HorizontalScroller>
          </View>
        ) : null}

        {hasFavorites ? (
          <View style={[styles.sectionBlock, tvMode && styles.tvSectionBlock]}>
            <SectionHeader
              title="Assistir Mais Tarde"
              subtitle="Seus favoritos salvos"
              onPress={handleWatchLaterAll}
            />
            <HorizontalScroller>
              {favoriteMovies.map((movie) => (
                <PosterCard
                  key={movie.id}
                  title={movie.title}
                  image={movie.poster}
                  meta={`${yearMeta(movie.year)} · ${movie.genre}`}
                  rating={movie.rating}
                  quality={movie.quality}
                  width={posterWidth}
                  onPress={() => handleContent(movie.id)}
                />
              ))}
              {favoriteSeries.map((item) => (
                <PosterCard
                  key={item.id}
                  title={item.title}
                  image={item.poster}
                  meta={`${yearMeta(item.year)} · ${seasonsMeta(item.seasonsCount)}`}
                  rating={item.rating}
                  width={posterWidth}
                  onPress={() => handleContent(item.id)}
                />
              ))}
            </HorizontalScroller>
          </View>
        ) : null}

        {featuredChannels.length > 0 ? (
          <View style={[styles.sectionBlock, tvMode && styles.tvSectionBlock]}>
            <SectionHeader title="Canais ao Vivo" subtitle={liveSubtitle} onPress={handleOpenLive} />
            <HorizontalScroller>
              {featuredChannels.map((channel) => (
                <TVFocusable key={channel.id} accessibilityRole="button" accessibilityLabel={`Assistir ${channel.name}`} onPress={() => handleLive(channel.id)} style={styles.channelCard}>
                  <ChannelLogo image={channel.logo} name={channel.name} size={60} />
                  <AppText numberOfLines={1} style={styles.channelName}>{channel.name}</AppText>
                  <AppText numberOfLines={1} style={styles.channelProgram}>{channel.currentEpg.title}</AppText>
                  <View style={styles.channelProgress}>
                    <View style={[styles.channelProgressFill, { width: `${channel.currentEpg.progress}%` }]} />
                  </View>
                </TVFocusable>
              ))}
            </HorizontalScroller>
          </View>
        ) : null}

        {recentMovies.length > 0 ? (
          <View style={[styles.sectionBlock, tvMode && styles.tvSectionBlock]}>
            <SectionHeader title="Filmes adicionados recentemente" onPress={handleOpenMovies} />
            <HorizontalScroller>
              {recentMovies.map((movie) => (
                <PosterCard key={movie.id} title={movie.title} image={movie.poster} meta={`${yearMeta(movie.year)} · ${movie.genre}`} rating={movie.rating} quality={movie.quality} width={posterWidth} onPress={() => handleContent(movie.id)} />
              ))}
            </HorizontalScroller>
          </View>
        ) : null}

        {popularSeries.length > 0 ? (
          <View style={[styles.sectionBlock, tvMode && styles.tvSectionBlock]}>
            <SectionHeader title="Séries em alta" onPress={handleOpenSeries} />
            <HorizontalScroller>
              {popularSeries.map((item) => (
                <PosterCard key={item.id} title={item.title} image={item.poster} meta={`${yearMeta(item.year)} · ${seasonsMeta(item.seasonsCount)}`} rating={item.rating} width={posterWidth} onPress={() => handleContent(item.id)} />
              ))}
            </HorizontalScroller>
          </View>
        ) : null}

        {showEmpty ? <EmptyHomeState onSync={refresh} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden", backgroundColor: Colors.background },
  content: { gap: 24, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 38 },
  // TV uses a cinematic, content-led canvas: a quiet top strip, full-width
  // hero and rows that begin close to its lower edge instead of card stacks.
  tvContent: { gap: 0, paddingHorizontal: 32, paddingTop: 0, paddingBottom: 54 },
  syncBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "rgba(59,130,246,0.1)", borderBottomWidth: 1, borderBottomColor: "rgba(59,130,246,0.2)" },
  syncText: { fontSize: 12, color: Colors.blueBright, flex: 1 },
  ambientBlue: { position: "absolute", top: -130, right: -110, width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(36, 99, 235, 0.11)" },
  ambientRed: { position: "absolute", top: 400, left: -180, width: 330, height: 330, borderRadius: 165, backgroundColor: "rgba(229, 9, 20, 0.05)" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  tvTopBar: { minHeight: 58, marginHorizontal: 2, zIndex: 2 },
  brandBlock: { gap: 3 },
  eyebrow: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 1.5, color: Colors.blueBright },
  brandLogo: { width: 128, height: 48 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 9 },
  // The phone version keeps the same cinematic hierarchy as TV, while using a
  // shorter card so the catalogue remains immediately reachable by touch.
  heroWrap: { height: 340, overflow: "hidden", borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: Colors.backgroundRaised, ...Shadows.card },
  // TV hero follows the editorial Apple TV pattern: poster artwork leads,
  // copy is confined to a quiet left safe area, and the focus ring belongs to
  // the actionable controls rather than a decorative blue frame.
  tvHeroWrap: { marginHorizontal: -32, borderWidth: 0, borderRadius: 0, backgroundColor: "#111722" },
  heroSideGradient: { opacity: 0.18 },
  heroEdge: { ...StyleSheet.absoluteFill, borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  heroContent: { position: "absolute", right: 19, bottom: 18, left: 19, gap: 8 },
  tvHeroContent: { right: undefined, bottom: 46, left: 64, width: "38%", gap: 9 },
  heroTag: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: "rgba(34,211,238,0.30)", backgroundColor: "rgba(7,18,35,0.56)" },
  tvHeroTag: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "rgba(7,18,35,0.62)" },
  heroTagText: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 0.8, color: Colors.blueBright },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 24, lineHeight: 29, letterSpacing: -0.65, color: Colors.text },
  tvHeroTitle: { fontSize: 30, lineHeight: 35, letterSpacing: -0.8 },
  heroDescription: { maxWidth: 470, fontSize: 12, lineHeight: 17, color: "rgba(248, 250, 252, 0.82)" },
  tvHeroDescription: { maxWidth: 460, fontSize: 12, lineHeight: 18, color: "rgba(248,250,252,0.86)" },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroMetaText: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.muted },
  tvHeroMetaText: { fontSize: 11, color: "rgba(248,250,252,0.82)" },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.subtle },
  heroRating: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.text },
  tvHeroRating: { fontSize: 11 },
  heroActions: { flexDirection: "row", gap: 8, marginTop: 3 },
  tvHeroActions: { gap: 10, marginTop: 7 },
  primaryButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 15, borderRadius: 10, backgroundColor: Colors.white },
  tvPrimaryButton: { minHeight: 40, paddingHorizontal: 17, borderRadius: 7, backgroundColor: Colors.white },
  whiteActionFocused: { backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.blueBright, opacity: 1, transform: [{ scale: 1.025 }] },
  primaryButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.background },
  tvPrimaryButtonText: { fontSize: 12, color: Colors.background },
  // Secondary actions keep the same rounded geometry as the primary CTA,
  // but use a restrained glass treatment so the play action remains dominant.
  secondaryButton: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 13, borderRadius: 9, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(13,20,31,0.66)" },
  tvSecondaryButton: { minHeight: 40, paddingHorizontal: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", borderRadius: 7, backgroundColor: "rgba(13,20,31,0.68)" },
  secondaryButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  tvSecondaryButtonText: { fontSize: 12 },
  sectionBlock: { gap: 0 },
  tvSectionBlock: { marginTop: 18 },
  continueCard: { width: 204, padding: 9, borderRadius: Radii.medium, borderWidth: 1, borderColor: "rgba(173,216,255,0.22)", backgroundColor: "rgba(20,31,50,0.68)", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  continueImage: { height: 92, overflow: "hidden", borderRadius: 11, backgroundColor: Colors.backgroundRaised },
  continueShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(7,9,14,0.24)" },
  continuePlay: { position: "absolute", right: 8, bottom: 8, width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: Colors.blue },
  continueTitle: { marginTop: 8, fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  continueSubtitle: { marginTop: 3, fontSize: 11, color: Colors.muted },
  continueTrack: { height: 3, overflow: "hidden", marginTop: 8, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)" },
  continueFill: { height: "100%", borderRadius: 2, backgroundColor: Colors.blueBright },
  channelCard: { width: 122, alignItems: "center", padding: 12, borderRadius: Radii.medium, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft, gap: 5 },
  channelName: { maxWidth: 100, fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  channelProgram: { maxWidth: 100, fontSize: 10, color: Colors.muted },
  channelProgress: { width: "100%", height: 3, overflow: "hidden", marginTop: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.16)" },
  channelProgressFill: { height: "100%", backgroundColor: Colors.green },
  emptyHome: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 60, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  emptyHomeTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: Colors.text },
  emptyHomeBody: { fontSize: 13, color: Colors.muted, textAlign: "center", maxWidth: 300 },
  syncBtn: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 4, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.white },
  syncBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.background },
});
