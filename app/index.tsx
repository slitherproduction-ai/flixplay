import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Colors } from "@/constants/theme";
import { useAppStore } from "@/store/useAppStore";

export default function Index() {
  const activeServerId = useAppStore((state) => state.activeServerId);
  const servers = useAppStore((state) => state.servers);
  const hasHydrated = useAppStore((state) => state._hasHydrated);

  if (!hasHydrated) {
    return (
      <View testID="placeholder-screen" style={styles.splash}>
        <ActivityIndicator size="large" color={Colors.blueBright} />
      </View>
    );
  }

  // Redirect to login if there's no active server, or if the stored activeServerId
  // no longer matches any saved server (e.g. user cleared storage externally).
  const serverExists = servers.some((s) => s.id === activeServerId);
  if (!activeServerId || !serverExists) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
});
