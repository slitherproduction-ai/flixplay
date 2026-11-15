import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, BackHandler, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import { AppText } from "@/components/ui";
import { APP_INFO } from "@/constants/app";
import { Colors } from "@/constants/theme";
import type { ServerProfile } from "@/store/types";

/**
 * "Bem-vindo de volta" (só na TV, na abertura do app com lista já ativa).
 *
 * Igual no Android TV, Roku, LG e MSX: o fundo do login, a lista em uso e
 * uma barra que enche em ~1,2 s; ao terminar, entra sozinho na lista — o
 * usuário não aperta nada. Voltar durante a barra leva ao login (trocar de
 * lista). Aparece uma vez por abertura do app.
 */

const BACKDROP = require("@/assets/images/brand/ELVANOQ_login_tv_backdrop_v5.jpg");
const LOGO = require("@/assets/images/brand/ELVANOQ_play_logo_tagline.png");
export const WELCOME_BACK_MS = 1_200;

let shownThisLaunch = false;
export function shouldShowWelcomeBack(): boolean {
  return !shownThisLaunch;
}

function formatExpiry(value: string): string {
  if (!value) return "";
  const asNumber = Number(value);
  const date = Number.isFinite(asNumber) && asNumber > 0 ? new Date(asNumber * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `Expira em ${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

export function WelcomeBack({ server }: { server: ServerProfile }) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const u = Math.max(0.82, Math.min(1.8, Math.min(width / 960, height / 540)));
  const n = (value: number) => Math.round(value * u);
  const progress = useRef(new Animated.Value(0)).current;
  const leaving = useRef(false);

  useEffect(() => {
    shownThisLaunch = true;
    const go = (href: "/(tabs)" | "/login") => {
      if (leaving.current) return;
      leaving.current = true;
      router.replace(href);
    };
    const animation = Animated.timing(progress, { toValue: 1, duration: WELCOME_BACK_MS, easing: Easing.out(Easing.quad), useNativeDriver: false });
    animation.start(({ finished }) => { if (finished) go("/(tabs)"); });
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      animation.stop();
      go("/login");
      return true;
    });
    return () => { animation.stop(); back.remove(); };
  }, [progress, router]);

  const name = server.name || "Minha lista";
  const expiry = formatExpiry(server.expiryDate);
  return (
    <View style={styles.screen} accessibilityLiveRegion="polite" accessibilityLabel={`Bem-vindo de volta. Entrando em ${name}.`}>
      <Image source={BACKDROP} contentFit="cover" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["rgba(7,11,20,0.94)", "rgba(7,11,20,0.78)", "rgba(7,11,20,0.12)"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, { paddingHorizontal: n(48), paddingVertical: n(32) }]}>
        <Image source={LOGO} contentFit="contain" contentPosition="left" style={{ width: n(170), height: n(41) }} accessibilityLabel="ELVANOQ Play" />
        <View style={[styles.main, { maxWidth: n(470), gap: n(8) }]}>
          <View style={[styles.statusRow, { gap: n(6) }]}>
            <View style={[styles.dot, { width: n(6), height: n(6), borderRadius: n(3) }]} />
            <AppText style={[styles.status, { fontSize: n(11) }]}>TV vinculada ao Portal</AppText>
          </View>
          <AppText style={[styles.title, { fontSize: n(34), lineHeight: n(40) }]}>Bem-vindo de volta</AppText>
          <AppText style={[styles.subtitle, { fontSize: n(13) }]}>Entrando na sua lista…</AppText>
          <View style={[styles.card, { marginTop: n(16), padding: n(16), gap: n(12), borderRadius: n(14) }]}>
            <View style={[styles.cardRow, { gap: n(12) }]}>
              <View style={[styles.avatar, { width: n(40), height: n(40), borderRadius: n(10) }]}>
                <AppText style={[styles.avatarText, { fontSize: n(17) }]}>{name.trim().charAt(0).toUpperCase() || "E"}</AppText>
              </View>
              <View style={styles.cardCopy}>
                <AppText numberOfLines={1} style={[styles.listName, { fontSize: n(16) }]}>{name}</AppText>
                {expiry ? <AppText style={[styles.expiry, { fontSize: n(11) }]}>{expiry}</AppText> : null}
              </View>
            </View>
            <View style={[styles.track, { height: n(3), borderRadius: n(2) }]}>
              <Animated.View
                style={[styles.fill, { borderRadius: n(2), width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]}
              />
            </View>
          </View>
          <AppText style={[styles.hint, { fontSize: n(10), marginTop: n(6) }]}>Entra sozinha. Para trocar de lista, aperte Voltar.</AppText>
        </View>
        <AppText style={[styles.version, { fontSize: n(10) }]}>ELVANOQ · Versão {APP_INFO.version}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, justifyContent: "space-between" },
  main: { width: "100%" },
  statusRow: { flexDirection: "row", alignItems: "center" },
  dot: { backgroundColor: Colors.blueBright },
  status: { color: "#C9D2E3" },
  title: { fontFamily: "Inter_700Bold", letterSpacing: -0.8, color: "#F4F8FF" },
  subtitle: { color: "#C9D2E3" },
  card: { backgroundColor: "rgba(14,21,36,0.92)" },
  cardRow: { flexDirection: "row", alignItems: "center" },
  avatar: { alignItems: "center", justifyContent: "center", backgroundColor: "#1A2438" },
  avatarText: { fontFamily: "Inter_700Bold", color: Colors.blueBright },
  cardCopy: { flex: 1, gap: 2 },
  listName: { fontFamily: "Inter_700Bold", color: "#F4F8FF" },
  expiry: { color: "#9AA6BD" },
  track: { overflow: "hidden", backgroundColor: "rgba(244,248,255,0.14)" },
  fill: { height: "100%", backgroundColor: Colors.blueBright },
  hint: { color: "#7F8BA3" },
  version: { color: "#7F8BA3" },
});
