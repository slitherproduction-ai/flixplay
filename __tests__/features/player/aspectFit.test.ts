import { autoContentFit } from "@/features/player/aspectFit";

describe("autoContentFit", () => {
  const tv = 16 / 9;
  it("enche a tela em formatos próximos da TV", () => {
    expect(autoContentFit(16 / 9, tv)).toBe("cover");
    expect(autoContentFit(1.85, tv)).toBe("cover");
    expect(autoContentFit(2.0, tv)).toBe("cover");
  });
  it("mantém inteiro o que cortaria demais", () => {
    expect(autoContentFit(2.39, tv)).toBe("contain");
    expect(autoContentFit(4 / 3, tv)).toBe("contain");
  });
  it("sem tamanho do vídeo, não corta", () => {
    expect(autoContentFit(null, tv)).toBe("contain");
  });
});
