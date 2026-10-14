/**
 * GitHub Releases auto-update service for FlixPlay.
 *
 * Checks the official GitHub repository for new APK releases and provides
 * installation helpers. All network calls are guarded by try/catch so the UI
 * always receives a well-typed result — even when the repo has no releases yet.
 */

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { APP_INFO } from "@/constants/app";
import { logTechnicalError } from "@/services/security/sanitize";

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
  apkSize: number | null;
  releaseUrl: string | null;
  publishedAt: string | null;
  error: string | null;
}

export type UpdateDownloadProgress = {
  writtenBytes: number;
  totalBytes: number | null;
  fraction: number | null;
};

const APK_MIME_TYPE = "application/vnd.android.package-archive";
const GRANT_READ_URI_PERMISSION = 1;

// ─── Version comparison ───────────────────────────────────────────────────────

/** Compare semver strings – returns true when remote > local. */
export function isNewer(remote: string, local: string): boolean {
  const parse = (value: string): number[] | null => {
    const normalized = value.trim().replace(/^v/i, "");
    if (!/^\d+\.\d+\.\d+$/.test(normalized)) return null;
    return normalized.split(".").map(Number);
  };
  const r = parse(remote);
  const l = parse(local);
  if (!r || !l) return false;
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] ?? 0;
    const lv = l[i] ?? 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

/** Pick the first .apk asset from a release, or null. */
export function findApkAsset(assets: GitHubAsset[]): GitHubAsset | null {
  return (
    assets.find(
      (a) =>
        a.size > 0 &&
        a.browser_download_url.startsWith("https://") &&
        a.name.toLowerCase().endsWith(".apk") &&
        (a.content_type === "application/vnd.android.package-archive" ||
          a.content_type === "application/octet-stream"),
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
    apkSize: null,
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
      apkSize: apkAsset?.size ?? null,
      releaseUrl: release.html_url,
      publishedAt: release.published_at,
      error: null,
    };
  } catch (err) {
    logTechnicalError("Updater/check", err);
    return {
      ...base,
      error: "Não foi possível verificar atualizações. Verifique sua conexão.",
    };
  }
}

/**
 * Downloads an APK into the app cache and opens Android's package installer.
 * The user always confirms the installation in the system UI; silent installs
 * are intentionally not supported.
 */
export async function downloadAndInstallUpdate(
  apkUrl: string,
  expectedBytes?: number | null,
  onProgress?: (progress: UpdateDownloadProgress) => void,
): Promise<void> {
  if (Platform.OS !== "android") {
    throw new Error("A instalação interna está disponível somente no Android.");
  }
  if (!apkUrl.startsWith("https://")) {
    throw new Error("A atualização não possui uma URL segura para download.");
  }

  try {
    const cacheDirectory = FileSystem.cacheDirectory;
    if (!cacheDirectory) {
      throw new Error("Não foi possível preparar o armazenamento da atualização.");
    }

    const destination = `${cacheDirectory}elvanoq-update.apk`;
    const previous = await FileSystem.getInfoAsync(destination);
    if (previous.exists) {
      await FileSystem.deleteAsync(destination, { idempotent: true });
    }

    const download = FileSystem.createDownloadResumable(
      apkUrl,
      destination,
      { headers: { Accept: APK_MIME_TYPE } },
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        const total = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : null;
        onProgress?.({
          writtenBytes: totalBytesWritten,
          totalBytes: total,
          fraction: total ? Math.min(1, totalBytesWritten / total) : null,
        });
      },
    );
    const result = await download.downloadAsync();
    if (!result || result.status < 200 || result.status >= 300) {
      throw new Error("O servidor não retornou um pacote de atualização válido.");
    }

    const downloaded = await FileSystem.getInfoAsync(destination);
    if (!downloaded.exists || !downloaded.size) {
      throw new Error("O arquivo da atualização não foi baixado corretamente.");
    }
    if (expectedBytes && downloaded.size < Math.floor(expectedBytes * 0.98)) {
      throw new Error("O download da atualização ficou incompleto. Tente novamente.");
    }

    const contentUri = await FileSystem.getContentUriAsync(destination);
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: contentUri,
      type: APK_MIME_TYPE,
      flags: GRANT_READ_URI_PERMISSION,
    });
  } catch (err) {
    logTechnicalError("Updater/download", err);
    throw new Error(
      "Não foi possível baixar a atualização. Verifique a conexão e permita instalações desta fonte nas configurações do Android.",
    );
  }
}
