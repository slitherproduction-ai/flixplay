import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { type ComponentProps, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Radii } from "@/constants/theme";
import { BRAND } from "@/constants/brand";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText, ChannelLogo, HorizontalScroller, PosterCard, SectionHeader } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";
import { CatalogBackground } from "@/components/catalog-background";
import { ParentalGate } from "@/components/parental-gate";
import { EPG_HOME_PRELOAD_LIMIT, useEpgPreload } from "@/hooks/useEpgPreload";
import { useSyncStatus } from "@/hooks/useXtreamSync";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useAppStore } from "@/store/useAppStore";
import { isPlaybackBlocked } from "@/services/security/parentalPolicy";
import type { PlayHistory, SeriesItem, ServerProfile, VodMovie } from "@/store/types";

// ---------------------------------------------------------------------------
// Home em formato de hub, alinhada ao ELVANOQ Play para Roku (0.1.88):
//   1. Destaque largo com arte de ponta a ponta, rótulo editorial, título,
//      metadados, sinopse e as ações "Assistir agora" e "Minha Lista".
//   2. Blocos de navegação (TV ao Vivo, Filmes, Séries, Busca, Minha Lista,
//      Ajustes).
//   3. Fileira principal: Continuar assistindo → Seus favoritos → Novidades.
// O Android acrescenta acabamento que o SceneGraph não oferece: luz ambiente
// derivada da arte, transição suave entre destaques, progresso animado da
// rotação, blocos com contagem do catálogo e fileiras complementares.
// ---------------------------------------------------------------------------

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const FEATURED_HOME_STORAGE_KEY = "elvanoq_home_weekly_feature_v1";
const FEATURED_HOME_ROTATION_MS = 7 * 24 * 60 * 60 * 1000;
const FEATURED_RECENT_WINDOW_MS = 45 * 24 * 60 * 60 * 1000;
/** Mesmo intervalo do `heroTimer` do Roku. */
const HERO_BANNER_ROTATION_MS = 8_000;
const HERO_MAX_SLIDES = 3;
const PRIMARY_RAIL_LIMIT = 30;
const SECONDARY_RAIL_LIMIT = 12;
/** Quanto a luz ambiente se estende abaixo do destaque antes de sumir. */
const AMBIENT_TAIL = 420;

function computePosterWidth(tvMode: boolean, width: number, isTablet: boolean, isTabletLandscape: boolean): number {
  if (!tvMode && width <= 700) return 132;
  const visibleCards = tvMode
    ? (width >= 1500 ? 10 : width >= 1100 ? 8 : 7)
    : (isTabletLandscape ? 6 : isTablet ? 5 : width >= 1500 ? 7 : width >= 1100 ? 6 : 5);
  const horizontalPadding = tvMode ? 64 : isTablet ? 56 : 40;
  const gap = 12;
  return Math.floor((width - horizontalPadding - gap * (visibleCards - 1)) / visibleCards);
}

function seasonsMeta(count: number): string {
  if (count <= 0) return "Temporadas não informadas";
  return `${count} temporada${count !== 1 ? "s" : ""}`;
}

function yearMeta(year: number): string {
  return year > 0 ? String(year) : "Ano não informado";
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value.toLocaleString("pt-BR")} ${value === 1 ? singular : plural}`;
}

function remainingLabel(item: PlayHistory): string {
  const minutes = Math.max(1, Math.round((item.durationMs - item.positionMs) / 60_000));
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest > 0 ? `Faltam ${hours} h ${rest} min` : `Faltam ${hours} h`;
  }
  return `Faltam ${minutes} min`;
}

// ---------------------------------------------------------------------------
// Seleção do destaque (mesma prioridade do Roku)
// ---------------------------------------------------------------------------

type HeroContent = {
  id: string;
  type: "movie" | "series";
  title: string;
  poster: string;
  backdrop: string;
  rating: number;
  year: number;
  meta: string;
  genre: string;
  plot: string;
  quality?: VodMovie["quality"];
  streamUrl?: string;
};

type HeroLabel =
  | "DESTAQUE DA SEMANA"
  | "RECÉM-ADICIONADO"
  | "MAIS BEM AVALIADO"
  | "CONTINUE ASSISTINDO"
  | "DESTAQUE ELVANOQ";

const HERO_LABEL_ICONS: Record<HeroLabel, IoniconName> = {
  "DESTAQUE DA SEMANA": "sparkles",
  "RECÉM-ADICIONADO": "time-outline",
  "MAIS BEM AVALIADO": "star",
  "CONTINUE ASSISTINDO": "play-circle-outline",
  "DESTAQUE ELVANOQ": "diamond-outline",
};

type HeroSlide = {
  id: string;
  label: HeroLabel;
  icon: IoniconName;
  content: HeroContent;
};

function toHeroMovie(movie: VodMovie): HeroContent {
  return {
    id: movie.id,
    type: "movie",
    title: movie.title,
    poster: movie.poster,
    backdrop: movie.backdrop,
    rating: movie.rating,
    year: movie.year,
    meta: movie.duration,
    genre: movie.genre,
    plot: movie.plot,
    quality: movie.quality,
    streamUrl: movie.streamUrl,
  };
}

function toHeroSeries(series: SeriesItem): HeroContent {
  return {
    id: series.id,
    type: "series",
    title: series.title,
    poster: series.poster,
    backdrop: series.backdrop,
    rating: series.rating,
    year: series.year,
    meta: seasonsMeta(series.seasonsCount),
    genre: series.genre,
    plot: series.plot,
  };
}

function parseAddedAt(value?: string): number {
  if (!value) return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function weeklyFeaturedMovie(movies: VodMovie[], previousId?: string): VodMovie | null {
  if (movies.length === 0) return null;
  const now = Date.now();
  const recent = movies.filter((movie) => {
    const addedAt = parseAddedAt(movie.addedAt);
    return addedAt > 0 && now - addedAt <= FEATURED_RECENT_WINDOW_MS;
  });
  const ranked = (recent.length ? recent : movies)
    .slice()
    .sort((a, b) => b.rating - a.rating || parseAddedAt(b.addedAt) - parseAddedAt(a.addedAt) || b.year - a.year);
  return ranked.find((movie) => movie.id !== previousId) ?? ranked[0] ?? null;
}

function recentlyAddedMovie(movies: VodMovie[]): VodMovie | null {
  let best: VodMovie | null = null;
  let bestValue = 0;
  for (const movie of movies) {
    const value = parseAddedAt(movie.addedAt);
    if (value > bestValue) {
      best = movie;
      bestValue = value;
    }
  }
  return best;
}

function highestRated<T extends { rating: number }>(items: T[]): T | null {
  let best: T | null = null;
  for (const item of items) {
    if (item.rating > 0 && (!best || item.rating > best.rating)) best = item;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Conta (canto superior direito do destaque)
// ---------------------------------------------------------------------------

function AccountSummary({ profile, tvMode, onPress }: {
  profile?: ServerProfile;
  tvMode: boolean;
  onPress: () => void;
}) {
  const displayName = profile?.name.trim() || profile?.username.trim() || "Usuário";
  const expiry = profile?.expiryDate?.trim() || "Não informada";
  const initial = displayName.charAt(0).toLocaleUpperCase("pt-BR") || "U";

  return (
    <TVFocusable
      accessibilityRole="button"
      accessibilityLabel={`Conta ${displayName}. Expira em ${expiry}. Abrir ajustes`}
      onPress={onPress}
      focusable={!tvMode}
      style={[styles.accountSummary, tvMode && styles.tvAccountSummary]}
    >
      <LinearGradient colors={[BRAND.colors.primary, BRAND.colors.deepBlue]} style={[styles.accountAvatar, tvMode && styles.tvAccountAvatar]}>
        <AppText style={[styles.accountAvatarText, tvMode && styles.tvAccountAvatarText]}>{initial}</AppText>
      </LinearGradient>
      <View style={styles.accountCopy}>
        <AppText numberOfLines={1} style={[styles.accountName, tvMode && styles.tvAccountName]}>{displayName}</AppText>
        <AppText numberOfLines={1} style={[styles.accountExpiry, tvMode && styles.tvAccountExpiry]}>Expira em {expiry}</AppText>
      </View>
    </TVFocusable>
  );
}

// ---------------------------------------------------------------------------
// Ações do destaque
// ---------------------------------------------------------------------------

type HeroActionProps = {
  variant: "primary" | "glass" | "icon";
  icon: IoniconName;
  label?: string;
  accessibilityLabel: string;
  tvMode: boolean;
  preferred?: boolean;
  onPress: () => void;
  onFocusChange: (focused: boolean) => void;
};

function HeroAction({ variant, icon, label, accessibilityLabel, tvMode, preferred = false, onPress, onFocusChange }: HeroActionProps) {
  const [focused, setFocused] = useState(false);
  // Em TV, ações translúcidas ficam brancas ao receber foco (padrão tvOS);
  // por isso o conteúdo inverte de cor junto com a superfície.
  const inverted = variant === "primary" || focused;
  const contentColor = inverted ? Colors.background : Colors.text;

  return (
    <TVFocusable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hasTVPreferredFocus={preferred}
      onPress={onPress}
      onFocus={() => { setFocused(true); onFocusChange(true); }}
      onBlur={() => { setFocused(false); onFocusChange(false); }}
      focusStyle={variant === "primary" ? styles.heroActionPrimaryFocused : styles.heroActionGlassFocused}
      style={({ pressed }) => [
        styles.heroAction,
        tvMode && styles.tvHeroAction,
        variant === "primary" && styles.heroActionPrimary,
        variant === "glass" && styles.heroActionGlass,
        variant === "icon" && styles.heroActionIcon,
        variant === "icon" && tvMode && styles.tvHeroActionIcon,
        pressed && styles.heroActionPressed,
      ]}
    >
      <Ionicons name={icon} size={variant === "icon" ? 19 : 17} color={contentColor} />
      {label ? (
        <AppText style={[styles.heroActionText, tvMode && styles.tvHeroActionText, { color: contentColor }]}>{label}</AppText>
      ) : null}
    </TVFocusable>
  );
}

// ---------------------------------------------------------------------------
// Destaque
// ---------------------------------------------------------------------------

interface HeroBannerProps {
  slide: HeroSlide;
  slides: HeroSlide[];
  slideIndex: number;
  height: number;
  tvMode: boolean;
  wide: boolean;
  topInset: number;
  progress: Animated.Value;
  isFavorite: boolean;
  feedback: string | null;
  header: ReactNode;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onDetails: () => void;
  onActionFocusChange: (focused: boolean) => void;
  onSelectSlide: (index: number) => void;
}

function HeroBanner({
  slide,
  slides,
  slideIndex,
  height,
  tvMode,
  wide,
  topInset,
  progress,
  isFavorite,
  feedback,
  header,
  onPlay,
  onToggleFavorite,
  onDetails,
  onActionFocusChange,
  onSelectSlide,
}: HeroBannerProps) {
  const { content: hero, label: featureLabel, icon: featureIcon } = slide;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentShift = useRef(new Animated.Value(0)).current;
  const artScale = useRef(new Animated.Value(1)).current;
  const playLabel = hero.type === "series" ? "Ver episódios" : "Assistir agora";
  const artwork = hero.backdrop || hero.poster;

  // Troca de destaque: o texto entra com fade e leve subida, e a arte faz
  // uma aproximação lenta (Ken Burns) enquanto o slide está ativo.
  useEffect(() => {
    contentOpacity.setValue(0);
    contentShift.setValue(10);
    artScale.setValue(1);
    const enter = Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 1, duration: 380, delay: 90, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(contentShift, { toValue: 0, duration: 420, delay: 90, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    const drift = Animated.timing(artScale, { toValue: 1.06, duration: HERO_BANNER_ROTATION_MS + 2_000, easing: Easing.linear, useNativeDriver: true });
    enter.start();
    drift.start();
    return () => {
      enter.stop();
      drift.stop();
    };
  }, [artScale, contentOpacity, contentShift, slide.id]);

  const metaParts = [yearMeta(hero.year), hero.meta, hero.genre].filter((part) => part && part.trim().length > 0);

  return (
    <View style={[styles.heroStage, { height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: artScale }] }]}>
        <Image source={{ uri: artwork }} contentFit="cover" contentPosition="top" transition={650} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* Equivalentes refinados de hero_shade_top/left/bottom do Roku. */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(7,11,20,0.82)", "rgba(7,11,20,0.30)", "rgba(7,11,20,0)"]}
        locations={[0, 0.55, 1]}
        style={[styles.heroShadeTop, { height: Math.max(120, height * 0.34) }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={wide
          ? ["rgba(7,11,20,0.94)", "rgba(7,11,20,0.72)", "rgba(7,11,20,0.18)", "rgba(7,11,20,0)"]
          : ["rgba(7,11,20,0.55)", "rgba(7,11,20,0.12)", "rgba(7,11,20,0)"]}
        locations={wide ? [0, 0.34, 0.66, 0.86] : [0, 0.6, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        // Termina na cor do fundo; a luz ambiente começa exatamente aí.
        colors={["rgba(7,11,20,0)", "rgba(7,11,20,0.58)", "rgba(7,11,20,0.9)", BRAND.colors.background]}
        locations={[0.3, 0.62, 0.86, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.heroHeader, tvMode && styles.tvHeroHeader, { paddingTop: topInset + (tvMode ? 22 : 10) }]}>
        {header}
      </View>

      <Animated.View
        style={[
          styles.heroContent,
          wide && styles.wideHeroContent,
          tvMode && styles.tvHeroContent,
          { opacity: contentOpacity, transform: [{ translateY: contentShift }] },
        ]}
      >
        <View style={styles.heroEyebrow}>
          <Ionicons name={featureIcon} size={tvMode ? 11 : 12} color={Colors.blueBright} />
          <AppText style={[styles.heroEyebrowText, tvMode && styles.tvHeroEyebrowText]}>{featureLabel}</AppText>
        </View>
        <AppText numberOfLines={2} style={[styles.heroTitle, wide && styles.wideHeroTitle, tvMode && styles.tvHeroTitle]}>{hero.title}</AppText>
        <View style={styles.heroMeta}>
          {hero.rating > 0 ? (
            <View style={styles.heroRatingPill}>
              <Ionicons name="star" size={10} color={Colors.amber} />
              <AppText style={styles.heroRatingText}>{hero.rating.toFixed(1)}</AppText>
            </View>
          ) : null}
          {hero.quality ? (
            <View style={styles.heroQualityPill}>
              <AppText style={styles.heroQualityText}>{hero.quality}</AppText>
            </View>
          ) : null}
          <AppText numberOfLines={1} style={[styles.heroMetaText, tvMode && styles.tvHeroMetaText]}>
            {feedback ?? metaParts.join("   •   ")}
          </AppText>
        </View>
        {hero.plot ? (
          <AppText numberOfLines={tvMode || wide ? 3 : 2} style={[styles.heroDescription, wide && styles.wideHeroDescription, tvMode && styles.tvHeroDescription]}>
            {hero.plot}
          </AppText>
        ) : null}
        <View style={[styles.heroActions, tvMode && styles.tvHeroActions]}>
          <HeroAction variant="primary" icon="play" label={playLabel} accessibilityLabel={`${playLabel}: ${hero.title}`} tvMode={tvMode} onPress={onPlay} onFocusChange={onActionFocusChange} />
          <HeroAction
            variant="glass"
            icon={isFavorite ? "checkmark" : "add"}
            label={isFavorite ? "Na Minha Lista" : "Minha Lista"}
            accessibilityLabel={isFavorite ? `Remover ${hero.title} da Minha Lista` : `Adicionar ${hero.title} à Minha Lista`}
            tvMode={tvMode}
            onPress={onToggleFavorite}
            onFocusChange={onActionFocusChange}
          />
          <HeroAction variant="icon" icon="information-circle-outline" accessibilityLabel={`Detalhes de ${hero.title}`} tvMode={tvMode} onPress={onDetails} onFocusChange={onActionFocusChange} />
        </View>
      </Animated.View>

      {slides.length > 1 ? (
        <View style={[styles.heroPagination, wide && styles.wideHeroPagination, tvMode && styles.tvHeroPagination]}>
          {slides.map((item, index) => {
            const active = index === slideIndex;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Destaque ${index + 1} de ${slides.length}: ${item.content.title}`}
                accessibilityState={{ selected: active }}
                focusable={false}
                hitSlop={10}
                onPress={() => onSelectSlide(index)}
                style={[styles.heroSegment, active && styles.heroSegmentActive]}
              >
                {active ? (
                  <Animated.View style={[styles.heroSegmentFill, { transform: [{ scaleX: progress }] }]} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Blocos de navegação (substituem o menu no Roku)
// ---------------------------------------------------------------------------

type HomeTileDef = {
  key: "live" | "movies" | "series" | "search" | "list" | "settings";
  title: string;
  icon: IoniconName;
  href: Href;
};

const HOME_TILES: readonly HomeTileDef[] = [
  { key: "live", title: "TV ao Vivo", icon: "radio-outline", href: "/live" },
  { key: "movies", title: "Filmes", icon: "film-outline", href: "/movies" },
  { key: "series", title: "Séries", icon: "albums-outline", href: "/series" },
  { key: "search", title: "Busca", icon: "search-outline", href: "/search" },
  { key: "list", title: "Minha Lista", icon: "bookmark-outline", href: "/watch-later" },
  { key: "settings", title: "Ajustes", icon: "settings-outline", href: "/settings" },
];

function HomeTile({ tile, caption, width, height, tvMode, index, onPress }: {
  tile: HomeTileDef;
  caption: string;
  width: number;
  height: number;
  tvMode: boolean;
  index: number;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <TVFocusable
      accessibilityRole="button"
      accessibilityLabel={`${tile.title}. ${caption}`}
      focusId={`home-tile-${tile.key}`}
      focusScope="home-tiles"
      focusIndex={index}
      restoreFocus
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      focusStyle={styles.tileFocused}
      style={({ pressed }) => [styles.tile, tvMode && styles.tvTile, { width, height }, pressed && styles.tilePressed]}
    >
      {focused ? (
        <LinearGradient
          pointerEvents="none"
          colors={[BRAND.colors.primary, "#0F55C4", BRAND.colors.deepBlue]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.tileGradient]}
        />
      ) : null}
      <View style={[styles.tileIcon, tvMode && styles.tvTileIcon, focused && styles.tileIconFocused]}>
        <Ionicons name={tile.icon} size={tvMode ? 15 : 18} color={focused ? Colors.white : Colors.blueBright} />
      </View>
      <View style={styles.tileCopy}>
        <AppText numberOfLines={1} style={[styles.tileTitle, tvMode && styles.tvTileTitle]}>{tile.title}</AppText>
        <AppText numberOfLines={1} style={[styles.tileCaption, tvMode && styles.tvTileCaption, focused && styles.tileCaptionFocused]}>{caption}</AppText>
      </View>
    </TVFocusable>
  );
}

function EmptyHomeState({ onSync }: { onSync: () => void }) {
  return (
    <View style={styles.emptyHome}>
      <Ionicons name="cloud-download-outline" size={36} color={Colors.subtle} />
      <AppText style={styles.emptyHomeTitle}>Catálogo vazio</AppText>
      <AppText style={styles.emptyHomeBody}>
        Sua lista será exibida aqui assim que a sincronização for concluída.
      </AppText>
      <TVFocusable onPress={onSync} focusStyle={styles.heroActionPrimaryFocused} style={styles.syncBtn} accessibilityLabel="Sincronizar conteúdo">
        <Ionicons name="refresh" size={15} color={Colors.background} />
        <AppText style={styles.syncBtnText}>Sincronizar agora</AppText>
      </TVFocusable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

type PrimaryRail =
  | { kind: "continue"; title: string; subtitle: string; items: PlayHistory[] }
  | { kind: "titles"; title: string; subtitle: string; items: HeroContent[] };

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const tvMode = useTVMode();
  const { isTablet, isTabletLandscape } = useResponsiveLayout();
  const history = useAppStore((state) => state.history);
  const isContentBlocked = useAppStore((state) => state.isContentBlocked);
  const channels = useAppStore((state) => state.contentCache.liveChannels);
  const movies = useAppStore((state) => state.contentCache.vodMovies);
  const seriesList = useAppStore((state) => state.contentCache.seriesList);
  const favoriteMovieIds = useAppStore((state) => state.favoriteMovieIds);
  const favoriteSeriesIds = useAppStore((state) => state.favoriteSeriesIds);
  const toggleFavoriteMovie = useAppStore((state) => state.toggleFavoriteMovie);
  const toggleFavoriteSeries = useAppStore((state) => state.toggleFavoriteSeries);
  const activeServer = useAppStore((state) => state.servers.find((server) => server.id === state.activeServerId));
  const { isSyncing, syncProgress, refresh } = useSyncStatus();

  const [pendingHistoryItem, setPendingHistoryItem] = useState<PlayHistory | null>(null);
  const [weeklyFeatureId, setWeeklyFeatureId] = useState<string | null>(null);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [heroActionsFocused, setHeroActionsFocused] = useState(false);
  const [screenFocused, setScreenFocused] = useState(true);
  const [heroFeedback, setHeroFeedback] = useState<string | null>(null);
  const heroProgress = useRef(new Animated.Value(0)).current;

  // Como o `setActive` do Roku: a rotação só corre com a Home visível.
  useFocusEffect(useCallback(() => {
    setScreenFocused(true);
    return () => setScreenFocused(false);
  }, []));

  const wide = tvMode || isTabletLandscape || width >= 900;
  const posterWidth = computePosterWidth(tvMode, width, isTablet, isTabletLandscape);
  const sidePadding = tvMode ? 32 : isTablet ? 28 : 20;
  // Roku: 640 de 1080 linhas (≈59%). Em smartphone a arte larga é preservada
  // com uma proporção mais alta para manter título e ações sobre ela.
  const heroHeight = tvMode
    ? Math.round(Math.min(640, Math.max(380, height * 0.6)))
    : wide
      ? Math.round(Math.min(560, Math.max(380, height * 0.58)))
      : Math.round(Math.min(500, Math.max(400, width * 1.08)) + insets.top);
  const syncLabel = syncProgress ?? "Sincronizando conteúdo...";

  const rankedWeeklyMovie = useMemo(() => weeklyFeaturedMovie(movies), [movies]);

  // O destaque da semana permanece estável por sete dias e depois avança para
  // o próximo título elegível, evitando trocas a cada abertura do app.
  useEffect(() => {
    let active = true;
    const selectWeeklyFeature = async () => {
      try {
        const raw = await AsyncStorage.getItem(FEATURED_HOME_STORAGE_KEY);
        const stored = raw ? JSON.parse(raw) as { id?: string; selectedAt?: number } : null;
        const isCurrent = Boolean(stored?.id && stored.selectedAt && Date.now() - stored.selectedAt < FEATURED_HOME_ROTATION_MS && movies.some((movie) => movie.id === stored.id));
        if (isCurrent) {
          if (active) setWeeklyFeatureId(stored?.id ?? null);
          return;
        }
        const next = weeklyFeaturedMovie(movies, stored?.id);
        if (!next) {
          if (active) setWeeklyFeatureId(null);
          return;
        }
        await AsyncStorage.setItem(FEATURED_HOME_STORAGE_KEY, JSON.stringify({ id: next.id, selectedAt: Date.now() }));
        if (active) setWeeklyFeatureId(next.id);
      } catch {
        if (active) setWeeklyFeatureId(rankedWeeklyMovie?.id ?? null);
      }
    };
    void selectWeeklyFeature();
    return () => { active = false; };
  }, [movies, rankedWeeklyMovie?.id]);

  // Um episódio por série, do mais recente para o mais antigo.
  const dedupedHistory = useMemo(() => {
    const sorted = history
      .filter((h) =>
        h.type !== "live" &&
        h.durationMs > 0 &&
        h.positionMs >= 5000 &&
        h.positionMs / h.durationMs < 0.95,
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const seenSeriesIds = new Set<string>();
    return sorted.filter((item) => {
      if (item.type !== "episode") return true;
      const match = item.contentId.match(/^ep-(.+?)-s\d+-e\d+$/);
      if (!match) return true;
      const seriesKey = match[1];
      if (seenSeriesIds.has(seriesKey)) return false;
      seenSeriesIds.add(seriesKey);
      return true;
    });
  }, [history]);

  const movieById = useMemo(() => new Map(movies.map((movie) => [movie.id, movie])), [movies]);
  const seriesById = useMemo(() => new Map(seriesList.map((item) => [item.id, item])), [seriesList]);

  const favoriteTitles = useMemo<HeroContent[]>(() => [
    ...favoriteMovieIds.flatMap((id) => { const movie = movieById.get(id); return movie ? [toHeroMovie(movie)] : []; }),
    ...favoriteSeriesIds.flatMap((id) => { const item = seriesById.get(id); return item ? [toHeroSeries(item)] : []; }),
  ], [favoriteMovieIds, favoriteSeriesIds, movieById, seriesById]);

  // Filmes e séries do mais recente para o mais antigo (`recentTitles` do Roku).
  const recentTitles = useMemo<HeroContent[]>(() => {
    const entries = [
      ...movies.map((movie) => ({ added: parseAddedAt(movie.addedAt), content: toHeroMovie(movie) })),
      ...seriesList.map((item) => ({ added: 0, content: toHeroSeries(item) })),
    ];
    return entries
      .sort((a, b) => b.added - a.added)
      .slice(0, PRIMARY_RAIL_LIMIT)
      .map((entry) => entry.content);
  }, [movies, seriesList]);

  const heroSlides = useMemo(() => {
    const slides: HeroSlide[] = [];
    const push = (label: HeroLabel, content: HeroContent | null | undefined) => {
      if (!content || slides.length >= HERO_MAX_SLIDES) return;
      if (slides.some((existing) => existing.content.id === content.id)) return;
      slides.push({ id: `${label}-${content.id}`, label, icon: HERO_LABEL_ICONS[label], content });
    };
    const weekly = movies.find((movie) => movie.id === weeklyFeatureId) ?? rankedWeeklyMovie;
    const recent = recentlyAddedMovie(movies);
    const topMovie = highestRated(movies);
    const topSeries = highestRated(seriesList);
    const topRated = topSeries && (!topMovie || topSeries.rating > topMovie.rating) ? toHeroSeries(topSeries) : topMovie ? toHeroMovie(topMovie) : null;

    // Mesma ordem do Roku 0.1.88.
    push("DESTAQUE DA SEMANA", weekly ? toHeroMovie(weekly) : null);
    push("RECÉM-ADICIONADO", recent ? toHeroMovie(recent) : null);
    push("MAIS BEM AVALIADO", topRated);

    // Retornos para catálogos sem curadoria ou somente com séries.
    const lastWatched = dedupedHistory[0];
    if (lastWatched) {
      const movie = movieById.get(lastWatched.contentId);
      const series = lastWatched.seriesId ? seriesById.get(lastWatched.seriesId) : undefined;
      push("CONTINUE ASSISTINDO", movie ? toHeroMovie(movie) : series ? toHeroSeries(series) : null);
    }
    push("DESTAQUE ELVANOQ", recentTitles[0]);
    return slides;
  }, [dedupedHistory, movieById, movies, rankedWeeklyMovie, recentTitles, seriesById, seriesList, weeklyFeatureId]);

  const slideCount = heroSlides.length;
  useEffect(() => {
    setHeroSlideIndex((current) => Math.min(current, Math.max(0, slideCount - 1)));
  }, [slideCount]);

  // A barra do segmento ativo é o próprio relógio da rotação: pausar a
  // animação (foco nos botões, outra aba aberta) pausa também a troca, e a
  // retomada continua de onde parou.
  const rotationActive = slideCount > 1 && screenFocused && !heroActionsFocused;
  useEffect(() => {
    if (!rotationActive) return;
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;
    heroProgress.stopAnimation((value) => {
      if (cancelled) return;
      const remaining = Math.max(300, (1 - value) * HERO_BANNER_ROTATION_MS);
      animation = Animated.timing(heroProgress, { toValue: 1, duration: remaining, easing: Easing.linear, useNativeDriver: true });
      animation.start(({ finished }) => {
        if (!finished || cancelled) return;
        heroProgress.setValue(0);
        setHeroSlideIndex((current) => (current + 1) % slideCount);
      });
    });
    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [heroProgress, heroSlideIndex, rotationActive, slideCount]);

  const activeHeroSlide = heroSlides[heroSlideIndex] ?? heroSlides[0] ?? null;
  const hero = activeHeroSlide?.content ?? null;
  const heroIsFavorite = hero
    ? (hero.type === "movie" ? favoriteMovieIds.includes(hero.id) : favoriteSeriesIds.includes(hero.id))
    : false;

  useEffect(() => { setHeroFeedback(null); }, [hero?.id]);
  useEffect(() => {
    if (!heroFeedback) return;
    const timer = setTimeout(() => setHeroFeedback(null), 2_600);
    return () => clearTimeout(timer);
  }, [heroFeedback]);

  const handleSelectSlide = useCallback((index: number) => {
    heroProgress.setValue(0);
    setHeroSlideIndex(index);
  }, [heroProgress]);

  const handleHeroActionFocusChange = useCallback((focused: boolean) => {
    if (tvMode) setHeroActionsFocused(focused);
  }, [tvMode]);

  const handleOpenAccount = useCallback(() => { router.push("/settings"); }, [router]);
  const handleContinueWatchingAll = useCallback(() => { router.push("/continue-watching"); }, [router]);
  const handleWatchLaterAll = useCallback(() => { router.push("/watch-later"); }, [router]);
  const handleOpenLive = useCallback(() => { router.push("/live"); }, [router]);
  const handleOpenMovies = useCallback(() => { router.push("/movies"); }, [router]);
  const handleOpenSeries = useCallback(() => { router.push("/series"); }, [router]);
  const handleOpenSearch = useCallback(() => { router.push("/search"); }, [router]);
  const handleContent = useCallback((id: string) => { router.push(`/details/${id}`); }, [router]);

  const handleHeroDetails = useCallback(() => {
    if (hero) router.push(`/details/${hero.id}`);
  }, [hero, router]);
  const handleHeroPlay = useCallback(() => {
    if (!hero) return;
    if (hero.type === "movie" && hero.streamUrl) {
      router.push({ pathname: "/player", params: { id: hero.id, title: hero.title, type: "movie", streamUrl: hero.streamUrl } });
      return;
    }
    router.push(`/details/${hero.id}`);
  }, [hero, router]);
  const handleHeroFavorite = useCallback(() => {
    if (!hero) return;
    if (hero.type === "movie") toggleFavoriteMovie(hero.id);
    else toggleFavoriteSeries(hero.id);
    setHeroFeedback(heroIsFavorite ? "Removido da Minha Lista" : "Adicionado à Minha Lista");
  }, [hero, heroIsFavorite, toggleFavoriteMovie, toggleFavoriteSeries]);

  const handleLive = useCallback((channelId: string) => {
    const channel = channels.find((item) => item.id === channelId);
    if (!channel) return;
    router.push({ pathname: "/player", params: { id: channel.id, title: channel.name, type: "live", streamUrl: channel.streamUrl } });
  }, [channels, router]);

  const openHistoryItem = useCallback((item: PlayHistory) => {
    if (item.streamUrl) {
      router.push({
        pathname: "/player",
        params: {
          id: item.contentId,
          title: item.title,
          type: item.type,
          streamUrl: item.streamUrl,
          subtitle: item.subtitle,
          thumbnail: item.thumbnail,
          seriesId: item.seriesId,
        },
      });
      return;
    }
    router.push(`/details/${item.seriesId ?? item.contentId}`);
  }, [router]);

  const handleHistory = useCallback((item: PlayHistory) => {
    if (isPlaybackBlocked(item.contentId, item.seriesId, isContentBlocked)) {
      setPendingHistoryItem(item);
      return;
    }
    openHistoryItem(item);
  }, [isContentBlocked, openHistoryItem]);

  const openAuthorizedHistory = useCallback(() => {
    const item = pendingHistoryItem;
    setPendingHistoryItem(null);
    if (item) openHistoryItem(item);
  }, [openHistoryItem, pendingHistoryItem]);

  // Fileira principal com os mesmos retornos do Roku.
  const primaryRail = useMemo<PrimaryRail | null>(() => {
    if (dedupedHistory.length > 0) {
      return { kind: "continue", title: "Continuar assistindo", subtitle: "Retome de onde parou", items: dedupedHistory.slice(0, 12) };
    }
    if (favoriteTitles.length > 0) {
      return { kind: "titles", title: "Seus favoritos", subtitle: "Títulos salvos na Minha Lista", items: favoriteTitles.slice(0, PRIMARY_RAIL_LIMIT) };
    }
    if (recentTitles.length > 0) {
      return { kind: "titles", title: "Novidades para você", subtitle: "Filmes e séries adicionados recentemente", items: recentTitles };
    }
    return null;
  }, [dedupedHistory, favoriteTitles, recentTitles]);

  const recentLiveChannels = useMemo(() => {
    const byId = new Map(channels.map((channel) => [channel.id, channel]));
    const seen = new Set<string>();
    const result = [] as typeof channels;
    history
      .filter((item) => item.type === "live")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .forEach((item) => {
        if (seen.has(item.contentId)) return;
        const channel = byId.get(item.contentId);
        if (!channel) return;
        seen.add(item.contentId);
        result.push(channel);
      });
    return result.slice(0, SECONDARY_RAIL_LIMIT);
  }, [channels, history]);
  // No primeiro acesso não há histórico ao vivo: preserva a ordem do servidor.
  const featuredChannels = recentLiveChannels.length > 0 ? recentLiveChannels : channels.slice(0, SECONDARY_RAIL_LIMIT);
  const liveSubtitle = recentLiveChannels.length > 0 ? "Últimos canais assistidos" : "Programação ao vivo agora";
  useEpgPreload(channels, EPG_HOME_PRELOAD_LIMIT);

  const recentMovies = useMemo(
    () => recentTitles.filter((item) => item.type === "movie").slice(0, SECONDARY_RAIL_LIMIT),
    [recentTitles],
  );
  const topSeries = useMemo(
    () => seriesList.slice().sort((a, b) => b.rating - a.rating).slice(0, SECONDARY_RAIL_LIMIT),
    [seriesList],
  );
  const showFavoritesRail = favoriteTitles.length > 0 && primaryRail?.title !== "Seus favoritos";
  const showRecentMoviesRail = recentMovies.length > 0 && primaryRail?.title !== "Novidades para você";
  const showEmpty = !isSyncing && channels.length === 0 && movies.length === 0 && seriesList.length === 0;

  const favoritesCount = favoriteMovieIds.length + favoriteSeriesIds.length;
  const tileCaptions: Record<HomeTileDef["key"], string> = {
    live: channels.length > 0 ? formatCount(channels.length, "canal", "canais") : "Guia e canais",
    movies: movies.length > 0 ? formatCount(movies.length, "filme", "filmes") : "Catálogo de filmes",
    series: seriesList.length > 0 ? formatCount(seriesList.length, "série", "séries") : "Catálogo de séries",
    search: "Encontre títulos",
    list: favoritesCount > 0 ? formatCount(favoritesCount, "salvo", "salvos") : "Salve para depois",
    settings: "Conta e player",
  };

  // Os blocos substituem o menu lateral, como no Roku. No smartphone a barra
  // de abas inferior já cumpre esse papel, então eles não são exibidos.
  const showTiles = tvMode || wide;
  const tileColumns = 6;
  const tileGap = tvMode ? 11 : 10;
  const tileWidth = Math.floor((width - sidePadding * 2 - tileGap * (tileColumns - 1)) / tileColumns);
  const tileHeight = Math.round(tvMode ? Math.max(70, tileWidth * 0.54) : Math.max(84, tileWidth * 0.5));

  const ambientArt = hero ? hero.backdrop || hero.poster : undefined;

  const header = (
    <>
      <BrandLogo variant="wordmark" accessibilityLabel="ELVANOQ" style={[styles.wordmark, tvMode && styles.tvWordmark]} />
      <View style={styles.headerActions}>
        {/* Sem os blocos, a Busca precisa de um acesso próprio no smartphone. */}
        {showTiles ? null : (
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel="Buscar filmes, séries e canais"
            onPress={handleOpenSearch}
            style={({ pressed }) => [styles.headerIconButton, pressed && styles.heroActionPressed]}
          >
            <Ionicons name="search" size={18} color={Colors.text} />
          </TVFocusable>
        )}
        <AccountSummary profile={activeServer} tvMode={tvMode} onPress={handleOpenAccount} />
      </View>
    </>
  );

  return (
    <View style={styles.screen} testID="home-screen">
      <CatalogBackground />
      {/*
       * Luz ambiente: a arte do destaque, desfocada, acende atrás dos blocos.
       * Começa e termina na cor do fundo, sem emenda com o destaque. Fica
       * fixa enquanto a página rola, como um brilho de ambiente.
       */}
      {ambientArt ? (
        <View pointerEvents="none" style={[styles.ambient, { top: heroHeight, height: AMBIENT_TAIL }]}>
          <Image source={{ uri: ambientArt }} blurRadius={tvMode ? 24 : 32} contentFit="cover" transition={900} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={[BRAND.colors.background, "rgba(7,11,20,0.62)", BRAND.colors.background]}
            locations={[0, 0.38, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
      <ParentalGate visible={pendingHistoryItem !== null} onAuthorized={openAuthorizedHistory} onClose={() => setPendingHistoryItem(null)} />

      {isSyncing ? (
        <View style={[styles.syncBanner, { top: insets.top + (tvMode ? 14 : 62) }]}>
          <ActivityIndicator size="small" color={Colors.blueBright} />
          <AppText numberOfLines={1} style={styles.syncText}>{syncLabel}</AppText>
        </View>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, tvMode && styles.tvContent]}>
        {activeHeroSlide ? (
          <HeroBanner
            slide={activeHeroSlide}
            slides={heroSlides}
            slideIndex={heroSlideIndex}
            height={heroHeight}
            tvMode={tvMode}
            wide={wide}
            topInset={tvMode ? 0 : insets.top}
            progress={heroProgress}
            isFavorite={heroIsFavorite}
            feedback={heroFeedback}
            header={header}
            onPlay={handleHeroPlay}
            onToggleFavorite={handleHeroFavorite}
            onDetails={handleHeroDetails}
            onActionFocusChange={handleHeroActionFocusChange}
            onSelectSlide={handleSelectSlide}
          />
        ) : (
          <View style={[styles.plainHeader, { paddingTop: insets.top + (tvMode ? 22 : 10), paddingHorizontal: sidePadding }]}>{header}</View>
        )}

        {showTiles ? (
        <View style={[styles.tiles, { paddingHorizontal: sidePadding, gap: tileGap }, activeHeroSlide && (tvMode ? styles.tvTilesOverlap : styles.tilesOverlap)]}>
          {HOME_TILES.map((tile, index) => (
            <HomeTile
              key={tile.key}
              tile={tile}
              caption={tileCaptions[tile.key]}
              width={tileWidth}
              height={tileHeight}
              tvMode={tvMode}
              index={index}
              onPress={() => router.push(tile.href)}
            />
          ))}
        </View>
        ) : null}

        <View style={[styles.rails, { paddingHorizontal: sidePadding }, tvMode && styles.tvRails, !showTiles && activeHeroSlide && styles.railsAfterHero]}>
          {primaryRail?.kind === "continue" ? (
            <View>
              <SectionHeader title={primaryRail.title} subtitle={primaryRail.subtitle} onPress={handleContinueWatchingAll} />
              <HorizontalScroller>
                {primaryRail.items.map((item) => {
                  const progress = Math.min(100, Math.max(0, Math.round((item.positionMs / item.durationMs) * 100)));
                  return (
                    <TVFocusable
                      key={item.contentId}
                      accessibilityRole="button"
                      accessibilityLabel={`Continuar ${item.title}. ${remainingLabel(item)}`}
                      onPress={() => handleHistory(item)}
                      focusStyle={styles.cardFocused}
                      style={({ pressed }) => [styles.continueCard, tvMode && styles.tvContinueCard, pressed && styles.cardPressed]}
                    >
                      <View style={styles.continueImage}>
                        <Image source={{ uri: item.thumbnail }} contentFit="cover" transition={220} style={StyleSheet.absoluteFill} />
                        <LinearGradient colors={["rgba(7,11,20,0)", "rgba(7,11,20,0.82)"]} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
                        <View style={styles.continuePlay}><Ionicons name="play" size={13} color={Colors.background} /></View>
                        <AppText numberOfLines={1} style={styles.continueRemaining}>{remainingLabel(item)}</AppText>
                        <View style={styles.continueTrack}>
                          <View style={[styles.continueFill, { width: `${progress}%` }]} />
                        </View>
                      </View>
                      <AppText numberOfLines={1} style={styles.continueTitle}>{item.title}</AppText>
                      {item.subtitle ? <AppText numberOfLines={1} style={styles.continueSubtitle}>{item.subtitle}</AppText> : null}
                    </TVFocusable>
                  );
                })}
              </HorizontalScroller>
            </View>
          ) : null}

          {primaryRail?.kind === "titles" ? (
            <View>
              <SectionHeader
                title={primaryRail.title}
                subtitle={primaryRail.subtitle}
                onPress={primaryRail.title === "Seus favoritos" ? handleWatchLaterAll : handleOpenMovies}
              />
              <HorizontalScroller>
                {primaryRail.items.map((item) => (
                  <PosterCard
                    key={`${item.type}-${item.id}`}
                    title={item.title}
                    image={item.poster}
                    meta={`${yearMeta(item.year)} · ${item.type === "series" ? item.meta : item.genre}`}
                    rating={item.rating}
                    quality={item.quality}
                    width={posterWidth}
                    onPress={() => handleContent(item.id)}
                  />
                ))}
              </HorizontalScroller>
            </View>
          ) : null}

          {showFavoritesRail ? (
            <View>
              <SectionHeader title="Minha Lista" subtitle="Salvos para assistir mais tarde" onPress={handleWatchLaterAll} />
              <HorizontalScroller>
                {favoriteTitles.slice(0, SECONDARY_RAIL_LIMIT).map((item) => (
                  <PosterCard
                    key={`${item.type}-${item.id}`}
                    title={item.title}
                    image={item.poster}
                    meta={`${yearMeta(item.year)} · ${item.type === "series" ? item.meta : item.genre}`}
                    rating={item.rating}
                    quality={item.quality}
                    width={posterWidth}
                    onPress={() => handleContent(item.id)}
                  />
                ))}
              </HorizontalScroller>
            </View>
          ) : null}

          {featuredChannels.length > 0 ? (
            <View>
              <SectionHeader title="Canais ao vivo" subtitle={liveSubtitle} onPress={handleOpenLive} />
              <HorizontalScroller>
                {featuredChannels.map((channel) => (
                  <TVFocusable
                    key={channel.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Assistir ${channel.name}. Agora: ${channel.currentEpg.title}`}
                    onPress={() => handleLive(channel.id)}
                    focusStyle={styles.cardFocused}
                    style={({ pressed }) => [styles.channelCard, tvMode && styles.tvChannelCard, pressed && styles.cardPressed]}
                  >
                    <View style={styles.channelTop}>
                      <ChannelLogo image={channel.logo} name={channel.name} size={tvMode ? 40 : 46} />
                      <View style={styles.livePill}>
                        <View style={styles.liveDot} />
                        <AppText style={styles.livePillText}>AO VIVO</AppText>
                      </View>
                    </View>
                    <AppText numberOfLines={1} style={styles.channelName}>{channel.name}</AppText>
                    <AppText numberOfLines={1} style={styles.channelProgram}>{channel.currentEpg.title || "Programação indisponível"}</AppText>
                    <View style={styles.channelProgress}>
                      <LinearGradient
                        colors={[BRAND.colors.primary, BRAND.colors.accent]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={[styles.channelProgressFill, { width: `${Math.min(100, Math.max(0, channel.currentEpg.progress))}%` }]}
                      />
                    </View>
                  </TVFocusable>
                ))}
              </HorizontalScroller>
            </View>
          ) : null}

          {showRecentMoviesRail ? (
            <View>
              <SectionHeader title="Filmes adicionados recentemente" onPress={handleOpenMovies} />
              <HorizontalScroller>
                {recentMovies.map((movie) => (
                  <PosterCard key={movie.id} title={movie.title} image={movie.poster} meta={`${yearMeta(movie.year)} · ${movie.genre}`} rating={movie.rating} quality={movie.quality} width={posterWidth} onPress={() => handleContent(movie.id)} />
                ))}
              </HorizontalScroller>
            </View>
          ) : null}

          {topSeries.length > 0 ? (
            <View>
              <SectionHeader title="Séries mais bem avaliadas" onPress={handleOpenSeries} />
              <HorizontalScroller>
                {topSeries.map((item) => (
                  <PosterCard key={item.id} title={item.title} image={item.poster} meta={`${yearMeta(item.year)} · ${seasonsMeta(item.seasonsCount)}`} rating={item.rating} width={posterWidth} onPress={() => handleContent(item.id)} />
                ))}
              </HorizontalScroller>
            </View>
          ) : null}

          {showEmpty ? <EmptyHomeState onSync={refresh} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden", backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  tvContent: { paddingBottom: 56 },
  ambient: { position: "absolute", right: 0, left: 0, opacity: 0.85 },

  syncBanner: { position: "absolute", zIndex: 30, alignSelf: "center", maxWidth: 340, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radii.pill, borderWidth: 1, borderColor: "rgba(0,215,255,0.28)", backgroundColor: "rgba(7,16,30,0.9)" },
  syncText: { flexShrink: 1, fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.blueBright },

  // Cabeçalho sobre o destaque (marca à esquerda, conta à direita).
  plainHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 18 },
  heroHeader: { position: "absolute", top: 0, right: 0, left: 0, zIndex: 3, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  tvHeroHeader: { paddingHorizontal: 32 },
  wordmark: { width: 112, height: 34 },
  tvWordmark: { width: 105, height: 35 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: "rgba(244,248,255,0.16)", backgroundColor: "rgba(7,11,20,0.46)" },
  accountSummary: { maxWidth: 200, minHeight: 40, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 5, paddingRight: 12, paddingVertical: 4, borderRadius: Radii.pill, borderWidth: 1, borderColor: "rgba(244,248,255,0.16)", backgroundColor: "rgba(7,11,20,0.46)" },
  tvAccountSummary: { maxWidth: 190, minHeight: 32, paddingLeft: 4, paddingRight: 10, paddingVertical: 3 },
  accountAvatar: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15 },
  tvAccountAvatar: { width: 24, height: 24, borderRadius: 12 },
  accountAvatarText: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.white },
  tvAccountAvatarText: { fontSize: 11 },
  accountCopy: { flexShrink: 1, minWidth: 0 },
  accountName: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.text },
  tvAccountName: { fontSize: 10 },
  accountExpiry: { fontSize: 9, color: "rgba(244,248,255,0.62)" },
  tvAccountExpiry: { fontSize: 8 },

  // Destaque de ponta a ponta, sem moldura de cartão.
  heroStage: { width: "100%", overflow: "hidden", backgroundColor: Colors.backgroundRaised },
  heroShadeTop: { position: "absolute", top: 0, right: 0, left: 0 },
  heroContent: { position: "absolute", right: 20, bottom: 58, left: 20, gap: 9 },
  wideHeroContent: { right: undefined, left: 28, bottom: 74, width: "50%", maxWidth: 560 },
  tvHeroContent: { left: 32, bottom: 70, width: "48%", maxWidth: 520, gap: 9 },
  heroEyebrow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroEyebrowText: { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.6, color: Colors.blueBright },
  tvHeroEyebrowText: { fontSize: 9 },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 30, lineHeight: 34, letterSpacing: -0.9, color: Colors.text, textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 12 },
  wideHeroTitle: { fontSize: 36, lineHeight: 41, letterSpacing: -1.1 },
  tvHeroTitle: { fontSize: 30, lineHeight: 35, letterSpacing: -0.9 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroRatingPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: "rgba(245,184,61,0.16)" },
  heroRatingText: { fontFamily: "Inter_700Bold", fontSize: 10, color: Colors.amber },
  heroQualityPill: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: "rgba(244,248,255,0.5)" },
  heroQualityText: { fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 0.4, color: Colors.text },
  heroMetaText: { flexShrink: 1, fontFamily: "Inter_500Medium", fontSize: 11, color: "#B6C2D6" },
  tvHeroMetaText: { fontSize: 10 },
  heroDescription: { maxWidth: 520, fontSize: 13, lineHeight: 19, color: "#D6DEEB" },
  wideHeroDescription: { fontSize: 13, lineHeight: 20 },
  tvHeroDescription: { fontSize: 12, lineHeight: 18 },
  heroActions: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 6 },
  tvHeroActions: { gap: 10, marginTop: 6 },

  heroAction: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 18, borderRadius: 12 },
  tvHeroAction: { minHeight: 36, paddingHorizontal: 16, borderRadius: 9 },
  heroActionPrimary: { backgroundColor: BRAND.colors.textPrimary },
  heroActionGlass: { borderWidth: 1, borderColor: "rgba(244,248,255,0.22)", backgroundColor: "rgba(17,27,45,0.78)" },
  heroActionIcon: { width: 44, paddingHorizontal: 0, borderRadius: 22, borderWidth: 1, borderColor: "rgba(244,248,255,0.22)", backgroundColor: "rgba(17,27,45,0.78)" },
  tvHeroActionIcon: { width: 36, borderRadius: 18 },
  heroActionPressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  heroActionPrimaryFocused: { backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.blueBright, transform: [{ scale: 1.05 }] },
  heroActionGlassFocused: { backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.blueBright, transform: [{ scale: 1.05 }] },
  heroActionText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  tvHeroActionText: { fontSize: 12 },

  heroPagination: { position: "absolute", right: 20, bottom: 30, left: 20, flexDirection: "row", alignItems: "center", gap: 6 },
  wideHeroPagination: { left: undefined, right: 28, bottom: 82 },
  tvHeroPagination: { right: 32, bottom: 78 },
  heroSegment: { width: 18, height: 4, overflow: "hidden", borderRadius: 2, backgroundColor: "rgba(244,248,255,0.28)" },
  heroSegmentActive: { width: 42 },
  heroSegmentFill: { ...StyleSheet.absoluteFill, transformOrigin: "left", borderRadius: 2, backgroundColor: Colors.blueBright },

  // Blocos de navegação.
  tiles: { flexDirection: "row", flexWrap: "wrap", zIndex: 4 },
  tilesOverlap: { marginTop: -26 },
  tvTilesOverlap: { marginTop: -40 },
  tile: { overflow: "hidden", justifyContent: "space-between", padding: 12, borderRadius: 16, borderWidth: 1, borderColor: "rgba(190,222,255,0.13)", backgroundColor: "rgba(13,20,34,0.84)" },
  tvTile: { padding: 10, borderRadius: 12 },
  tilePressed: { opacity: 0.86, transform: [{ scale: 0.97 }] },
  tileFocused: { borderWidth: 2, borderColor: Colors.blueBright, transform: [{ scale: 1.06 }] },
  tileGradient: { borderRadius: 12 },
  tileIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "rgba(0,215,255,0.1)" },
  tvTileIcon: { width: 26, height: 26, borderRadius: 8 },
  tileIconFocused: { backgroundColor: "rgba(255,255,255,0.18)" },
  tileCopy: { gap: 1 },
  tileTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  tvTileTitle: { fontSize: 12 },
  tileCaption: { fontSize: 10, color: Colors.muted },
  tvTileCaption: { fontSize: 9 },
  tileCaptionFocused: { color: "rgba(255,255,255,0.82)" },

  // Fileiras.
  rails: { gap: 22, marginTop: 26 },
  tvRails: { gap: 16, marginTop: 22 },
  railsAfterHero: { marginTop: 4 },
  cardPressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
  cardFocused: { borderWidth: 2, borderColor: Colors.blueBright, transform: [{ scale: 1.05 }] },
  continueCard: { width: 232, borderRadius: 14, borderWidth: 1, borderColor: "transparent" },
  tvContinueCard: { width: 200 },
  continueImage: { aspectRatio: 16 / 9, overflow: "hidden", borderRadius: 13, borderWidth: 1, borderColor: "rgba(190,222,255,0.12)", backgroundColor: Colors.backgroundRaised },
  continuePlay: { position: "absolute", left: 9, bottom: 13, width: 26, height: 26, alignItems: "center", justifyContent: "center", paddingLeft: 2, borderRadius: 13, backgroundColor: "rgba(244,248,255,0.94)" },
  continueRemaining: { position: "absolute", right: 9, bottom: 17, fontFamily: "Inter_600SemiBold", fontSize: 10, color: "rgba(244,248,255,0.9)" },
  continueTrack: { position: "absolute", right: 9, bottom: 6, left: 9, height: 3, overflow: "hidden", borderRadius: 2, backgroundColor: "rgba(255,255,255,0.22)" },
  continueFill: { height: "100%", borderRadius: 2, backgroundColor: Colors.blueBright },
  continueTitle: { marginTop: 8, paddingHorizontal: 2, fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  continueSubtitle: { marginTop: 2, paddingHorizontal: 2, fontSize: 11, color: Colors.muted },

  channelCard: { width: 168, gap: 4, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: "rgba(190,222,255,0.13)", backgroundColor: "rgba(13,20,34,0.78)" },
  tvChannelCard: { width: 150, padding: 10, borderRadius: 12 },
  channelTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radii.pill, backgroundColor: "rgba(255,92,114,0.16)" },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.red },
  livePillText: { fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.6, color: "#FF8A9A" },
  channelName: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  channelProgram: { fontSize: 10, color: Colors.muted },
  channelProgress: { height: 3, overflow: "hidden", marginTop: 6, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.14)" },
  channelProgressFill: { height: "100%", borderRadius: 2 },

  emptyHome: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 48, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  emptyHomeTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: Colors.text },
  emptyHomeBody: { fontSize: 13, color: Colors.muted, textAlign: "center", maxWidth: 300 },
  syncBtn: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 4, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.white },
  syncBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.background },
});
