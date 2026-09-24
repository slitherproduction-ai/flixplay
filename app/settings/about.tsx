import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText, GlassCard, IconButton, ScreenState } from "@/components/ui";
import { APP_INFO } from "@/constants/app";
import { Colors, Radii, Shadows, Type } from "@/constants/theme";
import { useAppStore } from "@/store/useAppStore";
import { useScreenLoad } from "@/hooks/useScreenLoad";
import { useTVMode } from "@/hooks/use-tv-mode";
import {
  checkForGitHubUpdate,
  downloadAndInstallUpdate,
  type UpdateCheckResult,
} from "@/services/githubUpdater";

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
    version: "v2.10.1",
    label: "Versão Atual",
    date: "2026.09",
    changes: [
      { tag: "Correção", text: "Aviso de saída responsivo e totalmente visível em smartphones." },
      { tag: "Melhoria", text: "EPG pré-carregado na Home e nos canais visíveis, antes da reprodução." },
      { tag: "Melhoria", text: "Informações de servidor e validade removidas da tela inicial." },
      { tag: "Melhoria", text: "Recursos visuais antigos e arquivos de desenvolvimento sem uso foram removidos." },
    ],
  },
  {
    version: "v2.10.0",
    date: "2026.09",
    changes: [
      { tag: "Melhoria", text: "Home para TV redimensionada para exibir de cinco a sete títulos por linha." },
      { tag: "Melhoria", text: "Navegação D-Pad com foco ampliado, carrosséis virtualizados e rolagem fluida." },
      { tag: "Correção", text: "OSD do player agora desaparece após quatro segundos com transição suave." },
      { tag: "Correção", text: "EPG, Zapping Rápido, Cast e controles agora são mutuamente exclusivos." },
      { tag: "Melhoria", text: "Botão Voltar fecha a camada ativa antes de solicitar a saída do conteúdo." },
    ],
  },
  {
    version: "v2.9.0",
    date: "2026.09",
    changes: [
      { tag: "Novidade", text: "Zapping rápido com escolha da grade/categoria de canais ao vivo." },
      { tag: "Melhoria", text: "Picture-in-Picture migrado para a implementação nativa do Android e smartphones." },
      { tag: "Melhoria", text: "EPG real com programa atual e próximo exibidos durante a reprodução." },
      { tag: "Correção", text: "Progresso real e retomada automática para filmes e episódios em Continuar Assistindo." },
    ],
  },
];

const TAG_COLORS: Record<ChangeTag, { backgroundColor: string; color: string }> = {
  Novidade: { backgroundColor: "rgba(59,130,246,0.16)", color: Colors.blueBright },
  Melhoria: { backgroundColor: "rgba(16,185,129,0.15)", color: "#5EEAD4" },
  Correção: { backgroundColor: "rgba(245,158,11,0.15)", color: "#FBBF24" },
};

// ─── Success toast hook ───────────────────────────────────────────────────────
// Encapsulates the two-phase fade-in / fade-out animation so the main
// component stays under the cognitive-complexity budget.

type ToastState = "idle" | "checking" | "done";

function useSuccessToast(checkState: ToastState, onDismiss: () => void) {
  const [toastOpacity] = useState(() => new Animated.Value(0));
  const [toastOffset] = useState(() => new Animated.Value(-12));
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; }, [onDismiss]);

  useEffect(() => {
    if (checkState !== "done") return;

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
        if (finished) onDismissRef.current();
      });
    }, 3600);

    return () => clearTimeout(timeout);
  }, [checkState, toastOffset, toastOpacity]);

  return { toastOpacity, toastOffset };
}

function formatPublishedAt(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ─── Update Modal helpers (module-level keeps complexity out of the component)

async function runInstallUpdate(
  apkUrl: string,
  releaseUrl: string | null | undefined,
  onError: (msg: string) => void,
): Promise<void> {
  try {
    await downloadAndInstallUpdate(apkUrl, releaseUrl);
  } catch (err) {
    console.error("[UpdateModal] install error", err);
    onError(err instanceof Error ? err.message : "Falha ao iniciar a instalação.");
  }
}

async function openReleaseUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch (e) {
    console.error("[UpdateModal] open release url failed", e);
  }
}

// Pre-compute header values at module level to keep component JSX flat.
type ModalHeader = {
  iconName: "arrow-up-circle" | "checkmark-circle";
  iconColor: string;
  title: string;
  subtitle: string;
};

function buildModalHeader(result: UpdateCheckResult): ModalHeader {
  if (result.hasUpdate) {
    return {
      iconName: "arrow-up-circle",
      iconColor: Colors.blueBright,
      title: `Nova versão: ${result.latestVersion ?? ""}`,
      subtitle: `Versão atual: ${result.currentVersion}`,
    };
  }
  return {
    iconName: "checkmark-circle",
    iconColor: Colors.green,
    title: "Você está atualizado",
    subtitle: `${APP_INFO.name} ${result.currentVersion} é a versão mais recente`,
  };
}

// Sub-component isolates the install-button JSX complexity.
function InstallButton({
  result,
  installing,
  onPress,
}: {
  result: UpdateCheckResult;
  installing: boolean;
  onPress: () => void;
}) {
  if (!result.hasUpdate || !(result.apkUrl ?? result.releaseUrl)) return null;
  return (
    <TVFocusable
      onPress={onPress}
      disabled={installing}
      style={[modalStyles.installBtn, installing && { opacity: 0.55 }]}
      accessibilityLabel="Baixar e instalar atualização"
    >
      {installing
        ? <ActivityIndicator size="small" color={Colors.white} />
        : <Ionicons name="download-outline" size={18} color={Colors.white} />}
      <AppText style={modalStyles.installText}>
        {installing ? "Abrindo download..." : "Baixar e Instalar"}
      </AppText>
    </TVFocusable>
  );
}

// ─── Update Modal ─────────────────────────────────────────────────────────────

function UpdateModal({
  result,
  visible,
  onClose,
}: {
  result: UpdateCheckResult | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  const handleInstall = useCallback(async () => {
    setInstallError(null);
    setInstalling(true);
    await runInstallUpdate(
      result?.apkUrl ?? result?.releaseUrl ?? "",
      result?.releaseUrl,
      setInstallError,
    );
    setInstalling(false);
  }, [result]);

  const handleOpenRelease = useCallback(() => {
    void openReleaseUrl(result?.releaseUrl ?? "");
  }, [result]);

  if (!result) return null;

  const header = buildModalHeader(result);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.sheet}>
          {/* Header — values pre-computed to keep JSX ternary-free */}
          <View style={modalStyles.header}>
            <View style={modalStyles.headerIcon}>
              <Ionicons name={header.iconName} size={28} color={header.iconColor} />
            </View>
            <View style={modalStyles.headerCopy}>
              <AppText style={modalStyles.headerTitle}>{header.title}</AppText>
              <AppText style={modalStyles.headerSub}>{header.subtitle}</AppText>
            </View>
            <TVFocusable onPress={onClose} style={modalStyles.closeBtn} accessibilityLabel="Fechar">
              <Ionicons name="close" size={20} color={Colors.muted} />
            </TVFocusable>
          </View>

          {/* Release meta */}
          {result.latestVersion ? (
            <View style={modalStyles.metaRow}>
              <View style={modalStyles.metaItem}>
                <Ionicons name="git-branch-outline" size={14} color={Colors.blueBright} />
                <AppText style={modalStyles.metaText}>{result.releaseName ?? result.latestVersion}</AppText>
              </View>
              {result.publishedAt && (
                <View style={modalStyles.metaItem}>
                  <Ionicons name="calendar-outline" size={14} color={Colors.subtle} />
                  <AppText style={modalStyles.metaTextSub}>{formatPublishedAt(result.publishedAt)}</AppText>
                </View>
              )}
            </View>
          ) : null}

          {/* Release notes */}
          {result.releaseNotes ? (
            <ScrollView
              style={modalStyles.notesScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={modalStyles.notesContent}
            >
              <AppText style={modalStyles.notesTitle}>Notas da versão</AppText>
              <AppText style={modalStyles.notesBody}>{result.releaseNotes}</AppText>
            </ScrollView>
          ) : null}

          {/* Error */}
          {installError ? (
            <View style={modalStyles.errorRow}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.red} />
              <AppText style={modalStyles.errorText}>{installError}</AppText>
            </View>
          ) : null}

          {/* Actions */}
          <View style={modalStyles.actions}>
            <InstallButton result={result} installing={installing} onPress={handleInstall} />
            {result.releaseUrl ? (
              <TVFocusable
                onPress={handleOpenRelease}
                style={modalStyles.releaseBtn}
                accessibilityLabel="Ver release no GitHub"
              >
                <Ionicons name="logo-github" size={17} color={Colors.text} />
                <AppText style={modalStyles.releaseBtnText}>Ver no GitHub</AppText>
              </TVFocusable>
            ) : null}
            <TVFocusable onPress={onClose} style={modalStyles.cancelBtn} accessibilityLabel="Fechar">
              <AppText style={modalStyles.cancelText}>Fechar</AppText>
            </TVFocusable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AboutScreen() {
  const router = useRouter();
  const { loading, error: loadError, retry } = useScreenLoad("informações do aplicativo");
  const tvMode = useTVMode();
  const autoUpdate = useAppStore((state) => state.preferences["autoUpdate"]);
  const setPreference = useAppStore((state) => state.setPreference);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkState, setCheckState] = useState<ToastState>("idle");
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleDismissToast = useCallback(() => setCheckState("idle"), []);
  const { toastOpacity, toastOffset } = useSuccessToast(checkState, handleDismissToast);

  const handleCheckUpdates = useCallback(async () => {
    setActionError(null);
    setCheckState("checking");
    try {
      const result = await checkForGitHubUpdate();
      setUpdateResult(result);
      setCheckState("done");

      if (result.error) {
        setActionError(result.error);
        setCheckState("idle");
        return;
      }

      // Open modal to show result (with or without update)
      setModalVisible(true);
    } catch (err) {
      console.error("Falha ao verificar atualizações", err);
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

  const handleGitHub = useCallback(() => {
    void openExternalLink(
      `https://github.com/${APP_INFO.githubRepo}`,
      "o repositório GitHub",
    );
  }, [openExternalLink]);

  const handleCloseModal = useCallback(() => setModalVisible(false), []);

  return (
    <View style={styles.screen}>
      <View style={styles.ambientTop} />
      <View style={styles.ambientBottom} />
      <ScreenState loading={loading} error={loadError} retry={retry}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, tvMode && styles.tvContent]}
        >
          {/* Header */}
          <View style={styles.header}>
            <IconButton icon="close" label="Fechar" onPress={() => router.back()} />
            <View style={styles.headerCopy}>
              <AppText style={styles.kicker}>SOBRE O APLICATIVO</AppText>
              <AppText style={styles.headerTitle}>FlixPlay</AppText>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          {/* Hero card */}
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={styles.appIcon}>
              <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.appIconRing} />
              <View style={styles.appIconCore}>
                <Ionicons name="play" size={27} color={Colors.white} />
              </View>
            </View>
            <AppText style={styles.heroName}>{APP_INFO.name}</AppText>
            <AppText style={styles.heroVersion}>{APP_INFO.versionLabel}</AppText>
            <View style={styles.stableBadge}>
              <View style={styles.stableDot} />
              <AppText style={styles.stableText}>Versão estável e atualizada</AppText>
            </View>
            <AppText style={styles.heroSummary}>
              Sua central de entretenimento para assistir ao vivo, explorar catálogos e continuar cada história no ponto certo.
            </AppText>
            <View style={styles.techRow}>
              <TechBadge label="ExoPlayer / HLS" />
              <TechBadge label="Xtream Codes API" />
              <TechBadge label="EPG" />
              <TechBadge label="Trakt.tv" />
              <TechBadge label="PiP & Cast" />
            </View>
          </View>

          {/* GitHub integration status card */}
          <GlassCard style={styles.githubCard} intensity={18}>
            <View style={styles.githubRow}>
              <View style={styles.githubIconWrap}>
                <Ionicons name="logo-github" size={20} color={Colors.text} />
              </View>
              <View style={styles.githubCopy}>
                <View style={styles.githubTitleRow}>
                  <AppText style={styles.githubTitle}>Auto-Update GitHub Integrado</AppText>
                  <View style={styles.githubActiveBadge}>
                    <View style={styles.githubActiveDot} />
                    <AppText style={styles.githubActiveText}>ATIVO</AppText>
                  </View>
                </View>
                <AppText style={styles.githubRepo}>{APP_INFO.githubRepo}</AppText>
                <AppText style={styles.githubEndpoint} numberOfLines={1}>
                  api.github.com/repos/{APP_INFO.githubRepo}/releases/latest
                </AppText>
              </View>
              <TVFocusable
                onPress={handleGitHub}
                style={styles.githubOpenBtn}
                accessibilityLabel="Abrir repositório no GitHub"
              >
                <Ionicons name="open-outline" size={16} color={Colors.blueBright} />
              </TVFocusable>
            </View>
          </GlassCard>

          {/* Technology card */}
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
            <View style={styles.cardDivider} />
            <TechnologyRow icon="logo-github" title="Atualizações automáticas" body={`GitHub Releases · ${APP_INFO.githubRepo}`} />
          </GlassCard>

          {/* Changelog */}
          <View style={styles.changelogHeader}>
            <View style={styles.sectionHeading}>
              <AppText style={Type.section}>Histórico de versões</AppText>
              <AppText style={styles.sectionSubtitle}>Tudo o que evoluiu até aqui</AppText>
            </View>
            <View style={styles.releaseCount}>
              <AppText style={styles.releaseCountText}>{CHANGELOG.length} releases</AppText>
            </View>
          </View>

          <View style={styles.changelogList}>
            {CHANGELOG.map((release, index) => (
              <VersionCard
                key={release.version}
                release={release}
                isLast={index === CHANGELOG.length - 1}
              />
            ))}
          </View>

          {/* Update check area */}
          <View style={styles.checkArea}>
            {checkState === "done" && updateResult && !updateResult.hasUpdate ? (
              <Animated.View
                style={[
                  styles.successToast,
                  { opacity: toastOpacity, transform: [{ translateY: toastOffset }] },
                ]}
              >
                <Ionicons name="checkmark-circle" size={19} color={Colors.green} />
                <View style={styles.successCopy}>
                  <AppText style={styles.successTitle}>Você está em dia!</AppText>
                  <AppText style={styles.successBody}>
                    O FlixPlay {APP_INFO.versionLabel} é a versão mais recente.
                  </AppText>
                </View>
              </Animated.View>
            ) : null}

            {actionError ? (
              <View style={styles.actionError}>
                <Ionicons name="alert-circle-outline" size={18} color={Colors.red} />
                <AppText style={styles.actionErrorText}>{actionError}</AppText>
              </View>
            ) : null}

            <TVFocusable
              accessibilityRole="button"
              hasTVPreferredFocus
              disabled={checkState === "checking"}
              onPress={handleCheckUpdates}
              style={({ pressed }) => [
                styles.checkButton,
                pressed && styles.pressed,
                checkState === "checking" && styles.disabled,
              ]}
            >
              {checkState === "checking" ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Ionicons name="refresh-outline" size={17} color={Colors.white} />
              )}
              <AppText style={styles.checkButtonText}>
                {checkState === "checking" ? "Verificando..." : "Verificar Atualizações Agora"}
              </AppText>
            </TVFocusable>

            <View style={styles.autoUpdateRow}>
              <View style={styles.autoUpdateCopy}>
                <AppText style={styles.autoUpdateTitle}>Verificação Automática ao Iniciar</AppText>
                <AppText style={styles.autoUpdateBody}>
                  Verificar por atualizações automaticamente ao abrir o app
                </AppText>
              </View>
              <Switch
                value={autoUpdate === true}
                onValueChange={(val) => setPreference("autoUpdate", val)}
                trackColor={{ false: Colors.border, true: Colors.blue }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          {/* Links */}
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

      {/* Update result modal */}
      <UpdateModal
        result={updateResult}
        visible={modalVisible}
        onClose={handleCloseModal}
      />
    </View>
  );
}

function TechBadge({ label }: { label: string }) {
  return (
    <View style={styles.techBadge}>
      <AppText style={styles.techBadgeText}>{label}</AppText>
    </View>
  );
}

function TechnologyRow({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.technologyRow}>
      <View style={styles.technologyIcon}>
        <Ionicons name={icon} size={19} color={Colors.blueBright} />
      </View>
      <View style={styles.technologyCopy}>
        <AppText style={styles.technologyTitle}>{title}</AppText>
        <AppText style={styles.technologyBody}>{body}</AppText>
      </View>
    </View>
  );
}

function VersionCard({ release, isLast }: { release: VersionEntry; isLast: boolean }) {
  return (
    <View style={styles.versionRow}>
      <View style={styles.timeline}>
        <View style={[styles.timelineDot, release.label ? styles.timelineDotCurrent : undefined]} />
        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={[styles.versionCard, release.label ? styles.currentVersionCard : undefined]}>
        <View style={styles.versionHeader}>
          <View style={styles.versionCopy}>
            <View style={styles.versionTitleRow}>
              <AppText style={styles.versionTitle}>{release.version}</AppText>
              {release.label ? (
                <View style={styles.currentBadge}>
                  <AppText style={styles.currentBadgeText}>{release.label}</AppText>
                </View>
              ) : null}
            </View>
            <AppText style={styles.versionDate}>{release.date}</AppText>
          </View>
          {release.label ? (
            <Ionicons name="sparkles-outline" size={18} color={Colors.blueBright} />
          ) : (
            <Ionicons name="chevron-down" size={16} color={Colors.subtle} />
          )}
        </View>
        <View style={styles.changeList}>
          {release.changes.map((change) => (
            <View key={`${release.version}-${change.tag}-${change.text}`} style={styles.changeItem}>
              <View style={[styles.changeTag, { backgroundColor: TAG_COLORS[change.tag].backgroundColor }]}>
                <AppText style={[styles.changeTagText, { color: TAG_COLORS[change.tag].color }]}>
                  {change.tag}
                </AppText>
              </View>
              <AppText style={styles.changeText}>{change.text}</AppText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function AboutLink({
  icon,
  title,
  body,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <TVFocusable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.aboutLink, pressed && styles.pressed]}
    >
      <View style={styles.aboutLinkIcon}>
        <Ionicons name={icon} size={18} color={Colors.blueBright} />
      </View>
      <View style={styles.aboutLinkCopy}>
        <AppText style={styles.aboutLinkTitle}>{title}</AppText>
        <AppText style={styles.aboutLinkBody}>{body}</AppText>
      </View>
      <Ionicons name="arrow-up-outline" size={17} color={Colors.subtle} />
    </TVFocusable>
  );
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
  // GitHub integration card
  githubCard: { paddingHorizontal: 14, paddingVertical: 12 },
  githubRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  githubIconWrap: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: Colors.border },
  githubCopy: { flex: 1, gap: 3 },
  githubTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  githubTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  githubActiveBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: "rgba(16,185,129,0.15)" },
  githubActiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.green },
  githubActiveText: { fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.5, color: Colors.green },
  githubRepo: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.blueBright },
  githubEndpoint: { fontSize: 9, color: Colors.subtle },
  githubOpenBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "rgba(59,130,246,0.1)" },
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
  autoUpdateRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: Radii.medium, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  autoUpdateCopy: { flex: 1, gap: 3 },
  autoUpdateTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  autoUpdateBody: { fontSize: 11, lineHeight: 16, color: Colors.muted },
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

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  sheet: { width: "100%", maxWidth: 480, borderRadius: 20, backgroundColor: "#0D111A", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", overflow: "hidden", ...Shadows.card },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 18, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  headerIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "rgba(59,130,246,0.15)" },
  headerCopy: { flex: 1, gap: 3 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.text },
  headerSub: { fontSize: 11, color: Colors.muted },
  closeBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "rgba(255,255,255,0.07)" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 18, paddingTop: 14 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  metaTextSub: { fontSize: 11, color: Colors.subtle },
  notesScroll: { maxHeight: 200 },
  notesContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4, gap: 6 },
  notesTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  notesBody: { fontSize: 11, lineHeight: 17, color: Colors.muted },
  errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginHorizontal: 18, marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: "rgba(229,9,20,0.12)" },
  errorText: { flex: 1, fontSize: 11, color: "#FF8B91" },
  actions: { gap: 8, padding: 16 },
  installBtn: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 14, backgroundColor: Colors.blue },
  installText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.white },
  releaseBtn: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: "rgba(255,255,255,0.05)" },
  releaseBtnText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.text },
  cancelBtn: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  cancelText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.subtle },
});
