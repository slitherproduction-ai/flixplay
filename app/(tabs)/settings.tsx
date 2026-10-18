import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { Colors, Radii, Shadows, Type } from "@/constants/theme";
import { APP_INFO } from "@/constants/app";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText, SectionHeader } from "@/components/ui";
import { useSyncStatus } from "@/hooks/useXtreamSync";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useAppStore } from "@/store/useAppStore";
import type { ServerProfile } from "@/store/types";

export default function SettingsScreen() {
  const router = useRouter();
  const tvMode = useTVMode();
  const { isSyncing, refresh: syncRefresh } = useSyncStatus();
  const servers = useAppStore((state) => state.servers);
  const activeServerId = useAppStore((state) => state.activeServerId);
  const setActiveServer = useAppStore((state) => state.setActiveServer);
  const removeServer = useAppStore((state) => state.removeServer);
  const removeAllServers = useAppStore((state) => state.removeAllServers);
  const logout = useAppStore((state) => state.logout);
  const activeServer = servers.find((server) => server.id === activeServerId);

  const handleServer = useCallback((id: string) => {
    setActiveServer(id);
  }, [setActiveServer]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      "Sair da conta",
      "Deseja desconectar da lista atual? Você precisará entrar novamente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: () => {
            logout();
            router.replace("/login");
          },
        },
      ]
    );
  }, [logout, router]);

  const handleDeleteServer = useCallback((id: string, name: string) => {
    const isActive = id === activeServerId;
    Alert.alert(
      "Excluir lista",
      `Excluir lista "${name}"? As credenciais salvas serão removidas permanentemente.${isActive ? "\n\nEsta é sua lista ativa — você será desconectado." : ""}`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await removeServer(id);
              if (isActive) router.replace("/login");
            } catch {
              Alert.alert("Não foi possível excluir", "Os dados foram preservados. Tente novamente.");
            }
          },
        },
      ]
    );
  }, [activeServerId, removeServer, router]);

  const handleDeleteAllServers = useCallback(() => {
    Alert.alert(
      "Excluir todas as listas",
      "Todas as listas e credenciais salvas serão removidas permanentemente. Você será desconectado.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir todas",
          style: "destructive",
          onPress: async () => {
            try {
              await removeAllServers();
              router.replace("/login");
            } catch {
              Alert.alert("Não foi possível excluir", "Os dados foram preservados. Tente novamente.");
            }
          },
        },
      ]
    );
  }, [removeAllServers, router]);

  const handleAbout = useCallback(() => {
    router.push("/settings/about");
  }, [router]);

  const handleSyncIptv = useCallback(() => {
    syncRefresh();
    Alert.alert("Atualização iniciada", "A lista IPTV está sendo baixada do servidor.");
  }, [syncRefresh]);

  if (tvMode) {
    return (
      <TvSettingsDashboard
        servers={servers}
        activeServerId={activeServerId}
        isSyncing={isSyncing}
        onSelectServer={handleServer}
        onDeleteServer={handleDeleteServer}
        onDeleteAll={handleDeleteAllServers}
        onAddServer={() => router.push("/server/add")}
        onPlayer={() => router.push("/settings/player")}
        onParental={() => router.push("/settings/parental")}
        onSync={handleSyncIptv}
        onDiagnostics={() => router.push("/settings/diagnostics")}
        onAbout={handleAbout}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.ambient} />
        <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
          <View style={styles.headerCopy}><AppText style={styles.kicker}>CONTROLE DA SUA CONTA</AppText><AppText style={Type.display}>Ajustes</AppText><AppText style={styles.subtitle}>Personalize sua experiência ELVANOQ</AppText></View>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Servidores" subtitle="Suas conexões Xtream Codes" />
            <View style={styles.serverList}>
              {servers.map((server) => {
                const active = server.id === activeServerId;
                return (
                  <View key={server.id} style={[styles.serverRowContainer, active && styles.serverRowContainerActive]}>
                    <TVFocusable accessibilityRole="button" accessibilityState={{ selected: active }} hasTVPreferredFocus={server.id === servers[0]?.id} onPress={() => handleServer(server.id)} style={({ pressed }) => [styles.serverRow, pressed && styles.pressed]}>
                      <View style={[styles.serverStatus, active && styles.serverStatusActive]}><Ionicons name={active ? "checkmark" : "cloud-outline"} size={17} color={active ? Colors.green : Colors.muted} /></View>
                      <View style={styles.serverRowCopy}><View style={styles.serverNameRow}><AppText style={styles.serverName}>{server.name}</AppText>{active ? <View style={styles.activeBadge}><AppText style={styles.activeText}>ATIVO</AppText></View> : null}</View><AppText style={styles.serverMeta}>{server.serverUrl} · expira {server.expiryDate}</AppText></View>
                      <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={19} color={active ? Colors.blueBright : Colors.subtle} />
                    </TVFocusable>
                    <TVFocusable
                      accessibilityRole="button"
                      accessibilityLabel={`Excluir lista ${server.name}`}
                      onPress={() => handleDeleteServer(server.id, server.name)}
                      style={({ pressed }) => [styles.serverDeleteBtn, pressed && styles.pressed]}
                    >
                      <Ionicons name="trash-outline" size={17} color={Colors.red} />
                    </TVFocusable>
                  </View>
                );
              })}
            </View>
            <TVFocusable accessibilityRole="button" onPress={() => router.push("/server/add")} style={styles.addServerButton}><Ionicons name="add" size={18} color={Colors.blueBright} /><AppText style={styles.addServerText}>Adicionar servidor</AppText></TVFocusable>
            {servers.length > 1 ? (
              <TVFocusable accessibilityRole="button" onPress={handleDeleteAllServers} style={({ pressed }) => [styles.deleteAllBtn, pressed && styles.pressed]}>
                <Ionicons name="trash" size={15} color={Colors.red} />
                <AppText style={styles.deleteAllText}>Excluir todas as listas</AppText>
              </TVFocusable>
            ) : null}
          </View>

          <View style={styles.section}>
            <SectionHeader title="Reprodução" subtitle="Controles, formato e comportamento do player" />
            <SettingsRow icon="play-circle-outline" title="Preferências do player" subtitle="OSD, salto no vídeo, formato e inicialização" onPress={() => router.push("/settings/player")} emphasis />
          </View>

          <View style={styles.section}>
            <SectionHeader title="Segurança" subtitle="Proteção de acesso ao conteúdo" />
            <TVFocusable accessibilityRole="button" accessibilityLabel="Configurar controle parental" onPress={() => router.push("/settings/parental")} style={({ pressed }) => [styles.aboutRow, pressed && styles.pressed]}>
              <View style={styles.aboutIcon}><Ionicons name="lock-closed-outline" size={20} color={Colors.blueBright} /></View>
              <View style={styles.aboutCopy}><AppText style={styles.aboutTitle}>Controle parental</AppText><AppText style={styles.aboutMeta}>Criar, alterar ou remover o PIN seguro</AppText></View>
              <Ionicons name="chevron-forward" size={17} color={Colors.subtle} />
            </TVFocusable>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Dados e suporte" subtitle="Status da lista, atualização e diagnóstico" />
            <View style={styles.statusStrip}>
              <StatusItem label="LISTA" value={activeServer?.status ?? "Indisponível"} tone="success" />
              <StatusItem label="FORMATO" value={activeServer?.format ?? "Auto"} />
              <StatusItem label="CONEXÕES" value={activeServer?.activeConnections ?? "—"} />
            </View>
            {activeServer?.serverUrl.startsWith("http://") ? <View style={styles.httpWarning}><Ionicons name="shield-outline" size={16} color={Colors.amber} /><AppText style={styles.httpWarningText}>Conexão sem criptografia fornecida pelo servidor.</AppText></View> : null}
            <SettingsRow icon="refresh" title="Atualizar lista IPTV" subtitle={isSyncing ? "Sincronizando…" : "Recarregar canais, filmes e séries do servidor"} onPress={handleSyncIptv} disabled={isSyncing} emphasis />
            <SettingsRow icon="pulse-outline" title="Diagnóstico" subtitle="Conexão, catálogo, cache e relatório sanitizado" onPress={() => router.push("/settings/diagnostics")} />
          </View>

          <View style={styles.section}>
            <SectionHeader title="Sobre" subtitle="Versão, recursos e histórico de atualizações" />
            <TVFocusable accessibilityRole="button" accessibilityLabel="Abrir informações sobre o ELVANOQ" onPress={handleAbout} style={({ pressed }) => [styles.aboutRow, pressed && styles.pressed]}>
              <View style={styles.aboutIcon}>
                <Ionicons name="sparkles-outline" size={20} color={Colors.blueBright} />
              </View>
              <View style={styles.aboutCopy}>
                <View style={styles.aboutTitleRow}>
                  <AppText style={styles.aboutTitle}>Sobre o Aplicativo</AppText>
                  <View style={styles.aboutBadge}><AppText style={styles.aboutBadgeText}>v{APP_INFO.version}</AppText></View>
                </View>
                <AppText style={styles.aboutMeta}>{APP_INFO.versionLabel} · Auto-Update GitHub Integrado</AppText>
              </View>
              <Ionicons name="chevron-forward" size={17} color={Colors.subtle} />
            </TVFocusable>
          </View>


          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel="Sair da conta"
            onPress={handleLogout}
            style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}
          >
            <View style={styles.logoutIcon}>
              <Ionicons name="log-out-outline" size={20} color={Colors.red} />
            </View>
            <View style={styles.logoutCopy}>
              <AppText style={styles.logoutTitle}>Sair da Conta</AppText>
              <AppText style={styles.logoutMeta}>Desconectar e voltar à tela de login</AppText>
            </View>
            <Ionicons name="chevron-forward" size={17} color={Colors.subtle} />
          </TVFocusable>

          <AppText style={styles.version}>{APP_INFO.name} {APP_INFO.versionLabel} · Feito para sua sala</AppText>
        </ScrollView>
    </View>
  );
}

function TvSettingsDashboard({
  servers,
  activeServerId,
  isSyncing,
  onSelectServer,
  onDeleteServer,
  onDeleteAll,
  onAddServer,
  onPlayer,
  onParental,
  onSync,
  onDiagnostics,
  onAbout,
  onLogout,
}: {
  servers: ServerProfile[];
  activeServerId: string;
  isSyncing: boolean;
  onSelectServer: (id: string) => void;
  onDeleteServer: (id: string, name: string) => void;
  onDeleteAll: () => void;
  onAddServer: () => void;
  onPlayer: () => void;
  onParental: () => void;
  onSync: () => void;
  onDiagnostics: () => void;
  onAbout: () => void;
  onLogout: () => void;
}) {
  const actions: Array<{ icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void; disabled?: boolean }> = [
    { icon: "add-circle-outline", title: "Adicionar lista", subtitle: "Xtream Codes ou M3U", onPress: onAddServer },
    { icon: "play-circle-outline", title: "Reprodução", subtitle: "Player, OSD e formato", onPress: onPlayer },
    { icon: "lock-closed-outline", title: "Controle parental", subtitle: "PIN e conteúdo protegido", onPress: onParental },
    { icon: "refresh", title: "Atualizar lista", subtitle: isSyncing ? "Sincronizando…" : "Canais, filmes e séries", onPress: onSync, disabled: isSyncing },
    { icon: "pulse-outline", title: "Diagnóstico", subtitle: "Conexão e catálogo", onPress: onDiagnostics },
    { icon: "sparkles-outline", title: "Sobre o aplicativo", subtitle: APP_INFO.versionLabel, onPress: onAbout },
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.ambient} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tvDashboardContent}>
        <View style={styles.tvDashboardHeader}>
          <View><AppText style={styles.kicker}>ELVANOQ PLAY</AppText><AppText style={styles.tvDashboardTitle}>Ajustes</AppText></View>
          <AppText style={styles.tvDashboardSubtitle}>Conta, reprodução e segurança</AppText>
        </View>

        <View style={styles.tvActionGrid}>
          {actions.map((action) => <TvSettingsTile key={action.title} {...action} />)}
        </View>

        <View style={styles.tvServerSection}>
          <View style={styles.tvServerSectionHeader}>
            <View><AppText style={styles.tvSectionTitle}>Listas e servidores</AppText><AppText style={styles.tvSectionHint}>Selecione a conexão que deseja utilizar</AppText></View>
            <TVFocusable accessibilityRole="button" accessibilityLabel="Adicionar servidor" onPress={onAddServer} style={styles.tvAddServer}><Ionicons name="add" size={17} color={Colors.blueBright} /><AppText style={styles.tvAddServerText}>Adicionar</AppText></TVFocusable>
          </View>
          <View style={styles.tvServerList}>
            {servers.map((server) => {
              const active = server.id === activeServerId;
              return <View key={server.id} style={[styles.tvServerRowContainer, active && styles.tvServerRowActive]}>
                <TVFocusable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onSelectServer(server.id)} style={styles.tvServerRow}>
                  <Ionicons name={active ? "checkmark-circle" : "cloud-outline"} size={19} color={active ? Colors.green : Colors.muted} />
                  <View style={styles.tvServerCopy}><AppText numberOfLines={1} style={styles.tvServerName}>{server.name}</AppText><AppText numberOfLines={1} style={styles.tvServerMeta}>{server.serverUrl}</AppText></View>
                  {active ? <AppText style={styles.tvActiveLabel}>ATIVO</AppText> : null}
                </TVFocusable>
                <TVFocusable accessibilityRole="button" accessibilityLabel={`Excluir lista ${server.name}`} onPress={() => onDeleteServer(server.id, server.name)} style={styles.tvServerDelete}><Ionicons name="trash-outline" size={17} color={Colors.red} /></TVFocusable>
              </View>;
            })}
          </View>
          {servers.length > 1 ? <TVFocusable accessibilityRole="button" accessibilityLabel="Excluir todas as listas" onPress={onDeleteAll} style={styles.tvDeleteAll}><Ionicons name="trash-outline" size={15} color={Colors.red} /><AppText style={styles.tvDeleteAllText}>Excluir todas as listas</AppText></TVFocusable> : null}
        </View>

        <TVFocusable accessibilityRole="button" accessibilityLabel="Sair da conta" onPress={onLogout} style={styles.tvLogout}><Ionicons name="log-out-outline" size={19} color={Colors.red} /><AppText style={styles.tvLogoutText}>Sair da conta</AppText></TVFocusable>
        <AppText style={styles.version}>{APP_INFO.name} {APP_INFO.versionLabel}</AppText>
      </ScrollView>
    </View>
  );
}

function TvSettingsTile({ icon, title, subtitle, onPress, disabled = false }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void; disabled?: boolean }) {
  return <TVFocusable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.tvActionTile, disabled && styles.settingsRowDisabled, pressed && styles.pressed]}>
    <View style={styles.tvActionIcon}><Ionicons name={icon} size={21} color={Colors.blueBright} /></View>
    <View style={styles.tvActionCopy}><AppText numberOfLines={1} style={styles.tvActionTitle}>{title}</AppText><AppText numberOfLines={1} style={styles.tvActionMeta}>{subtitle}</AppText></View>
    <Ionicons name="chevron-forward" size={17} color={Colors.subtle} />
  </TVFocusable>;
}

function SettingsRow({ icon, title, subtitle, onPress, disabled = false, emphasis = false }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void; disabled?: boolean; emphasis?: boolean }) {
  return (
    <TVFocusable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.settingsRow, emphasis && styles.settingsRowEmphasis, disabled && styles.settingsRowDisabled, pressed && styles.pressed]}>
      <View style={[styles.settingsRowIcon, emphasis && styles.settingsRowIconEmphasis]}><Ionicons name={icon} size={20} color={Colors.blueBright} /></View>
      <View style={styles.settingsRowCopy}><AppText style={styles.settingsRowTitle}>{title}</AppText><AppText style={styles.settingsRowMeta}>{subtitle}</AppText></View>
      {disabled ? null : <Ionicons name="chevron-forward" size={18} color={Colors.subtle} />}
    </TVFocusable>
  );
}

function StatusItem({ label, value, tone }: { label: string; value: string | number; tone?: "success" }) {
  return <View style={styles.statusItem}><AppText style={styles.statusLabel}>{label}</AppText><AppText numberOfLines={1} style={[styles.statusValue, tone === "success" && styles.statusValueSuccess]}>{value}</AppText></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  ambient: { position: "absolute", top: -130, right: -100, width: 290, height: 290, borderRadius: 145, backgroundColor: "rgba(59, 130, 246, 0.07)" },
  content: { gap: 20, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 36 },
  tvDashboardContent: { gap: 16, paddingHorizontal: 34, paddingTop: 24, paddingBottom: 32 },
  tvDashboardHeader: { minHeight: 54, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "rgba(190,222,255,0.13)", paddingBottom: 12 },
  tvDashboardTitle: { fontFamily: "Inter_700Bold", fontSize: 27, lineHeight: 32, color: Colors.text },
  tvDashboardSubtitle: { fontSize: 12, color: Colors.muted, marginBottom: 3 },
  tvActionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tvActionTile: { width: "48.8%", minHeight: 70, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: "rgba(190,222,255,0.17)", backgroundColor: "rgba(15,23,38,0.82)" },
  tvActionIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "rgba(59,130,246,0.13)", borderWidth: 1, borderColor: "rgba(147,197,253,0.2)" },
  tvActionCopy: { flex: 1, minWidth: 0, gap: 3 },
  tvActionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  tvActionMeta: { fontSize: 10, color: Colors.muted },
  tvServerSection: { gap: 9, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: "rgba(190,222,255,0.13)", backgroundColor: "rgba(9,17,31,0.7)" },
  tvServerSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  tvSectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  tvSectionHint: { marginTop: 2, fontSize: 10, color: Colors.muted },
  tvAddServer: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "rgba(96,165,250,0.34)", backgroundColor: "rgba(59,130,246,0.08)" },
  tvAddServerText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.blueBright },
  tvServerList: { gap: 6 },
  tvServerRowContainer: { flexDirection: "row", minHeight: 48, overflow: "hidden", borderRadius: 8, borderWidth: 1, borderColor: "rgba(190,222,255,0.12)", backgroundColor: "rgba(255,255,255,0.025)" },
  tvServerRowActive: { borderColor: "rgba(59,130,246,0.43)", backgroundColor: "rgba(59,130,246,0.10)" },
  tvServerRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 11 },
  tvServerCopy: { flex: 1, minWidth: 0, gap: 2 },
  tvServerName: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  tvServerMeta: { fontSize: 9, color: Colors.subtle },
  tvActiveLabel: { fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.7, color: Colors.green },
  tvServerDelete: { width: 42, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderLeftColor: "rgba(190,222,255,0.12)" },
  tvDeleteAll: { alignSelf: "flex-start", minHeight: 31, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, borderRadius: 7, borderWidth: 1, borderColor: "rgba(229,9,20,0.24)", backgroundColor: "rgba(229,9,20,0.06)" },
  tvDeleteAllText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.red },
  tvLogout: { alignSelf: "flex-start", minHeight: 38, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "rgba(229,9,20,0.28)", backgroundColor: "rgba(229,9,20,0.07)" },
  tvLogoutText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.red },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  headerCopy: { flex: 1, gap: 4 },
  kicker: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 1.2, color: Colors.blueBright },
  subtitle: { fontSize: 13, color: Colors.muted },
  section: { gap: 12 },
  settingsRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: Radii.medium, borderWidth: 1, borderColor: "rgba(190,222,255,0.14)", backgroundColor: "rgba(20,30,48,0.66)" },
  settingsRowEmphasis: { borderColor: "rgba(96,165,250,0.28)", backgroundColor: "rgba(40,86,149,0.16)", ...Shadows.card },
  settingsRowDisabled: { opacity: 0.58 },
  settingsRowIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: "rgba(190,222,255,0.11)", backgroundColor: "rgba(59,130,246,0.10)" },
  settingsRowIconEmphasis: { borderColor: "rgba(96,165,250,0.32)", backgroundColor: "rgba(59,130,246,0.18)" },
  settingsRowCopy: { flex: 1, gap: 4 },
  settingsRowTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  settingsRowMeta: { fontSize: 11, lineHeight: 16, color: Colors.muted },
  statusStrip: { flexDirection: "row", gap: 8, padding: 10, borderRadius: Radii.medium, borderWidth: 1, borderColor: "rgba(190,222,255,0.12)", backgroundColor: "rgba(12,18,31,0.62)" },
  statusItem: { flex: 1, gap: 4, minWidth: 0, paddingHorizontal: 4 },
  statusLabel: { fontFamily: "Inter_600SemiBold", fontSize: 8, letterSpacing: 0.7, color: Colors.subtle },
  statusValue: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  statusValueSuccess: { color: Colors.green },
  serverList: { gap: 8 },
  serverRowContainer: { flexDirection: "row", alignItems: "stretch", borderRadius: Radii.medium, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft, overflow: "hidden" },
  serverRowContainerActive: { borderColor: "rgba(59, 130, 246, 0.46)", backgroundColor: "rgba(59, 130, 246, 0.11)" },
  serverRow: { flex: 1, minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11, padding: 11 },
  serverDeleteBtn: { width: 50, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderLeftColor: Colors.border, backgroundColor: "rgba(229,9,20,0.06)" },
  pressed: { opacity: 0.72 },
  deleteAllBtn: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: Radii.medium, borderWidth: 1, borderColor: "rgba(229,9,20,0.25)", backgroundColor: "rgba(229,9,20,0.07)" },
  deleteAllText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.red },
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
  preferencesCard: { paddingHorizontal: 14 },
  preferenceRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 10 },
  preferenceRowFocused: { borderRadius: Radii.small, backgroundColor: "rgba(59,130,246,0.2)" },
  preferenceIcon: { width: 33, height: 33, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "rgba(59,130,246,0.11)" },
  preferenceCopy: { flex: 1, gap: 3 },
  preferenceTitle: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.text },
  preferenceMeta: { fontSize: 10, color: Colors.subtle },
  preferenceValue: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.blueBright },
  choiceRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  choiceOptions: { flexDirection: "row", alignItems: "center", gap: 6 },
  choiceButton: { minWidth: 48, minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: "rgba(255,255,255,0.04)" },
  choiceButtonSelected: { borderColor: Colors.blueBright, backgroundColor: "rgba(59,130,246,0.22)" },
  choiceButtonFocused: { borderColor: Colors.white, backgroundColor: "rgba(59,130,246,0.34)", transform: [{ scale: 1.04 }] },
  choiceButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.muted },
  choiceButtonTextSelected: { color: Colors.white },
  userAgentRow: { minHeight: 88, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  userAgentInput: { width: "46%", minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: "rgba(7,9,14,0.72)", fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.text },
  preferenceDivider: { height: 1, backgroundColor: Colors.border },
  aboutRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderRadius: Radii.medium, borderWidth: 1, borderColor: "rgba(96,165,250,0.26)", backgroundColor: "rgba(59,130,246,0.08)" },
  aboutIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, borderWidth: 1, borderColor: "rgba(147,197,253,0.3)", backgroundColor: "rgba(96,165,250,0.15)" },
  aboutCopy: { flex: 1, gap: 5 },
  aboutTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  aboutTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  aboutBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, backgroundColor: "rgba(16,185,129,0.14)" },
  aboutBadgeText: { fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.5, color: Colors.green },
  aboutMeta: { fontSize: 10, lineHeight: 15, color: Colors.muted },
  infoGrid: { flexDirection: "row", gap: 8 },
  infoTile: { flex: 1, minHeight: 70, justifyContent: "center", paddingHorizontal: 10, gap: 6, borderRadius: 13, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  infoLabel: { fontFamily: "Inter_600SemiBold", fontSize: 8, letterSpacing: 0.4, color: Colors.subtle },
  infoValue: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.text },
  infoMuted: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.subtle },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },
  infoValueSmall: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.green },
  httpWarning: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(245,158,11,0.28)", backgroundColor: "rgba(245,158,11,0.08)" },
  httpWarningText: { flex: 1, fontSize: 11, color: Colors.amber },
  syncIptv: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: Radii.medium, borderWidth: 1, borderColor: "rgba(96,165,250,0.28)", backgroundColor: "rgba(59,130,246,0.08)", ...Shadows.card },
  syncIptvDisabled: { opacity: 0.55 },
  syncIptvIcon: { width: 37, height: 37, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "rgba(59,130,246,0.16)" },
  syncIptvCopy: { flex: 1, gap: 4 },
  syncIptvTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  syncIptvBody: { fontSize: 11, color: Colors.muted },
  version: { alignSelf: "center", fontSize: 10, color: Colors.subtle },
  logoutBtn: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderRadius: Radii.medium, borderWidth: 1, borderColor: "rgba(229,9,20,0.25)", backgroundColor: "rgba(229,9,20,0.07)", ...Shadows.card },
  logoutIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, borderWidth: 1, borderColor: "rgba(229,9,20,0.3)", backgroundColor: "rgba(229,9,20,0.14)" },
  logoutCopy: { flex: 1, gap: 4 },
  logoutTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.red },
  logoutMeta: { fontSize: 11, color: Colors.muted },
});
