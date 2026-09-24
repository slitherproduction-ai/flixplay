import { useEffect, useMemo, useState } from "react";
import {
  getShortEpg,
  getSimpleDataTable,
  normalizeEpgListings,
  refreshEpgProgress,
} from "@/services/xtream";
import { useAppStore } from "@/store/useAppStore";
import type { ChannelItem, EpgProgram, ServerProfile } from "@/store/types";

export const EPG_CACHE_TTL_MS = 5 * 60 * 1000;
const EPG_CLOCK_INTERVAL_MS = 30 * 1000;
const epgRequests = new Map<string, Promise<EpgProgram[]>>();

export function hasFreshEpg(channel: ChannelItem, now = Date.now()): boolean {
  const updatedAt = channel.epgUpdatedAt ? new Date(channel.epgUpdatedAt).getTime() : 0;
  return Boolean(channel.epgPrograms?.length && now - updatedAt < EPG_CACHE_TTL_MS);
}

export function fetchChannelEpg(
  profile: ServerProfile,
  channel: ChannelItem,
): Promise<EpgProgram[]> {
  const requestKey = `${profile.id}:${channel.streamId}`;
  const pending = epgRequests.get(requestKey);
  if (pending) return pending;

  const request = (async () => {
    const shortResult = await getShortEpg(profile, channel.streamId, 12);
    let listings = shortResult.epg_listings ?? [];
    if (listings.length === 0) {
      const fullResult = await getSimpleDataTable(profile, channel.streamId);
      listings = fullResult.epg_listings ?? [];
    }
    return normalizeEpgListings(listings);
  })().finally(() => {
    epgRequests.delete(requestKey);
  });

  epgRequests.set(requestKey, request);
  return request;
}

function resolveNowNext(programs: EpgProgram[], nowMs: number) {
  const refreshed = refreshEpgProgress(programs, nowMs);
  const current = refreshed.find((program) => program.isCurrent) ?? null;
  const next = refreshed.find((program) => (program.startTimestamp ?? 0) > nowMs) ?? null;
  return { programs: refreshed, current, next };
}

export function useChannelEpg(channelId: string | undefined) {
  const channels = useAppStore((state) => state.contentCache.liveChannels);
  const servers = useAppStore((state) => state.servers);
  const activeServerId = useAppStore((state) => state.activeServerId);
  const updateChannelEpg = useAppStore((state) => state.updateChannelEpg);
  const channel = channels.find((item) => item.id === channelId);
  const profile = servers.find((server) => server.id === activeServerId) ?? servers[0];
  const [programs, setPrograms] = useState<EpgProgram[]>(channel?.epgPrograms ?? []);
  const [clock, setClock] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setClock(Date.now()), EPG_CLOCK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setPrograms(channel?.epgPrograms ?? []);
  }, [channelId, channel?.epgPrograms]);

  useEffect(() => {
    if (!channel || !profile || !channel.streamId) return;
    if (hasFreshEpg(channel)) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const normalized = await fetchChannelEpg(profile, channel);
        if (cancelled) return;
        setPrograms(normalized);
        if (normalized.length > 0) updateChannelEpg(channel.id, normalized);
      } catch (loadError) {
        if (cancelled) return;
        console.error("Falha ao carregar EPG real", loadError);
        setError("Programação indisponível para este canal.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [channel, profile, updateChannelEpg]);

  const resolved = useMemo(() => resolveNowNext(programs, clock), [programs, clock]);
  return { ...resolved, isLoading, error };
}
