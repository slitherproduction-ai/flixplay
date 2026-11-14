import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText } from "@/components/ui";
import { TVFocusable } from "@/components/tv-focusable";
import { Group, GroupLabel, GroupRow, PremiumBackdrop, PremiumHeading, PremiumTopBar, premium, usePremiumContentStyle } from "@/components/premium-screen";
import { Colors } from "@/constants/theme";
import { TvSettingsShell, TvTone, tvFocus } from "@/components/tv-settings-shell";
import { readPlayerPreferences } from "@/features/player/playerConfig";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useAppStore } from "@/store/useAppStore";

export default function PlayerSettingsScreen() {
  const router = useRouter();
  const tvMode = useTVMode();
  const { isTablet } = useResponsiveLayout();
  const preferences = useAppStore((state) => state.preferences);
  const setPreference = useAppStore((state) => state.setPreference);
  const player = readPlayerPreferences(preferences);
  const [userAgent, setUserAgent] = useState(player.userAgent);
  const autoOpen = preferences.autoOpenLastChannel === true;

  useEffect(() => setUserAgent(player.userAgent), [player.userAgent]);
  const saveUserAgent = useCallback(() => setPreference("playerUserAgent", userAgent.trim()), [setPreference, userAgent]);

  const contentStyle = usePremiumContentStyle({ tvMode, wide: isTablet }, 820);
  return <TvSettingsShell current="player"><View style={premium.screen}>
    <PremiumBackdrop />
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={contentStyle}>
      <PremiumTopBar title="Player" onBack={() => router.back()} />
      <PremiumHeading icon="play-circle-outline" title={tvMode ? "Reprodução" : "Preferências do player"} subtitle={tvMode ? "Como o player se comporta em canais, filmes e séries." : "Controles, transmissão e retomada."} />

      <GroupLabel title="REPRODUÇÃO" />
      <Group>
        <GroupRow icon="hardware-chip-outline" title="Motor de reprodução" subtitle="Seleção automática com fallback entre HLS e TS" value="Expo Video" />
        <ChoiceRow divider title="Tempo dos controles" subtitle="Ocultar após inatividade" value={player.osdTimeoutMs} options={[{ label: "3s", value: 3000 }, { label: "5s", value: 5000 }, { label: "7s", value: 7000 }]} onChange={(value) => setPreference("osdTimeoutMs", value)} />
        <ChoiceRow divider title="Salto no vídeo" subtitle="Avançar e voltar pelas setas" value={player.seekStepSeconds} options={[{ label: "10s", value: 10 }, { label: "30s", value: 30 }, { label: "60s", value: 60 }]} onChange={(value) => setPreference("seekStepSeconds", value)} />
        <ChoiceRow divider title="Formato ao vivo" subtitle="Prioridade, mantendo o fallback" value={player.streamPreference} options={[{ label: "Auto", value: "auto" }, { label: "HLS", value: "hls" }, { label: "TS", value: "ts" }]} onChange={(value) => setPreference("streamPreference", value)} />
      </Group>

      <GroupLabel title="COMPORTAMENTO" />
      <Group>
        <ToggleRow icon="radio-outline" title="Abrir último canal" subtitle="Retomar ao abrir o aplicativo" value={autoOpen} onPress={() => setPreference("autoOpenLastChannel", !autoOpen)} />
        <ToggleRow divider icon="tv-outline" title="Modo Android TV" subtitle={Platform.isTV ? "Detectado automaticamente neste aparelho" : tvMode ? "Ativado manualmente" : "Navegação por controle remoto"} value={tvMode} disabled={Platform.isTV} onPress={() => { if (!Platform.isTV) setPreference("tvModeEnabled", !tvMode); }} />
      </Group>

      <GroupLabel title="AVANÇADO" />
      <Group>
        <View style={styles.agentRow}>
          <View style={premium.rowCopy}><AppText style={premium.rowTitle}>User-Agent</AppText><AppText style={premium.rowMeta}>Identificação enviada ao servidor pelo player</AppText></View>
          <TextInput value={userAgent} onChangeText={setUserAgent} onBlur={saveUserAgent} onSubmitEditing={saveUserAgent} maxLength={160} autoCapitalize="none" autoCorrect={false} selectTextOnFocus placeholder="ELVANOQ Android Media Player" placeholderTextColor={Colors.subtle} accessibilityLabel="User-Agent do player" style={[premium.input, styles.agentInput]} />
        </View>
      </Group>
    </ScrollView>
  </View></TvSettingsShell>;
}

function ToggleRow({ icon, title, subtitle, value, onPress, divider = false, disabled = false }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; value: boolean; onPress: () => void; divider?: boolean; disabled?: boolean }) {
  return <GroupRow icon={icon} title={title} subtitle={subtitle} divider={divider} disabled={disabled} accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={onPress} right={<Switch focusable={false} pointerEvents="none" value={value} trackColor={{ false: "#293246", true: Colors.blue }} thumbColor={Colors.white} />} />;
}

function ChoiceRow<T extends string | number>({ title, subtitle, value, options, onChange, divider = false }: { title: string; subtitle: string; value: T; options: { label: string; value: T }[]; onChange: (value: T) => void; divider?: boolean }) {
  const tvMode = useTVMode();
  if (tvMode) {
    // TV: o valor escolhido tem ✓ e texto azul; o foco é só o anel claro.
    // Antes o escolhido era um botão branco e o foco um contorno azul — não
    // dava para saber qual valia.
    return <View style={[styles.choiceRow, styles.tvChoiceRow, divider && styles.tvDivider]}>
      <View style={premium.rowCopy}><AppText style={[premium.rowTitle, premium.tvRowTitle]}>{title}</AppText><AppText style={[premium.rowMeta, premium.tvRowMeta]}>{subtitle}</AppText></View>
      <View style={styles.tvSegment}>{options.map((option) => {
        const selected = value === option.value;
        return <TVFocusable key={String(option.value)} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${title}: ${option.label}`} onPress={() => onChange(option.value)} focusStyle={tvFocus.ring} style={[styles.tvOption, selected && styles.tvOptionSelected]}>
          {selected ? <Ionicons name="checkmark" size={14} color={Colors.blueBright} /> : null}
          <AppText style={[styles.tvOptionText, selected && styles.tvOptionTextSelected]}>{option.label}</AppText>
        </TVFocusable>;
      })}</View>
    </View>;
  }
  return <View style={[styles.choiceRow, divider && premium.dividerTop]}>
    <View style={premium.rowCopy}><AppText style={premium.rowTitle}>{title}</AppText><AppText style={premium.rowMeta}>{subtitle}</AppText></View>
    <View style={styles.segment}>{options.map((option) => {
      const selected = value === option.value;
      return <TVFocusable key={String(option.value)} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${title}: ${option.label}`} onPress={() => onChange(option.value)} focusStyle={styles.optionFocused} style={[styles.option, selected && styles.optionSelected]}><AppText style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</AppText></TVFocusable>;
    })}</View>
  </View>;
}

const styles = StyleSheet.create({
  choiceRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  segment: { flexDirection: "row", gap: 2, padding: 3, borderRadius: 12, backgroundColor: "rgba(7,11,20,0.7)" },
  option: { minWidth: 46, minHeight: 34, alignItems: "center", justifyContent: "center", paddingHorizontal: 9, borderRadius: 9 },
  optionSelected: { backgroundColor: "#F4F8FF" },
  optionFocused: { borderWidth: 2, borderColor: Colors.blueBright, transform: [{ scale: 1.06 }] },
  optionText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.muted },
  optionTextSelected: { color: Colors.background },
  agentRow: { gap: 10, paddingHorizontal: 14, paddingVertical: 14 },
  agentInput: { fontSize: 13 },
  tvChoiceRow: { minHeight: 58, paddingHorizontal: 16, gap: 16 },
  tvDivider: { borderTopWidth: 2, borderTopColor: TvTone.divider },
  tvSegment: { flexDirection: "row", gap: 6 },
  tvOption: { minWidth: 56, height: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 12, borderRadius: 16, borderWidth: 2, borderColor: "transparent" },
  tvOptionSelected: { backgroundColor: "rgba(0,215,255,0.14)" },
  tvOptionText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.muted },
  tvOptionTextSelected: { fontFamily: "Inter_700Bold", color: Colors.blueBright },
});
