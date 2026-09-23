import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Colors, Type } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useSyncStatus } from "@/hooks/useXtreamSync";
import { AppText, Chip, EmptyState, PosterCard, SearchField, SectionHeader } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import type { SeriesItem } from "@/store/types";

function seasonsMeta(count: number, genre: string): string {
  return `${count} temporada${count !== 1 ? "s" : ""} · ${genre}`;
}

const FAVORITES_LABEL = "Favoritos";

// ---------------------------------------------------------------------------
// Static header (no SearchField here)
// ---------------------------------------------------------------------------

interface SeriesHeaderProps {
  isSyncing: boolean;
  syncError: string | null;
  syncProgress: string | null;
  genres: string[];
  genre: string;
  filteredCount: number;
  totalCount: number;
  refresh: () => void;
  setGenre: (g: string) => void;
}

function SeriesHeader({
  isSyncing, syncError, syncProgress, genres, genre,
  filteredCount, totalCount, refresh, setGenre,
}: SeriesHeaderProps) {
  return (
    <View style={styles.headerBlock}>
      {isSyncing ? (
        <View style={styles.syncBanner}>
          <ActivityIndicator size="small" color={Colors.red} />
          <AppText style={styles.syncText}>{syncProgress ?? "Carregando séries..."}</AppText>
        </View>
      ) : null}

      {syncError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={15} color="#FF8B91" />
          <AppText style={styles.errorBannerText} numberOfLines={2}>
            {syncError}
          </AppText>
          <TVFocusable
            onPress={refresh}
            style={styles.retryBtn}
            accessibilityLabel="Tentar novamente"
          >
            <AppText style={styles.retryText}>Tentar</AppText>
          </TVFocusable>
        </View>
      ) : null}

      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <AppText style={styles.kicker}>TEMPORADAS COMPLETAS</AppText>
          <AppText style={Type.display}>Séries</AppText>
          <AppText style={styles.subtitle}>
            {isSyncing
              ? (syncProgress ?? "Carregando...")
              : `${totalCount} séries disponíveis`}
          </AppText>
        </View>
        <TVFocusable
          onPress={refresh}
          style={styles.libraryIcon}
          accessibilityLabel="Atualizar catálogo de séries"
        >
          <Ionicons name="refresh" size={22} color={Colors.red} />
        </TVFocusable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.genreScroller}
        contentContainerStyle={styles.genreContent}
      >
        {genres.map((item, index) => (
          <Chip
            key={item}
            label={item}
            selected={genre === item}
            hasTVPreferredFocus={index === 0}
            onPress={() => setGenre(item)}
            icon={item === FAVORITES_LABEL ? "star" : undefined}
          />
        ))}
      </ScrollView>

      {genre !== FAVORITES_LABEL ? (
        <SectionHeader
          title="Séries para maratonar"
          subtitle={`${filteredCount} resultados`}
        />
      ) : (
        <SectionHeader
          title={`${filteredCount} favoritos`}
          subtitle="Séries que você quer maratonar"
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function SeriesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tvMode = useTVMode();
  const [genre, setGenre] = useState("Todas");
  const [query, setQuery] = useState("");

  const hPad = tvMode ? 46 : 20;
  const numColumns = tvMode || width > 720 ? 3 : 2;
  const colGap = 12;
  const cardWidth = Math.floor((width - hPad * 2 - colGap * (numColumns - 1)) / numColumns);

  const seriesList = useAppStore((state) => state.contentCache.seriesList);
  const cachedCategories = useAppStore((state) => state.contentCache.seriesCategories);
  const favoriteSeriesIds = useAppStore((state) => state.favoriteSeriesIds);
  const { isSyncing, syncError, syncProgress, refresh } = useSyncStatus();

  const genres = useMemo(
    () => [FAVORITES_LABEL, "Todas", ...cachedCategories.map((c) => c.name)],
    [cachedCategories],
  );

  const filteredSeries = useMemo(() => {
    if (genre === FAVORITES_LABEL) {
      return seriesList.filter((item) => favoriteSeriesIds.includes(item.id));
    }
    const q = query.trim().toLowerCase();
    return seriesList.filter((item) => {
      const matchGenre = genre === "Todas" || item.genre === genre;
      const matchQ = !q || `${item.title} ${item.genre}`.toLowerCase().includes(q);
      return matchGenre && matchQ;
    });
  }, [seriesList, genre, query, favoriteSeriesIds]);

  const handleSeries = useCallback(
    (id: string) => { router.push(`/details/${id}`); },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: SeriesItem }) => (
      <PosterCard
        title={item.title}
        image={item.poster}
        meta={seasonsMeta(item.seasonsCount, item.genre)}
        rating={item.rating}
        width={cardWidth}
        onPress={() => handleSeries(item.id)}
      />
    ),
    [cardWidth, handleSeries],
  );

  const keyExtractor = useCallback((item: SeriesItem) => item.id, []);
  const isEmpty = !isSyncing && seriesList.length === 0;

  const handleSetGenre = useCallback((g: string) => setGenre(g), []);

  // useMemo returns a React ELEMENT so FlatList reconciles in place and never
  // unmounts the header when filteredSeries.length changes during search.
  const listHeaderElement = useMemo(
    () => (
      <SeriesHeader
        isSyncing={isSyncing}
        syncError={syncError}
        syncProgress={syncProgress}
        genres={genres}
        genre={genre}
        filteredCount={filteredSeries.length}
        totalCount={seriesList.length}
        refresh={refresh}
        setGenre={handleSetGenre}
      />
    ),
    [isSyncing, syncError, syncProgress, genres, genre, filteredSeries.length, seriesList.length, refresh, handleSetGenre],
  );

  const listEmptyElement = useMemo(
    () =>
      isEmpty ? (
        <View style={styles.empty}>
          <Ionicons name="albums-outline" size={32} color={Colors.subtle} />
          <AppText style={styles.emptyTitle}>Nenhuma série disponível</AppText>
          <AppText style={styles.emptyBody}>
            Toque em Atualizar para baixar o catálogo do servidor.
          </AppText>
          <TVFocusable
            onPress={refresh}
            style={styles.syncBtn}
            accessibilityLabel="Sincronizar séries"
          >
            <Ionicons name="refresh" size={15} color={Colors.white} />
            <AppText style={styles.syncBtnText}>Sincronizar agora</AppText>
          </TVFocusable>
        </View>
      ) : genre === FAVORITES_LABEL ? (
        <View style={styles.empty}>
          <Ionicons name="star-outline" size={32} color={Colors.subtle} />
          <AppText style={styles.emptyTitle}>Sem séries favoritas</AppText>
          <AppText style={styles.emptyBody}>
            Abra uma série e toque em Mais tarde para salvar para depois.
          </AppText>
        </View>
      ) : (
        <EmptyState
          title="Nenhuma série encontrada"
          body="Tente buscar por outro título ou selecione Todas para explorar o catálogo."
        />
      ),
    [isEmpty, refresh, genre],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.ambient} />
      {/* SearchField outside FlatList to prevent TextInput remount on query change */}
      {genre !== FAVORITES_LABEL ? (
        <View style={[styles.searchBar, { paddingHorizontal: hPad }]}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por título ou ator"
          />
        </View>
      ) : null}
      <FlatList
        key={`series-${numColumns}`}
        data={filteredSeries}
        numColumns={numColumns}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeaderElement}
        ListEmptyComponent={listEmptyElement}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          tvMode && styles.tvContent,
          { paddingHorizontal: hPad },
        ]}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
        initialNumToRender={20}
        maxToRenderPerBatch={25}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  ambient: {
    position: "absolute",
    right: -100,
    top: -110,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(229, 9, 20, 0.06)",
  },
  searchBar: { paddingTop: 14, paddingBottom: 4 },
  content: { gap: 0, paddingTop: 0, paddingBottom: 40 },
  tvContent: { paddingBottom: 54 },
  headerBlock: { gap: 19, paddingTop: 22, marginBottom: 16 },
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(229,9,20,0.1)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(229,9,20,0.2)",
    marginHorizontal: -20,
  },
  syncText: { fontSize: 12, color: Colors.red, flex: 1 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(229,9,20,0.1)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(229,9,20,0.2)",
    marginHorizontal: -20,
  },
  errorBannerText: { fontSize: 12, color: "#FF8B91", flex: 1 },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(229,9,20,0.18)",
  },
  retryText: { fontSize: 12, color: "#FF8B91", fontFamily: "Inter_600SemiBold" },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  headingCopy: { flex: 1, gap: 4 },
  kicker: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 1.2, color: Colors.red },
  subtitle: { fontSize: 13, color: Colors.muted },
  libraryIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.glassSoft,
  },
  genreScroller: { flexGrow: 0, marginHorizontal: -20 },
  genreContent: { gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
  columnWrapper: { gap: 12 },
  rowSeparator: { height: 24 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.glassSoft,
  },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.text },
  emptyBody: { fontSize: 13, color: Colors.muted, textAlign: "center", maxWidth: 280 },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.red,
  },
  syncBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.white },
});
