import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo, useEffect, useMemo, useState, type Ref } from "react";
import { ActivityIndicator, Linking, StyleSheet, View, useWindowDimensions, type TextStyle } from "react-native";
import { TVFocusable, type TVFocusableHandle } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { APP_INFO } from "@/constants/app";
import { PORTAL_ORIGIN } from "@/constants/portal";
import { Colors } from "@/constants/theme";
import type { DeviceIdentity } from "@/services/device/deviceIdentity";
import type { PortalDeviceStatus } from "@/services/device/portalDeviceStatus";
import { logTechnicalError } from "@/services/security/sanitize";

/**
 * Tela inicial do login no padrão da ativação do Roku e da LG: título
 * "Ative sua TV", três passos, MAC e chave deste aparelho em destaque, QR do
 * Portal (só na TV/tablet deitado), "Entrar com código do servidor" como ação
 * principal e os demais acessos como atalhos. Os formulários continuam no
 * cartão do login.
 */

const LOGO = require("@/assets/images/brand/ELVANOQ_play_logo_tagline.png");
const PORTAL_QR = require("@/assets/images/brand/ELVANOQ_portal_qr.png");
const PORTAL_HOST = PORTAL_ORIGIN.replace(/^https?:\/\//, "");
const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type Props = {
  layout: "tv" | "phone";
  identity: DeviceIdentity | null;
  status: PortalDeviceStatus | null;
  savedListsCount: number;
  loading: boolean;
  error: string | null;
  savedListsRef?: Ref<TVFocusableHandle>;
  onServerCode: () => void;
  onXtreamHost: () => void;
  onSavedLists: () => void;
};

function statusLabel(status: PortalDeviceStatus | null): string {
  switch (status?.state) {
    case "linked": return "Aparelho vinculado ao Portal";
    case "inactive": return "Aparelho vinculado · licença inativa";
    case "migration-pending": return "Vínculo em análise no Portal";
    case "pending": return "Aguardando cadastro no Portal";
    case "unavailable": return "Portal indisponível no momento · tente mais tarde";
    default: return "Preparando este aparelho…";
  }
}

/** Relógio do Roku/LG: "10:42" e "Sexta, 6 nov". Atualiza a cada 20 s. */
const TvClock = memo(function TvClock({ timeStyle, dateStyle }: { timeStyle: TextStyle; dateStyle: TextStyle }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(timer);
  }, []);
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const date = `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
  return (
    <View style={styles.clock} accessibilityLabel={`${time}, ${date}`}>
      <AppText style={timeStyle}>{time}</AppText>
      <AppText style={dateStyle}>{date}</AppText>
    </View>
  );
});

function openPortal() {
  void Linking.openURL(`${PORTAL_ORIGIN}/adicionar-lista/`).catch((error) => logTechnicalError("Login/openPortal", error));
}

/**
 * Medidas da TV pensadas para a tela lógica de uma TV Android (960×540 dp em
 * 720p e 1080p) e escaladas pelo tamanho real da janela, para caber inteira
 * sem rolagem em qualquer TV e crescer em painéis maiores.
 */
function tvScale(width: number, height: number): number {
  const scale = Math.min(width / 960, height / 540);
  return Math.max(0.82, Math.min(1.8, scale));
}

function makeTvStyles(u: number) {
  const n = (value: number) => Math.round(value * u);
  return StyleSheet.create({
    root: { width: "100%", gap: n(12) },
    logo: { width: n(170), height: n(41) },
    clockTime: { fontFamily: "Inter_600SemiBold", fontSize: n(20), lineHeight: n(24), color: "#F4F8FF" },
    clockDate: { fontSize: n(11), lineHeight: n(15), color: "#8894A8" },
    body: { flexDirection: "row", alignItems: "flex-end", gap: n(32) },
    mainColumn: { flex: 1, maxWidth: n(480), gap: n(10) },
    heading: { gap: n(4) },
    eyebrow: { fontFamily: "Inter_700Bold", fontSize: n(10), letterSpacing: 1.8, color: Colors.blueBright },
    headline: { fontFamily: "Inter_700Bold", fontSize: n(28), lineHeight: n(33), letterSpacing: -0.8, color: "#F4F8FF" },
    description: { fontSize: n(13), lineHeight: n(18), color: "#B8C4D6" },
    steps: { gap: n(6) },
    step: { flexDirection: "row", alignItems: "center", gap: n(10) },
    stepNumber: { width: n(22), height: n(22), alignItems: "center", justifyContent: "center", borderRadius: n(11), backgroundColor: "#147DFF" },
    stepNumberText: { fontFamily: "Inter_700Bold", fontSize: n(11), color: "#FFFFFF" },
    stepText: { flex: 1, fontSize: n(13), lineHeight: n(17), color: "#E4EAF4" },
    codeBlock: { gap: n(5) },
    codeCaption: { fontFamily: "Inter_700Bold", fontSize: n(10), letterSpacing: 1.6, color: "#8E9AAE" },
    codeCard: { minHeight: n(54), flexDirection: "row", alignItems: "center", paddingHorizontal: n(16), paddingVertical: n(7), borderRadius: n(14), borderWidth: 2, borderColor: Colors.blueBright, backgroundColor: "#0D1422" },
    codeLabel: { fontFamily: "Inter_700Bold", fontSize: n(9), letterSpacing: 1.2, color: "#8E9AAE" },
    codeValue: { fontFamily: "Inter_700Bold", fontSize: n(18), letterSpacing: 1.4, color: "#FFFFFF" },
    codeDivider: { width: 1, alignSelf: "stretch", marginHorizontal: n(16), backgroundColor: "rgba(190,222,255,0.24)" },
    keyItem: { minWidth: n(80) },
    actions: { gap: n(8) },
    primary: { minHeight: n(44), flexDirection: "row", alignItems: "center", justifyContent: "center", gap: n(9), paddingHorizontal: n(16), borderRadius: n(12), borderWidth: 2, borderColor: "transparent", backgroundColor: "#F4F8FF" },
    primaryText: { fontFamily: "Inter_700Bold", fontSize: n(14), color: Colors.background },
    shortcut: { flex: 1, minHeight: n(38), flexDirection: "row", alignItems: "center", justifyContent: "center", gap: n(7), paddingHorizontal: n(10), borderRadius: n(11), borderWidth: 2, borderColor: "rgba(190,222,255,0.16)", backgroundColor: "rgba(13,20,34,0.72)" },
    shortcutText: { flexShrink: 1, fontFamily: "Inter_600SemiBold", fontSize: n(12), color: "#F4F8FF" },
    feedbackText: { fontSize: n(12), color: Colors.muted },
    errorText: { flex: 1, fontSize: n(12), lineHeight: n(16), color: "#FF8B91" },
    qrColumn: { alignItems: "center", gap: n(6), paddingBottom: n(2) },
    qrCard: { width: n(128), height: n(128), alignItems: "center", justifyContent: "center", borderRadius: n(12), backgroundColor: "#FFFFFF" },
    qrCaption: { fontFamily: "Inter_600SemiBold", fontSize: n(11), color: "#B8C4D6" },
    qrHost: { fontFamily: "Inter_700Bold", fontSize: n(13), color: Colors.blueBright },
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    statusText: { fontSize: n(11), color: "#B8C4D6" },
    version: { fontSize: n(10), color: "#8E9AAE" },
    icon: { width: n(17) },
    shortcutIcon: { width: n(15) },
  });
}

export function ActivationChooser({
  layout,
  identity,
  status,
  savedListsCount,
  loading,
  error,
  savedListsRef,
  onServerCode,
  onXtreamHost,
  onSavedLists,
}: Props) {
  const tv = layout === "tv";
  const { width, height } = useWindowDimensions();
  const u = tv ? tvScale(width, height) : 1;
  const t = useMemo(() => makeTvStyles(u), [u]);
  const preferSaved = tv && savedListsCount > 0;
  const savedLabel = savedListsCount > 0 ? `Listas salvas (${savedListsCount})` : "Listas salvas";
  const linked = status?.state === "linked";
  const iconSize = Math.round(17 * u);
  const shortcutIconSize = Math.round(15 * u);

  const steps = tv
    ? [`Acesse ${PORTAL_HOST} ou aponte a câmera para o QR code`, "Informe o MAC e a chave deste aparelho", "A lista aparece sozinha em Listas salvas"]
    : ["Toque em Abrir o Portal", "Informe o MAC e a chave deste aparelho", "A lista aparece sozinha em Listas salvas"];

  return (
    <View style={tv ? t.root : styles.root}>
      <View style={styles.topRow}>
        <Image
          source={LOGO}
          contentFit="contain"
          contentPosition="left"
          accessibilityLabel="ELVANOQ Play — Sua mídia. Sua experiência."
          style={tv ? t.logo : styles.logoPhone}
        />
        {tv ? <TvClock timeStyle={t.clockTime} dateStyle={t.clockDate} /> : null}
      </View>

      <View style={tv ? t.body : styles.body}>
        <View style={tv ? t.mainColumn : styles.mainColumn}>
          <View style={tv ? t.heading : styles.heading}>
            <AppText style={tv ? t.eyebrow : styles.eyebrow}>ACESSO SEGURO</AppText>
            <AppText style={tv ? t.headline : styles.headline}>{tv ? "Ative sua TV" : "Ative este aparelho"}</AppText>
            <AppText style={tv ? t.description : styles.description}>Vincule este aparelho ao Portal ELVANOQ Play em três passos.</AppText>
          </View>

          <View style={tv ? t.steps : styles.steps}>
            {steps.map((text, index) => (
              <View key={text} style={tv ? t.step : styles.step}>
                <View style={tv ? t.stepNumber : styles.stepNumber}><AppText style={tv ? t.stepNumberText : styles.stepNumberText}>{index + 1}</AppText></View>
                <AppText style={tv ? t.stepText : styles.stepText}>{text}</AppText>
              </View>
            ))}
          </View>

          <View style={tv ? t.codeBlock : styles.codeBlock}>
            <AppText style={tv ? t.codeCaption : styles.codeCaption}>MAC E CHAVE DESTE APARELHO</AppText>
            <View style={tv ? t.codeCard : styles.codeCard}>
              <View style={styles.codeItem}>
                <AppText style={tv ? t.codeLabel : styles.codeLabel}>MAC</AppText>
                <AppText selectable numberOfLines={1} adjustsFontSizeToFit style={tv ? t.codeValue : styles.codeValue}>{identity?.macAddress ?? "—"}</AppText>
              </View>
              <View style={tv ? t.codeDivider : styles.codeDivider} />
              <View style={[styles.codeItem, styles.codeItemKey, tv && t.keyItem]}>
                <AppText style={tv ? t.codeLabel : styles.codeLabel}>CHAVE</AppText>
                <AppText selectable numberOfLines={1} style={tv ? t.codeValue : styles.codeValue}>{identity?.deviceKey ?? "—"}</AppText>
              </View>
            </View>
          </View>

          <View style={tv ? t.actions : styles.actions}>
            {!tv ? (
              <TVFocusable accessibilityRole="link" accessibilityLabel="Abrir o Portal ELVANOQ Play" onPress={openPortal} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
                <AppText style={styles.primaryText}>Abrir o Portal</AppText>
                <Ionicons name="open-outline" size={17} color={Colors.background} />
              </TVFocusable>
            ) : null}
            <TVFocusable
              accessibilityRole="button"
              accessibilityLabel="Entrar com código do servidor"
              hasTVPreferredFocus={tv && !preferSaved}
              onPress={onServerCode}
              focusStyle={styles.primaryTvFocused}
              style={({ pressed }) => [tv ? t.primary : styles.secondary, pressed && styles.pressed]}
            >
              <Ionicons name="key-outline" size={tv ? iconSize : 18} color={tv ? Colors.background : Colors.text} />
              <AppText style={tv ? t.primaryText : styles.secondaryText}>Entrar com código do servidor</AppText>
            </TVFocusable>
            <View style={styles.shortcuts}>
              <TVFocusable accessibilityRole="button" accessibilityLabel="Xtream por Host" onPress={onXtreamHost} focusStyle={styles.shortcutFocused} style={({ pressed }) => [tv ? t.shortcut : styles.shortcut, pressed && styles.pressed]}>
                <Ionicons name="server-outline" size={tv ? shortcutIconSize : 15} color={Colors.blueBright} />
                <AppText numberOfLines={1} style={tv ? t.shortcutText : styles.shortcutText}>Xtream por Host</AppText>
              </TVFocusable>
              <TVFocusable ref={savedListsRef} accessibilityRole="button" accessibilityLabel="Ver listas salvas" hasTVPreferredFocus={preferSaved} disabled={loading} onPress={onSavedLists} focusStyle={styles.shortcutFocused} style={({ pressed }) => [tv ? t.shortcut : styles.shortcut, pressed && styles.pressed]}>
                <Ionicons name="list-outline" size={tv ? shortcutIconSize : 15} color={Colors.blueBright} />
                <AppText numberOfLines={1} style={tv ? t.shortcutText : styles.shortcutText}>{savedLabel}</AppText>
              </TVFocusable>
            </View>
          </View>

          {loading ? (
            <View style={styles.feedback} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={Colors.blueBright} />
              <AppText style={tv ? t.feedbackText : styles.feedbackText}>Conectando à lista salva…</AppText>
            </View>
          ) : null}
          {error ? (
            <View style={styles.errorBox} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={tv ? iconSize : 17} color="#FF8B91" />
              <AppText selectable style={tv ? t.errorText : styles.errorText}>{error}</AppText>
            </View>
          ) : null}
        </View>

        {tv ? (
          <View style={t.qrColumn}>
            <View style={t.qrCard}>
              <Image source={PORTAL_QR} contentFit="contain" accessibilityLabel={`QR code para ${PORTAL_HOST}`} style={styles.qrImage} />
            </View>
            <AppText style={t.qrCaption}>Aponte a câmera do celular</AppText>
            <AppText style={t.qrHost}>{PORTAL_HOST}</AppText>
          </View>
        ) : null}
      </View>

      <View style={tv ? t.footer : styles.footer}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, !linked && status?.state === "pending" && styles.statusDotWarn]} />
          <AppText style={tv ? t.statusText : styles.statusText}>{statusLabel(status)}</AppText>
        </View>
        <AppText style={tv ? t.version : styles.version}>ELVANOQ · Versão {APP_INFO.version} · Build {APP_INFO.build}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 18 },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  logoPhone: { width: 190, height: 46 },
  clock: { alignItems: "flex-end" },
  body: { gap: 18 },
  mainColumn: { gap: 18 },
  heading: { gap: 8 },
  eyebrow: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.8, color: Colors.blueBright },
  headline: { fontFamily: "Inter_700Bold", fontSize: 32, lineHeight: 38, letterSpacing: -0.8, color: "#F4F8FF" },
  description: { fontSize: 14, lineHeight: 20, color: "#B8C4D6" },
  steps: { gap: 10 },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepNumber: { width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#147DFF" },
  stepNumberText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#FFFFFF" },
  stepText: { flex: 1, fontSize: 14, lineHeight: 19, color: "#E4EAF4" },
  codeBlock: { gap: 8 },
  codeCaption: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.6, color: "#8E9AAE" },
  codeCard: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWidth: 2, borderColor: Colors.blueBright, backgroundColor: "#0D1422" },
  codeItem: { flex: 1, gap: 2 },
  codeItemKey: { flex: 0, minWidth: 96 },
  codeLabel: { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.2, color: "#8E9AAE" },
  codeValue: { fontFamily: "Inter_700Bold", fontSize: 18, letterSpacing: 1.2, color: "#FFFFFF" },
  codeDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", marginHorizontal: 14, backgroundColor: "rgba(190,222,255,0.24)" },
  actions: { gap: 10 },
  primary: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18, borderRadius: 14, backgroundColor: "#F4F8FF" },
  primaryTvFocused: { borderColor: Colors.blueBright, transform: [{ scale: 1.03 }] },
  primaryText: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.background },
  secondary: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, borderColor: "rgba(244,248,255,0.24)", backgroundColor: "rgba(17,27,45,0.86)" },
  secondaryText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  shortcuts: { flexDirection: "row", gap: 8 },
  shortcut: { flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: "rgba(190,222,255,0.16)", backgroundColor: "rgba(13,20,34,0.72)" },
  shortcutFocused: { borderColor: Colors.blueBright, backgroundColor: "rgba(255,255,255,0.14)", transform: [{ scale: 1.04 }] },
  shortcutText: { flexShrink: 1, fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#D6DEEB" },
  feedback: { flexDirection: "row", alignItems: "center", gap: 8 },
  feedbackText: { fontSize: 13, color: Colors.muted },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 12, backgroundColor: "rgba(229,9,20,0.14)" },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, color: "#FF8B91" },
  qrImage: { width: "88%", height: "88%" },
  footer: { gap: 6, marginTop: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.blueBright },
  statusDotWarn: { backgroundColor: "#F5B840" },
  statusText: { fontSize: 12, color: "#B8C4D6" },
  version: { fontSize: 11, color: "#8E9AAE" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
