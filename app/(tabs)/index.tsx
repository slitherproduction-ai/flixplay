import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { channels, movies, series } from "@/data/demo";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { AppText, ChannelLogo, GlassCard, HorizontalScroller, IconButton, PosterCard, ScreenState, SectionHeader } from "@/components/ui";
import { useScreenLoad } from "@/hooks/useScreenLoad";
import { useAppStore } from "@/store/useAppStore";

const hero = movies[0];

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { loading, error, retry } = useScreenLoad("a página inicial");
  const servers = useAppStore((state) => state.servers);
  const activeServerId = useAppStore((state) => state.activeServerId);
  const history = useAppStore((state) => state.history);
  const activeServer = servers.find((server) => server.id === activeServerId) ?? servers[0];
  const posterWidth = width > 700 ? 166 : 142;

  const handleSearch = useCallback(() => {
    router.push("/movies");
  }, [router]);

  const handleHeroDetails = useCallback(() => {
    router.push(`/details/${hero.id}`);
  }, [router]);

  const handleHeroPlay = useCallback(() => {
    router.push({ pathname: "/player", params: { id: hero.id, title: hero.title, type: "movie", streamUrl: hero.streamUrl } });
  }, [router]);

  const handleLive = useCallback((channelId: string) => {
    const channel = channels.find((item) => item.id === channelId);
    if (!channel) return;
    router.push({ pathname: "/player", params: { id: channel.id, title: channel.name, type: "live", streamUrl: channel.streamUrl } });
  }, [router]);

  const handleContent = useCallback((id: string) => {
    router.push(`/details/${id}`);
  }, [router]);

  const handleHistory = useCallback((contentId: string, type: string) => {
    if (type === "live") {
      handleLive(contentId);
      return;
    }
    router.push(`/details/${contentId}`);
  }, [handleLive, router]);

  const recentMovies = useMemo(() => movies.slice(0, 5), []);
  const popularSeries = useMemo(() => series.slice(0, 4), []);

  return (
    <View style={styles.screen} testID="home-screen">
      <View style={styles.ambientBlue} />
      <View style={styles.ambientRed} />
      <ScreenState loading={loading} error={error} retry={retry}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.topBar}>
            <View style={styles.brandBlock}>
              <AppText style={styles.eyebrow}>SUA CENTRAL DE ENTRETENIMENTO</AppText>
              <AppText style={styles.brand}>Flix<AppText style={styles.brandAccent}>Play</AppText></AppText>
            </View>
            <View style={styles.topActions}>
              <IconButton icon="search" label="Buscar conteúdo" onPress={handleSearch} />
              <Pressable accessibilityRole="button" accessibilityLabel="Abrir perfil Marina" onPress={handleSearch} style={styles.avatarButton}>
                <AppText style={styles.avatarText}>MC</AppText>
                <View style={styles.onlineDot} />
              </Pressable>
            </View>
          </View>

          <GlassCard style={styles.serverCard} intensity={30}>
            <View style={styles.serverIcon}>
              <Ionicons name="shield-checkmark" size={18} color={Colors.green} />
            </View>
            <View style={styles.serverCopy}>
              <AppText style={styles.serverLabel}>SERVIDOR ATIVO</AppText>
              <AppText style={styles.serverName}>{activeServer?.name ?? "Modo demonstração"}</AppText>
            </View>
            <View style={styles.serverDivider} />
            <View style={styles.expiryCopy}>
              <AppText style={styles.serverLabel}>VALIDADE</AppText>
              <AppText style={styles.expiryDate}>{activeServer?.expiryDate ?? "Demo"}</AppText>
            </View>
            <Ionicons name="chevron-forward" size={17} color={Colors.subtle} />
          </GlassCard>

          <View style={styles.heroWrap}>
            <Image source={{ uri: hero.backdrop }} contentFit="cover" transition={300} style={StyleSheet.absoluteFill} />
            <View style={styles.heroTint} />
            <View style={styles.heroGlow} />
            <View style={styles.heroContent}>
              <View style={styles.heroTag}><Ionicons name="sparkles" size={12} color={Colors.blueBright} /><AppText style={styles.heroTagText}>DESTAQUE DA SEMANA</AppText></View>
              <AppText style={styles.heroTitle}>{hero.title}</AppText>
              <AppText numberOfLines={2} style={styles.heroDescription}>{hero.plot}</AppText>
              <View style={styles.heroMeta}><AppText style={styles.heroMetaText}>{hero.year}</AppText><View style={styles.metaDot} /><AppText style={styles.heroMetaText}>{hero.duration}</AppText><View style={styles.metaDot} /><AppText style={styles.heroRating}><Ionicons name="star" size={11} color={Colors.amber} /> {hero.rating.toFixed(1)}</AppText></View>
              <View style={styles.heroActions}>
                <Pressable accessibilityRole="button" onPress={handleHeroPlay} style={styles.primaryButton}>
                  <Ionicons name="play" size={16} color={Colors.white} />
                  <AppText style={styles.primaryButtonText}>Assistir agora</AppText>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={handleHeroDetails} style={styles.secondaryButton}>
                  <AppText style={styles.secondaryButtonText}>Ver detalhes</AppText>
                  <Ionicons name="arrow-forward" size={15} color={Colors.text} />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <SectionHeader title="Continuar Assistindo" subtitle="Retome de onde parou" onPress={handleSearch} />
            <HorizontalScroller>
              {history.map((item) => (
                <Pressable key={item.contentId} accessibilityRole="button" accessibilityLabel={`Continuar ${item.title}`} onPress={() => handleHistory(item.contentId, item.type)} style={styles.continueCard}>
                  <View style={styles.continueImage}>
                    <Image source={{ uri: item.thumbnail }} contentFit="cover" style={StyleSheet.absoluteFill} />
                    <View style={styles.continueShade} />
                    <View style={styles.continuePlay}><Ionicons name="play" size={15} color={Colors.white} /></View>
                  </View>
                  <AppText numberOfLines={1} style={styles.continueTitle}>{item.title}</AppText>
                  <AppText numberOfLines={1} style={styles.continueSubtitle}>{item.subtitle}</AppText>
                  <View style={styles.continueTrack}><View style={[styles.continueFill, { width: `${Math.round((item.positionMs / item.durationMs) * 100)}%` }]} /></View>
                </Pressable>
              ))}
            </HorizontalScroller>
          </View>

          <View style={styles.sectionBlock}>
            <SectionHeader title="Canais Favoritos" subtitle="Programação ao vivo agora" onPress={() => router.push("/live")} />
            <HorizontalScroller>
              {channels.slice(0, 5).map((channel) => (
                <Pressable key={channel.id} accessibilityRole="button" accessibilityLabel={`Assistir ${channel.name}`} onPress={() => handleLive(channel.id)} style={styles.channelCard}>
                  <ChannelLogo image={channel.logo} name={channel.name} size={60} />
                  <AppText numberOfLines={1} style={styles.channelName}>{channel.name}</AppText>
                  <AppText numberOfLines={1} style={styles.channelProgram}>{channel.currentEpg.title}</AppText>
                  <View style={styles.channelProgress}><View style={[styles.channelProgressFill, { width: `${channel.currentEpg.progress}%` }]} /></View>
                </Pressable>
              ))}
            </HorizontalScroller>
          </View>

          <View style={styles.sectionBlock}>
            <SectionHeader title="Filmes adicionados recentemente" onPress={() => router.push("/movies")} />
            <HorizontalScroller>
              {recentMovies.map((movie) => <PosterCard key={movie.id} title={movie.title} image={movie.poster} meta={`${movie.year} · ${movie.genre}`} rating={movie.rating} quality={movie.quality} width={posterWidth} onPress={() => handleContent(movie.id)} />)}
            </HorizontalScroller>
          </View>

          <View style={styles.sectionBlock}>
            <SectionHeader title="Séries em alta" onPress={() => router.push("/series")} />
            <HorizontalScroller>
              {popularSeries.map((item) => <PosterCard key={item.id} title={item.title} image={item.poster} meta={`${item.year} · ${item.seasonsCount} temporadas`} rating={item.rating} width={posterWidth} onPress={() => handleContent(item.id)} />)}
            </HorizontalScroller>
          </View>
        </ScrollView>
      </ScreenState>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden", backgroundColor: Colors.background },
  content: { gap: 24, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 38 },
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
  serverCard: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13 },
  serverIcon: { width: 35, height: 35, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "rgba(16, 185, 129, 0.13)" },
  serverCopy: { flex: 1, gap: 2 },
  serverLabel: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 0.8, color: Colors.subtle },
  serverName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  serverDivider: { width: 1, height: 31, backgroundColor: Colors.border },
  expiryCopy: { minWidth: 78, gap: 2 },
  expiryDate: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
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
});
