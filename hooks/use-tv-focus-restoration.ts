import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { FlatList, type FlatListProps } from "react-native";
import { getRememberedTvFocus } from "@/core/navigation/tv-focus-memory";

/** Scrolls a virtualized grid back to the row containing its last focused item. */
export function useTvFocusRestoration<T>(scope: string, enabled: boolean, columns = 1) {
  const listRef = useRef<FlatList<T>>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const restore = useCallback(() => {
    const index = getRememberedTvFocus(scope)?.itemIndex;
    if (!enabled || index === undefined) return;
    requestAnimationFrame(() => {
      const list = listRef.current;
      if (!list) return;
      // A lista pode estar vazia ou menor que antes (lista sendo atualizada,
      // categoria trocada): rolar para fora dela é erro fatal do React Native
      // ("scrollToIndex out of range") e fechava o app em Séries (2.17.56).
      // Em grade, a lista virtual conta linhas, não títulos.
      const data = (list as unknown as { props?: { data?: ArrayLike<unknown> | null } }).props?.data;
      const perRow = Math.max(columns, 1);
      const rows = data ? Math.ceil(data.length / perRow) : 0;
      if (rows === 0) return;
      const row = Math.min(Math.floor(index / perRow), rows - 1);
      try {
        list.scrollToIndex({ index: row, animated: false, viewPosition: 0.42 });
      } catch {
        // Lista mudou entre a medida e a rolagem: só não restaura a posição.
      }
    });
  }, [columns, enabled, scope]);

  useFocusEffect(useCallback(() => {
    restore();
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [restore]));

  const onScrollToIndexFailed = useCallback<NonNullable<FlatListProps<T>["onScrollToIndexFailed"]>>(
    ({ index, averageItemLength }) => {
      // `index` aqui já é a linha pedida.
      listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: false });
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(restore, 80);
    },
    [columns, restore],
  );

  return { listRef, onScrollToIndexFailed };
}
