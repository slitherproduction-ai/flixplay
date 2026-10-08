import type { EpgProgram } from "@/store/types";

export type XmltvProgramme = EpgProgram & { channelId: string };

function decodeXml(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

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
    const isCurrent = startTimestamp <= now && now < endTimestamp;
    const progress = isCurrent ? Math.max(0, Math.min(100, Math.round(((now - startTimestamp) / (endTimestamp - startTimestamp)) * 100))) : 0;
    const item: XmltvProgramme = { channelId, title: decodeXml(title), start: new Date(startTimestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), end: new Date(endTimestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), progress, startTimestamp, endTimestamp, isCurrent };
    byChannel.set(channelId, [...(byChannel.get(channelId) ?? []), item]);
  }
  for (const [channelId, programmes] of byChannel) byChannel.set(channelId, programmes.sort((a, b) => (a.startTimestamp ?? 0) - (b.startTimestamp ?? 0)));
  return byChannel;
}

export async function fetchXmltv(url: string, signal?: AbortSignal): Promise<Map<string, XmltvProgramme[]>> {
  if (!/^https?:\/\//i.test(url)) throw new Error("Informe uma URL XMLTV válida.");
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Não foi possível baixar a programação XMLTV.");
  return parseXmltv(await response.text());
}
