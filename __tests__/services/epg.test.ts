import { normalizeEpgListings, refreshEpgProgress } from "@/services/xtream";

describe("EPG Xtream", () => {
  it("decodifica Base64 e identifica a programação atual e a próxima", () => {
    const now = Date.UTC(2026, 8, 23, 12, 30, 0);
    const programs = normalizeEpgListings(
      [
        {
          id: "1",
          title: "Sm9ybmFsIGRvIEFsbW/Dp28=",
          description: "Tm90w61jaWFzIGFvIHZpdm8=",
          start: "2026-09-23 12:00:00",
          end: "2026-09-23 13:00:00",
          start_timestamp: String(Date.UTC(2026, 8, 23, 12, 0, 0) / 1000),
          stop_timestamp: String(Date.UTC(2026, 8, 23, 13, 0, 0) / 1000),
        },
        {
          id: "2",
          title: "UHLDs3hpbW8gcHJvZ3JhbWE=",
          start: "2026-09-23 13:00:00",
          end: "2026-09-23 14:00:00",
          start_timestamp: String(Date.UTC(2026, 8, 23, 13, 0, 0) / 1000),
          stop_timestamp: String(Date.UTC(2026, 8, 23, 14, 0, 0) / 1000),
        },
      ],
      now,
    );

    expect(programs).toHaveLength(2);
    expect(programs[0]).toMatchObject({
      title: "Jornal do Almoço",
      description: "Notícias ao vivo",
      isCurrent: true,
      progress: 50,
    });
    expect(programs[1]).toMatchObject({
      title: "Próximo programa",
      isCurrent: false,
      progress: 0,
    });
  });

  it("recalcula o progresso conforme o relógio avança", () => {
    const start = Date.UTC(2026, 8, 23, 12, 0, 0);
    const end = Date.UTC(2026, 8, 23, 13, 0, 0);
    const [program] = refreshEpgProgress(
      [
        {
          title: "Programa",
          start: "12:00",
          end: "13:00",
          startTimestamp: start,
          endTimestamp: end,
          progress: 0,
        },
      ],
      start + (end - start) * 0.75,
    );

    expect(program.isCurrent).toBe(true);
    expect(program.progress).toBe(75);
  });
});
