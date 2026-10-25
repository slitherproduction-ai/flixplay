import { resolveServerCode } from "@/services/device/serverCodeResolver";

function response(body: unknown, status: number) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(body),
    headers: { get: jest.fn().mockReturnValue(null) },
  };
}

describe("server code resolution", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("preserves the Portal HTTP host exactly as returned", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(response({
      server: { code: "flixplay", host: "http://flixplay.sbs", updated_at: "2026-10-25T00:00:00Z" },
    }, 200));

    await expect(resolveServerCode("  FLIXPLAY ")).resolves.toEqual({
      code: "flixplay",
      host: "http://flixplay.sbs",
      updatedAt: "2026-10-25T00:00:00Z",
    });
  });

  it("reports a Portal outage without misclassifying it as invalid IPTV credentials", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(response({ message: "maintenance" }, 503));

    await expect(resolveServerCode("flixplay")).rejects.toMatchObject({
      reason: "unavailable",
      message: "Portal temporariamente indisponível. Tente novamente em instantes.",
    });
  });
});
