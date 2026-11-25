import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, BackHandler, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import { AppText } from "@/components/ui";
import { tr } from "@/core/i18n";
import { catalogSyncedAtKey } from "@/hooks/useXtreamSync";
import { useAppStore } from "@/store/useAppStore";
import type { ServerProfile } from "@/store/types";

/**
 * "Bem-vindo de volta" (canvas aprovado em 25/11/2026; igual a Roku, LG,
 * Samsung, MSX e Whale): abre com a lista já ativa, no celular, tablet e TV.
 * Centralizado no fundo do login, com o carregamento em volta do símbolo do
 * ELVANOQ Play: anel que avança com as etapas (licença → servidor →
 * catálogo salvo), cometa, órbita e satélite girando. "Tudo pronto" esmaece
 * para o Início. Licença bloqueada vai direto ao Início, onde o aviso de
 * acesso já trata o caso. Voltar leva ao login (trocar de lista). Uma vez por
 * abertura do app.
 */

const BACKDROP_TV = require("@/assets/images/brand/ELVANOQ_login_tv_backdrop_v5.jpg");
const BACKDROP_MOBILE = require("@/assets/images/brand/ELVANOQ_login_mobile_backdrop_v5.jpg");
const MARK = require("@/assets/images/brand/ELVANOQ_mark.png");

const LABELS = ["Confirmando a licença…", "Conectando ao servidor da lista…", "Carregando canais, filmes e séries…", "Tudo pronto"];
const FILLS = [0.12, 0.38, 0.7, 1];
const TIPS_TV = [
  "No ao vivo, aperte → duas vezes para abrir as opções do canal.",
  "Segure OK num canal ou filme para salvar na Minha Lista.",
  "Em Ajustes você esconde as categorias que não usa.",
];
const TIPS_TOUCH = [
  "Toque e segure um canal ou filme para salvar na Minha Lista.",
  "Em Ajustes você esconde as categorias que não usa.",
  "Em Listas salvas você troca de lista com um toque.",
];
/** Tempo mínimo em cada etapa, para o anel não "piscar" quando tudo já está salvo. */
export const WELCOME_STAGE_MS = 380;
const READY_MS = 520;
const FADE_MS = 420;

let shownThisLaunch = false;
export function shouldShowWelcomeBack(): boolean {
  return !shownThisLaunch;
}

export function welcomeGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Bom dia,";
  if (hour >= 12 && hour < 18) return "Boa tarde,";
  return "Boa noite,";
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const R = 72;
const C = 2 * Math.PI * R;
const VIEW = 165;

export function WelcomeBack({ server, tvMode }: { server: ServerProfile; tvMode: boolean }) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const portrait = height > width;
  const u = Math.max(0.82, Math.min(1.8, portrait ? width / 430 : Math.min(width / 960, height / 540)));
  const n = (value: number) => Math.round(value * u);
  const ring = n(VIEW);

  const progress = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const sat = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;
  const intro = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const tipFade = useRef(new Animated.Value(0)).current;
  const [stage, setStage] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const leaving = useRef(false);
  const tips = tvMode ? TIPS_TV : TIPS_TOUCH;
  const greeting = useMemo(() => welcomeGreeting(), []);

  useEffect(() => {
    shownThisLaunch = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)); };
    const loops = [
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true })),
      Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.timing(sat, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])),
    ];
    loops.forEach((loop) => loop.start());
    Animated.timing(intro, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

    const go = (href: "/(tabs)" | "/login") => {
      if (leaving.current) return;
      leaving.current = true;
      router.replace(href);
    };
    const toStage = (value: number) => {
      setStage(value);
      Animated.timing(progress, { toValue: FILLS[value], duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    };
    toStage(0);
    // Etapas reais do Android: a licença já validada pelo aviso de acesso
    // (bloqueada: o Início mostra o aviso) e o catálogo salvo neste aparelho.
    later(() => {
      if (useAppStore.getState().accessControl.isBlocked) { go("/(tabs)"); return; }
      toStage(1);
      later(() => {
        toStage(2);
        later(() => {
          const synced = Number(useAppStore.getState().preferences[catalogSyncedAtKey(server.id)] ?? 0) > 0;
          // Sem catálogo salvo, o Início baixa a lista com o próprio aviso de sincronização.
          if (!synced) { go("/(tabs)"); return; }
          toStage(3);
          later(() => {
            Animated.timing(fade, { toValue: 0, duration: FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => go("/(tabs)"));
          }, READY_MS);
        }, WELCOME_STAGE_MS);
      }, WELCOME_STAGE_MS);
    }, WELCOME_STAGE_MS);

    const showTip = () => {
      tipFade.setValue(0);
      Animated.sequence([
        Animated.timing(tipFade, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.delay(3000),
        Animated.timing(tipFade, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]).start();
    };
    showTip();
    const tipTimer = setInterval(() => { setTipIndex((i) => i + 1); showTip(); }, 4000);

    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      go("/login");
      return true;
    });
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(tipTimer);
      loops.forEach((loop) => loop.stop());
      back.remove();
    };
  }, [breath, fade, intro, orbit, progress, router, sat, server.id, spin, tipFade]);

  const name = server.name?.trim() || "Minha lista";
  const rotate = (value: Animated.Value, turns: string) => ({ transform: [{ rotate: value.interpolate({ inputRange: [0, 1], outputRange: ["0deg", turns] }) }] });
  const rise = { opacity: intro, transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [n(12), 0] }) }] };
  const layer = { position: "absolute" as const, left: 0, top: 0, width: ring, height: ring };

  return (
    <Animated.View style={[styles.screen, { opacity: fade }]} accessibilityLiveRegion="polite" accessibilityLabel={`${tr("Bem-vindo de volta")}. ${tr(LABELS[stage])}`}>
      <Image source={portrait ? BACKDROP_MOBILE : BACKDROP_TV} contentFit="cover" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.veil]} />
      <View style={[styles.center, { paddingHorizontal: n(24) }]}>
        <Animated.View style={[{ width: ring, height: ring }, { opacity: intro }]}>
          <Animated.View style={[styles.halo, { left: ring * 0.27, top: ring * 0.27, width: ring * 0.46, height: ring * 0.46, borderRadius: ring * 0.23, opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] }), transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.05] }) }] }]} />
          <Svg width={ring} height={ring} viewBox={`0 0 ${VIEW} ${VIEW}`} style={layer}>
            <Circle cx={VIEW / 2} cy={VIEW / 2} r={R} fill="none" stroke="#10213A" strokeWidth={1.5} />
            <AnimatedCircle
              cx={VIEW / 2} cy={VIEW / 2} r={R} fill="none" stroke="#00D7FF" strokeWidth={3} strokeLinecap="round"
              strokeDasharray={`${C} ${C}`}
              strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [C, 0] })}
              transform={`rotate(-90 ${VIEW / 2} ${VIEW / 2})`}
            />
          </Svg>
          <Animated.View style={[layer, rotate(orbit, "-360deg")]}>
            <Svg width={ring} height={ring} viewBox={`0 0 ${VIEW} ${VIEW}`}>
              <Circle cx={VIEW / 2} cy={VIEW / 2} r={63} fill="none" stroke="#1E3654" strokeWidth={1} strokeDasharray="1.5 7.5" strokeLinecap="round" />
            </Svg>
          </Animated.View>
          <Animated.View style={[layer, rotate(spin, "360deg")]}>
            <Svg width={ring} height={ring} viewBox={`0 0 ${VIEW} ${VIEW}`}>
              <Defs>
                <SvgGradient id="welcomeComet" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#00D7FF" stopOpacity={0} />
                  <Stop offset="1" stopColor="#7FEBFF" stopOpacity={1} />
                </SvgGradient>
              </Defs>
              <Path d={`M${VIEW / 2} ${VIEW / 2 - R} A${R} ${R} 0 0 1 ${VIEW / 2 + R} ${VIEW / 2}`} fill="none" stroke="url(#welcomeComet)" strokeWidth={3} strokeLinecap="round" />
              <Circle cx={VIEW / 2 + R} cy={VIEW / 2} r={3.5} fill="#E6FBFF" />
            </Svg>
          </Animated.View>
          <Animated.View style={[layer, rotate(sat, "360deg")]}>
            <Svg width={ring} height={ring} viewBox={`0 0 ${VIEW} ${VIEW}`}>
              <Circle cx={VIEW / 2} cy={VIEW / 2 - 63} r={2.2} fill="#2F6BFF" />
            </Svg>
          </Animated.View>
          <Animated.View style={{ position: "absolute", left: ring * 0.3, top: ring * 0.3, width: ring * 0.4, height: ring * 0.4, transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
            <Image source={MARK} contentFit="contain" style={StyleSheet.absoluteFill} accessibilityLabel="ELVANOQ Play" />
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.copy, rise]}>
          <AppText style={[styles.greeting, { fontSize: n(13.5), marginTop: n(21) }]}>{greeting}</AppText>
          <AppText style={[styles.title, { fontSize: n(45), lineHeight: n(50), marginTop: n(6) }]}>Bem-vindo de volta</AppText>
          <View style={[styles.chip, { marginTop: n(16), paddingVertical: n(6), paddingLeft: n(6), paddingRight: n(14), borderRadius: n(20), gap: n(9) }]}>
            <View style={[styles.initial, { width: n(27), height: n(27), borderRadius: n(14) }]}>
              <AppText style={[styles.initialText, { fontSize: n(13) }]}>{name.charAt(0).toUpperCase()}</AppText>
            </View>
            <AppText numberOfLines={1} style={[styles.listName, { fontSize: n(13.5), maxWidth: n(portrait ? 170 : 320) }]}>{name}</AppText>
            <View style={[styles.dot, { width: n(3), height: n(3), borderRadius: n(2) }]} />
            <AppText style={[styles.licensed, { fontSize: n(12) }]}>{tvMode ? "TV licenciada" : "Licença ativa"}</AppText>
          </View>
          <AppText style={[styles.status, { fontSize: n(14), marginTop: n(25) }]}>{LABELS[stage]}</AppText>
          <View style={[styles.steps, { marginTop: n(14), gap: n(7) }]}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{ height: n(4.5), borderRadius: n(3), width: i === stage ? n(25) : n(4.5), backgroundColor: i < stage || stage === 3 ? "#00D7FF" : i === stage ? "#7FEBFF" : "#24344D" }}
              />
            ))}
          </View>
        </Animated.View>
      </View>
      <Animated.View style={[styles.tipRow, { bottom: n(22), paddingHorizontal: n(24), opacity: tipFade }]}>
        <AppText style={[styles.tip, { fontSize: n(12) }]}>
          <AppText style={[styles.tipLead, { fontSize: n(12) }]}>Dica · </AppText>
          {tips[tipIndex % tips.length]}
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#070B14" },
  veil: { backgroundColor: "rgba(4,8,15,0.55)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", backgroundColor: "rgba(0,215,255,0.16)" },
  copy: { alignItems: "center" },
  greeting: { fontFamily: "Inter_600SemiBold", color: "#00D7FF", letterSpacing: 0.3, textAlign: "center" },
  title: { fontFamily: "Inter_700Bold", color: "#F4F8FF", letterSpacing: -0.8, textAlign: "center" },
  chip: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(11,26,46,0.8)", borderWidth: 1, borderColor: "#1E3654" },
  initial: { alignItems: "center", justifyContent: "center", backgroundColor: "#00D7FF" },
  initialText: { fontFamily: "Inter_700Bold", color: "#04080F" },
  listName: { fontFamily: "Inter_600SemiBold", color: "#F4F8FF" },
  dot: { backgroundColor: "#4A5A73" },
  licensed: { color: "#9AA6BD" },
  status: { fontFamily: "Inter_500Medium", color: "#DCE6F5", textAlign: "center" },
  steps: { flexDirection: "row", alignItems: "center" },
  tipRow: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  tip: { color: "#9AA6BD", textAlign: "center" },
  tipLead: { fontFamily: "Inter_600SemiBold", color: "#F4F8FF" },
});
