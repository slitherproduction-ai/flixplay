import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Platform, ScrollView, Share, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui";
import { PremiumBackdrop, PremiumTopBar, premium, usePremiumContentStyle } from "@/components/premium-screen";
import { TVFocusable } from "@/components/tv-focusable";
import { APP_INFO } from "@/constants/app";
import { Colors } from "@/constants/theme";
import { catalogDatabase } from "@/data/database/catalogDatabase";
import { authenticateXtream } from "@/services/xtream";
import { sanitizeError } from "@/services/security/sanitize";
import { useAppStore } from "@/store/useAppStore";
import {
  clearPerformanceHistory,
  describeExit,
  describeLog,
  describePause,
  describeSync,
  describeOpens,
  describeTrim,
  formatPerformanceReport,
  getPerformanceReport,
  seconds,
  type PerformanceReport,
} from "@/services/performanceMonitor";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DiagnosticsScreen() {
  const router = useRouter();
  const { tvMode, isTablet } = useResponsiveLayout();
  const servers = useAppStore((state) => state.servers);
  const activeServerId = useAppStore((state) => state.activeServerId);
  const cache = useAppStore((state) => state.contentCache);
  const syncState = useAppStore((state) => state.syncState);
  const clearContentCache = useAppStore((state) => state.clearContentCache);
  const forceResync = useAppStore((state) => state.forceResync);
  const activeServer = servers.find((server) => server.id === activeServerId);
  const [cacheBytes, setCacheBytes] = useState(0);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [perf, setPerf] = useState<PerformanceReport | null>(null);
  const [totals, setTotals] = useState<{ live: number; movies: number; series: number } | null>(null);

  const refreshPerformance = useCallback(async () => {
    setPerf(await getPerformanceReport());
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refreshPerformance(), 0);
    return () => clearTimeout(timer);
  }, [refreshPerformance]);

  // Na TV, filmes e séries ficam no banco local (páginas); a memória só tem
  // uma amostra. O total certo vem do banco.
  useEffect(() => {
    if (!activeServerId || !catalogDatabase.isAvailable()) return;
    let cancelled = false;
    void Promise.all([
      catalogDatabase.count(activeServerId, "liveChannels"),
      catalogDatabase.count(activeServerId, "vodMovies"),
      catalogDatabase.count(activeServerId, "seriesList"),
    ]).then(([live, movies, series]) => {
      if (!cancelled) setTotals({ live, movies, series });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [activeServerId, cache.lastSyncedAt]);

  const liveTotal = Math.max(totals?.live ?? 0, cache.liveCount ?? 0, cache.liveChannels.length);
  const moviesTotal = Math.max(totals?.movies ?? 0, cache.vodMovies.length);
  const seriesTotal = Math.max(totals?.series ?? 0, cache.seriesList.length);

  const clearPerformance = useCallback(async () => {
    await clearPerformanceHistory();
    await refreshPerformance();
  }, [refreshPerformance]);

  const refreshCacheSize = useCallback(async () => {
    setCacheBytes(await catalogDatabase.getApproximateSize());
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refreshCacheSize(), 0);
    return () => clearTimeout(timer);
  }, [refreshCacheSize]);

  const testConnection = useCallback(async () => {
    if (!activeServer) return;
    setTesting(true);
    const started = Date.now();
    try {
      const result = await authenticateXtream(activeServer);
      setLatencyMs(Date.now() - started);
      Alert.alert(result.user_info ? "Servidor respondeu" : "Resposta inválida", `Latência aproximada: ${Date.now() - started} ms`);
    } catch (error) {
      setLatencyMs(null);
      Alert.alert("Falha de conexão", sanitizeError(error));
    } finally {
      setTesting(false);
    }
  }, [activeServer]);

  const clearCache = useCallback(async () => {
    if (activeServerId) await catalogDatabase.clearServer(activeServerId);
    clearContentCache();
    await refreshCacheSize();
    Alert.alert("Cache limpo", "Os dados locais desta lista foram removidos.");
  }, [activeServerId, clearContentCache, refreshCacheSize]);

  const rebuild = useCallback(async () => {
    if (activeServerId) await catalogDatabase.clearServer(activeServerId);
    clearContentCache();
    forceResync();
    router.back();
  }, [activeServerId, clearContentCache, forceResync, router]);

  const report = useMemo(() => [
    `ELVANOQ ${APP_INFO.version} (${APP_INFO.build})`,
    `Plataforma: ${Platform.OS}`,
    `Dispositivo: ${Constants.deviceName ?? "Não informado"}`,
    `Sistema: ${String(Platform.Version)}`,
    `Status do servidor: ${activeServer?.status ?? "Não informado"}`,
    `Latência: ${latencyMs === null ? "Não medida" : `${latencyMs} ms`}`,
    `Última sincronização: ${cache.lastSyncedAt ?? "Não informado"}`,
    `Canais: ${liveTotal}`,
    `Filmes: ${moviesTotal}`,
    `Séries: ${seriesTotal}`,
    `Cache: ${formatBytes(cacheBytes)}`,
    `Último erro: ${syncState.syncError ? sanitizeError(syncState.syncError) : "Nenhum"}`,
    ...(perf ? formatPerformanceReport(perf) : []),
  ].join("\n"), [activeServer?.status, cache.lastSyncedAt, cacheBytes, latencyMs, liveTotal, moviesTotal, perf, seriesTotal, syncState.syncError]);

  const shareReport = useCallback(async () => {
    await refreshPerformance();
    await Share.share({ title: "Diagnóstico ELVANOQ", message: report });
  }, [report]);


  const columns = tvMode || isTablet;
  const contentStyle = usePremiumContentStyle({ tvMode, wide: isTablet }, columns ? 1180 : 820);
  const hasError = Boolean(syncState.syncError);
  const syncNow = syncState.isSyncing ? (syncState.syncProgress ?? "Em andamento") : hasError ? "Parou com erro" : "Parada";
  const memoryWarn = Boolean(perf?.memory?.lowMemory);

  return (
    <View style={premium.screen}>
      <PremiumBackdrop />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[contentStyle, styles.content]}>
        <PremiumTopBar title="Diagnóstico" onBack={() => router.back()} />

        {/* Resumo: números do catálogo e versão numa faixa só */}
        <View style={styles.summary}>
          <Metric label="Canais" value={liveTotal} />
          <Metric label="Filmes" value={moviesTotal} />
          <Metric label="Séries" value={seriesTotal} />
          <View style={[styles.metric, styles.metricWide]}>
            <AppText numberOfLines={1} style={styles.metricText}>{`v${APP_INFO.version} · build ${APP_INFO.build}`}</AppText>
            <AppText numberOfLines={1} style={styles.metricLabel}>{perf?.tier ?? "Perfil do aparelho"}</AppText>
          </View>
        </View>

        {/* Ações em botões compactos (o foco da TV começa aqui) */}
        <View style={styles.actions}>
          <ActionChip icon="speedometer-outline" label={testing ? "Testando…" : "Testar conexão"} disabled={!activeServer || testing} preferred onPress={testConnection} />
          <ActionChip icon="refresh-outline" label="Atualizar lista" onPress={() => { forceResync(); router.back(); }} />
          <ActionChip icon="share-outline" label="Compartilhar relatório" onPress={shareReport} />
          <ActionChip icon="pulse-outline" label="Atualizar medições" onPress={() => void refreshPerformance()} />
          <ActionChip icon="trash-outline" label="Limpar cache" onPress={clearCache} />
          <ActionChip icon="construct-outline" label="Reconstruir banco" destructive onPress={rebuild} />
          <ActionChip icon="close-circle-outline" label="Limpar histórico" onPress={() => void clearPerformance()} />
        </View>

        <View style={columns ? styles.grid : styles.stack}>
          <Panel title="Conexão e aparelho" wide={columns}>
            <InfoRow label="Servidor" value={activeServer?.status ?? "Não informado"} />
            <InfoRow label="Latência" value={latencyMs === null ? "Não medida" : `${latencyMs} ms`} />
            <InfoRow label="Última sincronização" value={cache.lastSyncedAt ? new Date(cache.lastSyncedAt).toLocaleString("pt-BR") : "Não informado"} />
            <InfoRow label="Sincronização agora" value={syncNow} />
            <InfoRow label="Último erro" value={hasError ? sanitizeError(syncState.syncError) : "Nenhum"} alert={hasError} />
            <InfoRow label="Sistema" value={`${Platform.OS} ${String(Platform.Version)}`} />
            <InfoRow label="Dispositivo" value={Constants.deviceName ?? "Não informado"} />
            <InfoRow label="Cache local" value={formatBytes(cacheBytes)} />
          </Panel>

          <Panel title="Desempenho" wide={columns}>
            <InfoRow label="Abertura do app" value={perf?.startupMs != null ? seconds(perf.startupMs) : "Não medida"} />
            <InfoRow label="Memória livre" value={perf?.memory ? `${Math.round(perf.memory.availMemMb)} de ${Math.round(perf.memory.totalMemMb)} MB` : "Não disponível"} alert={memoryWarn} />
            <InfoRow label="Memória do app" value={perf?.memory ? `${Math.round(perf.memory.javaHeapUsedMb + perf.memory.nativeHeapMb)} MB` : "Não disponível"} />
            <InfoRow label="Pouca memória" value={describeTrim(perf?.memory ?? null)} alert={Boolean(perf?.memory?.trimCount)} />
            <InfoRow label="Pausas da tela" value={perf ? (perf.pauses === 0 ? "Nenhuma" : `${perf.pauses} · maior ${seconds(perf.maxPauseMs)}`) : "…"} />
            {perf?.syncTimings.slice(0, 3).map((timing) => (
              <InfoRow key={`s${timing.at}${timing.stage}`} label={`Sinc. ${timing.stage}`} value={describeSync(timing)} />
            ))}
            <InfoRow label="Abrir canal" value={perf ? describeOpens(perf.opens.live) : "…"} />
            <InfoRow label="Abrir filme" value={perf ? describeOpens(perf.opens.movies) : "…"} />
            <InfoRow label="Abrir episódio" value={perf ? describeOpens(perf.opens.series) : "…"} />
            <InfoRow label="Encerramentos" value={perf && perf.previousExits.length === 0 ? "Nenhum" : perf ? String(perf.previousExits.length) : "…"} alert={Boolean(perf?.previousExits.length)} />
          </Panel>

          <Panel title="Atividade recente" wide={columns}>
            {perf?.previousExits.slice(0, 3).map((exit) => (
              <LogLine key={`e${exit.at}`} tag="Encerrado" text={describeExit(exit)} alert />
            ))}
            {perf?.recentPauses.slice(0, 3).map((pause) => (
              <LogLine key={`p${pause.at}`} tag="Pausa" text={describePause(pause)} />
            ))}
            {perf?.log.slice(0, 8).map((entry) => (
              <LogLine key={`l${entry.at}${entry.scope}`} tag={entry.scope} text={describeLog(entry)} />
            ))}
            {perf && !perf.previousExits.length && !perf.recentPauses.length && !perf.log.length ? (
              <AppText style={styles.empty}>Nada registrado ainda.</AppText>
            ) : null}
          </Panel>
        </View>

        <AppText style={premium.footnote}>O relatório não inclui usuário, senha, token ou URL do servidor.</AppText>
      </ScrollView>
    </View>
  );
}

/** Painel focável na TV: o controle desce até ele e a tela rola junto. */
function Panel({ title, wide, children }: { title: string; wide: boolean; children: ReactNode }) {
  return (
    <TVFocusable focusable={Platform.isTV} accessibilityRole="summary" style={[styles.panel, wide && styles.panelColumn]} focusStyle={styles.panelFocused}>
      <AppText style={styles.panelTitle}>{title.toUpperCase()}</AppText>
      {children}
    </TVFocusable>
  );
}

function InfoRow({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <AppText numberOfLines={1} style={styles.infoLabel}>{label}</AppText>
      <AppText numberOfLines={2} style={[styles.infoValue, alert && styles.alert]}>{value}</AppText>
    </View>
  );
}

function LogLine({ tag, text, alert }: { tag: string; text: string; alert?: boolean }) {
  return (
    <View style={styles.logLine}>
      <AppText numberOfLines={1} style={[styles.logTag, alert && styles.alert]}>{tag}</AppText>
      <AppText numberOfLines={2} style={styles.logText}>{text}</AppText>
    </View>
  );
}

function ActionChip({ icon, label, onPress, disabled, destructive, preferred }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean; destructive?: boolean; preferred?: boolean;
}) {
  return (
    <TVFocusable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} hasTVPreferredFocus={preferred} onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed, disabled && styles.chipDisabled]} focusStyle={styles.chipFocused}>
      <Ionicons name={icon} size={15} color={destructive ? "#FF8B91" : Colors.blueBright} />
      <AppText numberOfLines={1} style={[styles.chipText, destructive && styles.alert]}>{label}</AppText>
    </TVFocusable>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={styles.metric}><AppText style={styles.metricValue}>{value.toLocaleString("pt-BR")}</AppText><AppText style={styles.metricLabel}>{label}</AppText></View>;
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  summary: { flexDirection: "row", gap: 8 },
  metric: { flex: 1, alignItems: "center", justifyContent: "center", gap: 1, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: "rgba(0,215,255,0.18)", backgroundColor: "rgba(20,125,255,0.08)" },
  metricWide: { flex: 2, paddingHorizontal: 10 },
  metricValue: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.text },
  metricText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  metricLabel: { fontSize: 11, color: Colors.muted },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "rgba(190,222,255,0.16)", backgroundColor: "rgba(13,20,34,0.72)" },
  chipPressed: { opacity: 0.8 },
  chipDisabled: { opacity: 0.5 },
  chipFocused: { borderWidth: 2, borderColor: Colors.blueBright, backgroundColor: "rgba(77,163,255,0.18)", transform: [{ scale: 1.04 }] },
  chipText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  grid: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stack: { gap: 10 },
  panel: { gap: 2, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "rgba(190,222,255,0.10)", backgroundColor: "rgba(13,20,34,0.72)" },
  panelColumn: { flex: 1, minWidth: 0 },
  panelFocused: { borderWidth: 2, borderColor: Colors.blueBright },
  panelTitle: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 0.8, color: Colors.muted, marginBottom: 4 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(190,222,255,0.08)" },
  infoLabel: { flexShrink: 0, maxWidth: "48%", fontSize: 12, color: Colors.muted },
  infoValue: { flex: 1, textAlign: "right", fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  logLine: { paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(190,222,255,0.08)" },
  logTag: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.blueBright },
  logText: { fontSize: 11, color: Colors.text },
  empty: { fontSize: 12, color: Colors.muted, paddingVertical: 6 },
  alert: { color: "#FF8B91" },
});
