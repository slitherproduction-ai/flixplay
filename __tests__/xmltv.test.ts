import { parseXmltv, parseXmltvTimestamp } from "@/services/xmltv";

describe("XMLTV", () => {
  it("normalizes timezone timestamps", () => {
    expect(parseXmltvTimestamp("20261005120000 +0300")).toBe(Date.UTC(2026, 9, 5, 9, 0, 0));
  });

  it("groups valid programmes and calculates the current programme", () => {
    const guide = parseXmltv('<tv><programme start="20261005100000 +0000" stop="20261005110000 +0000" channel="news"><title>Notícias &amp; Agora</title></programme><programme channel="bad"><title>Inválido</title></programme></tv>', Date.UTC(2026, 9, 5, 10, 30, 0));
    expect(guide.get("news")).toMatchObject([{ title: "Notícias & Agora", isCurrent: true, progress: 50 }]);
    expect(guide.has("bad")).toBe(false);
  });
});
