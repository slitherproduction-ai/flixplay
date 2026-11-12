import { pickBackdrop } from "@/services/xtream";

describe("pickBackdrop", () => {
  it("usa a primeira imagem http da lista backdrop_path", () => {
    expect(pickBackdrop({ info: { backdrop_path: ["", "https://image.tmdb.org/t/p/w1280/a.jpg", "https://x/b.jpg"] } }))
      .toBe("https://image.tmdb.org/t/p/w1280/a.jpg");
  });
  it("aceita backdrop_path como texto", () => {
    expect(pickBackdrop({ info: { backdrop_path: " http://painel.exemplo/fundo.jpg " } })).toBe("http://painel.exemplo/fundo.jpg");
  });
  it("ignora respostas sem imagem larga válida", () => {
    expect(pickBackdrop({ info: { backdrop_path: [] } })).toBe("");
    expect(pickBackdrop({ info: { backdrop_path: "/relativo.jpg" } })).toBe("");
    expect(pickBackdrop({ info: [] })).toBe("");
    expect(pickBackdrop(null)).toBe("");
  });
});
