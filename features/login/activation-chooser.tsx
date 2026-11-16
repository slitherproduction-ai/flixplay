import { Ionicons } from "@expo/vector-icons";
import { appLanguage, useAppLanguage } from "@/core/i18n";
import { LanguageButton } from "@/components/language-selector";
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
const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
    case "pending": return "Aguardando vínculo no Portal · esta tela atualiza sozinha";
    case "unavailable": return "Portal indisponível no momento · tente mais tarde";
    default: return "Preparando este aparelho…";
  }
}

/** Relógio do Roku/LG: "10:42" e "Sexta, 6 nov". Atualiza a cada 20 s. */
const TvClock = memo(function TvClock({ timeStyle, dateStyle }: { timeStyle: TextStyle; dateStyle: TextStyle }) {
  useAppLanguage();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(timer);
  }, []);
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const date = appLanguage() === "en"
    ? `${DAYS_EN[now.getDay()]}, ${MONTHS_EN[now.getMonth()]} ${now.getDate()}`
    : `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
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
    // Medidas do canvas "Proposta visual Login e Ativação" (tela 3, 1920×1080)
    // na metade: coluna de 380 dp à esquerda e o QR num cartão à direita.
    root: { width: "100%", gap: n(14) },
    logo: { width: n(165), height: n(40) },
    clockTime: { fontFamily: "Inter_600SemiBold", fontSize: n(22), lineHeight: n(26), color: "#F4F8FF" },
    clockDate: { fontSize: n(10), lineHeight: n(14), color: "#9AA6BD" },
    body: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: n(32) },
    mainColumn: { flex: 1, maxWidth: n(380), gap: n(12) },
    heading: { gap: n(5) },
    eyebrow: { fontFamily: "Inter_700Bold", fontSize: n(9), letterSpacing: 1.8, color: Colors.blueBright },
    headline: { fontFamily: "Inter_700Bold", fontSize: n(36), lineHeight: n(40), letterSpacing: -0.8, color: "#F4F8FF" },
    description: { fontSize: n(12), lineHeight: n(17), color: "#C9D2E3" },
    steps: { gap: n(11) },
    step: { flexDirection: "row", alignItems: "center", gap: n(10) },
    stepNumber: { width: n(22), height: n(22), alignItems: "center", justifyContent: "center", borderRadius: n(11), backgroundColor: "#1A2438" },
    stepNumberText: { fontFamily: "Inter_700Bold", fontSize: n(10), color: Colors.blueBright },
    stepText: { flex: 1, fontSize: n(12), lineHeight: n(16), color: "#F4F8FF" },
    codeBlock: { gap: n(5), paddingHorizontal: n(15), paddingVertical: n(10), borderRadius: n(10), backgroundColor: "rgba(14,21,36,0.92)" },
    codeCaption: { fontFamily: "Inter_700Bold", fontSize: n(8), letterSpacing: 1.6, color: "#9AA6BD" },
    codeCard: { flexDirection: "row", alignItems: "flex-end" },
    codeLabel: { fontFamily: "Inter_700Bold", fontSize: n(7), letterSpacing: 1.2, color: "#7F8BA3" },
    codeValue: { fontFamily: "Inter_700Bold", fontSize: n(17), lineHeight: n(22), letterSpacing: 0.3, color: "#FFFFFF" },
    codeDivider: { width: 1, alignSelf: "stretch", marginHorizontal: n(14), backgroundColor: "rgba(190,222,255,0.16)" },
    keyItem: { minWidth: n(80) },
    actions: { gap: n(8) },
    primary: { minHeight: n(38), flexDirection: "row", alignItems: "center", justifyContent: "center", gap: n(8), paddingHorizontal: n(16), borderRadius: n(8), borderWidth: 2, borderColor: "transparent", backgroundColor: "#F4F8FF" },
    primaryText: { fontFamily: "Inter_700Bold", fontSize: n(12), color: Colors.background },
    shortcut: { flex: 1, minHeight: n(30), flexDirection: "row", alignItems: "center", justifyContent: "center", gap: n(6), paddingHorizontal: n(10), borderRadius: n(7), borderWidth: 2, borderColor: "transparent", backgroundColor: "rgba(14,21,36,0.92)" },
    shortcutText: { flexShrink: 1, fontFamily: "Inter_600SemiBold", fontSize: n(10), color: "#C9D2E3" },
    feedbackText: { fontSize: n(11), color: Colors.muted },
    errorText: { flex: 1, fontSize: n(11), lineHeight: n(15), color: "#FF8B91" },
    qrColumn: { width: n(230), alignItems: "center", gap: n(8), paddingTop: n(20), paddingBottom: n(18), paddingHorizontal: n(20), borderRadius: n(14), backgroundColor: "#0E1524" },
    qrCard: { width: n(150), height: n(150), alignItems: "center", justifyContent: "center", borderRadius: n(9), backgroundColor: "#FFFFFF", marginBottom: n(2) },
    qrCaption: { fontSize: n(10), color: "#C9D2E3" },
    qrHost: { fontFamily: "Inter_700Bold", fontSize: n(13), color: Colors.blueBright },
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    statusText: { fontSize: n(10), color: "#C9D2E3" },
    version: { fontSize: n(9), color: "#7F8BA3" },
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
    ? [`Aponte a câmera para o QR ou acesse ${PORTAL_HOST}`, "Informe o MAC e a chave deste aparelho", "A lista aparece sozinha em Listas salvas"]
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
        {tv ? (
          <View style={[styles.topRight, { gap: Math.round(18 * u) }]}>
            <LanguageButton tv scale={u} />
            <TvClock timeStyle={t.clockTime} dateStyle={t.clockDate} />
          </View>
        ) : (
          <LanguageButton tv={false} />
        )}
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

          {/* TV: legenda dentro do cartão (canvas); celular: legenda acima. */}
          <View style={tv ? t.codeBlock : styles.codeBlock}>
            <AppText style={tv ? t.codeCaption : styles.codeCaption}>MAC E CHAVE DESTE APARELHO</AppText>
            <View style={tv ? t.codeCard : styles.codeCard}>
              <View style={styles.codeItem}>
                <AppText style={tv ? t.codeLabel : styles.codeLabel}>MAC</AppText>
                <AppText selectable numberOfLines={1} style={tv ? t.codeValue : styles.codeValue}>{identity?.macAddress ?? "—"}</AppText>
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
          <View style={[styles.statusDot, !linked && status?.state !== "unavailable" && styles.statusDotWarn]} />
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
  // Idioma ao lado do relógio (TV), como no canvas "Idioma do aplicativo".
  topRight: { flexDirection: "row", alignItems: "center" },
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
  // Passos no padrão do redesign: número ciano sobre #1A2438.
  stepNumber: { width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#1A2438" },
  stepNumberText: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.blueBright },
  stepText: { flex: 1, fontSize: 14, lineHeight: 19, color: "#E4EAF4" },
  codeBlock: { gap: 8 },
  codeCaption: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.6, color: "#8E9AAE" },
  // Cartão do código sem borda ciano (borda clara é só foco); MAC e chave
  // cada um em uma linha, alinhados pelo topo.
  codeCard: { minHeight: 60, flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: "rgba(14,21,36,0.92)" },
  codeItem: { flex: 1, gap: 4 },
  codeItemKey: { flex: 0, minWidth: 84 },
  codeLabel: { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.2, color: "#8E9AAE" },
  codeValue: { fontFamily: "Inter_700Bold", fontSize: 15, lineHeight: 20, color: "#FFFFFF" },
  codeDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", marginHorizontal: 14, backgroundColor: "rgba(190,222,255,0.24)" },
  actions: { gap: 10 },
  primary: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18, borderRadius: 14, backgroundColor: "#F4F8FF" },
  // Foco da TV: anel branco, sem ampliar (mesma regra do menu e do player).
  primaryTvFocused: { borderColor: "#FFFFFF", transform: [] },
  primaryText: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.background },
  secondary: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18, borderRadius: 14, backgroundColor: "rgba(14,21,36,0.92)" },
  secondaryText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  shortcuts: { flexDirection: "row", gap: 8 },
  shortcut: { flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 10, borderRadius: 12, backgroundColor: "rgba(14,21,36,0.92)" },
  shortcutFocused: { borderColor: "#FFFFFF", backgroundColor: "rgba(255,255,255,0.12)", transform: [] },
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
