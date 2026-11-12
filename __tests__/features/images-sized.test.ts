import { sizedImage } from "@/features/images/sizedImage";

describe("sizedImage", () => {
  const tmdb = "https://image.tmdb.org/t/p/original/abc.jpg";
  it("troca o tamanho do TMDB pelo do uso e do aparelho", () => {
    expect(sizedImage(tmdb, "poster", "low")).toBe("https://image.tmdb.org/t/p/w185/abc.jpg");
    expect(sizedImage("https://image.tmdb.org/t/p/w600_and_h900_bestv2/x.jpg", "poster", "standard")).toBe("https://image.tmdb.org/t/p/w342/x.jpg");
    expect(sizedImage("https://image.tmdb.org/t/p/w1280/y.jpg", "backdrop", "low")).toBe("https://image.tmdb.org/t/p/w780/y.jpg");
  });
  it("não mexe em imagens de outros servidores", () => {
    expect(sizedImage("http://painel.exemplo/img/123.jpg", "poster", "low")).toBe("http://painel.exemplo/img/123.jpg");
    expect(sizedImage(undefined, "poster", "low")).toBe("");
  });
});
