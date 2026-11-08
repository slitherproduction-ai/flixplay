import type { ChannelItem, ServerProfile } from "@/store/types";
import { parseM3uPlaylist } from "@/services/xtream";
import { fetchWithTimeout, fetchXmltv, type XmltvProgramme } from "@/services/xmltv";

/** Hash curto e estável (FNV-1a 32 bits) para identificar um link sem guardá-lo. */
export function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Id de canal M3U que não muda quando o provedor reordena ou acrescenta canais:
 * tvg-id (ou nome) + hash do link. Antes era a posição na lista, e favoritos e
 * histórico passavam a apontar para outro canal.
 */
export function m3uChannelId(entry: { tvgId: string; name: string; group: string; url: string }): string {
  return `m3u-${entry.tvgId || entry.name}-${stableHash(`${entry.group}\u0000${entry.url}`)}`;
}

export async function fetchM3uChannels(profile: ServerProfile, signal?: AbortSignal): Promise<{ categories: { id: string; name: string }[]; channels: ChannelItem[] }> {
  if (!profile.m3uUrl || !/^https?:\/\//i.test(profile.m3uUrl)) throw new Error("Informe uma URL M3U válida.");
  const response = await fetchWithTimeout(profile.m3uUrl, 120_000, signal);
  if (!response.ok) throw new Error("Não foi possível baixar a lista M3U.");
  const entries = parseM3uPlaylist(await response.text());
  if (entries.length === 0) throw new Error("A lista M3U não contém canais válidos.");
  const guide: Map<string, XmltvProgramme[]> = profile.xmltvUrl ? await fetchXmltv(profile.xmltvUrl, signal) : new Map();
  const categories = [...new Set(entries.map((entry) => entry.group))].map((name) => ({ id: `m3u-category-${name}`, name }));
  const channels = entries.map((entry, index) => {
    const programmes = guide.get(entry.tvgId || entry.id) ?? [];
    const current = programmes.find((programme) => programme.isCurrent) ?? programmes[0];
    const next = programmes.find((programme) => (programme.startTimestamp ?? 0) > (current?.startTimestamp ?? Number.MAX_SAFE_INTEGER));
    return { id: m3uChannelId(entry), name: entry.name, number: entry.number ?? String(index + 1), streamId: entry.id, logo: entry.logo, categoryId: `m3u-category-${entry.group}`, categoryName: entry.group, epgChannelId: entry.tvgId || undefined, currentEpg: current ?? { title: "Programação não informada", start: "--:--", end: "--:--", progress: 0 }, nextProgram: next?.title ?? "Programação não informada", epgPrograms: programmes, catchupDays: entry.catchupDays, catchupSource: entry.catchupSource, streamUrl: entry.url };
  });
  return { categories, channels };
}
