import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, IconButton, SearchField } from "@/components/ui";
import { TVFocusable } from "@/components/tv-focusable";
import { Colors, Radii } from "@/constants/theme";
import { useAppStore } from "@/store/useAppStore";

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  type: "live" | "movie" | "series";
  streamUrl?: string;
};

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export default function GlobalSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const channels = useAppStore((state) => state.contentCache.liveChannels);
  const movies = useAppStore((state) => state.contentCache.vodMovies);
  const series = useAppStore((state) => state.contentCache.seriesList);

  const results = useMemo(() => {
    const term = normalize(query.trim());
    if (term.length < 2) return [];
    const matches = (value: string) => normalize(value).includes(term);
    return [
      ...channels.filter((item) => matches(`${item.name} ${item.categoryName} ${item.currentEpg.title}`)).map<SearchResult>((item) => ({ id: item.id, title: item.name, subtitle: `TV ao vivo · ${item.categoryName}`, image: item.logo, type: "live", streamUrl: item.streamUrl })),
      ...movies.filter((item) => matches(`${item.title} ${item.genre} ${item.year || ""}`)).map<SearchResult>((item) => ({ id: item.id, title: item.title, subtitle: `Filme · ${item.genre}`, image: item.poster, type: "movie", streamUrl: item.streamUrl })),
      ...series.filter((item) => matches(`${item.title} ${item.genre} ${item.year || ""}`)).map<SearchResult>((item) => ({ id: item.id, title: item.title, subtitle: `Série · ${item.genre}`, image: item.poster, type: "series" })),
    ].slice(0, 250);
  }, [channels, movies, query, series]);

  const openResult = useCallback((item: SearchResult) => {
    if (item.type === "live" && item.streamUrl) {
      router.push({ pathname: "/player", params: { id: item.id, title: item.title, type: item.type, streamUrl: item.streamUrl } });
    } else {
      router.push(`/details/${item.id}`);
    }
  }, [router]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}><IconButton icon="chevron-back" label="Voltar" onPress={() => router.back()} /><View style={styles.search}><SearchField value={query} onChangeText={setQuery} placeholder="Buscar canais, filmes e séries" /></View></View>
      <FlatList
        data={results}
        keyExtractor={(item) => `${item.type}:${item.id}`}
        initialNumToRender={20}
        maxToRenderPerBatch={25}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        renderItem={({ item }) => <TVFocusable accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.subtitle}`} onPress={() => openResult(item)} style={styles.result}><View style={styles.thumb}>{item.image ? <Image source={{ uri: item.image }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <Ionicons name="image-outline" size={20} color={Colors.subtle} />}</View><View style={styles.copy}><AppText numberOfLines={1} style={styles.title}>{item.title}</AppText><AppText numberOfLines={1} style={styles.subtitle}>{item.subtitle}</AppText></View><Ionicons name="chevron-forward" size={18} color={Colors.subtle} /></TVFocusable>}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="search-outline" size={30} color={Colors.subtle} /><AppText style={styles.emptyTitle}>{query.trim().length < 2 ? "Digite pelo menos dois caracteres" : "Nenhum resultado encontrado"}</AppText></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 18 },
  search: { flex: 1 },
  content: { gap: 8, paddingHorizontal: 18, paddingBottom: 40 },
  result: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, padding: 9, borderRadius: Radii.medium, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  thumb: { width: 54, height: 54, overflow: "hidden", alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: Colors.backgroundRaised },
  copy: { flex: 1, gap: 5 },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  subtitle: { fontSize: 11, color: Colors.muted },
  empty: { alignItems: "center", gap: 10, paddingTop: 80 },
  emptyTitle: { fontSize: 13, color: Colors.muted },
});
