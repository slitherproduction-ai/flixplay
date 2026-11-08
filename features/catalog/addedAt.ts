/**
 * Data de inclusão no catálogo em milissegundos.
 *
 * O Xtream envia `added` como segundos Unix em texto ("1699999999"); listas M3U
 * e o Portal podem enviar ISO ("2026-11-08T10:00:00Z"). `Date.parse` sozinho
 * devolve NaN para o primeiro caso, e a ordem "Recentes" caía em alfabética.
 */
export function parseAddedAt(value?: string | number | null): number {
  if (value === undefined || value === null || value === "") return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Os `limit` maiores itens segundo `compare` (ordem decrescente de prioridade),
 * sem ordenar a lista inteira: em catálogos de 100 mil títulos a Home só
 * precisa de algumas dezenas. Custo O(n · limit) com limit pequeno.
 */
export function topItems<T>(items: readonly T[], limit: number, compare: (a: T, b: T) => number): T[] {
  if (limit <= 0) return [];
  const top: T[] = [];
  for (const item of items) {
    if (top.length === limit && compare(item, top[top.length - 1]) >= 0) continue;
    let index = top.length;
    while (index > 0 && compare(item, top[index - 1]) < 0) index -= 1;
    top.splice(index, 0, item);
    if (top.length > limit) top.pop();
  }
  return top;
}
