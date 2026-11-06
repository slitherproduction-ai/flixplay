import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo, useEffect, useState, type Ref } from "react";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
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
  compact?: boolean;
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
const TvClock = memo(function TvClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(timer);
  }, []);
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const date = `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
  return (
    <View style={styles.clock} accessibilityLabel={`${time}, ${date}`}>
      <AppText style={styles.clockTime}>{time}</AppText>
      <AppText style={styles.clockDate}>{date}</AppText>
    </View>
  );
});

function openPortal() {
  void Linking.openURL(`${PORTAL_ORIGIN}/adicionar-lista/`).catch((error) => logTechnicalError("Login/openPortal", error));
}

export function ActivationChooser({
  layout,
  identity,
  status,
  savedListsCount,
  loading,
  error,
  compact = false,
  savedListsRef,
  onServerCode,
  onXtreamHost,
  onSavedLists,
}: Props) {
  const tv = layout === "tv";
  const preferSaved = tv && savedListsCount > 0;
  const savedLabel = savedListsCount > 0 ? `Listas salvas (${savedListsCount})` : "Listas salvas";
  const linked = status?.state === "linked";

  const steps = tv
    ? [`Acesse ${PORTAL_HOST} ou aponte a câmera para o QR code`, "Informe o MAC e a chave deste aparelho", "A lista aparece sozinha em Listas salvas"]
    : ["Toque em Abrir o Portal", "Informe o MAC e a chave deste aparelho", "A lista aparece sozinha em Listas salvas"];

  return (
    <View style={[styles.root, tv ? styles.rootTv : styles.rootPhone, compact && styles.rootTvCompact]}>
      <View style={styles.topRow}>
        <Image
          source={LOGO}
          contentFit="contain"
          contentPosition="left"
          accessibilityLabel="ELVANOQ Play — Sua mídia. Sua experiência."
          style={tv ? (compact ? styles.logoTvCompact : styles.logoTv) : styles.logoPhone}
        />
        {tv ? <TvClock /> : null}
      </View>

      <View style={[styles.body, tv && styles.bodyTv]}>
        <View style={[styles.mainColumn, tv && styles.mainColumnTv]}>
          <View style={styles.heading}>
            <AppText style={[styles.eyebrow, tv && styles.eyebrowTv]}>ACESSO SEGURO</AppText>
            <AppText style={[styles.headline, tv && styles.headlineTv, compact && styles.headlineTvCompact]}>{tv ? "Ative sua TV" : "Ative este aparelho"}</AppText>
            <AppText style={[styles.description, tv && styles.descriptionTv]}>Vincule este aparelho ao Portal ELVANOQ Play em três passos.</AppText>
          </View>

          <View style={[styles.steps, tv && styles.stepsTv]}>
            {steps.map((text, index) => (
              <View key={text} style={styles.step}>
                <View style={[styles.stepNumber, tv && styles.stepNumberTv]}><AppText style={[styles.stepNumberText, tv && styles.stepNumberTextTv]}>{index + 1}</AppText></View>
                <AppText style={[styles.stepText, tv && styles.stepTextTv]}>{text}</AppText>
              </View>
            ))}
          </View>

          <View style={styles.codeBlock}>
            <AppText style={[styles.codeCaption, tv && styles.codeCaptionTv]}>MAC E CHAVE DESTE APARELHO</AppText>
            <View style={[styles.codeCard, tv && styles.codeCardTv, compact && styles.codeCardTvCompact]}>
              <View style={styles.codeItem}>
                <AppText style={[styles.codeLabel, tv && styles.codeLabelTv]}>MAC</AppText>
                <AppText selectable numberOfLines={1} adjustsFontSizeToFit style={[styles.codeValue, tv && styles.codeValueTv]}>{identity?.macAddress ?? "—"}</AppText>
              </View>
              <View style={[styles.codeDivider, tv && styles.codeDividerTv]} />
              <View style={[styles.codeItem, styles.codeItemKey]}>
                <AppText style={[styles.codeLabel, tv && styles.codeLabelTv]}>CHAVE</AppText>
                <AppText selectable numberOfLines={1} style={[styles.codeValue, tv && styles.codeValueTv]}>{identity?.deviceKey ?? "—"}</AppText>
              </View>
            </View>
          </View>

          <View style={styles.actions}>
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
              style={({ pressed }) => [tv ? [styles.primary, styles.primaryTv] : styles.secondary, pressed && styles.pressed]}
            >
              <Ionicons name="key-outline" size={tv ? 22 : 18} color={tv ? Colors.background : Colors.text} />
              <AppText style={tv ? [styles.primaryText, styles.primaryTextTv] : styles.secondaryText}>Entrar com código do servidor</AppText>
            </TVFocusable>
            <View style={styles.shortcuts}>
              <TVFocusable accessibilityRole="button" accessibilityLabel="Xtream por Host" onPress={onXtreamHost} focusStyle={styles.shortcutFocused} style={({ pressed }) => [styles.shortcut, tv && styles.shortcutTv, pressed && styles.pressed]}>
                <Ionicons name="server-outline" size={tv ? 19 : 15} color={Colors.blueBright} />
                <AppText numberOfLines={1} style={[styles.shortcutText, tv && styles.shortcutTextTv]}>Xtream por Host</AppText>
              </TVFocusable>
              <TVFocusable ref={savedListsRef} accessibilityRole="button" accessibilityLabel="Ver listas salvas" hasTVPreferredFocus={preferSaved} disabled={loading} onPress={onSavedLists} focusStyle={styles.shortcutFocused} style={({ pressed }) => [styles.shortcut, tv && styles.shortcutTv, pressed && styles.pressed]}>
                <Ionicons name="list-outline" size={tv ? 19 : 15} color={Colors.blueBright} />
                <AppText numberOfLines={1} style={[styles.shortcutText, tv && styles.shortcutTextTv]}>{savedLabel}</AppText>
              </TVFocusable>
            </View>
          </View>

          {loading ? (
            <View style={styles.feedback} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={Colors.blueBright} />
              <AppText style={[styles.feedbackText, tv && styles.feedbackTextTv]}>Conectando à lista salva…</AppText>
            </View>
          ) : null}
          {error ? (
            <View style={styles.errorBox} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={17} color="#FF8B91" />
              <AppText selectable style={[styles.errorText, tv && styles.errorTextTv]}>{error}</AppText>
            </View>
          ) : null}
        </View>

        {tv ? (
          <View style={styles.qrColumn}>
            <View style={[styles.qrCard, compact && styles.qrCardCompact]}>
              <Image source={PORTAL_QR} contentFit="contain" accessibilityLabel={`QR code para ${PORTAL_HOST}`} style={styles.qrImage} />
            </View>
            <AppText style={styles.qrCaption}>Aponte a câmera do celular</AppText>
            <AppText style={styles.qrHost}>{PORTAL_HOST}</AppText>
          </View>
        ) : null}
      </View>

      <View style={[styles.footer, tv && styles.footerTv]}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, !linked && status?.state === "pending" && styles.statusDotWarn]} />
          <AppText style={[styles.statusText, tv && styles.statusTextTv]}>{statusLabel(status)}</AppText>
        </View>
        <AppText style={[styles.version, tv && styles.versionTv]}>ELVANOQ · Versão {APP_INFO.version} · Build {APP_INFO.build}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 18 },
  rootPhone: { gap: 18 },
  rootTv: { gap: 26, width: "100%", maxWidth: 1240 },
  rootTvCompact: { gap: 16 },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  logoTv: { width: 300, height: 73 },
  logoTvCompact: { width: 250, height: 61 },
  logoPhone: { width: 190, height: 46 },
  clock: { alignItems: "flex-end" },
  clockTime: { fontFamily: "Inter_600SemiBold", fontSize: 30, lineHeight: 36, color: "#F4F8FF" },
  clockDate: { fontSize: 15, lineHeight: 21, color: "#8894A8" },

  body: { gap: 18 },
  bodyTv: { flexDirection: "row", alignItems: "flex-end", gap: 44 },
  mainColumn: { gap: 18 },
  mainColumnTv: { flex: 1, maxWidth: 620, gap: 20 },
  heading: { gap: 8 },
  eyebrow: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.8, color: Colors.blueBright },
  eyebrowTv: { fontSize: 13, letterSpacing: 2.2 },
  headline: { fontFamily: "Inter_700Bold", fontSize: 32, lineHeight: 38, letterSpacing: -0.8, color: "#F4F8FF" },
  headlineTv: { fontSize: 46, lineHeight: 54, letterSpacing: -1.2 },
  headlineTvCompact: { fontSize: 38, lineHeight: 44 },
  description: { fontSize: 14, lineHeight: 20, color: "#B8C4D6" },
  descriptionTv: { fontSize: 18, lineHeight: 25 },

  steps: { gap: 10 },
  stepsTv: { gap: 12 },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepNumber: { width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#147DFF" },
  stepNumberTv: { width: 30, height: 30, borderRadius: 15 },
  stepNumberText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#FFFFFF" },
  stepNumberTextTv: { fontSize: 15 },
  stepText: { flex: 1, fontSize: 14, lineHeight: 19, color: "#E4EAF4" },
  stepTextTv: { fontSize: 17, lineHeight: 23 },

  codeBlock: { gap: 8 },
  codeCaption: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.6, color: "#8E9AAE" },
  codeCaptionTv: { fontSize: 13, letterSpacing: 1.8 },
  codeCard: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWidth: 2, borderColor: Colors.blueBright, backgroundColor: "#0D1422" },
  codeCardTv: { minHeight: 86, paddingHorizontal: 24, borderRadius: 18, borderWidth: 3 },
  codeCardTvCompact: { minHeight: 72 },
  codeItem: { flex: 1, gap: 2 },
  codeItemKey: { flex: 0, minWidth: 96 },
  codeLabel: { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.2, color: "#8E9AAE" },
  codeLabelTv: { fontSize: 12 },
  codeValue: { fontFamily: "Inter_700Bold", fontSize: 18, letterSpacing: 1.2, color: "#FFFFFF" },
  codeValueTv: { fontSize: 28, letterSpacing: 2 },
  codeDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", marginHorizontal: 14, backgroundColor: "rgba(190,222,255,0.24)" },
  codeDividerTv: { width: 1, marginHorizontal: 22 },

  actions: { gap: 10 },
  primary: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18, borderRadius: 14, backgroundColor: "#F4F8FF" },
  primaryTv: { minHeight: 62, gap: 12, borderRadius: 16, borderWidth: 3, borderColor: "transparent" },
  primaryTvFocused: { borderColor: Colors.blueBright, transform: [{ scale: 1.03 }] },
  primaryText: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.background },
  primaryTextTv: { fontSize: 19 },
  secondary: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, borderColor: "rgba(244,248,255,0.24)", backgroundColor: "rgba(17,27,45,0.86)" },
  secondaryText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  shortcuts: { flexDirection: "row", gap: 8 },
  shortcut: { flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: "rgba(190,222,255,0.16)", backgroundColor: "rgba(13,20,34,0.72)" },
  shortcutTv: { minHeight: 54, gap: 10, borderRadius: 14, borderWidth: 2 },
  shortcutFocused: { borderColor: Colors.blueBright, backgroundColor: "rgba(255,255,255,0.14)", transform: [{ scale: 1.04 }] },
  shortcutText: { flexShrink: 1, fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#D6DEEB" },
  shortcutTextTv: { fontSize: 16, color: "#F4F8FF" },

  feedback: { flexDirection: "row", alignItems: "center", gap: 8 },
  feedbackText: { fontSize: 13, color: Colors.muted },
  feedbackTextTv: { fontSize: 15 },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, backgroundColor: "rgba(229,9,20,0.14)" },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, color: "#FF8B91" },
  errorTextTv: { fontSize: 15, lineHeight: 21 },

  qrColumn: { alignItems: "center", gap: 10, paddingBottom: 4 },
  qrCard: { width: 196, height: 196, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#FFFFFF" },
  qrCardCompact: { width: 164, height: 164 },
  qrImage: { width: "88%", height: "88%" },
  qrCaption: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#B8C4D6" },
  qrHost: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.blueBright },

  footer: { gap: 6, marginTop: 2 },
  footerTv: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.blueBright },
  statusDotWarn: { backgroundColor: "#F5B840" },
  statusText: { fontSize: 12, color: "#B8C4D6" },
  statusTextTv: { fontSize: 15 },
  version: { fontSize: 11, color: "#8E9AAE" },
  versionTv: { fontSize: 13 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
