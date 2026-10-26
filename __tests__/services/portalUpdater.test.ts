jest.mock("expo-file-system/legacy", () => ({}));
jest.mock("expo-intent-launcher", () => ({}));
jest.mock("@/services/updateIntegrity", () => ({ verifyUpdateSha256: jest.fn() }));

import { PORTAL_RELEASE_METADATA_URL } from "@/constants/updates";
import { checkForPortalUpdate, isNewer } from "@/services/portalUpdater";

type MockResponse = {
  status: number;
  ok: boolean;
  json: jest.Mock;
};

function publishedRelease(overrides: Record<string, unknown> = {}) {
  return {
    id: "b246b60e-7e5d-4493-a655-ce9fc054631b",
    version: "2.17.17",
    size: 74_168_777,
    sha256: "6ea59359bd0d74966337d80ef1e18b549e2521aa8a98b82a3dc1d271de350865",
    notes: "Correções de estabilidade.",
    created_at: "2026-10-26T16:16:16.508Z",
    published_at: "2026-10-26T16:17:49.817Z",
    ready: true,
    download_url: "https://downloads.elvanoqplay.app/ELVANOQ-Play.apk",
    ...overrides,
  };
}

function response(body: unknown, status = 200): MockResponse {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(body),
  };
}

describe("Portal updater", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it.each([
    ["2.17.17", "2.17.16", true],
    ["2.17.16", "2.17.16", false],
    ["2.17.15", "2.17.16", false],
    ["2.17", "2.17.16", false],
  ])("compares published versions numerically: %s / %s", (remote, local, expected) => {
    expect(isNewer(remote, local)).toBe(expected);
  });

  it("uses only the no-cache public metadata endpoint and accepts a ready release", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce(response({ release: publishedRelease() }));

    const result = await checkForPortalUpdate();

    expect(result).toMatchObject({
      hasUpdate: true,
      latestVersion: "2.17.17",
      apkUrl: "https://downloads.elvanoqplay.app/ELVANOQ-Play.apk",
      apkSize: 74_168_777,
      error: null,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      PORTAL_RELEASE_METADATA_URL,
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: expect.objectContaining({ "Cache-Control": "no-cache" }),
      }),
    );
  });

  it("does not classify a successful HTTP 200 response as a Portal error", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce(response({ release: publishedRelease() }, 200));

    await expect(checkForPortalUpdate()).resolves.toMatchObject({
      hasUpdate: true,
      error: null,
    });
  });

  it("does not offer equal or older Portal releases as downgrades", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(response({ release: publishedRelease({ version: "2.17.16" }) }))
      .mockResolvedValueOnce(response({ release: publishedRelease({ version: "2.17.15" }) }));

    await expect(checkForPortalUpdate()).resolves.toMatchObject({
      hasUpdate: false,
      latestVersion: "2.17.16",
      releaseNotes: "Correções de estabilidade.",
      error: null,
    });
    await expect(checkForPortalUpdate()).resolves.toMatchObject({ hasUpdate: false, error: null });
  });

  it("handles a missing release and service failures without blocking the app", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(response({ release: null }))
      .mockResolvedValueOnce(response(null, 404))
      .mockResolvedValueOnce(response(null, 403))
      .mockResolvedValueOnce(response(null, 429))
      .mockResolvedValueOnce(response(null, 503))
      .mockRejectedValueOnce(new Error("offline"));

    await expect(checkForPortalUpdate()).resolves.toMatchObject({ hasUpdate: false, error: null });
    await expect(checkForPortalUpdate()).resolves.toMatchObject({ hasUpdate: false, error: null });
    await expect(checkForPortalUpdate()).resolves.toMatchObject({ error: expect.any(String) });
    await expect(checkForPortalUpdate()).resolves.toMatchObject({ error: expect.stringMatching(/Muitas verificações/) });
    await expect(checkForPortalUpdate()).resolves.toMatchObject({ error: expect.stringMatching(/temporariamente indisponível/) });
    await expect(checkForPortalUpdate()).resolves.toMatchObject({ error: expect.stringMatching(/conexão/) });
  });

  it("rejects unpublished or tampered release metadata", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(response({ release: publishedRelease({ ready: false }) }))
      .mockResolvedValueOnce(response({ release: publishedRelease({ sha256: "invalid" }) }))
      .mockResolvedValueOnce(response({ release: publishedRelease({ download_url: "https://attacker.example/app.apk" }) }));

    await expect(checkForPortalUpdate()).resolves.toMatchObject({ hasUpdate: false, error: expect.any(String) });
    await expect(checkForPortalUpdate()).resolves.toMatchObject({ hasUpdate: false, error: expect.any(String) });
    await expect(checkForPortalUpdate()).resolves.toMatchObject({ hasUpdate: false, error: expect.any(String) });
  });
});
