import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
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
 * The TV rail always occupies its full width. Keeping the scene inset equal to
 * this value prevents the expanded navigation from covering search, filters or
 * the first content card.
 */
export const TV_NAV_COLLAPSED_WIDTH = 64;
const TV_NAV_EXPANDED_WIDTH = 216;

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
  const [focusedRouteKey, setFocusedRouteKey] = useState<TvRoute["key"] | null>(null);
  const focusedRouteRef = useRef<TvRoute["key"] | null>(null);
  const focusEpoch = useRef(0);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelCollapse = useCallback(() => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = null;
  }, []);
  const handleNavigationFocus = useCallback((routeKey: TvRoute["key"]) => {
    cancelCollapse();
    focusEpoch.current += 1;
    focusedRouteRef.current = routeKey;
    setFocusedRouteKey(routeKey);
    setExpanded(true);
  }, [cancelCollapse]);
  const handleNavigationBlur = useCallback((routeKey: TvRoute["key"]) => {
    // Android TV can emit blur before the next item in the rail receives focus,
    // especially when directional input is repeated. Keep the rail open for a
    // full transition window and collapse only when that same item has not been
    // replaced. This prevents labels and icons from disappearing mid-navigation.
    const epochAtBlur = focusEpoch.current;
    cancelCollapse();
    collapseTimer.current = setTimeout(() => {
      collapseTimer.current = null;
      if (focusEpoch.current !== epochAtBlur || focusedRouteRef.current !== routeKey) return;
      focusedRouteRef.current = null;
      setFocusedRouteKey(null);
      setExpanded(false);
    }, 950);
  }, [cancelCollapse]);

  useEffect(() => () => cancelCollapse(), [cancelCollapse]);

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
      <View style={[styles.shell, expanded && styles.shellExpanded]}>
      <BlurView
        intensity={52}
        tint="dark"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={styles.glassWash} />
      <View style={styles.brand}>
        <BrandLogo variant="symbol" style={styles.logo} accessibilityLabel="Símbolo ELVANOQ" />
        <View style={[styles.brandCopy, expanded && styles.brandCopyExpanded]}>
            <AppText style={styles.brandName}>ELVANOQ</AppText>
            <AppText style={styles.brandHint}>SUA MÍDIA</AppText>
        </View>
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
                expanded && styles.navItemExpanded,
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
                color={focused ? Colors.background : selected ? Colors.blueBright : expanded ? "rgba(238,244,252,0.88)" : "rgba(216,226,239,0.80)"}
              />
              <AppText numberOfLines={1} style={[styles.navLabel, expanded && styles.navLabelExpanded, selected && styles.navLabelSelected, focused && styles.navLabelFocused]}>
                {route.label}
              </AppText>
            </TVFocusable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={styles.footerDivider} />
        <AppText numberOfLines={1} style={[styles.version, expanded && styles.versionExpanded]}>{APP_INFO.versionLabel}</AppText>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { width: TV_NAV_COLLAPSED_WIDTH, flexShrink: 0, overflow: "visible", zIndex: 20, elevation: 20 },
  shell: {
    width: TV_NAV_COLLAPSED_WIDTH,
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    flexShrink: 0,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 10,
    // A dark translucent wash preserves contrast without hiding the native
    // BlurView placed directly beneath this surface.
    backgroundColor: "rgba(9,17,31,0.54)",
    borderRightWidth: 1,
    borderRightColor: "rgba(186,221,255,0.12)",
  },
  shellExpanded: { width: TV_NAV_EXPANDED_WIDTH, shadowColor: "#000", shadowOpacity: 0.36, shadowRadius: 20, shadowOffset: { width: 10, height: 0 }, elevation: 22 },
  glassWash: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(8,15,26,0.30)" },
  brand: { height: 42, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 5, marginBottom: 10 },
  logo: { width: 23, height: 23, borderRadius: 7, flexShrink: 0 },
  brandCopy: { width: 0, opacity: 0, overflow: "hidden", gap: 2 },
  brandCopyExpanded: { width: 128, opacity: 1 },
  brandName: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 13, letterSpacing: -0.2 },
  brandHint: { color: "rgba(107,204,255,0.8)", fontFamily: "Inter_600SemiBold", fontSize: 7, letterSpacing: 1 },
  navList: { flex: 1, justifyContent: "flex-start", paddingTop: 8, gap: 4 },
  navItem: {
    height: 40,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    paddingHorizontal: 0,
    borderRadius: 7,
    overflow: "hidden",
  },
  navItemExpanded: { justifyContent: "flex-start", gap: 11, paddingHorizontal: 10 },
  navItemSelected: { backgroundColor: "rgba(52,112,180,0.16)", borderWidth: 1, borderColor: "rgba(170,220,255,0.20)" },
  navItemFocused: { borderWidth: 2, backgroundColor: Colors.white, borderColor: "rgba(255,255,255,0.96)", transform: [{ scale: 1 }], opacity: 1 },
  navItemPressed: { opacity: 0.9 },
  activeBar: { position: "absolute", left: 2, width: 2, height: 15, borderRadius: 2, opacity: 0 },
  activeBarVisible: { backgroundColor: Colors.blueBright, opacity: 1 },
  navLabel: { width: 0, opacity: 0, overflow: "hidden", color: "rgba(237,244,255,0.92)", fontFamily: "Inter_500Medium", fontSize: 13 },
  navLabelExpanded: { width: 128, opacity: 1 },
  navLabelSelected: { color: Colors.text },
  navLabelFocused: { color: Colors.background },
  footer: { gap: 9, paddingHorizontal: 5, overflow: "hidden" },
  footerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(201,223,255,0.14)" },
  version: { width: 0, opacity: 0, color: "rgba(181,201,225,0.46)", fontSize: 9 },
  versionExpanded: { width: 155, opacity: 1 },
});
