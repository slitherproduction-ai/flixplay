import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Radii } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText, Chip, SearchField } from "@/components/ui";
import { displayCategory, formatNumber } from "@/features/catalog/display";

// ---------------------------------------------------------------------------
// Cabeçalho compacto de Filmes e Séries no celular e no tablet em pé.
// O conteúdo aparece logo no topo, como na Netflix e no Prime Video:
//   título + total, busca em um único campo, uma linha de categorias e a
//   ordenação recolhida em "Ordenar". Atualizar fica no gesto de puxar a
//   lista para baixo.
// ---------------------------------------------------------------------------

type Props<S extends string> = {
  title: string;
  noun: { singular: string; plural: string };
  totalCount: number;
  filteredCount: number;
  isSyncing: boolean;
  syncProgress: string | null;
  syncError: string | null;
  onRetry: () => void;
  query: string;
  setQuery: (value: string) => void;
  searchPlaceholder: string;
  categories: string[];
  category: string;
  setCategory: (value: string) => void;
  favoritesLabel: string;
  sortOptions?: readonly S[];
  sort?: S;
  setSort?: (value: S) => void;
};

export function MobileCatalogHeader<S extends string>({
  title,
  noun,
  totalCount,
  filteredCount,
  isSyncing,
  syncProgress,
  syncError,
  onRetry,
  query,
  setQuery,
  searchPlaceholder,
  categories,
  category,
  setCategory,
  favoritesLabel,
  sortOptions,
  sort,
  setSort,
}: Props<S>) {
  const insets = useSafeAreaInsets();
  const [sortOpen, setSortOpen] = useState(false);
  const onFavorites = category === favoritesLabel;

  return (
    <View style={[styles.block, { paddingTop: insets.top + 14 }]}>
      <View style={styles.titleRow}>
        <AppText style={styles.title}>{title}</AppText>
        <AppText style={styles.total}>
          {isSyncing && totalCount === 0
            ? (syncProgress ?? "Carregando…")
            : `${formatNumber(totalCount)} ${totalCount === 1 ? noun.singular : noun.plural}`}
        </AppText>
      </View>

      {isSyncing && totalCount > 0 ? (
        <View style={styles.syncPill}>
          <ActivityIndicator size="small" color={Colors.blueBright} />
          <AppText numberOfLines={1} style={styles.syncText}>{syncProgress ?? "Atualizando catálogo…"}</AppText>
        </View>
      ) : null}

      {syncError ? (
        <View style={styles.errorPill}>
          <Ionicons name="alert-circle" size={15} color="#FF8B91" />
          <AppText numberOfLines={2} style={styles.errorText}>{syncError}</AppText>
          <TVFocusable accessibilityRole="button" accessibilityLabel="Tentar novamente" onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
            <AppText style={styles.retryText}>Tentar</AppText>
          </TVFocusable>
        </View>
      ) : null}

      {!onFavorites ? <SearchField value={query} onChangeText={setQuery} placeholder={searchPlaceholder} /> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller} contentContainerStyle={styles.chipContent}>
        {categories.map((item) => (
          <Chip
            key={item}
            label={item === favoritesLabel ? "Minha Lista" : displayCategory(item)}
            selected={category === item}
            onPress={() => setCategory(item)}
            icon={item === favoritesLabel ? (category === item ? "bookmark" : "bookmark-outline") : undefined}
          />
        ))}
      </ScrollView>

      <View style={styles.resultRow}>
        <AppText style={styles.resultCount}>
          {onFavorites
            ? `${formatNumber(filteredCount)} na Minha Lista`
            : `${formatNumber(filteredCount)} ${filteredCount === 1 ? "título" : "títulos"}`}
        </AppText>
        {sortOptions && sort && setSort && !onFavorites ? (
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel={`Ordenar: ${sort}`}
            accessibilityState={{ expanded: sortOpen }}
            onPress={() => setSortOpen((open) => !open)}
            style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}
          >
            <Ionicons name="swap-vertical" size={13} color={Colors.blueBright} />
            <AppText style={styles.sortText}>{sort}</AppText>
            <Ionicons name={sortOpen ? "chevron-up" : "chevron-down"} size={13} color={Colors.muted} />
          </TVFocusable>
        ) : null}
      </View>

      {sortOpen && sortOptions && setSort ? (
        <View style={styles.sortMenu}>
          {sortOptions.map((option) => {
            const selected = option === sort;
            return (
              <TVFocusable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => { setSort(option); setSortOpen(false); }}
                style={({ pressed }) => [styles.sortOption, pressed && styles.pressed]}
              >
                <AppText style={[styles.sortOptionText, selected && styles.sortOptionSelected]}>{option}</AppText>
                {selected ? <Ionicons name="checkmark" size={16} color={Colors.blueBright} /> : null}
              </TVFocusable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 14, marginBottom: 14 },
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, lineHeight: 34, letterSpacing: -0.8, color: Colors.text },
  total: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.muted },
  syncPill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.pill, backgroundColor: "rgba(0,215,255,0.08)" },
  syncText: { flex: 1, fontSize: 12, color: Colors.blueBright },
  errorPill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: "rgba(255,92,114,0.10)" },
  errorText: { flex: 1, fontSize: 12, color: "#FF8B91" },
  retry: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "rgba(255,92,114,0.18)" },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#FF8B91" },
  pressed: { opacity: 0.72 },
  chipScroller: { flexGrow: 0, marginHorizontal: -20 },
  chipContent: { gap: 8, paddingHorizontal: 20 },
  resultRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  resultCount: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  sortButton: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, borderRadius: Radii.pill, borderWidth: 1, borderColor: "rgba(190,222,255,0.16)", backgroundColor: "rgba(13,20,34,0.7)" },
  sortText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  sortMenu: { overflow: "hidden", borderRadius: 14, borderWidth: 1, borderColor: "rgba(190,222,255,0.14)", backgroundColor: "rgba(13,20,34,0.96)" },
  sortOption: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(190,222,255,0.10)" },
  sortOptionText: { fontSize: 14, color: "#C9D3E3" },
  sortOptionSelected: { fontFamily: "Inter_600SemiBold", color: Colors.text },
});
