import type { EpgProgram } from "@/store/types";

export type XmltvProgramme = EpgProgram & { channelId: string };

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function safeCodePoint(code: number): string {
  try { return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : ""; } catch { return ""; }
}

/** "HH:MM" no fuso do aparelho, sem Intl (toLocaleTimeString custa caro por programa no Hermes). */
export function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Janela guardada: 7 dias para trás (rever programas) e 2 dias à frente. */
const KEEP_PAST_MS = 7 * 24 * 60 * 60 * 1000;
const KEEP_FUTURE_MS = 2 * 24 * 60 * 60 * 1000;

/** Parses the common XMLTV timestamp form: YYYYMMDDhhmmss ±HHMM. */
export function parseXmltvTimestamp(value: string): number | null {
  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, sign, offsetHour, offsetMinute] = match;
  const utc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  if (!sign) return utc;
  const offset = (Number(offsetHour) * 60 + Number(offsetMinute)) * 60_000;
  return sign === "+" ? utc - offset : utc + offset;
}

/** Tolerant XMLTV reader: ignores malformed programmes and preserves only usable EPG records. */
export function parseXmltv(text: string, now = Date.now()): Map<string, XmltvProgramme[]> {
  const byChannel = new Map<string, XmltvProgramme[]>();
  const programmePattern = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;
  for (const match of text.matchAll(programmePattern)) {
    const attrs = match[1];
    const body = match[2];
    const channelId = attrs.match(/\bchannel=["']([^"']+)["']/i)?.[1]?.trim();
    const start = attrs.match(/\bstart=["']([^"']+)["']/i)?.[1] ?? "";
    const end = attrs.match(/\bstop=["']([^"']+)["']/i)?.[1] ?? "";
    const startTimestamp = parseXmltvTimestamp(start);
    const endTimestamp = parseXmltvTimestamp(end);
    const title = body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    if (!channelId || startTimestamp === null || endTimestamp === null || endTimestamp <= startTimestamp || !title.trim()) continue;
    if (endTimestamp < now - KEEP_PAST_MS || startTimestamp > now + KEEP_FUTURE_MS) continue;
    const isCurrent = startTimestamp <= now && now < endTimestamp;
    const progress = isCurrent ? Math.max(0, Math.min(100, Math.round(((now - startTimestamp) / (endTimestamp - startTimestamp)) * 100))) : 0;
    const item: XmltvProgramme = { channelId, title: decodeXml(title), start: formatClock(startTimestamp), end: formatClock(endTimestamp), progress, startTimestamp, endTimestamp, isCurrent };
    // push no próprio array: recriar a lista a cada programa era quadrático.
    const list = byChannel.get(channelId);
    if (list) list.push(item);
    else byChannel.set(channelId, [item]);
  }
  for (const programmes of byChannel.values()) programmes.sort((a, b) => (a.startTimestamp ?? 0) - (b.startTimestamp ?? 0));
  return byChannel;
}

export async function fetchXmltv(url: string, signal?: AbortSignal): Promise<Map<string, XmltvProgramme[]>> {
  if (!/^https?:\/\//i.test(url)) throw new Error("Informe uma URL XMLTV válida.");
  const response = await fetchWithTimeout(url, 90_000, signal);
  if (!response.ok) throw new Error("Não foi possível baixar a programação XMLTV.");
  return parseXmltv(await response.text());
}

/** fetch com tempo limite e o mesmo User-Agent aceito pelos painéis IPTV. */
export async function fetchWithTimeout(url: string, timeoutMs: number, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    return await fetch(url, { signal: controller.signal, headers: { "User-Agent": "IPTVSmartersPro/3.1.5", Accept: "*/*" } });
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) throw new Error("O servidor da lista demorou para responder.");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
