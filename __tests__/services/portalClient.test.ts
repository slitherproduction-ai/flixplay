import {
  PORTAL_CONTROL_URL,
  PORTAL_PUBLISHABLE_KEY,
  portalServiceMessage,
  requestPortal,
} from "@/services/device/portalClient";

function response(body: unknown, status = 200, retryAfter?: string) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(body),
    headers: { get: jest.fn().mockReturnValue(retryAfter ?? null) },
  };
}

describe("Portal client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("sends only the requested action and its explicit public body", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockResolvedValue(response({ server: { code: "demo" } }));

    await expect(requestPortal("server-code-resolve", { code: "demo" })).resolves.toMatchObject({
      status: 200,
      ok: true,
      payload: { server: { code: "demo" } },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      PORTAL_CONTROL_URL,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ apikey: PORTAL_PUBLISHABLE_KEY }),
        body: JSON.stringify({ action: "server-code-resolve", code: "demo" }),
      }),
    );
  });

  it("keeps 429 and 503 distinct from a license denial", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(response({ message: "rate limited" }, 429, "120"))
      .mockResolvedValueOnce(response({ message: "maintenance" }, 503));

    const limited = await requestPortal("device-status", {});
    const unavailable = await requestPortal("device-status", {});

    expect(limited).toMatchObject({ status: 429, ok: false, retryAfterSeconds: 120 });
    expect(unavailable).toMatchObject({ status: 503, ok: false, retryAfterSeconds: null });
    expect(portalServiceMessage(limited.status, limited.retryAfterSeconds, "fallback")).toContain("2 min");
    expect(portalServiceMessage(unavailable.status, unavailable.retryAfterSeconds, "fallback")).toContain("temporariamente indisponível");
  });
});
