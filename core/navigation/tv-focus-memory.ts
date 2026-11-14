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

/**
 * Itens que podem receber o foco de volta (2.17.60). `hasTVPreferredFocus` só
 * age quando o item aparece; ao voltar de Detalhes a grade continua montada,
 * então o Android entregava o foco ao primeiro item da tela (o campo de busca
 * das categorias). O item lembrado agora é focado de propósito.
 */
type FocusTarget = { focus: () => void };
const targets = new Map<string, FocusTarget>();
const targetKey = (scope: string, itemId: string) => `${scope}\u0001${itemId}`;

export function registerTvFocusTarget(scope: string, itemId: string, target: FocusTarget): () => void {
  const key = targetKey(scope, itemId);
  targets.set(key, target);
  return () => {
    if (targets.get(key) === target) targets.delete(key);
  };
}

/** Foca o item lembrado do escopo, se ele está montado. Devolve se conseguiu. */
export function focusRememberedTvTarget(scope: string): boolean {
  const remembered = focusByScope.get(scope);
  if (!remembered) return false;
  const target = targets.get(targetKey(scope, remembered.itemId));
  if (!target) return false;
  try {
    target.focus();
    return true;
  } catch {
    return false;
  }
}
