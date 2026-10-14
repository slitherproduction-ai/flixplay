import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { getStartupScreen } from "@/core/startup/recovery";
import { getSecureStorageStatus, subscribeSecureStorageStatus } from "@/services/security/secureStorage";
import { useAppStore } from "@/store/useAppStore";
import { useTVMode } from "@/hooks/use-tv-mode";

const mobileSplash = require("@/assets/images/brand/ELVANOQ_splash_mobile_v3.png");
const tvSplash = require("@/assets/images/brand/ELVANOQ_splash_tv_v3.png");

function FullScreenSplash() {
  const tvMode = useTVMode();
  return (
    <View testID="placeholder-screen" style={styles.splash}>
      <Image source={tvMode ? tvSplash : mobileSplash} contentFit="cover" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.splashVeil} />
      <View style={styles.splashLoading}>
        <ActivityIndicator size="small" color={Colors.white} />
      </View>
    </View>
  );
}

export default function Index() {
  const activeServerId = useAppStore((state) => state.activeServerId);
  const servers = useAppStore((state) => state.servers);
  const hasHydrated = useAppStore((state) => state._hasHydrated);
  const setHydrating = useAppStore((state) => state.setHydrating);
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const [secureStatus, setSecureStatus] = useState(getSecureStorageStatus);

  useEffect(() => {
    return subscribeSecureStorageStatus(setSecureStatus);
  }, []);

  useEffect(() => {
    if (hasHydrated) return;
    const timeout = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(timeout);
  }, [hasHydrated]);

  const retrySecureStorage = useCallback(() => {
    setTimedOut(false);
    setHydrating();
    void useAppStore.persist.rehydrate();
  }, [setHydrating]);

  const startupScreen = getStartupScreen({
    hydrated: hasHydrated,
    timedOut,
    secureStorageStatus: secureStatus,
  });

  if (startupScreen === "loading") {
    return <FullScreenSplash />;
  }

  if (startupScreen === "recovery") {
    return (
      <View style={styles.splash}>
        <View style={styles.recoveryIcon}>
          <Ionicons name="shield-outline" size={30} color={Colors.blueBright} />
        </View>
        <AppText style={styles.recoveryTitle}>Não foi possível acessar o armazenamento seguro</AppText>
        <AppText style={styles.recoveryBody}>
          Seus dados locais foram preservados. Tente novamente ou informe as credenciais no login.
        </AppText>
        <TVFocusable hasTVPreferredFocus accessibilityRole="button" accessibilityLabel="Tentar novamente" onPress={retrySecureStorage} style={styles.primaryButton}>
          <Ionicons name="refresh" size={17} color={Colors.white} />
          <AppText style={styles.primaryButtonText}>Tentar novamente</AppText>
        </TVFocusable>
        <TVFocusable accessibilityRole="button" accessibilityLabel="Voltar ao login" onPress={() => router.replace("/login")} style={styles.secondaryButton}>
          <AppText style={styles.secondaryButtonText}>Voltar ao login</AppText>
        </TVFocusable>
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
    padding: 28,
    gap: 14,
  },
  splashVeil: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(1, 5, 12, 0.08)" },
  splashLoading: { position: "absolute", bottom: 28, alignSelf: "center", width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "rgba(0,0,0,0.24)" },
  loadingText: { color: Colors.muted, fontSize: 14 },
  recoveryIcon: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(20,125,255,0.12)" },
  recoveryTitle: { color: Colors.text, fontSize: 20, fontWeight: "700", textAlign: "center" },
  recoveryBody: { color: Colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 420 },
  primaryButton: { minHeight: 50, minWidth: 230, borderRadius: 25, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.blue },
  primaryButtonText: { color: Colors.white, fontSize: 15, fontWeight: "700" },
  secondaryButton: { minHeight: 46, minWidth: 230, borderRadius: 23, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  secondaryButtonText: { color: Colors.text, fontSize: 14, fontWeight: "600" },
});
