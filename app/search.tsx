import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, SearchField } from "@/components/ui";
import { PremiumBackdrop, premium } from "@/components/premium-screen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { TVFocusable } from "@/components/tv-focusable";
import { Colors } from "@/constants/theme";
import { catalogDatabase, type CatalogKind } from "@/data/database/catalogDatabase";
import { createStreamUrl } from "@/services/xtream";
import { useAppStore } from "@/store/useAppStore";
import { ParentalGate } from "@/components/parental-gate";
import type { ChannelItem, SeriesItem, VodMovie } from "@/store/types";

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  type: "live" | "movie" | "series";
  streamUrl?: string;
};

const PAGE_SIZE = 40;
const SEARCH_KINDS: CatalogKind[] = ["liveChannels", "vodMovies", "seriesList"];
type IndexedItem = ChannelItem | VodMovie | SeriesItem;

function mapIndexedResult(kind: CatalogKind, item: IndexedItem): SearchResult | null {
  if (kind === "liveChannels") {
    const channel = item as ChannelItem;
    return { id: channel.id, title: channel.name, subtitle: `TV ao vivo · ${channel.categoryName}`, image: channel.logo, type: "live" };
  }
  if (kind === "vodMovies") {
    const movie = item as VodMovie;
    return { id: movie.id, title: movie.title, subtitle: `Filme · ${movie.genre}`, image: movie.poster, type: "movie" };
  }
  if (kind === "seriesList") {
    const show = item as SeriesItem;
    return { id: show.id, title: show.title, subtitle: `Série · ${show.genre}`, image: show.poster, type: "series" };
  }
  return null;
}

export default function GlobalSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tvMode, isTablet } = useResponsiveLayout();
  // Tablet e TV: coluna central com largura máxima, como nas demais telas.
  const wideStyle = tvMode || isTablet ? { width: "100%" as const, maxWidth: 820, alignSelf: "center" as const } : null;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<SearchResult | null>(null);
  const activeServerId = useAppStore((state) => state.activeServerId);
  const isContentBlocked = useAppStore((state) => state.isContentBlocked);
  const activeServer = useAppStore((state) => state.servers.find((server) => server.id === state.activeServerId));
  const liveChannels = useAppStore((state) => state.contentCache.liveChannels);
  const requestGeneration = useRef(0);

  const loadPage = useCallback(async (term: string, offset: number, generation: number) => {
    if (!activeServerId || term.length < 2) return;
    setLoading(true);
    if (offset === 0) setSearchError(null);
    try {
      const page = await catalogDatabase.searchPage<IndexedItem>(activeServerId, term, SEARCH_KINDS, { offset, limit: PAGE_SIZE });
      if (generation !== requestGeneration.current) return;
      const mapped = page.map(({ kind, item }) => mapIndexedResult(kind, item)).filter((item): item is SearchResult => item !== null);
      setResults((current) => (offset === 0 ? mapped : [...current, ...mapped]));
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      if (generation !== requestGeneration.current) return;
      if (offset === 0) setResults([]);
      setHasMore(false);
      setSearchError("Não foi possível pesquisar o catálogo local.");
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [activeServerId]);

  useEffect(() => {
    const term = query.trim();
    const generation = requestGeneration.current + 1;
    requestGeneration.current = generation;
    if (term.length < 2) {
      const timer = setTimeout(() => {
        if (generation !== requestGeneration.current) return;
        setResults([]);
        setHasMore(false);
        setLoading(false);
        setSearchError(null);
      }, 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => void loadPage(term, 0, generation), 250);
    return () => clearTimeout(timer);
  }, [loadPage, query]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    void loadPage(query.trim(), results.length, requestGeneration.current);
  }, [hasMore, loadPage, loading, query, results.length]);

  const openResult = useCallback((item: SearchResult) => {
    if (isContentBlocked(item.id)) {
      setPendingResult(item);
      return;
    }
    if (item.type === "live" && activeServer) {
      const cachedChannel = liveChannels.find((channel) => channel.id === item.id);
      const streamUrl = cachedChannel?.streamUrl ?? createStreamUrl(activeServer, item.id.replace(/^channel-/, ""));
      router.push({ pathname: "/player", params: { id: item.id, title: item.title, type: item.type, streamUrl } });
    } else {
      router.push(`/details/${item.id}`);
    }
  }, [activeServer, isContentBlocked, liveChannels, router]);

  const openAuthorizedResult = useCallback(() => {
    const item = pendingResult;
    setPendingResult(null);
    if (!item) return;
    if (item.type === "live" && activeServer) {
      const cachedChannel = liveChannels.find((channel) => channel.id === item.id);
      const streamUrl = cachedChannel?.streamUrl ?? createStreamUrl(activeServer, item.id.replace(/^channel-/, ""));
      router.push({ pathname: "/player", params: { id: item.id, title: item.title, type: item.type, streamUrl } });
      return;
    }
    router.push(`/details/${item.id}`);
  }, [activeServer, liveChannels, pendingResult, router]);

  return (
    <View style={styles.screen}>
      <ParentalGate visible={pendingResult !== null} onAuthorized={openAuthorizedResult} onClose={() => setPendingResult(null)} />
      <PremiumBackdrop height={320} />
      <View style={[styles.header, wideStyle, { paddingTop: insets.top + (tvMode ? 28 : 12) }]}>
        <TVFocusable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} focusStyle={premium.backFocused} style={premium.backButton}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TVFocusable>
        <View style={styles.search}><SearchField value={query} onChangeText={setQuery} placeholder="Buscar canais, filmes e séries" /></View>
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => `${item.type}:${item.id}`}
        initialNumToRender={20}
        maxToRenderPerBatch={25}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, wideStyle, { paddingBottom: insets.bottom + 40 }]}
        onEndReached={loadMore}
        onEndReachedThreshold={0.45}
        renderItem={({ item }) => <TVFocusable accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.subtitle}`} onPress={() => openResult(item)} focusStyle={premium.rowFocused} style={({ pressed }) => [styles.result, pressed && premium.rowPressed]}><View style={styles.thumb}>{item.image ? <Image source={{ uri: item.image }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <Ionicons name="image-outline" size={20} color={Colors.subtle} />}</View><View style={styles.copy}><AppText numberOfLines={1} style={styles.title}>{item.title}</AppText><AppText numberOfLines={1} style={styles.subtitle}>{item.subtitle}</AppText></View><Ionicons name="chevron-forward" size={18} color={Colors.subtle} /></TVFocusable>}
        ListFooterComponent={loading && results.length > 0 ? <ActivityIndicator color={Colors.blueBright} style={styles.loader} /> : null}
        ListEmptyComponent={<View style={styles.empty}>{loading ? <ActivityIndicator color={Colors.blueBright} /> : <Ionicons name={searchError ? "warning-outline" : "search-outline"} size={30} color={searchError ? Colors.amber : Colors.subtle} />}<AppText style={styles.emptyTitle}>{query.trim().length < 2 ? "Digite pelo menos dois caracteres" : loading ? "Pesquisando no catálogo..." : searchError ?? "Nenhum resultado encontrado"}</AppText></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingBottom: 14 },
  search: { flex: 1 },
  content: { gap: 8, paddingHorizontal: 18, paddingBottom: 40 },
  result: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, padding: 9, borderRadius: 16, borderWidth: 1, borderColor: "rgba(190,222,255,0.10)", backgroundColor: "rgba(13,20,34,0.72)" },
  thumb: { width: 54, height: 54, overflow: "hidden", alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: Colors.backgroundRaised },
  copy: { flex: 1, gap: 5 },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  subtitle: { fontSize: 11, color: Colors.muted },
  empty: { alignItems: "center", gap: 10, paddingTop: 80 },
  emptyTitle: { fontSize: 13, color: Colors.muted },
  loader: { paddingVertical: 18 },
});
