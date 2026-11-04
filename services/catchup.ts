import type { ChannelItem, EpgProgram, ServerProfile } from "@/store/types";

function archiveDurationMinutes(program: EpgProgram): number | null {
  if (!program.startTimestamp || !program.endTimestamp || program.endTimestamp <= program.startTimestamp) return null;
  return Math.max(1, Math.ceil((program.endTimestamp - program.startTimestamp) / 60_000));
}

/**
 * Builds an archive URL only when the provider has explicitly advertised Catch-up.
 * Returning null is intentional: it prevents a fictional button for channels that
 * merely happen to have EPG data.
 */
export function buildCatchupUrl(
  channel: ChannelItem | undefined,
  profile: ServerProfile | undefined,
  program: EpgProgram,
): string | null {
  return buildCatchupCandidates(channel, profile, program)[0] ?? null;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** "AAAA-MM-DD:HH-MM" no horário do aparelho, formato aceito pela maioria dos painéis Xtream. */
export function formatXtreamArchiveStart(timestampMs: number): string {
  const date = new Date(timestampMs);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}:${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

/**
 * Endereços para rever um programa, em ordem de tentativa. Painéis Xtream
 * diferentes aceitam formatos diferentes (horário em segundos UTC ou data, e
 * caminho /timeshift ou /streaming/timeshift.php); o player tenta o próximo
 * quando um deles falha.
 */
export function buildCatchupCandidates(
  channel: ChannelItem | undefined,
  profile: ServerProfile | undefined,
  program: EpgProgram,
): string[] {
  if (!channel || !profile || !channel.catchupDays || channel.catchupDays <= 0) return [];
  const duration = archiveDurationMinutes(program);
  if (!duration || !program.startTimestamp || program.endTimestamp! > Date.now()) return [];
  const startUtc = Math.floor(program.startTimestamp / 1000);

  if (profile.sourceType === "m3u") {
    if (!channel.catchupSource) return [];
    return [channel.catchupSource
      .replaceAll("{utc}", String(startUtc))
      .replaceAll("{start}", String(startUtc))
      .replaceAll("{duration}", String(duration))];
  }

  if (!profile.serverUrl || !profile.username || !profile.password) return [];
  const base = profile.serverUrl.replace(/\/+$/, "");
  const user = encodeURIComponent(profile.username);
  const pass = encodeURIComponent(profile.password);
  const start = formatXtreamArchiveStart(program.startTimestamp);
  return [
    `${base}/timeshift/${profile.username}/${profile.password}/${duration}/${startUtc}/${channel.streamId}.m3u8`,
    `${base}/timeshift/${profile.username}/${profile.password}/${duration}/${start}/${channel.streamId}.ts`,
    `${base}/streaming/timeshift.php?username=${user}&password=${pass}&stream=${channel.streamId}&start=${start}&duration=${duration}`,
  ];
}
