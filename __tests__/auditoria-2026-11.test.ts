import { mapLiveStreamToChannel, parseM3uPlaylist, extinfTitle } from "@/services/xtream";
import { parseXmltv } from "@/services/xmltv";
import { parseAddedAt, topItems } from "@/features/catalog/addedAt";
import { buildFallbackUrls } from "@/features/player/StreamResolver";
import { classifyDevice, playerBufferProfile } from "@/services/deviceProfile";
import { m3uChannelId } from "@/services/m3uImport";
import type { ServerProfile } from "@/store/types";

const profile = { id: "s1", serverUrl: "http://h:80", username: "u", password: "p" } as unknown as ServerProfile;
const category = { category_id: "1", category_name: "Geral", parent_id: 0 };

describe("auditoria 2026-11", () => {
  it("usa o num do painel como número do canal, e a posição quando ele falta", () => {
    const base = { stream_id: 18452, name: "Canal", stream_icon: "", category_id: "1", tv_archive: 0 };
    expect(mapLiveStreamToChannel({ ...base, num: 5 }, category, profile).number).toBe("5");
    expect(mapLiveStreamToChannel(base, category, profile, 12).number).toBe("12");
    expect(mapLiveStreamToChannel(base, category, profile).number).toBe("18452");
  });

  it("M3U: mantém o canal com #EXTVLCOPT antes do link e não corta o nome em vírgulas de atributos", () => {
    const entries = parseM3uPlaylist('#EXTM3U\n#EXTINF:-1 group-title="Filmes, Ação",Canal A, HD\n#EXTVLCOPT:http-user-agent=X\nhttp://x/a.ts\n#EXTINF:-1,B\n#EXTGRP:Esportes\nhttp://x/b.ts');
    expect(entries.map((e) => [e.name, e.group, e.url])).toEqual([
      ["Canal A, HD", "Filmes, Ação", "http://x/a.ts"],
      ["B", "Esportes", "http://x/b.ts"],
    ]);
    expect(extinfTitle('#EXTINF:-1 tvg-name="a,b",Nome')).toBe("Nome");
  });

  it("M3U: id do canal não depende da posição na lista", () => {
    const a = { tvgId: "", name: "Canal", group: "G", url: "http://x/1" };
    expect(m3uChannelId(a)).toBe(m3uChannelId({ ...a }));
    expect(m3uChannelId(a)).not.toBe(m3uChannelId({ ...a, url: "http://x/2" }));
  });

  it("XMLTV: decodifica entidades numéricas e descarta programas fora da janela", () => {
    const now = Date.UTC(2026, 9, 5, 10, 30);
    const guide = parseXmltv('<tv><programme start="20261005100000 +0000" stop="20261005110000 +0000" channel="c"><title>Not&#237;cias</title></programme><programme start="20261020100000 +0000" stop="20261020110000 +0000" channel="c"><title>Longe</title></programme></tv>', now);
    expect(guide.get("c")?.map((p) => p.title)).toEqual(["Notícias"]);
  });

  it("data de inclusão do Xtream em segundos Unix", () => {
    expect(parseAddedAt("1699999999")).toBe(1_699_999_999_000);
    expect(parseAddedAt("2026-01-02T00:00:00Z")).toBe(Date.UTC(2026, 0, 2));
    expect(parseAddedAt(undefined)).toBe(0);
  });

  it("topItems devolve o mesmo que ordenar tudo e cortar", () => {
    const values = [5, 1, 9, 3, 9, 7, 2];
    expect(topItems(values, 3, (a, b) => b - a)).toEqual([9, 9, 7]);
  });

  it("acrescenta a URL com credenciais codificadas como última tentativa", () => {
    expect(buildFallbackUrls("http://h/movie/j@o/p+s/9.mp4", "movie")).toEqual([
      "http://h/movie/j@o/p+s/9.mp4",
      "http://h/movie/j%40o/p%2Bs/9.mp4",
    ]);
  });

  it("perfil do aparelho define o buffer", () => {
    expect(classifyDevice(1024, false)).toBe("low");
    expect(classifyDevice(4096, true)).toBe("low");
    expect(classifyDevice(4096, false)).toBe("high");
    expect(classifyDevice(0, false)).toBe("standard");
    expect(playerBufferProfile(true, true, "standard").maxBufferBytes).toBe(48 * 1024 * 1024);
    expect(playerBufferProfile(true, true, "low").maxBufferBytes).toBeLessThan(48 * 1024 * 1024);
  });
});
