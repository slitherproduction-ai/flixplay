import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { Colors } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText, SearchField } from "@/components/ui";
import type { ChannelItem } from "@/store/types";
import { isPreviewClaimed, previewStillPlaying, registerPreview } from "@/features/live/live-preview-handoff";

const PREVIEW_SOURCE_DELAY_MS = 180;

type CategoryPanelProps = {
  categories: string[];
  activeCategory: string;
  filter: string;
  categoryCounts: ReadonlyMap<string, number>;
  onFilterChange: (value: string) => void;
  onSelect: (category: string) => void;
};

/** TV-only category column. Kept separate from the screen state for focus stability. */
export function TvCategoryPanel({
  categories,
  activeCategory,
  filter,
  categoryCounts,
  onFilterChange,
  onSelect,
}: CategoryPanelProps) {
  const filteredCategories = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase();
    return categories.filter((item) => !needle || item.toLocaleLowerCase().includes(needle));
  }, [categories, filter]);

  return (
    <View style={styles.categoryPane}>
      <SearchField value={filter} onChangeText={onFilterChange} placeholder="Pesquisar categoria" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
        {filteredCategories.map((item, index) => {
          const selected = item === activeCategory;
          return (
            <TVFocusable
              key={item}
              focusId={`live-category-${item}`}
              focusScope="live-categories"
              focusIndex={index}
              accessibilityRole="button"
              accessibilityLabel={`${item}, ${categoryCounts.get(item) ?? 0} canais`}
              onPress={() => onSelect(item)}
              style={[styles.categoryRow, selected && styles.categoryRowSelected]}
              focusStyle={styles.categoryRowFocused}
            >
              <AppText numberOfLines={1} style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>{item}</AppText>
              <AppText style={styles.categoryCount}>{categoryCounts.get(item) ?? 0}</AppText>
            </TVFocusable>
          );
        })}
      </ScrollView>
    </View>
  );
}

type ChannelPreviewProps = {
  channel: ChannelItem | undefined;
  width: number;
  /** A tab stays mounted after navigation; only the active route may emit audio. */
  active: boolean;
};

/** Isolated native preview surface so channel-list rendering never recreates its decoder. */
export function TvChannelPreview({ channel, width, active }: ChannelPreviewProps) {
  const streamUrl = channel?.streamUrl;
  const loadedStreamUrl = useRef<string | undefined>(undefined);
  const player = useVideoPlayer(null, (videoPlayer) => {
    videoPlayer.muted = true;
    videoPlayer.volume = 0;
    videoPlayer.audioMixingMode = "doNotMix";
    // A prévia é pequena e muda a cada canal: buffer mínimo para não disputar
    // memória com o player principal em TVs fracas.
    try {
      videoPlayer.bufferOptions = {
        preferredForwardBufferDuration: 6,
        minBufferForPlayback: 1,
        maxBufferBytes: 12 * 1024 * 1024,
        prioritizeTimeOverSizeThreshold: false,
      };
    } catch { /* opções de buffer indisponíveis: segue com o padrão */ }
  });

  // Seção descarregada (volta à Início): o player desta prévia é liberado
  // junto, então ele sai do registro de passagem para a tela cheia.
  useEffect(() => () => {
    if (!isPreviewClaimed()) registerPreview(null);
  }, []);

  // Ao voltar da tela cheia, a superfície de vídeo é recriada para o player
  // (que estava desenhando na tela cheia) voltar a desenhar na prévia.
  const [surfaceKey, setSurfaceKey] = useState(0);
  const wasClaimedRef = useRef(false);

  useEffect(() => {
    if (!active && isPreviewClaimed()) {
      // O player desta prévia está tocando em tela cheia: não pausar nem soltar.
      wasClaimedRef.current = true;
      return;
    }
    if (active && wasClaimedRef.current) {
      wasClaimedRef.current = false;
      // Devolvido pela tela cheia: se ainda toca o canal da prévia, segue sem
      // recarregar; senão (trocou de canal lá), carrega o canal da prévia.
      if (channel?.id && previewStillPlaying(player, channel.id)) {
        loadedStreamUrl.current = streamUrl;
      } else {
        loadedStreamUrl.current = undefined;
      }
      setSurfaceKey((value) => value + 1);
    }
    if (!active || !streamUrl) {
      // Ao abrir o player principal (ou sair da aba), libera a fonte da prévia:
      // só pausar manteria o decodificador e o buffer ocupados, e muitas TVs
      // (TCL, Fire TV Lite) têm um único decodificador de vídeo por hardware.
      try {
        player.pause();
        if (loadedStreamUrl.current) {
          player.replace(null);
          loadedStreamUrl.current = undefined;
          registerPreview(null);
        }
      } catch { /* native player may already be disposed */ }
      return;
    }
    const alreadyPlaying = loadedStreamUrl.current === streamUrl;
    const timer = setTimeout(() => {
      try {
        if (loadedStreamUrl.current !== streamUrl) {
          player.replace({ uri: streamUrl });
          loadedStreamUrl.current = streamUrl;
        }
        if (channel?.id) registerPreview({ player, channelId: channel.id, streamUrl });
        player.muted = true;
        player.volume = 0;
        player.play();
      } catch {
        // The native player retries while a live endpoint is becoming available.
      }
    }, alreadyPlaying ? 0 : PREVIEW_SOURCE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      // Emprestado à tela cheia: quem controla a reprodução agora é o player.
      if (isPreviewClaimed()) return;
      try { player.pause(); } catch { /* native player may already be disposed */ }
    };
  }, [active, channel?.id, streamUrl, player]);

  if (!channel) {
    return (
      <View style={[styles.preview, { width }]}>
        <View style={[styles.previewStage, styles.previewPlaceholder]}>
          <ActivityIndicator size="large" color={Colors.blueBright} />
          <AppText style={styles.previewPlaceholderText}>Preparando preview</AppText>
        </View>
        <View style={styles.previewCopy}>
          <AppText style={styles.previewProgram}>Selecione um canal para assistir</AppText>
          <AppText style={styles.previewDescription}>As informações do guia serão exibidas aqui.</AppText>
        </View>
      </View>
    );
  }

  const epg = channel.currentEpg;
  const hasSchedule = Boolean(epg.start || epg.end) && epg.title !== "Sem programação";
  return (
    <View style={[styles.preview, { width }]}>
      <View style={styles.previewStage}>
        <VideoView key={surfaceKey} player={player} contentFit="cover" nativeControls={false} surfaceType="textureView" style={StyleSheet.absoluteFill} />
        {channel.logo ? <Image source={{ uri: channel.logo }} contentFit="contain" style={styles.previewWatermark} /> : null}
        <LinearGradient colors={["rgba(3,8,16,0.06)", "rgba(3,8,16,0.66)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.previewLiveBadge}><View style={styles.liveDot} /><AppText style={styles.previewLiveText}>AO VIVO</AppText></View>
      </View>
      <View style={styles.previewCopy}>
        <AppText numberOfLines={2} style={styles.previewChannel}>{channel.name}</AppText>
        <AppText numberOfLines={2} style={styles.previewProgram}>{epg.title || "Carregando programação…"}</AppText>
        {hasSchedule ? (
          <View style={styles.previewTimeline}>
            <AppText style={styles.previewTime}>{epg.start}</AppText>
            <View style={styles.previewTrack}><View style={[styles.previewFill, { width: `${epg.progress}%` }]} /></View>
            <AppText style={styles.previewTime}>{epg.end}</AppText>
          </View>
        ) : (
          <View style={styles.previewLoading}><ActivityIndicator size="small" color={Colors.blueBright} /><AppText style={styles.previewLoadingText}>Buscando programação</AppText></View>
        )}
        <AppText numberOfLines={2} style={styles.previewDescription}>{epg.description || "Programação ao vivo do canal selecionado."}</AppText>
        <View style={styles.previewGuide}>
          <View style={[styles.previewGuideItem, styles.previewGuideItemActive]}><AppText style={styles.previewGuideLabel}>AGORA</AppText><AppText numberOfLines={1} style={styles.previewGuideTitle}>{epg.title || "Ao vivo"}</AppText></View>
          <View style={styles.previewGuideItem}><AppText style={styles.previewGuideLabel}>PRÓXIMO</AppText><AppText numberOfLines={1} style={styles.previewGuideTitle}>{channel.nextProgram || "Programação não informada"}</AppText></View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  categoryPane: { width: 220, flexShrink: 0, minHeight: 0, gap: 10, padding: 10, borderRadius: 12, backgroundColor: "rgba(9,18,33,0.70)", borderWidth: 1, borderColor: "rgba(152,196,240,0.14)" },
  categoryList: { gap: 2, paddingBottom: 10 },
  categoryRow: { minHeight: 33, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 9, borderRadius: 7 },
  categoryRowSelected: { backgroundColor: "rgba(61,155,235,0.20)" },
  categoryRowFocused: { backgroundColor: "rgba(69,165,238,0.30)", borderWidth: 1, borderColor: "rgba(156,221,255,0.92)", transform: [{ scale: 1 }] },
  categoryLabel: { flex: 1, color: "rgba(231,240,251,0.82)", fontFamily: "Inter_500Medium", fontSize: 12 },
  categoryLabelSelected: { color: Colors.text, fontFamily: "Inter_700Bold" },
  categoryCount: { color: Colors.subtle, fontFamily: "Inter_600SemiBold", fontSize: 10, fontVariant: ["tabular-nums"] },
  preview: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(190,224,255,0.24)", backgroundColor: "rgba(7,16,29,0.96)", overflow: "hidden" },
  previewStage: { aspectRatio: 16 / 9, backgroundColor: "#07101d", overflow: "hidden" },
  previewPlaceholder: { alignItems: "center", justifyContent: "center", gap: 12 },
  previewPlaceholderText: { color: Colors.muted, fontFamily: "Inter_600SemiBold", fontSize: 12 },
  previewWatermark: { position: "absolute", right: 14, bottom: 13, width: 66, height: 42, opacity: 0.78 },
  previewLiveBadge: { position: "absolute", top: 11, right: 11, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: "rgba(116,16,36,0.88)" },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.red },
  previewLiveText: { fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.5, color: "#FFD8DD" },
  previewCopy: { gap: 7, padding: 13 },
  previewChannel: { fontFamily: "Inter_700Bold", fontSize: 16, lineHeight: 20, color: Colors.text },
  previewProgram: { fontFamily: "Inter_600SemiBold", fontSize: 12, lineHeight: 16, color: Colors.text },
  previewTimeline: { flexDirection: "row", alignItems: "center", gap: 7 },
  previewTime: { fontSize: 10, color: Colors.subtle, fontVariant: ["tabular-nums"] },
  previewTrack: { flex: 1, height: 4, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.16)" },
  previewFill: { height: "100%", borderRadius: 3, backgroundColor: Colors.blueBright },
  previewLoading: { minHeight: 22, flexDirection: "row", alignItems: "center", gap: 8 },
  previewLoadingText: { fontSize: 11, color: Colors.muted },
  previewDescription: { fontSize: 10, lineHeight: 14, color: "rgba(215,229,245,0.72)" },
  previewGuide: { flexDirection: "row", gap: 8, marginTop: 2 },
  previewGuideItem: { flex: 1, gap: 3, minHeight: 48, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: "rgba(174,208,241,0.13)", backgroundColor: "rgba(11,24,42,0.68)" },
  previewGuideItemActive: { borderLeftWidth: 3, borderLeftColor: Colors.blueBright, backgroundColor: "rgba(26,93,153,0.20)" },
  previewGuideLabel: { color: Colors.blueBright, fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.7 },
  previewGuideTitle: { color: Colors.text, fontFamily: "Inter_600SemiBold", fontSize: 11 },
});
