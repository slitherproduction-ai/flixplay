import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { FontMap } from "@/constants/Typography";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";
import { useAppStore } from "@/store/useAppStore";

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
// Global floating Picture-in-Picture overlay
// ---------------------------------------------------------------------------

const IPTV_HEADERS = { "User-Agent": "IPTVSmartersPro/3.1.5" };

function PiPOverlay() {
  const insets = useSafeAreaInsets();
  const pip = useAppStore((state) => state.pip);
  const deactivatePip = useAppStore((state) => state.deactivatePip);

  const player = useVideoPlayer(
    pip.isActive ? { uri: pip.streamUrl, headers: IPTV_HEADERS } : null,
    (p) => {
      if (pip.isActive) {
        p.loop = false;
        p.play();
      }
    },
  );

  const handleClose = useCallback(() => {
    try {
      player.pause();
    } catch {
      // ignore
    }
    deactivatePip();
  }, [player, deactivatePip]);

  const handleTogglePlay = useCallback(() => {
    try {
      if (player.playing) {
        player.pause();
      } else {
        player.play();
      }
    } catch (err) {
      console.error("PiP toggle play error", err);
    }
  }, [player]);

  if (!pip.isActive) return null;

  return (
    <View
      style={[
        pipStyles.container,
        { bottom: insets.bottom + 80 },
      ]}
    >
      <VideoView
        player={player}
        style={pipStyles.video}
        contentFit="contain"
        nativeControls={false}
      />
      <View style={pipStyles.controls}>
        <Text style={pipStyles.title} numberOfLines={1}>
          {pip.title}
        </Text>
        <View style={pipStyles.actions}>
          <Pressable
            onPress={handleTogglePlay}
            style={pipStyles.btn}
            accessibilityLabel="Pausar/Reproduzir PiP"
          >
            <Ionicons name="play" size={14} color={Colors.white} />
          </Pressable>
          <Pressable
            onPress={handleClose}
            style={pipStyles.btn}
            accessibilityLabel="Fechar PiP"
          >
            <Ionicons name="close" size={14} color={Colors.white} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const pipStyles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 16,
    width: 250,
    height: 140 + 36, // video (16:9) + controls bar
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "#07090E",
    zIndex: 9999,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
  },
  video: {
    width: 250,
    height: 140,
  },
  controls: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 6,
    backgroundColor: "rgba(7,9,14,0.95)",
  },
  title: {
    flex: 1,
    fontSize: 9,
    color: "rgba(255,255,255,0.85)",
    fontFamily: "System",
  },
  actions: { flexDirection: "row", gap: 4 },
  btn: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
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
          {/* Global floating PiP overlay — renders above all screens */}
          <PiPOverlay />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
