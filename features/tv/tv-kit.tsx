import { Image } from "expo-image";
import { memo, useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "@/components/ui";
import { appLanguage, tr, useAppLanguage } from "@/core/i18n";

/**
 * Peças das telas de TV do redesign "ELVANOQ Play TV" (canvas de 22/11/2026):
 * medidas do canvas 1920×1080 pela metade, na tela lógica de 960×540 dp que
 * toda TV passa a ter (TvDensity.kt).
 */
export const TV = {
  bg: "#070B14",
  surface: "#0E1524",
  surfaceHigh: "#1A2438",
  field: "rgba(17, 27, 45, 0.86)",
  card: "rgba(13, 20, 34, 0.92)",
  cardBorder: "rgba(136, 148, 168, 0.22)",
  divider: "rgba(136, 148, 168, 0.2)",
  text: "#F4F8FF",
  soft: "#C9D2E0",
  muted: "#A9B4C7",
  dim: "#8894A8",
  accent: "#00D7FF",
  primary: "#147DFF",
  success: "#16C784",
  warning: "#F5B83D",
  danger: "#FF8A8A",
  ring: "#F4F8FF",
  glow: "rgba(244, 248, 255, 0.08)",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semi: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  /** Margens da tela (96/72 px no canvas). */
  padX: 48,
  padTop: 36,
  padBottom: 28,
} as const;

const WORDMARK = require("@/assets/images/brand/ELVANOQ_wordmark_white_transparent.png");
export const TV_BACKDROP = require("@/assets/images/brand/ELVANOQ_login_tv_backdrop_v5.jpg");

const DAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Texto com {0}, {1}… preenchidos e traduzido pelo dicionário (o modelo é a chave). */
export function tf(template: string, ...args: Array<string | number>): string {
  return tr(template.replace(/\{(\d+)\}/g, (_, i: string) => String(args[Number(i)] ?? "")));
}

/** "19:42" e "domingo, 22 de novembro"; atualiza a cada 20 s. */
export const TvClock = memo(function TvClock() {
  useAppLanguage();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(timer);
  }, []);
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const date = appLanguage() === "en"
    ? `${DAYS_EN[now.getDay()]}, ${MONTHS_EN[now.getMonth()]} ${now.getDate()}`
    : `${DAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS[now.getMonth()]}`;
  return (
    <View style={kit.clock} accessibilityLabel={`${time}, ${date}`}>
      <AppText style={kit.clockTime}>{time}</AppText>
      <AppText style={kit.clockDate}>{date}</AppText>
    </View>
  );
});

/** Logo à esquerda e relógio à direita (topo de todas as telas). */
export function TvHeader() {
  return (
    <View style={kit.header}>
      <Image source={WORDMARK} contentFit="contain" contentPosition="left" accessibilityLabel="ELVANOQ Play" style={kit.logo} />
      <TvClock />
    </View>
  );
}

export function TvEyebrow({ children, color = TV.accent, style }: { children: ReactNode; color?: string; style?: StyleProp<ViewStyle> }) {
  return <View style={style}><AppText style={[kit.eyebrow, { color }]}>{children}</AppText></View>;
}

/** Tecla do controle e o que ela faz ("OK  Editar campo"). */
export function TvKeyHint({ keyLabel, label }: { keyLabel: string; label: string }) {
  return (
    <View style={kit.hint}>
      <View style={kit.key}><AppText style={kit.keyText}>{keyLabel}</AppText></View>
      <AppText style={kit.hintText}>{label}</AppText>
    </View>
  );
}

/** Anel de foco do redesign: borda branca e um halo claro de 4 dp por fora. */
export function FocusHalo({ radius }: { radius: number }) {
  return <View pointerEvents="none" style={[kit.halo, { borderRadius: radius + 5 }]} />;
}

export const kit = StyleSheet.create({
  header: { height: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { width: 66, height: 22 },
  clock: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  clockTime: { fontFamily: TV.semi, fontSize: 17, lineHeight: 21, letterSpacing: -0.25, color: TV.text },
  clockDate: { fontFamily: TV.regular, fontSize: 10, lineHeight: 14, color: TV.dim },
  eyebrow: { fontFamily: TV.semi, fontSize: 9, lineHeight: 12, letterSpacing: 1.2 },
  hint: { flexDirection: "row", alignItems: "center", gap: 6 },
  key: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, borderWidth: 0.75, borderColor: "rgba(244, 248, 255, 0.3)" },
  keyText: { fontFamily: TV.semi, fontSize: 9.5, lineHeight: 13, color: TV.text },
  hintText: { fontFamily: TV.regular, fontSize: 9.5, lineHeight: 13, color: TV.muted },
  halo: { position: "absolute", top: -5.5, left: -5.5, right: -5.5, bottom: -5.5, borderWidth: 4, borderColor: TV.glow },
  /** Foco dos botões do redesign: só a borda branca, sem aumento. */
  ringFocus: { borderWidth: 1.5, borderColor: TV.ring, transform: [] },
});
