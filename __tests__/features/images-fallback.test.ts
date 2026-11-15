import { imageCandidates } from "@/features/images/fallbackImage";

describe("imageCandidates", () => {
  it("dá a cada imagem do TMDB o espelho do próprio TMDB logo em seguida", () => {
    expect(imageCandidates("https://image.tmdb.org/t/p/w1280/a.jpg", "http://lista.example/b.jpg")).toEqual([
      "https://image.tmdb.org/t/p/w1280/a.jpg",
      "https://media.themoviedb.org/t/p/w1280/a.jpg",
      "http://lista.example/b.jpg",
    ]);
  });
  it("ignora vazios e repetidos", () => {
    expect(imageCandidates("", null, "http://x/c.jpg", "http://x/c.jpg")).toEqual(["http://x/c.jpg"]);
  });
});
