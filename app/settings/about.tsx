import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Image } from "expo-image";
import { PremiumBackdrop, PremiumTopBar } from "@/components/premium-screen";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { APP_INFO } from "@/constants/app";
import { BRAND, BrandAssets } from "@/constants/brand";
import { PORTAL_ORIGIN } from "@/constants/portal";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useAppStore } from "@/store/useAppStore";
import { useTVMode } from "@/hooks/use-tv-mode";
import {
  cancelUpdateDownload,
  checkForPortalUpdate,
  downloadAndInstallUpdate,
  type UpdateCheckResult,
  type UpdateDownloadProgress,
} from "@/services/portalUpdater";
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
    version: "v2.17.23",
    label: "Atual",
    date: "2026.11",
    changes: [
      { tag: "Novidade", text: "Login no padrão do Roku e da LG: Ative sua TV em três passos, MAC e chave em destaque, QR do Portal e relógio na TV." },
      { tag: "Melhoria", text: "Nova logo ELVANOQ Play com o slogan Sua mídia. Sua experiência." },
    ],
  },
  {
    version: "v2.17.22",
    date: "2026.11",
    changes: [
      { tag: "Melhoria", text: "Novo ícone do ELVANOQ no aparelho e novo banner na tela inicial do Android TV e do Fire TV." },
    ],
  },
  {
    version: "v2.17.21",
    date: "2026.11",
    changes: [
      { tag: "Novidade", text: "Quando o sinal para de chegar, o player reabre sozinho no mesmo ponto, até três vezes, antes de mostrar o erro." },
      { tag: "Novidade", text: "Categorias visíveis: oculte categorias de Ao vivo, Filmes e Séries sem apagar nada." },
      { tag: "Novidade", text: "Controle parental protege automaticamente categorias adultas (Adultos, XXX, +18); dá para liberar uma a uma." },
      { tag: "Melhoria", text: "O ao vivo lembra qual formato (HLS ou TS) funcionou na sua lista e já começa por ele." },
      { tag: "Melhoria", text: "Rever programas tenta formatos alternativos do servidor antes de desistir, e o player ganhou o atalho Abrir em outro player." },
    ],
  },
  {
    version: "v2.17.20",
    date: "2026.11",
    changes: [
      { tag: "Melhoria", text: "Controle parental, Player, Diagnóstico, Adicionar lista e Busca seguem o visual da tela Sobre: brilho azul no topo, botão Voltar circular e opções agrupadas." },
      { tag: "Melhoria", text: "Ajustes, Assistir Mais Tarde e Continuar Assistindo ganharam o mesmo fundo; na TV, os cartões de Ajustes usam a nova paleta." },
      { tag: "Correção", text: "A Busca não fica mais sob a barra de status e, em tablet e TV, ocupa uma coluna central." },
    ],
  },
  {
    version: "v2.17.19",
    date: "2026.11",
    changes: [
      { tag: "Melhoria", text: "Tela Sobre redesenhada: destaque com o ícone do app e a versão, atualizações em um único cartão com o resultado da verificação e seções agrupadas." },
      { tag: "Melhoria", text: "Novidades da versão em lista, com a versão anterior sob demanda, e recursos em grade adaptada a celular, tablet e TV." },
      { tag: "Novidade", text: "Login com o novo fundo do ELVANOQ, o mesmo do Roku, adaptado para TV, tablet e celular." },
      { tag: "Correção", text: "No aviso de atualização, os botões mostram foco no controle remoto e o botão Voltar não fecha a janela durante o download." },
    ],
  },
  {
    version: "v2.17.18",
    date: "2026.11",
    changes: [
      { tag: "Melhoria", text: "O aviso automático de atualização foi redesenhado: mais compacto, com comparação de versões, tamanho do APK e resumo das novidades." },
      { tag: "Melhoria", text: "As notas completas ficam disponíveis sob demanda, preservando uma abertura rápida e visual mais limpo em celular, tablet e TV." },
    ],
  },
  {
    version: "v2.17.17",
    date: "2026.10",
    changes: [
      { tag: "Correção", text: "Navegação pelo controle volta a responder rápido em Fire TV Stick Lite e 1ª geração: o destaque da Início, os pôsteres e a grade de Filmes e Séries não redesenham mais a tela inteira a cada tecla." },
      { tag: "Novidade", text: "Início no formato hub do ELVANOQ Play para Roku, com destaques rotativos, Minha Lista e blocos de navegação na TV e no tablet." },
      { tag: "Novidade", text: "Na TV e no tablet na horizontal, Filmes e Séries ganharam painel de categorias com busca por título ou ator, e os Detalhes seguem o Roku com dados do TMDB." },
      { tag: "Melhoria", text: "Versões dublada e legendada do mesmo título aparecem em um único cartão; a versão é escolhida nos Detalhes." },
      { tag: "Melhoria", text: "Visual renovado em Filmes, Séries, Ajustes e Login, com títulos e categorias sem marcações técnicas." },
    ],
  },
  {
    version: "v2.17.16",
    date: "2026.10",
    changes: [
      { tag: "Correção", text: "O player foi restaurado como fonte TypeScript UTF-8 válida, preservando OSD, EPG, retomada e controles de reprodução." },
      { tag: "Novidade", text: "A tela de login mostra o identificador local do dispositivo e informa o estado do vínculo com o Portal, sem bloquear o acesso." },
      { tag: "Melhoria", text: "Controle parental inclui bloqueio persistente por categoria em Canais, Filmes e Séries." },
    ],
  },
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
  apkSha256: string | null | undefined,
  onProgress: (progress: UpdateDownloadProgress) => void,
  onError: (msg: string) => void,
): Promise<void> {
  try {
    await downloadAndInstallUpdate(apkUrl, apkSize ?? 0, apkSha256 ?? "", onProgress);
  } catch (err) {
    logTechnicalError("UpdateModal/install", err);
    onError(err instanceof Error ? err.message : "Falha ao iniciar a instalação.");
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
  if (!result.hasUpdate || !result.apkUrl || !result.apkSha256) return null;
  return (
    <TVFocusable
      onPress={onPress}
      disabled={installing}
      style={[modalStyles.installBtn, installing && { opacity: 0.55 }]}
      accessibilityLabel="Baixar e instalar atualização"
    >
      {installing
        ? <ActivityIndicator size="small" color={Colors.background} />
        : <Ionicons name="download-outline" size={18} color={Colors.background} />}
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
  const [progress, setProgress] = useState<UpdateDownloadProgress | null>(null);

  const handleInstall = useCallback(async () => {
    setInstallError(null);
    setInstalling(true);
    setProgress(null);
    await runInstallUpdate(
      result?.apkUrl ?? "",
      result?.apkSize,
      result?.apkSha256,
      setProgress,
      setInstallError,
    );
    setInstalling(false);
  }, [result]);

  const handleCancelDownload = useCallback(() => { void cancelUpdateDownload(); }, []);

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

          {installing ? <AppText style={modalStyles.progressText}>{progress?.fraction === null || progress?.fraction === undefined ? "Baixando atualização…" : `Baixando… ${Math.round(progress.fraction * 100)}%`}</AppText> : null}

          {/* Actions */}
          <View style={modalStyles.actions}>
            <InstallButton result={result} installing={installing} onPress={handleInstall} />
            {installing ? (
              <TVFocusable
                onPress={handleCancelDownload}
                style={modalStyles.releaseBtn}
                accessibilityLabel="Cancelar download"
              >
                <Ionicons name="close-outline" size={17} color={Colors.text} />
                <AppText style={modalStyles.releaseBtnText}>Cancelar</AppText>
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
// Sobre no padrão das demais telas: destaque com o ícone do app e a versão,
// cartão de atualizações com o estado da última verificação, novidades da
// versão atual, recursos em grade e informações agrupadas.

type CheckState = "idle" | "checking" | "done";

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: "play-circle-outline", title: "Reprodução fluida", body: "ExoPlayer com HLS adaptativo" },
  { icon: "server-outline", title: "Suas listas", body: "Xtream Codes, código e M3U" },
  { icon: "calendar-outline", title: "Guia ao vivo", body: "EPG e catch-up do provedor" },
  { icon: "film-outline", title: "Catálogo rico", body: "Capas e dados do TMDB" },
];

export default function AboutScreen() {
  const router = useRouter();
  const tvMode = useTVMode();
  const insets = useSafeAreaInsets();
  const { isTablet, isTabletLandscape } = useResponsiveLayout();
  const autoUpdate = useAppStore((state) => state.preferences["autoUpdate"]);
  const setPreference = useAppStore((state) => state.setPreference);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);

  const wide = tvMode || isTabletLandscape;
  const current = CHANGELOG[0];
  const previous = CHANGELOG[1];
  const autoUpdateOn = autoUpdate !== false;

  const handleCheckUpdates = useCallback(async () => {
    setActionError(null);
    setCheckState("checking");
    try {
      const result = await checkForPortalUpdate();
      setUpdateResult(result);
      if (result.error) {
        setActionError(result.error);
        setCheckState("idle");
        return;
      }
      setCheckState("done");
      // Com atualização disponível, a janela de download abre direto.
      if (result.hasUpdate) setModalVisible(true);
    } catch (err) {
      logTechnicalError("About/update-check", err);
      setActionError("Não foi possível verificar atualizações. Tente novamente.");
      setCheckState("idle");
    }
  }, []);

  const handleCloseModal = useCallback(() => setModalVisible(false), []);
  const openPortal = useCallback(() => {
    void Linking.openURL(PORTAL_ORIGIN).catch((error) => {
      logTechnicalError("About/openPortal", error);
      setActionError("Não há navegador disponível neste aparelho. Acesse elvanoqplay.app em outro dispositivo.");
    });
  }, []);

  // Estado da última verificação, exibido dentro do cartão (sem alertas).
  let status: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string } = {
    icon: "time-outline",
    color: Colors.muted,
    text: autoUpdateOn ? "Verificação automática ao abrir o app" : "Verificação automática desligada",
  };
  if (checkState === "checking") status = { icon: "sync-outline", color: Colors.blueBright, text: "Consultando o Portal ELVANOQ Play…" };
  else if (actionError) status = { icon: "alert-circle-outline", color: "#FF8B91", text: actionError };
  else if (checkState === "done" && updateResult?.hasUpdate) status = { icon: "arrow-up-circle-outline", color: Colors.blueBright, text: `Nova versão ${updateResult.latestVersion ?? ""} disponível` };
  else if (checkState === "done") status = { icon: "checkmark-circle-outline", color: Colors.green, text: "Você está com a versão mais recente" };

  const platformLabel = tvMode ? "Android TV" : isTablet ? "Tablet Android" : "Smartphone Android";

  return (
    <View style={styles.screen}>
      <PremiumBackdrop />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + (tvMode ? 28 : 12), paddingBottom: insets.bottom + 40 },
          tvMode && styles.tvContent,
          (isTablet || tvMode) && styles.wideContent,
        ]}
      >
        <PremiumTopBar title="Sobre" onBack={() => router.back()} />

        {/* Destaque */}
        <View style={[styles.hero, wide && styles.heroWide]}>
          <View style={styles.iconShadow}>
            <Image source={BrandAssets.icon} contentFit="cover" style={[styles.appIcon, wide && styles.appIconWide]} accessibilityLabel="Ícone do ELVANOQ" />
          </View>
          <View style={[styles.heroCopy, wide && styles.heroCopyWide]}>
            <AppText style={[styles.appName, wide && styles.appNameWide]}>{APP_INFO.name}</AppText>
            <AppText style={[styles.tagline, wide && styles.taglineWide]}>Sua mídia. Sua experiência.</AppText>
            <View style={[styles.versionRow, wide && styles.versionRowWide]}>
              <View style={styles.versionPill}>
                <AppText style={styles.versionPillText}>Versão {APP_INFO.version}</AppText>
              </View>
              <AppText style={styles.buildText}>Build {APP_INFO.build}</AppText>
            </View>
          </View>
        </View>

        {/* Atualizações */}
        <View style={styles.updateCard}>
          <View style={styles.updateHeader}>
            <View style={styles.updateIcon}><Ionicons name="cloud-download-outline" size={20} color={Colors.blueBright} /></View>
            <View style={styles.updateCopy}>
              <AppText style={styles.updateTitle}>Atualizações</AppText>
              <AppText style={styles.updateSubtitle}>Distribuídas pelo Portal ELVANOQ Play</AppText>
            </View>
          </View>
          <View style={styles.statusRow} accessibilityLiveRegion="polite">
            {checkState === "checking"
              ? <ActivityIndicator size="small" color={Colors.blueBright} />
              : <Ionicons name={status.icon} size={16} color={status.color} />}
            <AppText style={[styles.statusText, { color: status.color }]}>{status.text}</AppText>
          </View>
          <View style={[styles.updateActions, wide && styles.updateActionsWide]}>
            <TVFocusable
              accessibilityRole="button"
              hasTVPreferredFocus
              disabled={checkState === "checking"}
              onPress={handleCheckUpdates}
              focusStyle={styles.primaryFocused}
              style={({ pressed }) => [styles.primaryButton, wide && styles.primaryButtonWide, pressed && styles.pressed, checkState === "checking" && styles.disabled]}
            >
              <Ionicons name="refresh" size={17} color={Colors.background} />
              <AppText style={styles.primaryButtonText}>{checkState === "checking" ? "Verificando…" : "Verificar atualizações"}</AppText>
            </TVFocusable>
            {checkState === "done" && updateResult?.hasUpdate ? (
              <TVFocusable
                accessibilityRole="button"
                onPress={() => setModalVisible(true)}
                focusStyle={styles.secondaryFocused}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Ionicons name="download-outline" size={17} color={Colors.text} />
                <AppText style={styles.secondaryButtonText}>Ver atualização</AppText>
              </TVFocusable>
            ) : null}
          </View>
          <View style={styles.divider} />
          <TVFocusable
            accessibilityRole="switch"
            accessibilityState={{ checked: autoUpdateOn }}
            accessibilityLabel="Verificar ao abrir o app"
            onPress={() => setPreference("autoUpdate", !autoUpdateOn)}
            focusStyle={styles.rowFocused}
            style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
          >
            <View style={styles.rowCopy}>
              <AppText style={styles.rowTitle}>Verificar ao abrir o app</AppText>
              <AppText style={styles.rowMeta}>Avisa quando houver uma nova versão</AppText>
            </View>
            <Switch focusable={false} pointerEvents="none" value={autoUpdateOn} trackColor={{ false: "#293246", true: Colors.blue }} thumbColor={Colors.white} />
          </TVFocusable>
        </View>

        {/* Novidades */}
        {current ? (
          <>
            <GroupLabel title={`NOVIDADES DA VERSÃO ${current.version.replace(/^v/, "")}`} />
            <View style={styles.group}>
              {current.changes.map((change, index) => (
                <ChangeRow key={`${current.version}-${index}`} change={change} divider={index > 0} />
              ))}
            </View>
          </>
        ) : null}
        {previous ? (
          <>
            <TVFocusable
              accessibilityRole="button"
              accessibilityState={{ expanded: showPrevious }}
              onPress={() => setShowPrevious((value) => !value)}
              focusStyle={styles.rowFocused}
              style={({ pressed }) => [styles.previousToggle, pressed && styles.pressed]}
            >
              <AppText style={styles.previousToggleText}>{showPrevious ? "Ocultar" : "Ver"} versão anterior ({previous.version.replace(/^v/, "")})</AppText>
              <Ionicons name={showPrevious ? "chevron-up" : "chevron-down"} size={15} color={Colors.blueBright} />
            </TVFocusable>
            {showPrevious ? (
              <View style={styles.group}>
                {previous.changes.map((change, index) => (
                  <ChangeRow key={`${previous.version}-${index}`} change={change} divider={index > 0} />
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {/* Recursos */}
        <GroupLabel title="RECURSOS" />
        <View style={styles.featureGrid}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={[styles.featureTile, wide && styles.featureTileWide]}>
              <View style={styles.featureIcon}><Ionicons name={feature.icon} size={18} color={Colors.blueBright} /></View>
              <AppText numberOfLines={1} style={styles.featureTitle}>{feature.title}</AppText>
              <AppText numberOfLines={2} style={styles.featureBody}>{feature.body}</AppText>
            </View>
          ))}
        </View>

        {/* Informações */}
        <GroupLabel title="INFORMAÇÕES" />
        <View style={styles.group}>
          <InfoRow label="Versão" value={`${APP_INFO.version} (build ${APP_INFO.build})`} />
          <InfoRow label="Aparelho" value={platformLabel} divider />
          <InfoRow label="Distribuição" value="Portal ELVANOQ Play" divider />
          <TVFocusable
            accessibilityRole="link"
            accessibilityLabel="Abrir o site elvanoqplay.app"
            onPress={openPortal}
            focusStyle={styles.rowFocused}
            style={({ pressed }) => [styles.infoRow, styles.dividerTop, pressed && styles.pressed]}
          >
            <AppText style={styles.infoLabel}>Site e suporte</AppText>
            <View style={styles.linkValue}>
              <AppText style={styles.linkText}>elvanoqplay.app</AppText>
              <Ionicons name="open-outline" size={14} color={Colors.blueBright} />
            </View>
          </TVFocusable>
        </View>

        <AppText style={styles.footer}>ELVANOQ · Sua mídia. Sua experiência.</AppText>
      </ScrollView>

      <UpdateModal result={updateResult} visible={modalVisible} onClose={handleCloseModal} />
    </View>
  );
}

function GroupLabel({ title }: { title: string }) {
  return <AppText style={styles.groupLabel}>{title}</AppText>;
}

function ChangeRow({ change, divider }: { change: ChangeItem; divider: boolean }) {
  const colors = TAG_COLORS[change.tag];
  return (
    <View style={[styles.changeRow, divider && styles.dividerTop]}>
      <View style={[styles.changeTag, { backgroundColor: colors.backgroundColor }]}>
        <AppText style={[styles.changeTagText, { color: colors.color }]}>{change.tag}</AppText>
      </View>
      <AppText style={styles.changeText}>{change.text}</AppText>
    </View>
  );
}

function InfoRow({ label, value, divider = false }: { label: string; value: string; divider?: boolean }) {
  return (
    <View style={[styles.infoRow, divider && styles.dividerTop]}>
      <AppText style={styles.infoLabel}>{label}</AppText>
      <AppText numberOfLines={1} style={styles.infoValue}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { gap: 18, paddingHorizontal: 20 },
  tvContent: { paddingHorizontal: 46 },
  wideContent: { width: "100%", maxWidth: 820, alignSelf: "center" },

  hero: { alignItems: "center", gap: 14, paddingTop: 6, paddingBottom: 4 },
  heroWide: { flexDirection: "row", alignItems: "center", gap: 22 },
  iconShadow: { borderRadius: 26, shadowColor: "#147DFF", shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  appIcon: { width: 104, height: 104, borderRadius: 26 },
  appIconWide: { width: 96, height: 96, borderRadius: 24 },
  heroCopy: { alignItems: "center", gap: 4 },
  heroCopyWide: { alignItems: "flex-start" },
  appName: { fontFamily: "Inter_700Bold", fontSize: 32, lineHeight: 38, letterSpacing: -1, color: Colors.text },
  appNameWide: { fontSize: 30, lineHeight: 36 },
  tagline: { fontSize: 13, color: Colors.muted },
  taglineWide: { fontSize: 12 },
  versionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  versionRowWide: { marginTop: 8 },
  versionPill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1, borderColor: "rgba(0,215,255,0.32)", backgroundColor: "rgba(0,215,255,0.10)" },
  versionPillText: { fontFamily: "Inter_700Bold", fontSize: 12, color: Colors.blueBright },
  buildText: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.subtle },

  updateCard: { gap: 12, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: "rgba(0,215,255,0.18)", backgroundColor: "rgba(20,125,255,0.08)" },
  updateHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  updateIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "rgba(0,215,255,0.12)" },
  updateCopy: { flex: 1, gap: 2 },
  updateTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text },
  updateSubtitle: { fontSize: 12, color: Colors.muted },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: "rgba(7,11,20,0.5)" },
  statusText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 12, lineHeight: 16 },
  updateActions: { gap: 8 },
  updateActionsWide: { flexDirection: "row" },
  primaryButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20, borderRadius: 14, backgroundColor: BRAND.colors.textPrimary },
  primaryButtonWide: { alignSelf: "flex-start" },
  primaryButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.background },
  primaryFocused: { borderWidth: 2, borderColor: Colors.blueBright, transform: [{ scale: 1.04 }] },
  secondaryButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20, borderRadius: 14, borderWidth: 1, borderColor: "rgba(244,248,255,0.22)", backgroundColor: "rgba(17,27,45,0.82)" },
  secondaryButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  secondaryFocused: { borderWidth: 2, borderColor: Colors.blueBright, backgroundColor: "rgba(255,255,255,0.14)", transform: [{ scale: 1.04 }] },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(190,222,255,0.16)" },
  toggleRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12 },
  rowFocused: { borderWidth: 2, borderColor: Colors.blueBright, backgroundColor: "rgba(0,215,255,0.08)", transform: [{ scale: 1 }] },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  rowMeta: { fontSize: 11, color: Colors.muted },

  groupLabel: { marginBottom: -8, paddingHorizontal: 4, fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.1, color: Colors.muted },
  group: { overflow: "hidden", borderRadius: 16, borderWidth: 1, borderColor: "rgba(190,222,255,0.10)", backgroundColor: "rgba(13,20,34,0.72)" },
  dividerTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(190,222,255,0.14)" },
  changeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  changeTag: { minWidth: 68, alignItems: "center", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  changeTagText: { fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 0.3 },
  changeText: { flex: 1, fontSize: 13, lineHeight: 18, color: "#D6DEEB" },
  previousToggle: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, marginTop: -6, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 10 },
  previousToggleText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.blueBright },

  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  featureTile: { width: "48.4%", gap: 6, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "rgba(190,222,255,0.10)", backgroundColor: "rgba(13,20,34,0.72)" },
  featureTileWide: { width: "23.6%" },
  featureIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "rgba(0,215,255,0.10)" },
  featureTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  featureBody: { fontSize: 11, lineHeight: 15, color: Colors.muted },

  infoRow: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 14 },
  infoLabel: { fontSize: 13, color: Colors.muted },
  infoValue: { flexShrink: 1, fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  linkValue: { flexDirection: "row", alignItems: "center", gap: 5 },
  linkText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.blueBright },
  footer: { alignSelf: "center", marginTop: 4, fontSize: 10, color: Colors.subtle },
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
  progressText: { fontSize: 12, color: Colors.muted, textAlign: "center", paddingHorizontal: 18 },
  actions: { gap: 8, padding: 16 },
  installBtn: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.82)", backgroundColor: Colors.white },
  installText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.background },
  releaseBtn: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: "rgba(255,255,255,0.05)" },
  releaseBtnText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.text },
  cancelBtn: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  cancelText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.subtle },
});
