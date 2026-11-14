import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui";
import { TVFocusable } from "@/components/tv-focusable";
import { TvSettingsShell, TvTone, tvFocus } from "@/components/tv-settings-shell";
import { GroupLabel, PremiumBackdrop, PremiumHeading, PremiumTopBar, premium, usePremiumContentStyle } from "@/components/premium-screen";
import { Colors } from "@/constants/theme";
import { useHiddenCategoryIds, useToggleHiddenCategory } from "@/features/catalog/hidden-categories";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useAppStore } from "@/store/useAppStore";
import type { ParentalCategoryKind } from "@/store/types";

const TABS: { kind: ParentalCategoryKind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { kind: "live", label: "Ao vivo", icon: "tv-outline" },
  { kind: "movies", label: "Filmes", icon: "film-outline" },
  { kind: "series", label: "Séries", icon: "albums-outline" },
];

/** Escolher o que aparece nas listas: categorias marcadas somem sem nada ser apagado. */
export default function CategoriesSettingsScreen() {
  const router = useRouter();
  const { tvMode, isTablet } = useResponsiveLayout();
  const [kind, setKind] = useState<ParentalCategoryKind>("live");
  const live = useAppStore((state) => state.contentCache.liveCategories);
  const movies = useAppStore((state) => state.contentCache.vodCategories);
  const series = useAppStore((state) => state.contentCache.seriesCategories);
  const hiddenIds = useHiddenCategoryIds(kind);
  const toggle = useToggleHiddenCategory(kind);
  const contentStyle = usePremiumContentStyle({ tvMode, wide: isTablet }, 760);
  const categories = kind === "live" ? live : kind === "movies" ? movies : series;
  const hidden = useMemo(() => new Set(hiddenIds), [hiddenIds]);

  const header = (
    <View style={styles.header}>
      <PremiumTopBar title="Categorias" onBack={() => router.back()} />
      <PremiumHeading
        icon="eye-outline"
        title="Escolha o que aparece"
        subtitle="Categorias desmarcadas somem das listas. Nada é apagado: marque de novo para voltar."
      />
      <View style={[styles.segment, tvMode && styles.tvSegment]} accessibilityRole="tablist">
        {TABS.map((tab) => {
          const selected = tab.kind === kind;
          return (
            <TVFocusable
              key={tab.kind}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              hasTVPreferredFocus={tab.kind === "live"}
              onPress={() => setKind(tab.kind)}
              focusStyle={tvMode ? tvFocus.ring : styles.segmentFocused}
              style={[styles.segmentButton, tvMode && styles.tvSegmentButton, selected && (tvMode ? styles.tvSegmentSelected : styles.segmentSelected)]}
            >
              <Ionicons name={tab.icon} size={15} color={selected ? (tvMode ? Colors.blueBright : Colors.background) : Colors.muted} />
              <AppText style={[styles.segmentText, selected && (tvMode ? styles.tvSegmentTextSelected : styles.segmentTextSelected)]}>{tab.label}</AppText>
            </TVFocusable>
          );
        })}
      </View>
      <GroupLabel title={hidden.size ? `${hidden.size} OCULTA${hidden.size === 1 ? "" : "S"}` : "TODAS VISÍVEIS"} />
    </View>
  );

  return (
    <TvSettingsShell current="categories">
    <View style={premium.screen}>
      <PremiumBackdrop />
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={false}
        initialNumToRender={24}
        windowSize={7}
        ListEmptyComponent={<AppText style={styles.empty}>Sincronize a lista para ver as categorias.</AppText>}
        renderItem={({ item, index }) => {
          const visible = !hidden.has(item.id);
          return (
            <TVFocusable
              accessibilityRole="switch"
              accessibilityState={{ checked: visible }}
              accessibilityLabel={`${visible ? "Ocultar" : "Mostrar"} ${item.name}`}
              onPress={() => toggle(item.id)}
              focusStyle={tvMode ? tvFocus.ring : premium.rowFocused}
              style={[
                styles.row,
                index === 0 && styles.rowFirst,
                index === categories.length - 1 && styles.rowLast,
                index > 0 && premium.dividerTop,
                !visible && styles.rowHidden,
                tvMode && styles.tvRow,
              ]}
            >
              <Ionicons name={visible ? "eye-outline" : "eye-off-outline"} size={17} color={visible ? Colors.blueBright : Colors.subtle} />
              <AppText numberOfLines={1} style={[styles.name, !visible && styles.nameHidden]}>{item.name}</AppText>
              <View style={[styles.pill, !visible && styles.pillHidden]}>
                <AppText style={[styles.pillText, !visible && styles.pillTextHidden]}>{visible ? "Visível" : "Oculta"}</AppText>
              </View>
            </TVFocusable>
          );
        }}
      />
    </View>
    </TvSettingsShell>
  );
}

const styles = StyleSheet.create({
  header: { gap: 18, paddingBottom: 18 },
  segment: { flexDirection: "row", gap: 3, padding: 4, borderRadius: 16, borderWidth: 1, borderColor: "rgba(190,222,255,0.10)", backgroundColor: "rgba(13,20,34,0.72)" },
  segmentButton: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 12 },
  segmentSelected: { backgroundColor: "#F4F8FF" },
  segmentFocused: { borderWidth: 2, borderColor: Colors.blueBright, transform: [{ scale: 1.03 }] },
  segmentText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.muted },
  segmentTextSelected: { color: Colors.background },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, borderLeftWidth: 1, borderRightWidth: 1, borderColor: "rgba(190,222,255,0.10)", backgroundColor: "rgba(13,20,34,0.72)" },
  rowFirst: { borderTopWidth: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  rowHidden: { backgroundColor: "rgba(13,20,34,0.45)" },
  name: { flex: 1, fontSize: 14, color: Colors.text },
  nameHidden: { color: Colors.subtle },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(0,215,255,0.10)" },
  pillHidden: { backgroundColor: "rgba(255,255,255,0.06)" },
  pillText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.blueBright },
  pillTextHidden: { color: Colors.subtle },
  empty: { paddingVertical: 30, textAlign: "center", fontSize: 13, color: Colors.muted },
  // TV: sem bordas; aba escolhida com texto azul (foco é o anel claro).
  tvSegment: { borderWidth: 0, backgroundColor: TvTone.surface, alignSelf: "flex-start", gap: 6, padding: 4 },
  tvSegmentButton: { flex: 0, paddingHorizontal: 18, minHeight: 38, borderRadius: 19, borderWidth: 2, borderColor: "transparent" },
  tvSegmentSelected: { backgroundColor: "rgba(0,215,255,0.14)" },
  tvSegmentTextSelected: { fontFamily: "Inter_700Bold", color: Colors.blueBright },
  tvRow: { borderLeftWidth: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomWidth: 0, borderRadius: 12, marginBottom: 2, backgroundColor: TvTone.surface, borderWidth: 2, borderColor: "transparent" },
});
