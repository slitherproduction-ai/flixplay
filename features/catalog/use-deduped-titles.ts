import { useEffect, useState } from "react";
import { dedupeTitleVariants, titleKeysReady, warmTitleKeys } from "@/features/catalog/display";

/**
 * Lista com as versões do mesmo título agrupadas, sem bloquear a interface:
 * enquanto as chaves de uma lista grande são preparadas em lotes, a lista é
 * exibida como veio; o agrupamento entra assim que o cache fica pronto.
 */
export function useDedupedTitles<T extends { title: string; year: number }>(items: T[]): T[] {
  const [state, setState] = useState<{ source: T[]; result: T[] }>(() => ({
    source: items,
    result: titleKeysReady(items.map((item) => item.title)) ? dedupeTitleVariants(items) : items,
  }));

  useEffect(() => {
    const titles = items.map((item) => item.title);
    if (titleKeysReady(titles)) {
      setState({ source: items, result: dedupeTitleVariants(items) });
      return;
    }
    setState({ source: items, result: items });
    const warm = warmTitleKeys(titles);
    let active = true;
    void warm.promise.then(() => {
      if (active) setState({ source: items, result: dedupeTitleVariants(items) });
    });
    return () => {
      active = false;
      warm.cancel();
    };
  }, [items]);

  // Se a lista mudou e o efeito ainda não rodou, nunca mostrar a anterior.
  return state.source === items ? state.result : items;
}
