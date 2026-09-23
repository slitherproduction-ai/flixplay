/**
 * GitHub Releases auto-update service for FlixPlay.
 *
 * Checks the official GitHub repository for new APK releases and provides
 * installation helpers. All network calls are guarded by try/catch so the UI
 * always receives a well-typed result — even when the repo has no releases yet.
 */

import { Linking, Platform } from "react-native";
import { APP_INFO } from "@/constants/app";

const GITHUB_API =
  `https://api.github.com/repos/${APP_INFO.githubRepo}/releases/latest`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  assets: GitHubAsset[];
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string | null;
  releaseName: string | null;
  releaseNotes: string | null;
  apkUrl: string | null;
  releaseUrl: string | null;
  publishedAt: string | null;
  error: string | null;
}

// ─── Version comparison ───────────────────────────────────────────────────────

/** Compare semver strings – returns true when remote > local. */
function isNewer(remote: string, local: string): boolean {
  const clean = (v: string) => v.replace(/^v/i, "").split(".").map(Number);
  const r = clean(remote);
  const l = clean(local);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] ?? 0;
    const lv = l[i] ?? 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

/** Pick the first .apk asset from a release, or null. */
function findApkAsset(assets: GitHubAsset[]): GitHubAsset | null {
  return (
    assets.find(
      (a) =>
        a.name.toLowerCase().endsWith(".apk") ||
        a.content_type === "application/vnd.android.package-archive",
    ) ?? null
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Fetch the latest GitHub release object. Returns null on any error. */
export async function getLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const res = await fetch(GITHUB_API, {
      headers: { Accept: "application/vnd.github.v3+json" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return null; // repo exists but no release yet
    if (!res.ok) return null;
    const data = (await res.json()) as GitHubRelease;
    if (data.draft || data.prerelease) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Check whether a newer version is available on GitHub Releases.
 *
 * Safe to call on first launch and on user request. Handles 404 (no release
 * yet), network errors, and JSON parse failures gracefully.
 */
export async function checkForGitHubUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = APP_INFO.version;
  const base: UpdateCheckResult = {
    hasUpdate: false,
    currentVersion,
    latestVersion: null,
    releaseName: null,
    releaseNotes: null,
    apkUrl: null,
    releaseUrl: null,
    publishedAt: null,
    error: null,
  };

  try {
    const release = await getLatestRelease();

    if (!release) {
      return {
        ...base,
        error: null, // not an error — just no release yet
      };
    }

    const latestVersion = release.tag_name.replace(/^v/i, "");
    const apkAsset = findApkAsset(release.assets);

    return {
      hasUpdate: isNewer(latestVersion, currentVersion),
      currentVersion,
      latestVersion,
      releaseName: release.name || release.tag_name,
      releaseNotes: release.body ?? null,
      apkUrl: apkAsset?.browser_download_url ?? null,
      releaseUrl: release.html_url,
      publishedAt: release.published_at,
      error: null,
    };
  } catch (err) {
    console.error("[githubUpdater] checkForGitHubUpdate failed", err);
    return {
      ...base,
      error: "Não foi possível verificar atualizações. Verifique sua conexão.",
    };
  }
}

/**
 * Attempt to open the APK download URL so the system installer takes over.
 *
 * On Android, this opens the browser/file manager to download and install
 * the APK (requires REQUEST_INSTALL_PACKAGES permission + unknown sources).
 * On other platforms, opens the release page instead.
 */
export async function downloadAndInstallUpdate(
  apkUrl: string,
  releaseUrl?: string | null,
): Promise<void> {
  try {
    const target =
      Platform.OS === "android" && apkUrl
        ? apkUrl
        : (releaseUrl ?? apkUrl);
    const canOpen = await Linking.canOpenURL(target);
    if (canOpen) {
      await Linking.openURL(target);
    } else {
      throw new Error("Não foi possível abrir a URL de download.");
    }
  } catch (err) {
    console.error("[githubUpdater] downloadAndInstallUpdate failed", err);
    throw new Error(
      "Não foi possível iniciar o download. Verifique as permissões e tente novamente.",
    );
  }
}
