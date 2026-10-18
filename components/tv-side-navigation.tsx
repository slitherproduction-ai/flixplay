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
 * Fire TV renders animated/overflowing side rails unreliably: labels may be
 * painted behind the scene or disappear while focus moves. Reserve this full,
 * stable width for the TV rail instead of expanding it over application UI.
 */
export const TV_NAV_WIDTH = 216;
// The permanent rail width while the user is navigating content. Screens use
// this inset for their TV density calculations.
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
    <View style={[styles.slot, expanded ? styles.slotExpanded : styles.slotCollapsed]}>
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
              style={({ pressed }) => [
                styles.navItem,
                !expanded && styles.navItemCollapsed,
                selected && styles.navItemSelected,
                pressed && styles.navItemPressed,
              ]}
              focusStyle={styles.navItemFocused}
            >
              <View style={[styles.activeBar, selected && styles.activeBarVisible]} />
              <Ionicons
                name={selected ? route.icon.replace("-outline", "") as TvRoute["icon"] : route.icon}
                size={20}
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
  // A normal in-flow panel, not an overflow overlay. This is intentional for
  // reliable composition on Android TV, Google TV and Fire TV.
  slot: { flexShrink: 0, backgroundColor: "#09111F" },
  slotCollapsed: { width: TV_NAV_COLLAPSED_WIDTH },
  slotExpanded: { width: TV_NAV_WIDTH },
  shell: {
    flex: 1,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 10,
    backgroundColor: "#09111F",
    borderRightWidth: 1,
    borderRightColor: "rgba(186,221,255,0.12)",
  },
  brand: { height: 42, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 5, marginBottom: 10 },
  logo: { width: 23, height: 23, borderRadius: 7, flexShrink: 0 },
  brandCopy: { flex: 1, gap: 2, overflow: "hidden" },
  copyHidden: { flex: 0, width: 0, opacity: 0 },
  brandName: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 13, letterSpacing: -0.2 },
  brandHint: { color: "rgba(107,204,255,0.8)", fontFamily: "Inter_600SemiBold", fontSize: 7, letterSpacing: 1 },
  navList: { flex: 1, justifyContent: "flex-start", paddingTop: 8, gap: 4 },
  navItem: {
    height: 40,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 11,
    paddingHorizontal: 10,
    borderRadius: 7,
    overflow: "hidden",
  },
  navItemCollapsed: { justifyContent: "center", gap: 0, paddingHorizontal: 0 },
  navItemSelected: { backgroundColor: "rgba(52,112,180,0.16)", borderWidth: 1, borderColor: "rgba(170,220,255,0.20)" },
  navItemFocused: { borderWidth: 1, backgroundColor: "rgba(69, 165, 238, 0.28)", borderColor: "rgba(156, 221, 255, 0.92)", transform: [{ scale: 1 }], opacity: 1 },
  navItemPressed: { opacity: 0.9 },
  activeBar: { position: "absolute", left: 2, width: 2, height: 15, borderRadius: 2, opacity: 0 },
  activeBarVisible: { backgroundColor: Colors.blueBright, opacity: 1 },
  labelSlot: { flex: 1, minWidth: 0, overflow: "hidden" },
  labelSlotHidden: { flex: 0, width: 0, opacity: 0 },
  navLabel: { color: "rgba(237,244,255,0.92)", fontFamily: "Inter_500Medium", fontSize: 13 },
  navLabelSelected: { color: Colors.text },
  footer: { gap: 9, paddingHorizontal: 5, overflow: "hidden" },
  footerHidden: { height: 0, opacity: 0 },
  footerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(201,223,255,0.14)" },
  version: { color: "rgba(181,201,225,0.65)", fontSize: 9 },
});
