import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback, useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, GlassCard, SectionHeader } from "@/components/ui";
import { TVFocusable } from "@/components/tv-focusable";
import { Colors, Radii, Type } from "@/constants/theme";
import { readPlayerPreferences } from "@/features/player/playerConfig";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useAppStore } from "@/store/useAppStore";

export default function PlayerSettingsScreen() {
  const router = useRouter();
  const tvMode = useTVMode();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsiveLayout();
  const preferences = useAppStore((state) => state.preferences);
  const setPreference = useAppStore((state) => state.setPreference);
  const player = readPlayerPreferences(preferences);
  const [userAgent, setUserAgent] = useState(player.userAgent);
  const autoOpen = preferences.autoOpenLastChannel === true;

  useEffect(() => setUserAgent(player.userAgent), [player.userAgent]);
  const saveUserAgent = useCallback(() => setPreference("playerUserAgent", userAgent.trim()), [setPreference, userAgent]);

  return <View style={styles.screen}>
    <View style={styles.ambient} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, tvMode && styles.tvContent, isTablet && styles.tabletContent, { paddingTop: insets.top + (tvMode ? 32 : 20) }]}>
      <View style={styles.topbar}><TVFocusable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.backButton}><Ionicons name="chevron-back" size={22} color={Colors.text} /></TVFocusable><View style={styles.heading}><AppText style={styles.kicker}>REPRODUÇÃO</AppText><AppText style={Type.title}>Preferências do player</AppText><AppText style={styles.subtitle}>Ajuste controles, transmissão e retomada.</AppText></View></View>

      <GlassCard style={styles.card} intensity={16}>
        <SettingIntro icon="play-circle-outline" title="Motor de reprodução" description="Seleção automática com fallback entre HLS e TS" value="Expo Video" />
        <Divider />
        <ChoiceRow title="Tempo do OSD" subtitle="Ocultar controles após inatividade" value={player.osdTimeoutMs} options={[{ label: "3s", value: 3000 }, { label: "5s", value: 5000 }, { label: "7s", value: 7000 }]} onChange={(value) => setPreference("osdTimeoutMs", value)} />
        <Divider />
        <ChoiceRow title="Salto no vídeo" subtitle="Avanço e retrocesso pelas setas" value={player.seekStepSeconds} options={[{ label: "10s", value: 10 }, { label: "30s", value: 30 }, { label: "60s", value: 60 }]} onChange={(value) => setPreference("seekStepSeconds", value)} />
        <Divider />
        <ChoiceRow title="Formato ao vivo" subtitle="Prioridade de reprodução; mantém fallback automático" value={player.streamPreference} options={[{ label: "Auto", value: "auto" }, { label: "HLS", value: "hls" }, { label: "TS", value: "ts" }]} onChange={(value) => setPreference("streamPreference", value)} />
      </GlassCard>

      <View style={styles.section}><SectionHeader title="Comportamento" subtitle="Preferências de inicialização" />
        <GlassCard style={styles.card} intensity={16}>
          <ToggleRow icon="radio-outline" title="Abrir último canal" subtitle="Retomar automaticamente ao abrir o aplicativo" value={autoOpen} onPress={() => setPreference("autoOpenLastChannel", !autoOpen)} />
          <Divider />
          <ToggleRow icon="tv-outline" title="Modo Android TV" subtitle={Platform.isTV ? "Detectado automaticamente neste dispositivo" : tvMode ? "Modo TV ativado manualmente" : "Ative para navegação por controle remoto"} value={tvMode} onPress={() => { if (!Platform.isTV) setPreference("tvModeEnabled", !tvMode); }} />
        </GlassCard>
      </View>

      <View style={styles.section}><SectionHeader title="Avançado" subtitle="Identificação enviada ao servidor" />
        <GlassCard style={styles.card} intensity={16}><View style={styles.agentRow}><View style={styles.copy}><AppText style={styles.rowTitle}>User-Agent</AppText><AppText style={styles.rowMeta}>Utilizado nas requisições do player</AppText></View><TextInput value={userAgent} onChangeText={setUserAgent} onBlur={saveUserAgent} onSubmitEditing={saveUserAgent} maxLength={160} autoCapitalize="none" autoCorrect={false} selectTextOnFocus placeholder="ELVANOQ Android Media Player" placeholderTextColor={Colors.subtle} accessibilityLabel="User-Agent do player" style={styles.input} /></View></GlassCard>
      </View>
    </ScrollView>
  </View>;
}

function Divider() { return <View style={styles.divider} />; }
function SettingIntro({ icon, title, description, value }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; value: string }) { return <View style={styles.row}><View style={styles.icon}><Ionicons name={icon} size={20} color={Colors.blueBright} /></View><View style={styles.copy}><AppText style={styles.rowTitle}>{title}</AppText><AppText style={styles.rowMeta}>{description}</AppText></View><AppText style={styles.value}>{value}</AppText></View>; }
function ToggleRow({ icon, title, subtitle, value, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; value: boolean; onPress: () => void }) { return <TVFocusable accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={title} onPress={onPress} style={styles.row}><View style={styles.icon}><Ionicons name={icon} size={20} color={Colors.blueBright} /></View><View style={styles.copy}><AppText style={styles.rowTitle}>{title}</AppText><AppText style={styles.rowMeta}>{subtitle}</AppText></View><Switch focusable={false} pointerEvents="none" value={value} trackColor={{ false: "#293246", true: Colors.blue }} thumbColor={Colors.white} /></TVFocusable>; }
function ChoiceRow<T extends string | number>({ title, subtitle, value, options, onChange }: { title: string; subtitle: string; value: T; options: { label: string; value: T }[]; onChange: (value: T) => void }) { return <View style={styles.choiceRow}><View style={styles.copy}><AppText style={styles.rowTitle}>{title}</AppText><AppText style={styles.rowMeta}>{subtitle}</AppText></View><View style={styles.options}>{options.map((option) => <TVFocusable key={String(option.value)} accessibilityRole="button" accessibilityState={{ selected: value === option.value }} accessibilityLabel={`${title}: ${option.label}`} onPress={() => onChange(option.value)} style={[styles.option, value === option.value && styles.optionSelected]}><AppText style={[styles.optionText, value === option.value && styles.optionTextSelected]}>{option.label}</AppText></TVFocusable>)}</View></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background }, ambient: { position: "absolute", top: -130, right: -100, width: 290, height: 290, borderRadius: 145, backgroundColor: "rgba(59,130,246,0.07)" }, content: { gap: 20, padding: 20, paddingBottom: 42 }, tvContent: { maxWidth: 1100, width: "100%", alignSelf: "center", paddingHorizontal: 46, paddingTop: 32 }, tabletContent: { maxWidth: 860, width: "100%", alignSelf: "center", paddingHorizontal: 28 }, topbar: { flexDirection: "row", alignItems: "flex-start", gap: 12 }, backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: Colors.border }, heading: { flex: 1, gap: 4 }, kicker: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 1.2, color: Colors.blueBright }, subtitle: { fontSize: 12, color: Colors.muted }, section: { gap: 10 }, card: { paddingHorizontal: 14 }, row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11 }, icon: { width: 39, height: 39, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(59,130,246,0.12)" }, copy: { flex: 1, gap: 4 }, rowTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text }, rowMeta: { fontSize: 10, lineHeight: 15, color: Colors.subtle }, value: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.blueBright }, divider: { height: 1, backgroundColor: Colors.border }, choiceRow: { minHeight: 80, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }, options: { flexDirection: "row", gap: 6 }, option: { minWidth: 48, minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 9, borderRadius: 11, borderWidth: 1, borderColor: Colors.border, backgroundColor: "rgba(255,255,255,0.04)" }, optionSelected: { borderColor: Colors.blueBright, backgroundColor: "rgba(59,130,246,0.22)" }, optionText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.muted }, optionTextSelected: { color: Colors.white }, agentRow: { minHeight: 88, flexDirection: "row", alignItems: "center", gap: 12 }, input: { width: "48%", minHeight: 45, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: "rgba(7,9,14,0.72)", fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.text },
});
