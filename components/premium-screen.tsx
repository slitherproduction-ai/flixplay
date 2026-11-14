import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { Colors } from "@/constants/theme";
import { TvTone, tvFocus, useInTvSettingsShell } from "@/components/tv-settings-shell";
import { useTVMode } from "@/hooks/use-tv-mode";

/**
 * Linguagem visual premium compartilhada pelas telas secundárias (Sobre,
 * Ajustes, Controle parental, Player, Diagnóstico, Adicionar lista…):
 * brilho azul no topo, barra com Voltar circular e título centralizado,
 * rótulos de grupo discretos e linhas agrupadas em um único cartão.
 */

/** Brilho de marca no topo da tela. Fica atrás do conteúdo e não recebe toques. */
export function PremiumBackdrop({ height = 420 }: { height?: number }) {
  const insets = useSafeAreaInsets();
  // Na TV o fundo é liso: o brilho atrás de cartões transparentes deixava tudo turvo.
  const tvMode = useTVMode();
  if (tvMode) return null;
  return (
    <LinearGradient
      pointerEvents="none"
      colors={["rgba(20,125,255,0.22)", "rgba(0,215,255,0.06)", "rgba(7,11,20,0)"]}
      locations={[0, 0.4, 1]}
      style={[premium.glow, { height: height + insets.top }]}
    />
  );
}

/** Barra superior: Voltar circular, título centralizado e ação opcional à direita. */
export function PremiumTopBar({
  title,
  onBack,
  backIcon = "chevron-back",
  backLabel = "Voltar",
  right,
}: {
  title: string;
  onBack: () => void;
  backIcon?: keyof typeof Ionicons.glyphMap;
  backLabel?: string;
  right?: ReactNode;
}) {
  // Dentro do painel de Ajustes da TV o menu à esquerda já situa a tela e o
  // Voltar do controle funciona: a barra sairia só ocupando espaço.
  const inShell = useInTvSettingsShell();
  if (inShell) return right ? <View style={premium.tvTopRight}>{right}</View> : null;
  return (
    <View style={premium.topBar}>
      <TVFocusable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onBack}
        focusStyle={premium.backFocused}
        style={({ pressed }) => [premium.backButton, pressed && premium.pressed]}
      >
        <Ionicons name={backIcon} size={22} color={Colors.text} />
      </TVFocusable>
      <AppText numberOfLines={1} style={premium.topTitle}>{title}</AppText>
      {right ?? <View style={premium.topSpacer} />}
    </View>
  );
}

/** Cabeçalho grande da página, abaixo da barra (título + descrição curta). */
export function PremiumHeading({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const tvMode = useTVMode();
  if (tvMode) {
    // TV: título alinhado à esquerda, sem ícone grande nem texto centralizado.
    return (
      <View style={premium.tvHeading}>
        <AppText style={premium.tvHeadingTitle}>{title}</AppText>
        {subtitle ? <AppText style={premium.tvHeadingSubtitle}>{subtitle}</AppText> : null}
      </View>
    );
  }
  return (
    <View style={premium.heading}>
      {icon ? <View style={premium.headingIcon}><Ionicons name={icon} size={24} color={Colors.blueBright} /></View> : null}
      <AppText style={premium.headingTitle}>{title}</AppText>
      {subtitle ? <AppText style={premium.headingSubtitle}>{subtitle}</AppText> : null}
    </View>
  );
}

export function GroupLabel({ title, action }: { title: string; action?: ReactNode }) {
  const tvMode = useTVMode();
  return (
    <View style={[premium.groupLabelRow, tvMode && premium.tvGroupLabelRow]}>
      <AppText style={[premium.groupLabel, tvMode && premium.tvGroupLabel]}>{title}</AppText>
      {action}
    </View>
  );
}

export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const tvMode = useTVMode();
  return <View style={[premium.group, tvMode && premium.tvGroup, style]}>{children}</View>;
}

/** Linha de grupo. Com onPress vira um item focável (TV) com chevron ou elemento à direita. */
export function GroupRow({
  icon,
  iconColor = Colors.blueBright,
  title,
  subtitle,
  value,
  right,
  onPress,
  divider = false,
  destructive = false,
  disabled = false,
  chevron,
  accessibilityRole,
  accessibilityState,
  hasTVPreferredFocus,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  divider?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  chevron?: boolean;
  accessibilityRole?: "button" | "switch" | "link";
  accessibilityState?: { checked?: boolean; selected?: boolean; expanded?: boolean; disabled?: boolean };
  hasTVPreferredFocus?: boolean;
}) {
  const tvMode = useTVMode();
  const color = destructive ? "#FF8B91" : iconColor;
  const content = (
    <>
      {icon ? <View style={[premium.rowIcon, tvMode && premium.tvRowIcon, destructive && premium.rowIconDestructive]}><Ionicons name={icon} size={tvMode ? 17 : 18} color={color} /></View> : null}
      <View style={premium.rowCopy}>
        <AppText numberOfLines={1} style={[premium.rowTitle, tvMode && premium.tvRowTitle, destructive && { color }]}>{title}</AppText>
        {subtitle ? <AppText numberOfLines={2} style={[premium.rowMeta, tvMode && premium.tvRowMeta]}>{subtitle}</AppText> : null}
      </View>
      {value ? <AppText numberOfLines={1} style={[premium.rowValue, tvMode && premium.tvRowValue]}>{value}</AppText> : null}
      {right}
      {onPress && (chevron ?? !right) ? <Ionicons name="chevron-forward" size={tvMode ? 18 : 16} color={Colors.subtle} /> : null}
    </>
  );
  const rowStyle = [premium.row, tvMode && premium.tvRow, divider && (tvMode ? premium.tvDividerTop : premium.dividerTop)];
  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <TVFocusable
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityLabel={title}
      accessibilityState={{ disabled, ...accessibilityState }}
      disabled={disabled}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      focusStyle={tvMode ? tvFocus.ring : premium.rowFocused}
      style={({ pressed }) => [...rowStyle, pressed && premium.rowPressed, disabled && premium.disabled]}
    >
      {content}
    </TVFocusable>
  );
}

/** Botão principal (branco) ou secundário (vidro), no padrão da tela Sobre. */
export function PremiumButton({
  label,
  icon,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  hasTVPreferredFocus,
  style,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: "primary" | "secondary" | "destructive";
  disabled?: boolean;
  loading?: boolean;
  hasTVPreferredFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const tvMode = useTVMode();
  const primary = variant === "primary";
  const tint = primary ? Colors.background : variant === "destructive" ? "#FF8B91" : Colors.text;
  return (
    <TVFocusable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      focusStyle={tvMode ? (primary ? premium.tvPrimaryFocused : tvFocus.ring) : primary ? premium.primaryFocused : premium.secondaryFocused}
      style={({ pressed }) => [
        premium.button,
        tvMode && premium.tvButton,
        primary ? premium.primaryButton : variant === "destructive" ? (tvMode ? premium.tvDestructiveButton : premium.destructiveButton) : (tvMode ? premium.tvSecondaryButton : premium.secondaryButton),
        pressed && premium.pressed,
        (disabled || loading) && premium.disabled,
        style,
      ]}
    >
      {icon ? <Ionicons name={loading ? "hourglass-outline" : icon} size={17} color={tint} /> : null}
      <AppText style={[premium.buttonText, tvMode && premium.tvButtonText, { color: tint }]}>{label}</AppText>
    </TVFocusable>
  );
}

/** Contêiner do conteúdo rolável: margens, área segura e largura máxima em tablet/TV. */
export function usePremiumContentStyle({ tvMode, wide }: { tvMode: boolean; wide: boolean }, maxWidth = 820) {
  const insets = useSafeAreaInsets();
  const inShell = useInTvSettingsShell();
  // Dentro do painel de Ajustes da TV: margens do painel, largura toda dele.
  if (inShell) return [premium.content, premium.tvShellContent];
  return [
    premium.content,
    { paddingTop: insets.top + (tvMode ? 28 : 12), paddingBottom: insets.bottom + 40 },
    tvMode && premium.tvContent,
    (wide || tvMode) && { width: "100%" as const, maxWidth, alignSelf: "center" as const },
  ];
}

export const premium = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  glow: { position: "absolute", top: 0, right: 0, left: 0 },
  content: { gap: 18, paddingHorizontal: 20 },
  tvContent: { paddingHorizontal: 46 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, borderWidth: 1, borderColor: "rgba(244,248,255,0.16)", backgroundColor: "rgba(7,11,20,0.5)" },
  backFocused: { borderWidth: 2, borderColor: Colors.blueBright, backgroundColor: "rgba(255,255,255,0.16)", transform: [{ scale: 1.08 }] },
  topTitle: { flex: 1, textAlign: "center", fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  topSpacer: { width: 42 },

  heading: { alignItems: "center", gap: 6, paddingTop: 2, paddingBottom: 2 },
  headingIcon: { width: 56, height: 56, alignItems: "center", justifyContent: "center", marginBottom: 4, borderRadius: 18, borderWidth: 1, borderColor: "rgba(0,215,255,0.22)", backgroundColor: "rgba(20,125,255,0.14)" },
  headingTitle: { textAlign: "center", fontFamily: "Inter_700Bold", fontSize: 28, lineHeight: 34, letterSpacing: -0.8, color: Colors.text },
  headingSubtitle: { maxWidth: 460, textAlign: "center", fontSize: 13, lineHeight: 19, color: Colors.muted },

  card: { gap: 14, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: "rgba(0,215,255,0.18)", backgroundColor: "rgba(20,125,255,0.08)" },
  groupLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: -8, paddingHorizontal: 4 },
  groupLabel: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.1, color: Colors.muted },
  group: { overflow: "hidden", borderRadius: 16, borderWidth: 1, borderColor: "rgba(190,222,255,0.10)", backgroundColor: "rgba(13,20,34,0.72)" },
  dividerTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(190,222,255,0.14)" },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  rowFocused: { borderWidth: 2, borderColor: Colors.blueBright, backgroundColor: "rgba(0,215,255,0.08)", transform: [{ scale: 1 }] },
  rowPressed: { backgroundColor: "rgba(255,255,255,0.05)" },
  rowIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "rgba(0,215,255,0.10)" },
  rowIconDestructive: { backgroundColor: "rgba(229,9,20,0.12)" },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  rowMeta: { fontSize: 11, lineHeight: 15, color: Colors.muted },
  rowValue: { maxWidth: "50%", fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },

  button: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20, borderRadius: 14 },
  primaryButton: { backgroundColor: "#F4F8FF" },
  secondaryButton: { borderWidth: 1, borderColor: "rgba(244,248,255,0.22)", backgroundColor: "rgba(17,27,45,0.82)" },
  destructiveButton: { borderWidth: 1, borderColor: "rgba(229,9,20,0.32)", backgroundColor: "rgba(229,9,20,0.08)" },
  buttonText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  primaryFocused: { borderWidth: 2, borderColor: Colors.blueBright, transform: [{ scale: 1.04 }] },
  secondaryFocused: { borderWidth: 2, borderColor: Colors.blueBright, backgroundColor: "rgba(255,255,255,0.14)", transform: [{ scale: 1.04 }] },

  input: { minHeight: 50, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(190,222,255,0.16)", backgroundColor: "rgba(7,11,20,0.6)", fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.text },
  fieldLabel: { paddingHorizontal: 2, fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  error: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, backgroundColor: "rgba(229,9,20,0.12)" },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, color: "#FF8B91" },
  footnote: { alignSelf: "center", textAlign: "center", fontSize: 11, lineHeight: 16, color: Colors.subtle },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },

  // TV (2.17.58): superfícies sem borda, foco único (tvFocus) e textos para ler de longe.
  tvShellContent: { gap: 14, paddingHorizontal: 44, paddingTop: 34, paddingBottom: 40 },
  tvTopRight: { alignSelf: "flex-end" },
  tvHeading: { gap: 6, paddingBottom: 6 },
  tvHeadingTitle: { fontFamily: "Inter_700Bold", fontSize: 26, lineHeight: 31, letterSpacing: -0.6, color: Colors.text },
  tvHeadingSubtitle: { fontSize: 12, lineHeight: 17, color: Colors.muted },
  tvGroupLabelRow: { marginBottom: -6, marginTop: 6, paddingHorizontal: 2 },
  tvGroupLabel: { fontSize: 10, letterSpacing: 1.6 },
  tvGroup: { borderWidth: 0, borderRadius: 14, backgroundColor: TvTone.surface },
  tvRow: { minHeight: 54, gap: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 2, borderColor: "transparent" },
  tvDividerTop: { borderTopColor: TvTone.divider },
  tvRowIcon: { width: 32, height: 32, borderRadius: 16 },
  tvRowTitle: { fontSize: 13 },
  tvRowMeta: { fontSize: 10, lineHeight: 14 },
  tvRowValue: { fontSize: 12, color: Colors.muted },
  tvButton: { minHeight: 38, borderRadius: 19, paddingHorizontal: 18 },
  tvSecondaryButton: { borderWidth: 2, borderColor: "transparent", backgroundColor: TvTone.surfaceHigh },
  tvDestructiveButton: { borderWidth: 2, borderColor: "transparent", backgroundColor: "transparent" },
  tvButtonText: { fontSize: 12 },
  // Botão branco: o anel claro sumiria nele, então o foco é o contorno azul.
  tvPrimaryFocused: { borderWidth: 2, borderColor: Colors.blueBright, transform: [] },
});
