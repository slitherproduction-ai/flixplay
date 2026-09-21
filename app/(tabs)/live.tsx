import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Colors, Radii, Type } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText, Chip, GlassCard, IconButton, SearchField, SectionHeader } from "@/components/ui";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useSyncStatus } from "@/hooks/useXtreamSync";
import { useAppStore } from "@/store/useAppStore";
import type { ChannelItem } from "@/store/types";

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
}

function GridChannelCard({ channel, isFavorite, cardWidth, onPress, onFavorite }: GridCardProps) {
  const handlePress = useCallback(() => onPress(channel.id), [channel.id, onPress]);
  const handleFav = useCallback(() => onFavorite(channel.id), [channel.id, onFavorite]);

  return (
    <View style={[gridStyles.card, { width: cardWidth }]}>
      <TVFocusable
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${channel.name}`}
        onPress={handlePress}
        style={gridStyles.cardPressable}
      >
        {/* Logo area */}
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

          {/* Live badge — top right */}
          <View style={gridStyles.liveBadge}>
            <View style={gridStyles.liveDot} />
            <AppText style={gridStyles.liveText}>AO VIVO</AppText>
          </View>

          {/* Channel number — top left */}
          <View style={gridStyles.numBadge}>
            <AppText style={gridStyles.numText}>{channel.number}</AppText>
          </View>
        </View>

        {/* Info area */}
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

      {/* Favorite button — bottom-right corner overlay */}
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
// Main screen
// ---------------------------------------------------------------------------

export default function LiveScreen() {
  const router = useRouter();
  const tvMode = useTVMode();
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState("Todos");
  const [query, setQuery] = useState("");
  const [viewMode, toggleViewMode] = useViewMode();

  const favoriteIds = useAppStore((state) => state.favoriteIds);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const channels = useAppStore((state) => state.contentCache.liveChannels);
  const cachedCategories = useAppStore((state) => state.contentCache.liveCategories);
  const { isSyncing, syncError, syncProgress, refresh } = useSyncStatus();

  const categories = useMemo(
    () => ["Todos", ...cachedCategories.map((c) => c.name)],
    [cachedCategories],
  );

  const filteredChannels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter((ch) => {
      const matchCat = category === "Todos" || ch.categoryName === category;
      const matchQ = !q || `${ch.name} ${ch.currentEpg.title}`.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [channels, category, query]);

  const handleChannel = useCallback(
    (channelId: string) => {
      const channel = channels.find((item) => item.id === channelId);
      if (!channel) return;
      router.push({
        pathname: "/player",
        params: { id: channel.id, title: channel.name, type: "live", streamUrl: channel.streamUrl },
      });
    },
    [channels, router],
  );

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

  // Responsive grid: 2 columns on phone, 3 on wider screens
  const horizontalPadding = tvMode ? 46 : 20;
  const columnGap = 10;
  const numColumns = width >= 768 ? 3 : 2;
  const gridCardWidth = (width - horizontalPadding * 2 - columnGap * (numColumns - 1)) / numColumns;

  return (
    <View style={styles.screen}>
      <View style={styles.ambient} />

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

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          tvMode && styles.tvContent,
          { paddingHorizontal: horizontalPadding },
        ]}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <AppText style={styles.kicker}>AO VIVO AGORA</AppText>
            <AppText style={Type.display}>TV ao Vivo</AppText>
            <AppText style={styles.headerSubtitle}>Sua programação em tempo real</AppText>
          </View>
          <View style={styles.headerActions}>
            <TVFocusable
              accessibilityRole="button"
              accessibilityLabel={viewMode === "grid" ? "Mudar para lista" : "Mudar para grade"}
              onPress={toggleViewMode}
              style={({ pressed }) => [styles.viewToggle, pressed && styles.pressed]}
            >
              <Ionicons
                name={viewMode === "grid" ? "list-outline" : "grid-outline"}
                size={20}
                color={Colors.text}
              />
            </TVFocusable>
            <IconButton icon="refresh" label="Atualizar lista" onPress={refresh} />
          </View>
        </View>

        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar canal ou programa"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroller}
          contentContainerStyle={styles.categoryContent}
        >
          {categories.map((item, index) => (
            <Chip
              key={item}
              label={item}
              selected={category === item}
              hasTVPreferredFocus={index === 0}
              onPress={() => setCategory(item)}
            />
          ))}
        </ScrollView>

        <SectionHeader
          title="Canais disponíveis"
          subtitle={isSyncing ? "Carregando..." : `${filteredChannels.length} canais`}
        />

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {isEmpty ? (
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
              <Ionicons name="refresh" size={15} color={Colors.white} />
              <AppText style={styles.syncBtnText}>Sincronizar agora</AppText>
            </TVFocusable>
          </View>
        ) : viewMode === "grid" ? (
          // ── Grid layout ──────────────────────────────────────────────────
          <View style={[styles.grid, { gap: columnGap }]}>
            {filteredChannels.map((channel) => (
              <GridChannelCard
                key={channel.id}
                channel={channel}
                isFavorite={favoriteIds.includes(channel.id)}
                cardWidth={gridCardWidth}
                onPress={handleChannel}
                onFavorite={toggleFavorite}
              />
            ))}
          </View>
        ) : (
          // ── List layout ───────────────────────────────────────────────────
          <View style={styles.list}>
            {filteredChannels.map((channel) => {
              const isFavorite = favoriteIds.includes(channel.id);
              return (
                <GlassCard
                  key={channel.id}
                  style={[styles.channelCard, tvMode && styles.tvChannelCard]}
                  intensity={18}
                >
                  <TVFocusable
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir ${channel.name}`}
                    onPress={() => handleChannel(channel.id)}
                    onLongPress={() => handleGuide(channel.id)}
                    style={styles.channelPressable}
                  >
                    <View style={styles.channelImage}>
                      {channel.logo ? (
                        <Image
                          source={{ uri: channel.logo }}
                          contentFit="cover"
                          style={StyleSheet.absoluteFill}
                        />
                      ) : null}
                      <View style={styles.imageVeil} />
                      <AppText style={styles.channelInitials}>
                        {channel.name.slice(0, 3).toUpperCase()}
                      </AppText>
                    </View>
                    <View style={styles.channelDetails}>
                      <View style={styles.channelTitleRow}>
                        <AppText style={styles.channelNumber}>{channel.number}</AppText>
                        <AppText style={styles.channelTitle}>{channel.name}</AppText>
                        <View style={styles.liveBadge}>
                          <View style={styles.liveDot} />
                          <AppText style={styles.liveText}>AO VIVO</AppText>
                        </View>
                      </View>
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
                    </View>
                    <TVFocusable
                      accessibilityRole="button"
                      accessibilityLabel={
                        isFavorite
                          ? `Remover ${channel.name} dos favoritos`
                          : `Favoritar ${channel.name}`
                      }
                      onPress={() => toggleFavorite(channel.id)}
                      hitSlop={8}
                      style={styles.favoriteButton}
                    >
                      <Ionicons
                        name={isFavorite ? "star" : "star-outline"}
                        size={20}
                        color={isFavorite ? Colors.amber : Colors.muted}
                      />
                    </TVFocusable>
                  </TVFocusable>
                </GlassCard>
              );
            })}
          </View>
        )}

        {/* No-results (search/filter returned 0) */}
        {!isEmpty && filteredChannels.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={28} color={Colors.subtle} />
            <AppText style={styles.emptyTitle}>Nenhum canal encontrado</AppText>
            <AppText style={styles.emptyBody}>Tente outra categoria ou ajuste a busca.</AppText>
          </View>
        ) : null}
      </ScrollView>
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
  cardPressable: {
    flex: 1,
  },
  logoArea: {
    height: 100,
    backgroundColor: Colors.backgroundRaised,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: {
    width: "80%",
    height: "80%",
  },
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
  logoInitials: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.blueBright,
  },
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
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.white,
  },
  liveText: {
    fontFamily: "Inter_700Bold",
    fontSize: 7,
    letterSpacing: 0.3,
    color: Colors.white,
  },
  numBadge: {
    position: "absolute",
    top: 7,
    left: 7,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  numText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 8,
    color: Colors.muted,
  },
  infoArea: {
    gap: 4,
    padding: 8,
    paddingBottom: 10,
  },
  channelName: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: Colors.text,
  },
  programName: {
    fontSize: 10,
    color: Colors.muted,
  },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.12)",
    marginTop: 2,
  },
  progressFill: {
    height: "100%",
    borderRadius: 1,
    backgroundColor: Colors.green,
  },
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
  content: { gap: 18, paddingTop: 22, paddingBottom: 35 },
  tvContent: { gap: 26, paddingTop: 30, paddingBottom: 50 },
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(16,185,129,0.1)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(16,185,129,0.2)",
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
  headerCopy: { flex: 1, gap: 4 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  kicker: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.green,
  },
  headerSubtitle: { fontSize: 13, color: Colors.muted },
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
  pressed: { opacity: 0.72 },
  categoryScroller: { flexGrow: 0, marginHorizontal: -20 },
  categoryContent: { gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  list: { gap: 10 },
  channelCard: { minHeight: 116, borderRadius: Radii.medium },
  tvChannelCard: { minHeight: 146 },
  channelPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 11,
  },
  channelImage: {
    width: 80,
    height: 88,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: Colors.backgroundRaised,
  },
  imageVeil: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(8, 12, 22, 0.45)" },
  channelInitials: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.white },
  channelDetails: { flex: 1, gap: 6 },
  channelTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  channelNumber: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.subtle },
  channelTitle: {
    flexShrink: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.text,
  },
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
  programTitle: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.text },
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
  nextProgram: { fontSize: 10, color: Colors.subtle },
  favoriteButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.06)",
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
    backgroundColor: Colors.blue,
  },
  syncBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.white },
});
