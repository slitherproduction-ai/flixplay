import { useCallback, useRef, useState } from "react";
import { catalogDatabase } from "@/data/database/catalogDatabase";
import { useAppStore } from "@/store/useAppStore";
import { getSeries, mapSeriesStreamToItem, type XtreamCategory } from "@/services/xtream";
import { logTechnicalError } from "@/services/security/sanitize";

export type SeriesCategory = { id: string; name: string };

/**
 * Séries sob demanda na TV (igual a `useVodCategoryFallback` para filmes):
 * uma categoria aberta e ainda vazia no banco local é baixada sozinha
 * (`get_series&category_id=…`) e gravada, sem esperar a lista completa —
 * as séries aparecem em segundos mesmo na primeira abertura do app.
 */
export function useSeriesCategoryFallback() {
  const activeServerId = useAppStore((state) => state.activeServerId);
  const activeProfile = useAppStore((state) => state.servers.find((server) => server.id === state.activeServerId));
  const setContentCache = useAppStore((state) => state.setContentCache);
  const [loadingCategoryId, setLoadingCategoryId] = useState<string | null>(null);
  const attempted = useRef(new Set<string>());

  const loadCategory = useCallback(async (category: SeriesCategory) => {
    const profile = activeProfile;
    if (!profile || !activeServerId || profile.sourceType === "m3u" || !category.id) return;
    if (!useAppStore.getState().contentCache.seriesRevision) return;

    const requestKey = `${profile.id}:${category.id}`;
    if (attempted.current.has(requestKey)) return;
    attempted.current.add(requestKey);
    setLoadingCategoryId(category.id);

    try {
      const existing = await catalogDatabase.tvPage(profile.id, "seriesList", { categoryId: category.id, category: category.name }, 0, 1);
      if (existing.length || useAppStore.getState().activeServerId !== profile.id) return;
      const rows = await getSeries(profile, category.id);
      if (useAppStore.getState().activeServerId !== profile.id) return;
      const xtreamCategory: XtreamCategory = { category_id: category.id, category_name: category.name, parent_id: 0 };
      const fetched = rows.map((row) => ({
        ...mapSeriesStreamToItem(row, xtreamCategory),
        categoryId: category.id,
        genre: category.name,
      }));
      if (fetched.length === 0) return;
      await catalogDatabase.upsert(profile.id, "seriesList", fetched);
      if (useAppStore.getState().activeServerId === profile.id) setContentCache({ seriesRevision: Date.now() });
    } catch (error) {
      logTechnicalError("Catalog/series-category", error);
      attempted.current.delete(requestKey);
    } finally {
      if (useAppStore.getState().activeServerId === profile.id) setLoadingCategoryId((currentId) => currentId === category.id ? null : currentId);
    }
  }, [activeProfile, activeServerId, setContentCache]);

  return { loadingCategoryId, loadCategory };
}
