import { useCallback, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { ParentalCategoryKind } from "@/store/types";

/**
 * Categorias ocultas: somem das listas (chips, "Todos" e navegador da TV) sem
 * apagar nada. Guardadas por lista (servidor) em uma preferência JSON, para não
 * exigir migração do estado persistido.
 */
const PREF_KEY = "hiddenCategories";
type HiddenMap = Record<string, Partial<Record<ParentalCategoryKind, string[]>>>;
const EMPTY: string[] = [];
const EMPTY_SET: ReadonlySet<string> = new Set();

function parse(raw: unknown): HiddenMap {
  if (typeof raw !== "string" || !raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" ? (value as HiddenMap) : {};
  } catch {
    return {};
  }
}

function categoriesFor(kind: ParentalCategoryKind) {
  const cache = useAppStore.getState().contentCache;
  return kind === "live" ? cache.liveCategories : kind === "movies" ? cache.vodCategories : cache.seriesCategories;
}

/** IDs ocultos da lista ativa para um tipo. */
export function useHiddenCategoryIds(kind: ParentalCategoryKind): string[] {
  const raw = useAppStore((state) => state.preferences[PREF_KEY]);
  const serverId = useAppStore((state) => state.activeServerId);
  return useMemo(() => (serverId ? parse(raw)[serverId]?.[kind] ?? EMPTY : EMPTY), [kind, raw, serverId]);
}

/** Nomes das categorias ocultas (os itens do catálogo referenciam a categoria pelo nome). */
export function useHiddenCategoryNames(kind: ParentalCategoryKind): ReadonlySet<string> {
  const ids = useHiddenCategoryIds(kind);
  const categories = useAppStore((state) =>
    kind === "live" ? state.contentCache.liveCategories : kind === "movies" ? state.contentCache.vodCategories : state.contentCache.seriesCategories);
  return useMemo(() => {
    if (!ids.length) return EMPTY_SET;
    const hidden = new Set(ids);
    return new Set(categories.filter((category) => hidden.has(category.id)).map((category) => category.name));
  }, [categories, ids]);
}

export function useToggleHiddenCategory(kind: ParentalCategoryKind) {
  const setPreference = useAppStore((state) => state.setPreference);
  return useCallback((categoryId: string) => {
    const state = useAppStore.getState();
    const serverId = state.activeServerId;
    if (!serverId || !categoryId) return;
    const map = parse(state.preferences[PREF_KEY]);
    const current = map[serverId]?.[kind] ?? [];
    const next = current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId];
    // Descarta IDs que não existem mais no catálogo, para a preferência não crescer.
    const known = new Set(categoriesFor(kind).map((category) => category.id));
    const cleaned = known.size ? next.filter((id) => known.has(id)) : next;
    map[serverId] = { ...map[serverId], [kind]: cleaned };
    setPreference(PREF_KEY, JSON.stringify(map));
  }, [kind, setPreference]);
}

/** Filtra itens cuja categoria (pelo nome) está oculta. Sem categorias ocultas, devolve a mesma lista. */
export function withoutHidden<T>(items: T[], hidden: ReadonlySet<string>, categoryOf: (item: T) => string | undefined): T[] {
  if (!hidden.size) return items;
  return items.filter((item) => !hidden.has(categoryOf(item) ?? ""));
}
