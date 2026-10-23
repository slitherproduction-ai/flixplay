import { Ionicons } from "@expo/vector-icons";
import { BlurTargetView, BlurView } from "expo-blur";
import Constants from "expo-constants";
import { APP_INFO } from "@/constants/app";
import { PORTAL_LINKS } from "@/constants/portal";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  findNodeHandle,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { TVFocusable, type TVFocusableHandle } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";
import { authenticateXtream, XtreamApiError } from "@/services/xtream";
import type { XtreamUserInfo } from "@/services/xtream";
import { useAppStore } from "@/store/useAppStore";
import type { ServerProfile } from "@/store/types";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { logTechnicalError } from "@/services/security/sanitize";
import { getDeviceIdentity, type DeviceIdentity } from "@/services/device/deviceIdentity";
import type { PortalDeviceStatus } from "@/services/device/portalDeviceStatus";
import { syncPortalPlaylist, type PortalPlaylistSyncResult } from "@/services/device/portalPlaylistSync";
import { revalidatePortalManagedDevice } from "@/services/device/codeDeviceAccess";
import { isValidServerCode, normalizeServerCode, resolveServerCode } from "@/services/device/serverCodeResolver";
import { revalidateCodeDevice } from "@/services/device/codeDeviceAccess";

const APP_VERSION = Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? APP_INFO.version;
const APP_BUILD = Constants.nativeBuildVersion ?? APP_INFO.build;

interface DiagInfo {
  testedUrl: string;
  alternateProtocol: "HTTPS" | "HTTP";
  alternateUrl: string;
}

// ---------------------------------------------------------------------------
// Pure module-level helpers — extracted to keep performConnect simple
// ---------------------------------------------------------------------------

/** Returns true when the Xtream server confirmed a successful authentication. */
function checkXtreamAuth(userInfo: XtreamUserInfo | null): userInfo is XtreamUserInfo {
  if (!userInfo) return false;
  const v = userInfo.auth;
  if (v === 1 || v === "1" || v === true) return true;
  // Some servers omit the auth field entirely but still return a username on success
  return v === undefined && !!userInfo.username;
}

/** Builds a DiagInfo from a caught error, or null when not an XtreamApiError. */
function buildDiagInfoFromError(err: unknown): DiagInfo | null {
  if (!(err instanceof XtreamApiError) || !err.testedUrl) return null;
  const base = err.testedUrl;
  const isHttp = base.startsWith("http://");
  return {
    testedUrl: base,
    alternateProtocol: isHttp ? "HTTPS" : "HTTP",
    alternateUrl: isHttp
      ? base.replace("http://", "https://")
      : base.replace("https://", "http://"),
  };
}

/** Maps a successfully authenticated user_info into the profile fields to persist. */
function buildProfileUpdate(userInfo: XtreamUserInfo) {
  const formats = Array.isArray(userInfo.allowed_output_formats)
    ? userInfo.allowed_output_formats.map((value) => value.toLowerCase())
    : [];
  const format = formats.includes("m3u8")
    ? "HLS"
    : formats.includes("ts")
      ? "TS"
      : null;
  return {
    expiryDate: parseExpiryDisplay(userInfo.exp_date ?? null),
    maxConnections: userInfo.max_connections ? Number(userInfo.max_connections) : null,
    activeConnections: userInfo.active_cons ? Number(userInfo.active_cons) : null,
    format: format as ServerProfile["format"],
    status: userInfo.status ?? null,
  };
}

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url) return url;

  // Add http:// if no protocol present — IPTV servers are typically plain HTTP
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `http://${url}`;
  }

  // Use URL.origin to extract ONLY protocol + hostname + port.
  // This correctly strips any path, query, fragment, or embedded user-info
  // that users accidentally paste (e.g. http://server:8080/player_api.php?...
  // or http://server/live/user/pass/123).  A regex whitelist of known paths is
  // brittle and silently passes unknown paths through to buildApiUrl, which
  // then appends /player_api.php to them and creates an invalid endpoint.
  try {
    const parsed = new URL(url);
    return parsed.origin; // "http://hostname:port" — no trailing slash, no path
  } catch {
    // Malformed URL — strip trailing slashes and return as-is; the subsequent
    // isValidServerUrl check will catch it and show a helpful error.
    return url.replace(/\/+$/, "");
  }
}

/** Returns true when the normalised URL has a non-empty hostname. */
function isValidServerUrl(normalised: string): boolean {
  if (!normalised) return false;
  try {
    const parsed = new URL(normalised);
    // Must have a real hostname — rejects "http://" with empty host
    return parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Erro desconhecido. Tente novamente.";
}

function formatAddedAt(iso?: string): string {
  if (!iso) return "Data desconhecida";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR");
  } catch {
    return "Data inválida";
  }
}

function maskUsername(value: string): string {
  if (value.length <= 2) return "••";
  return `${value.slice(0, 1)}${"•".repeat(Math.min(6, value.length - 2))}${value.slice(-1)}`;
}

function validateLoginFields(host: string, username: string, password: string): string | null {
  const normalised = normalizeUrl(host);
  if (!isValidServerUrl(normalised)) {
    return "Informe o Host / URL do servidor. Exemplos: servidor.exemplo.com, http://192.168.1.1:8080";
  }
  if (!username.trim()) return "Informe o usuário.";
  if (!password) return "Informe a senha.";
  return null;
}

function validateCodeLoginFields(code: string, username: string, password: string): string | null {
  if (!isValidServerCode(normalizeServerCode(code))) return "Informe um código de servidor válido.";
  if (!username.trim()) return "Informe o usuário.";
  if (!password) return "Informe a senha.";
  return null;
}

function parseExpiryDisplay(expDate: string | null): string {
  if (!expDate) return "Ilimitado";
  const expTs = Number(expDate);
  if (Number.isNaN(expTs) || expTs <= 0) return "Ilimitado";
  return new Date(expTs * 1000).toLocaleDateString("pt-BR");
}

function getUserStatusError(status?: string): string | null {
  if (!status) return null;
  const s = status.toLowerCase().trim();
  if (s === "expired") return "Conta expirada. Entre em contato com seu provedor IPTV.";
  if (s === "disabled" || s === "banned" || s === "blocked")
    return "Conta desativada. Entre em contato com seu provedor IPTV.";
  return null;
}

function mapConnectError(error: unknown): string {
  // XtreamApiError already has a descriptive, user-facing message — use it directly.
  const msg = getErrorMessage(error);
  if (!msg || msg === "Erro desconhecido. Tente novamente.") {
    return "Falha ao conectar. Verifique a URL, usuário e senha.";
  }
  return msg;
}

interface SavedListsModalProps {
  servers: ServerProfile[];
  onSelect: (server: ServerProfile) => void;
  onDelete: (id: string, name: string) => void;
  onDeleteAll: () => void;
  onClose: () => void;
  portalState: PortalSyncState;
  portalMessage: string | null;
  onSyncPortal: () => void;
  onLinkPortal: () => void;
  onManagePortal: () => void;
}

type PortalSyncState = "idle" | "syncing" | "synced" | "no-playlist" | "pending" | "inactive" | "unavailable";

function SavedListsModal({ servers, onSelect, onDelete, onDeleteAll, onClose, portalState, portalMessage, onSyncPortal, onLinkPortal, onManagePortal }: SavedListsModalProps) {
  const insets = useSafeAreaInsets();
  const closeButtonRef = useRef<TVFocusableHandle>(null);

  useEffect(() => {
    const timer = setTimeout(() => closeButtonRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View
      accessibilityViewIsModal
      importantForAccessibility="yes"
      onAccessibilityEscape={onClose}
      style={[modalStyles.screen, { paddingBottom: insets.bottom }]}
    >
      <View style={modalStyles.header}>
        <View style={modalStyles.grabber} />
        <View style={modalStyles.titleRow}>
          <AppText style={modalStyles.title}>Listas Salvas</AppText>
          <View style={modalStyles.countBadge}>
            <AppText style={modalStyles.countText}>{servers.length}</AppText>
          </View>
        </View>
        <TVFocusable
          ref={closeButtonRef}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          hasTVPreferredFocus
          onPress={onClose}
          style={modalStyles.closeBtn}
        >
          <Ionicons name="close" size={20} color={Colors.text} />
        </TVFocusable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={modalStyles.listContent}
      >
        <View style={modalStyles.portalSyncCard}>
          <View style={modalStyles.portalSyncCopy}>
            <AppText style={modalStyles.portalSyncTitle}>Listas do Portal</AppText>
            <AppText style={modalStyles.portalSyncBody}>
              {portalState === "syncing" ? "Sincronizando sem alterar a lista ativa…" : portalMessage ?? "Atualize para buscar a lista vinculada a este dispositivo."}
            </AppText>
          </View>
          <TVFocusable accessibilityRole="button" accessibilityLabel="Sincronizar listas do Portal" disabled={portalState === "syncing"} onPress={onSyncPortal} style={({ pressed }) => [modalStyles.portalSyncButton, pressed && modalStyles.pressed]}>
            {portalState === "syncing" ? <ActivityIndicator size="small" color={Colors.background} /> : <Ionicons name="sync-outline" size={17} color={Colors.background} />}
            <AppText style={modalStyles.portalSyncButtonText}>Atualizar</AppText>
          </TVFocusable>
          <TVFocusable accessibilityRole="link" accessibilityLabel="Gerenciar listas no Portal" onPress={onManagePortal} style={({ pressed }) => [modalStyles.portalManageButton, pressed && modalStyles.pressed]}>
            <Ionicons name="open-outline" size={16} color={Colors.blueBright} />
            <AppText style={modalStyles.portalManageButtonText}>Gerenciar no Portal</AppText>
          </TVFocusable>
          {portalState === "pending" ? <TVFocusable accessibilityRole="button" accessibilityLabel="Vincular chave do Portal" onPress={onLinkPortal} style={({ pressed }) => [modalStyles.portalLinkButton, pressed && modalStyles.pressed]}><Ionicons name="key-outline" size={16} color={Colors.blueBright} /><AppText style={modalStyles.portalLinkButtonText}>Vincular chave</AppText></TVFocusable> : null}
        </View>
        {servers.length === 0 ? (
          <View style={modalStyles.emptyState}>
            <View style={modalStyles.emptyIcon}>
              <Ionicons name="list-outline" size={28} color={Colors.subtle} />
            </View>
            <AppText style={modalStyles.emptyTitle}>Nenhuma lista salva</AppText>
            <AppText style={modalStyles.emptyBody}>
              Conecte-se a um servidor para salvar sua primeira lista.
            </AppText>
          </View>
        ) : (
          servers.map((server) => (
            <View key={server.id} style={modalStyles.serverRow}>
              <TVFocusable
                accessibilityRole="button"
                accessibilityLabel={`Conectar à lista ${server.name}`}
                onPress={() => onSelect(server)}
                style={({ pressed }) => [modalStyles.serverMain, pressed && modalStyles.pressed]}
              >
                <View style={[modalStyles.serverIcon, server.isActive && modalStyles.serverIconActive]}>
                  <Ionicons
                    name={server.isActive ? "checkmark" : "cloud-outline"}
                    size={17}
                    color={server.isActive ? Colors.green : Colors.muted}
                  />
                </View>
                <View style={modalStyles.serverInfo}>
                  <View style={modalStyles.serverNameRow}>
                    <AppText style={modalStyles.serverName} numberOfLines={1}>
                      {server.name}
                    </AppText>
                    {server.isActive ? (
                      <View style={modalStyles.activeBadge}>
                        <AppText style={modalStyles.activeBadgeText}>ATIVO</AppText>
                      </View>
                    ) : null}
                  </View>
                  <AppText style={modalStyles.serverUrl} numberOfLines={1}>
                    {server.portalManaged ? "Recebida do Portal ELVANOQ" : server.serverUrl}
                  </AppText>
                  <AppText style={modalStyles.serverMeta}>
                    {server.portalManaged
                      ? `${server.sourceType === "m3u" ? "M3U" : "Xtream"} · Atualização manual disponível`
                      : server.sourceType === "xtream-code" && server.serverCode
                        ? `Código ${server.serverCode} · ${maskUsername(server.username)}`
                        : `${maskUsername(server.username)} · Adicionado em ${formatAddedAt(server.addedAt)}`}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.subtle} />
              </TVFocusable>
              <TVFocusable
                accessibilityRole="button"
                accessibilityLabel={`Excluir lista ${server.name}`}
                onPress={() => onDelete(server.id, server.name)}
                style={({ pressed }) => [modalStyles.deleteBtn, pressed && modalStyles.pressed]}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.red} />
              </TVFocusable>
            </View>
          ))
        )}

        {servers.length > 1 ? (
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel="Excluir todas as listas"
            onPress={onDeleteAll}
            style={({ pressed }) => [modalStyles.deleteAllBtn, pressed && modalStyles.pressed]}
          >
            <Ionicons name="trash" size={16} color={Colors.red} />
            <AppText style={modalStyles.deleteAllText}>Excluir todas as listas</AppText>
          </TVFocusable>
        ) : null}
      </ScrollView>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  // Android's native BlurView needs an explicit source view. Keeping the
  // poster mosaic and its veil together in this target makes the glass card
  // refract the actual artwork behind it instead of falling back to no blur.
  const backdropRef = useRef<View>(null);
  const tvMode = useTVMode();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const { isTablet, isTabletLandscape } = useResponsiveLayout();
  const compactMobile = !tvMode && viewportWidth < 600;
  // Fire TV and many 720p Android TV panels have substantially less vertical
  // space than a 1080p television. Keep the entire entry flow visible there.
  const compactTv = tvMode && viewportHeight < 900;
  const insets = useSafeAreaInsets();
  const addServer = useAppStore((state) => state.addServer);
  const upsertCodeServer = useAppStore((state) => state.upsertCodeServer);
  const setCodeAccessSnapshot = useAppStore((state) => state.setCodeAccessSnapshot);
  const upsertPortalServer = useAppStore((state) => state.upsertPortalServer);
  const setActiveServer = useAppStore((state) => state.setActiveServer);
  const removeServer = useAppStore((state) => state.removeServer);
  const removeAllServers = useAppStore((state) => state.removeAllServers);
  const servers = useAppStore((state) => state.servers);

  const [host, setHost] = useState("");
  const [serverCode, setServerCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [listName, setListName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagInfo, setDiagInfo] = useState<DiagInfo | null>(null);
  const [showSavedLists, setShowSavedLists] = useState(false);
  const [focusedField, setFocusedField] = useState<"host" | "code" | "username" | "password" | "listName" | null>(null);
  const [accessMethod, setAccessMethod] = useState<"chooser" | "xtream" | "xtream-code">("chooser");
  const [deviceIdentity, setDeviceIdentity] = useState<DeviceIdentity | null>(null);
  const [portalDeviceStatus, setPortalDeviceStatus] = useState<PortalDeviceStatus | null>(null);
  const [portalSyncState, setPortalSyncState] = useState<PortalSyncState>("idle");
  const [portalSyncMessage, setPortalSyncMessage] = useState<string | null>(null);
  const [showPortalLink, setShowPortalLink] = useState(false);
  const [portalLinkKey, setPortalLinkKey] = useState("");

  const hostRef = useRef<TextInput>(null);
  const serverCodeRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const listNameRef = useRef<TextInput>(null);
  const connectButtonRef = useRef<TVFocusableHandle>(null);
  const savedListsButtonRef = useRef<TVFocusableHandle>(null);
  const [formFocusHandles, setFormFocusHandles] = useState({
    host: 0,
    code: 0,
    username: 0,
    password: 0,
    listName: 0,
    connect: 0,
  });

  const resolveFormFocusHandles = useCallback(() => {
    requestAnimationFrame(() => {
      setFormFocusHandles({
        host: findNodeHandle(hostRef.current) ?? 0,
        code: findNodeHandle(serverCodeRef.current) ?? 0,
        username: findNodeHandle(usernameRef.current) ?? 0,
        password: findNodeHandle(passwordRef.current) ?? 0,
        listName: findNodeHandle(listNameRef.current) ?? 0,
        connect: connectButtonRef.current?.getNodeHandle() ?? 0,
      });
    });
  }, []);

  const applyPortalSyncResult = useCallback((result: PortalPlaylistSyncResult) => {
    if (result.state === "synced") {
      upsertPortalServer(result.server);
      setPortalDeviceStatus({ state: "linked", displayName: result.displayName });
      setPortalSyncState("synced");
      setPortalSyncMessage("Lista do Portal recebida. Escolha-a abaixo quando quiser usar.");
      return;
    }
    if (result.state === "blocked") {
      setPortalDeviceStatus({ state: "linked", displayName: result.displayName });
      setPortalSyncState("inactive");
      setPortalSyncMessage(result.message);
      return;
    }
    if (result.state === "no-playlist") {
      setPortalDeviceStatus({ state: "linked", displayName: result.displayName });
      setPortalSyncState("no-playlist");
      setPortalSyncMessage("Dispositivo vinculado, mas sem lista cadastrada no Portal.");
      return;
    }
    if (result.state === "inactive") {
      setPortalDeviceStatus({ state: "inactive", displayName: result.displayName });
      setPortalSyncState("inactive");
      setPortalSyncMessage("Este dispositivo está desativado no Portal. As listas locais não foram alteradas.");
      return;
    }
    if (result.state === "link-required") {
      setPortalDeviceStatus({ state: "pending" });
      setPortalSyncState("pending");
      setPortalSyncMessage(result.message);
      return;
    }
    setPortalSyncState("unavailable");
    setPortalSyncMessage(result.message);
  }, [upsertPortalServer]);

  const synchronizePortal = useCallback(async (identity: DeviceIdentity, explicitKey?: string) => {
    setPortalSyncState("syncing");
    const result = await syncPortalPlaylist(identity, explicitKey);
    applyPortalSyncResult(result);
    return result;
  }, [applyPortalSyncResult]);

  useEffect(() => {
    if (!tvMode || (accessMethod !== "xtream" && accessMethod !== "xtream-code")) return;
    const timer = setTimeout(() => (accessMethod === "xtream-code" ? serverCodeRef : hostRef).current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [accessMethod, tvMode]);

  useEffect(() => {
    let active = true;
    void getDeviceIdentity().then((identity) => {
      if (!active) return;
      setDeviceIdentity(identity);
      // The Portal lookup never changes the active list or blocks login.
      void synchronizePortal(identity);
    }).catch(() => {
      // Identity display must never interfere with entering an IPTV account.
    });
    return () => { active = false; };
  }, [synchronizePortal]);

  useFocusEffect(useCallback(() => {
    if (deviceIdentity) void synchronizePortal(deviceIdentity);
  }, [deviceIdentity, synchronizePortal]));

  /**
   * Core connect logic. Accepts an explicit `effectiveHost` so both the main
   * button and the "try alternate protocol" quick action can call it without
   * waiting for a React state flush.
   */
  const performConnect = useCallback(async (effectiveHost: string) => {
    setError(null);
    setDiagInfo(null);

    const validationError = validateLoginFields(effectiveHost, username, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const profile: ServerProfile = {
        id: `server-${Date.now()}`,
        name: listName.trim() || username.trim(),
        serverUrl: normalizeUrl(effectiveHost),
        username: username.trim(),
        password,
        isActive: true,
        expiryDate: "Não informado",
        maxConnections: null,
        activeConnections: null,
        format: null,
        sourceType: "xtream",
        addedAt: new Date().toISOString(),
      };

      const authResult = await authenticateXtream(profile);
      const userInfo = authResult.user_info;

      if (!checkXtreamAuth(userInfo)) {
        setError("Usuário ou senha incorretos. Verifique suas credenciais e o endereço do servidor.");
        return;
      }

      const statusError = getUserStatusError(userInfo.status);
      if (statusError) {
        setError(statusError);
        return;
      }

      addServer({ ...profile, ...buildProfileUpdate(userInfo) });
      router.replace("/(tabs)");
    } catch (connectError) {
      logTechnicalError("Login Xtream", connectError);
      setError(mapConnectError(connectError));
      const diag = buildDiagInfoFromError(connectError);
      if (diag) setDiagInfo(diag);
    } finally {
      setLoading(false);
    }
  }, [addServer, listName, password, router, username]);

  const performCodeConnect = useCallback(async () => {
    setError(null);
    setDiagInfo(null);

    const validationError = validateCodeLoginFields(serverCode, username, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      // Only the normalized administrator code is sent to the Portal. IPTV
      // credentials are used exclusively by authenticateXtream below.
      const resolved = await resolveServerCode(serverCode);
      const profile: ServerProfile = {
        id: `server-code-${resolved.code}`,
        name: listName.trim() || username.trim(),
        serverUrl: resolved.host,
        username: username.trim(),
        password,
        isActive: true,
        expiryDate: "Não informado",
        maxConnections: null,
        activeConnections: null,
        format: null,
        sourceType: "xtream-code",
        serverCode: resolved.code,
        serverCodeUpdatedAt: resolved.updatedAt,
        portalMigrationState: "confirmed",
        addedAt: new Date().toISOString(),
      };
      const authResult = await authenticateXtream(profile);
      const userInfo = authResult.user_info;

      if (!checkXtreamAuth(userInfo)) {
        setError("Usuário ou senha incorretos. Verifique suas credenciais IPTV.");
        return;
      }
      const statusError = getUserStatusError(userInfo.status);
      if (statusError) {
        setError(statusError);
        return;
      }

      // The Portal receives only installation identity and code, never the
      // IPTV credentials that authenticated above.
      const identity = await getDeviceIdentity();
      const access = await revalidateCodeDevice(identity, resolved.code);
      setCodeAccessSnapshot(access);
      if (!access.canPlay || !access.canConnect) {
        setError(access.message ?? "Este dispositivo não está autorizado para este código.");
        return;
      }

      // The code is the stable identity: refresh a changed DNS without
      // duplicating this saved list or changing unrelated saved lists.
      upsertCodeServer({ ...profile, ...buildProfileUpdate(userInfo) });
      router.replace("/(tabs)");
    } catch (connectError) {
      logTechnicalError("Login Xtream por código", connectError);
      setError(mapConnectError(connectError));
    } finally {
      setLoading(false);
    }
  }, [listName, password, router, serverCode, username, upsertCodeServer, setCodeAccessSnapshot]);

  const handleConnect = useCallback(
    () => {
      if (accessMethod === "xtream-code") {
        void performCodeConnect();
        return;
      }
      void performConnect(host);
    },
    [accessMethod, host, performCodeConnect, performConnect],
  );

  /** Switches the host field to the alternate protocol and immediately retries. */
  const handleTryAlternateProtocol = useCallback(
    (alternateUrl: string) => {
      setHost(alternateUrl);
      performConnect(alternateUrl);
    },
    [performConnect],
  );


  const handleSelectSaved = useCallback(
    async (server: ServerProfile) => {
      setError(null);
      setDiagInfo(null);
      setShowSavedLists(false);

      if (server.portalManaged) {
        setLoading(true);
        try {
          // Keep M3U and Xtream source types intact; the Portal already matched Host/DNS.
          const access = await revalidatePortalManagedDevice(await getDeviceIdentity());
          setCodeAccessSnapshot(access);
          if (!access.canPlay || !access.canConnect) {
            setError(access.message ?? "O acesso a esta lista foi restringido pelo Portal.");
            return;
          }
          setActiveServer(server.id);
          router.replace("/(tabs)");
        } catch (connectError) {
          logTechnicalError("Reconexão de lista Portal", connectError);
          setError(mapConnectError(connectError));
        } finally { setLoading(false); }
        return;
      }

      if (server.sourceType !== "xtream-code" || !server.serverCode) {
        setActiveServer(server.id);
        router.replace("/(tabs)");
        return;
      }

      setLoading(true);
      try {
        // Restored profiles stay usable while the background migration awaits
        // Portal confirmation. Their saved Host and credentials are used as-is;
        // this path cannot create or restart a license trial.
        if (server.portalMigrationState !== "confirmed") {
          const authResult = await authenticateXtream(server);
          if (!checkXtreamAuth(authResult.user_info)) {
            setError("Usuário ou senha incorretos. Verifique suas credenciais IPTV.");
            return;
          }
          const statusError = getUserStatusError(authResult.user_info.status);
          if (statusError) {
            setError(statusError);
            return;
          }
          setActiveServer(server.id);
          router.replace("/(tabs)");
          return;
        }

        // Authorize a Portal-confirmed installation before resolving its current
        // Host/DNS. A failed lookup never falls back to a stale endpoint.
        const identity = await getDeviceIdentity();
        const access = await revalidateCodeDevice(identity, server.serverCode);
        setCodeAccessSnapshot(access);
        if (!access.canPlay || !access.canConnect) {
          setError(access.message ?? "Este dispositivo não está autorizado para este código.");
          return;
        }
        const resolved = await resolveServerCode(server.serverCode, identity);
        const refreshed: ServerProfile = {
          ...server,
          serverUrl: resolved.host,
          serverCode: resolved.code,
          serverCodeUpdatedAt: resolved.updatedAt,
        };
        const authResult = await authenticateXtream(refreshed);
        if (!checkXtreamAuth(authResult.user_info)) {
          setError("Usuário ou senha incorretos. Verifique suas credenciais IPTV.");
          return;
        }
        const statusError = getUserStatusError(authResult.user_info.status);
        if (statusError) {
          setError(statusError);
          return;
        }
        upsertCodeServer({ ...refreshed, ...buildProfileUpdate(authResult.user_info) });
        router.replace("/(tabs)");
      } catch (connectError) {
        logTechnicalError("Reconexão Xtream por código", connectError);
        setError(mapConnectError(connectError));
      } finally {
        setLoading(false);
      }
    },
    [router, setActiveServer, upsertCodeServer, setCodeAccessSnapshot]
  );

  const openSavedLists = useCallback(() => {
    setShowSavedLists(true);
    if (deviceIdentity) void synchronizePortal(deviceIdentity);
  }, [deviceIdentity, synchronizePortal]);

  const handlePortalSync = useCallback(() => {
    if (deviceIdentity) void synchronizePortal(deviceIdentity);
  }, [deviceIdentity, synchronizePortal]);

  const handleManagePortal = useCallback(() => {
    void Linking.openURL(PORTAL_LINKS.deviceAndPlaylists).catch((error) => {
      logTechnicalError("Login/openPortal", error);
      Alert.alert("Não foi possível abrir o Portal", "Verifique se há um navegador disponível neste dispositivo.");
    });
  }, []);

  const handlePortalLink = useCallback(async () => {
    if (!deviceIdentity || !portalLinkKey.trim()) return;
    const result = await synchronizePortal(deviceIdentity, portalLinkKey);
    if (result.state === "synced" || result.state === "no-playlist" || result.state === "inactive") {
      setPortalLinkKey("");
      setShowPortalLink(false);
    }
  }, [deviceIdentity, portalLinkKey, synchronizePortal]);

  const closeSavedLists = useCallback(() => {
    setShowSavedLists(false);
    requestAnimationFrame(() => savedListsButtonRef.current?.focus());
  }, []);

  const handleDeleteServer = useCallback(
    (id: string, name: string) => {
      Alert.alert(
        "Excluir lista",
        `Excluir lista "${name}"? As credenciais salvas serão removidas permanentemente.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Excluir",
            style: "destructive",
            onPress: async () => {
              try {
                await removeServer(id);
              } catch {
                Alert.alert("Não foi possível excluir", "Os dados foram preservados. Tente novamente.");
              }
            },
          },
        ]
      );
    },
    [removeServer]
  );

  const handleDeleteAll = useCallback(() => {
    Alert.alert(
      "Excluir todas as listas",
      "Todas as listas e credenciais salvas serão removidas permanentemente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir todas",
          style: "destructive",
          onPress: async () => {
            try {
              await removeAllServers();
              closeSavedLists();
            } catch {
              Alert.alert("Não foi possível excluir", "Os dados foram preservados. Tente novamente.");
            }
          },
        },
      ]
    );
  }, [closeSavedLists, removeAllServers]);

  return (
    <View style={styles.screen}>
      <BlurTargetView ref={backdropRef} collapsable={false} style={styles.loginBackdrop} pointerEvents="none">
        <Image
          source={tvMode
            ? require("@/assets/images/brand/ELVANOQ_login_tv_backdrop_v4.jpg")
            : require("@/assets/images/brand/ELVANOQ_login_mobile_backdrop_v4.jpg")}
          contentFit="cover"
          contentPosition={tvMode ? "center" : "top"}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.loginBackdropVeil, tvMode && styles.tvBackdropVeil]} />
      </BlurTargetView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            tvMode && styles.tvContent,
            isTablet && styles.tabletContent,
            isTabletLandscape && styles.tabletLandscapeContent,
            compactTv && styles.tvCompactContent,
            { paddingTop: insets.top + (compactTv ? 14 : 32), paddingBottom: insets.bottom + (compactTv ? 14 : 32) },
          ]}
        >
          {/* Logo section */}
          <View style={[styles.logoArea, tvMode && styles.tvLogoArea, isTablet && styles.tabletLogoArea, compactTv && styles.tvCompactLogoArea]}>
            <View style={styles.logoKicker}>
              <Ionicons name="shield-checkmark-outline" size={12} color={Colors.blueBright} />
              <AppText style={styles.logoKickerText}>ACESSO SEGURO</AppText>
            </View>
            <BrandLogo variant="loginWordmark" accessibilityLabel="ELVANOQ" style={[styles.brandLogo, tvMode ? (compactTv ? styles.brandLogoTvCompact : styles.brandLogoTv) : compactMobile && styles.brandLogoMobile]} />
          </View>

          {/* Glass card */}
          <View style={[styles.card, tvMode && styles.tvCard, isTablet && styles.tabletCard, isTabletLandscape && styles.tabletLandscapeCard, compactTv && styles.tvCompactCard]} onLayout={resolveFormFocusHandles}>
            <BlurView
              blurTarget={backdropRef}
              intensity={72}
              blurReductionFactor={1}
              tint="dark"
              blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.cardHighlight} pointerEvents="none" />
            <View style={[styles.cardInner, tvMode && styles.tvCardInner, compactTv && styles.tvCompactCardInner]}>
              <AppText style={styles.cardEyebrow}>COMECE AQUI</AppText>
              <AppText style={styles.cardTitle}>Configure sua lista{`\n`}para começar</AppText>
              <AppText style={styles.cardSubtitle}>
                {accessMethod === "chooser"
                  ? "Escolha como deseja conectar seu conteúdo ao ELVANOQ."
                  : accessMethod === "xtream-code"
                    ? "Informe o código recebido, seu usuário e sua senha IPTV."
                    : "Informe os dados do seu acesso Xtream Codes para conectar seu conteúdo."}
              </AppText>

              {accessMethod === "chooser" ? (
                <>
                  <TVFocusable
                    accessibilityRole="button"
                    accessibilityLabel="Conexão por código"
                    hasTVPreferredFocus={tvMode}
                    onPress={() => setAccessMethod("xtream-code")}
                    style={({ pressed }) => [styles.xtreamAccess, compactTv && styles.tvCompactXtreamAccess, pressed && styles.pressed]}
                    // The card is intentionally white. Its focus treatment
                    // preserves that premium surface instead of inheriting the
                    // generic dark TV focus background.
                    focusStyle={styles.xtreamAccessFocused}
                  >
                    <View style={styles.xtreamAccessIcon}><Ionicons name="server-outline" size={22} color={Colors.background} /></View>
                    <View style={styles.m3uAccessCopy}>
                      <AppText style={styles.xtreamAccessTitle}>Código do servidor</AppText>
                      <AppText style={styles.xtreamAccessMeta}>Código, usuário e senha da sua lista IPTV</AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color={Colors.background} />
                  </TVFocusable>

                  <TVFocusable
                    accessibilityRole="button"
                    accessibilityLabel="Conexão Xtream por Host"
                    onPress={() => setAccessMethod("xtream")}
                    style={({ pressed }) => [styles.m3uAccess, compactTv && styles.tvCompactM3uAccess, pressed && styles.pressed]}
                  >
                    <View style={styles.m3uAccessIcon}><Ionicons name="server-outline" size={18} color={Colors.blueBright} /></View>
                    <View style={styles.m3uAccessCopy}><AppText style={styles.m3uAccessTitle}>Xtream por Host</AppText><AppText style={styles.m3uAccessMeta}>Usar Host, usuário e senha diretamente</AppText></View>
                    <Ionicons name="chevron-forward" size={17} color={Colors.subtle} />
                  </TVFocusable>

                  <TVFocusable
                    ref={savedListsButtonRef}
                    accessibilityRole="button"
                    accessibilityLabel="Ver listas salvas"
                    onPress={openSavedLists}
                    style={({ pressed }) => [styles.m3uAccess, compactTv && styles.tvCompactM3uAccess, pressed && styles.pressed]}
                  >
                    <View style={styles.m3uAccessIcon}><Ionicons name="list-outline" size={18} color={Colors.blueBright} /></View>
                    <View style={styles.m3uAccessCopy}>
                      <AppText style={styles.m3uAccessTitle}>Listas Salvas</AppText>
                      <AppText style={styles.m3uAccessMeta}>{servers.length > 0 ? `${servers.length} lista${servers.length === 1 ? "" : "s"} disponível${servers.length === 1 ? "" : "is"}` : "Acesse uma lista já cadastrada"}</AppText>
                    </View>
                    {servers.length > 0 ? <View style={styles.secondaryBadge}><AppText style={styles.secondaryBadgeText}>{servers.length}</AppText></View> : null}
                    <Ionicons name="chevron-forward" size={17} color={Colors.subtle} />
                  </TVFocusable>
                </>
              ) : (
                <>
                  <TVFocusable
                    accessibilityRole="button"
                    accessibilityLabel="Voltar para métodos de conexão"
                    onPress={() => setAccessMethod("chooser")}
                    style={({ pressed }) => [styles.methodBackButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="chevron-back" size={15} color={Colors.blueBright} />
                    <AppText style={styles.methodBackText}>Métodos de conexão</AppText>
                  </TVFocusable>

              {accessMethod === "xtream-code" ? (
              <View style={styles.fieldGroup}>
                <AppText style={styles.fieldLabel}>CÓDIGO</AppText>
                <View style={[styles.inputWrapper, focusedField === "code" && styles.inputWrapperFocused]}>
                  <View style={styles.inputIconBox}><Ionicons name="key-outline" size={16} color={Colors.blueBright} /></View>
                  <TextInput
                    ref={serverCodeRef}
                    autoFocus={tvMode && accessMethod === "xtream-code"}
                    hasTVPreferredFocus={tvMode && accessMethod === "xtream-code"}
                    accessibilityLabel="Código do servidor"
                    {...({ nextFocusDown: formFocusHandles.username || undefined } as Record<string, number | undefined>)}
                    value={serverCode}
                    onChangeText={(value) => setServerCode(normalizeServerCode(value))}
                    placeholder="Ex.: pfast"
                    placeholderTextColor={Colors.subtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => usernameRef.current?.focus()}
                    onFocus={() => setFocusedField("code")}
                    onBlur={() => setFocusedField(null)}
                    style={styles.input}
                  />
                  {serverCode.length > 0 ? <TVFocusable onPress={() => setServerCode("")} style={styles.inputClearBtn} accessibilityLabel="Limpar código"><Ionicons name="close-circle" size={17} color={Colors.muted} /></TVFocusable> : null}
                </View>
                <AppText style={styles.fieldHint}>O código localiza o servidor cadastrado pelo administrador.</AppText>
              </View>
              ) : null}

              {/* Host field remains available for existing direct Xtream logins. */}
              {accessMethod === "xtream" ? <View style={styles.fieldGroup}>
                <AppText style={styles.fieldLabel}>HOST / URL DO SERVIDOR</AppText>
                <View style={[styles.inputWrapper, focusedField === "host" && styles.inputWrapperFocused]}>
                  <View style={styles.inputIconBox}>
                    <Ionicons name="server-outline" size={16} color={Colors.blueBright} />
                  </View>
                  <TextInput
                    ref={hostRef}
                    autoFocus={tvMode && accessMethod === "xtream"}
                    hasTVPreferredFocus={tvMode && accessMethod === "xtream"}
                    accessibilityLabel="Host ou URL do servidor"
                    {...({ nextFocusDown: formFocusHandles.username || undefined } as Record<string, number | undefined>)}
                    value={host}
                    onChangeText={setHost}
                    placeholder="http://servidor.tv:8080"
                    placeholderTextColor={Colors.subtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="next"
                    onSubmitEditing={() => usernameRef.current?.focus()}
                    onFocus={() => setFocusedField("host")}
                    onBlur={() => setFocusedField(null)}
                    style={styles.input}
                  />
                  {host.length > 0 ? (
                    <TVFocusable
                      onPress={() => setHost("")}
                      style={styles.inputClearBtn}
                      accessibilityLabel="Limpar host"
                    >
                      <Ionicons name="close-circle" size={17} color={Colors.muted} />
                    </TVFocusable>
                  ) : null}
                </View>
                <AppText style={styles.fieldHint}>
                  HTTP e HTTPS suportados · Portas personalizadas aceitas
                </AppText>
              </View> : null}

              {/* Username field */}
              <View style={styles.fieldGroup}>
                <AppText style={styles.fieldLabel}>USUÁRIO</AppText>
                <View style={[styles.inputWrapper, focusedField === "username" && styles.inputWrapperFocused]}>
                  <View style={styles.inputIconBox}>
                    <Ionicons name="person-outline" size={16} color={Colors.blueBright} />
                  </View>
                  <TextInput
                    ref={usernameRef}
                    value={username}
                    accessibilityLabel="Usuário"
                    {...({
                      nextFocusUp: (accessMethod === "xtream-code" ? formFocusHandles.code : formFocusHandles.host) || undefined,
                      nextFocusDown: formFocusHandles.password || undefined,
                    } as Record<string, number | undefined>)}
                    onChangeText={setUsername}
                    placeholder="Seu usuário"
                    placeholderTextColor={Colors.subtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    onFocus={() => setFocusedField("username")}
                    onBlur={() => setFocusedField(null)}
                    style={styles.input}
                  />
                  {username.length > 0 ? (
                    <TVFocusable
                      onPress={() => setUsername("")}
                      style={styles.inputClearBtn}
                      accessibilityLabel="Limpar usuário"
                    >
                      <Ionicons name="close-circle" size={17} color={Colors.muted} />
                    </TVFocusable>
                  ) : null}
                </View>
              </View>

              {/* Password field */}
              <View style={styles.fieldGroup}>
                <AppText style={styles.fieldLabel}>SENHA</AppText>
                <View style={[styles.inputWrapper, focusedField === "password" && styles.inputWrapperFocused]}>
                  <View style={styles.inputIconBox}>
                    <Ionicons name="lock-closed-outline" size={16} color={Colors.blueBright} />
                  </View>
                  <TextInput
                    ref={passwordRef}
                    value={password}
                    accessibilityLabel="Senha"
                    {...({
                      nextFocusUp: formFocusHandles.username || undefined,
                      nextFocusDown: formFocusHandles.listName || undefined,
                    } as Record<string, number | undefined>)}
                    onChangeText={setPassword}
                    placeholder="Sua senha"
                    placeholderTextColor={Colors.subtle}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => listNameRef.current?.focus()}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    style={styles.input}
                  />
                  <TVFocusable
                    onPress={() => setShowPassword((v) => !v)}
                    style={styles.inputClearBtn}
                    accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={17}
                      color={Colors.muted}
                    />
                  </TVFocusable>
                </View>
              </View>

              {/* Optional name field */}
              <View style={styles.fieldGroup}>
                <AppText style={styles.fieldLabel}>
                  NOME DA LISTA{" "}
                  <AppText style={styles.optionalTag}>(OPCIONAL)</AppText>
                </AppText>
                <View style={[styles.inputWrapper, focusedField === "listName" && styles.inputWrapperFocused]}>
                  <View style={styles.inputIconBox}>
                    <Ionicons name="bookmark-outline" size={16} color={Colors.blueBright} />
                  </View>
                  <TextInput
                    ref={listNameRef}
                    value={listName}
                    accessibilityLabel="Nome da lista, opcional"
                    {...({
                      nextFocusUp: formFocusHandles.password || undefined,
                      nextFocusDown: formFocusHandles.connect || undefined,
                    } as Record<string, number | undefined>)}
                    onChangeText={setListName}
                    placeholder="Ex.: Minha Lista IPTV"
                    placeholderTextColor={Colors.subtle}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={handleConnect}
                    onFocus={() => setFocusedField("listName")}
                    onBlur={() => setFocusedField(null)}
                    style={styles.input}
                  />
                  {listName.length > 0 ? (
                    <TVFocusable
                      onPress={() => setListName("")}
                      style={styles.inputClearBtn}
                      accessibilityLabel="Limpar nome da lista"
                    >
                      <Ionicons name="close-circle" size={17} color={Colors.muted} />
                    </TVFocusable>
                  ) : null}
                </View>
              </View>

              {/* Error box */}
              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={17} color="#FF8B91" />
                  <AppText style={styles.errorText} selectable>{error}</AppText>
                </View>
              ) : null}

              {/* Diagnostic card — shown after a connection error */}
              {diagInfo ? (
                <View style={styles.diagCard}>
                  <View style={styles.diagHeader}>
                    <Ionicons name="analytics-outline" size={14} color={Colors.amber} />
                    <AppText style={styles.diagTitle}>Diagnóstico de Conexão</AppText>
                  </View>
                  <View style={styles.diagUrlRow}>
                    <AppText style={styles.diagUrlLabel}>URL testada:</AppText>
                    <AppText style={styles.diagUrl} selectable numberOfLines={1}>
                      {diagInfo.testedUrl}
                    </AppText>
                  </View>
                  <TVFocusable
                    accessibilityRole="button"
                    accessibilityLabel={`Tentar com ${diagInfo.alternateProtocol}`}
                    onPress={() => handleTryAlternateProtocol(diagInfo.alternateUrl)}
                    style={({ pressed }) => [styles.diagBtn, pressed && styles.pressed]}
                  >
                    <Ionicons name="swap-horizontal-outline" size={14} color={Colors.blueBright} />
                    <AppText style={styles.diagBtnText}>
                      Tentar com {diagInfo.alternateProtocol}{" "}
                      <AppText style={styles.diagBtnHint}>
                        ({diagInfo.alternateUrl})
                      </AppText>
                    </AppText>
                  </TVFocusable>
                </View>
              ) : null}

              {/* Connect button */}
              <TVFocusable
                ref={connectButtonRef}
                accessibilityRole="button"
                accessibilityLabel="Conectar e Carregar Lista"
                disabled={loading}
                onPress={handleConnect}
                hasTVPreferredFocus={!tvMode}
                nextFocusUp={formFocusHandles.listName || undefined}
                style={({ pressed }) => [
                  styles.connectBtn,
                  pressed && styles.pressed,
                  loading && styles.btnDisabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.background} size="small" />
                ) : (
                  <>
                    <Ionicons name="link" size={17} color={Colors.background} />
                    <AppText style={styles.connectBtnText}>
                      Conectar e Carregar Lista
                    </AppText>
                  </>
                )}
              </TVFocusable>

              <View style={styles.securityRow}>
                <Ionicons name="lock-closed" size={12} color={Colors.subtle} />
                <AppText style={styles.securityText}>
                  Credenciais salvas apenas neste dispositivo
                </AppText>
              </View>
                </>
              )}
            </View>
          </View>

          <View style={[styles.releaseFooter, tvMode && styles.tvReleaseFooter, compactTv && styles.tvCompactReleaseFooter]}>
            {!tvMode ? <DeviceIdentityPanel identity={deviceIdentity} status={portalDeviceStatus} /> : null}
            <AppText style={styles.releaseFooterText}>
              ELVANOQ · Versão {APP_VERSION} · Build {APP_BUILD}
            </AppText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {tvMode ? <View pointerEvents="none" style={[styles.tvDeviceIdentity, { right: Math.max(28, insets.right + 22), bottom: Math.max(22, insets.bottom + 16) }]}><DeviceIdentityPanel identity={deviceIdentity} status={portalDeviceStatus} compact /></View> : null}

      {/* Saved Lists Modal */}
      <Modal
        visible={showSavedLists}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : "overFullScreen"}
        transparent={Platform.OS !== "ios"}
        onRequestClose={closeSavedLists}
      >
        {Platform.OS !== "ios" ? (
          <View
            accessibilityViewIsModal
            importantForAccessibility="yes"
            onAccessibilityEscape={closeSavedLists}
            style={styles.modalOverlay}
          >
            <SavedListsModal
              servers={servers}
              onSelect={handleSelectSaved}
              onDelete={handleDeleteServer}
              onDeleteAll={handleDeleteAll}
              onClose={closeSavedLists}
              portalState={portalSyncState}
              portalMessage={portalSyncMessage}
              onSyncPortal={handlePortalSync}
              onLinkPortal={() => setShowPortalLink(true)}
              onManagePortal={handleManagePortal}
            />
          </View>
        ) : (
          <SavedListsModal
            servers={servers}
            onSelect={handleSelectSaved}
            onDelete={handleDeleteServer}
            onDeleteAll={handleDeleteAll}
            onClose={closeSavedLists}
            portalState={portalSyncState}
            portalMessage={portalSyncMessage}
            onSyncPortal={handlePortalSync}
            onLinkPortal={() => setShowPortalLink(true)}
            onManagePortal={handleManagePortal}
          />
        )}
      </Modal>

      <Modal visible={showPortalLink} transparent animationType="fade" onRequestClose={() => setShowPortalLink(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.portalLinkDialog}>
            <Ionicons name="key-outline" size={24} color={Colors.blueBright} />
            <AppText style={styles.portalLinkTitle}>Vincular chave do Portal</AppText>
            <AppText style={styles.portalLinkBody}>Informe a chave usada no cadastro ou a chave gerada pelo Portal. A chave local do aplicativo não será alterada.</AppText>
            <TextInput value={portalLinkKey} onChangeText={setPortalLinkKey} secureTextEntry autoCapitalize="none" autoCorrect={false} accessibilityLabel="Chave do Portal" placeholder="Chave do Portal" placeholderTextColor={Colors.subtle} style={styles.portalLinkInput} />
            <View style={styles.portalLinkActions}>
              <TVFocusable accessibilityRole="button" onPress={() => setShowPortalLink(false)} style={({ pressed }) => [styles.portalLinkCancel, pressed && styles.pressed]}><AppText style={styles.portalLinkCancelText}>Cancelar</AppText></TVFocusable>
              <TVFocusable accessibilityRole="button" disabled={!portalLinkKey.trim() || portalSyncState === "syncing"} onPress={() => void handlePortalLink()} style={({ pressed }) => [styles.portalLinkConfirm, pressed && styles.pressed]}><AppText style={styles.portalLinkConfirmText}>{portalSyncState === "syncing" ? "Verificando…" : "Vincular"}</AppText></TVFocusable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DeviceIdentityPanel({ identity, status, compact = false }: { identity: DeviceIdentity | null; status: PortalDeviceStatus | null; compact?: boolean }) {
  if (!identity) return null;
  const portalLabel = status?.state === "linked"
    ? "Portal: vinculado"
    : status?.state === "inactive"
      ? "Portal: dispositivo inativo"
      : status?.state === "migration-pending"
        ? "Portal: regularização pendente"
        : status?.state === "pending"
        ? "Portal: aguardando vínculo"
        : null;
  return <View style={[styles.deviceIdentity, compact && styles.tvDeviceIdentityPanel]}>
    <View style={styles.deviceIdentityCopy}>
      <AppText style={styles.deviceIdentityText}>MAC: {identity.macAddress}</AppText>
      <AppText style={styles.deviceIdentityText}>Chave: {identity.deviceKey}</AppText>
      {portalLabel ? <AppText style={styles.deviceIdentityText}>{portalLabel}</AppText> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loginBackdrop: { ...StyleSheet.absoluteFill },
  loginBackdropVeil: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(2, 6, 15, 0.06)" },
  tvBackdropVeil: { backgroundColor: "rgba(2, 6, 15, 0.10)" },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 20,
    alignItems: "stretch",
  },
  tvContent: {
    width: "40%",
    maxWidth: 520,
    alignSelf: "flex-start",
    marginLeft: "8%",
    gap: 18,
    paddingHorizontal: 0,
  },
  tvCompactContent: { width: "38%", maxWidth: 470, marginLeft: "7%", gap: 11 },
  tabletContent: { width: "100%", maxWidth: 620, alignSelf: "center", paddingHorizontal: 0 },
  tabletLandscapeContent: { maxWidth: 580, alignSelf: "flex-start", marginLeft: "10%" },
  releaseFooter: { alignItems: "center", paddingTop: 2, paddingBottom: 4 },
  tvReleaseFooter: { alignItems: "flex-start", paddingTop: 6 },
  tvCompactReleaseFooter: { paddingTop: 1, paddingBottom: 0 },
  releaseFooterText: { fontFamily: "Inter_500Medium", fontSize: 10, letterSpacing: 0.25, color: "rgba(219, 234, 254, 0.54)" },
  deviceIdentity: { alignSelf: "center", alignItems: "center", marginBottom: 7 },
  tvDeviceIdentity: { position: "absolute", alignItems: "flex-end" },
  tvDeviceIdentityPanel: { alignSelf: "flex-end", marginBottom: 0 },
  deviceIdentityCopy: { gap: 1, alignItems: "center" },
  deviceIdentityText: { fontFamily: "Inter_500Medium", fontSize: 10, letterSpacing: 0.3, color: Colors.white },
  logoArea: {
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
  },
  tvLogoArea: { alignItems: "flex-start", paddingBottom: 12 },
  tabletLogoArea: { alignItems: "center", paddingBottom: 14 },
  tvCompactLogoArea: { gap: 5, paddingBottom: 3 },
  logoKicker: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1, borderColor: "rgba(34,211,238,0.22)", backgroundColor: "rgba(5,17,35,0.48)" },
  logoKickerText: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 1.1, color: Colors.blueBright },
  brandLogo: { width: 270, height: 81 },
  brandLogoMobile: { width: 270, height: 81 },
  brandLogoTv: { width: 465, maxWidth: 465, height: 141 },
  brandLogoTvCompact: { width: 330, maxWidth: 330, height: 100 },
  card: {
    overflow: "hidden",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(191,219,254,0.18)",
    // The translucent tint lets the native BlurView behind this surface remain
    // visible, while keeping the login controls readable over poster artwork.
    backgroundColor: "rgba(10,15,25,0.20)",
    ...Shadows.card,
  },
  tvCard: { borderRadius: 28, borderColor: "rgba(191,219,254,0.24)", backgroundColor: "rgba(8,14,27,0.22)" },
  tabletCard: { borderRadius: 26 },
  tabletLandscapeCard: { backgroundColor: "rgba(8,14,27,0.26)" },
  tvCompactCard: { borderRadius: 22 },
  cardHighlight: { position: "absolute", top: 0, right: 0, left: 0, height: 1, backgroundColor: "rgba(255,255,255,0.26)" },
  cardInner: {
    gap: 15,
    padding: 22,
  },
  tvCardInner: { gap: 17, paddingHorizontal: 34, paddingVertical: 30 },
  tvCompactCardInner: { gap: 10, paddingHorizontal: 22, paddingVertical: 18 },
  cardEyebrow: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 1.3, color: Colors.blueBright, marginBottom: -8 },
  cardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 21,
    color: Colors.text,
    letterSpacing: -0.45,
    lineHeight: 26,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.muted,
    marginTop: -8,
  },
  m3uAccess: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 11, borderRadius: 14, borderWidth: 1, borderColor: "rgba(147,197,253,0.20)", backgroundColor: "rgba(255,255,255,0.045)" },
  xtreamAccess: { minHeight: 86, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 15, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.96)", backgroundColor: Colors.white },
  tvCompactM3uAccess: { minHeight: 52, paddingHorizontal: 10 },
  tvCompactXtreamAccess: { minHeight: 72, paddingHorizontal: 13, gap: 11, borderRadius: 16 },
  xtreamAccessFocused: {
    // Override TVFocusable's generic blue surface: focused Xtream stays white.
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.blueBright,
    opacity: 1,
    transform: [{ scale: 1 }],
  },
  xtreamAccessIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "rgba(15,23,42,0.10)", borderWidth: 1, borderColor: "rgba(15,23,42,0.12)" },
  xtreamAccessTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.background },
  xtreamAccessMeta: { fontSize: 12, lineHeight: 17, color: "rgba(10,18,34,0.64)" },
  m3uAccessIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "rgba(59,130,246,0.14)" },
  m3uAccessCopy: { flex: 1, gap: 2 },
  m3uAccessTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  m3uAccessMeta: { fontSize: 10, color: Colors.muted },
  methodBackButton: { alignSelf: "flex-start", minHeight: 30, flexDirection: "row", alignItems: "center", gap: 4, marginBottom: -5, paddingHorizontal: 4, borderRadius: 9 },
  methodBackText: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.blueBright },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.8,
    color: Colors.muted,
  },
  optionalTag: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    letterSpacing: 0.4,
    color: Colors.subtle,
  },
  inputWrapper: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(3,7,14,0.46)",
    overflow: "hidden",
  },
  inputWrapperFocused: {
    borderWidth: 2,
    borderColor: Colors.blueBright,
    backgroundColor: "rgba(36,99,235,0.14)",
  },
  inputIconBox: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.18)",
    backgroundColor: "rgba(14,38,67,0.52)",
  },
  input: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 11,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
  },
  inputClearBtn: {
    width: 44,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldHint: {
    fontSize: 10,
    color: Colors.subtle,
    lineHeight: 14,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: Radii.small,
    backgroundColor: "rgba(229,9,20,0.1)",
    borderWidth: 1,
    borderColor: "rgba(229,9,20,0.2)",
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: "#FF8B91",
  },
  connectBtn: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 15,
    backgroundColor: Colors.white,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",
  },
  connectBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.background,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.975 }],
  },
  btnDisabled: {
    opacity: 0.5,
  },
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  securityText: {
    fontSize: 10,
    color: Colors.subtle,
  },
  secondaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(191,219,254,0.15)",
    backgroundColor: "rgba(15,20,31,0.55)",
    overflow: "hidden",
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
  },
  tvCompactSecondaryRow: { borderRadius: 15 },
  tvCompactSecondaryBtn: { minHeight: 46 },
  secondaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  secondaryBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.text,
  },
  secondaryBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.blue,
  },
  secondaryBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: Colors.white,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  portalLinkDialog: { width: "88%", maxWidth: 430, alignSelf: "center", marginTop: "auto", marginBottom: "auto", padding: 22, borderRadius: 18, backgroundColor: Colors.backgroundRaised, borderWidth: 1, borderColor: Colors.border, gap: 11 },
  portalLinkTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.text },
  portalLinkBody: { fontSize: 12, lineHeight: 18, color: Colors.muted },
  portalLinkInput: { minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, color: Colors.text, paddingHorizontal: 12, backgroundColor: "rgba(255,255,255,0.06)" },
  portalLinkActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  portalLinkCancel: { minHeight: 42, paddingHorizontal: 16, justifyContent: "center", borderRadius: 10 },
  portalLinkCancelText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.muted },
  portalLinkConfirm: { minHeight: 42, paddingHorizontal: 17, justifyContent: "center", borderRadius: 10, backgroundColor: Colors.text },
  portalLinkConfirmText: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.background },
  diagCard: {
    borderRadius: Radii.small,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.28)",
    backgroundColor: "rgba(245,158,11,0.07)",
    padding: 12,
    gap: 8,
  },
  diagHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  diagTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.4,
    color: Colors.amber,
  },
  diagUrlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  diagUrlLabel: {
    fontSize: 11,
    color: Colors.subtle,
    fontFamily: "Inter_400Regular",
  },
  diagUrl: {
    fontSize: 11,
    color: Colors.muted,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  diagBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(96,165,250,0.1)",
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.22)",
  },
  diagBtnText: {
    fontSize: 12,
    color: Colors.blueBright,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  diagBtnHint: {
    fontSize: 11,
    color: Colors.subtle,
    fontFamily: "Inter_400Regular",
  },
});

const modalStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.backgroundRaised,
    borderTopLeftRadius: Radii.large,
    borderTopRightRadius: Radii.large,
    minHeight: 400,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 19,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59,130,246,0.18)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.3)",
  },
  countText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: Colors.blueBright,
  },
  closeBtn: {
    position: "absolute",
    right: 20,
    bottom: 16,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  listContent: {
    gap: 8,
    padding: 20,
    paddingBottom: 24,
  },
  portalSyncCard: { gap: 9, padding: 12, borderRadius: Radii.medium, borderWidth: 1, borderColor: "rgba(96,165,250,0.26)", backgroundColor: "rgba(59,130,246,0.07)" },
  portalSyncCopy: { gap: 3 },
  portalSyncTitle: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.text },
  portalSyncBody: { fontSize: 11, lineHeight: 16, color: Colors.muted },
  portalSyncButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, backgroundColor: Colors.text },
  portalSyncButtonText: { fontFamily: "Inter_700Bold", fontSize: 12, color: Colors.background },
  portalManageButton: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, borderWidth: 1, borderColor: "rgba(96,165,250,0.32)" },
  portalManageButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.blueBright },
  portalLinkButton: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, borderWidth: 1, borderColor: "rgba(96,165,250,0.32)" },
  portalLinkButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.blueBright },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 10,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
  },
  emptyBody: {
    maxWidth: 260,
    textAlign: "center",
    fontSize: 13,
    color: Colors.muted,
    lineHeight: 19,
  },
  serverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.glass,
    overflow: "hidden",
  },
  serverMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12,
    paddingRight: 8,
  },
  serverIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.06)",
    flexShrink: 0,
  },
  serverIconActive: {
    backgroundColor: "rgba(16,185,129,0.14)",
  },
  serverInfo: {
    flex: 1,
    gap: 3,
  },
  serverNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  serverName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
  activeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: "rgba(16,185,129,0.16)",
  },
  activeBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 8,
    letterSpacing: 0.4,
    color: Colors.green,
  },
  serverUrl: {
    fontSize: 11,
    color: Colors.blueBright,
    fontFamily: "Inter_400Regular",
  },
  serverMeta: {
    fontSize: 10,
    color: Colors.subtle,
  },
  deleteBtn: {
    width: 52,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    backgroundColor: "rgba(229,9,20,0.06)",
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.975 }],
  },
  deleteAllBtn: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: "rgba(229,9,20,0.25)",
    backgroundColor: "rgba(229,9,20,0.07)",
    marginTop: 8,
  },
  deleteAllText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.red,
  },
});
