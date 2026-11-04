import { countBlocked, isAdultCategoryName, resolveCategoryBlocked, toggleBlockedList } from "@/features/parental/adult-categories";

describe("adult-categories", () => {
  it("detecta nomes típicos sem falsos positivos comuns", () => {
    for (const name of ["Adultos", "XXX Premium", "Canais +18", "18+ Filmes", "Hentai", "Eróticos"]) expect(isAdultCategoryName(name)).toBe(true);
    for (const name of ["Esportes", "Filmes 2024", "Drama Jovem", "Sexta-feira", "Infantil"]) expect(isAdultCategoryName(name)).toBe(false);
  });

  it("bloqueia automaticamente e permite liberar com exceção", () => {
    expect(resolveCategoryBlocked([], "10", "Adultos", true)).toBe(true);
    expect(resolveCategoryBlocked([], "10", "Adultos", false)).toBe(false);
    const released = toggleBlockedList([], "10", "Adultos", true);
    expect(released).toEqual(["!10"]);
    expect(resolveCategoryBlocked(released, "10", "Adultos", true)).toBe(false);
    expect(toggleBlockedList(released, "10", "Adultos", true)).toEqual([]);
  });

  it("mantém o bloqueio manual de categorias comuns", () => {
    const list = toggleBlockedList([], "5", "Esportes", true);
    expect(list).toEqual(["5"]);
    expect(resolveCategoryBlocked(list, "5", "Esportes", true)).toBe(true);
    expect(toggleBlockedList(list, "5", "Esportes", true)).toEqual([]);
    expect(countBlocked(list, [{ id: "5", name: "Esportes" }, { id: "9", name: "XXX" }, { id: "1", name: "Notícias" }], true)).toBe(2);
  });
});
