/**
 * Se há um vídeo aberto (tela do player). A atualização automática do
 * catálogo espera o vídeo terminar para não disputar rede e memória com ele.
 */
let openPlayers = 0;
const listeners = new Set<() => void>();

export function setPlaybackActive(active: boolean): void {
  openPlayers = Math.max(0, openPlayers + (active ? 1 : -1));
  if (openPlayers === 0) listeners.forEach((listener) => { try { listener(); } catch { /* opcional */ } });
}

export function isPlaybackActive(): boolean {
  return openPlayers > 0;
}

/** Avisa quando o último player fecha. */
export function onPlaybackEnded(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
