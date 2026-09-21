import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { authenticateXtream } from "@/services/xtream";
import { useAppStore } from "@/store/useAppStore";
import type { ServerProfile } from "@/store/types";

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url) return url;

  // Add protocol if missing
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `http://${url}`;
  }

  // Remove trailing slashes
  url = url.replace(/\/+$/, "");

  // Strip common API path suffixes users accidentally paste
  url = url.replace(
    /\/(player_api\.php|get\.php|xmltv\.php|live|vod|series|movie|c)(\/.*)?(\?.*)?$/i,
    "",
  );

  return url;
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

function validateLoginFields(host: string, username: string, password: string): string | null {
  if (!normalizeUrl(host)) return "Informe o Host / URL do servidor.";
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
}

function SavedListsModal({ servers, onSelect, onDelete, onDeleteAll, onClose }: SavedListsModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[modalStyles.screen, { paddingBottom: insets.bottom }]}>
      <View style={modalStyles.header}>
        <View style={modalStyles.grabber} />
        <View style={modalStyles.titleRow}>
          <AppText style={modalStyles.title}>Listas Salvas</AppText>
          <View style={modalStyles.countBadge}>
            <AppText style={modalStyles.countText}>{servers.length}</AppText>
          </View>
        </View>
        <TVFocusable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
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
                    {server.serverUrl}
                  </AppText>
                  <AppText style={modalStyles.serverMeta}>
                    {server.username} · Adicionado em {formatAddedAt(server.addedAt)}
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
  const insets = useSafeAreaInsets();
  const addServer = useAppStore((state) => state.addServer);
  const setActiveServer = useAppStore((state) => state.setActiveServer);
  const removeServer = useAppStore((state) => state.removeServer);
  const removeAllServers = useAppStore((state) => state.removeAllServers);
  const servers = useAppStore((state) => state.servers);

  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [listName, setListName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSavedLists, setShowSavedLists] = useState(false);

  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const listNameRef = useRef<TextInput>(null);

  const handleConnect = useCallback(async () => {
    setError(null);
    const validationError = validateLoginFields(host, username, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const profile: ServerProfile = {
        id: `server-${Date.now()}`,
        name: listName.trim() || username.trim(),
        serverUrl: normalizeUrl(host),
        username: username.trim(),
        password,
        isActive: true,
        expiryDate: "Não informado",
        maxConnections: 1,
        activeConnections: 0,
        format: "HLS",
        addedAt: new Date().toISOString(),
      };

      const authResult = await authenticateXtream(profile);
      const userInfo = authResult.user_info;

      // Validate auth: servers return auth=1/"1"/true on success, auth=0/"0"/false on failure.
      // Some servers omit the auth field but still return a populated user_info on success.
      const authValue = userInfo?.auth;
      const isAuthenticated =
        authValue === 1 ||
        authValue === "1" ||
        authValue === true ||
        // Fallback: no auth field but username is present (server authenticated successfully)
        (authValue === undefined && !!userInfo?.username);

      if (!userInfo || !isAuthenticated) {
        setError("Usuário ou senha incorretos. Verifique suas credenciais e o endereço do servidor.");
        return;
      }

      const statusError = getUserStatusError(userInfo.status);
      if (statusError) {
        setError(statusError);
        return;
      }

      const hasM3u8 =
        Array.isArray(userInfo.allowed_output_formats) &&
        userInfo.allowed_output_formats.includes("m3u8");
      addServer({
        ...profile,
        expiryDate: parseExpiryDisplay(userInfo.exp_date ?? null),
        maxConnections: Number(userInfo.max_connections) || 1,
        activeConnections: Number(userInfo.active_cons) || 0,
        format: hasM3u8 ? "HLS" : "TS",
      });
      router.replace("/(tabs)");
    } catch (connectError) {
      console.error("Falha ao conectar servidor Xtream", connectError);
      setError(mapConnectError(connectError));
    } finally {
      setLoading(false);
    }
  }, [addServer, host, listName, password, router, username]);

  const handleDemo = useCallback(() => {
    const demoServer = servers.find((s) => s.id === "demo-premium");
    if (demoServer) {
      setActiveServer(demoServer.id);
    } else {
      addServer({
        id: "demo-premium",
        name: "Premium Plus (Demo)",
        serverUrl: "https://demo.flixplay.tv",
        username: "demo",
        password: "demo",
        isActive: true,
        expiryDate: "18/12/2025",
        maxConnections: 3,
        activeConnections: 1,
        format: "HLS",
        addedAt: new Date().toISOString(),
      });
    }
    router.replace("/(tabs)");
  }, [addServer, router, servers, setActiveServer]);

  const handleSelectSaved = useCallback(
    (server: ServerProfile) => {
      setActiveServer(server.id);
      setShowSavedLists(false);
      router.replace("/(tabs)");
    },
    [router, setActiveServer]
  );

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
            onPress: () => removeServer(id),
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
          onPress: () => {
            removeAllServers();
            setShowSavedLists(false);
          },
        },
      ]
    );
  }, [removeAllServers]);

  return (
    <View style={styles.screen}>
      {/* Ambient orbs */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />
      <View style={styles.orb3} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
          ]}
        >
          {/* Logo section */}
          <View style={styles.logoArea}>
            <View style={styles.logoIconWrapper}>
              <View style={styles.logoIconGlow} />
              <View style={styles.logoIconInner}>
                <Ionicons name="tv" size={28} color={Colors.white} />
              </View>
            </View>
            <AppText style={styles.logoTitle}>FlixPlay</AppText>
            <AppText style={styles.logoSubtitle}>Plataforma IPTV · Xtream Codes</AppText>
          </View>

          {/* Glass card */}
          <View style={styles.card}>
            <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.cardInner}>
              <AppText style={styles.cardTitle}>Entrar na conta</AppText>
              <AppText style={styles.cardSubtitle}>
                Conecte seu servidor Xtream Codes
              </AppText>

              {/* Host field */}
              <View style={styles.fieldGroup}>
                <AppText style={styles.fieldLabel}>HOST / URL DO SERVIDOR</AppText>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconBox}>
                    <Ionicons name="server-outline" size={16} color={Colors.blueBright} />
                  </View>
                  <TextInput
                    value={host}
                    onChangeText={setHost}
                    placeholder="http://servidor.tv:8080"
                    placeholderTextColor={Colors.subtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="next"
                    onSubmitEditing={() => usernameRef.current?.focus()}
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
              </View>

              {/* Username field */}
              <View style={styles.fieldGroup}>
                <AppText style={styles.fieldLabel}>USUÁRIO</AppText>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconBox}>
                    <Ionicons name="person-outline" size={16} color={Colors.blueBright} />
                  </View>
                  <TextInput
                    ref={usernameRef}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Seu usuário"
                    placeholderTextColor={Colors.subtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
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
                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconBox}>
                    <Ionicons name="lock-closed-outline" size={16} color={Colors.blueBright} />
                  </View>
                  <TextInput
                    ref={passwordRef}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Sua senha"
                    placeholderTextColor={Colors.subtle}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => listNameRef.current?.focus()}
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
                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconBox}>
                    <Ionicons name="bookmark-outline" size={16} color={Colors.blueBright} />
                  </View>
                  <TextInput
                    ref={listNameRef}
                    value={listName}
                    onChangeText={setListName}
                    placeholder="Ex.: Minha Lista IPTV"
                    placeholderTextColor={Colors.subtle}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={handleConnect}
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
                  <AppText style={styles.errorText}>{error}</AppText>
                </View>
              ) : null}

              {/* Connect button */}
              <TVFocusable
                accessibilityRole="button"
                accessibilityLabel="Conectar e Carregar Lista"
                disabled={loading}
                onPress={handleConnect}
                hasTVPreferredFocus
                style={({ pressed }) => [
                  styles.connectBtn,
                  pressed && styles.pressed,
                  loading && styles.btnDisabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="link" size={17} color={Colors.white} />
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
            </View>
          </View>

          {/* Secondary actions */}
          <View style={styles.secondaryRow}>
            <TVFocusable
              accessibilityRole="button"
              accessibilityLabel="Ver listas salvas"
              onPress={() => setShowSavedLists(true)}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            >
              <Ionicons name="list" size={16} color={Colors.blueBright} />
              <AppText style={styles.secondaryBtnText}>Listas Salvas</AppText>
              {servers.length > 0 ? (
                <View style={styles.secondaryBadge}>
                  <AppText style={styles.secondaryBadgeText}>{servers.length}</AppText>
                </View>
              ) : null}
            </TVFocusable>

            <View style={styles.secondaryDivider} />

            <TVFocusable
              accessibilityRole="button"
              accessibilityLabel="Entrar no modo demonstração"
              onPress={handleDemo}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            >
              <Ionicons name="flash" size={16} color={Colors.amber} />
              <AppText style={styles.secondaryBtnText}>Modo Demo</AppText>
            </TVFocusable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Saved Lists Modal */}
      <Modal
        visible={showSavedLists}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : "overFullScreen"}
        transparent={Platform.OS !== "ios"}
        onRequestClose={() => setShowSavedLists(false)}
      >
        {Platform.OS !== "ios" ? (
          <View style={styles.modalOverlay}>
            <SavedListsModal
              servers={servers}
              onSelect={handleSelectSaved}
              onDelete={handleDeleteServer}
              onDeleteAll={handleDeleteAll}
              onClose={() => setShowSavedLists(false)}
            />
          </View>
        ) : (
          <SavedListsModal
            servers={servers}
            onSelect={handleSelectSaved}
            onDelete={handleDeleteServer}
            onDeleteAll={handleDeleteAll}
            onClose={() => setShowSavedLists(false)}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  orb1: {
    position: "absolute",
    top: -80,
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(59,130,246,0.13)",
  },
  orb2: {
    position: "absolute",
    bottom: 80,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(96,165,250,0.07)",
  },
  orb3: {
    position: "absolute",
    top: "40%",
    left: "50%",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(139,92,246,0.05)",
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    gap: 20,
    paddingHorizontal: 20,
    alignItems: "stretch",
  },
  logoArea: {
    alignItems: "center",
    gap: 10,
    paddingBottom: 4,
  },
  logoIconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
  },
  logoIconGlow: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(59,130,246,0.28)",
  },
  logoIconInner: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.55)",
    backgroundColor: "rgba(59,130,246,0.22)",
  },
  logoTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: -0.6,
    color: Colors.text,
  },
  logoSubtitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 0.2,
    color: Colors.muted,
  },
  card: {
    overflow: "hidden",
    borderRadius: Radii.large,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: Colors.glass,
    ...Shadows.card,
  },
  cardInner: {
    gap: 14,
    padding: 20,
  },
  cardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 19,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.muted,
    marginTop: -8,
  },
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
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radii.small,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(7,9,14,0.5)",
    overflow: "hidden",
  },
  inputIconBox: {
    width: 44,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  input: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 12,
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
    borderRadius: Radii.pill,
    backgroundColor: Colors.blue,
    marginTop: 4,
  },
  connectBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.white,
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
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.glassSoft,
    overflow: "hidden",
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
  },
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
