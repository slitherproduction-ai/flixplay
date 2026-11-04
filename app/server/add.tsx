import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Colors } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { Group, GroupLabel, PremiumBackdrop, PremiumHeading, PremiumTopBar, premium, usePremiumContentStyle } from "@/components/premium-screen";
import { useAppStore } from "@/store/useAppStore";
import { authenticateXtream } from "@/services/xtream";
import { logTechnicalError } from "@/services/security/sanitize";
import type { ServerProfile } from "@/store/types";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { buildProfileUpdate, checkXtreamAuth, getUserStatusError, mapConnectError } from "@/features/login/loginValidation";

export default function AddServerScreen() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const addServer = useAppStore((state) => state.addServer);
  const { tvMode, isTablet } = useResponsiveLayout();
  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sourceType, setSourceType] = useState<"xtream" | "m3u">(source === "m3u" ? "m3u" : "xtream");
  const [xmltvUrl, setXmltvUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (source === "m3u") setSourceType("m3u");
  }, [source]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const trimmedUrl = serverUrl.trim();
    if (!name.trim() || !trimmedUrl || (sourceType === "xtream" && (!username.trim() || !password))) {
      setError(sourceType === "m3u" ? "Preencha nome e URL M3U para continuar." : "Preencha nome, URL, usuário e senha para continuar.");
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
        username: username.trim(), password,
        isActive: true,
        expiryDate: "Não informado",
        maxConnections: null,
        activeConnections: null,
        format: null,
        addedAt: new Date().toISOString(),
        sourceType,
        ...(sourceType === "m3u" ? { m3uUrl: normalizedUrl, xmltvUrl: xmltvUrl.trim() || undefined } : {}),
      };
      if (sourceType === "m3u") {
        addServer(profile);
        // The login entry point opens this screen with source=m3u. In that
        // context, continue to the app so the initial M3U import can start.
        if (source === "m3u") router.replace("/(tabs)");
        else router.back();
        return;
      }
      // Mesmas regras do Login: credenciais, status da conta (expirada,
      // bloqueada) e dados da conta (validade, conexões) vêm do servidor.
      const auth = await authenticateXtream(profile);
      const userInfo = auth.user_info;
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
      router.back();
    } catch (saveError) {
      logTechnicalError("AddServer", saveError);
      setError(mapConnectError(saveError));
    } finally {
      setSaving(false);
    }
  }, [addServer, name, password, router, serverUrl, source, sourceType, username, xmltvUrl]);

  const contentStyle = usePremiumContentStyle({ tvMode, wide: isTablet }, tvMode ? 640 : 720);
  const isM3u = sourceType === "m3u";

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={premium.screen}>
      <PremiumBackdrop />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={contentStyle}>
        <PremiumTopBar title="Nova lista" backIcon="close" backLabel="Fechar" onBack={() => router.back()} />
        <PremiumHeading
          icon={isM3u ? "list-outline" : "server-outline"}
          title="Adicionar lista"
          subtitle={isM3u ? "Importe uma lista M3U ou M3U Plus, com guia XMLTV opcional." : "Conecte uma lista Xtream Codes para acessar seu conteúdo."}
        />

        <View style={styles.segment} accessibilityRole="tablist">
          <SegmentButton label="Xtream Codes" icon="server-outline" selected={!isM3u} onPress={() => setSourceType("xtream")} />
          <SegmentButton label="M3U" icon="list-outline" selected={isM3u} onPress={() => setSourceType("m3u")} />
        </View>

        <GroupLabel title="LISTA" />
        <Group style={styles.form}>
          <Field label="Nome da lista" value={name} onChangeText={setName} placeholder="Ex.: Minha lista" />
          <Field label={isM3u ? "URL M3U/M3U Plus" : "URL do servidor"} value={serverUrl} onChangeText={setServerUrl} placeholder={isM3u ? "https://servidor/lista.m3u" : "http://servidor.com:8080"} keyboardType="url" autoCapitalize="none" />
          {isM3u ? <Field label="URL XMLTV (opcional)" value={xmltvUrl} onChangeText={setXmltvUrl} placeholder="https://servidor/guia.xml" keyboardType="url" autoCapitalize="none" /> : null}
        </Group>

        {!isM3u ? <>
          <GroupLabel title="ACESSO" />
          <Group style={styles.form}>
            <Field label="Usuário" value={username} onChangeText={setUsername} placeholder="Seu usuário" autoCapitalize="none" />
            <Field label="Senha" value={password} onChangeText={setPassword} placeholder="Sua senha" secureTextEntry autoCapitalize="none" />
          </Group>
        </> : null}

        {serverUrl.trim().startsWith("http://") ? <View style={styles.tip}><Ionicons name="shield-outline" size={16} color={Colors.amber} /><AppText style={styles.tipText}>Conexão sem criptografia fornecida pelo servidor.</AppText></View> : null}
        {error ? <View style={premium.error} accessibilityLiveRegion="polite"><Ionicons name="alert-circle-outline" size={17} color="#FF8B91" /><AppText style={premium.errorText}>{error}</AppText></View> : null}

        <TVFocusable accessibilityRole="button" accessibilityLabel={isM3u ? "Importar lista" : "Conectar servidor"} disabled={saving} onPress={handleSubmit} focusStyle={premium.primaryFocused} style={({ pressed }) => [premium.button, premium.primaryButton, pressed && premium.pressed, saving && premium.disabled]}>
          {saving ? <ActivityIndicator color={Colors.background} /> : <><Ionicons name={isM3u ? "download-outline" : "link"} size={17} color={Colors.background} /><AppText style={[premium.buttonText, { color: Colors.background }]}>{isM3u ? "Importar lista" : "Conectar servidor"}</AppText></>}
        </TVFocusable>
        <View style={styles.security}><Ionicons name="lock-closed" size={12} color={Colors.subtle} /><AppText style={premium.footnote}>Suas credenciais ficam salvas apenas neste aparelho.</AppText></View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SegmentButton({ label, icon, selected, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; selected: boolean; onPress: () => void }) {
  return <TVFocusable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} focusStyle={styles.segmentFocused} style={[styles.segmentButton, selected && styles.segmentSelected]}>
    <Ionicons name={icon} size={15} color={selected ? Colors.background : Colors.muted} />
    <AppText style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</AppText>
  </TVFocusable>;
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry = false, keyboardType = "default", autoCapitalize = "sentences" }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; secureTextEntry?: boolean; keyboardType?: "default" | "url"; autoCapitalize?: "none" | "sentences" }) {
  return <View style={styles.field}><AppText style={premium.fieldLabel}>{label}</AppText><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={Colors.subtle} secureTextEntry={secureTextEntry} keyboardType={keyboardType} autoCapitalize={autoCapitalize} autoCorrect={false} accessibilityLabel={label} style={premium.input} /></View>;
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", gap: 3, padding: 4, borderRadius: 16, borderWidth: 1, borderColor: "rgba(190,222,255,0.10)", backgroundColor: "rgba(13,20,34,0.72)" },
  segmentButton: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 12 },
  segmentSelected: { backgroundColor: "#F4F8FF" },
  segmentFocused: { borderWidth: 2, borderColor: Colors.blueBright, transform: [{ scale: 1.03 }] },
  segmentText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.muted },
  segmentTextSelected: { color: Colors.background },
  form: { gap: 14, padding: 14 },
  field: { gap: 7 },
  tip: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, backgroundColor: "rgba(245,184,64,0.08)" },
  tipText: { flex: 1, fontSize: 12, lineHeight: 18, color: Colors.muted },
  security: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
});
