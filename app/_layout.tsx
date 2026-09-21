import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { FontMap } from "@/constants/Typography";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Colors } from "@/constants/theme";

void SplashScreen.preventAutoHideAsync();

// ---------------------------------------------------------------------------
// ErrorBoundary — catches JS errors and shows a recovery screen instead of
// crashing the app. Wraps the entire navigator so no error goes unhandled.
// ---------------------------------------------------------------------------
interface BoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  BoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    const message =
      error instanceof Error ? error.message : "Erro inesperado.";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={errStyles.container}>
          <View style={errStyles.icon}>
            <Text style={errStyles.iconText}>!</Text>
          </View>
          <Text style={errStyles.title}>Algo deu errado</Text>
          <Text selectable style={errStyles.message}>
            {this.state.message}
          </Text>
          <Pressable onPress={this.handleRetry} style={errStyles.btn}>
            <Text style={errStyles.btnText}>Tentar novamente</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const errStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    padding: 28,
    gap: 14,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(229,9,20,0.15)",
  },
  iconText: { fontSize: 30, color: "#FF6870", fontWeight: "700" },
  title: { fontSize: 20, fontWeight: "700", color: "#F8FAFC", textAlign: "center" },
  message: { fontSize: 13, color: "#94A3B8", textAlign: "center", lineHeight: 19 },
  btn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: "#2563EB",
  },
  btnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
});

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------
export default function RootLayout() {
  const [loaded, error] = useFonts(FontMap);

  useEffect(() => {
    if (loaded || error) {
      void SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.background },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="details/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="player" options={{ presentation: "fullScreenModal" }} />
            <Stack.Screen name="server/add" options={{ presentation: "modal" }} />
            <Stack.Screen name="settings/trakt" options={{ presentation: "formSheet" }} />
            <Stack.Screen name="settings/about" options={{ presentation: "modal" }} />
          </Stack>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
