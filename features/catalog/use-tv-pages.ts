import { useCallback, useEffect, useRef, useState } from "react";
import { catalogDatabase, type TvQuery } from "@/data/database/catalogDatabase";
import type { VideoKind, VideoItem } from "@/data/database/tvCatalog";
import { mergeTitlePage } from "./display";
import type { TvCatalogEntry } from "./tv-catalog-browser";

const PAGE = 80;
type Count = { id: string; name: string; total: number };

function card(item: VideoItem): TvCatalogEntry {
  return {
    id: item.id, title: item.title, year: item.year, poster: item.poster, rating: item.rating,
    category: item.genre, categoryId: item.categoryId,
    detail: "duration" in item ? item.duration : item.seasonsCount ? `${item.seasonsCount} temporadas` : "",
    quality: "quality" in item ? item.quality : undefined,
  };
}

export function useTvPages(server: string, kind: VideoKind, revision: number | undefined, options: TvQuery, active: boolean) {
  const serialized = JSON.stringify(options);
  const hidden = JSON.stringify(options.hidden ?? []);
  const [counts, setCounts] = useState<Count[]>([]);
  const [entries, setEntries] = useState<TvCatalogEntry[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const requestMore = useRef<() => void>(() => {});
  useEffect(() => {
    let current = true;
    setCounts([]);
    if (revision) void catalogDatabase.tvPage<Count>(server, kind, { counts: true, hidden: JSON.parse(hidden) })
      .then(rows => { if (current) setCounts(rows); }).catch(() => { if (current) setError(true); });
    return () => { current = false; };
  }, [server, kind, revision, hidden, retry]);

  useEffect(() => {
    let current = true, pending = false, more = true, offset = 0;
    setEntries([]);
    setError(false);
    setLoading(false);
    const cards: TvCatalogEntry[] = [];
    const index = new Map<string, number>();
    const query: TvQuery = JSON.parse(serialized);
    async function load() {
      if (!revision || !active || !current || pending || !more) return;
      pending = true;
      setLoading(true);
      try {
        const rows = await catalogDatabase.tvPage<VideoItem>(server, kind, query, offset, PAGE);
        if (!current) return;
        offset += rows.length;
        more = rows.length === PAGE;
        mergeTitlePage(cards, index, rows.map(card));
        setEntries(cards.slice());
      } catch {
        if (current) setError(true);
      } finally {
        pending = false;
        if (current) setLoading(false);
      }
    }
    requestMore.current = () => { void load(); };
    void load();
    return () => { current = false; };
  }, [server, kind, revision, serialized, active, retry]);
  return { entries, counts, loading, error, retry: () => setRetry(n => n + 1), loadMore: useCallback(() => requestMore.current(), []) };
}
