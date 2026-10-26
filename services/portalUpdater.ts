import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { APP_INFO } from "@/constants/app";
import {
  PORTAL_RELEASE_APK_URL,
  PORTAL_RELEASE_METADATA_URL,
  PORTAL_UPDATE_TIMEOUT_MS,
} from "@/constants/updates";
import { logTechnicalError } from "@/services/security/sanitize";
import { verifyUpdateSha256 } from "@/services/updateIntegrity";

type PortalRelease = {
  id: string;
  version: string;
  size: number;
  sha256: string;
  notes: string;
  created_at: string;
  published_at: string;
  ready: boolean;
  download_url: string;
};

type PortalReleaseResponse = { release: PortalRelease | null };

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string | null;
  releaseName: string | null;
  releaseNotes: string | null;
  apkUrl: string | null;
  apkSize: number | null;
  apkSha256: string | null;
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
let activeDownload: ReturnType<typeof FileSystem.createDownloadResumable> | null = null;
let activeDestination: string | null = null;
let cancellationRequested = false;

function isVersion(value: unknown): value is string {
  return typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value.trim());
}

function isPublishedRelease(value: unknown): value is PortalRelease {
  if (!value || typeof value !== "object") return false;
  const release = value as Partial<PortalRelease>;
  return typeof release.id === "string"
    && isVersion(release.version)
    && typeof release.size === "number"
    && Number.isSafeInteger(release.size)
    && release.size > 0
    && typeof release.sha256 === "string"
    && /^[a-f0-9]{64}$/i.test(release.sha256)
    && typeof release.notes === "string"
    && typeof release.created_at === "string"
    && typeof release.published_at === "string"
    && !Number.isNaN(Date.parse(release.published_at))
    && release.ready === true
    && release.download_url === PORTAL_RELEASE_APK_URL;
}

function baseResult(): UpdateCheckResult {
  return {
    hasUpdate: false,
    currentVersion: APP_INFO.version,
    latestVersion: null,
    releaseName: null,
    releaseNotes: null,
    apkUrl: null,
    apkSize: null,
    apkSha256: null,
    publishedAt: null,
    error: null,
  };
}

/** Numeric x.y.z comparison; equal and older remote versions are never offered. */
export function isNewer(remote: string, local: string): boolean {
  if (!isVersion(remote) || !isVersion(local)) return false;
  const remoteParts = remote.split(".").map(Number);
  const localParts = local.split(".").map(Number);
  for (let index = 0; index < remoteParts.length; index += 1) {
    if (remoteParts[index] > localParts[index]) return true;
    if (remoteParts[index] < localParts[index]) return false;
  }
  return false;
}

function serviceError(status: number): string | null {
  if (status === 404) return null; // no published release is a valid state
  if (status === 403) return "As atualizações pelo Portal não estão disponíveis para consulta agora.";
  if (status === 429) return "Muitas verificações de atualização. Aguarde alguns minutos e tente novamente.";
  if (status >= 500) return "O serviço de atualizações está temporariamente indisponível.";
  return "Não foi possível validar a atualização publicada pelo Portal.";
}

/** Reads only the Portal's public, published release record; no identity or credentials are sent. */
export async function checkForPortalUpdate(): Promise<UpdateCheckResult> {
  const base = baseResult();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PORTAL_UPDATE_TIMEOUT_MS);
  try {
    const response = await fetch(PORTAL_RELEASE_METADATA_URL, {
      method: "GET",
      headers: { Accept: "application/json", "Cache-Control": "no-cache", Pragma: "no-cache" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      const statusError = serviceError(response.status);
      if (statusError !== null) return { ...base, error: statusError };
      // A ausência de uma publicação é um estado válido para a distribuição.
      if (response.status === 404) return base;
      return { ...base, error: "Não foi possível validar a atualização publicada pelo Portal." };
    }

    const payload = await response.json() as PortalReleaseResponse;
    if (payload.release === null) return base;
    if (!isPublishedRelease(payload.release)) {
      return { ...base, error: "A publicação disponível no Portal é inválida ou ainda não está pronta." };
    }
    const release = payload.release;
    return {
      ...base,
      hasUpdate: isNewer(release.version, base.currentVersion),
      latestVersion: release.version,
      releaseName: `ELVANOQ Play ${release.version}`,
      releaseNotes: release.notes.trim() || null,
      apkUrl: release.download_url,
      apkSize: release.size,
      apkSha256: release.sha256.toLowerCase(),
      publishedAt: release.published_at,
    };
  } catch (error) {
    logTechnicalError("PortalUpdater/check", error);
    const timedOut = error instanceof Error && error.name === "AbortError";
    return { ...base, error: timedOut ? "A verificação de atualizações demorou demais. Tente novamente." : "Não foi possível verificar atualizações. Verifique sua conexão." };
  } finally {
    clearTimeout(timeout);
  }
}

export async function cancelUpdateDownload(): Promise<void> {
  cancellationRequested = true;
  const download = activeDownload;
  const destination = activeDestination;
  activeDownload = null;
  activeDestination = null;
  try { await download?.pauseAsync(); } catch { /* The transport may have already completed. */ }
  if (destination) await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
}

/** Downloads the fixed Portal APK, validates exact size + SHA-256, then opens Android installer. */
export async function downloadAndInstallUpdate(
  apkUrl: string,
  expectedBytes: number,
  expectedSha256: string,
  onProgress?: (progress: UpdateDownloadProgress) => void,
): Promise<void> {
  if (Platform.OS !== "android") throw new Error("A instalação interna está disponível somente no Android.");
  if (apkUrl !== PORTAL_RELEASE_APK_URL) throw new Error("A atualização não possui uma URL oficial do Portal.");
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0) throw new Error("A atualização não possui tamanho válido.");
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) throw new Error("A atualização não possui SHA-256 válido.");
  if (activeDownload) throw new Error("Já existe uma atualização sendo baixada.");

  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) throw new Error("Não foi possível preparar o armazenamento da atualização.");
  const destination = `${cacheDirectory}elvanoq-update.apk`;
  cancellationRequested = false;
  activeDestination = destination;
  try {
    const previous = await FileSystem.getInfoAsync(destination);
    if (previous.exists) await FileSystem.deleteAsync(destination, { idempotent: true });

    const download = FileSystem.createDownloadResumable(
      apkUrl,
      destination,
      { headers: { Accept: APK_MIME_TYPE, "Cache-Control": "no-cache" } },
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        const total = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : null;
        onProgress?.({ writtenBytes: totalBytesWritten, totalBytes: total, fraction: total ? Math.min(1, totalBytesWritten / total) : null });
      },
    );
    activeDownload = download;
    const result = await download.downloadAsync();
    if (cancellationRequested) throw new Error("Download cancelado.");
    if (!result || result.status < 200 || result.status >= 300) throw new Error("O Portal não retornou um APK válido.");

    const downloaded = await FileSystem.getInfoAsync(destination);
    if (!downloaded.exists || downloaded.size !== expectedBytes) throw new Error("O tamanho da atualização não confere. O arquivo foi descartado.");
    await verifyUpdateSha256(destination, expectedSha256);

    const contentUri = await FileSystem.getContentUriAsync(destination);
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: contentUri,
      type: APK_MIME_TYPE,
      flags: GRANT_READ_URI_PERMISSION,
    });
  } catch (error) {
    await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
    logTechnicalError("PortalUpdater/download", error);
    if (error instanceof Error && error.message === "Download cancelado.") throw error;
    if (error instanceof Error && /integridade|tamanho|SHA-256|oficial/.test(error.message)) throw error;
    throw new Error("Não foi possível baixar a atualização. Verifique a conexão e permita instalações desta fonte nas configurações do Android.");
  } finally {
    activeDownload = null;
    activeDestination = null;
    cancellationRequested = false;
  }
}
