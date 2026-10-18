import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { APP_INFO } from "@/constants/app";
import { Colors } from "@/constants/theme";
import { TV_ROUTES, isTvRouteActive, type TvRoute } from "@/core/navigation/tv-routes";
import { TVFocusable, type TVFocusableHandle } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Fire TV renders animated/overflowing side rails unreliably: labels may be
 * painted behind the scene or disappear while focus moves. Reserve this full,
 * stable width for the TV rail instead of expanding it over application UI.
 */
export const TV_NAV_WIDTH = 216;
// The permanent rail width while the user is navigating content. Screens use
// this inset for their TV density calculations.
export const TV_NAV_COLLAPSED_WIDTH = 68;

// Fire TV can dispatch blur from the current item noticeably before focus is
// delivered to the adjacent item. Keep the rail open through that hand-off so
// labels are never unmounted while the user is moving inside the menu.
const MENU_FOCUS_HANDOFF_GRACE_MS = 420;

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
  const [focusedRouteKey, setFocusedRouteKey] = useState<TvRoute["key"] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelCollapse = useCallback(() => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  }, []);

  useEffect(() => () => cancelCollapse(), [cancelCollapse]);

  const handleNavigationFocus = useCallback((routeKey: TvRoute["key"]) => {
    cancelCollapse();
    setExpanded(true);
    setFocusedRouteKey(routeKey);
  }, [cancelCollapse]);
  const handleNavigationBlur = useCallback((routeKey: TvRoute["key"]) => {
    setFocusedRouteKey((current) => current === routeKey ? null : current);
    // Native focus emits blur before focus when moving between adjacent menu
    // entries. Fire TV's hand-off can take longer than one frame, so closing
    // the rail too early makes labels disappear during D-pad navigation.
    // The incoming item's onFocus cancels this timer; it only completes after
    // focus has actually left the navigation region.
    cancelCollapse();
    collapseTimer.current = setTimeout(() => {
      setExpanded(false);
      collapseTimer.current = null;
    }, MENU_FOCUS_HANDOFF_GRACE_MS);
  }, [cancelCollapse]);

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
        {expanded ? (
          <View style={styles.brandCopy}>
              <AppText style={styles.brandName}>ELVANOQ</AppText>
              <AppText style={styles.brandHint}>SUA MÍDIA</AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.navList} onLayout={resolveFocusHandles}>
        {TV_ROUTES.map((route, index) => {
          const selected = isTvRouteActive(pathname, route.href);
          const focused = focusedRouteKey === route.key;
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
              onFocus={() => handleNavigationFocus(route.key)}
              onBlur={() => handleNavigationBlur(route.key)}
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
                // Every available destination remains visible while the rail
                // is open; focus only changes the selected surface.
                color={focused ? Colors.text : selected ? Colors.blueBright : "rgba(238,244,252,0.88)"}
              />
              {expanded ? (
                <AppText numberOfLines={1} style={[styles.navLabel, selected && styles.navLabelSelected, focused && styles.navLabelFocused]}>
                  {route.label}
                </AppText>
              ) : null}
            </TVFocusable>
          );
        })}
      </View>

      {expanded ? (
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <AppText numberOfLines={1} style={styles.version}>{APP_INFO.versionLabel}</AppText>
        </View>
      ) : null}
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
  brandCopy: { flex: 1, gap: 2 },
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
  navLabel: { flex: 1, color: "rgba(237,244,255,0.92)", fontFamily: "Inter_500Medium", fontSize: 13 },
  navLabelSelected: { color: Colors.text },
  navLabelFocused: { color: Colors.text },
  footer: { gap: 9, paddingHorizontal: 5, overflow: "hidden" },
  footerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(201,223,255,0.14)" },
  version: { color: "rgba(181,201,225,0.65)", fontSize: 9 },
});
