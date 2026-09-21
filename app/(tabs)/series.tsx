import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { series } from "@/data/demo";
import { Colors, Type } from "@/constants/theme";
import { useTVMode } from "@/hooks/use-tv-mode";
import { AppText, Chip, EmptyState, PosterCard, SearchField, ScreenState, SectionHeader } from "@/components/ui";
import { useScreenLoad } from "@/hooks/useScreenLoad";

const genres = ["Todas", "Drama", "Fantasia", "Mistério", "Comédia dramática"];

export default function SeriesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { loading, error, retry } = useScreenLoad("o catálogo de séries");
  const tvMode = useTVMode();
  const [genre, setGenre] = useState("Todas");
  const [query, setQuery] = useState("");
  const cardWidth = tvMode || width > 720 ? 220 : Math.max(138, (width - 58) / 2);

  const filteredSeries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return series.filter((item) => {
      const matchesGenre = genre === "Todas" || item.genre.toLowerCase().includes(genre.toLowerCase());
      const matchesQuery = !normalizedQuery || `${item.title} ${item.genre}`.toLowerCase().includes(normalizedQuery);
      return matchesGenre && matchesQuery;
    });
  }, [genre, query]);

  const handleSeries = useCallback((id: string) => {
    router.push(`/details/${id}`);
  }, [router]);

  return (
    <View style={styles.screen}>
      <View style={styles.ambient} />
      <ScreenState loading={loading} error={error} retry={retry}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, tvMode && styles.tvContent]}>
          <View style={styles.heading}>
            <View style={styles.headingCopy}>
              <AppText style={styles.kicker}>TEMPORADAS COMPLETAS</AppText>
              <AppText style={Type.display}>Séries</AppText>
              <AppText style={styles.subtitle}>Novos episódios, grandes universos</AppText>
            </View>
            <View style={styles.libraryIcon}><Ionicons name="albums-outline" size={22} color={Colors.blueBright} /></View>
          </View>
          <SearchField value={query} onChangeText={setQuery} placeholder="Buscar por título ou ator" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroller} contentContainerStyle={styles.genreContent}>
            {genres.map((item, index) => <Chip key={item} label={item} selected={genre === item} hasTVPreferredFocus={index === 0} onPress={() => setGenre(item)} />)}
          </ScrollView>
          <SectionHeader title="Séries para maratonar" subtitle={`${filteredSeries.length} resultados`} />
          {filteredSeries.length ? (
            <View style={styles.grid}>
              {filteredSeries.map((item) => <PosterCard key={item.id} title={item.title} image={item.poster} meta={`${item.seasonsCount} temporadas · ${item.genre}`} rating={item.rating} width={cardWidth} onPress={() => handleSeries(item.id)} />)}
            </View>
          ) : <EmptyState title="Nenhuma série encontrada" body="Tente buscar por outro título ou selecione Todas para explorar o catálogo." />}
          <View style={styles.traktBanner}>
            <View style={styles.traktMark}><Ionicons name="sync" size={18} color={Colors.white} /></View>
            <View style={styles.traktCopy}><AppText style={styles.traktTitle}>Seu progresso está sincronizado</AppText><AppText style={styles.traktBody}>Continue em qualquer tela com o Trakt.tv.</AppText></View>
            <Ionicons name="chevron-forward" size={17} color={Colors.subtle} />
          </View>
        </ScrollView>
      </ScreenState>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  ambient: { position: "absolute", right: -100, top: -110, width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(229, 9, 20, 0.06)" },
  content: { gap: 19, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40 },
  tvContent: { gap: 27, paddingHorizontal: 46, paddingTop: 30, paddingBottom: 54 },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  headingCopy: { flex: 1, gap: 4 },
  kicker: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 1.2, color: Colors.red },
  subtitle: { fontSize: 13, color: Colors.muted },
  libraryIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  genreScroller: { flexGrow: 0, marginHorizontal: -20 },
  genreContent: { gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: 12, rowGap: 24 },
  traktBanner: { flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: "rgba(229, 9, 20, 0.28)", backgroundColor: "rgba(229, 9, 20, 0.09)" },
  traktMark: { width: 35, height: 35, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: Colors.red },
  traktCopy: { flex: 1, gap: 3 },
  traktTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  traktBody: { fontSize: 11, color: Colors.muted },
});
