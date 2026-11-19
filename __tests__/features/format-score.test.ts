jest.mock("@/store/useAppStore", () => ({ useAppStore: { getState: () => ({ preferences: {}, setPreference: jest.fn() }) } }));

import { chooseLiveFormat, describeFormatStats, readFormatStats, recordFormatResult, type FormatStats } from "@/features/player/format-score";

function times(stats: FormatStats, n: number, format: "hls" | "ts", result: Parameters<typeof recordFormatResult>[2]): FormatStats {
  let next = stats;
  for (let i = 0; i < n; i++) next = recordFormatResult(next, format, result);
  return next;
}

describe("format-score", () => {
  it("sem dados, fica com o formato lembrado", () => {
    expect(chooseLiveFormat({}, "hls")).toBe("hls");
    expect(chooseLiveFormat({}, null)).toBeNull();
  });

  it("formato lembrado lento e travando: testa o outro", () => {
    const stats = times({}, 6, "ts", { openMs: 7_000 });
    expect(chooseLiveFormat(stats, "ts")).toBe("hls");
  });

  it("o outro já falhou nos testes: continua com o lembrado", () => {
    let stats = times({}, 5, "ts", { openMs: 7_000 });
    stats = times(stats, 3, "hls", { failed: true });
    expect(chooseLiveFormat(stats, "ts")).toBe("ts");
  });

  it("com os dois medidos, escolhe o melhor só com ganho claro", () => {
    let close = times({}, 3, "hls", { openMs: 2_000 });
    close = times(close, 3, "ts", { openMs: 2_100 });
    expect(chooseLiveFormat(close, "ts")).toBe("ts");
    let clear = times({}, 3, "hls", { openMs: 1_500 });
    clear = times(clear, 3, "ts", { openMs: 4_000 });
    expect(chooseLiveFormat(clear, "ts")).toBe("hls");
  });

  it("contadores diminuem para acompanhar o servidor", () => {
    const stats = times({}, 50, "hls", { openMs: 1_000 });
    expect(stats.hls!.opens).toBeLessThanOrEqual(40);
  });

  it("ignora dados inválidos e descreve sem endereço", () => {
    expect(readFormatStats("x")).toEqual({});
    const stats = times(times({}, 2, "hls", { openMs: 1_200 }), 1, "hls", { stalled: true });
    expect(describeFormatStats(stats)).toBe("HLS: 2 aberturas, média 1,2 s, 1 travada");
  });
});
