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
 * Only the icon rail belongs to the flex layout. The expanded drawer is a
 * visual sibling of the focusables, never a parent of them. This keeps the
 * native Android TV focus graph identical while the user moves up or down.
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
    // Do not set state while moving between menu items. Fire TV may dispatch
    // focus synchronously, so only the first entry into the rail opens it.
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
      {expanded ? (
        <LinearGradient
          pointerEvents="none"
          colors={["#02050B", "#07101B", "#101924"]}
          locations={[0, 0.58, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.drawer}
        >
          <View style={styles.labelList}>
            {TV_ROUTES.map((route) => {
              const selected = isTvRouteActive(pathname, route.href);
              return (
                <View key={route.key} style={styles.labelRow}>
                  <AppText numberOfLines={1} style={[styles.label, selected && styles.labelSelected]}>
                    {route.label}
                  </AppText>
                </View>
              );
            })}
          </View>
        </LinearGradient>
      ) : null}

      <View style={styles.iconList} onLayout={resolveRouteHandles}>
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
              style={styles.iconButton}
              focusStyle={styles.iconButtonFocused}
            >
              {selected ? <View style={styles.activeMark} /> : null}
              <Ionicons name={route.icon} size={12} color={selected ? "#79DBFF" : "#D8E2EE"} />
            </TVFocusable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: TV_NAV_WIDTH,
    flexShrink: 0,
    position: "relative",
    zIndex: 20,
    elevation: 20,
    backgroundColor: "#02050B",
  },
  // This overlay is non-interactive. It contains only static labels and is
  // mounted once when the rail receives focus; D-pad vertical moves never
  // resize, hide or rerender the native focusable buttons.
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: TV_NAV_EXPANDED_WIDTH,
    borderRightWidth: 1,
    borderRightColor: "#1B2B3D",
    zIndex: 1,
    elevation: 20,
  },
  labelList: {
    flex: 1,
    justifyContent: "center",
    gap: 7,
    paddingLeft: 64,
    paddingRight: 18,
  },
  labelRow: {
    height: 42,
    justifyContent: "center",
    paddingLeft: 12,
  },
  iconList: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: TV_NAV_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
    zIndex: 2,
    elevation: 21,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  iconButtonFocused: {
    borderWidth: 1,
    borderColor: "#B6ECFF",
    backgroundColor: "#173C55",
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    transform: [{ scale: 1 }],
  },
  activeMark: {
    position: "absolute",
    left: 2,
    width: 2,
    height: 14,
    borderRadius: 2,
    backgroundColor: "#65D5FF",
  },
  label: { color: "#E8F2FC", fontFamily: "Inter_500Medium", fontSize: 13 },
  labelSelected: { color: Colors.white, fontFamily: "Inter_700Bold" },
});
