import { waitForCatalogIdle } from "@/core/navigation/tv-catalog-activity";
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
  createStreamUrl,
  createVodUrl,
} from "@/services/xtream";
import { logTechnicalError } from "@/services/security/sanitize";
import { useAppStore } from "@/store/useAppStore";
import type { SyncState } from "@/store/useAppStore";
import type { ChannelItem, SeriesItem, ServerProfile, VodMovie } from "@/store/types";
import { catalogDatabase } from "@/data/database/catalogDatabase";
import {
  assertSafeCatalogReplacement,
  deduplicateCatalogItems,
} from "@/data/sync/catalogSyncPolicy";
import { homeVideos, type VideoItem, type VideoKind } from "@/data/database/tvCatalog";
import { fetchM3uChannels } from "@/services/m3uImport";

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

/** Quanto tempo o catálogo salvo vale antes de baixar a lista de novo ao abrir o app. */
export const CATALOG_FRESH_MS = 6 * 60 * 60 * 1000;
export const catalogSyncedAtKey = (serverId: string) => `catalogSyncedAt:${serverId}`;

/**
 * Grava no banco local sem nunca derrubar a sincronização: se o cache falhar,
 * o catálogo baixado continua na tela e só a próxima abertura usa a rede.
 */
async function persistCatalog(label: string, writes: Promise<void>[]): Promise<boolean> {
  try {
    await Promise.all(writes);
    return true;
  } catch (error) {
    logTechnicalError(`Sync/persist-${label}`, error);
    return false;
  }
}

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
  const liveCategories = await readAllPages<CachedCategory>(profile.id, "liveCategories");
  const storedLiveChannels = await readAllPages<ChannelItem>(profile.id, "liveChannels");
  if (useAppStore.getState().activeServerId !== profile.id) return false;
  const liveChannels = storedLiveChannels.map((channel) => ({
    ...channel,
    streamUrl: createStreamUrl(profile, channel.streamId),
  }));
  useAppStore.getState().setContentCache({ liveCategories, liveChannels });
  const paged = catalogDatabase.supportsTvPages();
  const vodCategories = await readAllPages<CachedCategory>(profile.id, "vodCategories");
  const storedVodMovies = paged ? await homeVideos<VodMovie>(profile, "vodMovies") : await readAllPages<VodMovie>(profile.id, "vodMovies");
  const seriesCategories = await readAllPages<CachedCategory>(profile.id, "seriesCategories");
  const seriesList = paged ? await homeVideos<SeriesItem>(profile, "seriesList") : await readAllPages<SeriesItem>(profile.id, "seriesList");
  if (useAppStore.getState().activeServerId !== profile.id) return false;
  const vodMovies = paged ? storedVodMovies : storedVodMovies.map((movie) => ({
    ...movie,
    streamUrl: createVodUrl(profile, movie.streamId, movie.containerExtension ?? "mp4"),
  }));
  // Provedores só de filmes/séries também abrem com o catálogo salvo.
  if (liveChannels.length === 0 && vodMovies.length === 0 && seriesList.length === 0) return false;
  useAppStore.getState().setContentCache({
    liveCategories,
    liveChannels,
    vodCategories,
    vodMovies,
    vodRevision: paged ? Date.now() : undefined,
    seriesRevision: paged ? Date.now() : undefined,
    seriesCategories,
    seriesList,
  });
  return true;
}

async function saveVideoCatalog<R, T extends VideoItem>(
  profile: ServerProfile, kind: VideoKind, rows: R[], map: (row: R) => T, current: () => boolean,
): Promise<{ items: T[]; revision?: number; saved: boolean }> {
  assertSafeCatalogReplacement(kind, rows.length, await catalogDatabase.count(profile.id, kind));
  if (catalogDatabase.supportsTvPages()) {
    try {
      await catalogDatabase.writeTvSnapshot(profile.id, kind, rows, map, current);
      if (!current()) return { items: [], saved: false };
      return { items: await homeVideos<T>(profile, kind), revision: Date.now(), saved: true };
    } catch (error) {
      logTechnicalError("Sync/paged-cache", error);
      return { items: deduplicateCatalogItems(rows.map(map), item => item.id), saved: false };
    }
  }
  const items = deduplicateCatalogItems(rows.map(map), item => item.id);
  const saved = await persistCatalog(kind, [catalogDatabase.replaceAll(profile.id, kind, items)]);
  return { items, saved };
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
  let persisted = true;

  if (profile.sourceType === "m3u") {
    setSyncState({ syncProgress: "Importando lista M3U...", stages: { live: "running", movies: "complete", series: "complete" } });
    try {
      const { categories, channels } = await fetchM3uChannels(profile, signal);
      if (!isCurrent()) return;
      await Promise.all([catalogDatabase.replaceAll(profile.id, "liveCategories", categories), catalogDatabase.replaceAll(profile.id, "liveChannels", channels)]);
      setContentCache({ liveCategories: categories, liveChannels: channels, vodCategories: [], vodMovies: [], seriesCategories: [], seriesList: [], lastSyncedAt: new Date().toISOString() });
      setSyncState({ isSyncing: false, syncError: null, syncProgress: null, stages: { live: "complete", movies: "complete", series: "complete" } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao importar lista M3U.";
      setSyncState({ isSyncing: false, syncError: message, syncProgress: null, stages: { live: "error", movies: "complete", series: "complete" }, stageErrors: { live: message } });
    }
    return;
  }

  try {
    // ── Live channels ────────────────────────────────────────────────────────
    setSyncState({ syncProgress: "Sincronizando canais ao vivo..." });
    setSyncState({ stages: { live: "running", movies: "pending", series: "pending" }, progressPercent: 0 });
    // A resposta bruta do servidor (dezenas de MB em listas grandes) só vive
    // dentro desta função: ao mapear, ela pode ser liberada antes das gravações
    // e da atualização da tela, reduzindo o pico de memória em aparelhos de 1 GB.
    const live = await (async () => {
    const [liveCategories, liveStreams] = await Promise.all([
      getLiveCategories(profile, signal),
      getLiveStreams(profile, undefined, signal),
    ]);
    if (!isCurrent()) return null;
    if (catalogDatabase.supportsTvPages()) await waitForCatalogIdle(isCurrent);
    if (!isCurrent()) return null;
    const liveCatMap = indexBy(liveCategories);
    const mappedLiveCategories = deduplicateCatalogItems(
      liveCategories.map((c) => ({ id: String(c.category_id), name: c.category_name })),
      (item) => item.id,
    );
    const mappedLiveChannels = deduplicateCatalogItems(
      liveStreams.map((stream, index) =>
        mapLiveStreamToChannel(
          stream,
          liveCatMap.get(String(stream.category_id)) ?? {
            category_id: String(stream.category_id),
            category_name: "Geral",
            parent_id: 0,
          },
          profile,
          index + 1,
        ),
      ),
      (item) => item.id,
    );
    return { mappedLiveCategories, mappedLiveChannels };
    })();
    if (!live) return;
    const { mappedLiveCategories, mappedLiveChannels } = live;
    const [storedLiveCategories, storedLiveChannels] = await Promise.all([
      catalogDatabase.count(profile.id, "liveCategories"),
      catalogDatabase.count(profile.id, "liveChannels"),
    ]);
    assertSafeCatalogReplacement("liveCategories", mappedLiveCategories.length, storedLiveCategories);
    assertSafeCatalogReplacement("liveChannels", mappedLiveChannels.length, storedLiveChannels);
    persisted = (await persistCatalog("live", [
      catalogDatabase.replaceAll(profile.id, "liveCategories", mappedLiveCategories),
      catalogDatabase.replaceAll(profile.id, "liveChannels", mappedLiveChannels),
    ])) && persisted;
    if (!isCurrent()) return;
    setContentCache({ liveCategories: mappedLiveCategories, liveChannels: mappedLiveChannels });
    setSyncState({
      stages: { live: "complete", movies: "pending", series: "pending" },
      progressPercent: 0,
      syncProgress: "Canais disponíveis. Sincronizando filmes em segundo plano...",
    });

  } catch (err) {
    if (signal.aborted || !isCurrent()) return;
    logTechnicalError("Sync/live", err);
    const message = err instanceof Error ? err.message : "Falha ao carregar canais ao vivo.";
    try {
      if (await restoreOfflineCache(profile)) {
        failures.push(`${message} Exibindo catálogo salvo neste dispositivo.`);
      } else {
        failures.push(`Canais: ${message}`);
      }
    } catch (cacheError) {
      logTechnicalError("Sync/offline-cache", cacheError);
      failures.push(`Canais: ${message}`);
    }
    // A number of providers expose VOD even when their live endpoint is down.
    // Do not abort the remaining independent stages just because live failed.
    setSyncState({
      syncError: null,
      syncProgress: "Não foi possível carregar canais. Tentando filmes e séries...",
      progressPercent: 0,
      stages: { live: "error", movies: "pending", series: "pending" },
      stageErrors: { live: message },
    });
  }

  try {
    if (catalogDatabase.supportsTvPages()) await waitForCatalogIdle(isCurrent);
    if (!isCurrent()) return;
    // ── VOD movies ───────────────────────────────────────────────────────────
    setSyncState({ syncProgress: "Baixando catálogo de filmes..." });
    setSyncState({
      stages: { ...useAppStore.getState().syncState.stages, movies: "running", series: "pending" },
      progressPercent: 0,
    });
    // A number of Xtream panels serialize requests per account or allow only
    // one active connection. Fetch metadata and the large payload sequentially
    // so the VOD call is not rejected while categories are still in flight.
    const categories = await getVodCategories(profile, signal);
    if (!isCurrent()) return;
    const rows = await getVodStreams(profile, undefined, signal);
    if (!isCurrent()) return;
    const byId = indexBy(categories);
    const mapped = deduplicateCatalogItems(
      categories.map(c => ({ id: String(c.category_id), name: c.category_name })), item => item.id,
    );
    assertSafeCatalogReplacement("vodCategories", mapped.length, await catalogDatabase.count(profile.id, "vodCategories"));
    const result = await saveVideoCatalog(profile, "vodMovies", rows,
      row => mapVodStreamToMovie(row, byId.get(String(row.category_id)), profile), isCurrent);
    if (!isCurrent()) return;
    const savedCategories = await persistCatalog("vodCategories", [catalogDatabase.replaceAll(profile.id, "vodCategories", mapped)]);
    if (!isCurrent()) return;
    persisted = persisted && result.saved && savedCategories;
    setContentCache({
      vodCategories: mapped, vodMovies: result.items, vodRevision: result.revision,
    });
    setSyncState({
      stages: { ...useAppStore.getState().syncState.stages, movies: "complete", series: "pending" },
      progressPercent: 0,
    });
  } catch (err) {
    if (signal.aborted || !isCurrent()) return;
    logTechnicalError("Sync/movies", err);
    const message = err instanceof Error ? err.message : "Falha ao carregar filmes.";
    failures.push(`Filmes: ${message}`);
    setSyncState({
      stages: { ...useAppStore.getState().syncState.stages, movies: "error", series: "pending" },
      stageErrors: { ...useAppStore.getState().syncState.stageErrors, movies: message },
    });
  }

  try {
    if (catalogDatabase.supportsTvPages()) await waitForCatalogIdle(isCurrent);
    if (!isCurrent()) return;
    // ── Series ───────────────────────────────────────────────────────────────
    setSyncState({ syncProgress: "Baixando catálogo de séries..." });
    const stagesBeforeSeries = useAppStore.getState().syncState.stages;
    setSyncState({
      stages: { ...stagesBeforeSeries, series: "running" },
      progressPercent: 0,
    });
    const categories = await getSeriesCategories(profile, signal);
    if (!isCurrent()) return;
    const rows = await getSeries(profile, undefined, signal);
    if (!isCurrent()) return;
    const byId = indexBy(categories);
    const mapped = deduplicateCatalogItems(
      categories.map(c => ({ id: String(c.category_id), name: c.category_name })), item => item.id,
    );
    assertSafeCatalogReplacement("seriesCategories", mapped.length, await catalogDatabase.count(profile.id, "seriesCategories"));
    const result = await saveVideoCatalog(profile, "seriesList", rows,
      row => mapSeriesStreamToItem(row, byId.get(String(row.category_id))), isCurrent);
    if (!isCurrent()) return;
    const savedCategories = await persistCatalog("seriesCategories", [catalogDatabase.replaceAll(profile.id, "seriesCategories", mapped)]);
    if (!isCurrent()) return;
    persisted = persisted && result.saved && savedCategories;
    setContentCache({
      seriesCategories: mapped, seriesList: result.items, seriesRevision: result.revision,
      lastSyncedAt: new Date().toISOString(),
    });
    // Catálogo completo baixado e salvo: as próximas aberturas, dentro de
    // CATALOG_FRESH_MS, usam o banco local em vez de baixar tudo de novo.
    if (failures.length === 0 && persisted && catalogDatabase.isAvailable()) {
      useAppStore.getState().setPreference(catalogSyncedAtKey(profile.id), Date.now());
    }
    const currentStages = useAppStore.getState().syncState.stages;
    setSyncState({
      isSyncing: false,
      syncError: failures.length ? failures.join(" ") : null,
      syncProgress: null,
      progressPercent: 0,
      stages: { ...currentStages, series: "complete" },
    });
  } catch (err) {
    if (signal.aborted || !isCurrent()) return;
    logTechnicalError("Sync/series", err);
    const message = err instanceof Error ? err.message : "Falha ao carregar séries.";
    failures.push(`Séries: ${message}`);
    const currentStages = useAppStore.getState().syncState.stages;
    setSyncState({
      isSyncing: false,
      syncError: failures.join(" "),
      syncProgress: null,
      progressPercent: 0,
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
  const mounted = useRef(true);
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
    const state = useAppStore.getState();
    const server = state.servers.find((s) => s.id === activeServerId);
    if (!server) return;

    // Abertura rápida: com um catálogo salvo há menos de CATALOG_FRESH_MS, o
    // app mostra a lista do banco local sem baixar tudo de novo. Listas M3U
    // ficam de fora (o endereço de cada canal não é salvo no banco).
    const syncedAt = Number(state.preferences[catalogSyncedAtKey(server.id)] ?? 0);
    const fresh = server.sourceType !== "m3u"
      && catalogDatabase.isAvailable()
      && syncedAt > 0
      && Date.now() - syncedAt < CATALOG_FRESH_MS;
    const restoreStale = catalogDatabase.supportsTvPages() && syncedAt > 0 && server.sourceType !== "m3u";
    if (!fresh && !restoreStale) {
      void doSync(server);
      return;
    }
    setSyncState({
      isSyncing: true,
      lastSyncedServerId: server.id,
      syncError: null,
      syncProgress: "Abrindo catálogo salvo...",
      progressPercent: 0,
      stages: { live: "running", movies: "pending", series: "pending" },
      stageErrors: {},
    });
    void (async () => {
      let restored = false;
      try {
        restored = await restoreOfflineCache(server);
      } catch (error) {
        logTechnicalError("Sync/restore", error);
      }
      if (useAppStore.getState().activeServerId !== server.id) return;
      if (!restored) {
        void doSync(server);
        return;
      }
      if (!fresh) {
        const current = () => mounted.current && useAppStore.getState().activeServerId === server.id;
        await waitForCatalogIdle(current, 3000);
        if (current()) void doSync(server);
        return;
      }
      useAppStore.getState().setContentCache({ lastSyncedAt: new Date(syncedAt).toISOString() });
      setSyncState({
        isSyncing: false,
        syncError: null,
        syncProgress: null,
        progressPercent: 0,
        stages: { live: "complete", movies: "complete", series: "complete" },
      });
    })();
  }, [activeServerId, syncState.isSyncing, syncState.lastSyncedServerId, doSync]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controllerRef.current?.abort(); };
  }, []);

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
