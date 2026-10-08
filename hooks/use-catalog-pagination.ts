import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { catalogDatabase, type CatalogKind } from "@/data/database/catalogDatabase";

const PAGE_SIZE = 80;

export function useCatalogPagination<T>(
  serverId: string,
  kind: CatalogKind,
  options: { categoryName?: string; query?: string; sort?: "rating_desc" | "name_desc" | "name_asc" | "added_desc" | "channel_number" },
) {
  const enabled = catalogDatabase.supportsFilteredPage() && Boolean(serverId);
  const categoryName = options.categoryName ?? "";
  const query = options.query ?? "";
  const sort = options.sort ?? "name_asc";
  const pageOptions = useMemo(() => ({ categoryName, query, sort }), [categoryName, query, sort]);
  const key = useMemo(() => JSON.stringify([serverId, kind, categoryName, query, sort]), [categoryName, kind, query, serverId, sort]);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(enabled);
  const requestRef = useRef(0);

  const load = useCallback(async (offset: number, reset = false) => {
    if (!enabled || loading || (!reset && !hasMore)) return;
    const request = requestRef.current;
    setLoading(true);
    try {
      const page = await catalogDatabase.filteredPage<T>(serverId, kind, pageOptions, offset, PAGE_SIZE);
      if (request !== requestRef.current) return;
      setItems((current) => reset ? page : [...current, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [enabled, hasMore, kind, loading, pageOptions, serverId]);

  useEffect(() => {
    requestRef.current += 1;
    const request = requestRef.current;
    const timer = setTimeout(() => void (async () => {
      setItems([]);
      setHasMore(enabled);
      if (!enabled) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const page = await catalogDatabase.filteredPage<T>(serverId, kind, pageOptions, 0, PAGE_SIZE);
        if (request !== requestRef.current) return;
        setItems(page);
        setHasMore(page.length === PAGE_SIZE);
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    })(), 0);
    return () => clearTimeout(timer);
  }, [enabled, key, kind, pageOptions, serverId]);

  const loadMore = useCallback(() => { void load(items.length); }, [items.length, load]);
  return { enabled, items, loading, hasMore, loadMore };
}
