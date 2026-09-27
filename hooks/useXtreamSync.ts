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
import { logTechnicalError } from "@/services/security/sanitize";
import { useAppStore } from "@/store/useAppStore";
import type { SyncState } from "@/store/useAppStore";
import type { ChannelItem, SeriesItem, ServerProfile, VodMovie } from "@/store/types";
import { catalogDatabase } from "@/data/database/catalogDatabase";

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

type CachedCategory = { id: string; name: string };

async function readAllPages<T>(serverId: string, kind: Parameters<typeof catalogDatabase.queryPage>[1]): Promise<T[]> {
  const result: T[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const page = await catalogDatabase.queryPage<T>(serverId, kind, offset, pageSize);
    result.push(...page);
    if (page.length < pageSize) return result;
  }
}

async function restoreOfflineCache(profile: ServerProfile): Promise<boolean> {
  const [liveCategories, liveChannels, vodCategories, vodMovies, seriesCategories, seriesList] = await Promise.all([
    readAllPages<CachedCategory>(profile.id, "liveCategories"),
    readAllPages<ChannelItem>(profile.id, "liveChannels"),
    readAllPages<CachedCategory>(profile.id, "vodCategories"),
    readAllPages<VodMovie>(profile.id, "vodMovies"),
    readAllPages<CachedCategory>(profile.id, "seriesCategories"),
    readAllPages<SeriesItem>(profile.id, "seriesList"),
  ]);
  if (liveChannels.length === 0) return false;
  useAppStore.getState().setContentCache({
    liveCategories,
    liveChannels,
    vodCategories,
    vodMovies,
    seriesCategories,
    seriesList,
  });
  return true;
}

async function fetchAndCacheContent(
  profile: ServerProfile,
  setContentCache: ReturnType<typeof useAppStore.getState>["setContentCache"],
  setSyncState: ReturnType<typeof useAppStore.getState>["setSyncState"],
  signal: AbortSignal,
): Promise<void> {
  const isCurrent = () =>
    !signal.aborted && useAppStore.getState().activeServerId === profile.id;
  const failures: string[] = [];

  try {
    // ── Live channels ────────────────────────────────────────────────────────
    setSyncState({ syncProgress: "Sincronizando canais ao vivo..." });
    setSyncState({ stages: { live: "running", movies: "pending", series: "pending" }, progressPercent: 5 });
    const [liveCategories, liveStreams] = await Promise.all([
      getLiveCategories(profile, signal),
      getLiveStreams(profile, undefined, signal),
    ]);
    if (!isCurrent()) return;
    const liveCatMap = indexBy(liveCategories);
    const mappedLiveCategories = liveCategories.map((c) => ({ id: String(c.category_id), name: c.category_name }));
    const mappedLiveChannels = liveStreams.map((stream) =>
      mapLiveStreamToChannel(
        stream,
        liveCatMap.get(String(stream.category_id)) ?? {
          category_id: String(stream.category_id),
          category_name: "Geral",
          parent_id: 0,
        },
        profile,
      ),
    );
    setContentCache({
      liveCategories: mappedLiveCategories,
      liveChannels: mappedLiveChannels,
    });
    await Promise.all([
      catalogDatabase.replaceAll(profile.id, "liveCategories", mappedLiveCategories),
      catalogDatabase.replaceAll(profile.id, "liveChannels", mappedLiveChannels),
    ]);
    setSyncState({
      stages: { live: "complete", movies: "pending", series: "pending" },
      progressPercent: 40,
      syncProgress: "Canais disponíveis. Sincronizando filmes em segundo plano...",
    });

  } catch (err) {
    if (signal.aborted || !isCurrent()) return;
    logTechnicalError("Sync/live", err);
    const message = err instanceof XtreamApiError ? err.message : "Falha ao carregar canais ao vivo.";
    try {
      if (await restoreOfflineCache(profile)) {
        setSyncState({
          isSyncing: false,
          syncError: `${message} Exibindo catálogo salvo neste dispositivo.`,
          syncProgress: null,
          progressPercent: 100,
          stages: { live: "complete", movies: "complete", series: "complete" },
          stageErrors: { live: message },
        });
        return;
      }
    } catch (cacheError) {
      logTechnicalError("Sync/offline-cache", cacheError);
    }
    setSyncState({
      isSyncing: false,
      syncError: message,
      syncProgress: null,
      progressPercent: 0,
      stages: { live: "error", movies: "pending", series: "pending" },
      stageErrors: { live: message },
    });
    return;
  }

  try {
    // ── VOD movies ───────────────────────────────────────────────────────────
    setSyncState({ syncProgress: "Baixando catálogo de filmes..." });
    const [vodCategories, vodStreams] = await Promise.all([
      getVodCategories(profile, signal),
      getVodStreams(profile, undefined, signal),
    ]);
    if (!isCurrent()) return;
    const vodCatMap = indexBy(vodCategories);
    const mappedVodCategories = vodCategories.map((c) => ({ id: String(c.category_id), name: c.category_name }));
    const mappedVodMovies = vodStreams.map((stream) =>
      mapVodStreamToMovie(stream, vodCatMap.get(String(stream.category_id)), profile),
    );
    setContentCache({
      vodCategories: mappedVodCategories,
      vodMovies: mappedVodMovies,
    });
    await Promise.all([
      catalogDatabase.replaceAll(profile.id, "vodCategories", mappedVodCategories),
      catalogDatabase.replaceAll(profile.id, "vodMovies", mappedVodMovies),
    ]);
    setSyncState({
      stages: { live: "complete", movies: "complete", series: "pending" },
      progressPercent: 70,
    });
  } catch (err) {
    if (signal.aborted || !isCurrent()) return;
    logTechnicalError("Sync/movies", err);
    const message = err instanceof XtreamApiError ? err.message : "Falha ao carregar filmes.";
    failures.push(`Filmes: ${message}`);
    setSyncState({
      stages: { live: "complete", movies: "error", series: "pending" },
      stageErrors: { movies: message },
    });
  }

  try {
    // ── Series ───────────────────────────────────────────────────────────────
    setSyncState({ syncProgress: "Baixando catálogo de séries..." });
    const [seriesCategories, seriesList] = await Promise.all([
      getSeriesCategories(profile, signal),
      getSeries(profile, undefined, signal),
    ]);
    if (!isCurrent()) return;
    const seriesCatMap = indexBy(seriesCategories);
    const mappedSeriesCategories = seriesCategories.map((c) => ({ id: String(c.category_id), name: c.category_name }));
    const mappedSeriesList = seriesList.map((stream) =>
      mapSeriesStreamToItem(stream, seriesCatMap.get(String(stream.category_id))),
    );
    setContentCache({
      seriesCategories: mappedSeriesCategories,
      seriesList: mappedSeriesList,
      lastSyncedAt: new Date().toISOString(),
    });
    await Promise.all([
      catalogDatabase.replaceAll(profile.id, "seriesCategories", mappedSeriesCategories),
      catalogDatabase.replaceAll(profile.id, "seriesList", mappedSeriesList),
    ]);
    const currentStages = useAppStore.getState().syncState.stages;
    setSyncState({
      isSyncing: false,
      syncError: failures.length ? failures.join(" ") : null,
      syncProgress: null,
      progressPercent: 100,
      stages: { ...currentStages, series: "complete" },
    });
  } catch (err) {
    if (signal.aborted || !isCurrent()) return;
    logTechnicalError("Sync/series", err);
    const message =
      err instanceof XtreamApiError
        ? err.message
        : "Falha ao carregar séries.";
    failures.push(`Séries: ${message}`);
    const currentStages = useAppStore.getState().syncState.stages;
    setSyncState({
      isSyncing: false,
      syncError: failures.join(" "),
      syncProgress: null,
      progressPercent: 100,
      stages: { ...currentStages, series: "error" },
      stageErrors: { ...useAppStore.getState().syncState.stageErrors, series: message },
    });
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
  const controllerRef = useRef<AbortController | null>(null);

  const doSync = useCallback(
    async (profile: ServerProfile) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      // MUST be synchronous and FIRST — marks isSyncing=true before any await
      // so any concurrent effect invocations in the same event-loop tick see
      // the guard and return early.
      setSyncState({
        isSyncing: true,
        lastSyncedServerId: profile.id,
        syncError: null,
        syncProgress: "Conectando ao servidor...",
        progressPercent: 0,
        stages: { live: "pending", movies: "pending", series: "pending" },
        stageErrors: {},
      });
      await fetchAndCacheContent(profile, setContentCache, setSyncState, controller.signal);
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

  useEffect(() => () => controllerRef.current?.abort(), []);

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
