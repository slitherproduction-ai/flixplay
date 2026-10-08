import type { ChannelItem } from "@/store/types";

/**
 * SQLite pagination intentionally stores only serialisable catalogue fields.
 * EPG is refreshed in the Zustand cache, so pages need this non-mutating join
 * before they are rendered; otherwise the list keeps showing stale placeholders.
 */
export function hydratePagedChannelsWithEpg(
  pagedChannels: ChannelItem[],
  liveChannels: ChannelItem[],
): ChannelItem[] {
  const liveById = new Map(liveChannels.map((channel) => [channel.id, channel]));
  return pagedChannels.map((channel) => {
    const hydrated = liveById.get(channel.id);
    if (!hydrated?.epgUpdatedAt) return channel;
    return {
      ...channel,
      currentEpg: hydrated.currentEpg,
      nextProgram: hydrated.nextProgram,
      epgPrograms: hydrated.epgPrograms,
      epgUpdatedAt: hydrated.epgUpdatedAt,
    };
  });
}
