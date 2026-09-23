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
import type { VodMovie } from "@/store/types";

const SORT_OPTIONS = ["Mais recentes", "Melhor avaliados", "A-Z"] as const;
type SortOption = typeof SORT_OPTIONS[number];

const FAVORITES_LABEL = "Favoritos";

// ---------------------------------------------------------------------------
// Static header (no SearchField here)
// ---------------------------------------------------------------------------

interface MoviesHeaderProps {
  isSyncing: boolean;
  syncError: string | null;
  syncProgress: string | null;
  genres: string[];
  genre: string;
  sort: SortOption;
  filteredCount: number;
  totalCount: number;
  refresh: () => void;
  setGenre: (g: string) => void;
  setSort: (s: SortOption) => void;
}

function MoviesHeader({
  isSyncing, syncError, syncProgress, genres, genre, sort,
  filteredCount, totalCount, refresh, setGenre, setSort,
}: MoviesHeaderProps) {
  return (
    <View style={styles.headerBlock}>
      {isSyncing ? (
        <View style={styles.syncBanner}>
          <ActivityIndicator size="small" color={Colors.blueBright} />
          <AppText style={styles.syncText}>{syncProgress ?? "Carregando filmes..."}</AppText>
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
          <AppText style={styles.kicker}>CATÁLOGO VOD</AppText>
          <AppText style={Type.display}>Filmes</AppText>
          <AppText style={styles.subtitle}>
            {isSyncing
              ? (syncProgress ?? "Carregando...")
              : `${totalCount} filmes disponíveis`}
          </AppText>
        </View>
        <TVFocusable
          onPress={refresh}
          style={styles.libraryIcon}
          accessibilityLabel="Atualizar catálogo"
        >
          <Ionicons name="refresh" size={22} color={Colors.blueBright} />
        </TVFocusable>
      </View>

      <View style={styles.filterBlock}>
        <AppText style={styles.filterLabel}>Categorias</AppText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroller}
          contentContainerStyle={styles.filterContent}
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
      </View>

      {genre !== FAVORITES_LABEL ? (
        <View style={styles.sortRow}>
          <SectionHeader
            title={`${filteredCount} títulos`}
            subtitle={isSyncing ? "Carregando..." : "Atualizados recentemente"}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.sortScroller}
            contentContainerStyle={styles.sortContent}
          >
            {SORT_OPTIONS.map((item) => (
              <Chip
                key={item}
                label={item}
                selected={sort === item}
                onPress={() => setSort(item)}
              />
            ))}
          </ScrollView>
        </View>
      ) : (
        <SectionHeader
          title={`${filteredCount} favoritos`}
          subtitle="Filmes que você quer assistir"
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function MoviesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tvMode = useTVMode();
  const [genre, setGenre] = useState("Todos");
  const [sort, setSort] = useState<SortOption>("Mais recentes");
  const [query, setQuery] = useState("");

  const movies = useAppStore((state) => state.contentCache.vodMovies);
  const cachedCategories = useAppStore((state) => state.contentCache.vodCategories);
  const favoriteMovieIds = useAppStore((state) => state.favoriteMovieIds);
  const { isSyncing, syncError, syncProgress, refresh } = useSyncStatus();

  const hPad = tvMode ? 46 : 20;
  const numColumns = tvMode || width > 720 ? 3 : 2;
  const colGap = 12;
  const cardWidth = Math.floor((width - hPad * 2 - colGap * (numColumns - 1)) / numColumns);

  const genres = useMemo(
    () => [FAVORITES_LABEL, "Todos", ...cachedCategories.map((c) => c.name)],
    [cachedCategories],
  );

  const filteredMovies = useMemo(() => {
    if (genre === FAVORITES_LABEL) {
      return movies.filter((movie) => favoriteMovieIds.includes(movie.id));
    }
    const q = query.trim().toLowerCase();
    return movies
      .filter((movie) => {
        const matchGenre = genre === "Todos" || movie.genre === genre;
        const matchQ = !q || `${movie.title} ${movie.genre}`.toLowerCase().includes(q);
        return matchGenre && matchQ;
      })
      .sort((a, b) => {
        if (sort === "Melhor avaliados") return b.rating - a.rating;
        if (sort === "A-Z") return a.title.localeCompare(b.title);
        return b.year - a.year;
      });
  }, [movies, genre, query, sort, favoriteMovieIds]);

  const handleMovie = useCallback(
    (id: string) => { router.push(`/details/${id}`); },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: VodMovie }) => (
      <PosterCard
        title={item.title}
        image={item.poster}
        meta={`${item.year} · ${item.genre}`}
        rating={item.rating}
        quality={item.quality}
        width={cardWidth}
        onPress={() => handleMovie(item.id)}
      />
    ),
    [cardWidth, handleMovie],
  );

  const keyExtractor = useCallback((item: VodMovie) => item.id, []);
  const isEmpty = !isSyncing && movies.length === 0;

  const handleSetGenre = useCallback((g: string) => setGenre(g), []);
  const handleSetSort = useCallback((s: SortOption) => setSort(s), []);

  // useMemo returns a React ELEMENT (not a component function).
  // FlatList uses React.isValidElement() to detect this and renders it without
  // calling it as a new component type — so the header NEVER unmounts when
  // filteredMovies.length changes, which keeps the keyboard focused during search.
  const listHeaderElement = useMemo(
    () => (
      <MoviesHeader
        isSyncing={isSyncing}
        syncError={syncError}
        syncProgress={syncProgress}
        genres={genres}
        genre={genre}
        sort={sort}
        filteredCount={filteredMovies.length}
        totalCount={movies.length}
        refresh={refresh}
        setGenre={handleSetGenre}
        setSort={handleSetSort}
      />
    ),
    [isSyncing, syncError, syncProgress, genres, genre, sort, filteredMovies.length, movies.length, refresh, handleSetGenre, handleSetSort],
  );

  const listEmptyElement = useMemo(
    () =>
      isEmpty ? (
        <View style={styles.empty}>
          <Ionicons name="film-outline" size={32} color={Colors.subtle} />
          <AppText style={styles.emptyTitle}>Nenhum filme disponível</AppText>
          <AppText style={styles.emptyBody}>
            Toque em Atualizar para baixar o catálogo do servidor.
          </AppText>
          <TVFocusable
            onPress={refresh}
            style={styles.syncBtn}
            accessibilityLabel="Sincronizar filmes"
          >
            <Ionicons name="refresh" size={15} color={Colors.white} />
            <AppText style={styles.syncBtnText}>Sincronizar agora</AppText>
          </TVFocusable>
        </View>
      ) : genre === FAVORITES_LABEL ? (
        <View style={styles.empty}>
          <Ionicons name="star-outline" size={32} color={Colors.subtle} />
          <AppText style={styles.emptyTitle}>Sem filmes favoritos</AppText>
          <AppText style={styles.emptyBody}>
            Abra um filme e toque em Mais tarde para salvar para depois.
          </AppText>
        </View>
      ) : (
        <EmptyState
          title="Nenhum filme encontrado"
          body="Experimente outro título ou limpe os filtros para ver todo o catálogo."
        />
      ),
    [isEmpty, refresh, genre],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.ambient} />
      {/* SearchField outside FlatList prevents TextInput from remounting on query change */}
      {genre !== FAVORITES_LABEL ? (
        <View style={[styles.searchBar, { paddingHorizontal: hPad }]}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por título ou gênero"
          />
        </View>
      ) : null}
      <FlatList
        key={`movies-${numColumns}`}
        data={filteredMovies}
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
    top: -140,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(59, 130, 246, 0.07)",
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
    backgroundColor: "rgba(59,130,246,0.1)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(59,130,246,0.2)",
    marginHorizontal: -20,
  },
  syncText: { fontSize: 12, color: Colors.blueBright, flex: 1 },
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
  kicker: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 1.2, color: Colors.blueBright },
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
  filterBlock: { gap: 8 },
  filterLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.muted },
  filterScroller: { flexGrow: 0, marginHorizontal: -20 },
  filterContent: { gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
  sortRow: { gap: 7 },
  sortScroller: { flexGrow: 0, marginHorizontal: -20 },
  sortContent: { gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
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
    backgroundColor: Colors.blue,
  },
  syncBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.white },
});
