import { useEffect, useState } from "react";
import { catalogDatabase } from "@/data/database/catalogDatabase";
import { hydrateVideo, type VideoItem } from "@/data/database/tvCatalog";
import { catalogTitleKey } from "@/features/catalog/display";
import { useAppStore } from "@/store/useAppStore";
import type { SeriesItem, VodMovie } from "@/store/types";
import { logTechnicalError } from "@/services/security/sanitize";

// Também atende links diretos e resultados que não estão na seleção da Home.
export function useTvVideo(id: string) {
  const server = useAppStore(s => s.servers.find(p => p.id === s.activeServerId));
  const movies = id.startsWith("movie-");
  const kind = movies ? "vodMovies" : "seriesList";
  const revision = useAppStore(s => movies ? s.contentCache.vodRevision : s.contentCache.seriesRevision);
  const request = JSON.stringify([server?.id, id, revision]);
  const [resolved, setResolved] = useState("");
  useEffect(() => {
    if (!server || !revision || !(movies || id.startsWith("series-"))) return;
    let current = true;
    async function read() {
      if (!server) return;
      const [item] = await catalogDatabase.tvPage<VideoItem>(server.id, kind, { ids: [id] }, 0, 1);
      if (!item || !current) return;
      const key = catalogTitleKey(item.title);
      const matches: VideoItem[] = [item];
      for (let offset = 0; current; offset += 80) {
        const page = await catalogDatabase.tvPage<VideoItem>(server.id, kind, { titles: [key] }, offset, 80);
        matches.push(...page.filter(row => row.year === item.year));
        if (page.length < 80) break;
      }
      const state = useAppStore.getState();
      if (!current || state.activeServerId !== server.id) return;
      const retained = new Set(movies ? state.favoriteMovieIds : state.favoriteSeriesIds);
      for (const h of state.history) {
        retained.add(h.contentId);
        if (h.seriesId) retained.add(h.seriesId);
      }
      const rows: VideoItem[] = state.contentCache[kind].filter((row, index) => index < 72 || retained.has(row.id));
      const byId = new Map(rows.map(row => [row.id, row]));
      for (const row of matches) byId.set(row.id, hydrateVideo(server, row));
      if (movies) state.setContentCache({ vodMovies: [...byId.values()] as VodMovie[] });
      else state.setContentCache({ seriesList: [...byId.values()] as SeriesItem[] });
    }
    void read().catch(error => logTechnicalError("Catalog/details", error)).finally(() => { if (current) setResolved(request); });
    return () => { current = false; };
  }, [id, kind, movies, request, revision, server]);
  return Boolean((movies || id.startsWith("series-")) && server && revision && resolved !== request);
}
