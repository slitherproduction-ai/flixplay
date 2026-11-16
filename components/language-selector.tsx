import { useState } from "react";
import { Modal, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "@/components/app-icon";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { useLanguageStore, type LanguagePreference } from "@/core/i18n";

/**
 * Troca de idioma (canvas "Idioma do aplicativo", telas 9 a 12): botão com
 * globo no topo do login — na TV "Português (Brasil)" ao lado do relógio, no
 * celular "PT" ao lado do logo — e a escolha entre Automático, Português e
 * English (janela no centro na TV, folha que sobe no celular). Muda só os
 * textos do app; áudio e legendas são os da lista.
 */
const OPTIONS: { value: LanguagePreference; label: string; tvSub: string; phoneSub: string }[] = [
  { value: "auto", label: "Automático", tvSub: "Igual ao idioma da TV", phoneSub: "Igual ao idioma do celular" },
  { value: "pt", label: "Português (Brasil)", tvSub: "Português", phoneSub: "Português" },
  { value: "en", label: "English", tvSub: "Inglês", phoneSub: "Inglês" },
];

function preferenceLabel(preference: LanguagePreference) {
  return OPTIONS.find((option) => option.value === preference)?.label ?? "Automático";
}

export function LanguageButton({ tv, scale = 1, style }: { tv: boolean; scale?: number; style?: StyleProp<ViewStyle> }) {
  const preference = useLanguageStore((state) => state.preference);
  const language = useLanguageStore((state) => state.language);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const n = (value: number) => Math.round(value * scale);
  const label = tv ? preferenceLabel(preference) : language.toUpperCase();
  const fg = tv && focused ? "#070B14" : "#F4F8FF";
  return (
    <>
      <TVFocusable
        accessibilityRole="button"
        accessibilityLabel={`Idioma: ${preferenceLabel(preference)}. Trocar idioma`}
        onPress={() => setOpen(true)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        focusStyle={styles.noRing}
        style={({ pressed }) => [
          tv
            ? { height: n(28), paddingLeft: n(9), paddingRight: n(11), gap: n(6), borderRadius: n(14) }
            : styles.phonePill,
          styles.pill,
          tv && focused && styles.pillFocused,
          pressed && styles.pressed,
          style,
        ]}
      >
        <AppIcon name="globe" size={tv ? n(13) : 18} color={tv && focused ? "#070B14" : "#00D7FF"} />
        <AppText numberOfLines={1} style={[tv ? { fontSize: n(10), lineHeight: n(13) } : styles.phoneLabel, styles.pillLabel, { color: fg }]}>{label}</AppText>
        <AppIcon name="chevronDown" size={tv ? n(10) : 14} color={tv ? fg : "#9AA6BD"} />
      </TVFocusable>
      {open ? <LanguagePicker tv={tv} scale={scale} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function LanguagePicker({ tv, scale = 1, onClose }: { tv: boolean; scale?: number; onClose: () => void }) {
  const preference = useLanguageStore((state) => state.preference);
  const setPreference = useLanguageStore((state) => state.setPreference);
  const insets = useSafeAreaInsets();
  const [focusedValue, setFocusedValue] = useState<LanguagePreference | null>(null);
  const n = (value: number) => Math.round(value * scale);
  const choose = (value: LanguagePreference) => {
    setPreference(value);
    onClose();
  };

  if (tv) {
    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
        <View style={styles.tvBackdrop}>
          <View accessibilityViewIsModal style={[styles.tvCard, { width: n(360), paddingTop: n(22), paddingHorizontal: n(20), paddingBottom: n(16), borderRadius: n(14), gap: n(5) }]}>
            <View style={[styles.row, { gap: n(7), paddingHorizontal: n(13) }]}>
              <AppIcon name="globe" size={n(16)} color="#00D7FF" />
              <AppText style={[styles.tvTitle, { fontSize: n(17), lineHeight: n(22) }]}>Idioma do aplicativo</AppText>
            </View>
            <AppText style={[styles.muted, { fontSize: n(10), lineHeight: n(14), paddingHorizontal: n(13), marginTop: n(1), marginBottom: n(9) }]}>
              Muda os textos do app. O áudio e as legendas dos vídeos continuam os da sua lista.
            </AppText>
            {OPTIONS.map((option) => {
              const isFocused = focusedValue === option.value;
              const selected = preference === option.value;
              return (
                <TVFocusable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                  hasTVPreferredFocus={selected}
                  onPress={() => choose(option.value)}
                  onFocus={() => setFocusedValue(option.value)}
                  onBlur={() => setFocusedValue((value) => (value === option.value ? null : value))}
                  focusStyle={styles.noRing}
                  style={[styles.tvOption, { minHeight: n(42), paddingHorizontal: n(13), borderRadius: n(9) }, isFocused && styles.tvOptionFocused]}
                >
                  <View style={{ gap: n(2) }}>
                    <AppText style={[styles.optionLabel, { fontSize: n(13), lineHeight: n(17) }, isFocused && styles.darkText]}>{option.label}</AppText>
                    <AppText style={[{ fontSize: n(9), lineHeight: n(12) }, isFocused ? styles.darkSub : styles.muted]}>{option.tvSub}</AppText>
                  </View>
                  {selected ? <AppIcon name="check" size={n(14)} strokeWidth={2.4} color={isFocused ? "#070B14" : "#00D7FF"} /> : null}
                </TVFocusable>
              );
            })}
            <AppText style={[styles.hint, { fontSize: n(9), paddingHorizontal: n(13), marginTop: n(8) }]}>OK escolher   •   Voltar fechar</AppText>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TVFocusable accessibilityRole="button" accessibilityLabel="Fechar" focusable={false} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: 30 + insets.bottom }]}>
          <View style={styles.handle} />
          <AppText style={styles.sheetTitle}>Idioma do aplicativo</AppText>
          <AppText style={styles.sheetText}>Muda os textos do app. O áudio e as legendas dos vídeos continuam os da sua lista.</AppText>
          {OPTIONS.map((option) => {
            const selected = preference === option.value;
            return (
              <TVFocusable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
                onPress={() => choose(option.value)}
                style={({ pressed }) => [styles.sheetOption, selected && styles.sheetOptionSelected, pressed && styles.pressed]}
              >
                <View style={styles.sheetOptionText}>
                  <AppText style={styles.sheetOptionLabel}>{option.label}</AppText>
                  <AppText style={styles.sheetOptionSub}>{option.phoneSub}</AppText>
                </View>
                {selected ? <AppIcon name="check" size={22} strokeWidth={2.4} color="#00D7FF" /> : null}
              </TVFocusable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(14,21,36,0.92)", borderWidth: 0 },
  pillFocused: { backgroundColor: "#F4F8FF" },
  phonePill: { height: 44, paddingLeft: 10, paddingRight: 12, gap: 6, borderRadius: 22 },
  phoneLabel: { fontSize: 14, lineHeight: 18 },
  pillLabel: { fontFamily: "Inter_600SemiBold" },
  noRing: { borderColor: "transparent", transform: [] },
  pressed: { opacity: 0.78 },
  row: { flexDirection: "row", alignItems: "center" },
  tvBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(3,6,12,0.78)" },
  tvCard: { backgroundColor: "#0E1524" },
  tvTitle: { fontFamily: "Inter_700Bold", letterSpacing: -0.3, color: "#F4F8FF" },
  muted: { color: "#9AA6BD" },
  tvOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "transparent", borderWidth: 0 },
  tvOptionFocused: { backgroundColor: "#F4F8FF" },
  optionLabel: { fontFamily: "Inter_600SemiBold", color: "#F4F8FF" },
  darkText: { color: "#070B14" },
  darkSub: { color: "#4A5568" },
  hint: { color: "#7F8BA3" },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,6,12,0.72)" },
  sheet: { gap: 4, paddingTop: 12, paddingHorizontal: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: "#0E1524" },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#2A3650", marginBottom: 14 },
  sheetTitle: { paddingHorizontal: 16, fontFamily: "Inter_700Bold", fontSize: 19, lineHeight: 24, color: "#F4F8FF" },
  sheetText: { paddingHorizontal: 16, marginTop: 4, marginBottom: 12, fontSize: 13, lineHeight: 19, color: "#9AA6BD" },
  sheetOption: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderRadius: 14 },
  sheetOptionSelected: { backgroundColor: "#1A2438" },
  sheetOptionText: { gap: 2 },
  sheetOptionLabel: { fontFamily: "Inter_600SemiBold", fontSize: 16, lineHeight: 20, color: "#F4F8FF" },
  sheetOptionSub: { fontSize: 12, lineHeight: 16, color: "#9AA6BD" },
});

