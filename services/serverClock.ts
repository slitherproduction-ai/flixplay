/**
 * Hora certa para o guia (EPG) mesmo com o relógio do aparelho errado.
 *
 * Muitas TV boxes ficam com a hora errada (sem internet na ligação, bateria do
 * relógio fraca). O guia então marca como "agora" o programa errado e o
 * "Rever" fica indisponível. A hora do servidor da lista vem em toda resposta
 * (cabeçalho HTTP `Date`, em UTC) e na conta Xtream (`timestamp_now`).
 *
 * - Diferença menor que {@link MIN_OFFSET_MS}: o aparelho está certo, nada muda.
 * - Cabeçalho `Date`: vale depois de duas respostas que concordam (evita uma
 *   resposta antiga vinda de cache).
 * - `timestamp_now`: só sem cabeçalho; ignorado quando a diferença é um número
 *   quase exato de horas (painéis que mandam a hora local como se fosse UTC).
 *
 * Usado só nos cálculos do guia e do Rever. Mesma regra no Roku, LG e Samsung.
 */
const MIN_OFFSET_MS = 2 * 60_000;
const AGREE_MS = 30_000;
const HOUR_MS = 3_600_000;
const EARLIEST_VALID = Date.UTC(2024, 0, 1);

let offsetMs = 0;
let fromHeader = false;
let pendingHeaderOffset: number | null = null;

/** Agora, pelo relógio do servidor quando o do aparelho está errado. */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** Correção aplicada, em milissegundos (0 = relógio do aparelho certo). */
export function serverClockOffsetMs(): number {
  return offsetMs;
}

function apply(candidate: number): void {
  offsetMs = Math.abs(candidate) < MIN_OFFSET_MS ? 0 : Math.round(candidate);
}

/** Cabeçalho HTTP `Date` de uma resposta do servidor da lista. */
export function noteServerDate(header: string | null | undefined, receivedAt = Date.now()): void {
  if (!header) return;
  const serverMs = Date.parse(header);
  if (!Number.isFinite(serverMs) || serverMs < EARLIEST_VALID) return;
  // O cabeçalho corta os segundos quebrados: em média meio segundo atrás.
  const candidate = serverMs + 500 - receivedAt;
  if (pendingHeaderOffset !== null && Math.abs(candidate - pendingHeaderOffset) <= AGREE_MS) {
    fromHeader = true;
    apply(candidate);
  }
  pendingHeaderOffset = candidate;
}

/** `server_info.timestamp_now` (segundos) da conta Xtream. */
export function noteServerTimestamp(seconds: unknown, receivedAt = Date.now()): void {
  if (fromHeader) return;
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return;
  const serverMs = value * 1000;
  if (serverMs < EARLIEST_VALID) return;
  const candidate = serverMs - receivedAt;
  const hours = Math.round(candidate / HOUR_MS);
  if (hours !== 0 && Math.abs(hours) <= 14 && Math.abs(candidate - hours * HOUR_MS) < MIN_OFFSET_MS) return;
  apply(candidate);
}

/** Só para testes. */
export function resetServerClock(): void {
  offsetMs = 0;
  fromHeader = false;
  pendingHeaderOffset = null;
}
