import { useCallback, useEffect, useMemo, useRef } from "react";
import { fetchChannelEpg, hasFreshEpg } from "@/hooks/useChannelEpg";
import { useAppStore } from "@/store/useAppStore";
import type { ChannelItem, ServerProfile } from "@/store/types";

const EPG_PRELOAD_CONCURRENCY = 4;
type UpdateChannelEpg = ReturnType<typeof useAppStore.getState>["updateChannelEpg"];
type EpgJob = { key: string; profile: ServerProfile; channel: ChannelItem; update: UpdateChannelEpg };

const queuedKeys = new Set<string>();
const epgQueue: EpgJob[] = [];
let activeJobs = 0;

function drainEpgQueue() {
  while (activeJobs < EPG_PRELOAD_CONCURRENCY && epgQueue.length > 0) {
    const job = epgQueue.shift();
    if (!job) return;
    activeJobs += 1;
    void fetchChannelEpg(job.profile, job.channel)
      .then((programs) => {
        if (programs.length > 0) job.update(job.channel.id, programs);
      })
      .catch(() => {
        // A grade continua utilizável quando um canal não fornece EPG.
      })
      .finally(() => {
        queuedKeys.delete(job.key);
        activeJobs -= 1;
        drainEpgQueue();
      });
  }
}

export function useEpgPreloader() {
  const servers = useAppStore((state) => state.servers);
  const activeServerId = useAppStore((state) => state.activeServerId);
  const updateChannelEpg = useAppStore((state) => state.updateChannelEpg);
  const profile = servers.find((server) => server.id === activeServerId) ?? servers[0];

  return useCallback(
    (channels: ChannelItem[], limit = 30) => {
      if (!profile) return;
      const pending = channels
        .slice(0, limit)
        .filter((channel) => {
          const key = `${profile.id}:${channel.streamId}`;
          return channel.streamId && !hasFreshEpg(channel) && !queuedKeys.has(key);
        });
      if (pending.length === 0) return;

      for (const channel of pending) {
        const key = `${profile.id}:${channel.streamId}`;
        queuedKeys.add(key);
        epgQueue.push({ key, profile, channel, update: updateChannelEpg });
      }
      drainEpgQueue();
    },
    [profile, updateChannelEpg],
  );
}

export function useEpgPreload(channels: ChannelItem[], limit = 30) {
  const preload = useEpgPreloader();
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const signature = useMemo(
    () => channels.slice(0, limit).map((channel) => channel.id).join("|"),
    [channels, limit],
  );

  useEffect(() => {
    preload(channelsRef.current, limit);
  }, [limit, preload, signature]);
}
