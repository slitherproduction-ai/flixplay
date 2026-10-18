import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { APP_INFO } from "@/constants/app";
import { Colors } from "@/constants/theme";
import { TV_ROUTES, isTvRouteActive, type TvRoute } from "@/core/navigation/tv-routes";
import { TVFocusable, type TVFocusableHandle } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";
import { useTVRemote, type TVRemoteEvent } from "@/hooks/use-tv-remote";

/**
 * The focus surface is deliberately permanent. Fire TV recalculates its native
 * focus graph when a focused row, its label, or its parent changes width;
 * those relayouts were the source of labels disappearing while moving up/down.
 * Only a decorative background and opacity change when entering/leaving rail.
 */
export const TV_NAV_WIDTH = 216;
export const TV_NAV_COLLAPSED_WIDTH = 68;


export function TvSideNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const routeRefs = useRef<Record<TvRoute["key"], TVFocusableHandle | null>>({
    home: null,
    live: null,
    movies: null,
    series: null,
    settings: null,
  });
  const [focusHandles, setFocusHandles] = useState<number[]>([]);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);

  const handleNavigationFocus = useCallback(() => {
    // Do not update parent state as focus moves from one item to another.
    // Fire TV dispatches blur/focus for every D-pad step and re-laying out the
    // complete rail at that moment is what caused the labels to disappear.
    // Each TVFocusable still renders its own focus ring independently.
    if (expandedRef.current) return;
    expandedRef.current = true;
    setExpanded(true);
  }, []);

  const handleNavigationRemote = useCallback((event: TVRemoteEvent) => {
    // The right key is the intentional exit from the rail to page content.
    // This is the only navigation path that collapses the menu, eliminating
    // label loss caused by transient blur events between menu entries.
    if (event !== "right") return;
    if (!expandedRef.current) return;
    expandedRef.current = false;
    setExpanded(false);
  }, []);

  // Some Fire TV remotes deliver D-pad presses through the native emitter
  // instead of the focused Pressable. Keep the same explicit exit behavior
  // in both paths; this never runs while the rail is already collapsed.
  useTVRemote(handleNavigationRemote, expanded);

  const resolveFocusHandles = useCallback(() => {
    requestAnimationFrame(() => {
      setFocusHandles(TV_ROUTES.map((route) => routeRefs.current[route.key]?.getNodeHandle() ?? 0));
    });
  }, []);

  const openRoute = useCallback((route: TvRoute) => {
    if (!isTvRouteActive(pathname, route.href)) router.replace(route.href);
  }, [pathname, router]);

  return (
    <View style={styles.slot}>
      <View pointerEvents="none" style={[styles.surface, expanded ? styles.surfaceExpanded : styles.surfaceCollapsed]} />
      <View style={styles.shell}>
      <View style={styles.brand}>
        <BrandLogo variant="symbol" style={styles.logo} accessibilityLabel="Símbolo ELVANOQ" />
        <View pointerEvents="none" style={[styles.brandCopy, !expanded && styles.copyHidden]}>
          <AppText style={styles.brandName}>ELVANOQ</AppText>
          <AppText style={styles.brandHint}>SUA MÍDIA</AppText>
        </View>
      </View>

      <View style={styles.navList} onLayout={resolveFocusHandles}>
        {TV_ROUTES.map((route, index) => {
          const selected = isTvRouteActive(pathname, route.href);
          const ownHandle = focusHandles[index] || undefined;
          return (
            <TVFocusable
              ref={(node) => { routeRefs.current[route.key] = node; }}
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={route.label}
              accessibilityState={{ selected }}
              focusId={route.key}
              focusScope="tv-side-navigation"
              restoreFocus
              nextFocusUp={focusHandles[index - 1] || ownHandle}
              nextFocusDown={focusHandles[index + 1] || ownHandle}
              nextFocusLeft={ownHandle}
              onFocus={handleNavigationFocus}
              onPress={() => openRoute(route)}
              style={({ pressed }) => [styles.navItem, selected && styles.navItemSelected, pressed && styles.navItemPressed]}
              focusStyle={styles.navItemFocused}
            >
              <View style={[styles.activeBar, selected && styles.activeBarVisible]} />
              <Ionicons
                name={selected ? route.icon.replace("-outline", "") as TvRoute["icon"] : route.icon}
                size={22}
                // The item's own native focus ring is the focus indicator.
                // Keeping this color independent of parent state prevents a
                // vertical D-pad move from repainting the whole menu.
                color={selected ? Colors.blueBright : "rgba(238,244,252,0.88)"}
              />
              <View pointerEvents="none" style={[styles.labelSlot, !expanded && styles.labelSlotHidden]}>
                <AppText numberOfLines={1} style={[styles.navLabel, selected && styles.navLabelSelected]}>
                  {route.label}
                </AppText>
              </View>
            </TVFocusable>
          );
        })}
      </View>

      <View pointerEvents="none" style={[styles.footer, !expanded && styles.footerHidden]}>
        <View style={styles.footerDivider} />
        <AppText numberOfLines={1} style={styles.version}>{APP_INFO.versionLabel}</AppText>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The in-flow focus area never changes size.  This avoids FocusFinder
  // rebuilding the vertical navigation graph between two adjacent items.
  slot: { width: TV_NAV_WIDTH, flexShrink: 0, backgroundColor: Colors.background },
  surface: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#09111F",
    borderRightWidth: 1,
    borderRightColor: "rgba(186,221,255,0.12)",
  },
  surfaceCollapsed: { width: TV_NAV_COLLAPSED_WIDTH },
  surfaceExpanded: { width: TV_NAV_WIDTH },
  shell: {
    flex: 1,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 10,
    backgroundColor: "transparent",
  },
  brand: { height: 42, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 5, marginBottom: 10 },
  logo: { width: 23, height: 23, borderRadius: 7, flexShrink: 0 },
  brandCopy: { flex: 1, gap: 2, overflow: "hidden" },
  // Keep the labels measured at their final width even when hidden. Setting
  // width to zero here was enough to make Fire TV drop text during vertical
  // focus handoffs.
  copyHidden: { opacity: 0 },
  brandName: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 13, letterSpacing: -0.2 },
  brandHint: { color: "rgba(107,204,255,0.8)", fontFamily: "Inter_600SemiBold", fontSize: 7, letterSpacing: 1 },
  navList: { flex: 1, justifyContent: "flex-start", paddingTop: 8, gap: 4 },
  navItem: {
    height: 44,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 11,
    paddingHorizontal: 10,
    borderRadius: 7,
    overflow: "hidden",
  },
  navItemSelected: { backgroundColor: "rgba(52,112,180,0.16)", borderWidth: 1, borderColor: "rgba(170,220,255,0.20)" },
  navItemFocused: { borderWidth: 1, backgroundColor: "rgba(69, 165, 238, 0.28)", borderColor: "rgba(156, 221, 255, 0.92)", transform: [{ scale: 1 }], opacity: 1 },
  navItemPressed: { opacity: 0.9 },
  activeBar: { position: "absolute", left: 2, width: 2, height: 18, borderRadius: 2, opacity: 0 },
  activeBarVisible: { backgroundColor: Colors.blueBright, opacity: 1 },
  labelSlot: { flex: 1, minWidth: 0, overflow: "hidden" },
  labelSlotHidden: { opacity: 0 },
  navLabel: { color: "rgba(237,244,255,0.92)", fontFamily: "Inter_500Medium", fontSize: 13 },
  navLabelSelected: { color: Colors.text },
  footer: { gap: 9, paddingHorizontal: 5, overflow: "hidden" },
  footerHidden: { opacity: 0 },
  footerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(201,223,255,0.14)" },
  version: { color: "rgba(181,201,225,0.65)", fontSize: 9 },
});
