import {
  applyDnsToPlaybackUrls,
  clearDnsCache,
  markDnsFailure,
  rewriteWithIp,
  setDnsMode,
  shouldUseIp,
} from "@/services/dnsFallback";

const realFetch = global.fetch;

function mockDoh() {
  global.fetch = jest.fn(async (url: string) => {
    if (url.includes("8.8.8.8")) {
      return { ok: true, json: async () => ({ Status: 0, Answer: [{ type: 1, data: "0.0.0.0", TTL: 30 }, { type: 1, data: "203.0.113.10", TTL: 120 }] }) };
    }
    if (url.includes("1.1.1.1")) return { ok: true, json: async () => ({ Status: 3 }) };
    return { ok: true, json: async () => ({ ips: ["198.51.100.7"], ttl: 300 }) };
  }) as unknown as typeof fetch;
}

describe("dnsFallback", () => {
  beforeEach(() => {
    clearDnsCache();
    setDnsMode("auto");
    mockDoh();
  });
  afterAll(() => {
    global.fetch = realFetch;
  });

  it("troca o domínio pelo IP e descarta respostas de bloqueio", async () => {
    const r = await rewriteWithIp("http://srv.com:8080/player_api.php?a=1");
    expect(r).toEqual({ url: "http://203.0.113.10:8080/player_api.php?a=1", host: "srv.com:8080", ip: "203.0.113.10", source: "google" });
  });

  it("não mexe em https nem com o DNS desligado", async () => {
    expect(await rewriteWithIp("https://srv.com/x")).toBeNull();
    setDnsMode("off");
    expect(await rewriteWithIp("http://srv.com/x")).toBeNull();
  });

  it("usa o Portal quando o provedor escolhido não responde", async () => {
    setDnsMode("cloudflare");
    expect((await rewriteWithIp("http://outro.com/a"))?.source).toBe("portal");
  });

  it("player: lista intacta até o servidor ser marcado; depois IP primeiro", async () => {
    const url = "http://srv.com:8080/live/u/p/1.ts";
    await rewriteWithIp(url);
    expect(applyDnsToPlaybackUrls([url])).toEqual({ urls: [url], hostHeader: null });
    markDnsFailure(url);
    expect(shouldUseIp(url)).toBe(true);
    expect(applyDnsToPlaybackUrls([url])).toEqual({ urls: ["http://203.0.113.10:8080/live/u/p/1.ts", url], hostHeader: "srv.com:8080" });
  });
});
