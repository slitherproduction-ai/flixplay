import { useCallback, useEffect, useRef } from "react";
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
import type { ServerProfile } from "@/store/types";

/** Index a category array by id for O(1) lookup */
function indexBy<T extends { category_id: string }>(
  categories: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const cat of categories) {
    map.set(cat.category_id, cat);
  }
  return map;
}

async function syncAllContent(
  profile: ServerProfile,
  setContentCache: ReturnType<typeof useAppStore.getState>["setContentCache"],
  setSyncState: ReturnType<typeof useAppStore.getState>["setSyncState"],
): Promise<void> {
  setSyncState({ isSyncing: true, syncError: null, syncProgress: "Conectando ao servidor..." });

  try {
    // --- Live TV ---
    setSyncState({ syncProgress: "Sincronizando canais ao vivo..." });
    const [liveCategories, liveStreams] = await Promise.all([
      getLiveCategories(profile),
      getLiveStreams(profile),
    ]);
    const liveCatMap = indexBy(liveCategories);
    const liveChannels = liveStreams.map((stream) =>
      mapLiveStreamToChannel(
        stream,
        liveCatMap.get(stream.category_id) ?? {
          category_id: stream.category_id,
          category_name: "Geral",
          parent_id: 0,
        },
        profile,
      ),
    );
    setContentCache({
      liveCategories: liveCategories.map((c) => ({
        id: c.category_id,
        name: c.category_name,
      })),
      liveChannels,
    });

    // --- VOD / Movies ---
    setSyncState({ syncProgress: "Baixando catálogo de filmes..." });
    const [vodCategories, vodStreams] = await Promise.all([
      getVodCategories(profile),
      getVodStreams(profile),
    ]);
    const vodCatMap = indexBy(vodCategories);
    const vodMovies = vodStreams.map((stream) =>
      mapVodStreamToMovie(
        stream,
        vodCatMap.get(stream.category_id),
        profile,
      ),
    );
    setContentCache({
      vodCategories: vodCategories.map((c) => ({
        id: c.category_id,
        name: c.category_name,
      })),
      vodMovies,
    });

    // --- Series ---
    setSyncState({ syncProgress: "Baixando catálogo de séries..." });
    const [seriesCategories, seriesList] = await Promise.all([
      getSeriesCategories(profile),
      getSeries(profile),
    ]);
    const seriesCatMap = indexBy(seriesCategories);
    const mappedSeries = seriesList.map((stream) =>
      mapSeriesStreamToItem(stream, seriesCatMap.get(stream.category_id)),
    );
    setContentCache({
      seriesCategories: seriesCategories.map((c) => ({
        id: c.category_id,
        name: c.category_name,
      })),
      seriesList: mappedSeries,
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
 * Auto-syncs Xtream content when the active real server changes.
 * No-op in demo mode. Returns a `refresh` callback to force re-sync.
 */
export function useXtreamSync() {
  const servers = useAppStore((state) => state.servers);
  const activeServerId = useAppStore((state) => state.activeServerId);
  const isDemoMode = useAppStore((state) => state.isDemoMode);
  const setContentCache = useAppStore((state) => state.setContentCache);
  const setSyncState = useAppStore((state) => state.setSyncState);
  const syncState = useAppStore((state) => state.syncState);

  const activeServer = servers.find((s) => s.id === activeServerId) ?? null;

  // Track last synced server id to avoid duplicate calls
  const lastSyncedServerRef = useRef<string | null>(null);

  const doSync = useCallback(
    async (profile: ServerProfile) => {
      await syncAllContent(profile, setContentCache, setSyncState);
      lastSyncedServerRef.current = profile.id;
    },
    [setContentCache, setSyncState],
  );

  const refresh = useCallback(() => {
    if (!activeServer || isDemoMode) return;
    void doSync(activeServer);
  }, [activeServer, isDemoMode, doSync]);

  useEffect(() => {
    if (isDemoMode || !activeServer) return;
    // Only auto-sync when the server actually changes
    if (lastSyncedServerRef.current === activeServer.id) return;
    void doSync(activeServer);
  }, [activeServer, isDemoMode, doSync]);

  return { syncState, refresh };
}
