import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { movies } from "@/data/demo";
import { Colors, Type } from "@/constants/theme";
import { AppText, Chip, EmptyState, PosterCard, SearchField, ScreenState, SectionHeader } from "@/components/ui";
import { useScreenLoad } from "@/hooks/useScreenLoad";

const genres = ["Todos", "Ação", "Comédia", "Terror", "Ficção", "Drama"];
const sortOptions = ["Mais recentes", "Melhor avaliados", "A-Z"];

export default function MoviesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { loading, error, retry } = useScreenLoad("o catálogo de filmes");
  const [genre, setGenre] = useState("Todos");
  const [sort, setSort] = useState("Mais recentes");
  const [query, setQuery] = useState("");
  const cardWidth = width > 720 ? 190 : Math.max(138, (width - 58) / 2);

  const filteredMovies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return movies
      .filter((movie) => {
        const matchesGenre = genre === "Todos" || movie.genre.toLowerCase().includes(genre.toLowerCase());
        const matchesQuery = !normalizedQuery || `${movie.title} ${movie.genre}`.toLowerCase().includes(normalizedQuery);
        return matchesGenre && matchesQuery;
      })
      .sort((first, second) => {
        if (sort === "Melhor avaliados") return second.rating - first.rating;
        if (sort === "A-Z") return first.title.localeCompare(second.title);
        return second.year - first.year;
      });
  }, [genre, query, sort]);

  const handleMovie = useCallback((id: string) => {
    router.push(`/details/${id}`);
  }, [router]);

  return (
    <View style={styles.screen}>
      <View style={styles.ambient} />
      <ScreenState loading={loading} error={error} retry={retry}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.heading}>
            <View style={styles.headingCopy}>
              <AppText style={styles.kicker}>CATÁLOGO VOD</AppText>
              <AppText style={Type.display}>Filmes</AppText>
              <AppText style={styles.subtitle}>Histórias para cada momento</AppText>
            </View>
            <View style={styles.libraryIcon}><Ionicons name="film-outline" size={22} color={Colors.blueBright} /></View>
          </View>
          <SearchField value={query} onChangeText={setQuery} placeholder="Buscar por título ou gênero" />
          <View style={styles.filterBlock}>
            <AppText style={styles.filterLabel}>Gêneros</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroller} contentContainerStyle={styles.filterContent}>
              {genres.map((item) => <Chip key={item} label={item} selected={genre === item} onPress={() => setGenre(item)} />)}
            </ScrollView>
          </View>
          <View style={styles.sortRow}>
            <SectionHeader title={`${filteredMovies.length} títulos`} subtitle="Atualizados recentemente" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortScroller} contentContainerStyle={styles.sortContent}>
              {sortOptions.map((item) => <Chip key={item} label={item} selected={sort === item} onPress={() => setSort(item)} />)}
            </ScrollView>
          </View>
          {filteredMovies.length ? (
            <View style={styles.grid}>
              {filteredMovies.map((movie) => <PosterCard key={movie.id} title={movie.title} image={movie.poster} meta={`${movie.year} · ${movie.genre}`} rating={movie.rating} quality={movie.quality} width={cardWidth} onPress={() => handleMovie(movie.id)} />)}
            </View>
          ) : <EmptyState title="Nenhum filme encontrado" body="Experimente outro título ou limpe os filtros para ver todo o catálogo." />}
        </ScrollView>
      </ScreenState>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  ambient: { position: "absolute", top: -140, left: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(59, 130, 246, 0.07)" },
  content: { gap: 19, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40 },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  headingCopy: { flex: 1, gap: 4 },
  kicker: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 1.2, color: Colors.blueBright },
  subtitle: { fontSize: 13, color: Colors.muted },
  libraryIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  filterBlock: { gap: 8 },
  filterLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.muted },
  filterScroller: { flexGrow: 0, marginHorizontal: -20 },
  filterContent: { gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
  sortRow: { gap: 7 },
  sortScroller: { flexGrow: 0, marginHorizontal: -20 },
  sortContent: { gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: 12, rowGap: 24 },
});
