import { findApkAsset, isNewer } from "@/services/githubUpdater";

describe("GitHub updater", () => {
  it.each([
    ["2.13.0", "2.12.1", true],
    ["v2.12.1", "2.12.1", false],
    ["2.11.9", "2.12.1", false],
    ["invalid", "2.12.1", false],
    ["2.13", "2.12.1", false],
  ])("compares %s with %s safely", (remote, local, expected) => {
    expect(isNewer(remote, local)).toBe(expected);
  });

  it("accepts only a non-empty HTTPS APK", () => {
    const asset = findApkAsset([
      { name: "notes.txt", browser_download_url: "https://example.com/notes.txt", size: 10, content_type: "text/plain" },
      { name: "unsafe.apk", browser_download_url: "http://example.com/unsafe.apk", size: 10, content_type: "application/vnd.android.package-archive" },
      { name: "FlixPlay.apk", browser_download_url: "https://example.com/FlixPlay.apk", size: 42, content_type: "application/vnd.android.package-archive" },
    ]);
    expect(asset?.name).toBe("FlixPlay.apk");
  });
});
