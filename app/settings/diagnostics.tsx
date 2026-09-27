import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, Share, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, IconButton } from "@/components/ui";
import { TVFocusable } from "@/components/tv-focusable";
import { APP_INFO } from "@/constants/app";
import { Colors, Radii } from "@/constants/theme";
import { catalogDatabase } from "@/data/database/catalogDatabase";
import { authenticateXtream } from "@/services/xtream";
import { sanitizeError } from "@/services/security/sanitize";
import { useAppStore } from "@/store/useAppStore";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DiagnosticsScreen() {
  const router = useRouter();
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

  const refreshCacheSize = useCallback(async () => {
    setCacheBytes(await catalogDatabase.getApproximateSize());
  }, []);

  useEffect(() => { void refreshCacheSize(); }, [refreshCacheSize]);

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
    `FlixPlay ${APP_INFO.version} (${APP_INFO.build})`,
    `Plataforma: ${Platform.OS}`,
    `Dispositivo: ${Constants.deviceName ?? "Não informado"}`,
    `Sistema: ${String(Platform.Version)}`,
    `Status do servidor: ${activeServer?.status ?? "Não informado"}`,
    `Latência: ${latencyMs === null ? "Não medida" : `${latencyMs} ms`}`,
    `Última sincronização: ${cache.lastSyncedAt ?? "Não informado"}`,
    `Canais: ${cache.liveChannels.length}`,
    `Filmes: ${cache.vodMovies.length}`,
    `Séries: ${cache.seriesList.length}`,
    `Cache: ${formatBytes(cacheBytes)}`,
    `Último erro: ${syncState.syncError ? sanitizeError(syncState.syncError) : "Nenhum"}`,
  ].join("\n"), [activeServer?.status, cache, cacheBytes, latencyMs, syncState.syncError]);

  const shareReport = useCallback(async () => {
    await Share.share({ title: "Diagnóstico FlixPlay", message: report });
  }, [report]);

  const rows = [
    ["Versão", `${APP_INFO.version} · Build ${APP_INFO.build}`],
    ["Plataforma", `${Platform.OS} ${String(Platform.Version)}`],
    ["Dispositivo", Constants.deviceName ?? "Não informado"],
    ["Servidor", activeServer?.status ?? "Não informado"],
    ["Latência", latencyMs === null ? "Não medida" : `${latencyMs} ms`],
    ["Última sincronização", cache.lastSyncedAt ? new Date(cache.lastSyncedAt).toLocaleString("pt-BR") : "Não informado"],
    ["Conteúdo", `${cache.liveChannels.length} canais · ${cache.vodMovies.length} filmes · ${cache.seriesList.length} séries`],
    ["Cache local", formatBytes(cacheBytes)],
    ["Último erro", syncState.syncError ? sanitizeError(syncState.syncError) : "Nenhum"],
  ] as const;

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}><IconButton icon="chevron-back" label="Voltar" onPress={() => router.back()} /><View><AppText style={styles.kicker}>SUPORTE TÉCNICO</AppText><AppText style={styles.title}>Diagnóstico</AppText></View></View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>{rows.map(([label, value]) => <View key={label} style={styles.row}><AppText style={styles.label}>{label}</AppText><AppText selectable style={styles.value}>{value}</AppText></View>)}</View>
        <View style={styles.actions}>
          <Action icon="pulse-outline" label={testing ? "Testando..." : "Testar conexão"} disabled={!activeServer || testing} onPress={testConnection} />
          <Action icon="refresh-outline" label="Atualizar lista" onPress={() => { forceResync(); router.back(); }} />
          <Action icon="trash-outline" label="Limpar cache" onPress={clearCache} />
          <Action icon="construct-outline" label="Reconstruir banco local" onPress={rebuild} />
          <Action icon="share-outline" label="Compartilhar relatório sanitizado" onPress={shareReport} />
        </View>
        <AppText style={styles.notice}>O relatório não inclui usuário, senha, token ou URL do servidor.</AppText>
      </ScrollView>
    </View>
  );
}

function Action({ icon, label, disabled = false, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; disabled?: boolean; onPress: () => void }) {
  return <TVFocusable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.action, disabled && styles.disabled]}><Ionicons name={icon} size={19} color={Colors.blueBright} /><AppText style={styles.actionText}>{label}</AppText><Ionicons name="chevron-forward" size={17} color={Colors.subtle} /></TVFocusable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingTop: 22 },
  kicker: { fontSize: 10, letterSpacing: 1.2, color: Colors.blueBright },
  title: { fontSize: 27, fontFamily: "Inter_700Bold", color: Colors.text },
  content: { gap: 16, padding: 20, paddingBottom: 48 },
  card: { overflow: "hidden", borderRadius: Radii.medium, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  row: { minHeight: 58, justifyContent: "center", gap: 4, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  label: { fontSize: 10, color: Colors.subtle },
  value: { fontSize: 13, color: Colors.text },
  actions: { gap: 8 },
  action: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 14, borderRadius: Radii.medium, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  actionText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  disabled: { opacity: 0.45 },
  notice: { fontSize: 11, lineHeight: 17, color: Colors.subtle },
});
