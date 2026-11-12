import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { catalogDatabase, type TvQuery } from "@/data/database/catalogDatabase";
import { logTechnicalError } from "@/services/security/sanitize";
import { createStreamUrl } from "@/services/xtream";
import { useAppStore } from "@/store/useAppStore";
import type { ChannelItem, ServerProfile } from "@/store/types";

/**
 * Canais ao vivo sob demanda (TV Android com lista Xtream), como no Roku.
 *
 * Antes, a abertura lia os ~9 mil canais do banco e todos ficavam na memória
 * do JavaScript o tempo todo. Agora a lista completa fica só no banco local:
 * a tela de TV ao Vivo lê do banco a categoria aberta (páginas de 300, na
 * ordem do servidor) e a memória guarda apenas os canais em uso — a
 * categoria aberta, os favoritos e os do histórico. O player, o guia (EPG) e
 * a troca de canal trabalham com esse conjunto.
 */
const PAGE_SIZE = 300;
const FAVORITES_LIMIT = 500;

export function isLazyLive(profile: ServerProfile | undefined): boolean {
  return Boolean(profile && profile.sourceType !== "m3u" && catalogDatabase.supportsTvPages());
}

/** O banco não guarda o endereço de reprodução (tem usuário e senha): é refeito aqui. */
export function withStreamUrls(profile: ServerProfile, channels: ChannelItem[]): ChannelItem[] {
  return channels.map((channel) => ({ ...channel, streamUrl: createStreamUrl(profile, channel.streamId) }));
}

/** Favoritos e canais do histórico: ficam na memória mesmo trocando de categoria. */
export function pinnedLiveIds(): Set<string> {
  const state = useAppStore.getState();
  const ids = new Set<string>(state.favoriteChannelIds);
  for (const item of state.history) if (item.type === "live") ids.add(item.contentId);
  return ids;
}

/** Lê do banco os canais fixados (favoritos e histórico) para a abertura. */
export async function loadPinnedLiveChannels(profile: ServerProfile): Promise<ChannelItem[]> {
  const ids = [...pinnedLiveIds()].slice(0, FAVORITES_LIMIT);
  if (ids.length === 0) return [];
  const rows = await catalogDatabase.tvPage<ChannelItem>(profile.id, "liveChannels", { ids, sort: "position" }, 0, ids.length);
  return withStreamUrls(profile, rows);
}

/**
 * Troca o conjunto em memória: a listagem aberta primeiro (na ordem dela, que
 * é a ordem da troca de canal no player) e depois os fixados. Guia já
 * carregado de um canal é mantido.
 */
export function replaceLiveWorkingSet(listing: ChannelItem[]): void {
  const state = useAppStore.getState();
  const current: ChannelItem[] = state.contentCache.liveChannels;
  const previous = new Map<string, ChannelItem>(current.map((channel) => [channel.id, channel]));
  const next: ChannelItem[] = listing.map((item) => {
    const known = previous.get(item.id);
    return known?.epgUpdatedAt
      ? { ...item, currentEpg: known.currentEpg, nextProgram: known.nextProgram, epgPrograms: known.epgPrograms, epgUpdatedAt: known.epgUpdatedAt }
      : item;
  });
  const seen = new Set(next.map((channel) => channel.id));
  const pinned = pinnedLiveIds();
  for (const channel of current) {
    if (seen.has(channel.id) || !pinned.has(channel.id)) continue;
    next.push(channel);
    seen.add(channel.id);
  }
  if (next.length === current.length && next.every((channel, index) => channel === current[index])) return;
  state.setContentCache({ liveChannels: next });
}

/** Conjunto a manter depois de uma lista nova: o que estava em uso e os fixados. */
export function keepLiveWorkingSet(fresh: ChannelItem[]): ChannelItem[] {
  const keep = pinnedLiveIds();
  for (const channel of useAppStore.getState().contentCache.liveChannels) keep.add(channel.id);
  return fresh.filter((channel) => keep.has(channel.id));
}

type ListingOptions = {
  enabled: boolean;
  profile: ServerProfile | undefined;
  revision: number | undefined;
  category: { id: string; name: string } | null;
  favorites: string[] | null;
  query: string;
  hidden: ReadonlySet<string>;
};

/** Página a página, a listagem aberta na tela de TV ao Vivo. */
export function useLazyLiveListing({ enabled, profile, revision, category, favorites, query, hidden }: ListingOptions) {
  const [items, setItems] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const request = useRef(0);
  const hiddenList = useMemo(() => [...hidden], [hidden]);
  const options = useMemo<TvQuery | null>(() => {
    if (!enabled) return null;
    if (favorites) return { ids: favorites.slice(0, FAVORITES_LIMIT), sort: "position" };
    const base: TvQuery = { sort: "position", hidden: hiddenList };
    if (category) Object.assign(base, { categoryId: category.id, category: category.name });
    if (query.trim()) base.query = query.trim();
    return base;
  }, [category, enabled, favorites, hiddenList, query]);
  const key = useMemo(() => JSON.stringify([profile?.id, revision, options]), [options, profile?.id, revision]);

  const fetchPage = useCallback(async (offset: number) => {
    if (!profile || !options) return [];
    if (options.ids && options.ids.length === 0) return [];
    const rows = await catalogDatabase.tvPage<ChannelItem>(profile.id, "liveChannels", options, offset, PAGE_SIZE);
    return withStreamUrls(profile, rows);
  }, [options, profile]);

  useEffect(() => {
    request.current += 1;
    const current = request.current;
    if (!enabled || !profile) {
      setItems([]);
      setHasMore(false);
      return;
    }
    setLoading(true);
    fetchPage(0)
      .then((page) => {
        if (current !== request.current) return;
        setItems(page);
        setHasMore(page.length === PAGE_SIZE && !options?.ids);
      })
      .catch((error) => {
        if (current === request.current) setItems([]);
        logTechnicalError("Live/page", error);
      })
      .finally(() => { if (current === request.current) setLoading(false); });
    // `key` resume perfil, revisão e filtros.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    const current = request.current;
    setLoading(true);
    fetchPage(items.length)
      .then((page) => {
        if (current !== request.current) return;
        setItems((previous) => [...previous, ...page]);
        setHasMore(page.length === PAGE_SIZE);
      })
      .catch((error) => logTechnicalError("Live/page", error))
      .finally(() => { if (current === request.current) setLoading(false); });
  }, [fetchPage, hasMore, items.length, loading]);

  // O que está na tela passa a ser o conjunto em memória (player, guia, troca de canal).
  useEffect(() => {
    if (enabled && items.length > 0) replaceLiveWorkingSet(items);
  }, [enabled, items]);

  return { items, loading, hasMore, loadMore };
}

/** Total de canais por categoria, lido do banco (uma consulta por lista nova). */
export function useLazyLiveCounts(enabled: boolean, profile: ServerProfile | undefined, revision: number | undefined, hidden: ReadonlySet<string>) {
  const [counts, setCounts] = useState<Map<string, number>>(() => new Map());
  const hiddenKey = useMemo(() => [...hidden].sort().join("\u0001"), [hidden]);
  useEffect(() => {
    if (!enabled || !profile) return;
    let active = true;
    catalogDatabase.tvPage<{ id: string; name: string; total: number }>(
      profile.id, "liveChannels", { counts: true, hidden: [...hidden] }, 0, 1,
    )
      .then((rows) => {
        if (!active) return;
        const next = new Map<string, number>();
        let total = 0;
        for (const row of rows) {
          next.set(row.name, (next.get(row.name) ?? 0) + row.total);
          total += row.total;
        }
        next.set("Todos", total);
        setCounts(next);
      })
      .catch((error) => logTechnicalError("Live/counts", error));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, profile?.id, revision, hiddenKey]);
  return counts;
}
