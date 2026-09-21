import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { TVFocusable } from "@/components/tv-focusable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/theme";
import { useXtreamSync } from "@/hooks/useXtreamSync";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Trigger real server sync as soon as tabs are mounted
  useXtreamSync();

  return (
    <View testID="tab-navigator" style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
         headerShown: false,
         tabBarButton: ({ accessibilityLabel, accessibilityRole, accessibilityState, children, disabled, onLongPress, onPress, style, testID }) => (
           <TVFocusable
             accessibilityLabel={accessibilityLabel}
             accessibilityRole={accessibilityRole}
             accessibilityState={accessibilityState}
             disabled={disabled}
             hasTVPreferredFocus={accessibilityState?.selected === true}
             onLongPress={onLongPress}
             onPress={(event) => onPress?.(event)}
             style={style}
             testID={testID}
           >
             {children}
           </TVFocusable>
         ),
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
        <Tabs.Screen name="index" options={{ title: "Início", tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }} />
        <Tabs.Screen name="live" options={{ title: "TV ao Vivo", tabBarIcon: ({ color, size }) => <Ionicons name="radio" color={color} size={size} /> }} />
        <Tabs.Screen name="movies" options={{ title: "Filmes", tabBarIcon: ({ color, size }) => <Ionicons name="film" color={color} size={size} /> }} />
        <Tabs.Screen name="series" options={{ title: "Séries", tabBarIcon: ({ color, size }) => <Ionicons name="albums" color={color} size={size} /> }} />
        <Tabs.Screen name="settings" options={{ title: "Ajustes", tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} /> }} />
      </Tabs>
    </View>
  );
}
