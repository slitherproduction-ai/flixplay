import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Colors, Type } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useSyncStatus } from "@/hooks/useXtreamSync";
import { AppText, Chip, EmptyState, PosterCard, SearchField, SectionHeader } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";

function seasonsMeta(count: number, genre: string): string {
  return `${count} temporada${count !== 1 ? "s" : ""} · ${genre}`;
}

export default function SeriesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tvMode = useTVMode();
  const [genre, setGenre] = useState("Todas");
  const [query, setQuery] = useState("");
  const cardWidth = tvMode || width > 720 ? 220 : Math.max(138, (width - 58) / 2);

  const seriesList = useAppStore((state) => state.contentCache.seriesList);
  const cachedCategories = useAppStore((state) => state.contentCache.seriesCategories);
  const { isSyncing, syncError, syncProgress, refresh } = useSyncStatus();

  const genres = useMemo(
    () => ["Todas", ...cachedCategories.map((c) => c.name)],
    [cachedCategories],
  );

  const filteredSeries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return seriesList.filter((item) => {
      const matchGenre = genre === "Todas" || item.genre.toLowerCase().includes(genre.toLowerCase());
      const matchQ = !q || `${item.title} ${item.genre}`.toLowerCase().includes(q);
      return matchGenre && matchQ;
    });
  }, [seriesList, genre, query]);

  const handleSeries = useCallback((id: string) => {
    router.push(`/details/${id}`);
  }, [router]);

  const isEmpty = !isSyncing && seriesList.length === 0;

  return (
    <View style={styles.screen}>
      <View style={styles.ambient} />

      {isSyncing ? (
        <View style={styles.syncBanner}>
          <ActivityIndicator size="small" color={Colors.red} />
          <AppText style={styles.syncText}>{syncProgress ?? "Carregando séries..."}</AppText>
        </View>
      ) : null}

      {syncError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={15} color="#FF8B91" />
          <AppText style={styles.errorBannerText} numberOfLines={2}>{syncError}</AppText>
          <TVFocusable onPress={refresh} style={styles.retryBtn} accessibilityLabel="Tentar novamente">
            <AppText style={styles.retryText}>Tentar</AppText>
          </TVFocusable>
        </View>
      ) : null}

      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, tvMode && styles.tvContent]}>
        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <AppText style={styles.kicker}>TEMPORADAS COMPLETAS</AppText>
            <AppText style={Type.display}>Séries</AppText>
            <AppText style={styles.subtitle}>Novos episódios, grandes universos</AppText>
          </View>
          <TVFocusable onPress={refresh} style={styles.libraryIcon} accessibilityLabel="Atualizar catálogo de séries">
            <Ionicons name="refresh" size={22} color={Colors.red} />
          </TVFocusable>
        </View>

        <SearchField value={query} onChangeText={setQuery} placeholder="Buscar por título ou ator" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroller} contentContainerStyle={styles.genreContent}>
          {genres.map((item, index) => (
            <Chip key={item} label={item} selected={genre === item} hasTVPreferredFocus={index === 0} onPress={() => setGenre(item)} />
          ))}
        </ScrollView>

        <SectionHeader title="Séries para maratonar" subtitle={`${filteredSeries.length} resultados`} />

        {isEmpty ? (
          <View style={styles.empty}>
            <Ionicons name="albums-outline" size={32} color={Colors.subtle} />
            <AppText style={styles.emptyTitle}>Nenhuma série disponível</AppText>
            <AppText style={styles.emptyBody}>Toque em Atualizar para baixar o catálogo do servidor.</AppText>
            <TVFocusable onPress={refresh} style={styles.syncBtn} accessibilityLabel="Sincronizar séries">
              <Ionicons name="refresh" size={15} color={Colors.white} />
              <AppText style={styles.syncBtnText}>Sincronizar agora</AppText>
            </TVFocusable>
          </View>
        ) : filteredSeries.length > 0 ? (
          <View style={styles.grid}>
            {filteredSeries.map((item) => (
              <PosterCard key={item.id} title={item.title} image={item.poster} meta={seasonsMeta(item.seasonsCount, item.genre)} rating={item.rating} width={cardWidth} onPress={() => handleSeries(item.id)} />
            ))}
          </View>
        ) : (
          <EmptyState title="Nenhuma série encontrada" body="Tente buscar por outro título ou selecione Todas para explorar o catálogo." />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  ambient: { position: "absolute", right: -100, top: -110, width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(229, 9, 20, 0.06)" },
  content: { gap: 19, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40 },
  tvContent: { gap: 27, paddingHorizontal: 46, paddingTop: 30, paddingBottom: 54 },
  syncBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "rgba(229,9,20,0.1)", borderBottomWidth: 1, borderBottomColor: "rgba(229,9,20,0.2)" },
  syncText: { fontSize: 12, color: Colors.red, flex: 1 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "rgba(229,9,20,0.1)", borderBottomWidth: 1, borderBottomColor: "rgba(229,9,20,0.2)" },
  errorBannerText: { fontSize: 12, color: "#FF8B91", flex: 1 },
  retryBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "rgba(229,9,20,0.18)" },
  retryText: { fontSize: 12, color: "#FF8B91", fontFamily: "Inter_600SemiBold" },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  headingCopy: { flex: 1, gap: 4 },
  kicker: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 1.2, color: Colors.red },
  subtitle: { fontSize: 13, color: Colors.muted },
  libraryIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  genreScroller: { flexGrow: 0, marginHorizontal: -20 },
  genreContent: { gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: 12, rowGap: 24 },
  empty: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 44, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.text },
  emptyBody: { fontSize: 13, color: Colors.muted, textAlign: "center", maxWidth: 280 },
  syncBtn: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 4, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.red },
  syncBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.white },
});
