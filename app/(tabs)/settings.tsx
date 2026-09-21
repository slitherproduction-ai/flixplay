import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Colors, Radii, Shadows, Type } from "@/constants/theme";
import { AppText, Chip, GlassCard, IconButton, ScreenState, SectionHeader } from "@/components/ui";
import { useScreenLoad } from "@/hooks/useScreenLoad";
import { useAppStore } from "@/store/useAppStore";

const buffers = ["Rápido", "Normal", "Alto"];

export default function SettingsScreen() {
  const router = useRouter();
  const { loading, error, retry } = useScreenLoad("seus ajustes");
  const servers = useAppStore((state) => state.servers);
  const activeServerId = useAppStore((state) => state.activeServerId);
  const trakt = useAppStore((state) => state.trakt);
  const preferences = useAppStore((state) => state.preferences);
  const setPreference = useAppStore((state) => state.setPreference);
  const setActiveServer = useAppStore((state) => state.setActiveServer);
  const bufferMode = typeof preferences.bufferMode === "string" ? preferences.bufferMode : "Normal";
  const autoOpen = preferences.autoOpenLastChannel === true;

  const handleServer = useCallback((id: string) => {
    setActiveServer(id);
  }, [setActiveServer]);

  const handleBuffer = useCallback((value: string) => {
    setPreference("bufferMode", value);
  }, [setPreference]);

  const handleTrakt = useCallback(() => {
    router.push("/settings/trakt");
  }, [router]);

  const handleManualSync = useCallback(() => {
    if (!trakt.isConnected) {
      router.push("/settings/trakt");
      return;
    }
    Alert.alert("Sincronização concluída", "Seu histórico e favoritos já estão atualizados com o Trakt.tv.");
  }, [router, trakt.isConnected]);

  const handleDemo = useCallback(() => {
    const demoServer = servers.find((server) => server.id === "demo-premium");
    if (demoServer) setActiveServer(demoServer.id);
    Alert.alert("Modo demonstração ativo", "Você está usando o catálogo demo com canais, filmes e séries funcionais.");
  }, [servers, setActiveServer]);

  return (
    <View style={styles.screen}>
      <View style={styles.ambient} />
      <ScreenState loading={loading} error={error} retry={retry}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerCopy}><AppText style={styles.kicker}>CONTROLE DA SUA CONTA</AppText><AppText style={Type.display}>Ajustes</AppText><AppText style={styles.subtitle}>Personalize sua experiência FlixPlay</AppText></View>
            <IconButton icon="person-outline" label="Perfil da conta" onPress={() => Alert.alert("Perfil Marina", "Perfil principal ativo.")} />
          </View>

          <View style={styles.section}>
            <SectionHeader title="Servidores" subtitle="Suas conexões Xtream Codes" />
            <View style={styles.serverList}>
              {servers.map((server) => {
                const active = server.id === activeServerId;
                return (
                  <Pressable key={server.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => handleServer(server.id)} style={({ pressed }) => [styles.serverRow, active && styles.serverRowActive, pressed && styles.pressed]}>
                    <View style={[styles.serverStatus, active && styles.serverStatusActive]}><Ionicons name={active ? "checkmark" : "cloud-outline"} size={17} color={active ? Colors.green : Colors.muted} /></View>
                    <View style={styles.serverRowCopy}><View style={styles.serverNameRow}><AppText style={styles.serverName}>{server.name}</AppText>{active ? <View style={styles.activeBadge}><AppText style={styles.activeText}>ATIVO</AppText></View> : null}</View><AppText style={styles.serverMeta}>{server.serverUrl.replace("https://", "")} · expira {server.expiryDate}</AppText></View>
                    <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={19} color={active ? Colors.blueBright : Colors.subtle} />
                  </Pressable>
                );
              })}
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push("/server/add")} style={styles.addServerButton}><Ionicons name="add" size={18} color={Colors.blueBright} /><AppText style={styles.addServerText}>Adicionar servidor</AppText></Pressable>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Trakt.tv" subtitle="Histórico e favoritos sincronizados" />
            <GlassCard style={styles.traktCard} intensity={20}>
              <View style={styles.traktIcon}><Ionicons name="sync" size={21} color={Colors.white} /></View>
              <View style={styles.traktCopy}><AppText style={styles.traktTitle}>{trakt.isConnected ? "Conectado" : "Desconectado"}</AppText><AppText style={styles.traktUser}>{trakt.isConnected ? `@${trakt.username}` : "Conecte sua conta Trakt.tv"}</AppText></View>
              <View style={[styles.connectedDot, { backgroundColor: trakt.isConnected ? Colors.green : Colors.subtle }]} />
              <Pressable accessibilityRole="button" onPress={handleTrakt} style={styles.manageButton}><AppText style={styles.manageButtonText}>{trakt.isConnected ? "Gerenciar" : "Conectar"}</AppText></Pressable>
            </GlassCard>
            <Pressable accessibilityRole="button" onPress={handleManualSync} style={styles.syncRow}><View style={styles.syncRowIcon}><Ionicons name="refresh" size={16} color={Colors.blueBright} /></View><View style={styles.syncCopy}><AppText style={styles.syncTitle}>Sincronizar agora</AppText><AppText style={styles.syncMeta}>Última sincronização há 12 min</AppText></View><Ionicons name="chevron-forward" size={17} color={Colors.subtle} /></Pressable>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Preferências do Player" />
            <GlassCard style={styles.preferencesCard} intensity={16}>
              <View style={styles.preferenceRow}><View style={styles.preferenceIcon}><Ionicons name="play-circle-outline" size={19} color={Colors.blueBright} /></View><View style={styles.preferenceCopy}><AppText style={styles.preferenceTitle}>Motor padrão</AppText><AppText style={styles.preferenceMeta}>Reprodução HLS nativa</AppText></View><AppText style={styles.preferenceValue}>HLS Nativo</AppText></View>
              <View style={styles.preferenceDivider} />
              <View style={styles.preferenceStack}><View style={styles.preferenceRow}><View style={styles.preferenceIcon}><Ionicons name="speedometer-outline" size={19} color={Colors.blueBright} /></View><View style={styles.preferenceCopy}><AppText style={styles.preferenceTitle}>Buffer de Streaming</AppText><AppText style={styles.preferenceMeta}>Ajuste para sua conexão</AppText></View></View><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bufferScroller} contentContainerStyle={styles.bufferContent}>{buffers.map((item) => <Chip key={item} label={item} selected={bufferMode === item} onPress={() => handleBuffer(item)} />)}</ScrollView></View>
              <View style={styles.preferenceDivider} />
              <View style={styles.preferenceRow}><View style={styles.preferenceIcon}><Ionicons name="radio-outline" size={19} color={Colors.blueBright} /></View><View style={styles.preferenceCopy}><AppText style={styles.preferenceTitle}>Abrir último canal</AppText><AppText style={styles.preferenceMeta}>Retomar ao iniciar o app</AppText></View><Switch value={autoOpen} onValueChange={(value) => setPreference("autoOpenLastChannel", value)} trackColor={{ false: "#293246", true: Colors.blue }} thumbColor={Colors.white} /></View>
            </GlassCard>
          </View>

          <View style={styles.infoGrid}><View style={styles.infoTile}><AppText style={styles.infoLabel}>CONEXÕES ATIVAS</AppText><AppText style={styles.infoValue}>1 <AppText style={styles.infoMuted}>/ 3</AppText></AppText></View><View style={styles.infoTile}><AppText style={styles.infoLabel}>FORMATO DE SAÍDA</AppText><AppText style={styles.infoValue}>HLS</AppText></View><View style={styles.infoTile}><AppText style={styles.infoLabel}>STATUS DA LISTA</AppText><View style={styles.statusLine}><View style={styles.activeDot} /><AppText style={styles.infoValueSmall}>Online</AppText></View></View></View>

          <Pressable accessibilityRole="button" onPress={handleDemo} style={styles.demoBanner}><View style={styles.demoIcon}><Ionicons name="flash" size={18} color={Colors.amber} /></View><View style={styles.demoCopy}><AppText style={styles.demoTitle}>Modo Demonstração</AppText><AppText style={styles.demoBody}>Explore sem configurar um servidor próprio</AppText></View><Ionicons name="chevron-forward" size={17} color={Colors.subtle} /></Pressable>
          <AppText style={styles.version}>FlixPlay 1.0.0 · Feito para sua sala</AppText>
        </ScrollView>
      </ScreenState>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  ambient: { position: "absolute", top: -130, right: -100, width: 290, height: 290, borderRadius: 145, backgroundColor: "rgba(59, 130, 246, 0.07)" },
  content: { gap: 24, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  headerCopy: { flex: 1, gap: 4 },
  kicker: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 1.2, color: Colors.blueBright },
  subtitle: { fontSize: 13, color: Colors.muted },
  section: { gap: 12 },
  serverList: { gap: 8 },
  serverRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11, padding: 11, borderRadius: Radii.medium, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  serverRowActive: { borderColor: "rgba(59, 130, 246, 0.46)", backgroundColor: "rgba(59, 130, 246, 0.11)" },
  pressed: { opacity: 0.72 },
  serverStatus: { width: 37, height: 37, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "rgba(255,255,255,0.07)" },
  serverStatusActive: { backgroundColor: "rgba(16,185,129,0.14)" },
  serverRowCopy: { flex: 1, gap: 5 },
  serverNameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  serverName: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  activeBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, backgroundColor: "rgba(16,185,129,0.16)" },
  activeText: { fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.5, color: Colors.green },
  serverMeta: { fontSize: 10, color: Colors.subtle },
  addServerButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: Radii.medium, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(96,165,250,0.4)", backgroundColor: "rgba(59,130,246,0.06)" },
  addServerText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.blueBright },
  traktCard: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderColor: "rgba(229,9,20,0.25)" },
  traktIcon: { width: 39, height: 39, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: Colors.red },
  traktCopy: { flex: 1, gap: 3 },
  traktTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  traktUser: { fontSize: 11, color: Colors.muted },
  connectedDot: { width: 7, height: 7, borderRadius: 4 },
  manageButton: { minHeight: 36, justifyContent: "center", paddingHorizontal: 10, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)" },
  manageButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.text },
  syncRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 5 },
  syncRowIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "rgba(59,130,246,0.12)" },
  syncCopy: { flex: 1, gap: 2 },
  syncTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  syncMeta: { fontSize: 10, color: Colors.subtle },
  preferencesCard: { paddingHorizontal: 14 },
  preferenceRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 10 },
  preferenceIcon: { width: 33, height: 33, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "rgba(59,130,246,0.11)" },
  preferenceCopy: { flex: 1, gap: 3 },
  preferenceTitle: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.text },
  preferenceMeta: { fontSize: 10, color: Colors.subtle },
  preferenceValue: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.blueBright },
  preferenceDivider: { height: 1, backgroundColor: Colors.border },
  preferenceStack: { paddingVertical: 4 },
  bufferScroller: { flexGrow: 0, marginLeft: 43 },
  bufferContent: { gap: 7, paddingVertical: 4 },
  infoGrid: { flexDirection: "row", gap: 8 },
  infoTile: { flex: 1, minHeight: 70, justifyContent: "center", paddingHorizontal: 10, gap: 6, borderRadius: 13, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  infoLabel: { fontFamily: "Inter_600SemiBold", fontSize: 8, letterSpacing: 0.4, color: Colors.subtle },
  infoValue: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.text },
  infoMuted: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.subtle },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },
  infoValueSmall: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.green },
  demoBanner: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: Radii.medium, borderWidth: 1, borderColor: "rgba(245,158,11,0.25)", backgroundColor: "rgba(245,158,11,0.08)", ...Shadows.card },
  demoIcon: { width: 37, height: 37, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "rgba(245,158,11,0.16)" },
  demoCopy: { flex: 1, gap: 4 },
  demoTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  demoBody: { fontSize: 11, color: Colors.muted },
  version: { alignSelf: "center", fontSize: 10, color: Colors.subtle },
});
