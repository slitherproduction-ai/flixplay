import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type React from "react";
import { Platform, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import { TVFocusable } from "@/components/tv-focusable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/theme";
import { useXtreamSync } from "@/hooks/useXtreamSync";

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
  // Trigger real server sync as soon as tabs are mounted
  useXtreamSync();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton,
        sceneStyle: { backgroundColor: Colors.background },
        tabBarActiveTintColor: Colors.blueBright,
        tabBarInactiveTintColor: Colors.subtle,
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 10,
          marginBottom: 2,
        },
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          backgroundColor: "rgba(10, 14, 24, 0.96)",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "TV ao Vivo",
          tabBarIcon: ({ color, size }) => <Ionicons name="radio" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="movies"
        options={{
          title: "Filmes",
          tabBarIcon: ({ color, size }) => <Ionicons name="film" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="series"
        options={{
          title: "Séries",
          tabBarIcon: ({ color, size }) => <Ionicons name="albums" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
