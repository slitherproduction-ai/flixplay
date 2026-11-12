import { useAppStore } from "@/store/useAppStore";
import { isPlaybackActive } from "@/services/playbackActivity";

/**
 * Atualização da categoria aberta (TV), como no Roku: ao abrir uma categoria
 * que já tem títulos no banco, a lista dela é pedida de novo ao servidor em
 * segundo plano — uma vez por sessão e por categoria — e os títulos novos
 * entram no banco. Assim a lista completa só precisa ser baixada uma vez por dia.
 */
const refreshed = new Set<string>();
const REFRESH_DELAY_MS = 1_500;

export function shouldRefreshCategory(key: string): boolean {
  if (refreshed.has(key)) return false;
  refreshed.add(key);
  return true;
}

export function forgetCategoryRefresh(key: string): void {
  refreshed.delete(key);
}

/** Espera a grade assentar; desiste durante sincronização completa ou vídeo. */
export async function waitForCategoryRefreshWindow(serverId: string): Promise<boolean> {
  await new Promise<void>((resolve) => setTimeout(resolve, REFRESH_DELAY_MS));
  const state = useAppStore.getState();
  return state.activeServerId === serverId && !state.syncState.isSyncing && !isPlaybackActive();
}
