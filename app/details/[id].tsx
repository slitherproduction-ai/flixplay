import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { episodes, getContentById, movies, series } from "@/data/demo";
import { Colors, Radii, Shadows, Type } from "@/constants/theme";
import { AppText, Chip, EmptyState, IconButton, ScreenState, SectionHeader } from "@/components/ui";
import { useScreenLoad } from "@/hooks/useScreenLoad";
import { useAppStore } from "@/store/useAppStore";
import type { EpisodeItem, SeriesItem, VodMovie } from "@/store/types";

export default function DetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const { loading, error, retry } = useScreenLoad("os detalhes");
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const favoriteIds = useAppStore((state) => state.favoriteIds);
  const [season, setSeason] = useState(2);
  const content = getContentById(id);
  const movie = content.movie;
  const show = content.series;
  const isFavorite = favoriteIds.includes(id);
  const selectedEpisodes = useMemo(() => episodes.filter((episode) => episode.seriesId === show?.id && episode.seasonNumber === season), [season, show?.id]);
  const similar = useMemo(() => (show ? series.filter((item) => item.id !== show.id) : movies.filter((item) => item.id !== movie?.id)).slice(0, 3), [movie?.id, show]);
  const missingError = !movie && !show ? "Este conteúdo não está disponível no catálogo demo." : null;

  const handlePlay = useCallback((episodeId?: string) => {
    if (movie) {
      router.push({ pathname: "/player", params: { id: movie.id, title: movie.title, type: "movie", streamUrl: movie.streamUrl } });
      return;
    }
    const episode = selectedEpisodes.find((item) => item.id === episodeId) ?? selectedEpisodes[0];
    if (!show || !episode) return;
    router.push({ pathname: "/player", params: { id: episode.id, title: `${show.title} · T${episode.seasonNumber}:E${episode.episodeNumber}`, type: "episode", streamUrl: episode.streamUrl } });
  }, [movie, router, selectedEpisodes, show]);

  const handleFavorite = useCallback(() => {
    toggleFavorite(id);
  }, [id, toggleFavorite]);

  const handleTrailer = useCallback(() => {
    Alert.alert("Trailer", "O trailer será reproduzido no player demo.", [{ text: "Assistir", onPress: () => handlePlay() }, { text: "Agora não", style: "cancel" }]);
  }, [handlePlay]);

  const handleSimilar = useCallback((similarId: string) => {
    router.push(`/details/${similarId}`);
  }, [router]);

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
        {movie || show ? <DetailsContent movie={movie} show={show} similar={similar} season={season} selectedEpisodes={selectedEpisodes} isFavorite={isFavorite} onBack={router.back} onFavorite={handleFavorite} onPlay={handlePlay} onTrailer={handleTrailer} onSeasonChange={setSeason} onSimilar={handleSimilar} /> : null}
      </ScreenState>
    </View>
  );
}

function DetailsContent({ movie, show, similar, season, selectedEpisodes, isFavorite, onBack, onFavorite, onPlay, onTrailer, onSeasonChange, onSimilar }: {
  movie?: VodMovie;
  show?: SeriesItem;
  similar: (VodMovie | SeriesItem)[];
  season: number;
  selectedEpisodes: EpisodeItem[];
  isFavorite: boolean;
  onBack: () => void;
  onFavorite: () => void;
  onPlay: (episodeId?: string) => void;
  onTrailer: () => void;
  onSeasonChange: (season: number) => void;
  onSimilar: (id: string) => void;
}) {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <ContentSummary movie={movie} show={show} isFavorite={isFavorite} onBack={onBack} onFavorite={onFavorite} />
      <ContentActions isMovie={Boolean(movie)} isFavorite={isFavorite} onPlay={onPlay} onTrailer={onTrailer} onFavorite={onFavorite} />
      {show ? <EpisodesSection show={show} season={season} selectedEpisodes={selectedEpisodes} onPlay={onPlay} onSeasonChange={onSeasonChange} /> : null}
      <SimilarSection similar={similar} onSimilar={onSimilar} />
    </ScrollView>
  );
}

function ContentSummary({ movie, show, isFavorite, onBack, onFavorite }: { movie?: VodMovie; show?: SeriesItem; isFavorite: boolean; onBack: () => void; onFavorite: () => void }) {
  const title = movie?.title ?? show?.title ?? "Conteúdo";
  const poster = movie?.poster ?? show?.poster;
  const backdrop = movie?.backdrop ?? show?.backdrop;
  const rating = movie?.rating ?? show?.rating ?? 0;

  return (
    <>
      <View style={styles.backdrop}><Image source={{ uri: backdrop }} contentFit="cover" style={StyleSheet.absoluteFill} /><View style={styles.backdropShade} /><View style={styles.topControls}><IconButton icon="chevron-back" label="Voltar" onPress={onBack} /><View style={styles.topPill}><Ionicons name="information-circle-outline" size={15} color={Colors.muted} /><AppText style={styles.topPillText}>DETALHES</AppText></View><IconButton icon={isFavorite ? "heart" : "heart-outline"} label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} active={isFavorite} onPress={onFavorite} /></View></View>
      <View style={styles.titleBlock}><View style={styles.poster}><Image source={{ uri: poster }} contentFit="cover" style={StyleSheet.absoluteFill} /><View style={styles.posterBadge}><Ionicons name="star" size={10} color={Colors.amber} /><AppText style={styles.posterRating}>{rating.toFixed(1)}</AppText></View></View><View style={styles.titleCopy}><AppText style={Type.title}>{title}</AppText><View style={styles.metaRow}><AppText style={styles.meta}>{movie?.year ?? show?.year}</AppText><View style={styles.metaDot} /><AppText style={styles.meta}>{movie?.genre ?? show?.genre}</AppText>{movie ? <><View style={styles.metaDot} /><AppText style={styles.meta}>{movie.duration}</AppText></> : null}</View><AppText numberOfLines={3} style={styles.plot}>{movie?.plot ?? show?.plot}</AppText></View></View>
    </>
  );
}

function ContentActions({ isMovie, isFavorite, onPlay, onTrailer, onFavorite }: { isMovie: boolean; isFavorite: boolean; onPlay: () => void; onTrailer: () => void; onFavorite: () => void }) {
  return <View style={styles.actions}><Pressable accessibilityRole="button" onPress={onPlay} style={styles.primaryButton}><Ionicons name="play" size={16} color={Colors.white} /><AppText style={styles.primaryText}>{isMovie ? "Assistir agora" : "Continuar T2:E3"}</AppText></Pressable><Pressable accessibilityRole="button" onPress={onTrailer} style={styles.actionButton}><Ionicons name="play-circle-outline" size={17} color={Colors.text} /><AppText style={styles.actionText}>Trailer</AppText></Pressable><Pressable accessibilityRole="button" onPress={onFavorite} style={styles.actionButton}><Ionicons name={isFavorite ? "heart" : "heart-outline"} size={17} color={isFavorite ? Colors.red : Colors.text} /><AppText style={styles.actionText}>Favoritos</AppText></Pressable></View>;
}

function EpisodesSection({ show, season, selectedEpisodes, onPlay, onSeasonChange }: { show: SeriesItem; season: number; selectedEpisodes: EpisodeItem[]; onPlay: (episodeId?: string) => void; onSeasonChange: (season: number) => void }) {
  return <View style={styles.episodesSection}><SectionHeader title="Episódios" subtitle={`${show.seasonsCount} temporadas disponíveis`} /><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonScroller} contentContainerStyle={styles.seasonContent}>{Array.from({ length: show.seasonsCount }, (_, index) => index + 1).map((item) => <Chip key={item} label={`Temporada ${item}`} selected={season === item} onPress={() => onSeasonChange(item)} />)}</ScrollView><View style={styles.episodeList}>{selectedEpisodes.length ? selectedEpisodes.map((episode) => <EpisodeCard key={episode.id} episode={episode} onPlay={onPlay} />) : <EmptyState title="Temporada sem episódios" body="Este conteúdo ainda não possui episódios demo cadastrados." />}</View></View>;
}

function EpisodeCard({ episode, onPlay }: { episode: EpisodeItem; onPlay: (episodeId?: string) => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Reproduzir ${episode.title}`} onPress={() => onPlay(episode.id)} style={({ pressed }) => [styles.episodeCard, pressed && styles.pressed]}><View style={styles.episodeThumb}><Image source={{ uri: episode.thumbnail }} contentFit="cover" style={StyleSheet.absoluteFill} /><View style={styles.thumbShade} /><View style={styles.episodePlay}><Ionicons name="play" size={14} color={Colors.white} /></View></View><View style={styles.episodeCopy}><AppText numberOfLines={1} style={styles.episodeTitle}>T{episode.seasonNumber}:E{episode.episodeNumber} · {episode.title}</AppText><AppText numberOfLines={2} style={styles.episodePlot}>{episode.plot}</AppText><View style={styles.episodeBottom}><AppText style={styles.episodeDuration}>{episode.duration}</AppText>{episode.resumePositionMs ? <View style={styles.episodeProgress}><View style={[styles.episodeProgressFill, { width: "56%" }]} /></View> : <AppText style={styles.newEpisode}>NOVO</AppText>}</View></View></Pressable>;
}

function SimilarSection({ similar, onSimilar }: { similar: (VodMovie | SeriesItem)[]; onSimilar: (id: string) => void }) {
  return <View style={styles.similarSection}><SectionHeader title="Você também pode gostar" /><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.similarScroller} contentContainerStyle={styles.similarContent}>{similar.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => onSimilar(item.id)} style={styles.similarCard}><Image source={{ uri: item.poster }} contentFit="cover" style={styles.similarImage} /><AppText numberOfLines={1} style={styles.similarTitle}>{item.title}</AppText><View style={styles.similarMeta}><Ionicons name="star" size={10} color={Colors.amber} /><AppText style={styles.similarMetaText}>{item.year} · {item.rating.toFixed(1)}</AppText></View></Pressable>)}</ScrollView></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { gap: 18, paddingBottom: 38 },
  backdrop: { height: 255, overflow: "hidden", backgroundColor: Colors.backgroundRaised },
  backdropShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(7,9,14,0.48)" },
  topControls: { position: "absolute", top: 18, right: 20, left: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: Radii.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: "rgba(7,9,14,0.45)" },
  topPillText: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 0.7, color: Colors.muted },
  titleBlock: { flexDirection: "row", gap: 14, paddingHorizontal: 20, marginTop: -48 },
  poster: { width: 104, height: 148, overflow: "hidden", borderRadius: 15, borderWidth: 2, borderColor: Colors.borderStrong, backgroundColor: Colors.backgroundRaised, ...Shadows.card },
  posterBadge: { position: "absolute", right: 7, bottom: 7, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(7,9,14,0.8)" },
  posterRating: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.text },
  titleCopy: { flex: 1, justifyContent: "flex-end", gap: 8, paddingBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
  meta: { fontSize: 11, color: Colors.muted },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.subtle },
  plot: { fontSize: 12, lineHeight: 18, color: Colors.muted },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 20 },
  primaryButton: { minHeight: 43, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 12, borderRadius: Radii.pill, backgroundColor: Colors.blue },
  primaryText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.white },
  actionButton: { minHeight: 43, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 12, borderRadius: Radii.pill, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.glassSoft },
  actionText: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.text },
  episodesSection: { gap: 12, paddingHorizontal: 20 },
  seasonScroller: { flexGrow: 0, marginHorizontal: -20 },
  seasonContent: { gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
  episodeList: { gap: 9 },
  episodeCard: { minHeight: 124, flexDirection: "row", gap: 11, padding: 9, borderRadius: Radii.medium, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  pressed: { opacity: 0.74 },
  episodeThumb: { width: 118, height: 104, overflow: "hidden", alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: Colors.backgroundRaised },
  thumbShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(7,9,14,0.3)" },
  episodePlay: { width: 31, height: 31, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "rgba(59,130,246,0.9)" },
  episodeCopy: { flex: 1, gap: 6 },
  episodeTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  episodePlot: { fontSize: 10, lineHeight: 15, color: Colors.muted },
  episodeBottom: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: "auto" },
  episodeDuration: { fontSize: 10, color: Colors.subtle },
  episodeProgress: { flex: 1, height: 3, overflow: "hidden", borderRadius: 2, backgroundColor: "rgba(255,255,255,0.17)" },
  episodeProgressFill: { height: "100%", backgroundColor: Colors.blueBright },
  newEpisode: { fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.5, color: Colors.green },
  similarSection: { gap: 0, paddingLeft: 20 },
  similarScroller: { flexGrow: 0, marginHorizontal: -20 },
  similarContent: { gap: 12, paddingHorizontal: 20 },
  similarCard: { width: 122, gap: 6 },
  similarImage: { width: 122, height: 160, borderRadius: 13, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundRaised },
  similarTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  similarMeta: { flexDirection: "row", alignItems: "center", gap: 3 },
  similarMetaText: { fontSize: 10, color: Colors.subtle },
});
