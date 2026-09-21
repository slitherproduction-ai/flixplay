import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Animated, Linking, ScrollView, StyleSheet, View } from "react-native";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText, GlassCard, IconButton, ScreenState } from "@/components/ui";
import { APP_INFO } from "@/constants/app";
import { Colors, Radii, Shadows, Type } from "@/constants/theme";
import { useScreenLoad } from "@/hooks/useScreenLoad";
import { useTVMode } from "@/hooks/use-tv-mode";

type ChangeTag = "Novidade" | "Melhoria" | "Correção";

type ChangeItem = {
  tag: ChangeTag;
  text: string;
};

type VersionEntry = {
  version: string;
  label?: string;
  date: string;
  changes: ChangeItem[];
};

const CHANGELOG: VersionEntry[] = [
  {
    version: "v2.5.0",
    label: "Versão Atual",
    date: "2026.1",
    changes: [
      { tag: "Novidade", text: "Suporte a Picture-in-Picture (PiP) e Espelhamento de Tela (Cast/AirPlay/DLNA)." },
      { tag: "Novidade", text: "Controle avançado de Buffering para Canais ao Vivo: Baixa Latência, Normal e Estável." },
      { tag: "Novidade", text: "Guia Eletrônico de Programação (EPG) completo integrado no player ao vivo." },
      { tag: "Melhoria", text: "Controles de proporção de tela reais: 16:9, 4:3, Zoom, Esticar e Original." },
      { tag: "Melhoria", text: "Seletor avançado de faixas de áudio e legendas com renderização sobre o vídeo." },
      { tag: "Melhoria", text: "Controle de velocidade de reprodução de 0.5x até 2.0x com correção de pitch." },
      { tag: "Melhoria", text: "Novo ícone moderno e Splash Screen refinado." },
    ],
  },
  {
    version: "v2.4.0",
    date: "2025.1",
    changes: [
      { tag: "Novidade", text: "Novo design Dark Glassmorphism refinado, inspirado no Apple tvOS." },
      { tag: "Novidade", text: "Suporte a Quick Zapping direto no player sem interrupção de fluxo." },
      { tag: "Melhoria", text: "Guia de Programação Eletrônico (EPG) ao vivo com barra de progresso em tempo real." },
      { tag: "Melhoria", text: "Sincronização e scrobble de progresso com Trakt.tv." },
      { tag: "Correção", text: "Otimização de reconexão automática e buffer para streams lentos." },
    ],
  },
  {
    version: "v2.3.0",
    date: "2024.4",
    changes: [
      { tag: "Novidade", text: "Gerenciador de múltiplos servidores Xtream Codes e listas M3U." },
      { tag: "Novidade", text: "Seletor de faixas de áudio e legendas personalizáveis no player." },
      { tag: "Melhoria", text: "Retomada inteligente do minuto exato de filmes e séries." },
    ],
  },
  {
    version: "v2.2.0",
    date: "2024.2",
    changes: [
      { tag: "Novidade", text: "Grade VOD avançada para séries com separação por temporadas e episódios." },
      { tag: "Melhoria", text: "Compatibilidade aprimorada para navegação via controle remoto (Android TV)." },
    ],
  },
  {
    version: "v2.1.0",
    date: "2023.4",
    changes: [
      { tag: "Novidade", text: "Busca universal em tempo real por canais, filmes, séries e atores." },
      { tag: "Melhoria", text: "Favoritos persistidos instantaneamente com armazenamento local Zustand." },
    ],
  },
  {
    version: "v2.0.0",
    date: "2023.1",
    changes: [
      { tag: "Novidade", text: "Lançamento da nova arquitetura de reprodução e suporte completo à API Xtream Codes." },
    ],
  },
  {
    version: "v1.0.0",
    date: "2022.3",
    changes: [
      { tag: "Novidade", text: "Versão inicial do reprodutor IPTV com suporte a M3U e streams HLS." },
    ],
  },
];

const TAG_COLORS: Record<ChangeTag, { backgroundColor: string; color: string }> = {
  Novidade: { backgroundColor: "rgba(59,130,246,0.16)", color: Colors.blueBright },
  Melhoria: { backgroundColor: "rgba(16,185,129,0.15)", color: "#5EEAD4" },
  Correção: { backgroundColor: "rgba(245,158,11,0.15)", color: "#FBBF24" },
};

export default function AboutScreen() {
  const router = useRouter();
  const { loading, error: loadError, retry } = useScreenLoad("informações do aplicativo");
  const tvMode = useTVMode();
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkState, setCheckState] = useState<"idle" | "checking" | "success">("idle");
  const [toastOpacity] = useState(() => new Animated.Value(0));
  const [toastOffset] = useState(() => new Animated.Value(-12));

  useEffect(() => {
    if (checkState !== "success") return;

    toastOpacity.setValue(0);
    toastOffset.setValue(-12);
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.timing(toastOffset, { toValue: 0, duration: 220, useNativeDriver: false }),
    ]).start();

    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 0, duration: 180, useNativeDriver: false }),
        Animated.timing(toastOffset, { toValue: -12, duration: 180, useNativeDriver: false }),
      ]).start(({ finished }) => {
        if (finished) setCheckState("idle");
      });
    }, 3600);

    return () => clearTimeout(timeout);
  }, [checkState, toastOffset, toastOpacity]);

  const handleCheckUpdates = useCallback(async () => {
    setActionError(null);
    setCheckState("checking");
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 650));
      setCheckState("success");
    } catch (checkError) {
      console.error("Falha ao verificar atualizações", checkError);
      setActionError("Não foi possível verificar atualizações. Tente novamente.");
      setCheckState("idle");
    }
  }, []);

  const openExternalLink = useCallback(async (url: string, destination: string) => {
    setActionError(null);
    try {
      await Linking.openURL(url);
    } catch (linkError) {
      console.error(`Falha ao abrir ${destination}`, linkError);
      setActionError(`Não foi possível abrir ${destination}. Verifique sua conexão e tente novamente.`);
    }
  }, []);

  const handleSupport = useCallback(() => {
    void openExternalLink("mailto:suporte@flixplay.app", "o suporte");
  }, [openExternalLink]);

  const handleTerms = useCallback(() => {
    void openExternalLink("https://flixplay.app/termos", "os termos de uso");
  }, [openExternalLink]);

  const handleLicenses = useCallback(() => {
    void openExternalLink("https://flixplay.app/licencas", "as licenças");
  }, [openExternalLink]);

  const handleCommunity = useCallback(() => {
    void openExternalLink("https://discord.gg/flixplay", "a comunidade Discord");
  }, [openExternalLink]);

  return (
    <View style={styles.screen}>
      <View style={styles.ambientTop} />
      <View style={styles.ambientBottom} />
      <ScreenState loading={loading} error={loadError} retry={retry}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, tvMode && styles.tvContent]}>
          <View style={styles.header}>
            <IconButton icon="close" label="Fechar informações do aplicativo" onPress={() => router.back()} />
            <View style={styles.headerCopy}>
              <AppText style={styles.kicker}>SOBRE O APLICATIVO</AppText>
              <AppText style={styles.headerTitle}>FlixPlay</AppText>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={styles.appIcon}>
              <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.appIconRing} />
              <View style={styles.appIconCore}><Ionicons name="play" size={27} color={Colors.white} /></View>
            </View>
            <AppText style={styles.heroName}>{APP_INFO.name}</AppText>
            <AppText style={styles.heroVersion}>{APP_INFO.versionLabel}</AppText>
            <View style={styles.stableBadge}><View style={styles.stableDot} /><AppText style={styles.stableText}>Versão estável e atualizada</AppText></View>
            <AppText style={styles.heroSummary}>Sua central de entretenimento para assistir ao vivo, explorar catálogos e continuar cada história no ponto certo.</AppText>
            <View style={styles.techRow}>
              <TechBadge label="ExoPlayer / HLS" />
              <TechBadge label="Xtream Codes API" />
              <TechBadge label="EPG" />
              <TechBadge label="Trakt.tv" />
              <TechBadge label="PiP & Cast" />
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <AppText style={Type.section}>O que move o FlixPlay</AppText>
            <AppText style={styles.sectionSubtitle}>Tecnologias pensadas para uma reprodução fluida</AppText>
          </View>
          <GlassCard style={styles.technologyCard} intensity={18}>
            <TechnologyRow icon="play-circle-outline" title="Motor de Reprodução" body="ExoPlayer com suporte a streams HLS adaptativos." />
            <View style={styles.cardDivider} />
            <TechnologyRow icon="server-outline" title="Suas fontes, do seu jeito" body="Xtream Codes, playlists M3U e múltiplos servidores." />
            <View style={styles.cardDivider} />
            <TechnologyRow icon="calendar-outline" title="Contexto em tempo real" body="EPG ao vivo e Trakt.tv para acompanhar seu progresso." />
          </GlassCard>

          <View style={styles.changelogHeader}>
            <View style={styles.sectionHeading}>
              <AppText style={Type.section}>Histórico de versões</AppText>
              <AppText style={styles.sectionSubtitle}>Tudo o que evoluiu até aqui</AppText>
            </View>
            <View style={styles.releaseCount}><AppText style={styles.releaseCountText}>{CHANGELOG.length} releases</AppText></View>
          </View>

          <View style={styles.changelogList}>
            {CHANGELOG.map((release, index) => <VersionCard key={release.version} release={release} isLast={index === CHANGELOG.length - 1} />)}
          </View>

          <View style={styles.checkArea}>
            {checkState === "success" ? (
              <Animated.View style={[styles.successToast, { opacity: toastOpacity, transform: [{ translateY: toastOffset }] }]}>
                <Ionicons name="checkmark-circle" size={19} color={Colors.green} />
                <View style={styles.successCopy}><AppText style={styles.successTitle}>Você está em dia</AppText><AppText style={styles.successBody}>O FlixPlay já está na versão mais recente.</AppText></View>
              </Animated.View>
            ) : null}
            {actionError ? <View style={styles.actionError}><Ionicons name="alert-circle-outline" size={18} color={Colors.red} /><AppText style={styles.actionErrorText}>{actionError}</AppText></View> : null}
            <TVFocusable accessibilityRole="button" hasTVPreferredFocus disabled={checkState === "checking"} onPress={handleCheckUpdates} style={({ pressed }) => [styles.checkButton, pressed && styles.pressed, checkState === "checking" && styles.disabled]}>
              {checkState === "checking" ? <ActivityIndicator color={Colors.white} /> : <Ionicons name="refresh-outline" size={17} color={Colors.white} />}
              <AppText style={styles.checkButtonText}>{checkState === "checking" ? "Verificando..." : "Verificar Atualizações"}</AppText>
            </TVFocusable>
          </View>

          <View style={styles.sectionHeading}>
            <AppText style={Type.section}>Ajuda e transparência</AppText>
            <AppText style={styles.sectionSubtitle}>Estamos por perto quando você precisar</AppText>
          </View>
          <GlassCard style={styles.linksCard} intensity={16}>
            <AboutLink icon="chatbubble-ellipses-outline" title="Falar com o suporte" body="Envie uma mensagem para nossa equipe" onPress={handleSupport} />
            <View style={styles.cardDivider} />
            <AboutLink icon="people-outline" title="Comunidade FlixPlay" body="Participe das conversas no Discord" onPress={handleCommunity} />
            <View style={styles.cardDivider} />
            <AboutLink icon="document-text-outline" title="Termos de uso" body="Leia como o serviço funciona" onPress={handleTerms} />
            <View style={styles.cardDivider} />
            <AboutLink icon="code-slash-outline" title="Licenças de código aberto" body="Tecnologias que tornam o app possível" onPress={handleLicenses} />
          </GlassCard>

          <AppText style={styles.footer}>FlixPlay · Feito para sua sala</AppText>
        </ScrollView>
      </ScreenState>
    </View>
  );
}

function TechBadge({ label }: { label: string }) {
  return <View style={styles.techBadge}><AppText style={styles.techBadgeText}>{label}</AppText></View>;
}

function TechnologyRow({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return <View style={styles.technologyRow}><View style={styles.technologyIcon}><Ionicons name={icon} size={19} color={Colors.blueBright} /></View><View style={styles.technologyCopy}><AppText style={styles.technologyTitle}>{title}</AppText><AppText style={styles.technologyBody}>{body}</AppText></View></View>;
}

function VersionCard({ release, isLast }: { release: VersionEntry; isLast: boolean }) {
  return (
    <View style={styles.versionRow}>
      <View style={styles.timeline}>
        <View style={[styles.timelineDot, release.label && styles.timelineDotCurrent]} />
        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={[styles.versionCard, release.label && styles.currentVersionCard]}>
        <View style={styles.versionHeader}>
          <View style={styles.versionCopy}><View style={styles.versionTitleRow}><AppText style={styles.versionTitle}>{release.version}</AppText>{release.label ? <View style={styles.currentBadge}><AppText style={styles.currentBadgeText}>{release.label}</AppText></View> : null}</View><AppText style={styles.versionDate}>{release.date}</AppText></View>
          {release.label ? <Ionicons name="sparkles-outline" size={18} color={Colors.blueBright} /> : <Ionicons name="chevron-down" size={16} color={Colors.subtle} />}
        </View>
        <View style={styles.changeList}>{release.changes.map((change) => <View key={`${release.version}-${change.tag}-${change.text}`} style={styles.changeItem}><View style={[styles.changeTag, { backgroundColor: TAG_COLORS[change.tag].backgroundColor }]}><AppText style={[styles.changeTagText, { color: TAG_COLORS[change.tag].color }]}>{change.tag}</AppText></View><AppText style={styles.changeText}>{change.text}</AppText></View>)}</View>
      </View>
    </View>
  );
}

function AboutLink({ icon, title, body, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; onPress: () => void }) {
  return <TVFocusable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.aboutLink, pressed && styles.pressed]}><View style={styles.aboutLinkIcon}><Ionicons name={icon} size={18} color={Colors.blueBright} /></View><View style={styles.aboutLinkCopy}><AppText style={styles.aboutLinkTitle}>{title}</AppText><AppText style={styles.aboutLinkBody}>{body}</AppText></View><Ionicons name="arrow-up-outline" size={17} color={Colors.subtle} /></TVFocusable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  ambientTop: { position: "absolute", top: -150, right: -105, width: 310, height: 310, borderRadius: 155, backgroundColor: "rgba(59,130,246,0.1)" },
  ambientBottom: { position: "absolute", bottom: 120, left: -180, width: 340, height: 340, borderRadius: 170, backgroundColor: "rgba(229,9,20,0.045)" },
  content: { gap: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 42 },
  tvContent: { gap: 28, paddingHorizontal: 46, paddingTop: 30, paddingBottom: 58 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  headerCopy: { flex: 1, alignItems: "center", gap: 3 },
  headerSpacer: { width: 42 },
  kicker: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 1, color: Colors.blueBright },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text },
  heroCard: { overflow: "hidden", alignItems: "center", padding: 24, borderRadius: Radii.large, borderWidth: 1, borderColor: "rgba(96,165,250,0.28)", backgroundColor: "rgba(22,28,45,0.76)", ...Shadows.card },
  heroGlow: { position: "absolute", top: -80, width: 230, height: 180, borderRadius: 120, backgroundColor: "rgba(59,130,246,0.12)" },
  appIcon: { width: 82, height: 82, overflow: "hidden", alignItems: "center", justifyContent: "center", borderRadius: 25, borderWidth: 1, borderColor: "rgba(255,255,255,0.28)", backgroundColor: "rgba(96,165,250,0.16)", ...Shadows.card },
  appIconRing: { position: "absolute", width: 55, height: 55, borderRadius: 28, borderWidth: 1, borderColor: "rgba(147,197,253,0.48)" },
  appIconCore: { width: 43, height: 43, alignItems: "center", justifyContent: "center", paddingLeft: 3, borderRadius: 15, backgroundColor: "rgba(59,130,246,0.72)" },
  heroName: { marginTop: 14, ...Type.display },
  heroVersion: { marginTop: 4, fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.blueBright },
  stableBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radii.pill, backgroundColor: "rgba(16,185,129,0.13)" },
  stableDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },
  stableText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#6EE7B7" },
  heroSummary: { maxWidth: 320, marginTop: 15, textAlign: "center", fontSize: 13, lineHeight: 20, color: Colors.muted },
  techRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 18 },
  techBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: "rgba(255,255,255,0.06)" },
  techBadgeText: { fontFamily: "Inter_500Medium", fontSize: 10, color: Colors.muted },
  sectionHeading: { gap: 3 },
  sectionSubtitle: { fontSize: 12, color: Colors.subtle },
  technologyCard: { paddingHorizontal: 14 },
  technologyRow: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 11 },
  technologyIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "rgba(59,130,246,0.12)" },
  technologyCopy: { flex: 1, gap: 3 },
  technologyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  technologyBody: { fontSize: 11, lineHeight: 17, color: Colors.muted },
  cardDivider: { height: 1, backgroundColor: Colors.border },
  changelogHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
  releaseCount: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radii.pill, backgroundColor: "rgba(255,255,255,0.07)" },
  releaseCountText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.muted },
  changelogList: { gap: 0 },
  versionRow: { flexDirection: "row", gap: 11 },
  timeline: { width: 14, alignItems: "center" },
  timelineDot: { zIndex: 1, width: 9, height: 9, marginTop: 18, borderRadius: 5, borderWidth: 2, borderColor: Colors.subtle, backgroundColor: Colors.background },
  timelineDotCurrent: { width: 11, height: 11, marginTop: 17, borderWidth: 3, borderColor: Colors.blueBright, backgroundColor: Colors.background },
  timelineLine: { position: "absolute", top: 27, bottom: -1, width: 1, backgroundColor: Colors.border },
  versionCard: { flex: 1, marginBottom: 12, padding: 14, borderRadius: Radii.medium, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  currentVersionCard: { borderColor: "rgba(96,165,250,0.4)", backgroundColor: "rgba(59,130,246,0.1)" },
  versionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  versionCopy: { flex: 1, gap: 4 },
  versionTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
  versionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text },
  versionDate: { fontSize: 10, color: Colors.subtle },
  currentBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(96,165,250,0.18)" },
  currentBadgeText: { fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.45, color: Colors.blueBright },
  changeList: { gap: 10, marginTop: 14 },
  changeItem: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  changeTag: { minWidth: 65, alignItems: "center", paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
  changeTagText: { fontFamily: "Inter_600SemiBold", fontSize: 9 },
  changeText: { flex: 1, fontSize: 11, lineHeight: 17, color: Colors.muted },
  checkArea: { gap: 10 },
  successToast: { flexDirection: "row", alignItems: "center", gap: 9, padding: 12, borderRadius: Radii.medium, borderWidth: 1, borderColor: "rgba(16,185,129,0.3)", backgroundColor: "rgba(16,185,129,0.11)" },
  successCopy: { flex: 1, gap: 2 },
  successTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#A7F3D0" },
  successBody: { fontSize: 11, color: Colors.muted },
  actionError: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, backgroundColor: "rgba(229,9,20,0.12)" },
  actionErrorText: { flex: 1, fontSize: 12, lineHeight: 17, color: "#FF8B91" },
  checkButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: Radii.pill, backgroundColor: Colors.blue, ...Shadows.card },
  checkButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.white },
  linksCard: { paddingHorizontal: 14 },
  aboutLink: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 11 },
  aboutLinkIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "rgba(59,130,246,0.11)" },
  aboutLinkCopy: { flex: 1, gap: 3 },
  aboutLinkTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  aboutLinkBody: { fontSize: 11, color: Colors.muted },
  footer: { alignSelf: "center", fontSize: 10, color: Colors.subtle },
  pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.55 },
});
