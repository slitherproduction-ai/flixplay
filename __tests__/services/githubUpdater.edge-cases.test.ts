import {
  checkForGitHubUpdate,
  findApkAsset,
  getLatestRelease,
  isNewer,
} from "@/services/githubUpdater";

type FetchResponse = {
  status: number;
  ok: boolean;
  json: jest.Mock;
};

function release(overrides: Record<string, unknown> = {}) {
  return {
    tag_name: "v99.0.0",
    name: "FlixPlay 99.0.0",
    body: "Notas verificáveis da versão.",
    assets: [],
    published_at: "2026-09-28T00:00:00Z",
    prerelease: false,
    draft: false,
    html_url: "https://github.com/slitherproduction-ai/flixplay/releases/tag/v99.0.0",
    ...overrides,
  };
}

function response(
  body: unknown,
  options: { status?: number; ok?: boolean } = {},
): FetchResponse {
  const status = options.status ?? 200;
  return {
    status,
    ok: options.ok ?? (status >= 200 && status < 300),
    json: jest.fn().mockResolvedValue(body),
  };
}

describe("GitHub updater edge cases", () => {
  const originalFetch = globalThis.fetch;
  const originalTimeout = globalThis.AbortSignal.timeout;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
    globalThis.AbortSignal.timeout = jest
      .fn()
      .mockReturnValue(new AbortController().signal);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.AbortSignal.timeout = originalTimeout;
    jest.restoreAllMocks();
  });

  it.each([
    ["1.0.0-beta.1", "1.0.0"],
    ["1.0.0+build.7", "1.0.0"],
    ["1.0", "1.0.0"],
    ["1.0.0.1", "1.0.0"],
    ["", "1.0.0"],
  ])("rejects unsupported version %p", (remote, local) => {
    expect(isNewer(remote, local)).toBe(false);
  });

  it("ignores draft and prerelease responses even if their version is newer", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(response(release({ draft: true })))
      .mockResolvedValueOnce(response(release({ prerelease: true })));

    await expect(getLatestRelease()).resolves.toBeNull();
    await expect(getLatestRelease()).resolves.toBeNull();
  });

  it("handles not-found, server failure and rejected requests without throwing", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(response(null, { status: 404 }))
      .mockResolvedValueOnce(response(null, { status: 503 }))
      .mockRejectedValueOnce(new Error("offline"));

    await expect(getLatestRelease()).resolves.toBeNull();
    await expect(getLatestRelease()).resolves.toBeNull();
    await expect(getLatestRelease()).resolves.toBeNull();
  });

  it("returns release metadata but never exposes an invalid APK as downloadable", async () => {
    const invalidAssets = [
      {
        name: "FlixPlay.apk",
        browser_download_url: "http://downloads.example/FlixPlay.apk",
        size: 42,
        content_type: "application/vnd.android.package-archive",
      },
      {
        name: "FlixPlay.apk.zip",
        browser_download_url: "https://downloads.example/FlixPlay.apk.zip",
        size: 42,
        content_type: "application/octet-stream",
      },
      {
        name: "empty.apk",
        browser_download_url: "https://downloads.example/empty.apk",
        size: 0,
        content_type: "application/vnd.android.package-archive",
      },
    ];
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce(
      response(release({ assets: invalidAssets })),
    );

    const result = await checkForGitHubUpdate();

    expect(result.hasUpdate).toBe(true);
    expect(result.latestVersion).toBe("99.0.0");
    expect(result.apkUrl).toBeNull();
    expect(result.apkSize).toBeNull();
    expect(findApkAsset(invalidAssets)).toBeNull();
  });

  it("uses an eight-second abort signal for the release request", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce(response(release()));

    await getLatestRelease();

    expect(globalThis.AbortSignal.timeout).toHaveBeenCalledWith(8000);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/api\.github\.com\/repos\//),
      expect.objectContaining({
        headers: { Accept: "application/vnd.github.v3+json" },
        signal: expect.any(Object),
      }),
    );
  });
});
