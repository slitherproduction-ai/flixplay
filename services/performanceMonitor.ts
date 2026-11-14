import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, NativeModules, Platform, type AppStateStatus } from "react-native";
import { APP_INFO } from "@/constants/app";
import { deviceTier } from "@/services/deviceProfile";
import { onTechnicalLog, sanitizeError, type TechnicalLogEntry } from "@/services/security/sanitize";

/**
 * Painel de desempenho (Ajustes → Diagnóstico). Mede no aparelho real, para
 * atacar o que pesa em vez de supor:
 * - pausas da interface: o JS parado por mais de PAUSE_MS (tela sem responder ao controle);
 * - tempo de abertura do app (do processo nativo até a Início/login);
 * - duração de cada etapa da sincronização;
 * - memória livre do aparelho e do app, e avisos de pouca memória do sistema;
 * - encerramento inesperado da sessão anterior (o app sumiu com a tela aberta).
 *
 * Custo: um timer de 250 ms e uma gravação a cada 30 s. Nada de usuário, senha
 * ou endereço do servidor é guardado.
 */

const TICK_MS = 250;
const PAUSE_MS = 400;
const HEARTBEAT_MS = 30_000;
const SESSION_KEY = "elvanoq.perf.session";
const EXITS_KEY = "elvanoq.perf.exits";
const LOG_KEY = "elvanoq.perf.log";
const MAX_LOG = 12;
const MAX_RECENT = 6;

export type MemorySnapshot = {
  availMemMb: number;
  totalMemMb: number;
  thresholdMb: number;
  lowMemory: boolean;
  javaHeapUsedMb: number;
  javaHeapMaxMb: number;
  nativeHeapMb: number;
  processUptimeMs: number;
  trimCount: number;
  lastTrimLevel: number;
  lastTrimAt: number;
};

export type UiPause = { ms: number; route: string; at: number };
export type SyncTiming = { stage: string; ms: number; items: number; mode: string; at: number };
export type UnexpectedExit = { at: number; route: string; version: string; availMemMb: number | null; minutesOpen: number; activity?: string | null; cause?: string | null };

type SessionBeat = {
  version: string;
  startedAt: number;
  beatAt: number;
  route: string;
  active: boolean;
  clean: boolean;
  availMemMb: number | null;
  /** O que a sincronização fazia no último registro (ex.: "Baixando filmes: 12.400 títulos"). */
  activity?: string | null;
};

type NativeExitReason = { at: number; reason: number; status: number; importance: number; pssKb: number; description: string; trace?: string };
type NativeExitReasons = { reasons: NativeExitReason[]; lastCrash?: { at: number; text: string } };
type NativeProfile = {
  getMemorySnapshot?: () => Promise<MemorySnapshot>;
  getExitReasons?: () => Promise<NativeExitReasons>;
};

/** Motivos do Android (ApplicationExitInfo.REASON_*) em português. */
const EXIT_REASONS: Record<number, string> = {
  0: "motivo desconhecido",
  1: "o app se encerrou",
  2: "encerrado por sinal do sistema",
  3: "falta de memória (sistema)",
  4: "erro no app",
  5: "erro nativo no app",
  6: "app travado (sem resposta)",
  7: "falha ao iniciar",
  9: "uso excessivo de recursos",
  10: "encerrado pelo usuário",
  11: "parado pelo usuário",
  12: "dependência encerrada",
  13: "encerrado pelo sistema",
  14: "congelado pelo sistema",
  16: "app atualizado",
};
const EXIT_SEEN_KEY = "elvanoq.perf.exitSeen";
const native = (Platform.OS === "android" ? NativeModules.ElvanoqDeviceProfile : undefined) as NativeProfile | undefined;

const jsStartedAt = Date.now();
const state = {
  started: false,
  route: "/",
  active: true,
  pauses: 0,
  pauseTotalMs: 0,
  maxPauseMs: 0,
  recentPauses: [] as UiPause[],
  syncTimings: [] as SyncTiming[],
  startupMs: null as number | null,
  jsStartupMs: null as number | null,
  previousExits: [] as UnexpectedExit[],
  lastAvailMemMb: null as number | null,
  activity: null as string | null,
  log: [] as TechnicalLogEntry[],
  /** Causa do último encerramento informada pelo Android e o erro fatal guardado (sanitizados). */
  lastCause: null as { at: number; text: string } | null,
  opens: { live: [], movies: [], series: [] } as Record<VideoOpenKind, VideoOpen[]>,
};

/** Abertura de vídeo: do toque até a imagem (ms) ou `null` quando não abriu. */
export type VideoOpenKind = "live" | "movies" | "series";
export type VideoOpen = { ms: number | null; fromPreview: boolean; at: number };
const MAX_OPENS = 20;

let logSaveTimer: ReturnType<typeof setTimeout> | null = null;
function saveLogSoon(): void {
  if (logSaveTimer) return;
  // Grava logo (o app pode ser fechado pelo sistema a qualquer momento), mas
  // junta rajadas de erros numa gravação só.
  logSaveTimer = setTimeout(() => {
    logSaveTimer = null;
    void AsyncStorage.setItem(LOG_KEY, JSON.stringify(state.log)).catch(() => undefined);
  }, 500);
}

function pushLog(entry: TechnicalLogEntry): void {
  const last = state.log[0];
  if (last && last.scope === entry.scope && last.message === entry.message) {
    last.count += 1;
    last.at = entry.at;
  } else {
    state.log.unshift({ ...entry });
    if (state.log.length > MAX_LOG) state.log.length = MAX_LOG;
  }
  saveLogSoon();
}

export async function getMemorySnapshot(): Promise<MemorySnapshot | null> {
  try {
    const snapshot = await native?.getMemorySnapshot?.();
    if (!snapshot) return null;
    state.lastAvailMemMb = Math.round(snapshot.availMemMb);
    return snapshot;
  } catch {
    return null;
  }
}

/** Memória usada pelo JavaScript (Hermes), quando disponível. */
export function getJsHeapMb(): number | null {
  try {
    const hermes = (globalThis as { HermesInternal?: { getInstrumentedStats?: () => Record<string, number> } }).HermesInternal;
    const stats = hermes?.getInstrumentedStats?.();
    const bytes = stats?.js_heapSize ?? stats?.js_allocatedBytes;
    return typeof bytes === "number" && bytes > 0 ? bytes / (1024 * 1024) : null;
  } catch {
    return null;
  }
}

function pushRecent<T>(list: T[], item: T): void {
  list.unshift(item);
  if (list.length > MAX_RECENT) list.length = MAX_RECENT;
}

async function writeBeat(clean = false): Promise<void> {
  const beat: SessionBeat = {
    version: APP_INFO.version,
    startedAt: jsStartedAt,
    beatAt: Date.now(),
    route: state.route,
    active: state.active,
    clean,
    availMemMb: state.lastAvailMemMb,
    activity: state.activity,
  };
  try { await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(beat)); } catch { /* opcional */ }
}

async function readPreviousSession(): Promise<void> {
  try {
    const [rawBeat, rawExits] = await Promise.all([AsyncStorage.getItem(SESSION_KEY), AsyncStorage.getItem(EXITS_KEY)]);
    const exits: UnexpectedExit[] = rawExits ? JSON.parse(rawExits) : [];
    const beat: SessionBeat | null = rawBeat ? JSON.parse(rawBeat) : null;
    // Com o app em segundo plano, o sistema fechar o app é normal; com a tela
    // aberta e sem saída pelo "Sim, sair", o app foi encerrado (falta de
    // memória ou erro).
    if (beat && beat.active && !beat.clean && beat.startedAt !== jsStartedAt) {
      exits.unshift({
        at: beat.beatAt,
        route: beat.route,
        version: beat.version,
        availMemMb: beat.availMemMb,
        minutesOpen: Math.max(0, Math.round((beat.beatAt - beat.startedAt) / 60_000)),
        activity: beat.activity ?? null,
      });
      if (exits.length > MAX_RECENT) exits.length = MAX_RECENT;
      await AsyncStorage.setItem(EXITS_KEY, JSON.stringify(exits));
    }
    state.previousExits = exits;
    // Registro técnico das sessões anteriores (fica até ser limpo): é ele que
    // mostra em que etapa o app estava quando o sistema o fechou.
    const rawLog = await AsyncStorage.getItem(LOG_KEY);
    const previous: TechnicalLogEntry[] = rawLog ? JSON.parse(rawLog) : [];
    if (Array.isArray(previous)) {
      state.log = [...state.log, ...previous].sort((a, b) => b.at - a.at).slice(0, MAX_LOG);
    }
  } catch {
    state.previousExits = [];
  }
}

/**
 * Por que o app fechou (2.17.55): o Android 11+ registra o motivo de cada
 * saída do processo (erro, falta de memória, travamento…) e o CrashRecorder
 * nativo guarda o último erro fatal. Entram no registro técnico e no
 * encerramento correspondente, sempre sanitizados.
 */
async function readExitCauses(): Promise<void> {
  try {
    const data = await native?.getExitReasons?.();
    if (!data) return;
    const seen = Number(await AsyncStorage.getItem(EXIT_SEEN_KEY)) || 0;
    const fresh = (data.reasons ?? []).filter((item) => item.at > seen).sort((a, b) => a.at - b.at);
    const crash = data.lastCrash ? { at: data.lastCrash.at, text: sanitizeError(data.lastCrash.text) } : null;
    let changed = false;
    for (const item of fresh) {
      // Saída pelo "Sim, sair" (o app encerra o próprio processo: aparece como
      // "sinal do sistema"), atualização e parada pelo usuário não são problema.
      // Fora erro, travamento e falta de memória, só conta se houve um
      // encerramento inesperado no mesmo momento.
      if (item.reason === 1 || item.reason === 16 || item.reason === 10 || item.reason === 11) continue;
      const serious = item.reason === 3 || item.reason === 4 || item.reason === 5 || item.reason === 6 || item.reason === 7 || item.reason === 9;
      const matchesExit = state.previousExits.some((entry) => Math.abs(entry.at - item.at) < 120_000);
      if (!serious && !matchesExit) continue;
      const label = EXIT_REASONS[item.reason] ?? `motivo ${item.reason}`;
      const memory = item.pssKb > 0 ? ` · app com ${Math.round(item.pssKb / 1024)} MB` : "";
      const crashText = crash && Math.abs(crash.at - item.at) < 120_000 ? crash.text : "";
      const detail = sanitizeError(crashText || item.trace || item.description || "").split("\n").slice(0, 2).join(" · ");
      const cause = `${label}${memory}${detail ? ` — ${detail}` : ""}`;
      pushLog({ at: item.at, scope: "Saída", message: cause.slice(0, 160), count: 1 });
      const exit = state.previousExits.find((entry) => !entry.cause && Math.abs(entry.at - item.at) < 120_000);
      if (exit) { exit.cause = cause.slice(0, 200); changed = true; }
      state.lastCause = { at: item.at, text: `${label}${memory}\n${sanitizeError(crashText || item.trace || item.description || "")}`.slice(0, 1500) };
    }
    if (!fresh.length && crash) {
      pushLog({ at: crash.at, scope: "Erro fatal", message: crash.text.split("\n").slice(0, 2).join(" · ").slice(0, 160), count: 1 });
      state.lastCause = { at: crash.at, text: crash.text.slice(0, 1500) };
    }
    if (changed) await AsyncStorage.setItem(EXITS_KEY, JSON.stringify(state.previousExits));
    const newest = Math.max(seen, ...(data.reasons ?? []).map((item) => item.at));
    if (newest > seen) await AsyncStorage.setItem(EXIT_SEEN_KEY, String(newest));
  } catch {
    // Diagnóstico opcional.
  }
}

/** Causa do último encerramento, para o Diagnóstico e o relatório. */
export function describeLastCause(): string | null {
  return state.lastCause ? `${clock(state.lastCause.at)}: ${state.lastCause.text}` : null;
}

/** Liga o monitor (uma vez, na abertura do app). */
export function startPerformanceMonitor(): void {
  if (state.started) return;
  state.started = true;
  onTechnicalLog(pushLog);

  void readPreviousSession().then(() => readExitCauses()).then(() => getMemorySnapshot()).then(() => writeBeat());

  let last = Date.now();
  setInterval(() => {
    const now = Date.now();
    const gap = now - last;
    last = now;
    if (!state.active || gap < PAUSE_MS) return;
    const ms = gap - TICK_MS;
    state.pauses += 1;
    state.pauseTotalMs += ms;
    state.maxPauseMs = Math.max(state.maxPauseMs, ms);
    pushRecent(state.recentPauses, { ms, route: state.route, at: now });
  }, TICK_MS);

  setInterval(() => {
    if (!state.active) return;
    void getMemorySnapshot().then(() => writeBeat());
  }, HEARTBEAT_MS);

  AppState.addEventListener("change", (status: AppStateStatus) => {
    const active = status === "active";
    if (active === state.active) return;
    state.active = active;
    // Na volta, o intervalo parado em segundo plano não é pausa da interface.
    last = Date.now();
    void writeBeat();
  });
}

/** Rota atual, para saber em que tela aconteceram pausas e encerramentos. */
export function setPerformanceRoute(route: string): void {
  if (state.route === route) return;
  state.route = route;
  if (state.started) void writeBeat();
}

/**
 * Atividade pesada em andamento (sincronização). Vai no registro de sessão,
 * gravado na hora: se o sistema fechar o app, o encerramento mostra em que
 * etapa ele estava.
 */
export function setPerformanceActivity(activity: string | null): void {
  const next = activity ? activity.slice(0, 80) : null;
  if (state.activity === next) return;
  const changedStage = (state.activity ?? "").split(":")[0] !== (next ?? "").split(":")[0];
  state.activity = next;
  if (state.started && changedStage) void writeBeat();
}

/** Saída pelo próprio app ("Sim, sair"): não conta como encerramento inesperado. */
export function markCleanExit(): Promise<void> {
  state.active = false;
  return writeBeat(true).catch(() => undefined);
}

/** Primeira tela pronta (Início ou login): fecha a medição de abertura. */
export function markAppReady(): void {
  if (state.startupMs !== null || state.jsStartupMs !== null) return;
  state.jsStartupMs = Date.now() - jsStartedAt;
  void getMemorySnapshot().then((snapshot) => {
    if (snapshot && snapshot.processUptimeMs > 0) state.startupMs = Math.round(snapshot.processUptimeMs);
  });
}

export function recordSyncTiming(stage: string, startedAt: number, items: number, mode: string): void {
  pushRecent(state.syncTimings, { stage, ms: Date.now() - startedAt, items, mode, at: Date.now() });
}

/**
 * Abertura de vídeos (como Samsung/LG 1.1.8): tempo do toque até a primeira
 * imagem, por tipo. Só nesta sessão; nada de endereço ou título.
 */
export function recordVideoOpen(kind: VideoOpenKind, ms: number | null, fromPreview: boolean): void {
  const list = state.opens[kind];
  list.unshift({ ms: ms === null ? null : Math.max(0, Math.round(ms)), fromPreview, at: Date.now() });
  if (list.length > MAX_OPENS) list.length = MAX_OPENS;
}

export function describeOpens(list: VideoOpen[]): string {
  if (list.length === 0) return "Nenhuma ainda";
  const ok = list.filter((item) => item.ms !== null).map((item) => item.ms as number);
  const failed = list.length - ok.length;
  const parts: string[] = [];
  if (ok.length) {
    const last = list.find((item) => item.ms !== null)?.ms ?? 0;
    parts.push(`último ${seconds(last)}`, `média ${seconds(ok.reduce((sum, value) => sum + value, 0) / ok.length)}`, `pior ${seconds(Math.max(...ok))}`);
  }
  if (failed) parts.push(`${failed} não ${failed === 1 ? "abriu" : "abriram"}`);
  const reused = list.filter((item) => item.fromPreview).length;
  if (reused) parts.push(`${reused} direto da prévia`);
  return parts.join(" · ");
}

export async function clearPerformanceHistory(): Promise<void> {
  state.opens = { live: [], movies: [], series: [] };
  state.pauses = 0;
  state.pauseTotalMs = 0;
  state.maxPauseMs = 0;
  state.recentPauses = [];
  state.syncTimings = [];
  state.previousExits = [];
  state.log = [];
  try { await Promise.all([AsyncStorage.removeItem(EXITS_KEY), AsyncStorage.removeItem(LOG_KEY)]); } catch { /* opcional */ }
}

export type PerformanceReport = {
  tier: string;
  uptimeMin: number;
  startupMs: number | null;
  jsStartupMs: number | null;
  pauses: number;
  pauseTotalMs: number;
  maxPauseMs: number;
  recentPauses: UiPause[];
  syncTimings: SyncTiming[];
  previousExits: UnexpectedExit[];
  memory: MemorySnapshot | null;
  jsHeapMb: number | null;
  log: TechnicalLogEntry[];
  opens: Record<VideoOpenKind, VideoOpen[]>;
};

export async function getPerformanceReport(): Promise<PerformanceReport> {
  const memory = await getMemorySnapshot();
  return {
    tier: deviceTier === "low" ? "Básico (pouca memória)" : deviceTier === "high" ? "Alto" : "Padrão",
    uptimeMin: Math.round((Date.now() - jsStartedAt) / 60_000),
    startupMs: state.startupMs,
    jsStartupMs: state.jsStartupMs,
    pauses: state.pauses,
    pauseTotalMs: state.pauseTotalMs,
    maxPauseMs: state.maxPauseMs,
    recentPauses: [...state.recentPauses],
    syncTimings: [...state.syncTimings],
    previousExits: [...state.previousExits],
    memory,
    jsHeapMb: getJsHeapMb(),
    log: state.log.map((entry) => ({ ...entry })),
    opens: { live: [...state.opens.live], movies: [...state.opens.movies], series: [...state.opens.series] },
  };
}

const TRIM_LABEL: Record<number, string> = { 5: "moderado", 10: "baixo", 15: "crítico", 80: "crítico" };

export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0).replace(".", ",")} s`;
}

function clock(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function describeTrim(memory: MemorySnapshot | null): string {
  if (!memory || memory.trimCount === 0) return "Nenhum";
  return `${memory.trimCount} (último: ${TRIM_LABEL[memory.lastTrimLevel] ?? memory.lastTrimLevel}, ${clock(memory.lastTrimAt)})`;
}

export function describeExit(exit: UnexpectedExit): string {
  const memory = exit.availMemMb !== null ? `, ${exit.availMemMb} MB livres` : "";
  const activity = exit.activity ? ` — durante: ${exit.activity}` : "";
  const cause = exit.cause ? ` — ${exit.cause}` : "";
  return `${clock(exit.at)} em ${exit.route} (v${exit.version}, ${exit.minutesOpen} min aberto${memory})${activity}${cause}`;
}

export function describeLog(entry: TechnicalLogEntry): string {
  return `${clock(entry.at)} · ${entry.message}${entry.count > 1 ? ` (${entry.count}x)` : ""}`;
}

export function describePause(pause: UiPause): string {
  return `${seconds(pause.ms)} em ${pause.route} às ${clock(pause.at).slice(6)}`;
}

export function describeSync(timing: SyncTiming): string {
  return `${seconds(timing.ms)} · ${timing.items.toLocaleString("pt-BR")} itens · ${timing.mode}`;
}

/** Texto para "Compartilhar relatório" (sem dados da conta). */
export function formatPerformanceReport(report: PerformanceReport): string[] {
  const memory = report.memory;
  const lines = [
    "— Desempenho —",
    `Perfil do aparelho: ${report.tier}`,
    `Abertura do app: ${report.startupMs !== null ? seconds(report.startupMs) : "não medida"}${report.jsStartupMs !== null ? ` (interface: ${seconds(report.jsStartupMs)})` : ""}`,
    `Aberto há: ${report.uptimeMin} min`,
    `Pausas da interface: ${report.pauses} (maior: ${seconds(report.maxPauseMs)}, total: ${seconds(report.pauseTotalMs)})`,
  ];
  if (memory) {
    lines.push(
      `Memória livre: ${Math.round(memory.availMemMb)} de ${Math.round(memory.totalMemMb)} MB${memory.lowMemory ? " (sistema em pouca memória)" : ""}`,
      `Memória do app: Java ${Math.round(memory.javaHeapUsedMb)}/${Math.round(memory.javaHeapMaxMb)} MB, nativa ${Math.round(memory.nativeHeapMb)} MB${report.jsHeapMb !== null ? `, JS ${Math.round(report.jsHeapMb)} MB` : ""}`,
      `Avisos de pouca memória: ${describeTrim(memory)}`,
    );
  }
  report.syncTimings.forEach((timing) => lines.push(`Sincronização ${timing.stage}: ${describeSync(timing)}`));
  lines.push(
    `Abertura de canais: ${describeOpens(report.opens.live)}`,
    `Abertura de filmes: ${describeOpens(report.opens.movies)}`,
    `Abertura de episódios: ${describeOpens(report.opens.series)}`,
  );
  const cause = describeLastCause();
  if (cause) lines.push(`Causa do último encerramento: ${cause}`);
  report.recentPauses.forEach((pause) => lines.push(`Pausa: ${describePause(pause)}`));
  if (report.previousExits.length === 0) lines.push("Encerramentos inesperados: nenhum");
  report.previousExits.forEach((exit) => lines.push(`Encerramento inesperado: ${describeExit(exit)}`));
  if (report.log.length) lines.push("— Registro técnico —");
  report.log.forEach((entry) => lines.push(`${entry.scope}: ${describeLog(entry)}`));
  return lines;
}
