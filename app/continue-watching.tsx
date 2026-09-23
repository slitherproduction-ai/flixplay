import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Radii } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useAppStore } from "@/store/useAppStore";
import type { ContentType, PlayHistory } from "@/store/types";

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "agora mesmo";
    if (mins < 60) return `há ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `há ${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "ontem";
    if (days < 7) return `há ${days} dias`;
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

function formatProgress(positionMs: number, durationMs: number): string {
  if (!durationMs || durationMs <= 0) return "";
  const remainMs = Math.max(0, durationMs - positionMs);
  const remainMins = Math.ceil(remainMs / 60000);
  if (remainMins <= 1) return "Quase no final";
  if (remainMins < 60) return `Restam ${remainMins} min`;
  const hrs = Math.floor(remainMins / 60);
  const mins = remainMins % 60;
  return mins > 0 ? `Restam ${hrs}h ${mins}min` : `Restam ${hrs}h`;
}

interface HistoryCardProps {
  item: PlayHistory;
  onResume: (item: PlayHistory) => void;
  onRemove: (contentId: string) => void;
}

function HistoryCard({ item, onResume, onRemove }: HistoryCardProps) {
  const progress = item.durationMs > 0
    ? Math.min(100, Math.round((item.positionMs / item.durationMs) * 100))
    : 0;
  const remainLabel = item.durationMs > 0
    ? formatProgress(item.positionMs, item.durationMs)
    : "";

  const handleResume = useCallback(() => onResume(item), [item, onResume]);
  const handleRemove = useCallback(() => onRemove(item.contentId), [item.contentId, onRemove]);

  return (
    <View style={styles.card}>
      <TVFocusable
        accessibilityRole="button"
        accessibilityLabel={`Continuar assistindo ${item.title}`}
        onPress={handleResume}
        style={({ pressed }) => [styles.cardPressable, pressed && { opacity: 0.8 }]}
      >
        {/* Thumbnail */}
        <View style={styles.thumbWrap}>
          {item.thumbnail ? (
            <Image
              source={{ uri: item.thumbnail }}
              contentFit="cover"
              style={StyleSheet.absoluteFill}
              transition={200}
            />
          ) : (
            <View style={styles.thumbFallback}>
              <Ionicons name="film-outline" size={26} color={Colors.subtle} />
            </View>
          )}
          <View style={styles.thumbShade} />
          {/* Progress bar on thumbnail */}
          <View style={styles.thumbProgress}>
            <View style={[styles.thumbProgressFill, { width: `${progress}%` }]} />
          </View>
          {/* Play button */}
          <View style={styles.playBtn}>
            <Ionicons name="play" size={14} color={Colors.white} />
          </View>
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <AppText style={styles.cardTitle} numberOfLines={2}>{item.title}</AppText>
          <AppText style={styles.cardSubtitle} numberOfLines={1}>{item.subtitle}</AppText>

          {/* Progress row */}
          {item.durationMs > 0 ? (
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <AppText style={styles.progressLabel}>{progress}%</AppText>
            </View>
          ) : null}

          {remainLabel ? (
            <AppText style={styles.remainLabel}>{remainLabel}</AppText>
          ) : null}

          <View style={styles.cardMeta}>
            <Ionicons name="time-outline" size={11} color={Colors.subtle} />
            <AppText style={styles.timeLabel}>{formatRelativeTime(item.updatedAt)}</AppText>
          </View>
        </View>
      </TVFocusable>

      {/* Remove button */}
      <TVFocusable
        accessibilityRole="button"
        accessibilityLabel={`Remover ${item.title} do histórico`}
        onPress={handleRemove}
        hitSlop={8}
        style={styles.removeBtn}
      >
        <Ionicons name="close" size={16} color={Colors.subtle} />
      </TVFocusable>
    </View>
  );
}

export default function ContinueWatchingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tvMode = useTVMode();
  const allHistory = useAppStore((state) => state.history);
  const removeHistoryItem = useAppStore((state) => state.removeHistoryItem);
  const clearHistory = useAppStore((state) => state.clearHistory);
  const vodMovies = useAppStore((state) => state.contentCache.vodMovies);
  // Only show movies and series (not live TV), sorted by last watched.
  // For episodes: deduplicate by series — keep only the most recently watched
  // episode per series so each show appears once (like Netflix / Prime Video).
  const watchHistory = useMemo(() => {
    const sorted = allHistory
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
      // Episode IDs follow the pattern ep-{seriesId}-s{N}-e{N}
      const match = item.contentId.match(/^ep-(.+?)-s\d+-e\d+$/);
      if (!match) return true;
      const seriesKey = match[1];
      if (seenSeriesIds.has(seriesKey)) return false;
      seenSeriesIds.add(seriesKey);
      return true;
    });
  }, [allHistory]);

  const handleResume = useCallback((item: PlayHistory) => {
    const type = item.type as ContentType;
    if (item.streamUrl) {
      router.push({
        pathname: "/player",
        params: {
          id: item.contentId,
          title: item.title,
          type,
          streamUrl: item.streamUrl,
          subtitle: item.subtitle,
          thumbnail: item.thumbnail,
          seriesId: item.seriesId,
        },
      });
    } else if (type === "movie") {
      // For movies, open the details page which has the play button
      const movie = vodMovies.find((m) => m.id === item.contentId);
      if (movie) {
        router.push({
          pathname: "/player",
          params: {
            id: movie.id,
            title: movie.title,
            type: "movie",
            streamUrl: movie.streamUrl,
          },
        });
      } else {
        router.push(`/details/${item.contentId}`);
      }
    } else {
      // For series/episodes, navigate to details
      router.push(`/details/${item.seriesId ?? item.contentId}`);
    }
  }, [router, vodMovies]);

  const handleRemove = useCallback((contentId: string) => {
    removeHistoryItem(contentId);
  }, [removeHistoryItem]);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      "Limpar histórico",
      "Remover todos os títulos de Continuar Assistindo?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpar tudo",
          style: "destructive",
          onPress: () => { clearHistory(); },
        },
      ],
    );
  }, [clearHistory]);

  const handleBack = useCallback(() => router.back(), [router]);

  const keyExtractor = useCallback((item: PlayHistory) => item.contentId, []);

  const renderItem = useCallback(
    ({ item }: { item: PlayHistory }) => (
      <HistoryCard item={item} onResume={handleResume} onRemove={handleRemove} />
    ),
    [handleResume, handleRemove],
  );

  const hPad = tvMode ? 46 : 20;

  return (
    <View style={styles.screen}>
      {/* Ambient glow */}
      <View style={styles.ambient} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, paddingHorizontal: hPad }]}>
        <TVFocusable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={handleBack}
          style={styles.backBtn}
          hasTVPreferredFocus
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TVFocusable>
        <View style={styles.headerCopy}>
          <AppText style={styles.kicker}>REPRODUÇÃO RECENTE</AppText>
          <AppText style={styles.title}>Continuar Assistindo</AppText>
        </View>
        {watchHistory.length > 0 ? (
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel="Limpar histórico"
            onPress={handleClearAll}
            style={styles.clearBtn}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.subtle} />
            <AppText style={styles.clearText}>Limpar</AppText>
          </TVFocusable>
        ) : null}
      </View>

      {/* List */}
      <FlatList
        data={watchHistory}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.list,
          { paddingHorizontal: hPad, paddingBottom: insets.bottom + 32 },
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={36} color={Colors.subtle} />
            <AppText style={styles.emptyTitle}>Sem conteúdo recente</AppText>
            <AppText style={styles.emptyBody}>
              Assista filmes e séries pelo FlixPlay e eles aparecerão aqui para continuar de onde parou.
            </AppText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  ambient: {
    position: "absolute",
    top: -80,
    left: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(59,130,246,0.08)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radii.small,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.glassSoft,
  },
  headerCopy: { flex: 1, gap: 2 },
  kicker: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.2,
    color: Colors.blueBright,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    letterSpacing: -0.5,
    color: Colors.text,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.small,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.glassSoft,
  },
  clearText: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.subtle },
  list: { paddingTop: 16, gap: 0 },
  separator: { height: 12 },
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.glassSoft,
    overflow: "hidden",
  },
  cardPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
  },
  thumbWrap: {
    width: 148,
    height: 110,
    backgroundColor: Colors.backgroundRaised,
    overflow: "hidden",
  },
  thumbFallback: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.backgroundRaised,
  },
  thumbShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(7,9,14,0.28)",
  },
  thumbProgress: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  thumbProgressFill: {
    height: "100%",
    backgroundColor: Colors.blueBright,
  },
  playBtn: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: Colors.blue,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
    padding: 12,
    justifyContent: "center",
  },
  cardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  cardSubtitle: { fontSize: 11, color: Colors.muted },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 2,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    overflow: "hidden",
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: Colors.blueBright,
  },
  progressLabel: {
    fontVariant: ["tabular-nums"],
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.muted,
    minWidth: 28,
    textAlign: "right",
  },
  remainLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.blueBright,
  },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  timeLabel: { fontSize: 10, color: Colors.subtle },
  removeBtn: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 60,
    paddingHorizontal: 32,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.glassSoft,
    marginTop: 24,
  },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: Colors.text },
  emptyBody: {
    maxWidth: 280,
    textAlign: "center",
    fontSize: 13,
    color: Colors.muted,
    lineHeight: 19,
  },
});
