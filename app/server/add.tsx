import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Colors, Radii } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText, IconButton } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import { authenticateXtream } from "@/services/xtream";
import { logTechnicalError } from "@/services/security/sanitize";
import type { ServerProfile } from "@/store/types";

export default function AddServerScreen() {
  const router = useRouter();
  const addServer = useAppStore((state) => state.addServer);
  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const trimmedUrl = serverUrl.trim();
    if (!name.trim() || !trimmedUrl || !username.trim() || !password) {
      setError("Preencha nome, URL, usuário e senha para continuar.");
      return;
    }
    setSaving(true);
    try {
      // Default to http:// — most IPTV servers are plain HTTP; the user can override with https://
      const normalizedUrl =
        trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")
          ? trimmedUrl
          : `http://${trimmedUrl}`;
      const profile: ServerProfile = {
        id: `server-${Date.now()}`,
        name: name.trim(),
        serverUrl: normalizedUrl,
        username: username.trim(),
        password,
        isActive: true,
        expiryDate: "Não informado",
        maxConnections: null,
        activeConnections: null,
        format: null,
        addedAt: new Date().toISOString(),
      };
      const auth = await authenticateXtream(profile);
      const userInfo = auth.user_info;
      const authenticated = userInfo && (userInfo.auth === 1 || userInfo.auth === "1" || userInfo.auth === true || (userInfo.auth === undefined && Boolean(userInfo.username)));
      if (!authenticated) throw new Error("Credenciais rejeitadas pelo servidor.");
      const formats = userInfo.allowed_output_formats?.map((value) => value.toLowerCase()) ?? [];
      addServer({
        ...profile,
        maxConnections: userInfo.max_connections ? Number(userInfo.max_connections) : null,
        activeConnections: userInfo.active_cons ? Number(userInfo.active_cons) : null,
        format: formats.includes("m3u8") ? "HLS" : formats.includes("ts") ? "TS" : null,
        status: userInfo.status ?? null,
      });
      router.back();
    } catch (saveError) {
      logTechnicalError("AddServer", saveError);
      setError(saveError instanceof Error ? saveError.message : "Não foi possível validar este servidor.");
    } finally {
      setSaving(false);
    }
  }, [addServer, name, password, router, serverUrl, username]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}><IconButton icon="close" label="Fechar" onPress={() => router.back()} /><View style={styles.headerTitle}><AppText style={styles.kicker}>NOVA CONEXÃO</AppText><AppText style={styles.title}>Adicionar servidor</AppText></View><View style={styles.headerSpacer} /></View>
        <AppText style={styles.intro}>Conecte uma lista Xtream Codes para acessar seu conteúdo.</AppText>
        <View style={styles.form}>
          <Field label="Nome da lista" value={name} onChangeText={setName} placeholder="Ex.: Minha lista" />
          <Field label="URL do servidor" value={serverUrl} onChangeText={setServerUrl} placeholder="http://servidor.com:8080" keyboardType="url" autoCapitalize="none" />
          <Field label="Usuário" value={username} onChangeText={setUsername} placeholder="Seu usuário" autoCapitalize="none" /><Field label="Senha" value={password} onChangeText={setPassword} placeholder="Sua senha" secureTextEntry autoCapitalize="none" />
          {serverUrl.trim().startsWith("http://") ? <View style={styles.tip}><Ionicons name="shield-outline" size={17} color={Colors.amber} /><AppText style={styles.tipText}>Conexão sem criptografia fornecida pelo servidor.</AppText></View> : null}
        </View>
        {error ? <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={18} color={Colors.red} /><AppText style={styles.errorText}>{error}</AppText></View> : null}
        <TVFocusable accessibilityRole="button" disabled={saving} onPress={handleSubmit} style={({ pressed }) => [styles.submitButton, pressed && styles.pressed, saving && styles.disabled]}>{saving ? <ActivityIndicator color={Colors.white} /> : <><Ionicons name="link" size={17} color={Colors.white} /><AppText style={styles.submitText}>Conectar servidor</AppText></>}</TVFocusable>
        <AppText style={styles.security}><Ionicons name="lock-closed" size={12} color={Colors.subtle} /> Suas credenciais ficam salvas apenas neste dispositivo.</AppText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry = false, keyboardType = "default", autoCapitalize = "sentences" }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; secureTextEntry?: boolean; keyboardType?: "default" | "url"; autoCapitalize?: "none" | "sentences" }) {
  return <View style={styles.field}><AppText style={styles.fieldLabel}>{label}</AppText><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={Colors.subtle} secureTextEntry={secureTextEntry} keyboardType={keyboardType} autoCapitalize={autoCapitalize} style={styles.input} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { gap: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  headerTitle: { flex: 1, alignItems: "center", gap: 3 },
  headerSpacer: { width: 42 },
  kicker: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 1, color: Colors.blueBright },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text },
  intro: { fontSize: 14, lineHeight: 21, textAlign: "center", color: Colors.muted },
  form: { gap: 15, padding: 16, borderRadius: Radii.large, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  field: { gap: 7 },
  fieldLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.text },
  input: { height: 48, paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: Colors.border, backgroundColor: "rgba(7,9,14,0.42)", fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.text },
  tip: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, backgroundColor: "rgba(59,130,246,0.1)" },
  tipText: { flex: 1, fontSize: 12, lineHeight: 18, color: Colors.muted },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, backgroundColor: "rgba(229,9,20,0.12)" },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, color: "#FF8B91" },
  submitButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: Radii.pill, backgroundColor: Colors.blue },
  submitText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.white },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.55 },
  security: { alignSelf: "center", fontSize: 11, color: Colors.subtle },
});
