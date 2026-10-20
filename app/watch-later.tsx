import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { FlatList, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Radii } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useAppStore } from "@/store/useAppStore";
import type { SeriesItem, VodMovie } from "@/store/types";

type SavedItem = {
  id: string;
  kind: "movie" | "series";
  title: string;
  poster?: string;
  year: number;
  rating: number;
  detail: string;
};

function toSavedMovie(movie: VodMovie): SavedItem {
  return {
    id: movie.id,
    kind: "movie",
    title: movie.title,
    poster: movie.poster,
    year: movie.year,
    rating: movie.rating,
    detail: movie.genre || "Filme",
  };
}

function toSavedSeries(series: SeriesItem): SavedItem {
  return {
    id: series.id,
    kind: "series",
    title: series.title,
    poster: series.poster,
    year: series.year,
    rating: series.rating,
    detail: series.genre || "Série",
  };
}

export default function WatchLaterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tvMode = useTVMode();
  const { width } = useWindowDimensions();
  const { isTablet, isTabletLandscape, contentPadding } = useResponsiveLayout();
  const movies = useAppStore((state) => state.contentCache.vodMovies);
  const series = useAppStore((state) => state.contentCache.seriesList);
  const favoriteMovieIds = useAppStore((state) => state.favoriteMovieIds);
  const favoriteSeriesIds = useAppStore((state) => state.favoriteSeriesIds);
  const toggleFavoriteMovie = useAppStore((state) => state.toggleFavoriteMovie);
  const toggleFavoriteSeries = useAppStore((state) => state.toggleFavoriteSeries);

  const savedItems = useMemo(() => [
    ...movies.filter((item) => favoriteMovieIds.includes(item.id)).map(toSavedMovie),
    ...series.filter((item) => favoriteSeriesIds.includes(item.id)).map(toSavedSeries),
  ], [favoriteMovieIds, favoriteSeriesIds, movies, series]);

  const columns = tvMode ? (width >= 1500 ? 7 : 6) : isTabletLandscape ? 6 : isTablet ? 4 : width >= 700 ? 4 : 3;
  const horizontalPadding = tvMode ? 52 : isTablet ? contentPadding : 20;
  const gap = tvMode ? 18 : 12;
  const cardWidth = Math.floor((width - horizontalPadding * 2 - gap * (columns - 1)) / columns);

  const openItem = useCallback((item: SavedItem) => {
    router.push(`/details/${item.id}`);
  }, [router]);

  const removeItem = useCallback((item: SavedItem) => {
    if (item.kind === "movie") toggleFavoriteMovie(item.id);
    else toggleFavoriteSeries(item.id);
  }, [toggleFavoriteMovie, toggleFavoriteSeries]);

  const renderItem = useCallback(({ item }: { item: SavedItem }) => (
    <SavedCard item={item} width={cardWidth} onOpen={openItem} onRemove={removeItem} />
  ), [cardWidth, openItem, removeItem]);

  return (
    <View style={styles.screen}>
      <View style={styles.ambient} />
      <View style={[styles.header, { paddingTop: insets.top + (tvMode ? 30 : 16), paddingHorizontal: horizontalPadding }]}>
        <TVFocusable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.backButton} hasTVPreferredFocus>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TVFocusable>
        <View style={styles.headerCopy}>
          <AppText style={styles.kicker}>SUA LISTA</AppText>
          <AppText style={styles.title}>Assistir Mais Tarde</AppText>
          <AppText style={styles.subtitle}>{savedItems.length ? `${savedItems.length} título${savedItems.length !== 1 ? "s" : ""} salvo${savedItems.length !== 1 ? "s" : ""}` : "Seus títulos salvos aparecerão aqui"}</AppText>
        </View>
      </View>
      <FlatList
        key={`saved-${columns}`}
        data={savedItems}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        renderItem={renderItem}
        numColumns={columns}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={savedItems.length ? { gap } : undefined}
        contentContainerStyle={[styles.grid, { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 34, gap }]}
        ListEmptyComponent={<EmptySavedState />}
      />
    </View>
  );
}

function SavedCard({ item, width, onOpen, onRemove }: { item: SavedItem; width: number; onOpen: (item: SavedItem) => void; onRemove: (item: SavedItem) => void }) {
  return (
    <View style={[styles.card, { width }]}>
      <TVFocusable accessibilityRole="button" accessibilityLabel={`Abrir ${item.title}`} onPress={() => onOpen(item)} style={styles.cardMain}>
        <View style={[styles.poster, { height: Math.round(width * 1.46) }]}>
          {item.poster ? <Image source={{ uri: item.poster }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <View style={styles.posterFallback}><Ionicons name="film-outline" size={28} color={Colors.subtle} /></View>}
          <View style={styles.posterShade} />
          <View style={styles.typeBadge}><AppText style={styles.typeBadgeText}>{item.kind === "movie" ? "FILME" : "SÉRIE"}</AppText></View>
          {item.rating > 0 ? <View style={styles.rating}><Ionicons name="star" size={11} color={Colors.amber} /><AppText style={styles.ratingText}>{item.rating.toFixed(1)}</AppText></View> : null}
        </View>
        <AppText numberOfLines={2} style={styles.cardTitle}>{item.title}</AppText>
        <AppText numberOfLines={1} style={styles.cardMeta}>{item.year > 0 ? item.year : "Ano não informado"} · {item.detail}</AppText>
      </TVFocusable>
      <TVFocusable accessibilityRole="button" accessibilityLabel={`Remover ${item.title} de Assistir Mais Tarde`} onPress={() => onRemove(item)} style={styles.removeButton}>
        <Ionicons name="bookmark" size={17} color={Colors.text} />
      </TVFocusable>
    </View>
  );
}

function EmptySavedState() {
  return (
    <View style={styles.empty}>
      <Ionicons name="bookmark-outline" size={42} color={Colors.subtle} />
      <AppText style={styles.emptyTitle}>Sua lista está vazia</AppText>
      <AppText style={styles.emptyBody}>Use o ícone de marcador em filmes e séries para salvá-los e assistir depois.</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  ambient: { position: "absolute", top: -110, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(59,130,246,0.1)" },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingBottom: 18 },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 13, borderWidth: 1, borderColor: Colors.border, backgroundColor: "rgba(255,255,255,0.06)" },
  headerCopy: { flex: 1, gap: 2 },
  kicker: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 1.3, color: Colors.blueBright },
  title: { fontFamily: "Inter_700Bold", fontSize: 24, letterSpacing: -0.55, color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.muted },
  grid: { paddingTop: 4 },
  card: { position: "relative" },
  cardMain: { gap: 7 },
  poster: { overflow: "hidden", borderRadius: Radii.medium, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundRaised },
  posterFallback: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: Colors.backgroundRaised },
  posterShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(3,7,15,0.12)" },
  typeBadge: { position: "absolute", top: 8, left: 8, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, backgroundColor: "rgba(5,8,15,0.72)" },
  typeBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 8, letterSpacing: 0.5, color: Colors.text },
  rating: { position: "absolute", right: 7, bottom: 7, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(5,8,15,0.74)" },
  ratingText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.text },
  cardTitle: { minHeight: 34, fontFamily: "Inter_600SemiBold", fontSize: 13, lineHeight: 17, color: Colors.text },
  cardMeta: { fontSize: 10, color: Colors.subtle },
  removeButton: { position: "absolute", top: 8, right: 8, width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(4,8,16,0.76)" },
  empty: { alignItems: "center", gap: 10, paddingTop: 90, paddingHorizontal: 30 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text },
  emptyBody: { maxWidth: 330, fontSize: 13, lineHeight: 19, color: Colors.muted, textAlign: "center" },
});
