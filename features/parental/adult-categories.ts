/**
 * Proteção automática de conteúdo adulto: categorias com nomes típicos pedem o
 * PIN sem o usuário configurar nada. O usuário pode liberar uma categoria
 * detectada; a exceção fica na própria lista de bloqueios como "!<id>", o que
 * reaproveita a persistência por servidor já existente.
 */
const ADULT_PATTERN = /(^|[^a-z0-9À-ɏ])(x{3,}|porn[a-zÀ-ɏ]*|adult[oa]s?|adults?|hentai|er[oó]tic[a-zÀ-ɏ]*|playboy|sexy ?hot|nsfw|\+ ?18|18 ?\+)(?![a-z0-9À-ɏ])/i;

export const ADULT_EXCEPTION_PREFIX = "!";
export const AUTO_ADULT_PREFERENCE = "parentalAutoAdult";

export function isAdultCategoryName(name: string | undefined): boolean {
  return Boolean(name) && ADULT_PATTERN.test(String(name).toLocaleLowerCase("pt-BR"));
}

export function exceptionId(categoryId: string): string {
  return `${ADULT_EXCEPTION_PREFIX}${categoryId}`;
}

/** Regra única: exceção libera, bloqueio manual bloqueia, senão vale a detecção automática. */
export function resolveCategoryBlocked(list: readonly string[], categoryId: string, categoryName: string | undefined, autoAdult: boolean): boolean {
  if (!categoryId) return false;
  if (list.includes(exceptionId(categoryId))) return false;
  if (list.includes(categoryId)) return true;
  return autoAdult && isAdultCategoryName(categoryName);
}

/** Alterna o bloqueio de uma categoria levando em conta a detecção automática. */
export function toggleBlockedList(list: readonly string[], categoryId: string, categoryName: string | undefined, autoAdult: boolean): string[] {
  const blockedNow = resolveCategoryBlocked(list, categoryId, categoryName, autoAdult);
  const withoutEntries = list.filter((id) => id !== categoryId && id !== exceptionId(categoryId));
  const autoBlocked = autoAdult && isAdultCategoryName(categoryName);
  if (blockedNow) return autoBlocked ? [...withoutEntries, exceptionId(categoryId)] : withoutEntries;
  return autoBlocked ? withoutEntries : [...withoutEntries, categoryId];
}

/** Quantas categorias da lista estão protegidas (manual ou automática). */
export function countBlocked(list: readonly string[], categories: readonly { id: string; name: string }[], autoAdult: boolean): number {
  let count = 0;
  for (const category of categories) if (resolveCategoryBlocked(list, category.id, category.name, autoAdult)) count += 1;
  return count;
}
