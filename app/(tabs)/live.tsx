import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Colors, Radii, Type } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText, Chip, GlassCard, IconButton, SearchField, SectionHeader } from "@/components/ui";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useSyncStatus } from "@/hooks/useXtreamSync";
import { EPG_LIVE_PRELOAD_LIMIT, useEpgPreload, useEpgPreloader } from "@/hooks/useEpgPreload";
import { useAppStore } from "@/store/useAppStore";
import type { ChannelItem } from "@/store/types";
import { hasRememberedTvFocus } from "@/core/navigation/tv-focus-memory";
import { TV_NAV_WIDTH } from "@/components/tv-side-navigation";
import { useTvFocusRestoration } from "@/hooks/use-tv-focus-restoration";
import { ParentalGate } from "@/components/parental-gate";
import { useCatalogPagination } from "@/hooks/use-catalog-pagination";
import { hydratePagedChannelsWithEpg } from "@/core/live/hydrate-paged-channels";
import { TvCategoryPanel, TvChannelPreview } from "@/features/live/tv-guide-panels";

const LIVE_FOCUS_SCOPE = "live-channels";
const EMPTY_CHANNELS: ChannelItem[] = [];
const TV_PREVIEW_FOCUS_DELAY_MS = 180;

// ---------------------------------------------------------------------------
// View-mode persistence
// ---------------------------------------------------------------------------

type ViewMode = "list" | "grid";

function useViewMode(): [ViewMode, () => void] {
  const raw = useAppStore((state) => state.preferences["liveViewMode"]);
  const setPreference = useAppStore((state) => state.setPreference);
  const mode: ViewMode = raw === "grid" ? "grid" : "list";
  const toggle = useCallback(() => {
    setPreference("liveViewMode", mode === "grid" ? "list" : "grid");
  }, [mode, setPreference]);
  return [mode, toggle];
}

// ---------------------------------------------------------------------------
// Grid card component
// ---------------------------------------------------------------------------

interface GridCardProps {
  channel: ChannelItem;
  isFavorite: boolean;
  cardWidth: number;
  onPress: (id: string) => void;
  onFavorite: (id: string) => void;
  focusIndex: number;
  restoreFocus: boolean;
  onPreview: (channel: ChannelItem) => void;
}

function GridChannelCard({ channel, isFavorite, cardWidth, onPress, onFavorite, focusIndex, restoreFocus, onPreview }: GridCardProps) {
  const handlePress = useCallback(() => onPress(channel.id), [channel.id, onPress]);
  const handleFav = useCallback(() => onFavorite(channel.id), [channel.id, onFavorite]);

  return (
    <View style={[gridStyles.card, { width: cardWidth }]}>
      <TVFocusable
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${channel.name}`}
        focusId={channel.id}
        focusScope={LIVE_FOCUS_SCOPE}
        focusIndex={focusIndex}
        restoreFocus={restoreFocus}
        onFocus={() => onPreview(channel)}
        onPress={handlePress}
        style={gridStyles.cardPressable}
      >
        <View style={gridStyles.logoArea}>
          {channel.logo ? (
            <Image source={{ uri: channel.logo }} contentFit="contain" style={gridStyles.logo} />
          ) : (
            <View style={gridStyles.logoFallback}>
              <AppText style={gridStyles.logoInitials}>
                {channel.name.slice(0, 2).toUpperCase()}
              </AppText>
            </View>
          )}
          <View style={gridStyles.liveBadge}>
            <View style={gridStyles.liveDot} />
            <AppText style={gridStyles.liveText}>AO VIVO</AppText>
          </View>
          <View style={gridStyles.numBadge}>
            <AppText style={gridStyles.numText}>{channel.number}</AppText>
          </View>
        </View>
        <View style={gridStyles.infoArea}>
          <AppText style={gridStyles.channelName} numberOfLines={1}>
            {channel.name}
          </AppText>
          <AppText style={gridStyles.programName} numberOfLines={1}>
            {channel.currentEpg.title}
          </AppText>
          <View style={gridStyles.progressTrack}>
            <View
              style={[gridStyles.progressFill, { width: `${channel.currentEpg.progress}%` }]}
            />
          </View>
        </View>
      </TVFocusable>
      <TVFocusable
        accessibilityRole="button"
        accessibilityLabel={
          isFavorite ? `Remover ${channel.name} dos favoritos` : `Favoritar ${channel.name}`
        }
        onPress={handleFav}
        hitSlop={8}
        style={gridStyles.favBtn}
      >
        <Ionicons
          name={isFavorite ? "star" : "star-outline"}
          size={15}
          color={isFavorite ? Colors.amber : Colors.muted}
        />
      </TVFocusable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// List row component
// ---------------------------------------------------------------------------

interface ListRowProps {
  channel: ChannelItem;
  isFavorite: boolean;
  tvMode: boolean;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
  onFavorite: (id: string) => void;
  focusIndex: number;
  restoreFocus: boolean;
  onPreview: (channel: ChannelItem) => void;
}

function ListChannelRow({ channel, isFavorite, tvMode, onPress, onLongPress, onFavorite, focusIndex, restoreFocus, onPreview }: ListRowProps) {
  const handlePress = useCallback(() => onPress(channel.id), [channel.id, onPress]);
  const handleLong = useCallback(() => onLongPress(channel.id), [channel.id, onLongPress]);
  const handleFav = useCallback(() => onFavorite(channel.id), [channel.id, onFavorite]);

  const row = (
    <View style={styles.channelRow}>
        <TVFocusable
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${channel.name}`}
          focusId={channel.id}
          focusScope={LIVE_FOCUS_SCOPE}
          focusIndex={focusIndex}
          restoreFocus={restoreFocus}
          onFocus={() => onPreview(channel)}
          onPress={handlePress}
          onLongPress={handleLong}
          style={[styles.channelPressable, tvMode && styles.tvChannelPressable]}
          focusStyle={tvMode ? styles.tvChannelFocused : undefined}
        >
          <View style={[styles.channelImage, tvMode && styles.tvChannelImage]}>
            {channel.logo ? (
              <Image
                source={{ uri: channel.logo }}
                contentFit={tvMode ? "contain" : "cover"}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            {!tvMode ? <View style={styles.imageVeil} /> : null}
            {!tvMode ? (
              <AppText style={styles.channelInitials}>
                {channel.name.slice(0, 3).toUpperCase()}
              </AppText>
            ) : null}
          </View>
          <View style={styles.channelDetails}>
            <View style={styles.channelTitleRow}>
              {!tvMode ? <AppText style={styles.channelNumber}>{channel.number}</AppText> : null}
              <AppText numberOfLines={1} style={[styles.channelTitle, tvMode && styles.tvChannelTitle]}>{channel.name}</AppText>
              {!tvMode ? (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <AppText style={styles.liveText}>AO VIVO</AppText>
                </View>
              ) : null}
            </View>
            {!tvMode ? (
              <>
                <AppText style={styles.programTitle}>{channel.currentEpg.title}</AppText>
                <View style={styles.programTimes}>
                  <AppText style={styles.programTime}>{channel.currentEpg.start}</AppText>
                  <View style={styles.programTrack}>
                    <View
                      style={[styles.programFill, { width: `${channel.currentEpg.progress}%` }]}
                    />
                  </View>
                  <AppText style={styles.programTime}>{channel.currentEpg.end}</AppText>
                </View>
                <AppText numberOfLines={1} style={styles.nextProgram}>
                  A seguir · {channel.nextProgram}
                </AppText>
              </>
            ) : null}
          </View>
        </TVFocusable>
        {tvMode ? (
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? `Remover ${channel.name} dos favoritos` : `Favoritar ${channel.name}`}
            onFocus={() => onPreview(channel)}
            onPress={handleFav}
            hitSlop={6}
            style={styles.tvFavoriteButton}
            focusStyle={styles.tvFavoriteFocused}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={16}
              color={isFavorite ? "#FF6B78" : "#B9C9DA"}
            />
          </TVFocusable>
        ) : (
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel={
              isFavorite
                ? `Remover ${channel.name} dos favoritos`
                : `Favoritar ${channel.name}`
            }
            onPress={handleFav}
            hitSlop={8}
            style={styles.favoriteButton}
          >
            <Ionicons
              name={isFavorite ? "star" : "star-outline"}
              size={20}
              color={isFavorite ? Colors.amber : Colors.muted}
            />
          </TVFocusable>
        )}
    </View>
  );

  // A BlurView per 33 px guide row overwhelms Fire TV's compositor while the
  // D-pad scrolls. TV rows are deliberately lightweight opaque views; mobile
  // keeps the existing glass treatment.
  if (tvMode) return <View style={[styles.channelCard, styles.tvChannelCard]}>{row}</View>;
  return <GlassCard style={styles.channelCard} intensity={18}>{row}</GlassCard>;
}

// ---------------------------------------------------------------------------
// Static list header (no interactive search here)
// ---------------------------------------------------------------------------

interface LiveHeaderProps {
  isSyncing: boolean;
  syncError: string | null;
  syncProgress: string | null;
  channels: ChannelItem[];
  filteredCount: number;
  categories: string[];
  category: string;
  viewMode: ViewMode;
  refresh: () => void;
  toggleViewMode: () => void;
  setCategory: (c: string) => void;
  tvMode: boolean;
  listOnly?: boolean;
}

const FAVORITES_LABEL = "Favoritos";

function LiveHeader({
  isSyncing,
  syncError,
  syncProgress,
  channels,
  filteredCount,
  categories,
  category,
  viewMode,
  refresh,
  toggleViewMode,
  setCategory,
  tvMode,
  listOnly = false,
}: LiveHeaderProps) {
  if (tvMode && listOnly) {
    return (
      <View style={styles.tvListHeading}>
        <AppText style={styles.tvListTitle}>{category === FAVORITES_LABEL ? "Canais favoritos" : "Canais disponíveis"}</AppText>
        <AppText style={styles.tvListCount}>{isSyncing ? "Carregando…" : `${filteredCount} canais`}</AppText>
      </View>
    );
  }
  return (
    <View style={styles.headerBlock}>
      {isSyncing ? (
        <View style={styles.syncBanner}>
          <ActivityIndicator size="small" color={Colors.green} />
          <AppText style={styles.syncText}>{syncProgress ?? "Sincronizando..."}</AppText>
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

      <View style={[styles.header, tvMode && styles.tvHeader]}>
        {tvMode ? (
          <View style={styles.tvGuideStatus}>
            <AppText style={styles.tvGuideCount}>
              {isSyncing ? (syncProgress ?? "Carregando canais") : `${channels.length} canais disponíveis`}
            </AppText>
            <TvLiveUtility />
          </View>
        ) : (
          <View style={styles.headerCopy}>
            <AppText style={styles.kicker}>GUIA AO VIVO</AppText>
            <AppText style={Type.display}>TV ao Vivo</AppText>
            <AppText style={styles.headerSubtitle}>
              {isSyncing ? (syncProgress ?? "Carregando...") : `${channels.length} canais disponíveis`}
            </AppText>
          </View>
        )}
        <View style={styles.headerActions}>
          {!tvMode ? <>
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel={viewMode === "grid" ? "Mudar para lista" : "Mudar para grade"}
            onPress={toggleViewMode}
            style={({ pressed }) => [styles.viewToggle, tvMode && styles.tvViewToggle, pressed && styles.pressed]}
          >
            <Ionicons
              name={viewMode === "grid" ? "list-outline" : "grid-outline"}
              size={20}
              color={Colors.text}
            />
          </TVFocusable>
          <IconButton icon="refresh" label="Atualizar lista" onPress={refresh} size={tvMode ? 36 : 42} />
          </> : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.categoryScroller, tvMode && styles.tvCategoryScroller]}
        contentContainerStyle={[styles.categoryContent, tvMode && styles.tvCategoryContent]}
      >
        {categories.map((item, index) => (
          <Chip
            key={item}
            label={item}
            selected={category === item}
              selectedTone={tvMode ? "light" : "blue"}
            hasTVPreferredFocus={index === 0 && !hasRememberedTvFocus(LIVE_FOCUS_SCOPE)}
            onPress={() => setCategory(item)}
            icon={item === FAVORITES_LABEL ? "star" : undefined}
            compact={tvMode}
          />
        ))}
      </ScrollView>

      {tvMode ? (
        <View style={styles.tvListHeading}>
          <AppText style={styles.tvListTitle}>{category === FAVORITES_LABEL ? "Canais favoritos" : "Canais disponíveis"}</AppText>
          <AppText style={styles.tvListCount}>{isSyncing ? "Carregando…" : `${filteredCount} canais`}</AppText>
        </View>
      ) : (
        <SectionHeader
          title={category === FAVORITES_LABEL ? "Canais favoritos" : "Canais disponíveis"}
          subtitle={isSyncing ? "Carregando..." : `${filteredCount} canais`}
        />
      )}
    </View>
  );
}

function TvLiveUtility() {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <View style={styles.tvUtility}>
      <Ionicons name="radio-outline" size={18} color={Colors.text} />
      <AppText style={styles.tvUtilityTime}>{clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</AppText>
      <Ionicons name="settings-outline" size={19} color={Colors.muted} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function LiveScreen() {
  const router = useRouter();
  const tvMode = useTVMode();
  const { isTablet, isTabletLandscape, contentPadding } = useResponsiveLayout();
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [previewChannelId, setPreviewChannelId] = useState<string | null>(null);
  const previewFocusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Use Expo Router's focus hook rather than importing React Navigation
  // directly: the router owns the navigation integration in the release bundle.
  useFocusEffect(useCallback(() => {
    setIsScreenFocused(true);
    return () => {
      // The preview component is unmounted below when this route loses focus.
      // useVideoPlayer releases its native decoder, stream buffers and audio
      // session on unmount; clearing the selection prevents a stale source
      // from surviving in the screen state on low-memory Fire TV devices.
      setPreviewChannelId(null);
      if (previewFocusTimer.current) clearTimeout(previewFocusTimer.current);
      setIsScreenFocused(false);
    };
  }, []));
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState("Todos");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [query, setQuery] = useState("");
  const [viewMode, toggleViewMode] = useViewMode();
  const [pendingChannelId, setPendingChannelId] = useState<string | null>(null);

  const favoriteChannelIds = useAppStore((state) => state.favoriteChannelIds);
  const isContentBlocked = useAppStore((state) => state.isContentBlocked);
  const toggleFavoriteChannel = useAppStore((state) => state.toggleFavoriteChannel);
  const channels = useAppStore((state) => state.contentCache.liveChannels);
  const activeServerId = useAppStore((state) => state.activeServerId);
  const cachedCategories = useAppStore((state) => state.contentCache.liveCategories);
  const { isSyncing, syncError, syncProgress, refresh } = useSyncStatus();
  // The TV guide is intentionally a list: its row-to-preview relationship is
  // the primary D-pad interaction and must not change with a persisted mobile
  // grid preference.
  const effectiveViewMode: ViewMode = tvMode ? "list" : viewMode;

  const categories = useMemo(
    () => [FAVORITES_LABEL, "Todos", ...cachedCategories.map((c) => c.name)],
    [cachedCategories],
  );
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set(FAVORITES_LABEL, favoriteChannelIds.length);
    counts.set("Todos", channels.length);
    for (const channel of channels) {
      counts.set(channel.categoryName, (counts.get(channel.categoryName) ?? 0) + 1);
    }
    return counts;
  }, [channels, favoriteChannelIds.length]);

  const filteredChannels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter((ch) => {
      if (category === FAVORITES_LABEL) return favoriteChannelIds.includes(ch.id);
      const matchCat = category === "Todos" || ch.categoryName === category;
      const matchQ = !q || `${ch.name} ${ch.currentEpg.title}`.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [channels, category, query, favoriteChannelIds]);
  const pager = useCatalogPagination<ChannelItem>(activeServerId, "liveChannels", {
    categoryName: category === FAVORITES_LABEL || category === "Todos" ? "" : category,
    query: category === FAVORITES_LABEL ? "" : query.trim(),
    sort: "channel_number",
  });
  const visibleChannels = useMemo(
    () => pager.enabled && category !== FAVORITES_LABEL
      ? hydratePagedChannelsWithEpg(pager.items, channels)
      : filteredChannels,
    [pager.enabled, pager.items, category, filteredChannels, channels],
  );
  // Preload beyond the rendered window so cards already have Now/Next as the
  // user changes category or scrolls. The queue keeps the provider protected.
  // TV rows intentionally show logo + name only. Preloading EPG for an
  // 8,000-channel list continually mutates the catalog while the user moves
  // focus, which is the source of the navigation hitching. On TV, load EPG
  // only for the settled preview channel below.
  useEpgPreload(tvMode ? EMPTY_CHANNELS : visibleChannels, EPG_LIVE_PRELOAD_LIMIT);
  const preloadVisibleEpg = useEpgPreloader();

  useEffect(() => {
    if (!previewChannelId && visibleChannels[0]) setPreviewChannelId(visibleChannels[0].id);
  }, [previewChannelId, visibleChannels]);

  const previewChannel = useMemo(
    () => channels.find((channel) => channel.id === previewChannelId) ?? visibleChannels[0],
    [channels, previewChannelId, visibleChannels],
  );

  const handlePreviewChannel = useCallback((channel: ChannelItem) => {
    if (previewFocusTimer.current) clearTimeout(previewFocusTimer.current);
    const applyPreview = () => {
      setPreviewChannelId(channel.id);
      // The focused row receives priority, so the now/next panel updates
      // without scheduling work for every channel crossed by the D-pad.
      preloadVisibleEpg([channel], 1);
    };
    if (!tvMode) {
      applyPreview();
      return;
    }
    previewFocusTimer.current = setTimeout(applyPreview, TV_PREVIEW_FOCUS_DELAY_MS);
  }, [preloadVisibleEpg, tvMode]);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { item: ChannelItem }[] }) => {
      if (tvMode) return;
      preloadVisibleEpg(viewableItems.map(({ item }) => item), viewableItems.length);
    },
    [preloadVisibleEpg, tvMode],
  );

  const handleChannel = useCallback(
    (channelId: string) => {
      const channel = channels.find((item) => item.id === channelId);
      if (!channel) return;
      if (isContentBlocked(channel.id)) {
        setPendingChannelId(channel.id);
        return;
      }
      router.push({
        pathname: "/player",
        params: {
          id: channel.id,
          title: channel.name,
          type: "live",
          streamUrl: channel.streamUrl,
        },
      });
    },
    [channels, isContentBlocked, router],
  );

  const openAuthorizedChannel = useCallback(() => {
    if (!pendingChannelId) return;
    const channel = channels.find((item) => item.id === pendingChannelId);
    setPendingChannelId(null);
    if (!channel) return;
    router.push({ pathname: "/player", params: { id: channel.id, title: channel.name, type: "live", streamUrl: channel.streamUrl } });
  }, [channels, pendingChannelId, router]);

  const handleGuide = useCallback(
    (channelId: string) => {
      const channel = channels.find((item) => item.id === channelId);
      if (!channel) return;
      Alert.alert(
        channel.name,
        `${channel.currentEpg.title} · ${channel.currentEpg.start}–${channel.currentEpg.end}\nA seguir: ${channel.nextProgram}`,
      );
    },
    [channels],
  );

  const isEmpty = !isSyncing && channels.length === 0;

  // The guide shares a single responsive canvas: the channel column remains
  // comfortable for D-pad navigation while preview/EPG receive enough width
  // on 720p and 1080p televisions.  Previous fixed dimensions made the two
  // panes compete on smaller TV panels.
  const horizontalPadding = tvMode ? Math.max(20, Math.min(32, Math.round(width * 0.018))) : isTablet ? contentPadding : 20;
  const availableWidth = width - (tvMode ? TV_NAV_WIDTH : 0);
  const tvGuideWidth = Math.min(1640, availableWidth - horizontalPadding * 2);
  const tvPreviewWidth = Math.round(Math.min(620, Math.max(350, tvGuideWidth * 0.43)));
  // Compact gaps recover horizontal room for long category and channel names
  // without shrinking the preview/EPG panel itself.
  const tvPreviewGap = Math.max(10, Math.min(16, Math.round(tvGuideWidth * 0.011)));
  const columnGap = 10;
  const numGridColumns = tvMode
    ? (width >= 1500 ? 6 : width >= 1100 ? 5 : 4)
    : (isTabletLandscape ? 4 : isTablet ? 3 : width >= 768 ? 3 : 2);
  const gridCardWidth =
    (availableWidth - horizontalPadding * 2 - columnGap * (numGridColumns - 1)) / numGridColumns;
  const activeColumns = effectiveViewMode === "grid" ? numGridColumns : 1;
  const { listRef, onScrollToIndexFailed } = useTvFocusRestoration<ChannelItem>(LIVE_FOCUS_SCOPE, tvMode, activeColumns);

  const renderItem = useCallback(
    ({ item: channel, index }: { item: ChannelItem; index: number }) => {
      const isFavorite = favoriteChannelIds.includes(channel.id);
      if (effectiveViewMode === "grid") {
        return (
          <GridChannelCard
            channel={channel}
            isFavorite={isFavorite}
            cardWidth={gridCardWidth}
            onPress={handleChannel}
            onFavorite={toggleFavoriteChannel}
            focusIndex={index}
            restoreFocus={tvMode}
            onPreview={handlePreviewChannel}
          />
        );
      }
      return (
        <ListChannelRow
          channel={channel}
          isFavorite={isFavorite}
          tvMode={tvMode}
          onPress={handleChannel}
          onLongPress={handleGuide}
          onFavorite={toggleFavoriteChannel}
          focusIndex={index}
          restoreFocus={tvMode}
          onPreview={handlePreviewChannel}
        />
      );
    },
    [favoriteChannelIds, effectiveViewMode, gridCardWidth, handleChannel, handleGuide, toggleFavoriteChannel, tvMode, handlePreviewChannel],
  );

  const keyExtractor = useCallback((item: ChannelItem) => item.id, []);

  const handleCategoryChange = useCallback((c: string) => setCategory(c), []);

  // useMemo returns a React ELEMENT so FlatList reconciles in-place when
  // filteredChannels.length changes — prevents header unmount and keyboard dismissal.
  const listHeaderElement = useMemo(
    () => (
      <LiveHeader
        isSyncing={isSyncing}
        syncError={syncError}
        syncProgress={syncProgress}
        channels={channels}
        filteredCount={filteredChannels.length}
        categories={categories}
        category={category}
        viewMode={effectiveViewMode}
        refresh={refresh}
        toggleViewMode={toggleViewMode}
        setCategory={handleCategoryChange}
        tvMode={tvMode}
        listOnly={tvMode}
      />
    ),
    [
      isSyncing, syncError, syncProgress, channels, filteredChannels.length,
      categories, category, effectiveViewMode, refresh, toggleViewMode, handleCategoryChange, tvMode,
    ],
  );

  const listEmptyElement = useMemo(
    () =>
      isEmpty ? (
        <View style={styles.empty}>
          <Ionicons name="cloud-offline-outline" size={32} color={Colors.subtle} />
          <AppText style={styles.emptyTitle}>Nenhum canal disponível</AppText>
          <AppText style={styles.emptyBody}>
            Toque em Atualizar para sincronizar os canais do servidor.
          </AppText>
          <TVFocusable
            onPress={refresh}
            style={styles.syncBtn}
            accessibilityLabel="Sincronizar canais"
          >
            <Ionicons name="refresh" size={15} color={Colors.background} />
            <AppText style={styles.syncBtnText}>Sincronizar agora</AppText>
          </TVFocusable>
        </View>
      ) : category === FAVORITES_LABEL && filteredChannels.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="star-outline" size={32} color={Colors.subtle} />
          <AppText style={styles.emptyTitle}>Sem canais favoritos</AppText>
          <AppText style={styles.emptyBody}>
            Toque na estrela ao lado de um canal para adicioná-lo aos favoritos.
          </AppText>
        </View>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={28} color={Colors.subtle} />
          <AppText style={styles.emptyTitle}>Nenhum canal encontrado</AppText>
          <AppText style={styles.emptyBody}>Tente outra categoria ou ajuste a busca.</AppText>
        </View>
      ),
    [isEmpty, refresh, category, filteredChannels.length],
  );

  const channelList = (
    <FlatList
      ref={listRef}
      key={effectiveViewMode === "grid" ? `grid-${numGridColumns}` : "list"}
      data={visibleChannels}
      numColumns={effectiveViewMode === "grid" ? numGridColumns : 1}
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
        { paddingHorizontal: tvMode ? 0 : horizontalPadding },
      ]}
      columnWrapperStyle={effectiveViewMode === "grid" ? { gap: columnGap } : undefined}
      ItemSeparatorComponent={
        effectiveViewMode === "list" ? () => <View style={[styles.rowSeparator, tvMode && styles.tvRowSeparator]} /> : null
      }
      initialNumToRender={20}
      maxToRenderPerBatch={25}
      windowSize={7}
      removeClippedSubviews={Platform.OS === "android"}
      onViewableItemsChanged={handleViewableItemsChanged}
      onScrollToIndexFailed={onScrollToIndexFailed}
      onEndReached={pager.enabled && category !== FAVORITES_LABEL ? pager.loadMore : undefined}
      onEndReachedThreshold={0.5}
      ListFooterComponent={pager.loading && visibleChannels.length > 0 ? <ActivityIndicator color={Colors.blueBright} style={styles.pageLoader} /> : null}
    />
  );

  if (tvMode) {
    return (
      <View style={styles.screen}>
        <ParentalGate visible={pendingChannelId !== null} onAuthorized={openAuthorizedChannel} onClose={() => setPendingChannelId(null)} />
        <View style={styles.ambient} />
        <View style={[styles.tvGuideLayout, styles.tvThreePaneLayout, { gap: tvPreviewGap, paddingHorizontal: horizontalPadding }]}>
          <TvCategoryPanel
            categories={categories}
            activeCategory={category}
            filter={categoryQuery}
            categoryCounts={categoryCounts}
            onFilterChange={setCategoryQuery}
            onSelect={handleCategoryChange}
          />
          <View style={styles.tvChannelPane}>
            <View style={styles.tvChannelSearch}><SearchField value={query} onChangeText={setQuery} placeholder="Pesquisar canais" /></View>
            {channelList}
          </View>
          <View style={[styles.tvPreviewPane, { width: tvPreviewWidth }]}>
            <TvChannelPreview channel={previewChannel} width={tvPreviewWidth} active={isScreenFocused} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ParentalGate visible={pendingChannelId !== null} onAuthorized={openAuthorizedChannel} onClose={() => setPendingChannelId(null)} />
      <View style={styles.ambient} />
      {/* Search field rendered OUTSIDE FlatList so it never remounts on query change */}
      <View style={[styles.searchBar, { paddingHorizontal: horizontalPadding }]}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar canal ou programa"
        />
      </View>
      {channelList}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Grid card styles
// ---------------------------------------------------------------------------

const gridStyles = StyleSheet.create({
  card: {
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.glass,
    overflow: "hidden",
  },
  cardPressable: { flex: 1 },
  logoArea: {
    height: 100,
    backgroundColor: Colors.backgroundRaised,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: { width: "80%", height: "80%" },
  logoFallback: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59,130,246,0.18)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.3)",
  },
  logoInitials: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.blueBright },
  liveBadge: {
    position: "absolute",
    top: 7,
    right: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: "rgba(229,9,20,0.85)",
  },
  liveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.white },
  liveText: { fontFamily: "Inter_700Bold", fontSize: 7, letterSpacing: 0.3, color: Colors.white },
  numBadge: {
    position: "absolute",
    top: 7,
    left: 7,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  numText: { fontFamily: "Inter_600SemiBold", fontSize: 8, color: Colors.muted },
  infoArea: { gap: 4, padding: 8, paddingBottom: 10 },
  channelName: { fontFamily: "Inter_700Bold", fontSize: 12, color: Colors.text },
  programName: { fontSize: 10, color: Colors.muted },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.12)",
    marginTop: 2,
  },
  progressFill: { height: "100%", borderRadius: 1, backgroundColor: Colors.green },
  favBtn: {
    position: "absolute",
    bottom: 10,
    right: 8,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
});

// ---------------------------------------------------------------------------
// Screen-level styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  ambient: {
    position: "absolute",
    top: -120,
    right: -110,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(16, 185, 129, 0.07)",
  },
  searchBar: { paddingTop: 12, paddingBottom: 3 },
  tvSearchBar: { paddingTop: 18, paddingBottom: 10 },
  content: { gap: 0, paddingTop: 0, paddingBottom: 35 },
  tvContent: { paddingBottom: 42 },
  // A real flex row, rather than an absolutely-positioned overlay, keeps the
  // channel list and the programme panel proportional at 720p and 1080p.
  tvGuideLayout: { flex: 1, minHeight: 0, flexDirection: "row", paddingBottom: 18 },
  tvThreePaneLayout: { paddingTop: 18 },
  tvChannelPane: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(9,18,33,0.70)",
    borderWidth: 1,
    borderColor: "rgba(152,196,240,0.14)",
  },
  tvChannelSearch: { paddingBottom: 8 },
  tvPreviewPane: { flexShrink: 0, alignSelf: "flex-start", paddingTop: 8 },
  headerBlock: { gap: 10, paddingTop: 8, marginBottom: 4 },
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(16,185,129,0.1)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(16,185,129,0.2)",
    marginHorizontal: -20,
  },
  syncText: { fontSize: 12, color: Colors.green, flex: 1 },
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  tvHeader: { minHeight: 28, justifyContent: "flex-end" },
  headerCopy: { flex: 1, gap: 4 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  tvGuideStatus: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  tvGuideCount: { color: "rgba(226,239,255,0.72)", fontFamily: "Inter_500Medium", fontSize: 10 },
  kicker: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 1.2, color: Colors.green },
  headerSubtitle: { fontSize: 13, color: Colors.muted },
  tvKicker: { fontSize: 9, letterSpacing: 1.6 },
  tvHeaderTitle: { fontSize: 22, lineHeight: 27, letterSpacing: -0.45 },
  tvHeaderSubtitle: { fontSize: 11 },
  viewToggle: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.glass,
  },
  tvViewToggle: { width: 36, height: 36, borderRadius: 11 },
  pressed: { opacity: 0.72 },
  categoryScroller: { flexGrow: 0, marginHorizontal: -20 },
  categoryContent: { gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
  tvCategoryScroller: { marginTop: -2 },
  tvCategoryContent: { gap: 6, paddingVertical: 0 },
  tvListHeading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 2, marginBottom: 2 },
  tvListTitle: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 17, lineHeight: 21, letterSpacing: -0.2 },
  tvListCount: { color: Colors.subtle, fontFamily: "Inter_500Medium", fontSize: 10 },
  rowSeparator: { height: 8 },
  tvRowSeparator: { height: 2 },
  pageLoader: { paddingVertical: 20 },
  channelCard: { minHeight: 116, borderRadius: Radii.medium },
  // TV rows deliberately mirror the category rows: logo + channel name only.
  tvChannelCard: { minHeight: 33, borderRadius: 7, backgroundColor: "transparent", borderColor: "transparent", borderWidth: 0 },
  channelRow: { flex: 1, flexDirection: "row", alignItems: "center" },
  channelPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 11,
  },
  tvChannelPressable: { minHeight: 33, gap: 9, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7 },
  tvChannelFocused: { borderWidth: 1, borderColor: "rgba(255,255,255,0.95)", backgroundColor: "rgba(255,255,255,0.14)", transform: [{ scale: 1 }], opacity: 1 },
  // TV favorite lives beside the channel name and receives its own D-pad
  // target, without adding program metadata back into the compact guide row.
  tvFavoriteButton: { width: 30, height: 30, marginRight: 3, alignItems: "center", justifyContent: "center", borderRadius: 15, flexShrink: 0 },
  tvFavoriteFocused: { borderWidth: 1, borderColor: "#96E1FF", backgroundColor: "#173C55", elevation: 0, shadowOpacity: 0, shadowRadius: 0, transform: [{ scale: 1 }] },
  channelImage: {
    width: 80,
    height: 88,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: Colors.backgroundRaised,
  },
  tvChannelImage: { width: 30, height: 25, borderRadius: 4, backgroundColor: "transparent" },
  imageVeil: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(8, 12, 22, 0.45)" },
  channelInitials: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.white },
  channelDetails: { flex: 1, gap: 4 },
  channelTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  channelNumber: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.subtle },
  tvChannelNumber: { minWidth: 29, fontSize: 10, color: "rgba(226,239,255,0.78)", fontVariant: ["tabular-nums"] },
  channelTitle: { flexShrink: 1, fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.text },
  // Exact TV guide scale: compact enough for six-or-more visible channels,
  // while preserving a calm viewing distance on a 720p or 1080p panel.
  // TV/Fire TV: compact channel rows, matching the requested 12 px hierarchy.
  tvChannelTitle: { flex: 1, fontSize: 12, lineHeight: 15 },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: "rgba(229, 9, 20, 0.14)",
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.red },
  liveText: { fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.4, color: "#FF6870" },
  programTitle: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.text },
  tvProgramTitle: { fontSize: 10, lineHeight: 13, color: "rgba(222,235,250,0.84)" },
  programTimes: { flexDirection: "row", alignItems: "center", gap: 6 },
  programTime: { fontVariant: ["tabular-nums"], fontSize: 9, color: Colors.subtle },
  programTrack: {
    flex: 1,
    height: 3,
    overflow: "hidden",
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  programFill: { height: "100%", borderRadius: 2, backgroundColor: Colors.green },
  nextProgram: { fontSize: 9, color: Colors.subtle },
  favoriteButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginRight: 11,
    flexShrink: 0,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 44,
    borderRadius: Radii.medium,
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
  tvUtility: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "rgba(12,23,40,0.54)" },
  tvUtilityTime: { color: Colors.text, fontFamily: "Inter_600SemiBold", fontSize: 15, fontVariant: ["tabular-nums"] },
});
