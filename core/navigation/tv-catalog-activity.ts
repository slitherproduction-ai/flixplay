// O foco muda a cada movimento do controle. Uma pausa permite que o trabalho
// pesado continue sem abrir um segundo processo de sincronização.
let lastFocus = 0;
export function recordCatalogNavigation() { lastFocus = Date.now(); }

export async function waitForCatalogIdle(isCurrent: () => boolean, grace = 1200) {
  while (isCurrent()) {
    const remaining = grace - (Date.now() - lastFocus);
    if (remaining <= 0) break;
    await new Promise<void>(resolve => setTimeout(resolve, Math.min(remaining, 400)));
  }
}
