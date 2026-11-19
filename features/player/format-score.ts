import { detectLiveFormat } from "@/features/player/format-memory";
import { useAppStore } from "@/store/useAppStore";

/**
 * Desempenho de cada formato ao vivo (HLS e TS) por lista: quanto o canal
 * demora para abrir, quantas vezes não abriu e quantas vezes travou depois de
 * aberto. No "Auto", o próximo canal começa pelo formato que se sai melhor
 * nesta lista — e não só pelo último que abriu.
 *
 * Fica na preferência `liveFormatStats:<serverId>` (texto JSON pequeno, sem
 * endereço nem canal). Os contadores são divididos ao meio quando passam de
 * {@link MAX_SAMPLES}, para a escolha acompanhar mudanças do servidor.
 */
export type LiveFormat = "hls" | "ts";
export type FormatStat = { opens: number; fails: number; stalls: number; avgMs: number };
export type FormatStats = Partial<Record<LiveFormat, FormatStat>>;
export type FormatResult = { openMs: number } | { failed: true } | { stalled: true };

const MAX_SAMPLES = 40;
const MIN_SAMPLES = 3;
/** Peso de uma travada e de uma falha, em milissegundos de abertura. */
const STALL_COST_MS = 5_000;
const FAIL_COST_MS = 6_000;
/** Só troca de formato com ganho claro (evita alternar a cada canal). */
const MIN_GAIN = 0.15;
/** Formato lembrado que está ruim: vale testar o outro. */
const BAD_COST_MS = 6_000;

export function formatStatsKey(serverId: string | null | undefined): string | null {
  return serverId ? `liveFormatStats:${serverId}` : null;
}

function validStat(value: unknown): FormatStat | undefined {
  const stat = value as Partial<FormatStat> | null;
  if (!stat || typeof stat !== "object") return undefined;
  const number = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 0);
  return { opens: number(stat.opens), fails: number(stat.fails), stalls: number(stat.stalls), avgMs: number(stat.avgMs) };
}

export function readFormatStats(raw: unknown): FormatStats {
  if (typeof raw !== "string" || !raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const stats: FormatStats = {};
    const hls = validStat(parsed.hls);
    const ts = validStat(parsed.ts);
    if (hls) stats.hls = hls;
    if (ts) stats.ts = ts;
    return stats;
  } catch {
    return {};
  }
}

export function recordFormatResult(stats: FormatStats, format: LiveFormat, result: FormatResult): FormatStats {
  const current = stats[format] ?? { opens: 0, fails: 0, stalls: 0, avgMs: 0 };
  let next: FormatStat = { ...current };
  if ("openMs" in result) {
    const ms = Math.max(0, Math.min(60_000, Math.round(result.openMs)));
    next.avgMs = next.opens === 0 ? ms : Math.round(next.avgMs * 0.7 + ms * 0.3);
    next.opens += 1;
  } else if ("failed" in result) {
    next.fails += 1;
  } else {
    next.stalls += 1;
  }
  if (next.opens + next.fails > MAX_SAMPLES) {
    next = { ...next, opens: Math.ceil(next.opens / 2), fails: Math.floor(next.fails / 2), stalls: Math.floor(next.stalls / 2) };
  }
  return { ...stats, [format]: next };
}

/** Custo médio de assistir por este formato: abertura + travadas + falhas. */
export function formatCost(stat: FormatStat): number {
  const tries = stat.opens + stat.fails;
  return stat.avgMs
    + STALL_COST_MS * (stat.stalls / Math.max(1, stat.opens))
    + FAIL_COST_MS * (stat.fails / Math.max(1, tries));
}

/**
 * Formato para começar o próximo canal no "Auto". `remembered` é o último que
 * abriu (format-memory). Sem dados suficientes, fica com ele.
 */
export function chooseLiveFormat(stats: FormatStats, remembered: unknown): LiveFormat | null {
  const base: LiveFormat | null = remembered === "hls" || remembered === "ts" ? remembered : null;
  const hls = stats.hls;
  const ts = stats.ts;
  if (hls && ts && hls.opens >= MIN_SAMPLES && ts.opens >= MIN_SAMPLES) {
    const hlsCost = formatCost(hls);
    const tsCost = formatCost(ts);
    const best: LiveFormat = hlsCost <= tsCost ? "hls" : "ts";
    if (!base || best === base) return best;
    const baseCost = base === "hls" ? hlsCost : tsCost;
    const bestCost = best === "hls" ? hlsCost : tsCost;
    return bestCost <= baseCost * (1 - MIN_GAIN) ? best : base;
  }
  if (!base) return null;
  // Só o lembrado tem histórico e ele está lento ou travando: testa o outro
  // (o lembrado continua como segunda opção, então o canal abre do mesmo jeito).
  const own = stats[base];
  const other: LiveFormat = base === "hls" ? "ts" : "hls";
  const otherStat = stats[other];
  const otherTries = otherStat ? otherStat.opens + otherStat.fails : 0;
  if (own && own.opens >= 5 && formatCost(own) >= BAD_COST_MS && otherTries < MIN_SAMPLES) return other;
  return base;
}

/** Formato lembrado já ajustado pelo desempenho, para a lista ativa. */
export function preferredLiveFormat(serverId: string | null | undefined, remembered: unknown): LiveFormat | null {
  const key = formatStatsKey(serverId);
  const stats = key ? readFormatStats(useAppStore.getState().preferences[key]) : {};
  return chooseLiveFormat(stats, remembered);
}

/** Registra o resultado de uma abertura, falha ou travada do ao vivo. */
export function noteLiveFormat(serverId: string | null | undefined, url: string | undefined, result: FormatResult): void {
  const key = formatStatsKey(serverId);
  const format = detectLiveFormat(url);
  if (!key || !format) return;
  const state = useAppStore.getState();
  state.setPreference(key, JSON.stringify(recordFormatResult(readFormatStats(state.preferences[key]), format, result)));
}

export function describeFormatStats(stats: FormatStats): string {
  const parts: string[] = [];
  for (const format of ["hls", "ts"] as const) {
    const stat = stats[format];
    if (!stat || stat.opens + stat.fails === 0) continue;
    const seconds = (stat.avgMs / 1000).toFixed(1).replace(".", ",");
    const bits = [`${stat.opens} ${stat.opens === 1 ? "abertura" : "aberturas"}`];
    if (stat.opens) bits.push(`média ${seconds} s`);
    if (stat.fails) bits.push(`${stat.fails} não ${stat.fails === 1 ? "abriu" : "abriram"}`);
    if (stat.stalls) bits.push(`${stat.stalls} ${stat.stalls === 1 ? "travada" : "travadas"}`);
    parts.push(`${format.toUpperCase()}: ${bits.join(", ")}`);
  }
  return parts.join(" · ");
}
