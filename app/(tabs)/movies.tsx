import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Colors } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useSyncStatus } from "@/hooks/useXtreamSync";
import { AppText, EmptyState, PosterCard } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import type { VodMovie } from "@/store/types";
import { TV_NAV_WIDTH } from "@/components/tv-side-navigation";
import { useTvFocusRestoration } from "@/hooks/use-tv-focus-restoration";
import { useCatalogPagination } from "@/hooks/use-catalog-pagination";
import { CatalogBackground } from "@/components/catalog-background";
import { MobileCatalogHeader } from "@/features/catalog/mobile-catalog-header";
import { dedupeTitleVariants, displayCategory } from "@/features/catalog/display";
import { TvCatalogBrowser, type TvCatalogEntry } from "@/features/catalog/tv-catalog-browser";

const MOVIES_FOCUS_SCOPE = "movies-grid";

const SORT_OPTIONS = ["Mais recentes", "Melhor avaliados", "A-Z", "Z-A"] as const;
type SortOption = typeof SORT_OPTIONS[number];

const FAVORITES_LABEL = "Favoritos";

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function MoviesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tvMode = useTVMode();
  const { isTablet, isTabletLandscape, contentPadding } = useResponsiveLayout();
  const [genre, setGenre] = useState("Todos");
  const [sort, setSort] = useState<SortOption>("Mais recentes");
  const [query, setQuery] = useState("");

  const movies = useAppStore((state) => state.contentCache.vodMovies);
  const activeServerId = useAppStore((state) => state.activeServerId);
  const cachedCategories = useAppStore((state) => state.contentCache.vodCategories);
  const favoriteMovieIds = useAppStore((state) => state.favoriteMovieIds);
  const { isSyncing, syncError, syncProgress, refresh } = useSyncStatus();

  const hPad = tvMode ? 46 : isTablet ? contentPadding : 16;
  const availableWidth = width - (tvMode ? TV_NAV_WIDTH : 0);
  const numColumns = tvMode
    ? (width >= 1500 ? 9 : width >= 1100 ? 7 : 6)
    : (isTabletLandscape ? 6 : isTablet ? 4 : width >= 1000 ? 5 : width >= 700 ? 4 : 3);
  const colGap = tvMode ? 12 : 10;
  const cardWidth = Math.floor((availableWidth - hPad * 2 - colGap * (numColumns - 1)) / numColumns);
  const { listRef, onScrollToIndexFailed } = useTvFocusRestoration<VodMovie>(MOVIES_FOCUS_SCOPE, tvMode, numColumns);

  const genres = useMemo(
    () => [FAVORITES_LABEL, "Todos", ...cachedCategories.map((c) => c.name)],
    [cachedCategories],
  );

  const filteredMovies = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movies
      .filter((movie) => {
        const matchGenre = genre === FAVORITES_LABEL
          ? favoriteMovieIds.includes(movie.id)
          : genre === "Todos" || movie.genre === genre;
        const matchQ = !q || `${movie.title} ${movie.genre}`.toLowerCase().includes(q);
        return matchGenre && matchQ;
      })
      .sort((a, b) => {
        if (sort === "Melhor avaliados") return b.rating - a.rating;
        if (sort === "A-Z") return a.title.localeCompare(b.title);
        if (sort === "Z-A") return b.title.localeCompare(a.title);
        // Xtream returns `added` for catalog insertion. Release year is not a
        // substitute: old films may be inserted today and must appear first.
        const addedA = Date.parse(a.addedAt ?? "") || 0;
        const addedB = Date.parse(b.addedAt ?? "") || 0;
        return addedB - addedA || a.title.localeCompare(b.title);
      });
  }, [movies, genre, query, sort, favoriteMovieIds]);
  const pager = useCatalogPagination<VodMovie>(activeServerId, "vodMovies", {
    categoryName: genre === FAVORITES_LABEL || genre === "Todos" ? "" : genre,
    query: genre === FAVORITES_LABEL ? "" : query.trim(),
    sort: sort === "Melhor avaliados" ? "rating_desc" : sort === "A-Z" ? "name_asc" : sort === "Z-A" ? "name_desc" : "added_desc",
  });
  // Versões do mesmo filme (dublado/legendado) viram um único cartão; a
  // versão é escolhida nos Detalhes.
  const visibleMovies = useMemo(
    () => dedupeTitleVariants(pager.enabled && genre !== FAVORITES_LABEL ? pager.items : filteredMovies),
    [filteredMovies, genre, pager.enabled, pager.items],
  );

  const handleMovie = useCallback(
    (id: string) => { router.push(`/details/${id}`); },
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: VodMovie; index: number }) => (
      <PosterCard
        title={item.title}
        image={item.poster}
        meta={[item.year > 0 ? String(item.year) : "", displayCategory(item.genre)].filter(Boolean).join(" · ")}
        rating={item.rating}
        quality={item.quality}
        width={cardWidth}
        focusId={item.id}
        focusScope={MOVIES_FOCUS_SCOPE}
        focusIndex={index}
        restoreFocus={tvMode}
        onPress={() => handleMovie(item.id)}
      />
    ),
    [cardWidth, handleMovie, tvMode],
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
      <MobileCatalogHeader
        title="Filmes"
        noun={{ singular: "filme", plural: "filmes" }}
        totalCount={movies.length}
        filteredCount={visibleMovies.length}
        isSyncing={isSyncing}
        syncProgress={syncProgress}
        syncError={syncError}
        onRetry={refresh}
        query={query}
        setQuery={setQuery}
        searchPlaceholder="Buscar por título ou gênero"
        categories={genres}
        category={genre}
        setCategory={handleSetGenre}
        favoritesLabel={FAVORITES_LABEL}
        sortOptions={SORT_OPTIONS}
        sort={sort}
        setSort={handleSetSort}
      />
    ),
    [isSyncing, syncError, syncProgress, genres, genre, sort, visibleMovies.length, movies.length, refresh, handleSetGenre, handleSetSort, query],
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
            <Ionicons name="refresh" size={15} color={Colors.background} />
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

  // TV: navegação no formato do ELVANOQ Play para Roku (painel de categorias
  // + grade de pôsteres). Os filmes já estão em memória, então a filtragem é
  // local; a ordem é a de inclusão na lista, do mais recente ao mais antigo.
  // O mesmo navegador atende o tablet na horizontal (toque).
  const catalogBrowserMode = tvMode || isTabletLandscape;
  const tvEntries = useMemo<TvCatalogEntry[]>(() => {
    if (!catalogBrowserMode) return [];
    const addedValue = (value?: string) => {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
      return Date.parse(value ?? "") || 0;
    };
    return dedupeTitleVariants(movies
      .map((movie) => ({ movie, added: addedValue(movie.addedAt) }))
      .sort((a, b) => b.added - a.added)
      .map(({ movie }) => ({
        id: movie.id,
        title: movie.title,
        poster: movie.poster,
        rating: movie.rating,
        year: movie.year,
        category: movie.genre,
        detail: movie.duration,
        quality: movie.quality,
      })));
  }, [catalogBrowserMode, movies]);
  const tvCategoryNames = useMemo(() => cachedCategories.map((category) => category.name), [cachedCategories]);

  if (catalogBrowserMode) {
    return (
      <TvCatalogBrowser
        kind="movies"
        entries={tvEntries}
        categoryNames={tvCategoryNames}
        favoriteIds={favoriteMovieIds}
        isSyncing={isSyncing}
        syncProgress={syncProgress}
        syncError={syncError}
        onOpen={handleMovie}
        onRefresh={refresh}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <CatalogBackground />
      <View style={styles.ambient} />
      <FlatList
        ref={listRef}
        key={`movies-${numColumns}`}
        data={visibleMovies}
        numColumns={numColumns}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeaderElement}
        ListEmptyComponent={listEmptyElement}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        // Atualizar o catálogo: puxar a lista para baixo (o andamento aparece no cabeçalho).
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={Colors.blueBright} colors={[Colors.blue]} progressBackgroundColor={Colors.backgroundRaised} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          tvMode && styles.tvContent,
          { paddingHorizontal: hPad },
        ]}
        columnWrapperStyle={numColumns > 1 ? [styles.columnWrapper, { gap: colGap }] : undefined}
        ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
        initialNumToRender={20}
        maxToRenderPerBatch={25}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
        onScrollToIndexFailed={onScrollToIndexFailed}
        onEndReached={pager.enabled && genre !== FAVORITES_LABEL ? pager.loadMore : undefined}
        onEndReachedThreshold={0.5}
        ListFooterComponent={pager.loading && visibleMovies.length > 0 ? <ActivityIndicator color={Colors.blueBright} style={styles.pageLoader} /> : null}
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
  // The field lives inside the virtualized header so Android cannot cover it
  // with the FlatList native surface.
  searchBar: { marginTop: -2, marginBottom: 2, padding: 6, borderRadius: 14 },
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
  columnWrapper: { alignItems: "flex-start" },
  rowSeparator: { height: 20 },
  pageLoader: { paddingVertical: 20 },
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.82)",
    backgroundColor: Colors.white,
  },
  syncBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.background },
});
