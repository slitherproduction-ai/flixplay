import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { type ComponentProps, memo, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Colors } from "@/constants/theme";
import { BRAND } from "@/constants/brand";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import type { TmdbMetadata } from "@/services/tmdb";
import type { EpisodeItem, PlayHistory, SeriesItem, VodMovie } from "@/store/types";

// ---------------------------------------------------------------------------
// Detalhes em TV no formato do ELVANOQ Play para Roku (DetailView):
//   fundo com a arte larga, pôster emoldurado à direita, rótulo, título,
//   data e avaliação, gêneros em destaque, sinopse, ações (Assistir, Minha
//   Lista, Trailer), linha de status, temporadas/episódios do servidor e
//   "Mais como este".
//
// Regras do TMDB (iguais ao Roku):
//   • título, sinopse, data, avaliação e até 4 gêneros vêm do TMDB quando há
//     correspondência; pôster w780 e fundo w1280 substituem a arte da lista;
//   • trailer só aparece com endereço HTTPS;
//   • séries Xtream usam temporadas e episódios do servidor, nunca do TMDB;
//   • recomendações do TMDB são cruzadas com a lista — só aparece o que o
//     usuário pode assistir.
// ---------------------------------------------------------------------------

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type TvDetailsProps = {
  movie?: VodMovie;
  show?: SeriesItem;
  tmdb: TmdbMetadata | null;
  tmdbLoading: boolean;
  fallbackSynopsis: string | null;
  synopsisLoading: boolean;
  season: number;
  seasonsCount: number;
  episodes: EpisodeItem[];
  episodesLoading: boolean;
  episodesError: string | null;
  history: PlayHistory[];
  canResume: boolean;
  isFavorite: boolean;
  isBlocked: boolean;
  recommendations: (VodMovie | SeriesItem)[];
  recommendationsFromTmdb: boolean;
  onPlay: (episodeId?: string) => void;
  onFavorite: () => void;
  onToggleBlocked: () => void;
  onSeasonChange: (season: number) => void;
  onOpenTitle: (id: string) => void;
};

function formatReleaseDate(value?: string | null): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function DetailAction({
  variant,
  icon,
  label,
  accessibilityLabel,
  preferred = false,
  onPress,
}: {
  variant: "primary" | "glass" | "icon";
  icon: IoniconName;
  label?: string;
  accessibilityLabel: string;
  preferred?: boolean;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const inverted = variant === "primary" || focused;
  const color = inverted ? Colors.background : Colors.text;
  return (
    <TVFocusable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hasTVPreferredFocus={preferred}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      focusStyle={styles.actionFocused}
      style={[
        styles.action,
        variant === "primary" && styles.actionPrimary,
        variant !== "primary" && styles.actionGlass,
        variant === "icon" && styles.actionIcon,
      ]}
    >
      <Ionicons name={icon} size={variant === "icon" ? 16 : 15} color={color} />
      {label ? <AppText style={[styles.actionText, { color }]}>{label}</AppText> : null}
    </TVFocusable>
  );
}

const EpisodeCard = memo(function EpisodeCard({
  episode,
  progress,
  fallbackImage,
  onPlay,
}: {
  episode: EpisodeItem;
  progress: number;
  fallbackImage: string;
  onPlay: (id: string) => void;
}) {
  return (
    <TVFocusable
      accessibilityRole="button"
      accessibilityLabel={`Episódio ${episode.episodeNumber}: ${episode.title}`}
      onPress={() => onPlay(episode.id)}
      focusStyle={styles.cardFocused}
      style={styles.episodeCard}
    >
      <View style={styles.episodeImage}>
        <Image source={{ uri: episode.thumbnail || fallbackImage }} contentFit="cover" transition={160} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["rgba(7,11,20,0)", "rgba(7,11,20,0.7)"]} locations={[0.5, 1]} style={StyleSheet.absoluteFill} />
        {episode.duration ? <AppText style={styles.episodeDuration}>{episode.duration}</AppText> : null}
        {progress > 0 ? (
          <View style={styles.episodeTrack}><View style={[styles.episodeFill, { width: `${progress}%` }]} /></View>
        ) : null}
      </View>
      <AppText style={styles.episodeNumber}>EPISÓDIO {episode.episodeNumber}</AppText>
      <AppText numberOfLines={2} style={styles.episodeTitle}>{episode.title || "Episódio"}</AppText>
    </TVFocusable>
  );
});

export function TvDetailsContent({
  movie,
  show,
  tmdb,
  tmdbLoading,
  fallbackSynopsis,
  synopsisLoading,
  season,
  seasonsCount,
  episodes,
  episodesLoading,
  episodesError,
  history,
  canResume,
  isFavorite,
  isBlocked,
  recommendations,
  recommendationsFromTmdb,
  onPlay,
  onFavorite,
  onToggleBlocked,
  onSeasonChange,
  onOpenTitle,
}: TvDetailsProps) {
  const { width, height } = useWindowDimensions();
  const item = movie ?? show;
  const [status, setStatus] = useState("");
  const confident = Boolean(tmdb?.confidentMatch);

  const title = (confident && tmdb?.title) || item?.title || "Conteúdo";
  const poster = (confident && tmdb?.posterUrl) || item?.poster || "";
  const backdrop = (confident && tmdb?.backdropUrl) || item?.backdrop || item?.poster || "";
  const serverPlot = (item?.plot ?? "").trim();
  const hasServerPlot = serverPlot.length > 30 && serverPlot.toLowerCase() !== "n/a";
  const synopsis = tmdb?.synopsis ?? (hasServerPlot ? serverPlot : fallbackSynopsis);
  const rating = tmdb?.rating ?? item?.rating ?? 0;
  const genres = tmdb?.genres.length ? tmdb.genres : (item?.genre ? [item.genre] : []);
  const releaseDate = formatReleaseDate(tmdb?.releaseDate);
  const year = item?.year ?? 0;

  const metaParts = [
    releaseDate || (year > 0 ? String(year) : ""),
    movie?.duration ?? (seasonsCount > 0 ? `${seasonsCount} temporada${seasonsCount !== 1 ? "s" : ""}` : ""),
  ].filter(Boolean);

  // Como no Roku, a disponibilidade do trailer é anunciada na linha de status.
  useEffect(() => {
    if (show && episodesLoading) setStatus("Carregando temporadas…");
    else if (tmdb?.trailerUrl) setStatus("Trailer oficial disponível.");
    else setStatus("");
  }, [episodesLoading, show, tmdb?.trailerUrl]);

  const progressById = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of history) {
      if (entry.durationMs > 0) map.set(entry.contentId, Math.min(100, Math.round((entry.positionMs / entry.durationMs) * 100)));
    }
    return map;
  }, [history]);

  const playLabel = canResume ? "Continuar" : show ? "Assistir" : "Assistir agora";
  const posterWidth = Math.round(Math.min(190, width * 0.19));
  const posterHeight = Math.round(posterWidth * 1.5);
  const heroHeight = Math.max(330, Math.round(height * 0.66));

  const handleFavorite = () => {
    onFavorite();
    setStatus(isFavorite ? "Removido da Minha Lista." : "Adicionado à Minha Lista.");
  };
  const handleTrailer = () => {
    if (tmdb?.trailerUrl?.startsWith("https://")) void WebBrowser.openBrowserAsync(tmdb.trailerUrl);
  };

  return (
    <View style={styles.screen}>
      <Image source={{ uri: backdrop }} contentFit="cover" transition={500} style={[StyleSheet.absoluteFill, styles.backdrop]} />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(7,11,20,0.96)", "rgba(7,11,20,0.78)", "rgba(7,11,20,0.25)", "rgba(7,11,20,0.45)"]}
        locations={[0, 0.42, 0.72, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(7,11,20,0.75)", "rgba(7,11,20,0)", "rgba(7,11,20,0.55)", BRAND.colors.background]}
        locations={[0, 0.22, 0.6, 0.92]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { minHeight: heroHeight }]}>
          <View style={[styles.copy, { marginRight: posterWidth + 48 }]}>
            <View style={styles.eyebrowRow}>
              <AppText style={styles.eyebrow}>DETALHES</AppText>
              <View style={styles.eyebrowDot} />
              <AppText style={styles.eyebrowKind}>{show ? "SÉRIE" : "FILME"}</AppText>
            </View>
            <AppText numberOfLines={2} style={styles.title}>{title}</AppText>
            <View style={styles.metaRow}>
              {rating > 0 ? (
                <View style={styles.ratingPill}>
                  <Ionicons name="star" size={10} color={Colors.amber} />
                  <AppText style={styles.ratingText}>Avaliação {rating.toFixed(1)}</AppText>
                </View>
              ) : null}
              {movie?.quality ? <View style={styles.qualityPill}><AppText style={styles.qualityText}>{movie.quality}</AppText></View> : null}
              <AppText numberOfLines={1} style={styles.meta}>{metaParts.join("   •   ")}</AppText>
            </View>
            {genres.length ? <AppText numberOfLines={1} style={styles.genres}>{genres.join("  •  ")}</AppText> : null}
            {synopsis ? (
              <AppText numberOfLines={4} style={styles.overview}>{synopsis}</AppText>
            ) : synopsisLoading || tmdbLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={Colors.subtle} />
                <AppText style={styles.loadingText}>Buscando informações…</AppText>
              </View>
            ) : (
              <AppText style={styles.overviewMissing}>Sinopse não disponível.</AppText>
            )}
            {tmdb?.cast.length ? (
              <AppText numberOfLines={1} style={styles.cast}>
                <AppText style={styles.castLabel}>Com  </AppText>
                {tmdb.cast.slice(0, 5).map((person) => person.name).join(", ")}
              </AppText>
            ) : null}

            <View style={styles.actions}>
              <DetailAction variant="primary" icon="play" label={playLabel} accessibilityLabel={`${playLabel}: ${title}`} preferred onPress={() => onPlay()} />
              <DetailAction
                variant="glass"
                icon={isFavorite ? "checkmark" : "add"}
                label={isFavorite ? "Na Minha Lista" : "Minha Lista"}
                accessibilityLabel={isFavorite ? "Remover da Minha Lista" : "Adicionar à Minha Lista"}
                onPress={handleFavorite}
              />
              {tmdb?.trailerUrl ? (
                <DetailAction variant="glass" icon="film-outline" label="Trailer" accessibilityLabel={`Trailer de ${title}`} onPress={handleTrailer} />
              ) : null}
              <DetailAction
                variant="icon"
                icon={isBlocked ? "lock-closed" : "lock-open-outline"}
                accessibilityLabel={isBlocked ? "Remover bloqueio parental" : "Bloquear conteúdo"}
                onPress={onToggleBlocked}
              />
            </View>
            <AppText numberOfLines={1} style={styles.status}>{isBlocked && !status ? "Conteúdo protegido pelo PIN parental." : status}</AppText>
          </View>

          <View style={[styles.posterFrame, { width: posterWidth + 8, height: posterHeight + 8 }]}>
            <Image source={{ uri: poster }} contentFit="cover" transition={400} style={styles.posterImage} />
          </View>
        </View>

        {show ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText style={styles.sectionTitle}>Temporadas</AppText>
              <AppText style={styles.sectionHint}>
                {episodes.length > 0 ? `Temporada ${season}   •   ${episodes.length} episódio${episodes.length !== 1 ? "s" : ""}` : ""}
              </AppText>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonRow}>
              {Array.from({ length: Math.max(1, seasonsCount) }, (_, index) => index + 1).map((number) => {
                const selected = number === season;
                return (
                  <TVFocusable
                    key={number}
                    accessibilityRole="button"
                    accessibilityLabel={`Temporada ${number}`}
                    accessibilityState={{ selected }}
                    onPress={() => onSeasonChange(number)}
                    focusStyle={styles.seasonFocused}
                    style={[styles.seasonChip, selected && styles.seasonChipSelected]}
                  >
                    <AppText style={[styles.seasonText, selected && styles.seasonTextSelected]}>Temporada {number}</AppText>
                  </TVFocusable>
                );
              })}
            </ScrollView>
            {episodesLoading ? (
              <View style={styles.loadingRow}><ActivityIndicator size="small" color={Colors.blueBright} /><AppText style={styles.loadingText}>Carregando episódios…</AppText></View>
            ) : episodesError ? (
              <AppText style={styles.errorText}>{episodesError}</AppText>
            ) : episodes.length === 0 ? (
              <AppText style={styles.loadingText}>Nenhum episódio disponível nesta temporada.</AppText>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                {episodes.map((episode) => (
                  <EpisodeCard
                    key={episode.id}
                    episode={episode}
                    progress={progressById.get(episode.id) ?? 0}
                    fallbackImage={item?.backdrop || item?.poster || ""}
                    onPlay={onPlay}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        {recommendations.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText style={styles.sectionTitle}>Mais como este</AppText>
              <AppText style={styles.sectionHint}>{recommendationsFromTmdb ? "Recomendações do TMDB disponíveis na sua lista" : "Da mesma categoria"}</AppText>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
              {recommendations.map((entry) => (
                <TVFocusable
                  key={entry.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir ${entry.title}`}
                  onPress={() => onOpenTitle(entry.id)}
                  focusStyle={styles.cardFocused}
                  style={styles.recommendation}
                >
                  <View style={styles.recommendationPoster}>
                    <Image source={{ uri: entry.poster }} contentFit="cover" transition={160} style={StyleSheet.absoluteFill} />
                  </View>
                  <AppText numberOfLines={1} style={styles.recommendationTitle}>{entry.title}</AppText>
                </TVFocusable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {tmdb ? (
          <View style={styles.source}>
            <Ionicons name="film-outline" size={10} color={Colors.subtle} />
            <AppText style={styles.sourceText}>Informações via TMDB</AppText>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  backdrop: { opacity: 0.6 },
  content: { paddingBottom: 40 },
  hero: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 32, paddingTop: 34 },
  copy: { flex: 1, gap: 8 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  eyebrow: { fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 1.6, color: Colors.blueBright },
  eyebrowDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.subtle },
  eyebrowKind: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 1.4, color: Colors.muted },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, lineHeight: 33, letterSpacing: -0.9, color: Colors.text, textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 10 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, backgroundColor: "rgba(245,184,61,0.16)" },
  ratingText: { fontFamily: "Inter_700Bold", fontSize: 10, color: Colors.amber },
  qualityPill: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: "rgba(244,248,255,0.5)" },
  qualityText: { fontFamily: "Inter_700Bold", fontSize: 9, color: Colors.text },
  meta: { flexShrink: 1, fontFamily: "Inter_500Medium", fontSize: 10, color: "#B6C2D6" },
  genres: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.blueBright },
  overview: { maxWidth: 560, fontSize: 12, lineHeight: 18, color: "#D6DEEB" },
  overviewMissing: { fontSize: 12, color: Colors.muted },
  cast: { maxWidth: 560, fontSize: 10, color: Colors.muted },
  castLabel: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.text },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  loadingText: { fontSize: 11, color: Colors.muted },
  errorText: { fontSize: 11, color: "#FF8B91" },
  actions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  action: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 16, borderRadius: 9 },
  actionPrimary: { backgroundColor: BRAND.colors.textPrimary },
  actionGlass: { borderWidth: 1, borderColor: "rgba(244,248,255,0.22)", backgroundColor: "rgba(17,27,45,0.82)" },
  actionIcon: { width: 36, paddingHorizontal: 0, borderRadius: 18 },
  actionFocused: { backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.blueBright, transform: [{ scale: 1.05 }] },
  actionText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  status: { minHeight: 16, fontSize: 10, color: Colors.blueBright },
  posterFrame: { padding: 4, borderRadius: 14, borderWidth: 1, borderColor: "rgba(244,248,255,0.16)", backgroundColor: "rgba(17,27,45,0.9)", shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  posterImage: { flex: 1, borderRadius: 10, backgroundColor: Colors.backgroundRaised },
  section: { gap: 10, marginTop: 6, marginBottom: 14, paddingHorizontal: 32 },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", gap: 12 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  sectionHint: { fontSize: 10, color: Colors.muted },
  seasonRow: { gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  seasonChip: { minHeight: 30, justifyContent: "center", paddingHorizontal: 14, borderRadius: 15, borderWidth: 1, borderColor: "rgba(190,222,255,0.16)", backgroundColor: "rgba(17,27,45,0.78)" },
  seasonChipSelected: { borderColor: "rgba(0,215,255,0.55)", backgroundColor: "rgba(0,215,255,0.12)" },
  seasonFocused: { backgroundColor: BRAND.colors.primary, borderWidth: 2, borderColor: Colors.blueBright, transform: [{ scale: 1.04 }] },
  seasonText: { fontFamily: "Inter_500Medium", fontSize: 11, color: "#C9D3E3" },
  seasonTextSelected: { fontFamily: "Inter_600SemiBold", color: Colors.white },
  cardRow: { gap: 12, paddingVertical: 6, paddingHorizontal: 2 },
  cardFocused: { borderWidth: 2, borderColor: Colors.blueBright, transform: [{ scale: 1.05 }] },
  episodeCard: { width: 156, borderRadius: 10, borderWidth: 1, borderColor: "transparent" },
  episodeImage: { aspectRatio: 16 / 9, overflow: "hidden", borderRadius: 9, backgroundColor: Colors.backgroundRaised },
  episodeDuration: { position: "absolute", right: 6, bottom: 6, fontFamily: "Inter_600SemiBold", fontSize: 9, color: Colors.text },
  episodeTrack: { position: "absolute", right: 0, bottom: 0, left: 0, height: 3, backgroundColor: "rgba(255,255,255,0.2)" },
  episodeFill: { height: "100%", backgroundColor: Colors.blueBright },
  episodeNumber: { marginTop: 6, paddingHorizontal: 2, fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 0.8, color: Colors.blueBright },
  episodeTitle: { marginTop: 2, paddingHorizontal: 2, fontFamily: "Inter_500Medium", fontSize: 11, lineHeight: 14, color: Colors.text },
  recommendation: { width: 96, borderRadius: 9, borderWidth: 1, borderColor: "transparent" },
  recommendationPoster: { width: "100%", aspectRatio: 2 / 3, overflow: "hidden", borderRadius: 8, backgroundColor: Colors.backgroundRaised },
  recommendationTitle: { marginTop: 5, paddingHorizontal: 2, fontSize: 10, color: Colors.muted },
  source: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 32, marginTop: 4 },
  sourceText: { fontSize: 9, color: Colors.subtle },
});
