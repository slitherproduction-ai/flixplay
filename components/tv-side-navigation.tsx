import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Colors } from "@/constants/theme";
import { TVFocusable, type TVFocusableHandle } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { TV_ROUTES, isTvRouteActive, type TvRoute } from "@/core/navigation/tv-routes";
import { useTVRemote, type TVRemoteEvent } from "@/hooks/use-tv-remote";

/**
 * The permanent in-flow rail only reserves icon space. The expanded drawer is
 * an opaque overlay above page content, so opening it never reflows, remounts,
 * clips, or repaints the active TV screen.
 */
export const TV_NAV_WIDTH = 64;
export const TV_NAV_COLLAPSED_WIDTH = TV_NAV_WIDTH;
export const TV_NAV_EXPANDED_WIDTH = 232;

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
  const [routeHandles, setRouteHandles] = useState<number[]>([]);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);

  const openRail = useCallback(() => {
    if (expandedRef.current) return;
    expandedRef.current = true;
    setExpanded(true);
  }, []);

  const closeRail = useCallback(() => {
    if (!expandedRef.current) return;
    expandedRef.current = false;
    setExpanded(false);
  }, []);

  const onRemote = useCallback((event: TVRemoteEvent) => {
    // Right is the explicit hand-off to page content. No blur handler is used:
    // Android sends transient blur events while moving vertically in a list.
    if (event === "right") closeRail();
  }, [closeRail]);

  useTVRemote(onRemote, expanded);

  const resolveRouteHandles = useCallback(() => {
    requestAnimationFrame(() => {
      setRouteHandles(TV_ROUTES.map((route) => routeRefs.current[route.key]?.getNodeHandle() ?? 0));
    });
  }, []);

  const openRoute = useCallback((route: TvRoute) => {
    if (!isTvRouteActive(pathname, route.href)) router.replace(route.href);
  }, [pathname, router]);

  return (
    <View style={styles.rail}>
      <LinearGradient
        pointerEvents="none"
        colors={["#02050B", "#07101B", "#101924"]}
        locations={[0, 0.58, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.drawer, expanded ? styles.drawerExpanded : styles.drawerCollapsed]}
      />
      <View style={[styles.drawerContent, expanded ? styles.drawerExpanded : styles.drawerCollapsed]}>
        <View style={styles.navList} onLayout={resolveRouteHandles}>
          {TV_ROUTES.map((route, index) => {
            const selected = isTvRouteActive(pathname, route.href);
            const ownHandle = routeHandles[index] || undefined;
            return (
              <TVFocusable
                ref={(node) => { routeRefs.current[route.key] = node; }}
                key={route.key}
                accessibilityRole="button"
                accessibilityLabel={route.label}
                accessibilityState={{ selected }}
                focusId={`tv-nav-${route.key}`}
                focusScope="tv-side-navigation"
                focusIndex={index}
                restoreFocus
                nextFocusUp={routeHandles[index - 1] || ownHandle}
                nextFocusDown={routeHandles[index + 1] || ownHandle}
                nextFocusLeft={ownHandle}
                onFocus={openRail}
                onPress={() => openRoute(route)}
                style={styles.item}
                focusStyle={styles.itemFocused}
              >
                {selected ? <View style={styles.activeMark} /> : null}
                <Ionicons
                  name={route.icon}
                  size={12}
                  color={selected ? "#79DBFF" : "#D8E2EE"}
                />
                <View pointerEvents="none" style={styles.labelSlot}>
                  <AppText numberOfLines={1} style={[styles.label, selected && styles.labelSelected]}>
                    {route.label}
                  </AppText>
                </View>
              </TVFocusable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Only this narrow rail participates in the flex row with page content.
  rail: { width: TV_NAV_WIDTH, flexShrink: 0, position: "relative", zIndex: 20, elevation: 20 },
  // Both layers retain the same children/geometry. Width is the only stateful
  // property and it changes only when focus enters or exits the rail.
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    borderRightWidth: 1,
    borderRightColor: "#1B2B3D",
  },
  drawerContent: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    zIndex: 1,
    elevation: 21,
  },
  drawerCollapsed: { width: TV_NAV_COLLAPSED_WIDTH },
  drawerExpanded: { width: TV_NAV_EXPANDED_WIDTH },
  navList: {
    flex: 1,
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10,
  },
  item: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    overflow: "hidden",
  },
  itemFocused: {
    borderWidth: 1,
    borderColor: "#B6ECFF",
    backgroundColor: "#173C55",
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    transform: [{ scale: 1 }],
  },
  activeMark: { position: "absolute", left: 3, width: 2, height: 14, borderRadius: 2, backgroundColor: "#65D5FF" },
  // Labels are physically clipped by the drawer in icon mode, never hidden
  // with opacity. This avoids the Fire TV label-loss issue during D-pad moves.
  labelSlot: { flex: 1, minWidth: 0, overflow: "hidden" },
  label: { color: "#E8F2FC", fontFamily: "Inter_500Medium", fontSize: 13 },
  labelSelected: { color: Colors.white, fontFamily: "Inter_700Bold" },
});
