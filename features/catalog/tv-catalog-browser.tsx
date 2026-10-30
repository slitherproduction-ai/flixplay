import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { Colors } from "@/constants/theme";
import { BRAND } from "@/constants/brand";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { CatalogBackground } from "@/components/catalog-background";
import { TV_NAV_WIDTH } from "@/components/tv-side-navigation";
import { hasRememberedTvFocus } from "@/core/navigation/tv-focus-memory";
import { useTvFocusRestoration } from "@/hooks/use-tv-focus-restoration";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchTmdbPersonFilmography, normalizeCatalogTitle } from "@/services/tmdb";

// ---------------------------------------------------------------------------
// Filmes e Séries em TV no formato do ELVANOQ Play para Roku (BrowseView):
//   • cabeçalho com total de títulos e categorias;
//   • painel de categorias à esquerda, com contagem — a primeira linha é
//     "Buscar título ou ator" e a grade muda ao parar sobre uma categoria;
//   • grade de pôsteres à direita, com o rótulo da categoria;
//   • rodapé com o título focado e seus dados.
//
// Também é usado no tablet na horizontal (toque): sem menu lateral, alvos de
// toque maiores, título sob cada pôster e sem as dicas do controle remoto.
// ---------------------------------------------------------------------------

export type TvCatalogEntry = {
  id: string;
  title: string;
  poster: string;
  rating: number;
  year: number;
  category: string;
  /** Duração (filme) ou temporadas (série). */
  detail: string;
  quality?: string;
};

type CategoryRow = {
  key: string;
  name: string;
  total: number | null;
  icon?: "search" | "star" | "grid-outline";
  special?: boolean;
};

const SEARCH_KEY = "__search";
const FAVORITES_KEY = "__favorites";
const ALL_KEY = "__all";
/** Mesmo atraso do `requestTimer` do Roku: rolar a lista não troca a grade a cada tecla. */
const CATEGORY_SETTLE_MS = 350;
const SEARCH_LIMIT = 120;

type Props = {
  kind: "movies" | "series";
  entries: TvCatalogEntry[];
  /** Ordem das categorias como chegam da lista (painel do provedor). */
  categoryNames: string[];
  favoriteIds: string[];
  isSyncing: boolean;
  syncProgress: string | null;
  syncError: string | null;
  onOpen: (id: string) => void;
  onRefresh: () => void;
};

function formatCount(value: number) {
  return value.toLocaleString("pt-BR");
}

const PosterTile = memo(function PosterTile({
  entry,
  width,
  index,
  focusScope,
  preferred,
  touch,
  onOpen,
  onFocusEntry,
}: {
  entry: TvCatalogEntry;
  width: number;
  index: number;
  focusScope: string;
  preferred: boolean;
  touch: boolean;
  onOpen: (id: string) => void;
  onFocusEntry: (entry: TvCatalogEntry) => void;
}) {
  const tile = (
    <TVFocusable
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}${entry.rating > 0 ? `, nota ${entry.rating.toFixed(1)}` : ""}`}
      focusId={entry.id}
      focusScope={focusScope}
      focusIndex={index}
      restoreFocus
      hasTVPreferredFocus={preferred}
      onFocus={() => onFocusEntry(entry)}
      onPress={() => onOpen(entry.id)}
      focusStyle={styles.posterFocused}
      style={[styles.poster, { width, height: Math.round(width * 1.5) }]}
    >
      <Image source={{ uri: entry.poster }} contentFit="cover" transition={180} recyclingKey={entry.id} style={StyleSheet.absoluteFill} />
      {!entry.poster ? (
        <View style={styles.posterFallback}>
          <AppText numberOfLines={3} style={styles.posterFallbackText}>{entry.title}</AppText>
        </View>
      ) : null}
      {entry.quality ? (
        <View style={styles.posterQuality}><AppText style={styles.posterQualityText}>{entry.quality}</AppText></View>
      ) : null}
    </TVFocusable>
  );
  if (!touch) return tile;
  // No toque não há foco para alimentar o rodapé: o título vai sob o pôster.
  return (
    <View style={{ width }}>
      {tile}
      <AppText numberOfLines={1} style={styles.touchPosterTitle}>{entry.title}</AppText>
      <AppText numberOfLines={1} style={styles.touchPosterMeta}>
        {[entry.year > 0 ? String(entry.year) : "", entry.rating > 0 ? `★ ${entry.rating.toFixed(1)}` : ""].filter(Boolean).join("  ·  ")}
      </AppText>
    </View>
  );
});

const CategoryRowItem = memo(function CategoryRowItem({
  item,
  index,
  kind,
  selected,
  touch,
  onFocusRow,
  onPressRow,
}: {
  item: CategoryRow;
  index: number;
  kind: string;
  selected: boolean;
  touch: boolean;
  onFocusRow: (item: CategoryRow) => void;
  onPressRow: (item: CategoryRow) => void;
}) {
  const [focused, setFocused] = useState(false);
  const highlight = selected || item.special;
  return (
    <TVFocusable
      accessibilityRole="button"
      accessibilityLabel={item.total !== null ? `${item.name}, ${item.total} títulos` : item.name}
      accessibilityState={{ selected }}
      focusId={`${kind}-category-${item.key}`}
      focusScope={`${kind}-categories`}
      focusIndex={index}
      onFocus={() => { setFocused(true); onFocusRow(item); }}
      onBlur={() => setFocused(false)}
      onPress={() => onPressRow(item)}
      focusStyle={styles.categoryFocused}
      style={({ pressed }) => [styles.categoryRow, touch && styles.touchCategoryRow, selected && styles.categoryRowSelected, pressed && styles.categoryPressed]}
    >
      {selected && !focused ? <View style={styles.categoryMarker} /> : null}
      {item.icon ? (
        <Ionicons name={item.icon} size={12} color={focused ? Colors.white : highlight ? Colors.blueBright : Colors.muted} />
      ) : null}
      <AppText numberOfLines={1} style={[styles.categoryName, touch && styles.touchCategoryName, highlight && styles.categoryNameSelected, focused && styles.categoryTextFocused]}>{item.name}</AppText>
      {item.total !== null ? (
        <AppText style={[styles.categoryCount, selected && styles.categoryCountSelected, focused && styles.categoryTextFocused]}>{formatCount(item.total)}</AppText>
      ) : null}
    </TVFocusable>
  );
});

export function TvCatalogBrowser({
  kind,
  entries,
  categoryNames,
  favoriteIds,
  isSyncing,
  syncProgress,
  syncError,
  onOpen,
  onRefresh,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const touch = !useTVMode();
  const focusScope = `${kind}-grid`;
  const sectionTitle = kind === "movies" ? "Filmes" : "Séries";
  const noun = kind === "movies" ? "filme" : "série";

  const [selectedKey, setSelectedKey] = useState<string>(ALL_KEY);
  const [focusedEntry, setFocusedEntry] = useState<TvCatalogEntry | null>(null);
  const [focusedCategory, setFocusedCategory] = useState<CategoryRow | null>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TvCatalogEntry[]>([]);
  const [searchPerson, setSearchPerson] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const searchGeneration = useRef(0);

  // Layout derivado do Roku (painel 400 px + grade de 6 colunas a 1920 px).
  const contentWidth = width - (touch ? insets.left + insets.right : TV_NAV_WIDTH);
  const sidePadding = touch ? 32 : 28;
  const panelWidth = Math.round(touch ? Math.min(280, Math.max(220, contentWidth * 0.22)) : Math.min(220, Math.max(180, contentWidth * 0.22)));
  const panelGap = touch ? 24 : 20;
  const columns = touch && contentWidth >= 1400 ? 7 : 6;
  const gridGap = 12;
  const gridWidth = contentWidth - sidePadding * 2 - panelWidth - panelGap;
  // Desconta o recuo interno da grade (espaço para a ampliação do foco).
  const gridInset = 8;
  const posterWidth = Math.floor((gridWidth - gridInset * 2 - gridGap * (columns - 1)) / columns);
  const { listRef, onScrollToIndexFailed } = useTvFocusRestoration<TvCatalogEntry>(focusScope, !touch, columns);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries) {
      const name = entry.category || "Sem categoria";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return map;
  }, [entries]);

  const categories = useMemo<CategoryRow[]>(() => {
    const ordered: CategoryRow[] = [
      { key: SEARCH_KEY, name: "Buscar título ou ator", total: null, icon: "search", special: true },
      { key: FAVORITES_KEY, name: "Minha Lista", total: favoriteIds.length, icon: "star" },
      { key: ALL_KEY, name: "Todas", total: entries.length, icon: "grid-outline" },
    ];
    const seen = new Set<string>();
    for (const name of categoryNames) {
      if (seen.has(name)) continue;
      seen.add(name);
      ordered.push({ key: name, name, total: counts.get(name) ?? 0 });
    }
    // Categorias presentes nos títulos mas ausentes da lista de categorias.
    for (const [name, total] of counts) {
      if (!seen.has(name)) ordered.push({ key: name, name, total });
    }
    return ordered;
  }, [categoryNames, counts, entries.length, favoriteIds.length]);

  const realCategoryCount = categories.length - 3;

  const visibleEntries = useMemo(() => {
    if (selectedKey === SEARCH_KEY) return searchResults;
    if (selectedKey === ALL_KEY) return entries;
    if (selectedKey === FAVORITES_KEY) {
      const ids = new Set(favoriteIds);
      return entries.filter((entry) => ids.has(entry.id));
    }
    return entries.filter((entry) => (entry.category || "Sem categoria") === selectedKey);
  }, [entries, favoriteIds, searchResults, selectedKey]);

  const selectedCategory = categories.find((category) => category.key === selectedKey) ?? categories[2];

  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  const handleCategoryFocus = useCallback((category: CategoryRow) => {
    setFocusedCategory(category);
    setFocusedEntry(null);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setSelectedKey(category.key), CATEGORY_SETTLE_MS);
  }, []);

  const handleCategoryPress = useCallback((category: CategoryRow) => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setSelectedKey(category.key);
    // "Buscar": OK abre o teclado, como no Roku.
    if (category.key === SEARCH_KEY) requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleEntryFocus = useCallback((entry: TvCatalogEntry) => {
    setFocusedCategory(null);
    setFocusedEntry(entry);
  }, []);

  // Busca: primeiro pergunta ao TMDB se o texto é um ator; depois procura na
  // lista pelo título e pela filmografia encontrada.
  const runSearch = useCallback(async (term: string) => {
    const trimmed = term.trim();
    const generation = searchGeneration.current + 1;
    searchGeneration.current = generation;
    setSubmittedQuery(trimmed);
    setSearchPerson("");
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const wanted = normalizeCatalogTitle(trimmed);
    const byTitle = entries.filter((entry) => normalizeCatalogTitle(entry.title).includes(wanted));
    let results = byTitle;
    let person = "";
    try {
      const filmography = await fetchTmdbPersonFilmography(trimmed, kind === "movies" ? "movie" : "tv");
      if (filmography && filmography.titles.length > 0) {
        const titles = new Set(filmography.titles.map(normalizeCatalogTitle).filter(Boolean));
        const byPerson = entries.filter((entry) => titles.has(normalizeCatalogTitle(entry.title)));
        if (byPerson.length > 0) {
          person = filmography.person;
          const seen = new Set(byPerson.map((entry) => entry.id));
          results = [...byPerson, ...byTitle.filter((entry) => !seen.has(entry.id))];
        }
      }
    } catch { /* busca por ator é opcional */ }
    if (generation !== searchGeneration.current) return;
    setSearchPerson(person);
    setSearchResults(results.slice(0, SEARCH_LIMIT));
    setSearchLoading(false);
  }, [entries, kind]);

  useEffect(() => {
    if (selectedKey !== SEARCH_KEY) return;
    const timer = setTimeout(() => { void runSearch(query); }, 450);
    return () => clearTimeout(timer);
  }, [query, runSearch, selectedKey]);

  const eyebrow = selectedKey === SEARCH_KEY
    ? (submittedQuery
      ? `RESULTADOS PARA "${submittedQuery.toLocaleUpperCase("pt-BR")}"${searchPerson ? `   •   COM ${searchPerson.toLocaleUpperCase("pt-BR")}` : ""}`
      : "BUSCA")
    : selectedCategory.name.toLocaleUpperCase("pt-BR");

  // Rodapé: título focado ou, no painel, a categoria sob o foco.
  let footerTitle = "";
  let footerMeta = "";
  if (focusedCategory) {
    footerTitle = focusedCategory.special ? "Buscar" : focusedCategory.name;
    footerMeta = focusedCategory.special
      ? "OK  digitar o nome do título ou de um ator"
      : `${formatCount(focusedCategory.total ?? 0)} títulos   •   →  ou  OK para ver os títulos`;
  } else if (focusedEntry) {
    footerTitle = focusedEntry.title;
    footerMeta = [
      focusedEntry.year > 0 ? String(focusedEntry.year) : "",
      focusedEntry.detail,
      focusedEntry.category,
      focusedEntry.rating > 0 ? `Nota ${focusedEntry.rating.toFixed(1)}` : "",
    ].filter(Boolean).join("   •   ");
  }

  const renderCategory = useCallback(({ item, index }: { item: CategoryRow; index: number }) => (
    <CategoryRowItem
      item={item}
      index={index}
      kind={kind}
      touch={touch}
      selected={item.key === selectedKey}
      onFocusRow={handleCategoryFocus}
      onPressRow={handleCategoryPress}
    />
  ), [handleCategoryFocus, handleCategoryPress, kind, selectedKey, touch]);

  const preferFirstPoster = !hasRememberedTvFocus(focusScope);
  const renderPoster = useCallback(({ item, index }: { item: TvCatalogEntry; index: number }) => (
    <PosterTile
      entry={item}
      width={posterWidth}
      index={index}
      focusScope={focusScope}
      preferred={!touch && preferFirstPoster && index === 0}
      touch={touch}
      onOpen={onOpen}
      onFocusEntry={handleEntryFocus}
    />
  ), [focusScope, handleEntryFocus, onOpen, posterWidth, preferFirstPoster, touch]);

  const emptyMessage = selectedKey === SEARCH_KEY
    ? (searchLoading
      ? "Buscando em todo o catálogo…"
      : submittedQuery.length >= 2
        ? `Nada encontrado para "${submittedQuery}". Tente outro título ou o nome de um ator.`
        : `Aperte OK em "Buscar" e digite o nome ${kind === "movies" ? "do filme" : "da série"} ou de um ator.`)
    : selectedKey === FAVORITES_KEY
      ? `Nenhum${kind === "series" ? "a" : ""} ${noun} na Minha Lista ainda.`
      : isSyncing
        ? (syncProgress ?? "Carregando catálogo…")
        : "Nenhum título encontrado na lista atual.";

  return (
    <View style={styles.screen}>
      <CatalogBackground />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(20,125,255,0.10)", "rgba(7,11,20,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingHorizontal: sidePadding, paddingTop: (touch ? insets.top + 18 : 26) }]}>
        <View style={styles.headerCopy}>
          <AppText style={[styles.title, touch && styles.touchTitle]}>{sectionTitle}</AppText>
          <AppText style={[styles.count, touch && styles.touchCount]}>
            {isSyncing && entries.length === 0
              ? (syncProgress ?? "Carregando…")
              : `${formatCount(entries.length)} títulos   •   ${formatCount(realCategoryCount)} categorias`}
          </AppText>
        </View>
        <View style={styles.headerRight}>
          {touch ? null : <AppText style={styles.hint}>
            {kind === "series" ? "←  Categorias e Busca   •   OK  Temporadas e episódios" : "←  Categorias e Busca   •   OK  Detalhes e assistir"}
          </AppText>}
          {syncError ? (
            <TVFocusable accessibilityRole="button" accessibilityLabel="Tentar sincronizar novamente" onPress={onRefresh} style={styles.retry} focusStyle={styles.retryFocused}>
              <Ionicons name="refresh" size={12} color={Colors.background} />
              <AppText style={styles.retryText}>Tentar novamente</AppText>
            </TVFocusable>
          ) : isSyncing ? <ActivityIndicator size="small" color={Colors.blueBright} /> : null}
        </View>
      </View>

      <View style={[styles.body, { paddingHorizontal: sidePadding, gap: panelGap }]}>
        <View style={[styles.panel, { width: panelWidth }]}>
          <AppText style={styles.panelTitle}>CATEGORIAS</AppText>
          <FlatList
            data={categories}
            keyExtractor={(item) => item.key}
            renderItem={renderCategory}
            showsVerticalScrollIndicator={false}
            initialNumToRender={16}
            windowSize={7}
            contentContainerStyle={styles.panelList}
          />
        </View>

        <View style={styles.gridArea}>
          <AppText numberOfLines={1} style={styles.eyebrow}>{eyebrow}</AppText>
          {selectedKey === SEARCH_KEY ? (
            <View style={[styles.searchBox, touch && styles.touchSearchBox]}>
              <Ionicons name="search" size={14} color={Colors.blueBright} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => { void runSearch(query); }}
                placeholder={`Nome ${kind === "movies" ? "do filme" : "da série"} ou de um ator`}
                placeholderTextColor={Colors.subtle}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                style={[styles.searchInput, touch && styles.touchSearchInput]}
                accessibilityLabel="Buscar título ou ator"
              />
              {searchLoading ? <ActivityIndicator size="small" color={Colors.blueBright} /> : null}
            </View>
          ) : null}
          <FlatList
            ref={listRef}
            key={`${kind}-grid-${columns}-${selectedKey}`}
            data={visibleEntries}
            numColumns={columns}
            keyExtractor={(item) => item.id}
            renderItem={renderPoster}
            columnWrapperStyle={{ gap: gridGap }}
            ItemSeparatorComponent={() => <View style={{ height: touch ? 18 : gridGap + 2 }} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.gridContent, { paddingBottom: touch ? 32 : Math.round(height * 0.16) }]}
            initialNumToRender={18}
            maxToRenderPerBatch={18}
            windowSize={5}
            removeClippedSubviews
            onScrollToIndexFailed={onScrollToIndexFailed}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name={selectedKey === SEARCH_KEY ? "search" : kind === "movies" ? "film-outline" : "albums-outline"} size={26} color={Colors.subtle} />
                <AppText style={styles.emptyText}>{emptyMessage}</AppText>
              </View>
            }
          />
          {footerTitle && !touch ? (
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(7,11,20,0)", "rgba(7,11,20,0.92)", BRAND.colors.background]}
              locations={[0, 0.45, 1]}
              style={styles.footer}
            >
              <AppText numberOfLines={1} style={styles.footerTitle}>{footerTitle}</AppText>
              <View style={styles.footerRow}>
                {focusedEntry && focusedEntry.rating > 0 && !focusedCategory ? (
                  <Ionicons name="star" size={10} color={Colors.amber} />
                ) : null}
                <AppText numberOfLines={1} style={styles.footerMeta}>{footerMeta}</AppText>
                <AppText style={styles.footerCount}>{formatCount(visibleEntries.length)} títulos</AppText>
              </View>
            </LinearGradient>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16, paddingTop: 26, paddingBottom: 14 },
  headerCopy: { gap: 3 },
  title: { fontFamily: "Inter_700Bold", fontSize: 22, lineHeight: 27, letterSpacing: -0.5, color: Colors.text },
  count: { fontSize: 10, color: Colors.muted },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  hint: { fontSize: 10, color: Colors.muted },
  retry: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, backgroundColor: Colors.white },
  retryFocused: { borderWidth: 2, borderColor: Colors.blueBright },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.background },

  body: { flex: 1, flexDirection: "row" },
  panel: { paddingTop: 10, paddingHorizontal: 6, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderWidth: 1, borderBottomWidth: 0, borderColor: "rgba(190,222,255,0.10)", backgroundColor: "rgba(13,20,34,0.86)" },
  panelTitle: { marginBottom: 6, paddingHorizontal: 8, fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 1.3, color: Colors.muted },
  panelList: { gap: 2, paddingBottom: 24 },
  categoryRow: { minHeight: 26, flexDirection: "row", alignItems: "center", gap: 7, paddingLeft: 10, paddingRight: 8, borderRadius: 7, borderWidth: 1, borderColor: "transparent" },
  categoryRowSelected: { backgroundColor: "rgba(0,215,255,0.06)" },
  categoryFocused: { backgroundColor: BRAND.colors.primary, borderColor: Colors.blueBright, transform: [{ scale: 1 }] },
  categoryMarker: { position: "absolute", left: 0, top: 6, bottom: 6, width: 2, borderRadius: 1, backgroundColor: Colors.blueBright },
  categoryName: { flex: 1, fontSize: 11, color: "#C9D3E3" },
  categoryNameSelected: { fontFamily: "Inter_600SemiBold", color: Colors.blueBright },
  categoryCount: { fontSize: 9, color: Colors.muted },
  categoryCountSelected: { color: Colors.blueBright },
  categoryTextFocused: { fontFamily: "Inter_600SemiBold", color: Colors.white },
  categoryPressed: { opacity: 0.7 },
  // Tablet (toque): alvos de 40 dp e texto maior.
  touchCategoryRow: { minHeight: 40, borderRadius: 9 },
  touchCategoryName: { fontSize: 13 },
  touchTitle: { fontSize: 28, lineHeight: 34 },
  touchCount: { fontSize: 12 },
  touchSearchBox: { height: 44 },
  touchSearchInput: { height: 44, fontSize: 14 },
  touchPosterTitle: { marginTop: 7, fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  touchPosterMeta: { marginTop: 2, fontSize: 10, color: Colors.muted },

  gridArea: { flex: 1, minWidth: 0 },
  eyebrow: { marginTop: 2, marginBottom: 10, fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 1.3, color: Colors.blueBright },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, height: 36, marginBottom: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: "rgba(0,215,255,0.28)", backgroundColor: "rgba(13,20,34,0.9)" },
  searchInput: { flex: 1, height: 36, paddingVertical: 0, fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.text },
  gridContent: { paddingTop: 8, paddingHorizontal: 8 },
  poster: { overflow: "hidden", borderRadius: 9, borderWidth: 1, borderColor: "rgba(190,222,255,0.10)", backgroundColor: Colors.backgroundRaised },
  posterFocused: { borderWidth: 2, borderColor: Colors.blueBright, transform: [{ scale: 1.07 }] },
  posterFallback: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: 8 },
  posterFallbackText: { textAlign: "center", fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.muted },
  posterQuality: { position: "absolute", top: 5, right: 5, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, backgroundColor: "rgba(7,11,20,0.78)" },
  posterQualityText: { fontFamily: "Inter_700Bold", fontSize: 7, letterSpacing: 0.3, color: Colors.text },
  empty: { alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 70, paddingHorizontal: 30 },
  emptyText: { maxWidth: 380, textAlign: "center", fontSize: 12, lineHeight: 17, color: Colors.muted },
  footer: { position: "absolute", right: 0, bottom: 0, left: 0, paddingTop: 34, paddingBottom: 18, paddingHorizontal: 4, gap: 3 },
  footerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  footerMeta: { flex: 1, fontSize: 10, color: Colors.muted },
  footerCount: { fontSize: 10, color: Colors.subtle },
});
