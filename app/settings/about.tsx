import { Ionicons } from "@expo/vector-icons";
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
import { AppText, GlassCard, IconButton } from "@/components/ui";
import { BrandLogo } from "@/components/brand-logo";
import { APP_INFO } from "@/constants/app";
import { Colors, Radii, Shadows, Type } from "@/constants/theme";
import { useAppStore } from "@/store/useAppStore";
import { useTVMode } from "@/hooks/use-tv-mode";
import {
  checkForGitHubUpdate,
  downloadAndInstallUpdate,
  type UpdateCheckResult,
} from "@/services/githubUpdater";
import { logTechnicalError } from "@/services/security/sanitize";

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

const VERSION_HISTORY: VersionEntry[] = [
  {
    version: "v2.17.14",
    date: "2026.10",
    changes: [
      { tag: "Correção", text: "Ao sair da TV ao Vivo, o preview é encerrado por completo para liberar áudio, decoder e buffer do canal." },
      { tag: "Melhoria", text: "O guia de TV mantém categorias, lista compacta de canais e preview com programação em painéis responsivos." },
      { tag: "Melhoria", text: "Catálogo e EPG receberam paginação, atualização em lote e menor concorrência para reduzir o consumo de memória em Fire TV." },
      { tag: "Correção", text: "O menu lateral mantém todas as opções visíveis durante a navegação pelo controle remoto." },
    ],
  },
  {
    version: "v2.17.13",
    date: "2026.10",
    changes: [
      { tag: "Correção", text: "O preview de TV ao vivo é pausado ao sair da guia, impedindo que o áudio continue ao navegar para Início, Filmes, Séries ou player." },
      { tag: "Melhoria", text: "A guia TV ao vivo passou a usar painéis reais lado a lado: lista compacta à esquerda e preview com EPG à direita." },
      { tag: "Melhoria", text: "No guia de TV, títulos dos canais usam 14 px e a programação EPG 10 px para uma leitura proporcional em telas grandes." },
      { tag: "Correção", text: "O menu lateral da TV mantém-se aberto durante a transição de foco entre itens do controle remoto." },
    ],
  },
  {
    version: "v2.17.12",
    date: "2026.10",
    changes: [
      { tag: "Correção", text: "O menu lateral da TV mantém ícones e rótulos visíveis durante a troca rápida de foco pelo controle remoto." },
      { tag: "Melhoria", text: "A navegação lateral foi refinada com rail mais estreito, ícones menores, textos proporcionais e comportamento retrátil inspirado em interfaces de TV modernas." },
      { tag: "Melhoria", text: "O Guia TV ao vivo recebeu ajustes adicionais de densidade e espaçamento para melhor aproveitamento de telas grandes." },
    ],
  },
  {
    version: "v2.17.11",
    date: "2026.10",
    changes: [
      { tag: "Melhoria", text: "O menu lateral da TV segue o padrão retrátil, com ícones compactos e rótulos estáveis durante toda a navegação pelo controle." },
      { tag: "Melhoria", text: "A Tela Inicial da TV recebeu um destaque cinematográfico mais equilibrado e fileiras com proporção adequada para telas grandes." },
      { tag: "Melhoria", text: "O Guia TV ao vivo ganhou lista compacta, preview responsivo com programação Agora/Próximo e áudio no canal focado." },
    ],
  },
  {
    version: "v2.17.10",
    date: "2026.10",
    changes: [
      { tag: "Melhoria", text: "O blur nativo agora é percebido somente nas superfícies Glass, com transparência refinada no login, barra de navegação, miniplayer e menu lateral TV." },
      { tag: "Correção", text: "A versão de release foi recompilada nativamente a partir do código-fonte e da configuração de produção do TMDB." },
    ],
  },
  {
    version: "v2.17.9",
    date: "2026.10",
    changes: [
      { tag: "Melhoria", text: "Superfícies Glass receberam blur nativo mais visível no Android, com transparência refinada para revelar o conteúdo ao fundo." },
      { tag: "Melhoria", text: "Login, barra de navegação, miniplayer e controles agora seguem o acabamento translúcido inspirado no Apple TV." },
    ],
  },
  {
    version: "v2.17.8",
    date: "2026.10",
    changes: [
      { tag: "Melhoria", text: "O rodapé de acesso mostra versão e build do aplicativo em smartphone e TV." },
      { tag: "Melhoria", text: "Detalhes de filmes e séries usam arte full-bleed com degradê cinematográfico e leitura mais limpa." },
      { tag: "Melhoria", text: "Superfícies Glass receberam blur mais consistente e a Início da TV ganhou navegação lateral premium e compacta." },
    ],
  },
  {
    version: "v2.17.6",
    date: "2026.10",
    changes: [
      { tag: "Melhoria", text: "Guia TV ao vivo redesenhado com lista premium, preview silencioso do canal focado e painel de programação em tempo real." },
      { tag: "Correção", text: "Enter/OK e DPAD_CENTER voltam a exibir o OSD do player e preservam a navegação pelos controles." },
      { tag: "Melhoria", text: "Início, Filmes e Séries receberam destaques cinematográficos full-bleed; o menu lateral TV agora expande somente quando recebe foco." },
      { tag: "Correção", text: "Configuração do TMDB passou a ser injetada de forma confiável no build de produção." },
    ],
  },
  {
    version: "v2.17.5",
    date: "2026.10",
    changes: [
      { tag: "Correção", text: "Release reconstruído sobre a base estável 2.17.2, preservando as entregas de navegação TV, guia ao vivo e controles do player." },
      { tag: "Correção", text: "A tela de login usa os fundos cinematográficos corretos em smartphone e TV, sem os círculos azuis decorativos." },
      { tag: "Correção", text: "Metadados de versão foram unificados em todo o aplicativo." },
    ],
  },
  {
    version: "v2.17.2",
    date: "2026.10",
    changes: [
      { tag: "Melhoria", text: "O player passou a respeitar as áreas seguras do celular, mantendo ações e ajustes de volume acessíveis em tela cheia." },
      { tag: "Melhoria", text: "Séries agora exibem Pular abertura e Próximo episódio quando essas opções estão disponíveis." },
      { tag: "Correção", text: "A linha do tempo usa posicionamento direto e passou a avançar ou recuar exatamente no ponto tocado." },
      { tag: "Melhoria", text: "O painel inferior do player recebeu degradê profundo para leitura mais nítida sobre qualquer vídeo." },
      { tag: "Correção", text: "A busca voltou a aparecer e funcionar nas abas Filmes e Séries em smartphones." },
      { tag: "Correção", text: "O splash de abertura foi atualizado com o ícone atual, sem bordas brancas externas." },
    ],
  },
  {
    version: "v2.17.1",
    date: "2026.10",
    changes: [
      { tag: "Novidade", text: "O Destaque da Semana agora prioriza o conteúdo mais assistido por você e, sem histórico, a melhor avaliação TMDB." },
      { tag: "Melhoria", text: "Filmes e séries receberam arte limpa no topo e degradê cinematográfico para uma leitura mais confortável." },
      { tag: "Melhoria", text: "A tela de login foi redesenhada com painel Glass, botão premium e layout responsivo para smartphone e TV." },
      { tag: "Correção", text: "O fluxo de login para TV preserva a sequência de foco do controle remoto entre campos e ações." },
    ],
  },
  {
    version: "v2.17.0",
    date: "2026.10",
    changes: [
      { tag: "Novidade", text: "Listas M3U e guia XMLTV podem ser importados diretamente pelo cadastro de servidor." },
      { tag: "Novidade", text: "Programas encerrados podem ser assistidos do início quando o provedor declara Catch-up." },
      { tag: "Melhoria", text: "Catálogos grandes usam carregamento paginado para manter TV, Filmes e Séries fluidos." },
      { tag: "Correção", text: "Validação global de código concluída, com regras de qualidade aplicadas ao projeto." },
      { tag: "Correção", text: "Favoritos e histórico agora ficam isolados por lista/servidor." },
      { tag: "Correção", text: "Mais recentes usa a data real de inclusão do catálogo Xtream." },
      { tag: "Melhoria", text: "Filmes e séries continuam sendo sincronizados quando somente os canais falham." },
    ],
  },
  {
    version: "v2.16.4",
    date: "2026.10",
    changes: [
      { tag: "Correção", text: "A inicialização agora apresenta recuperação segura quando o cofre do dispositivo não responde." },
      { tag: "Melhoria", text: "O login ganhou largura adequada para TV e logo maior em smartphones." },
      { tag: "Melhoria", text: "A saída exige dois toques em Voltar e confirmação explícita." },
    ],
  },
];

function getVisibleChangelog(currentVersion: string): VersionEntry[] {
  const normalizedCurrent = currentVersion.startsWith("v")
    ? currentVersion
    : `v${currentVersion}`;
  const currentIndex = VERSION_HISTORY.findIndex(
    (entry) => entry.version === normalizedCurrent,
  );
  const firstVisibleIndex = currentIndex >= 0 ? currentIndex : 0;

  return VERSION_HISTORY.slice(firstVisibleIndex, firstVisibleIndex + 2).map(
    (entry, index) => ({
      ...entry,
      label: index === 0 && entry.version === normalizedCurrent ? "Versão Atual" : undefined,
    }),
  );
}

const CHANGELOG = getVisibleChangelog(APP_INFO.version);

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

function formatDownloadSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Update Modal helpers (module-level keeps complexity out of the component)

async function runInstallUpdate(
  apkUrl: string,
  apkSize: number | null | undefined,
  onError: (msg: string) => void,
): Promise<void> {
  try {
    await downloadAndInstallUpdate(apkUrl, apkSize);
  } catch (err) {
    logTechnicalError("UpdateModal/install", err);
    onError(err instanceof Error ? err.message : "Falha ao iniciar a instalação.");
  }
}

async function openReleaseUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch (e) {
    logTechnicalError("UpdateModal/release", e);
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
      result?.apkSize,
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
              {result.apkSize ? (
                <View style={modalStyles.metaItem}>
                  <Ionicons name="download-outline" size={14} color={Colors.subtle} />
                  <AppText style={modalStyles.metaTextSub}>{formatDownloadSize(result.apkSize)}</AppText>
                </View>
              ) : null}
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
      logTechnicalError("About/update-check", err);
      setActionError("Não foi possível verificar atualizações. Tente novamente.");
      setCheckState("idle");
    }
  }, []);

  const openExternalLink = useCallback(async (url: string, destination: string) => {
    setActionError(null);
    try {
      await Linking.openURL(url);
    } catch (linkError) {
      logTechnicalError("About/open-link", linkError);
      setActionError(`Não foi possível abrir ${destination}. Verifique sua conexão e tente novamente.`);
    }
  }, []);

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
              <AppText style={styles.headerTitle}>ELVANOQ</AppText>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          {/* Hero card */}
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={styles.appIcon}>
              <BrandLogo variant="symbol" accessibilityLabel="Ícone ELVANOQ" style={StyleSheet.absoluteFill} />
            </View>
            <AppText style={styles.heroName}>{APP_INFO.name}</AppText>
            <AppText style={styles.heroVersion}>{APP_INFO.versionLabel}</AppText>
            <View style={styles.stableBadge}>
              <Ionicons name="information-circle-outline" size={13} color={Colors.blueBright} />
              <AppText style={styles.stableText}>Versão instalada</AppText>
            </View>
            <AppText style={styles.heroSummary}>
              Sua central de entretenimento para assistir ao vivo, explorar catálogos e continuar cada história no ponto certo.
            </AppText>
            <View style={styles.techRow}>
              <TechBadge label="ExoPlayer / HLS" />
              <TechBadge label="Xtream Codes API" />
              <TechBadge label="EPG" />
              <TechBadge label="PiP nativo" />
            </View>
          </View>

          {/* GitHub update source */}
          <GlassCard style={styles.githubCard} intensity={18}>
            <View style={styles.githubRow}>
              <View style={styles.githubIconWrap}>
                <Ionicons name="logo-github" size={20} color={Colors.text} />
              </View>
              <View style={styles.githubCopy}>
                <View style={styles.githubTitleRow}>
                  <AppText style={styles.githubTitle}>Atualizações via GitHub Releases</AppText>
                  <View style={styles.githubActiveBadge}>
                    <AppText style={styles.githubActiveText}>VERIFICAÇÃO MANUAL</AppText>
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
            <AppText style={Type.section}>O que move o ELVANOQ</AppText>
            <AppText style={styles.sectionSubtitle}>Tecnologias pensadas para uma reprodução fluida</AppText>
          </View>
          <GlassCard style={styles.technologyCard} intensity={18}>
            <TechnologyRow icon="play-circle-outline" title="Motor de Reprodução" body="ExoPlayer com suporte a streams HLS adaptativos." />
            <View style={styles.cardDivider} />
            <TechnologyRow icon="server-outline" title="Suas fontes, do seu jeito" body="Xtream Codes e múltiplos servidores cadastrados pelo usuário." />
            <View style={styles.cardDivider} />
            <TechnologyRow icon="calendar-outline" title="Contexto em tempo real" body="EPG ao vivo e progresso local para acompanhar seu conteúdo." />
            <View style={styles.cardDivider} />
            <TechnologyRow icon="logo-github" title="Verificação de atualizações" body={`GitHub Releases · ${APP_INFO.githubRepo}`} />
          </GlassCard>

          {/* Changelog */}
          <View style={styles.changelogHeader}>
            <View style={styles.sectionHeading}>
              <AppText style={Type.section}>Histórico de versões</AppText>
              <AppText style={styles.sectionSubtitle}>As duas versões mais recentes desta instalação</AppText>
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
                    O ELVANOQ {APP_INFO.versionLabel} é a versão mais recente.
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
                value={autoUpdate !== false}
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
          <AppText style={styles.footer}>ELVANOQ · Sua mídia. Sua experiência.</AppText>
        </ScrollView>

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
  appIcon: { width: 96, height: 96, overflow: "hidden", borderRadius: 25, borderWidth: 1, borderColor: "rgba(96,165,250,0.48)", backgroundColor: Colors.backgroundRaised, ...Shadows.card },
  heroName: { marginTop: 14, ...Type.display },
  heroVersion: { marginTop: 4, fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.blueBright },
  stableBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radii.pill, backgroundColor: "rgba(16,185,129,0.13)" },
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
