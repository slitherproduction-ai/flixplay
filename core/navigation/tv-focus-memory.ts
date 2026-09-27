export type TvFocusSnapshot = {
  itemId: string;
  itemIndex?: number;
  updatedAt: number;
};

const focusByScope = new Map<string, TvFocusSnapshot>();

/**
 * Session-scoped focus memory for D-Pad navigation. Keeping it outside React
 * avoids re-rendering large rails/grids every time focus moves between cards.
 */
export function rememberTvFocus(scope: string, itemId: string, itemIndex?: number) {
  focusByScope.set(scope, { itemId, itemIndex, updatedAt: Date.now() });
}

export function getRememberedTvFocus(scope: string): TvFocusSnapshot | undefined {
  return focusByScope.get(scope);
}

export function hasRememberedTvFocus(scope: string): boolean {
  return focusByScope.has(scope);
}

export function clearRememberedTvFocus(scope?: string) {
  if (scope) {
    focusByScope.delete(scope);
    return;
  }
  focusByScope.clear();
}
