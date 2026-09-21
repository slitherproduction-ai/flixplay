import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { channels, DEMO_STREAM_URL, movies } from "@/data/demo";
import { Colors, Shadows } from "@/constants/theme";
import { AppText, ChannelLogo, GlassCard, IconButton } from "@/components/ui";
import { useScreenLoad } from "@/hooks/useScreenLoad";
import { useAppStore } from "@/store/useAppStore";
import type { ContentType } from "@/store/types";

type Panel = "audio" | "subtitles" | "speed" | "ratio" | null;
type ActivePanel = Exclude<Panel, null>;

const PANEL_TITLES: Record<ActivePanel, string> = {
  audio: "Faixa de Áudio",
  subtitles: "Legendas",
  speed: "Velocidade",
  ratio: "Proporção de Tela",
};

const PANEL_OPTIONS: Record<ActivePanel, string[]> = {
  audio: ["Português (5.1)", "Inglês (Original)"],
  subtitles: ["Português", "Português SDH", "Desativadas"],
  speed: ["0.5x", "1.0x", "1.25x", "1.5x", "2.0x"],
  ratio: ["Original", "16:9", "Zoom", "Esticado"],
};

export default function PlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; title?: string | string[]; type?: string | string[]; streamUrl?: string | string[] }>();
  const id = readParam(params.id) ?? "demo-player";
  const title = readParam(params.title) ?? "FlixPlay Demo";
  const type = readParam(params.type) ?? "movie";
  const streamUrl = readParam(params.streamUrl) ?? DEMO_STREAM_URL;
  const { loading, error, retry } = useScreenLoad("o player");
  const saveHistory = useAppStore((state) => state.saveHistory);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [quickSwitcherVisible, setQuickSwitcherVisible] = useState(type === "live");
  const [panel, setPanel] = useState<Panel>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const player = useVideoPlayer(streamUrl, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.play();
  });
  const currentChannel = channels.find((channel) => channel.id === id);
  const backdrop = currentChannel?.logo ?? movies.find((movie) => movie.id === id)?.backdrop ?? movies[0].backdrop;
  const contentType: ContentType = type === "live" ? "live" : type === "episode" ? "episode" : type === "series" ? "series" : "movie";

  useEffect(() => {
    const subscription = player.addListener("statusChange", (status) => {
      if (status.status === "error") {
        setPlayerError(status.error?.message ?? "O stream não pôde ser reproduzido.");
      }
    });
    return () => subscription.remove();
  }, [player]);

  const handleBack = useCallback(() => {
    try {
      saveHistory({
        contentId: id,
        type: contentType,
        title,
        subtitle: contentType === "live" ? "Canal ao vivo" : "Retomar reprodução",
        thumbnail: backdrop,
        positionMs: contentType === "live" ? 0 : 2520000,
        durationMs: contentType === "live" ? 0 : 3600000,
        updatedAt: new Date().toISOString(),
      });
    } catch (saveError) {
      console.error("Falha ao salvar histórico do player", saveError);
    }
    router.back();
  }, [backdrop, contentType, id, router, saveHistory, title]);

  const handleTogglePlayback = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
    setIsPlaying((value) => !value);
  }, [isPlaying, player]);

  const handlePanel = useCallback((nextPanel: Panel) => {
    setPanel((current) => current === nextPanel ? null : nextPanel);
  }, []);

  const handleSwitchChannel = useCallback((channelId: string) => {
    const channel = channels.find((item) => item.id === channelId);
    if (!channel) return;
    try {
      player.replace(channel.streamUrl);
      setPlayerError(null);
      setIsPlaying(true);
      router.setParams({ id: channel.id, title: channel.name, type: "live", streamUrl: channel.streamUrl });
    } catch (switchError) {
      console.error("Falha ao trocar de canal", switchError);
      setPlayerError("Não foi possível trocar para este canal.");
    }
  }, [player, router]);

  const handleTap = useCallback(() => {
    setControlsVisible((value) => !value);
  }, []);

  const handleOpenSubtitles = useCallback(() => {
    setPanel("subtitles");
  }, []);

  const handleToggleQuickSwitcher = useCallback(() => {
    setQuickSwitcherVisible((value) => !value);
  }, []);

  const handleCloseQuickSwitcher = useCallback(() => {
    setQuickSwitcherVisible(false);
  }, []);

  const handleRetry = useCallback(() => {
    setPlayerError(null);
    void retry();
  }, [retry]);

  return (
    <View style={styles.screen}>
      <Image source={{ uri: backdrop }} contentFit="cover" style={StyleSheet.absoluteFill} />
      <View style={styles.backdropVeil} />
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <Pressable accessibilityLabel="Mostrar ou ocultar controles" onPress={handleTap} style={StyleSheet.absoluteFill} />
      <View pointerEvents="box-none" style={styles.overlay}>
        {controlsVisible ? <PlayerTopBar title={title} contentType={contentType} onBack={handleBack} onOpenSubtitles={handleOpenSubtitles} onToggleQuickSwitcher={handleToggleQuickSwitcher} /> : null}
        <QuickSwitcher visible={quickSwitcherVisible && controlsVisible} currentId={id} onSwitch={handleSwitchChannel} onClose={handleCloseQuickSwitcher} />
        <PlayerStatus loading={loading} error={playerError ?? error} onRetry={handleRetry} />
        {controlsVisible ? <PlayerBottomPanel contentType={contentType} isPlaying={isPlaying} panel={panel} onTogglePlayback={handleTogglePlayback} onPanelChange={handlePanel} onClosePanel={() => setPanel(null)} /> : null}
      </View>
    </View>
  );
}

function PlayerTopBar({ title, contentType, onBack, onOpenSubtitles, onToggleQuickSwitcher }: { title: string; contentType: ContentType; onBack: () => void; onOpenSubtitles: () => void; onToggleQuickSwitcher: () => void }) {
  return <View pointerEvents="box-none" style={styles.topBar}><IconButton icon="chevron-back" label="Voltar" onPress={onBack} /><View style={styles.titleBar}><AppText numberOfLines={1} style={styles.playerTitle}>{title}</AppText><View style={styles.liveLine}><View style={styles.playerLiveDot} /><AppText style={styles.playerMeta}>{contentType === "live" ? "AO VIVO" : "FLIXPLAY DEMO"}</AppText></View></View><View style={styles.topActions}><IconButton icon="sync-outline" label="Trakt scrobble ativo" active onPress={onOpenSubtitles} /><IconButton icon="albums-outline" label="Abrir canais recentes" onPress={onToggleQuickSwitcher} /></View></View>;
}

function QuickSwitcher({ visible, currentId, onSwitch, onClose }: { visible: boolean; currentId: string; onSwitch: (channelId: string) => void; onClose: () => void }) {
  if (!visible) return null;
  return <GlassCard style={styles.quickSwitcher} intensity={32}><View style={styles.quickHeader}><View><AppText style={styles.quickKicker}>ZAPPING RÁPIDO</AppText><AppText style={styles.quickTitle}>Canais Recentes</AppText></View><IconButton icon="close" label="Fechar canais recentes" size={34} onPress={onClose} /></View>{channels.slice(0, 4).map((channel) => <QuickChannel key={channel.id} channelId={channel.id} name={channel.name} logo={channel.logo} program={channel.currentEpg.title} progress={channel.currentEpg.progress} active={channel.id === currentId} onSwitch={onSwitch} />)}</GlassCard>;
}

function QuickChannel({ channelId, name, logo, program, progress, active, onSwitch }: { channelId: string; name: string; logo: string; program: string; progress: number; active: boolean; onSwitch: (channelId: string) => void }) {
  const handlePress = useCallback(() => {
    onSwitch(channelId);
  }, [channelId, onSwitch]);

  return <Pressable accessibilityRole="button" onPress={handlePress} style={({ pressed }) => [styles.quickChannel, active && styles.quickChannelActive, pressed && styles.pressed]}><ChannelLogo image={logo} name={name} size={42} /><View style={styles.quickCopy}><AppText style={styles.quickChannelName}>{name}</AppText><AppText numberOfLines={1} style={styles.quickProgram}>{program}</AppText><View style={styles.quickProgress}><View style={[styles.quickProgressFill, { width: `${progress}%` }]} /></View></View>{active ? <Ionicons name="radio" size={16} color={Colors.blueBright} /> : null}</Pressable>;
}

function PlayerStatus({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  return <>{loading ? <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={Colors.white} /><AppText style={styles.loadingText}>Preparando reprodução...</AppText></View> : null}{error ? <View style={styles.playerError}><Ionicons name="warning-outline" size={17} color={Colors.amber} /><AppText style={styles.playerErrorText}>{error}</AppText><Pressable accessibilityRole="button" onPress={onRetry}><AppText style={styles.playerRetry}>Tentar</AppText></Pressable></View> : null}</>;
}

function PlayerBottomPanel({ contentType, isPlaying, panel, onTogglePlayback, onPanelChange, onClosePanel }: { contentType: ContentType; isPlaying: boolean; panel: Panel; onTogglePlayback: () => void; onPanelChange: (panel: Panel) => void; onClosePanel: () => void }) {
  const handleBackward = useCallback(() => onPanelChange("ratio"), [onPanelChange]);
  const handleForward = useCallback(() => onPanelChange("speed"), [onPanelChange]);

  return <View style={styles.bottomPanel}><View style={styles.timelineRow}><AppText style={styles.timeText}>{contentType === "live" ? "15:42" : "42:18"}</AppText><View style={styles.timeline}><View style={styles.timelineFill} /><View style={styles.timelineKnob} /></View><AppText style={styles.timeText}>{contentType === "live" ? "AO VIVO" : "1:46:12"}</AppText></View><View style={styles.mainControls}><Pressable accessibilityRole="button" accessibilityLabel="Retroceder 10 segundos" onPress={handleBackward} style={styles.controlButton}><Ionicons name="refresh" size={21} color={Colors.white} /><AppText style={styles.controlHint}>10</AppText></Pressable><Pressable accessibilityRole="button" accessibilityLabel={isPlaying ? "Pausar" : "Reproduzir"} onPress={onTogglePlayback} style={styles.playButton}><Ionicons name={isPlaying ? "pause" : "play"} size={25} color={Colors.background} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Avançar 10 segundos" onPress={handleForward} style={styles.controlButton}><Ionicons name="refresh" size={21} color={Colors.white} style={styles.forwardIcon} /><AppText style={styles.controlHint}>10</AppText></Pressable></View><View style={styles.optionRow}><PlayerOptionButton icon="musical-notes-outline" label="Faixa de Áudio" panel="audio" active={panel === "audio"} onPanelChange={onPanelChange} /><PlayerOptionButton icon="chatbox-ellipses-outline" label="Legendas" panel="subtitles" active={panel === "subtitles"} onPanelChange={onPanelChange} /><PlayerOptionButton icon="speedometer-outline" label="Velocidade" panel="speed" active={panel === "speed"} onPanelChange={onPanelChange} /><PlayerOptionButton icon="scan-outline" label="Proporção" panel="ratio" active={panel === "ratio"} onPanelChange={onPanelChange} /></View>{panel ? <PlayerOptionMenu panel={panel} onClose={onClosePanel} /> : null}</View>;
}

function PlayerOptionButton({ icon, label, panel, active, onPanelChange }: { icon: keyof typeof Ionicons.glyphMap; label: string; panel: ActivePanel; active: boolean; onPanelChange: (panel: Panel) => void }) {
  const handlePress = useCallback(() => {
    onPanelChange(panel);
  }, [onPanelChange, panel]);

  return <OptionButton icon={icon} label={label} active={active} onPress={handlePress} />;
}

function PlayerOptionMenu({ panel, onClose }: { panel: ActivePanel; onClose: () => void }) {
  return <View style={styles.optionMenu}><AppText style={styles.optionMenuTitle}>{PANEL_TITLES[panel]}</AppText><View style={styles.optionValues}>{PANEL_OPTIONS[panel].map((value, index) => <OptionValue key={value} value={value} selected={index === 1} onSelect={onClose} />)}</View></View>;
}

function OptionValue({ value, selected, onSelect }: { value: string; selected: boolean; onSelect: () => void }) {
  const handlePress = useCallback(() => {
    onSelect();
  }, [onSelect]);

  return <Pressable accessibilityRole="button" onPress={handlePress} style={[styles.optionValue, selected && styles.optionValueSelected]}><AppText style={[styles.optionValueText, selected && styles.optionValueTextSelected]}>{value}</AppText>{selected ? <Ionicons name="checkmark" size={16} color={Colors.blueBright} /> : null}</Pressable>;
}

function OptionButton({ icon, label, active, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.optionButton, active && styles.optionButtonActive, pressed && styles.pressed]}><Ionicons name={icon} size={18} color={active ? Colors.blueBright : Colors.text} /><AppText style={styles.optionLabel}>{label}</AppText></Pressable>;
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden", backgroundColor: Colors.black },
  backdropVeil: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.44)" },
  overlay: { flex: 1, justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 22 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 11 },
  titleBar: { flex: 1, gap: 4 },
  playerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.white },
  liveLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  playerLiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.red },
  playerMeta: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 0.7, color: "rgba(255,255,255,0.7)" },
  topActions: { flexDirection: "row", gap: 7 },
  quickSwitcher: { position: "absolute", top: 75, right: 18, left: 18, padding: 12, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(17,23,36,0.82)", ...Shadows.card },
  quickHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  quickKicker: { fontFamily: "Inter_600SemiBold", fontSize: 8, letterSpacing: 1, color: Colors.blueBright },
  quickTitle: { marginTop: 3, fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.white },
  quickChannel: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 10, padding: 7, borderRadius: 12 },
  quickChannelActive: { backgroundColor: "rgba(59,130,246,0.15)" },
  quickCopy: { flex: 1, gap: 3 },
  quickChannelName: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.white },
  quickProgram: { fontSize: 10, color: "rgba(255,255,255,0.68)" },
  quickProgress: { height: 3, overflow: "hidden", borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)" },
  quickProgressFill: { height: "100%", backgroundColor: Colors.blueBright },
  loadingOverlay: { position: "absolute", top: "42%", alignSelf: "center", alignItems: "center", gap: 10, padding: 17, borderRadius: 16, backgroundColor: "rgba(7,9,14,0.65)" },
  loadingText: { fontSize: 12, color: Colors.white },
  playerError: { position: "absolute", top: "44%", right: 24, left: 24, flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, backgroundColor: "rgba(7,9,14,0.84)" },
  playerErrorText: { flex: 1, fontSize: 11, color: Colors.text },
  playerRetry: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.blueBright },
  bottomPanel: { gap: 12, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.17)", backgroundColor: "rgba(7,9,14,0.72)" },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  timeText: { minWidth: 37, fontVariant: ["tabular-nums"], fontFamily: "Inter_500Medium", fontSize: 10, color: Colors.white },
  timeline: { flex: 1, height: 4, overflow: "visible", borderRadius: 3, backgroundColor: "rgba(255,255,255,0.28)" },
  timelineFill: { width: "39%", height: "100%", borderRadius: 3, backgroundColor: Colors.white },
  timelineKnob: { position: "absolute", top: -5, left: "37%", width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.white },
  mainControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28 },
  controlButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  controlHint: { position: "absolute", fontFamily: "Inter_700Bold", fontSize: 8, color: Colors.white },
  forwardIcon: { transform: [{ rotate: "180deg" }] },
  playButton: { width: 53, height: 53, alignItems: "center", justifyContent: "center", borderRadius: 27, backgroundColor: Colors.white },
  optionRow: { flexDirection: "row", justifyContent: "space-between", gap: 5 },
  optionButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 3, borderRadius: 11 },
  optionButtonActive: { backgroundColor: "rgba(59,130,246,0.16)" },
  optionLabel: { fontFamily: "Inter_500Medium", fontSize: 9, color: "rgba(255,255,255,0.75)" },
  optionMenu: { gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)" },
  optionMenuTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.white },
  optionValues: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  optionValue: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.06)" },
  optionValueSelected: { borderColor: "rgba(96,165,250,0.5)", backgroundColor: "rgba(59,130,246,0.18)" },
  optionValueText: { fontFamily: "Inter_500Medium", fontSize: 10, color: Colors.muted },
  optionValueTextSelected: { color: Colors.white },
  pressed: { opacity: 0.72 },
});
