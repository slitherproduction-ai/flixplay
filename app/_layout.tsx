import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { FontMap } from "@/constants/Typography";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useState } from "react";
import { Animated, BackHandler, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, ToastAndroid, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";
import { useAppStore } from "@/store/useAppStore";
import { TVFocusable } from "@/components/tv-focusable";
import { UpdateAvailableNotice } from "@/components/update-available-notice";
import { CodeAccessGate } from "@/components/code-access-gate";
import { LegacyPortalMigration } from "@/components/legacy-portal-migration";

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

function isRootRoute(pathname: string) {
  return ["/", "/index", "/live", "/movies", "/series", "/settings"].includes(pathname);
}

/** Prevents accidental exit while keeping Back available to stacked screens. */
function RootExitGuard() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const lastBackAt = React.useRef(0);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (visible) {
        setVisible(false);
        return true;
      }
      if (!isRootRoute(pathname)) return false;

      const now = Date.now();
      if (now - lastBackAt.current > 1800) {
        lastBackAt.current = now;
        ToastAndroid.show("Pressione Voltar novamente para sair", ToastAndroid.SHORT);
        return true;
      }
      lastBackAt.current = 0;
      setVisible(true);
      return true;
    });
    return () => subscription.remove();
  }, [pathname, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View accessibilityViewIsModal style={exitStyles.backdrop}>
        <View style={exitStyles.dialog}>
          <Text style={exitStyles.title}>Deseja sair do aplicativo?</Text>
          <Text style={exitStyles.body}>Você poderá continuar de onde parou ao abrir novamente.</Text>
          <View style={exitStyles.actions}>
            <TVFocusable hasTVPreferredFocus accessibilityRole="button" accessibilityLabel="Não, continuar no aplicativo" onPress={() => setVisible(false)} style={exitStyles.secondary}>
              <Text style={exitStyles.secondaryText}>Não</Text>
            </TVFocusable>
            <TVFocusable accessibilityRole="button" accessibilityLabel="Sim, sair do aplicativo" onPress={() => BackHandler.exitApp()} style={exitStyles.primary}>
              <Text style={exitStyles.primaryText}>Sim</Text>
            </TVFocusable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const exitStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.72)" },
  dialog: { width: "100%", maxWidth: 430, gap: 12, padding: 24, borderRadius: 20, backgroundColor: Colors.backgroundRaised, borderWidth: 1, borderColor: Colors.border },
  title: { color: Colors.text, fontSize: 20, fontWeight: "700" },
  body: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  secondary: { minWidth: 104, minHeight: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  primary: { minWidth: 104, minHeight: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.82)", backgroundColor: Colors.white },
  secondaryText: { color: Colors.text, fontSize: 15, fontWeight: "700" },
  primaryText: { color: Colors.background, fontSize: 15, fontWeight: "700" },
});

// ---------------------------------------------------------------------------
// Global floating Picture-in-Picture overlay — YouTube miniplayer style
// ---------------------------------------------------------------------------

const IPTV_HEADERS = { "User-Agent": "IPTVSmartersPro/3.1.5" };
const PIP_VIDEO_W = 124;
const PIP_VIDEO_H = Math.round(PIP_VIDEO_W * (9 / 16));

function PiPOverlay() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pip = useAppStore((state) => state.pip);
  const deactivatePip = useAppStore((state) => state.deactivatePip);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0); // 0–1

  // Animated values created once via useState initializer (never trigger re-render)
  const [slideY] = useState(() => new Animated.Value(120));
  const [panTranslateX] = useState(() => new Animated.Value(0));
  const [panTranslateY] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));

  const player = useVideoPlayer(
    pip.isActive ? { uri: pip.streamUrl, headers: IPTV_HEADERS } : null,
    (p) => {
      if (pip.isActive) {
        p.loop = false;
        p.play();
      }
    },
  );

  // PanResponder created once — captures Animated values (stable objects from useState)
  // and deactivatePip (stable Zustand action). No refs captured, so lint-safe.
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 || Math.abs(g.dx) > 6,
      onPanResponderGrant: () => {
        panTranslateX.stopAnimation();
        panTranslateY.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        panTranslateX.setValue(g.dx);
        panTranslateY.setValue(g.dy > 0 ? g.dy : g.dy * 0.3);
        const dist = Math.sqrt(g.dx * g.dx + g.dy * g.dy);
        opacity.setValue(Math.max(0, 1 - dist / 200));
      },
      onPanResponderRelease: (_, g) => {
        // Swipe left fast/far → dismiss left
        if (g.dx < -80 || (g.vx < -0.6 && g.dx < -30)) {
          Animated.parallel([
            Animated.timing(panTranslateX, { toValue: -500, duration: 220, useNativeDriver: true }),
            Animated.timing(panTranslateY, { toValue: 0, duration: 220, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start(() => { deactivatePip(); });
          return;
        }
        // Swipe down fast/far → dismiss down
        if (g.dy > 60 || (g.vy > 0.6 && g.dy > 20)) {
          Animated.parallel([
            Animated.timing(panTranslateX, { toValue: 0, duration: 220, useNativeDriver: true }),
            Animated.timing(panTranslateY, { toValue: 250, duration: 220, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start(() => { deactivatePip(); });
          return;
        }
        // Snap back to original position
        Animated.parallel([
          Animated.spring(panTranslateX, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }),
          Animated.spring(panTranslateY, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }),
          Animated.spring(opacity, { toValue: 1, useNativeDriver: true }),
        ]).start();
      },
    })
  );

  // Track progress for non-live content
  useEffect(() => {
    if (!pip.isActive) return;
    const sub = player.addListener(
      "timeUpdate" as Parameters<typeof player.addListener>[0],
      (payload: unknown) => {
        try {
          const tp = payload as { currentTime?: number; duration?: number };
          if (typeof tp.currentTime === "number" && typeof tp.duration === "number" && tp.duration > 0) {
            setProgress(Math.min(1, tp.currentTime / tp.duration));
          }
        } catch {
          // ignore
        }
      },
    );
    return () => { sub.remove(); };
  }, [player, pip.isActive]);

  // Slide in from bottom when PiP activates; reset pan values
  useEffect(() => {
    if (pip.isActive) {
      panTranslateX.setValue(0);
      panTranslateY.setValue(0);
      opacity.setValue(1);
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 12,
      }).start();
    } else {
      slideY.setValue(120);
    }
  }, [pip.isActive, slideY, panTranslateX, panTranslateY, opacity]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(panTranslateX, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(panTranslateY, { toValue: 250, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      try { player.pause(); } catch { /* ignore */ }
      deactivatePip();
    });
  }, [player, deactivatePip, panTranslateX, panTranslateY, opacity]);

  const handleTogglePlay = useCallback(() => {
    try {
      if (player.playing) {
        player.pause();
        setIsPlaying(false);
      } else {
        player.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("PiP toggle play error", err);
    }
  }, [player]);

  const handleExpand = useCallback(() => {
    try { player.pause(); } catch { /* ignore */ }
    router.push({
      pathname: "/player",
      params: {
        id: pip.contentId,
        title: pip.title,
        type: pip.type,
        streamUrl: pip.streamUrl,
      },
    });
    deactivatePip();
  }, [router, pip, deactivatePip, player]);

  if (!pip.isActive) return null;

  const barBottom = insets.bottom + 56;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        pipStyles.container,
        {
          bottom: barBottom,
          transform: [
            { translateY: Animated.add(slideY, panTranslateY) },
            { translateX: panTranslateX },
          ],
          opacity,
        },
      ]}
    >
      <BlurView
        intensity={52}
        tint="dark"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Thin progress bar at very top of the mini player */}
      {pip.type !== "live" ? (
        <View style={pipStyles.progressTrack}>
          <Animated.View style={[pipStyles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      ) : null}

      <Pressable
        onPress={handleExpand}
        style={pipStyles.pressable}
        accessibilityLabel="Expandir para tela cheia"
      >
        {/* Left: live video preview */}
        <View style={pipStyles.videoWrap}>
          <VideoView
            player={player}
            style={pipStyles.video}
            contentFit="cover"
            nativeControls={false}
          />
          {!isPlaying ? (
            <View style={pipStyles.videoOverlay}>
              <Ionicons name="play" size={18} color={Colors.white} />
            </View>
          ) : null}
          {pip.type === "live" ? (
            <View style={pipStyles.liveBadge}>
              <View style={pipStyles.liveDot} />
              <Text style={pipStyles.liveText}>AO VIVO</Text>
            </View>
          ) : null}
        </View>

        {/* Center: title + subtitle */}
        <View style={pipStyles.info}>
          <Text style={pipStyles.titleText} numberOfLines={1}>{pip.title}</Text>
          <Text style={pipStyles.subtitleText} numberOfLines={1}>
            {pip.subtitle || "Assistindo agora"}
          </Text>
        </View>
      </Pressable>

      {/* Right: play/pause + close */}
      <View style={pipStyles.actions}>
        <Pressable
          onPress={handleTogglePlay}
          style={pipStyles.actionBtn}
          accessibilityLabel={isPlaying ? "Pausar" : "Reproduzir"}
          hitSlop={8}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={22}
            color={Colors.white}
          />
        </Pressable>
        <Pressable
          onPress={handleClose}
          style={pipStyles.actionBtn}
          accessibilityLabel="Fechar miniplayer"
          hitSlop={8}
        >
          <Ionicons name="close" size={22} color={Colors.white} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const pipStyles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(13,17,26,0.56)",
    borderTopWidth: 1,
    borderTopColor: "rgba(173,216,255,0.24)",
    zIndex: 9999,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    paddingRight: 6,
    overflow: "hidden",
  },
  progressTrack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2563EB",
  },
  pressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  videoWrap: {
    width: PIP_VIDEO_W,
    height: PIP_VIDEO_H + 16,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  video: {
    width: PIP_VIDEO_W,
    height: PIP_VIDEO_H + 16,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  liveBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(229,9,20,0.9)",
  },
  liveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#fff" },
  liveText: { fontFamily: "System", fontSize: 7, color: "#fff", letterSpacing: 0.5 },
  info: {
    flex: 1,
    gap: 3,
    paddingHorizontal: 12,
  },
  titleText: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 13,
    color: Colors.text,
  },
  subtitleText: {
    fontFamily: "System",
    fontSize: 11,
    color: Colors.muted,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 6,
  },
  actionBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
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
          <View style={{ flex: 1 }}>
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
                <Stack.Screen name="continue-watching" options={{ presentation: "card" }} />
                <Stack.Screen name="watch-later" options={{ presentation: "card" }} />
                <Stack.Screen name="server/add" options={{ presentation: "modal" }} />
                <Stack.Screen name="settings/player" options={{ presentation: "card" }} />
                <Stack.Screen name="settings/about" options={{ presentation: "modal" }} />
              </Stack>
              <RootExitGuard />
              <LegacyPortalMigration />
              <CodeAccessGate />
              <UpdateAvailableNotice />
              {/* Global floating PiP overlay — renders above all screens */}
              <PiPOverlay />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
