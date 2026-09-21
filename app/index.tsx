import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Colors } from "@/constants/theme";
import { useAppStore } from "@/store/useAppStore";

export default function Index() {
  const activeServerId = useAppStore((state) => state.activeServerId);
  const hasHydrated = useAppStore((state) => state._hasHydrated);

  if (!hasHydrated) {
    return (
      <View testID="placeholder-screen" style={styles.splash}>
        <ActivityIndicator size="large" color={Colors.blueBright} />
      </View>
    );
  }

  if (!activeServerId) {
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
