import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, NativeModules, Platform, type AppStateStatus } from "react-native";
import { APP_INFO } from "@/constants/app";
import { deviceTier } from "@/services/deviceProfile";
import { onTechnicalLog, type TechnicalLogEntry } from "@/services/security/sanitize";

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
export type UnexpectedExit = { at: number; route: string; version: string; availMemMb: number | null; minutesOpen: number; activity?: string | null };

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

type NativeProfile = { getMemorySnapshot?: () => Promise<MemorySnapshot> };
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
};

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

/** Liga o monitor (uma vez, na abertura do app). */
export function startPerformanceMonitor(): void {
  if (state.started) return;
  state.started = true;
  onTechnicalLog(pushLog);

  void readPreviousSession().then(() => getMemorySnapshot()).then(() => writeBeat());

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
export function markCleanExit(): void {
  state.active = false;
  void writeBeat(true);
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

export async function clearPerformanceHistory(): Promise<void> {
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
  return `${clock(exit.at)} em ${exit.route} (v${exit.version}, ${exit.minutesOpen} min aberto${memory})${activity}`;
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
  report.recentPauses.forEach((pause) => lines.push(`Pausa: ${describePause(pause)}`));
  if (report.previousExits.length === 0) lines.push("Encerramentos inesperados: nenhum");
  report.previousExits.forEach((exit) => lines.push(`Encerramento inesperado: ${describeExit(exit)}`));
  if (report.log.length) lines.push("— Registro técnico —");
  report.log.forEach((entry) => lines.push(`${entry.scope}: ${describeLog(entry)}`));
  return lines;
}
