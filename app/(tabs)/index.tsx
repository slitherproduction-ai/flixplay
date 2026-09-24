import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText, ChannelLogo, HorizontalScroller, IconButton, PosterCard, SectionHeader } from "@/components/ui";
import { useEpgPreload } from "@/hooks/useEpgPreload";
import { useSyncStatus } from "@/hooks/useXtreamSync";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useAppStore } from "@/store/useAppStore";
import type { PlayHistory, VodMovie } from "@/store/types";

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

function computePosterWidth(tvMode: boolean, width: number): number {
  if (!tvMode && width <= 700) return 142;
  const visibleCards = width >= 1500 ? 7 : width >= 1100 ? 6 : 5;
  const horizontalPadding = tvMode ? 92 : 40;
  const gap = tvMode ? 16 : 12;
  return Math.floor((width - horizontalPadding - gap * (visibleCards - 1)) / visibleCards);
}

function seasonsMeta(count: number): string {
  return `${count} temporada${count !== 1 ? "s" : ""}`;
}

interface HeroBannerProps {
  hero: VodMovie;
  height: number;
  onPlay: () => void;
  onDetails: () => void;
}

function HeroBanner({ hero, height, onPlay, onDetails }: HeroBannerProps) {
  return (
    <View style={[styles.heroWrap, { height }]}>
      <Image source={{ uri: hero.backdrop }} contentFit="cover" transition={300} style={StyleSheet.absoluteFill} />
      <View style={styles.heroTint} />
      <View style={styles.heroGlow} />
      <View style={styles.heroContent}>
        <View style={styles.heroTag}>
          <Ionicons name="sparkles" size={12} color={Colors.blueBright} />
          <AppText style={styles.heroTagText}>DESTAQUE DA SEMANA</AppText>
        </View>
        <AppText style={styles.heroTitle}>{hero.title}</AppText>
        <AppText numberOfLines={2} style={styles.heroDescription}>{hero.plot}</AppText>
        <View style={styles.heroMeta}>
          <AppText style={styles.heroMetaText}>{hero.year}</AppText>
          <View style={styles.metaDot} />
          <AppText style={styles.heroMetaText}>{hero.duration}</AppText>
          <View style={styles.metaDot} />
          <AppText style={styles.heroRating}>
            <Ionicons name="star" size={11} color={Colors.amber} /> {hero.rating.toFixed(1)}
          </AppText>
        </View>
        <View style={styles.heroActions}>
          <TVFocusable accessibilityRole="button" hasTVPreferredFocus onPress={onPlay} style={styles.primaryButton}>
            <Ionicons name="play" size={16} color={Colors.white} />
            <AppText style={styles.primaryButtonText}>Assistir agora</AppText>
          </TVFocusable>
          <TVFocusable accessibilityRole="button" onPress={onDetails} style={styles.secondaryButton}>
            <AppText style={styles.secondaryButtonText}>Ver detalhes</AppText>
            <Ionicons name="arrow-forward" size={15} color={Colors.text} />
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
      <TVFocusable onPress={onSync} style={styles.syncBtn} accessibilityLabel="Sincronizar conteúdo">
        <Ionicons name="refresh" size={15} color={Colors.white} />
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
  const channels = useAppStore((state) => state.contentCache.liveChannels);
  const movies = useAppStore((state) => state.contentCache.vodMovies);
  const seriesList = useAppStore((state) => state.contentCache.seriesList);
  const { isSyncing, syncProgress, refresh } = useSyncStatus();

  const posterWidth = computePosterWidth(tvMode, width);
  const heroHeight = tvMode
    ? Math.round(Math.min(350, Math.max(250, height * 0.4)))
    : 340;
  const syncLabel = syncProgress ?? "Sincronizando conteúdo...";

  const hero = movies[0] ?? null;

  const handleSearch = useCallback(() => { router.push("/movies"); }, [router]);
  const handleContinueWatchingAll = useCallback(() => { router.push("/continue-watching"); }, [router]);
  const handleHeroDetails = useCallback(() => {
    if (hero) router.push(`/details/${hero.id}`);
  }, [hero, router]);
  const handleHeroPlay = useCallback(() => {
    if (hero) router.push({ pathname: "/player", params: { id: hero.id, title: hero.title, type: "movie", streamUrl: hero.streamUrl } });
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
  }, [router]);

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
  const featuredChannels = useMemo(() => channels.slice(0, 5), [channels]);
  useEpgPreload(featuredChannels, 5);
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
        <View style={styles.topBar}>
          <View style={styles.brandBlock}>
            <AppText style={styles.eyebrow}>SUA CENTRAL DE ENTRETENIMENTO</AppText>
            <AppText style={styles.brand}>Flix<AppText style={styles.brandAccent}>Play</AppText></AppText>
          </View>
          <View style={styles.topActions}>
            <IconButton icon="search" label="Buscar conteúdo" onPress={handleSearch} />
            <TVFocusable accessibilityRole="button" accessibilityLabel="Abrir perfil" onPress={handleSearch} style={styles.avatarButton}>
              <AppText style={styles.avatarText}>FP</AppText>
              <View style={styles.onlineDot} />
            </TVFocusable>
          </View>
        </View>

        {hero ? <HeroBanner hero={hero} height={heroHeight} onPlay={handleHeroPlay} onDetails={handleHeroDetails} /> : null}

        {dedupedHistory.length > 0 ? (
          <View style={styles.sectionBlock}>
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
          <View style={styles.sectionBlock}>
            <SectionHeader
              title="Assistir Mais Tarde"
              subtitle="Seus favoritos salvos"
              onPress={handleOpenMovies}
            />
            <HorizontalScroller>
              {favoriteMovies.map((movie) => (
                <PosterCard
                  key={movie.id}
                  title={movie.title}
                  image={movie.poster}
                  meta={`${movie.year} · ${movie.genre}`}
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
                  meta={`${item.year} · ${seasonsMeta(item.seasonsCount)}`}
                  rating={item.rating}
                  width={posterWidth}
                  onPress={() => handleContent(item.id)}
                />
              ))}
            </HorizontalScroller>
          </View>
        ) : null}

        {featuredChannels.length > 0 ? (
          <View style={styles.sectionBlock}>
            <SectionHeader title="Canais ao Vivo" subtitle="Programação ao vivo agora" onPress={handleOpenLive} />
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
          <View style={styles.sectionBlock}>
            <SectionHeader title="Filmes adicionados recentemente" onPress={handleOpenMovies} />
            <HorizontalScroller>
              {recentMovies.map((movie) => (
                <PosterCard key={movie.id} title={movie.title} image={movie.poster} meta={`${movie.year} · ${movie.genre}`} rating={movie.rating} quality={movie.quality} width={posterWidth} onPress={() => handleContent(movie.id)} />
              ))}
            </HorizontalScroller>
          </View>
        ) : null}

        {popularSeries.length > 0 ? (
          <View style={styles.sectionBlock}>
            <SectionHeader title="Séries em alta" onPress={handleOpenSeries} />
            <HorizontalScroller>
              {popularSeries.map((item) => (
                <PosterCard key={item.id} title={item.title} image={item.poster} meta={`${item.year} · ${seasonsMeta(item.seasonsCount)}`} rating={item.rating} width={posterWidth} onPress={() => handleContent(item.id)} />
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
  tvContent: { gap: 30, paddingHorizontal: 46, paddingTop: 30, paddingBottom: 54 },
  syncBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "rgba(59,130,246,0.1)", borderBottomWidth: 1, borderBottomColor: "rgba(59,130,246,0.2)" },
  syncText: { fontSize: 12, color: Colors.blueBright, flex: 1 },
  ambientBlue: { position: "absolute", top: -130, right: -110, width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(36, 99, 235, 0.11)" },
  ambientRed: { position: "absolute", top: 400, left: -180, width: 330, height: 330, borderRadius: 165, backgroundColor: "rgba(229, 9, 20, 0.05)" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  brandBlock: { gap: 3 },
  eyebrow: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 1.5, color: Colors.blueBright },
  brand: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -1.1, color: Colors.text },
  brandAccent: { color: Colors.blueBright },
  topActions: { flexDirection: "row", alignItems: "center", gap: 9 },
  avatarButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: "#263653" },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 12, color: Colors.text },
  onlineDot: { position: "absolute", right: 1, bottom: 1, width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: Colors.background, backgroundColor: Colors.green },
  heroWrap: { height: 340, overflow: "hidden", borderRadius: Radii.large, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.backgroundRaised, ...Shadows.card },
  heroTint: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(5, 7, 12, 0.36)" },
  heroGlow: { position: "absolute", right: -40, bottom: -100, left: -40, height: 250, backgroundColor: "rgba(5, 7, 12, 0.92)" },
  heroContent: { position: "absolute", right: 20, bottom: 20, left: 20, gap: 9 },
  heroTag: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radii.pill, backgroundColor: "rgba(59, 130, 246, 0.18)" },
  heroTagText: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 0.8, color: Colors.blueBright },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 29, letterSpacing: -0.8, color: Colors.text },
  heroDescription: { maxWidth: 470, fontSize: 12, lineHeight: 18, color: "rgba(248, 250, 252, 0.72)" },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroMetaText: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.muted },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.subtle },
  heroRating: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.text },
  heroActions: { flexDirection: "row", gap: 9, marginTop: 3 },
  primaryButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, borderRadius: Radii.pill, backgroundColor: Colors.blue },
  primaryButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.white },
  secondaryButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 15, borderRadius: Radii.pill, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: "rgba(255,255,255,0.1)" },
  secondaryButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  sectionBlock: { gap: 0 },
  continueCard: { width: 204, padding: 9, borderRadius: Radii.medium, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
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
  syncBtn: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 4, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.blue },
  syncBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.white },
});
