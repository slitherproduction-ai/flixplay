import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, Share, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui";
import { Group, GroupLabel, GroupRow, PremiumBackdrop, PremiumHeading, PremiumTopBar, premium, usePremiumContentStyle } from "@/components/premium-screen";
import { APP_INFO } from "@/constants/app";
import { Colors } from "@/constants/theme";
import { catalogDatabase } from "@/data/database/catalogDatabase";
import { authenticateXtream } from "@/services/xtream";
import { sanitizeError } from "@/services/security/sanitize";
import { useAppStore } from "@/store/useAppStore";
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
    `Canais: ${cache.liveChannels.length}`,
    `Filmes: ${cache.vodMovies.length}`,
    `Séries: ${cache.seriesList.length}`,
    `Cache: ${formatBytes(cacheBytes)}`,
    `Último erro: ${syncState.syncError ? sanitizeError(syncState.syncError) : "Nenhum"}`,
  ].join("\n"), [activeServer?.status, cache, cacheBytes, latencyMs, syncState.syncError]);

  const shareReport = useCallback(async () => {
    await Share.share({ title: "Diagnóstico ELVANOQ", message: report });
  }, [report]);


  const contentStyle = usePremiumContentStyle({ tvMode, wide: isTablet }, 820);
  const hasError = Boolean(syncState.syncError);

  return (
    <View style={premium.screen}>
      <PremiumBackdrop />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={contentStyle}>
        <PremiumTopBar title="Diagnóstico" onBack={() => router.back()} />
        <PremiumHeading icon="pulse-outline" title="Diagnóstico" subtitle="Estado da conexão, do catálogo e do armazenamento local." />

        <View style={styles.summary}>
          <Metric label="Canais" value={cache.liveChannels.length} />
          <Metric label="Filmes" value={cache.vodMovies.length} />
          <Metric label="Séries" value={cache.seriesList.length} />
        </View>

        <GroupLabel title="CONEXÃO" />
        <Group>
          <GroupRow title="Servidor" value={activeServer?.status ?? "Não informado"} />
          <GroupRow divider title="Latência" value={latencyMs === null ? "Não medida" : `${latencyMs} ms`} />
          <GroupRow divider title="Última sincronização" value={cache.lastSyncedAt ? new Date(cache.lastSyncedAt).toLocaleString("pt-BR") : "Não informado"} />
          <GroupRow divider title="Último erro" subtitle={hasError ? sanitizeError(syncState.syncError) : undefined} value={hasError ? undefined : "Nenhum"} icon={hasError ? "alert-circle-outline" : undefined} iconColor="#FF8B91" />
        </Group>

        <GroupLabel title="APARELHO" />
        <Group>
          <GroupRow title="Versão" value={`${APP_INFO.version} (build ${APP_INFO.build})`} />
          <GroupRow divider title="Sistema" value={`${Platform.OS} ${String(Platform.Version)}`} />
          <GroupRow divider title="Dispositivo" value={Constants.deviceName ?? "Não informado"} />
          <GroupRow divider title="Cache local" value={formatBytes(cacheBytes)} />
        </Group>

        <GroupLabel title="AÇÕES" />
        <Group>
          <GroupRow icon="speedometer-outline" title={testing ? "Testando…" : "Testar conexão"} subtitle="Mede a resposta do servidor ativo" disabled={!activeServer || testing} hasTVPreferredFocus onPress={testConnection} />
          <GroupRow divider icon="refresh-outline" title="Atualizar lista" subtitle="Sincroniza canais, filmes e séries" onPress={() => { forceResync(); router.back(); }} />
          <GroupRow divider icon="share-outline" title="Compartilhar relatório" subtitle="Sem usuário, senha, token ou endereço" onPress={shareReport} />
        </Group>

        <GroupLabel title="ARMAZENAMENTO" />
        <Group>
          <GroupRow icon="trash-outline" title="Limpar cache" subtitle="Remove os dados locais desta lista" onPress={clearCache} />
          <GroupRow divider destructive icon="construct-outline" title="Reconstruir banco local" subtitle="Apaga e baixa o catálogo de novo" onPress={rebuild} />
        </Group>

        <AppText style={premium.footnote}>O relatório não inclui usuário, senha, token ou URL do servidor.</AppText>
      </ScrollView>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={styles.metric}><AppText style={styles.metricValue}>{value.toLocaleString("pt-BR")}</AppText><AppText style={styles.metricLabel}>{label}</AppText></View>;
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", gap: 10 },
  metric: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: "rgba(0,215,255,0.18)", backgroundColor: "rgba(20,125,255,0.08)" },
  metricValue: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text },
  metricLabel: { fontSize: 11, color: Colors.muted },
});
