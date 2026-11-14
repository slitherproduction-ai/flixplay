import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { APP_INFO } from "@/constants/app";
import { Colors } from "@/constants/theme";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useAppStore } from "@/store/useAppStore";
import { showDialog } from "@/components/app-dialog";

/**
 * Ajustes na TV (2.17.58): menu fixo à esquerda e o conteúdo à direita, como
 * nas TVs Google e Apple. Substitui a grade de cartões com bordas e a ida e
 * volta entre telas. As telas de Ajustes que usam o padrão "premium" ficam
 * dentro do painel e escondem a própria barra de Voltar (o Voltar do
 * controle continua funcionando).
 */

/** Cores das superfícies da TV: níveis por tom, sem bordas. */
export const TvTone = {
  rail: "#0A101C",
  surface: "#0E1524",
  surfaceHigh: "#1A2438",
  divider: "#141F33",
  ring: "#F4F8FF",
  danger: "#FF8A8A",
} as const;

/** Foco único da TV: anel claro, fundo mais claro e nenhum aumento. */
export const tvFocus = StyleSheet.create({
  ring: { borderWidth: 2, borderColor: TvTone.ring, backgroundColor: TvTone.surfaceHigh, transform: [] },
  ringOnly: { borderWidth: 2, borderColor: TvTone.ring, transform: [] },
});

export type TvSettingsSection = "lists" | "player" | "parental" | "categories" | "diagnostics" | "about";

const ShellContext = createContext(false);

/** Verdadeiro quando a tela está dentro do painel de Ajustes da TV. */
export function useInTvSettingsShell(): boolean {
  return useContext(ShellContext);
}

const ITEMS: { key: TvSettingsSection; label: string; icon: keyof typeof Ionicons.glyphMap; path: string | null }[] = [
  { key: "lists", label: "Listas", icon: "list-outline", path: null },
  { key: "player", label: "Reprodução", icon: "play-circle-outline", path: "/settings/player" },
  { key: "parental", label: "Controle parental", icon: "lock-closed-outline", path: "/settings/parental" },
  { key: "categories", label: "Categorias visíveis", icon: "eye-outline", path: "/settings/categories" },
  { key: "diagnostics", label: "Diagnóstico", icon: "pulse-outline", path: "/settings/diagnostics" },
  { key: "about", label: "Sobre o aplicativo", icon: "information-circle-outline", path: "/settings/about" },
];

/** Telas que abrem em tela cheia (precisam da largura toda). */
const FULL_SCREEN: TvSettingsSection[] = ["diagnostics", "about"];

export function TvSettingsShell({ current, children }: { current: TvSettingsSection; children: ReactNode }) {
  const tvMode = useTVMode();
  const router = useRouter();
  const logout = useAppStore((state) => state.logout);

  const open = useCallback((item: (typeof ITEMS)[number]) => {
    if (item.key === current) return;
    // Na aba Ajustes (Listas) as outras seções entram por cima; entre seções
    // troca no lugar, para o Voltar sempre levar de volta às Listas.
    if (item.path === null) {
      if (router.canGoBack()) router.back();
      return;
    }
    if (current === "lists" || FULL_SCREEN.includes(item.key)) router.push(item.path as never);
    else router.replace(item.path as never);
  }, [current, router]);

  const confirmLogout = useCallback(() => {
    showDialog("Sair da conta", "Desconectar da lista atual? Você precisará entrar novamente.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: () => { logout(); router.replace("/login"); } },
    ]);
  }, [logout, router]);

  if (!tvMode) return <>{children}</>;
  return (
    <ShellContext.Provider value>
      <View style={styles.root}>
        <View style={styles.rail} accessibilityRole="menu">
          <AppText style={styles.railTitle}>AJUSTES</AppText>
          {ITEMS.map((item) => {
            const active = item.key === current;
            return (
              <TVFocusable
                key={item.key}
                accessibilityRole="menuitem"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: active }}
                hasTVPreferredFocus={false}
                onPress={() => open(item)}
                focusStyle={tvFocus.ring}
                style={[styles.railItem, active && styles.railItemActive]}
              >
                <Ionicons name={item.icon} size={17} color={active ? Colors.text : Colors.muted} />
                <AppText numberOfLines={1} style={[styles.railLabel, active && styles.railLabelActive]}>{item.label}</AppText>
              </TVFocusable>
            );
          })}
          <View style={styles.railSpacer} />
          <TVFocusable accessibilityRole="button" accessibilityLabel="Sair da conta" onPress={confirmLogout} focusStyle={tvFocus.ring} style={styles.railItem}>
            <Ionicons name="log-out-outline" size={17} color={TvTone.danger} />
            <AppText style={[styles.railLabel, styles.railDanger]}>Sair da conta</AppText>
          </TVFocusable>
          <AppText style={styles.railVersion}>{APP_INFO.name} {APP_INFO.versionLabel}</AppText>
        </View>
        <View style={styles.content}>{children}</View>
      </View>
    </ShellContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: Colors.background },
  rail: { width: 236, paddingTop: 34, paddingBottom: 24, paddingHorizontal: 16, gap: 3, backgroundColor: TvTone.rail },
  railTitle: { paddingHorizontal: 12, paddingBottom: 14, fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.8, color: Colors.muted },
  railItem: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 2, borderColor: "transparent" },
  railItemActive: { backgroundColor: TvTone.surfaceHigh },
  railLabel: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.muted },
  railLabelActive: { fontFamily: "Inter_700Bold", color: Colors.text },
  railDanger: { color: TvTone.danger, fontFamily: "Inter_600SemiBold" },
  railSpacer: { flex: 1 },
  railVersion: { paddingHorizontal: 12, paddingTop: 6, fontSize: 9, color: Colors.subtle },
  content: { flex: 1, minWidth: 0 },
});
