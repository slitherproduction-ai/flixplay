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
  if (!channel || !profile || !channel.catchupDays || channel.catchupDays <= 0) return null;
  const duration = archiveDurationMinutes(program);
  if (!duration || !program.startTimestamp || program.endTimestamp! > Date.now()) return null;
  const startUtc = Math.floor(program.startTimestamp / 1000);

  if (profile.sourceType === "m3u") {
    if (!channel.catchupSource) return null;
    return channel.catchupSource
      .replaceAll("{utc}", String(startUtc))
      .replaceAll("{start}", String(startUtc))
      .replaceAll("{duration}", String(duration));
  }

  if (!profile.serverUrl || !profile.username || !profile.password) return null;
  return `${profile.serverUrl.replace(/\/+$/, "")}/timeshift/${profile.username}/${profile.password}/${duration}/${startUtc}/${channel.streamId}.m3u8`;
}
