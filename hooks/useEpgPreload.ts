import { useCallback, useEffect, useMemo, useRef } from "react";
import { fetchChannelEpg, hasFreshEpg } from "@/hooks/useChannelEpg";
import { useAppStore } from "@/store/useAppStore";
import type { ChannelItem, EpgProgram, ServerProfile } from "@/store/types";

/**
 * Enough parallelism to make the guide visible while the first rows render,
 * without flooding low-end TV devices or providers with a burst of requests.
 */
// Fire TV devices have limited decoder/network headroom while preview video is
// active. Two requests retain responsive Now/Next information without the
// burst of state updates that caused navigation stalls on large playlists.
const EPG_PRELOAD_CONCURRENCY = 2;
export const EPG_HOME_PRELOAD_LIMIT = 24;
export const EPG_LIVE_PRELOAD_LIMIT = 24;
type UpdateChannelEpg = ReturnType<typeof useAppStore.getState>["updateChannelEpg"];
type UpdateChannelEpgBatch = ReturnType<typeof useAppStore.getState>["updateChannelEpgBatch"];
type EpgJob = { key: string; profile: ServerProfile; channel: ChannelItem; update: UpdateChannelEpg };

// Fila curta: ao rolar rápido, pedidos de canais que já saíram da tela são
// descartados (os mais antigos) em vez de ocupar a rede por minutos.
const EPG_QUEUE_LIMIT = 48;
// Cada lote recria a lista de canais no store: juntar mais respostas por lote
// reduz as re-renderizações em listas de 8–30 mil canais.
const EPG_BATCH_WINDOW_MS = 500;

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
  const updateChannelEpgBatch = useAppStore((state) => state.updateChannelEpgBatch);
  const pendingBatch = useRef<Array<{ channelId: string; programs: EpgProgram[] }>>([]);
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (batchTimer.current) clearTimeout(batchTimer.current);
    const batch = pendingBatch.current.splice(0);
    if (batch.length) updateChannelEpgBatch(batch);
  }, [updateChannelEpgBatch]);
  const profile = servers.find((server) => server.id === activeServerId) ?? servers[0];

  return useCallback(
    (channels: ChannelItem[], limit = 20) => {
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
        epgQueue.push({ key, profile, channel, update: (channelId, programs) => {
          pendingBatch.current.push({ channelId, programs });
          if (batchTimer.current) return;
          batchTimer.current = setTimeout(() => {
            const batch = pendingBatch.current.splice(0);
            batchTimer.current = null;
            updateChannelEpgBatch(batch);
          }, EPG_BATCH_WINDOW_MS);
        } });
      }
      while (epgQueue.length > EPG_QUEUE_LIMIT) {
        const stale = epgQueue.shift();
        if (stale) queuedKeys.delete(stale.key);
      }
      drainEpgQueue();
    },
    [profile, updateChannelEpgBatch],
  );
}

export function useEpgPreload(channels: ChannelItem[], limit = 30) {
  const preload = useEpgPreloader();
  const signature = useMemo(
    () => channels.slice(0, limit).map((channel) => channel.id).join("|"),
    [channels, limit],
  );

  useEffect(() => {
    preload(channels, limit);
  }, [channels, limit, preload, signature]);
}
