import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { Colors, Radii } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";

export type TitleVariantOption = { id: string; label: string };

/**
 * Escolha de versão do mesmo título (Dublado, Legendado…). Os catálogos
 * mostram um único cartão; a versão é escolhida aqui, nos Detalhes.
 */
export function VariantSelector({
  options,
  currentId,
  onSelect,
  compact = false,
}: {
  options: TitleVariantOption[];
  currentId: string;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  if (options.length < 2) return null;
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Versão do áudio">
      <View style={styles.labelRow}>
        <Ionicons name="language-outline" size={compact ? 12 : 14} color={Colors.muted} />
        <AppText style={[styles.label, compact && styles.labelCompact]}>VERSÃO</AppText>
      </View>
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.id === currentId;
          return (
            <TVFocusable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              onPress={() => { if (!selected) onSelect(option.id); }}
              focusStyle={styles.optionFocused}
              style={({ pressed }) => [styles.option, compact && styles.optionCompact, selected && styles.optionSelected, pressed && styles.pressed]}
            >
              {selected ? <Ionicons name="checkmark" size={compact ? 12 : 14} color={Colors.background} /> : null}
              <AppText style={[styles.optionText, compact && styles.optionTextCompact, selected && styles.optionTextSelected]}>{option.label}</AppText>
            </TVFocusable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  label: { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.2, color: Colors.muted },
  labelCompact: { fontSize: 9 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, borderRadius: Radii.pill, borderWidth: 1, borderColor: "rgba(244,248,255,0.22)", backgroundColor: "rgba(17,27,45,0.78)" },
  optionCompact: { minHeight: 30, paddingHorizontal: 12 },
  optionSelected: { borderColor: Colors.white, backgroundColor: Colors.white },
  optionFocused: { borderWidth: 2, borderColor: Colors.blueBright, transform: [{ scale: 1.05 }] },
  optionText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  optionTextCompact: { fontSize: 11 },
  optionTextSelected: { color: Colors.background },
  pressed: { opacity: 0.75 },
});
