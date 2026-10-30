import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { APP_INFO } from "@/constants/app";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { useSyncStatus } from "@/hooks/useXtreamSync";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useAppStore } from "@/store/useAppStore";
import type { ServerProfile } from "@/store/types";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { maskUsername } from "@/features/login/loginValidation";

/**
 * Descrição da lista sem expor o Host/DNS do servidor (mesma regra da tela de
 * Listas Salvas do login e do Roku): listas do Portal e por código nunca
 * mostram o endereço resolvido.
 */
function describeServer(server: ServerProfile): string {
  if (server.portalManaged) return `Recebida do Portal · ${server.sourceType === "m3u" ? "M3U" : "Xtream"}`;
  if (server.sourceType === "xtream-code" && server.serverCode) return `Código ${server.serverCode} · ${maskUsername(server.username)}`;
  return `${maskUsername(server.username)} · ${server.sourceType === "m3u" ? "M3U" : "Xtream"}`;
}

function expiryLabel(server?: ServerProfile): string {
  const value = server?.expiryDate?.trim();
  return value && value !== "Não informado" ? value : "Sem data";
}

type StatusTone = "success" | "warning" | "neutral";

/** Traduz o status Xtream e define a cor: só "ativa" aparece em verde. */
function statusInfo(status?: string | null): { label: string; tone: StatusTone } {
  const value = (status ?? "").trim().toLowerCase();
  if (!value) return { label: "Indisponível", tone: "neutral" };
  if (value === "active") return { label: "Ativa", tone: "success" };
  if (value === "expired") return { label: "Expirada", tone: "warning" };
  if (value === "banned") return { label: "Bloqueada", tone: "warning" };
  if (value === "disabled") return { label: "Desativada", tone: "warning" };
  return { label: status ?? "", tone: "neutral" };
}

export default function SettingsScreen() {
  const router = useRouter();
  const tvMode = useTVMode();
  const insets = useSafeAreaInsets();
  const { isTablet, contentPadding, contentMaxWidth } = useResponsiveLayout();
  const { isSyncing, refresh: syncRefresh } = useSyncStatus();
  const servers = useAppStore((state) => state.servers);
  const activeServerId = useAppStore((state) => state.activeServerId);
  const setActiveServer = useAppStore((state) => state.setActiveServer);
  const removeServer = useAppStore((state) => state.removeServer);
  const removeAllServers = useAppStore((state) => state.removeAllServers);
  const logout = useAppStore((state) => state.logout);
  const activeServer = servers.find((server) => server.id === activeServerId);

  const [editingLists, setEditingLists] = useState(false);

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

  // O andamento aparece na própria linha ("Sincronizando…"); um alerta
  // interrompia a navegação, principalmente no controle remoto.
  const handleSyncIptv = useCallback(() => {
    syncRefresh();
  }, [syncRefresh]);
  const activeStatus = statusInfo(activeServer?.status);

  if (tvMode) {
    return (
      <TvSettingsDashboard
        activeServer={activeServer}
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          // Edge-to-edge no Android: o conteúdo começa abaixo da barra de status.
          { paddingTop: insets.top + 14 },
          isTablet && { paddingHorizontal: contentPadding, width: "100%", maxWidth: Math.min(contentMaxWidth ?? 760, 760), alignSelf: "center" },
        ]}
      >
        <AppText style={styles.pageTitle}>Ajustes</AppText>

        {/* Conta ativa — resumo no topo, como nos apps de streaming. */}
        {activeServer ? (
          <View style={styles.accountCard}>
            <View style={styles.accountHeader}>
              <View style={styles.accountAvatar}><AppText style={styles.accountInitial}>{(activeServer.name.trim().charAt(0) || "E").toLocaleUpperCase("pt-BR")}</AppText></View>
              <View style={styles.accountCopy}>
                <AppText numberOfLines={1} style={styles.accountName}>{activeServer.name}</AppText>
                <AppText numberOfLines={1} style={styles.accountMeta}>{describeServer(activeServer)}</AppText>
              </View>
            </View>
            <View style={styles.statusStrip}>
              <StatusItem label="LISTA" value={activeStatus.label} tone={activeStatus.tone} />
              <StatusItem label="VALIDADE" value={expiryLabel(activeServer)} />
              <StatusItem label="CONEXÕES" value={activeServer.maxConnections ? `${activeServer.activeConnections ?? 0}/${activeServer.maxConnections}` : activeServer.activeConnections ?? "—"} />
            </View>
            {activeServer.serverUrl.startsWith("http://") && !activeServer.portalManaged && activeServer.sourceType !== "xtream-code" ? (
              <View style={styles.httpWarning}><Ionicons name="shield-outline" size={14} color={Colors.amber} /><AppText style={styles.httpWarningText}>Conexão sem criptografia fornecida pelo servidor.</AppText></View>
            ) : null}
          </View>
        ) : null}

        <GroupLabel
          title="LISTAS"
          action={servers.length > 0 ? { label: editingLists ? "Concluir" : "Editar", onPress: () => setEditingLists((value) => !value) } : undefined}
        />
        <View style={styles.group}>
          {servers.map((server, index) => {
            const active = server.id === activeServerId;
            const expiry = expiryLabel(server);
            return (
              <View key={server.id} style={[styles.listRow, index > 0 && styles.groupDivider]}>
                <TVFocusable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${server.name}${active ? ", lista ativa" : ""}`}
                  disabled={editingLists}
                  onPress={() => handleServer(server.id)}
                  style={({ pressed }) => [styles.listRowMain, pressed && styles.pressed]}
                >
                  <View style={styles.listRowCopy}>
                    <AppText numberOfLines={1} style={[styles.rowTitle, active && styles.rowTitleActive]}>{server.name}</AppText>
                    <AppText numberOfLines={1} style={styles.rowMeta}>{describeServer(server)}</AppText>
                    {expiry !== "Sem data" ? <AppText numberOfLines={1} style={styles.rowMeta}>Válida até {expiry}</AppText> : null}
                  </View>
                  {active && !editingLists ? <Ionicons name="checkmark-circle" size={22} color={Colors.blueBright} /> : null}
                </TVFocusable>
                {editingLists ? (
                  <TVFocusable
                    accessibilityRole="button"
                    accessibilityLabel={`Excluir lista ${server.name}`}
                    onPress={() => handleDeleteServer(server.id, server.name)}
                    style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="trash-outline" size={17} color={Colors.red} />
                    <AppText style={styles.deleteText}>Excluir</AppText>
                  </TVFocusable>
                ) : null}
              </View>
            );
          })}
          <TVFocusable accessibilityRole="button" onPress={() => router.push("/server/add")} style={({ pressed }) => [styles.groupRow, servers.length > 0 && styles.groupDivider, pressed && styles.pressed]}>
            <View style={[styles.rowIcon, styles.rowIconAccent]}><Ionicons name="add" size={18} color={Colors.blueBright} /></View>
            <AppText style={[styles.rowTitle, styles.rowTitleAccent]}>Adicionar lista</AppText>
          </TVFocusable>
          {editingLists && servers.length > 1 ? (
            <TVFocusable accessibilityRole="button" onPress={handleDeleteAllServers} style={({ pressed }) => [styles.groupRow, styles.groupDivider, pressed && styles.pressed]}>
              <View style={[styles.rowIcon, styles.rowIconDanger]}><Ionicons name="trash" size={16} color={Colors.red} /></View>
              <AppText style={[styles.rowTitle, styles.rowTitleDanger]}>Excluir todas as listas</AppText>
            </TVFocusable>
          ) : null}
        </View>

        <GroupLabel title="REPRODUÇÃO E SEGURANÇA" />
        <View style={styles.group}>
          <GroupRow icon="play-circle-outline" title="Preferências do player" subtitle="Controles, salto no vídeo e formato" onPress={() => router.push("/settings/player")} />
          <GroupRow icon="lock-closed-outline" title="Controle parental" subtitle="PIN e categorias protegidas" onPress={() => router.push("/settings/parental")} divider />
        </View>

        <GroupLabel title="DADOS E SUPORTE" />
        <View style={styles.group}>
          <GroupRow icon="refresh" title="Atualizar lista" subtitle={isSyncing ? "Sincronizando…" : "Canais, filmes e séries"} onPress={handleSyncIptv} disabled={isSyncing} loading={isSyncing} />
          <GroupRow icon="pulse-outline" title="Diagnóstico" subtitle="Conexão, catálogo e cache" onPress={() => router.push("/settings/diagnostics")} divider />
          <GroupRow icon="sparkles-outline" title="Sobre o aplicativo" subtitle={`Versão ${APP_INFO.version}`} onPress={handleAbout} divider />
        </View>

        <View style={styles.group}>
          <TVFocusable accessibilityRole="button" accessibilityLabel="Sair da conta" onPress={handleLogout} style={({ pressed }) => [styles.groupRow, styles.logoutRow, pressed && styles.pressed]}>
            <Ionicons name="log-out-outline" size={18} color={Colors.red} />
            <AppText style={[styles.rowTitle, styles.rowTitleDanger]}>Sair da conta</AppText>
          </TVFocusable>
        </View>

        <AppText style={styles.version}>{APP_INFO.name} {APP_INFO.versionLabel}</AppText>
      </ScrollView>
    </View>
  );
}

/** Rótulo de grupo no estilo dos Ajustes da Apple, com ação opcional à direita. */
function GroupLabel({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.groupLabelRow}>
      <AppText style={styles.groupLabel}>{title}</AppText>
      {action ? (
        <TVFocusable accessibilityRole="button" onPress={action.onPress} hitSlop={10} style={({ pressed }) => [styles.groupAction, pressed && styles.pressed]}>
          <AppText style={styles.groupActionText}>{action.label}</AppText>
        </TVFocusable>
      ) : null}
    </View>
  );
}

function GroupRow({ icon, title, subtitle, onPress, disabled = false, loading = false, divider = false }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void; disabled?: boolean; loading?: boolean; divider?: boolean }) {
  return (
    <TVFocusable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled, busy: loading }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.groupRow, divider && styles.groupDivider, pressed && styles.pressed]}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={18} color={Colors.blueBright} /></View>
      <View style={styles.listRowCopy}>
        <AppText style={styles.rowTitle}>{title}</AppText>
        <AppText numberOfLines={1} style={styles.rowMeta}>{subtitle}</AppText>
      </View>
      {loading ? <ActivityIndicator size="small" color={Colors.blueBright} /> : <Ionicons name="chevron-forward" size={17} color={Colors.subtle} />}
    </TVFocusable>
  );
}

function TvSettingsDashboard({
  activeServer,
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
  activeServer?: ServerProfile;
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

        {activeServer ? (() => {
          const status = statusInfo(activeServer.status);
          return (
            <View style={styles.tvAccountCard}>
              <View style={styles.tvAccountAvatar}><AppText style={styles.tvAccountInitial}>{(activeServer.name.trim().charAt(0) || "E").toLocaleUpperCase("pt-BR")}</AppText></View>
              <View style={styles.tvAccountCopy}>
                <AppText numberOfLines={1} style={styles.tvAccountName}>{activeServer.name}</AppText>
                <AppText numberOfLines={1} style={styles.tvAccountMeta}>{describeServer(activeServer)}</AppText>
              </View>
              <StatusItem label="LISTA" value={status.label} tone={status.tone} />
              <StatusItem label="EXPIRA" value={expiryLabel(activeServer)} />
              <StatusItem label="CONEXÕES" value={activeServer.maxConnections ? `${activeServer.activeConnections ?? 0}/${activeServer.maxConnections}` : activeServer.activeConnections ?? "—"} />
            </View>
          );
        })() : null}

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
                  <View style={styles.tvServerCopy}><AppText numberOfLines={1} style={styles.tvServerName}>{server.name}</AppText><AppText numberOfLines={1} style={styles.tvServerMeta}>{describeServer(server)} · expira {expiryLabel(server)}</AppText></View>
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

function StatusItem({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: StatusTone }) {
  return <View style={styles.statusItem}><AppText style={styles.statusLabel}>{label}</AppText><AppText numberOfLines={1} style={[styles.statusValue, tone === "success" && styles.statusValueSuccess, tone === "warning" && styles.statusValueWarning]}>{value}</AppText></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  ambient: { position: "absolute", top: -130, right: -100, width: 290, height: 290, borderRadius: 145, backgroundColor: "rgba(59, 130, 246, 0.07)" },
  content: { gap: 22, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 36 },
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
  statusValueWarning: { color: Colors.amber },
  pageTitle: { fontFamily: "Inter_700Bold", fontSize: 30, lineHeight: 36, letterSpacing: -0.9, color: Colors.text },
  accountCard: { gap: 14, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: "rgba(0,215,255,0.18)", backgroundColor: "rgba(20,125,255,0.08)" },
  accountHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  accountAvatar: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: Colors.blue },
  accountInitial: { fontFamily: "Inter_700Bold", fontSize: 19, color: Colors.white },
  accountCopy: { flex: 1, minWidth: 0, gap: 2 },
  accountName: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.text },
  accountMeta: { fontSize: 12, color: Colors.muted },
  groupLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: -12, paddingHorizontal: 4 },
  groupLabel: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.1, color: Colors.muted },
  groupAction: { paddingVertical: 2, paddingHorizontal: 4 },
  groupActionText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.blueBright },
  group: { overflow: "hidden", borderRadius: 16, borderWidth: 1, borderColor: "rgba(190,222,255,0.10)", backgroundColor: "rgba(13,20,34,0.72)" },
  groupDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(190,222,255,0.14)" },
  groupRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  listRow: { flexDirection: "row", alignItems: "stretch" },
  listRowMain: { flex: 1, minHeight: 62, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  listRowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "rgba(0,215,255,0.10)" },
  rowIconAccent: { backgroundColor: "rgba(0,215,255,0.12)" },
  rowIconDanger: { backgroundColor: "rgba(255,92,114,0.12)" },
  rowTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  rowTitleActive: { color: Colors.white },
  rowTitleAccent: { color: Colors.blueBright },
  rowTitleDanger: { color: Colors.red },
  rowMeta: { fontSize: 11, color: Colors.muted },
  deleteButton: { minWidth: 84, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "rgba(255,92,114,0.10)" },
  deleteText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.red },
  logoutRow: { justifyContent: "center", gap: 8 },
  tvAccountCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: "rgba(0,215,255,0.20)", backgroundColor: "rgba(20,125,255,0.08)" },
  tvAccountAvatar: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: Colors.blue },
  tvAccountInitial: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.white },
  tvAccountCopy: { flex: 2, minWidth: 0, gap: 2 },
  tvAccountName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  tvAccountMeta: { fontSize: 10, color: Colors.muted },
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
