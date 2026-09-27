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
      listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.42 });
    });
  }, [enabled, scope]);

  useFocusEffect(useCallback(() => {
    restore();
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [restore]));

  const onScrollToIndexFailed = useCallback<NonNullable<FlatListProps<T>["onScrollToIndexFailed"]>>(
    ({ index, averageItemLength }) => {
      const row = Math.floor(index / Math.max(columns, 1));
      listRef.current?.scrollToOffset({ offset: averageItemLength * row, animated: false });
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(restore, 80);
    },
    [columns, restore],
  );

  return { listRef, onScrollToIndexFailed };
}
