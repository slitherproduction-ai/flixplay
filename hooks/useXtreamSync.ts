import { useCallback, useEffect } from "react";
import {
  getLiveCategories,
  getLiveStreams,
  getVodCategories,
  getVodStreams,
  getSeriesCategories,
  getSeries,
  mapLiveStreamToChannel,
  mapVodStreamToMovie,
  mapSeriesStreamToItem,
  XtreamApiError,
} from "@/services/xtream";
import { useAppStore } from "@/store/useAppStore";
import type { SyncState } from "@/store/useAppStore";
import type { ServerProfile } from "@/store/types";

/**
 * Index an array of objects by category_id, normalising both sides to string.
 *
 * The Xtream Codes API defines category_id as a string in some variants but
 * often returns it as a JSON number (e.g. 12 instead of "12"). Normalising to
 * String() ensures Map lookups always succeed regardless of the API variant.
 */
function indexBy<T extends { category_id: string | number }>(
  categories: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const cat of categories) map.set(String(cat.category_id), cat);
  return map;
}

async function fetchAndCacheContent(
  profile: ServerProfile,
  setContentCache: ReturnType<typeof useAppStore.getState>["setContentCache"],
  setSyncState: ReturnType<typeof useAppStore.getState>["setSyncState"],
): Promise<void> {
  try {
    // ── Live channels ────────────────────────────────────────────────────────
    setSyncState({ syncProgress: "Sincronizando canais ao vivo..." });
    const [liveCategories, liveStreams] = await Promise.all([
      getLiveCategories(profile),
      getLiveStreams(profile),
    ]);
    const liveCatMap = indexBy(liveCategories);
    setContentCache({
      liveCategories: liveCategories.map((c) => ({ id: String(c.category_id), name: c.category_name })),
      liveChannels: liveStreams.map((stream) =>
        mapLiveStreamToChannel(
          stream,
          // Normalise category_id to string for Map lookup
          liveCatMap.get(String(stream.category_id)) ?? {
            category_id: String(stream.category_id),
            category_name: "Geral",
            parent_id: 0,
          },
          profile,
        ),
      ),
    });

    // ── VOD movies ───────────────────────────────────────────────────────────
    setSyncState({ syncProgress: "Baixando catálogo de filmes..." });
    const [vodCategories, vodStreams] = await Promise.all([
      getVodCategories(profile),
      getVodStreams(profile),
    ]);
    const vodCatMap = indexBy(vodCategories);
    setContentCache({
      vodCategories: vodCategories.map((c) => ({ id: String(c.category_id), name: c.category_name })),
      vodMovies: vodStreams.map((stream) =>
        mapVodStreamToMovie(
          stream,
          vodCatMap.get(String(stream.category_id)),
          profile,
        ),
      ),
    });

    // ── Series ───────────────────────────────────────────────────────────────
    setSyncState({ syncProgress: "Baixando catálogo de séries..." });
    const [seriesCategories, seriesList] = await Promise.all([
      getSeriesCategories(profile),
      getSeries(profile),
    ]);
    const seriesCatMap = indexBy(seriesCategories);
    setContentCache({
      seriesCategories: seriesCategories.map((c) => ({ id: String(c.category_id), name: c.category_name })),
      seriesList: seriesList.map((stream) =>
        mapSeriesStreamToItem(stream, seriesCatMap.get(String(stream.category_id))),
      ),
      lastSyncedAt: new Date().toISOString(),
    });

    setSyncState({ isSyncing: false, syncError: null, syncProgress: null });
  } catch (err) {
    console.error("Falha ao sincronizar conteúdo Xtream", err);
    const message =
      err instanceof XtreamApiError
        ? err.message
        : "Não foi possível carregar o conteúdo do servidor.";
    setSyncState({ isSyncing: false, syncError: message, syncProgress: null });
  }
}

/**
 * Single-instance sync driver — call ONLY from the tabs layout.
 *
 * Uses store-level guards (isSyncing + lastSyncedServerId) to prevent
 * concurrent syncs. The setSyncState({ isSyncing: true, lastSyncedServerId })
 * call is the FIRST synchronous operation before any await, so by the time
 * another hook instance runs in the same event-loop tick, the guard is set.
 */
export function useXtreamSync() {
  const activeServerId = useAppStore((state) => state.activeServerId);
  const syncState = useAppStore((state) => state.syncState);
  const setContentCache = useAppStore((state) => state.setContentCache);
  const setSyncState = useAppStore((state) => state.setSyncState);
  const forceResync = useAppStore((state) => state.forceResync);

  const doSync = useCallback(
    async (profile: ServerProfile) => {
      // MUST be synchronous and FIRST — marks isSyncing=true before any await
      // so any concurrent effect invocations in the same event-loop tick see
      // the guard and return early.
      setSyncState({
        isSyncing: true,
        lastSyncedServerId: profile.id,
        syncError: null,
        syncProgress: "Conectando ao servidor...",
      });
      await fetchAndCacheContent(profile, setContentCache, setSyncState);
    },
    [setContentCache, setSyncState],
  );

  useEffect(() => {
    if (!activeServerId) return;
    if (syncState.isSyncing) return;
    if (syncState.lastSyncedServerId === activeServerId) return;

    // Read servers without subscribing to avoid extra renders
    const server = useAppStore.getState().servers.find((s) => s.id === activeServerId);
    if (!server) return;

    void doSync(server);
  }, [activeServerId, syncState.isSyncing, syncState.lastSyncedServerId, doSync]);

  const refresh = useCallback(() => {
    if (syncState.isSyncing) return;
    forceResync();
  }, [syncState.isSyncing, forceResync]);

  return { syncState, refresh };
}

/** Lightweight hook for screens — reads sync state without driving syncs. */
export function useSyncStatus(): SyncState & { refresh: () => void } {
  const syncState = useAppStore((state) => state.syncState);
  const forceResync = useAppStore((state) => state.forceResync);
  const refresh = useCallback(() => {
    if (!syncState.isSyncing) forceResync();
  }, [syncState.isSyncing, forceResync]);
  return { ...syncState, refresh };
}
