import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Colors, Radii, Type } from "@/constants/theme";
import { AppText, IconButton } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";

export default function TraktScreen() {
  const router = useRouter();
  const trakt = useAppStore((state) => state.trakt);
  const setTrakt = useAppStore((state) => state.setTrakt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnection = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 450));
      setTrakt(trakt.isConnected ? { isConnected: false, username: "", accessToken: "" } : { isConnected: true, username: "marina.cinema", accessToken: "demo-token" });
    } catch (connectionError) {
      console.error("Falha na conexão com o Trakt.tv", connectionError);
      setError("Não foi possível concluir a conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [setTrakt, trakt.isConnected]);

  return (
    <View style={styles.screen}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.header}><IconButton icon="close" label="Fechar" onPress={() => router.back()} /><View style={styles.headerTitle}><AppText style={styles.kicker}>INTEGRAÇÃO</AppText><AppText style={styles.title}>Trakt.tv Sync</AppText></View><View style={styles.spacer} /></View>
        <View style={styles.hero}><View style={styles.heroIcon}><Ionicons name="sync" size={28} color={Colors.white} /></View><AppText style={styles.heroTitleLarge}>{trakt.isConnected ? "Tudo sincronizado" : "Leve seu histórico com você"}</AppText><AppText style={styles.heroBody}>{trakt.isConnected ? `Sua conta @${trakt.username} está conectada ao FlixPlay.` : "Conecte sua conta para sincronizar progresso, favoritos e watchlist em todos os dispositivos."}</AppText></View>
        <View style={styles.features}><Feature icon="time-outline" title="Progresso de reprodução" body="Retome filmes e episódios do ponto certo." /><Feature icon="heart-outline" title="Favoritos e watchlist" body="Mantenha sua curadoria sempre atualizada." /><Feature icon="radio-outline" title="Scrobble automático" body="Registre o que está assistindo em tempo real." /></View>
        {error ? <View style={styles.error}><Ionicons name="alert-circle-outline" size={18} color={Colors.red} /><AppText style={styles.errorText}>{error}</AppText></View> : null}
        <Pressable accessibilityRole="button" disabled={loading} onPress={handleConnection} style={({ pressed }) => [styles.connectButton, pressed && styles.pressed, loading && styles.disabled]}>{loading ? <ActivityIndicator color={Colors.white} /> : <><Ionicons name={trakt.isConnected ? "log-out-outline" : "link-outline"} size={17} color={Colors.white} /><AppText style={styles.connectText}>{trakt.isConnected ? "Desconectar conta" : "Conectar com Trakt.tv"}</AppText></>}</Pressable>
        {trakt.isConnected ? <View style={styles.autoRow}><View style={styles.autoCopy}><AppText style={styles.autoTitle}>Scrobble automático</AppText><AppText style={styles.autoBody}>Atualizar ao iniciar, pausar e concluir</AppText></View><Switch value={trakt.autoScrobble} onValueChange={(value) => setTrakt({ autoScrobble: value })} trackColor={{ false: "#293246", true: Colors.red }} thumbColor={Colors.white} /></View> : null}
      </ScrollView>
    </View>
  );
}

function Feature({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return <View style={styles.feature}><View style={styles.featureIcon}><Ionicons name={icon} size={18} color={Colors.red} /></View><View style={styles.featureCopy}><AppText style={styles.featureTitle}>{title}</AppText><AppText style={styles.featureBody}>{body}</AppText></View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { gap: 21, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  headerTitle: { flex: 1, alignItems: "center", gap: 3 },
  spacer: { width: 42 },
  kicker: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 1, color: Colors.red },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text },
  hero: { alignItems: "center", padding: 22, borderRadius: Radii.large, borderWidth: 1, borderColor: "rgba(229,9,20,0.24)", backgroundColor: "rgba(229,9,20,0.08)" },
  heroIcon: { width: 58, height: 58, alignItems: "center", justifyContent: "center", borderRadius: 29, backgroundColor: Colors.red },
  heroTitleLarge: { marginTop: 14, textAlign: "center", ...Type.title },
  heroBody: { maxWidth: 320, marginTop: 7, textAlign: "center", fontSize: 13, lineHeight: 19, color: Colors.muted },
  features: { gap: 2, padding: 8, borderRadius: Radii.medium, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  feature: { minHeight: 65, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 8 },
  featureIcon: { width: 35, height: 35, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "rgba(229,9,20,0.11)" },
  featureCopy: { flex: 1, gap: 3 },
  featureTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  featureBody: { fontSize: 11, color: Colors.muted },
  error: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, backgroundColor: "rgba(229,9,20,0.12)" },
  errorText: { flex: 1, fontSize: 12, color: "#FF8B91" },
  connectButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: Radii.pill, backgroundColor: Colors.red },
  connectText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.white },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.55 },
  autoRow: { minHeight: 65, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, borderRadius: Radii.medium, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  autoCopy: { flex: 1, gap: 3 },
  autoTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  autoBody: { fontSize: 11, color: Colors.muted },
});
