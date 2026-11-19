import type { ChannelItem } from "@/store/types";

/**
 * Qualidades do mesmo canal numa linha só.
 *
 * Muitas listas trazem o mesmo canal várias vezes ("Globo SP FHD", "Globo SP
 * HD", "Globo SP SD", "Globo SP ALT"). Na listagem eles viram uma linha com o
 * nome sem a qualidade e "N fontes"; no player, "Fonte" troca entre elas e,
 * se uma não abre, o app passa para a próxima sozinho.
 *
 * Só junta canais da mesma categoria cujo nome, tirando as marcas de
 * qualidade, é igual. Nomes diferentes ("ESPN" e "ESPN 2", "Globo SP" e
 * "Globo RJ") continuam separados. Mesma regra no Roku, LG e Samsung.
 */

// Marcas de qualidade/fonte reconhecidas (sem acento, minúsculas).
const QUALITY_WORDS = String.raw`4k|uhd|fhd|full ?hd|hd|sd|hevc|h\.?265|h\.?264|1080p?|720p?|480p?|2160p?|[0-9]{2}fps|alt[0-9]?|alternativo|backup|bkp|reserva|op[cç][aã]o ?[0-9]|opc ?[0-9]`;
const QUALITY_TOKEN = new RegExp(String.raw`(^|[^a-z0-9])(${QUALITY_WORDS})(?=$|[^a-z0-9])`, "gi");
const SUPERSCRIPT_QUALITY = /ᵁᴴᴰ|ᶠᴴᴰ|ᴴᴰ|ˢᴰ|⁴ᴷ/g;

const LABELS: [RegExp, string][] = [
  [/(^|[^a-z0-9])(4k|uhd|2160p?)(?=$|[^a-z0-9])|⁴ᴷ|ᵁᴴᴰ/i, "4K"],
  [/(^|[^a-z0-9])(fhd|full ?hd|1080p?)(?=$|[^a-z0-9])|ᶠᴴᴰ/i, "FHD"],
  [/(^|[^a-z0-9])(h\.?265|hevc)(?=$|[^a-z0-9])/i, "H265"],
  [/(^|[^a-z0-9])(hd|720p?)(?=$|[^a-z0-9])|ᴴᴰ/i, "HD"],
  [/(^|[^a-z0-9])(sd|480p?)(?=$|[^a-z0-9])|ˢᴰ/i, "SD"],
  [/(^|[^a-z0-9])(alt[0-9]?|alternativo|backup|bkp|reserva|op[cç][aã]o ?[0-9]|opc ?[0-9])(?=$|[^a-z0-9])/i, "ALT"],
];

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Marca de qualidade do nome (4K, FHD, H265, HD, SD, ALT) ou null. */
export function qualityLabel(name: string): string | null {
  const plain = stripAccents(name);
  for (const [pattern, label] of LABELS) if (pattern.test(plain)) return label;
  return null;
}

/** Nome sem as marcas de qualidade, para comparar canais. */
export function channelGroupKey(name: string): string {
  return stripAccents(name)
    .toLowerCase()
    .replace(SUPERSCRIPT_QUALITY, " ")
    .replace(QUALITY_TOKEN, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Nome para mostrar na linha agrupada: o original sem a qualidade. */
export function channelGroupName(name: string): string {
  const base = name
    .replace(SUPERSCRIPT_QUALITY, " ")
    .replace(QUALITY_TOKEN, "$1")
    .replace(/[([{]\s*[)\]}]/g, " ")
    .replace(/\s*[-|:•·/]+\s*$/g, "")
    .replace(/^\s*[-|:•·/]+\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return base || name.trim();
}

/**
 * Junta as fontes do mesmo canal mantendo a ordem da lista: a linha fica na
 * posição da primeira fonte e usa o id dela. `sourceIds` só aparece quando há
 * mais de uma fonte.
 */
export function groupChannels(channels: ChannelItem[]): ChannelItem[] {
  if (channels.length < 2) return channels;
  const groups = new Map<string, ChannelItem[]>();
  const order: (ChannelItem | ChannelItem[])[] = [];
  for (const channel of channels) {
    const base = channelGroupKey(channel.name);
    if (!base) { order.push(channel); continue; }
    const key = `${channel.categoryId}\u0001${base}`;
    const existing = groups.get(key);
    if (existing) { existing.push(channel); continue; }
    const members = [channel];
    groups.set(key, members);
    order.push(members);
  }
  if (groups.size === channels.length) return channels;
  return order.map((entry) => {
    if (!Array.isArray(entry)) return entry;
    if (entry.length === 1) return entry[0];
    const first = entry[0];
    return { ...first, groupName: channelGroupName(first.name), sourceIds: entry.map((item) => item.id) };
  });
}

export type ChannelSource = { id: string; label: string };

/** Fontes do canal (ele incluído), na ordem da lista, com rótulos únicos. */
export function channelSources(channel: Pick<ChannelItem, "id" | "name" | "categoryId">, all: ChannelItem[]): ChannelSource[] {
  const key = channelGroupKey(channel.name);
  if (!key) return [{ id: channel.id, label: qualityLabel(channel.name) ?? "Fonte 1" }];
  const members = all.filter((item) => item.categoryId === channel.categoryId && channelGroupKey(item.name) === key);
  if (!members.some((item) => item.id === channel.id)) members.unshift(channel as ChannelItem);
  const used = new Map<string, number>();
  return members.map((item, index) => {
    const base = qualityLabel(item.name) ?? `Fonte ${index + 1}`;
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return { id: item.id, label: count > 1 ? `${base} ${count}` : base };
  });
}
