import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs, usePathname } from "expo-router";
import type React from "react";
import { Platform, StyleSheet, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import { TVFocusable } from "@/components/tv-focusable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/theme";
import { useXtreamSync } from "@/hooks/useXtreamSync";
import { useTVMode } from "@/hooks/use-tv-mode";
import { TvSideNavigation } from "@/components/tv-side-navigation";
import { isTvRouteActive } from "@/core/navigation/tv-routes";
import { View } from "react-native";

// ---------------------------------------------------------------------------
// Tab bar button
// ---------------------------------------------------------------------------
// On actual TV devices, wrap each tab button in TVFocusable so the focus ring
// and D-pad navigation work correctly.
// On smartphones and web, leave tabBarButton undefined so React Navigation uses
// its own default Pressable-based button which has proper touch handling.
// Using TVFocusable on phones previously caused tab taps to be dropped.

type TabButtonProps = {
  accessibilityLabel?: string;
  accessibilityRole?: string;
  accessibilityState?: { selected?: boolean };
  children?: React.ReactNode;
  disabled?: boolean | null;
  onLongPress?: ((e: GestureResponderEvent) => void) | null;
  onPress?: ((e: GestureResponderEvent) => void) | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function TvTabButton({
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  children,
  disabled,
  onLongPress,
  onPress,
  style,
  testID,
}: TabButtonProps) {
  return (
    <TVFocusable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole as "button"}
      accessibilityState={accessibilityState}
      disabled={disabled ?? false}
      hasTVPreferredFocus={accessibilityState?.selected === true}
      onLongPress={onLongPress}
      onPress={onPress}
      style={style}
      testID={testID}
    >
      {children}
    </TVFocusable>
  );
}

const tabBarButton: ((props: TabButtonProps) => React.ReactNode) | undefined = Platform.isTV
  ? (props: TabButtonProps) => <TvTabButton {...props} />
  : undefined;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tvMode = useTVMode();
  const pathname = usePathname();
  // Trigger real server sync as soon as tabs are mounted
  useXtreamSync();

  const navigator = (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Keeps inactive TV surfaces out of the render pipeline while their
        // route state is retained for fast D-pad navigation.
        freezeOnBlur: tvMode,
        tabBarButton: tvMode ? undefined : tabBarButton,
        sceneStyle: {
          backgroundColor: Colors.background,
        },
        // Aba ativa em branco com ícone preenchido; inativas em contorno.
        tabBarActiveTintColor: Colors.text,
        tabBarInactiveTintColor: "#6F7C92",
        tabBarActiveBackgroundColor: "rgba(244, 248, 255, 0.07)",
        tabBarItemStyle: {
          marginHorizontal: 3,
          marginVertical: 6,
          borderRadius: 14,
        },
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          letterSpacing: 0.1,
          marginBottom: 2,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={52}
            tint="dark"
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        ),
        tabBarStyle: {
          display: tvMode ? "none" : "flex",
          height: 64 + insets.bottom,
          paddingTop: 5,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopWidth: 1,
          borderTopColor: "rgba(190, 222, 255, 0.10)",
          backgroundColor: "rgba(7, 11, 20, 0.78)",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "home" : "home-outline"} color={color} size={size - 1} />,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "TV ao Vivo",
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "radio" : "radio-outline"} color={color} size={size - 1} />,
        }}
      />
      <Tabs.Screen
        name="movies"
        options={{
          title: "Filmes",
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "film" : "film-outline"} color={color} size={size - 1} />,
        }}
      />
      <Tabs.Screen
        name="series"
        options={{
          title: "Séries",
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "albums" : "albums-outline"} color={color} size={size - 1} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "settings" : "settings-outline"} color={color} size={size - 1} />,
        }}
      />
    </Tabs>
  );

  if (!tvMode) return navigator;

  return (
    <View style={styles.tvRoot}>
      {/*
       * Keep the rail in the normal flex layout. Fire OS can re-compose the
       * React Navigation scene above an absolutely positioned sibling and
       * intermittently hide its labels/icons, regardless of zIndex/elevation.
       * An in-flow sibling has its own reserved surface and cannot be painted
       * over by the active tab scene.
       */}
      {/*
       * Como no Roku, a Início é um hub: seus blocos de navegação substituem
       * o menu lateral. Nas demais seções o menu permanece, e Voltar retorna
       * à Início (backBehavior padrão do Tabs: firstRoute).
       */}
      {isTvRouteActive(pathname, "/") ? null : <TvSideNavigation />}
      <View style={styles.tvNavigator}>{navigator}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  tvRoot: { flex: 1, flexDirection: "row", backgroundColor: Colors.background },
  tvNavigator: { flex: 1, minWidth: 0 },
});
