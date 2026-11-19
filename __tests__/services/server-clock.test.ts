import { noteServerDate, noteServerTimestamp, resetServerClock, serverClockOffsetMs } from "@/services/serverClock";

describe("serverClock", () => {
  beforeEach(() => resetServerClock());

  it("aparelho certo: nada muda", () => {
    const now = Date.UTC(2026, 10, 19, 12);
    noteServerDate(new Date(now + 30_000).toUTCString(), now);
    noteServerDate(new Date(now + 30_000).toUTCString(), now);
    expect(serverClockOffsetMs()).toBe(0);
  });

  it("relógio atrasado: aplica depois de duas respostas que concordam", () => {
    const now = Date.UTC(2026, 10, 19, 12);
    const server = new Date(now + 37 * 60_000).toUTCString();
    noteServerDate(server, now);
    expect(serverClockOffsetMs()).toBe(0);
    noteServerDate(server, now);
    expect(Math.round(serverClockOffsetMs() / 60_000)).toBe(37);
  });

  it("timestamp_now com horas exatas de diferença é ignorado", () => {
    const now = Date.UTC(2026, 10, 19, 12);
    noteServerTimestamp((now - 3 * 3_600_000) / 1000, now);
    expect(serverClockOffsetMs()).toBe(0);
    noteServerTimestamp((now + 25 * 60_000) / 1000, now);
    expect(Math.round(serverClockOffsetMs() / 60_000)).toBe(25);
  });
});
