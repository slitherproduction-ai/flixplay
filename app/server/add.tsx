import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Colors, Radii } from "@/constants/theme";
import { AppText, Chip, IconButton } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";

type SourceKind = "Xtream Codes" | "Playlist M3U";

export default function AddServerScreen() {
  const router = useRouter();
  const addServer = useAppStore((state) => state.addServer);
  const [sourceKind, setSourceKind] = useState<SourceKind>("Xtream Codes");
  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const trimmedUrl = serverUrl.trim();
    if (!name.trim() || !trimmedUrl || (sourceKind === "Xtream Codes" && (!username.trim() || !password))) {
      setError(sourceKind === "Xtream Codes" ? "Preencha nome, URL, usuário e senha para continuar." : "Preencha um nome e a URL da playlist M3U.");
      return;
    }
    setSaving(true);
    try {
      const normalizedUrl = trimmedUrl.startsWith("http") ? trimmedUrl : `https://${trimmedUrl}`;
      addServer({
        id: `server-${Date.now()}`,
        name: name.trim(),
        serverUrl: normalizedUrl,
        username: sourceKind === "Xtream Codes" ? username.trim() : "m3u",
        password: sourceKind === "Xtream Codes" ? password : "playlist",
        isActive: true,
        expiryDate: "Não informado",
        maxConnections: 1,
        activeConnections: 0,
        format: sourceKind === "Playlist M3U" ? "M3U8" : "HLS",
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
      router.back();
    } catch (saveError) {
      console.error("Falha ao adicionar servidor", saveError);
      setError("Não foi possível salvar este servidor. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }, [addServer, name, password, router, serverUrl, sourceKind, username]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}><IconButton icon="close" label="Fechar" onPress={() => router.back()} /><View style={styles.headerTitle}><AppText style={styles.kicker}>NOVA CONEXÃO</AppText><AppText style={styles.title}>Adicionar servidor</AppText></View><View style={styles.headerSpacer} /></View>
        <AppText style={styles.intro}>Conecte uma lista Xtream Codes ou importe sua playlist M3U para acessar seu conteúdo.</AppText>
        <View style={styles.kindRow}><Chip label="Xtream Codes" selected={sourceKind === "Xtream Codes"} onPress={() => setSourceKind("Xtream Codes")} /><Chip label="Playlist M3U" selected={sourceKind === "Playlist M3U"} onPress={() => setSourceKind("Playlist M3U")} /></View>
        <View style={styles.form}>
          <Field label="Nome da lista" value={name} onChangeText={setName} placeholder="Ex.: Minha lista" />
          <Field label={sourceKind === "Playlist M3U" ? "URL da playlist M3U" : "URL do servidor"} value={serverUrl} onChangeText={setServerUrl} placeholder="https://exemplo.com" keyboardType="url" autoCapitalize="none" />
          {sourceKind === "Xtream Codes" ? <><Field label="Usuário" value={username} onChangeText={setUsername} placeholder="Seu usuário" autoCapitalize="none" /><Field label="Senha" value={password} onChangeText={setPassword} placeholder="Sua senha" secureTextEntry autoCapitalize="none" /></> : <View style={styles.tip}><Ionicons name="information-circle-outline" size={17} color={Colors.blueBright} /><AppText style={styles.tipText}>Use uma URL M3U ou M3U8 direta. O FlixPlay vai organizar canais e categorias automaticamente.</AppText></View>}
        </View>
        {error ? <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={18} color={Colors.red} /><AppText style={styles.errorText}>{error}</AppText></View> : null}
        <Pressable accessibilityRole="button" disabled={saving} onPress={handleSubmit} style={({ pressed }) => [styles.submitButton, pressed && styles.pressed, saving && styles.disabled]}>{saving ? <ActivityIndicator color={Colors.white} /> : <><Ionicons name="link" size={17} color={Colors.white} /><AppText style={styles.submitText}>Conectar servidor</AppText></>}</Pressable>
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
  kindRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
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
