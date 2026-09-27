import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { APP_INFO } from "@/constants/app";
import { Colors, Radii } from "@/constants/theme";
import { TV_ROUTES, isTvRouteActive, type TvRoute } from "@/core/navigation/tv-routes";
import { TVFocusable, type TVFocusableHandle } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";

export const TV_NAV_COLLAPSED_WIDTH = 68;
const TV_NAV_EXPANDED_WIDTH = 204;

export function TvSideNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const width = useRef(new Animated.Value(TV_NAV_COLLAPSED_WIDTH)).current;
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuHasFocus = useRef(false);
  const routeRefs = useRef<Record<TvRoute["key"], TVFocusableHandle | null>>({
    home: null,
    live: null,
    movies: null,
    series: null,
    settings: null,
  });
  const [focusHandles, setFocusHandles] = useState<number[]>([]);

  useEffect(() => () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
  }, []);

  useEffect(() => {
    Animated.timing(width, {
      toValue: expanded ? TV_NAV_EXPANDED_WIDTH : TV_NAV_COLLAPSED_WIDTH,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [expanded, width]);

  const expand = useCallback(() => {
    menuHasFocus.current = true;
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    setExpanded(true);
  }, []);

  const scheduleCollapse = useCallback(() => {
    menuHasFocus.current = false;
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => {
      if (!menuHasFocus.current) setExpanded(false);
    }, 320);
  }, []);

  const resolveFocusHandles = useCallback(() => {
    requestAnimationFrame(() => {
      setFocusHandles(TV_ROUTES.map((route) => routeRefs.current[route.key]?.getNodeHandle() ?? 0));
    });
  }, []);

  const openRoute = useCallback((route: TvRoute) => {
    if (!isTvRouteActive(pathname, route.href)) router.replace(route.href);
  }, [pathname, router]);

  return (
    <Animated.View style={[styles.shell, { width }]}>
      <View style={styles.brand}>
        <Image source={require("../assets/images/flixplay_icon.png")} contentFit="contain" style={styles.logo} />
        <View style={styles.brandCopy}>
            <AppText style={styles.brandName}>FlixPlay</AppText>
            <AppText style={styles.brandHint}>ENTRETENIMENTO</AppText>
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
              onFocus={expand}
              onBlur={scheduleCollapse}
              nextFocusUp={focusHandles[index - 1] || ownHandle}
              nextFocusDown={focusHandles[index + 1] || ownHandle}
              nextFocusLeft={ownHandle}
              onPress={() => openRoute(route)}
              style={({ pressed }) => [
                styles.navItem,
                selected && styles.navItemSelected,
                pressed && styles.navItemPressed,
              ]}
              focusStyle={styles.navItemFocused}
            >
              <View style={[styles.activeBar, selected && styles.activeBarVisible]} />
              <Ionicons
                name={selected ? route.icon.replace("-outline", "") as TvRoute["icon"] : route.icon}
                size={25}
                color={selected ? Colors.blueBright : Colors.muted}
              />
              <AppText numberOfLines={1} style={[styles.navLabel, selected && styles.navLabelSelected]}>
                {route.label}
              </AppText>
            </TVFocusable>
          );
        })}
      </View>

      <AppText numberOfLines={1} style={styles.version}>{APP_INFO.versionLabel}</AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: "absolute",
    zIndex: 50,
    elevation: 30,
    left: 0,
    top: 0,
    bottom: 0,
    overflow: "hidden",
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 12,
    backgroundColor: "#080C16",
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  brand: { height: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, overflow: "hidden" },
  logo: { width: 36, height: 36, borderRadius: 10, flexShrink: 0 },
  brandCopy: { gap: 1, minWidth: 145 },
  brandName: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 18 },
  brandHint: { color: Colors.blueBright, fontFamily: "Inter_600SemiBold", fontSize: 8, letterSpacing: 1.1 },
  navList: { flex: 1, justifyContent: "center", gap: 8 },
  navItem: {
    height: 48,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 9,
    borderRadius: Radii.medium,
    overflow: "hidden",
  },
  navItemSelected: { backgroundColor: "rgba(59,130,246,0.13)" },
  navItemFocused: { backgroundColor: "rgba(59,130,246,0.24)", borderColor: Colors.blueBright },
  navItemPressed: { opacity: 0.76 },
  activeBar: { position: "absolute", left: 0, width: 3, height: 24, borderRadius: 2, opacity: 0 },
  activeBarVisible: { backgroundColor: Colors.blueBright, opacity: 1 },
  navLabel: { minWidth: 118, color: Colors.muted, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  navLabelSelected: { color: Colors.text },
  version: { minWidth: 155, color: Colors.subtle, fontSize: 9, paddingHorizontal: 5 },
});
