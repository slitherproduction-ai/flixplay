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

/**
 * Volta de outra tela (2.17.82). Em TVs mais lentas a tela de Detalhes demora
 * para sair; quando ela sai, o Android entrega o foco ao primeiro item da tela
 * (a categoria "Buscar título ou ator"), mesmo depois de o título lembrado já
 * ter recebido o foco. Por um curto período esse foco volta para o título.
 */
const returning = new Map<string, { until: number; restored: boolean }>();

export function beginTvFocusReturn(scope: string, ms = 1800) {
  returning.set(scope, { until: Date.now() + ms, restored: false });
}

export function endTvFocusReturn(scope: string) {
  returning.delete(scope);
}

/** O título lembrado recebeu o foco: não precisa mais insistir. */
export function markTvFocusRestored(scope: string) {
  const state = returning.get(scope);
  if (state) state.restored = true;
}

export function isTvFocusReturning(scope: string): boolean {
  const state = returning.get(scope);
  if (!state) return false;
  if (Date.now() > state.until) {
    returning.delete(scope);
    return false;
  }
  return true;
}

/** Ainda voltando e o título lembrado não recebeu o foco. */
export function needsTvFocusRestore(scope: string): boolean {
  return isTvFocusReturning(scope) && returning.get(scope)?.restored !== true;
}
