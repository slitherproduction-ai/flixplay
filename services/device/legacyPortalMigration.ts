import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { ServerProfile } from "@/store/types";
import { getDeviceIdentity } from "@/services/device/deviceIdentity";
import { portalServiceMessage, requestPortal } from "./portalClient";

const STORAGE_KEY = "elvanoq.legacy-portal-migration.v1";

type MigrationStatus = "completed" | "pending" | "conflict" | "unavailable";
type StoredMigration = {
  version: 1;
  status: MigrationStatus;
  attempts: number;
  nextAttemptAt: number;
  completedAt?: string;
};

export type LegacyPortalMigrationResult = {
  status: MigrationStatus | "skipped";
  message: string | null;
  codeAccessEnforced: boolean | null;
};

type PortalMigrationResponse = {
  registered?: boolean;
  matching_identity?: boolean;
  active?: boolean;
  migration_state?: "verified" | "pending_review" | "removed";
  message?: string;
};

let inFlight: Promise<LegacyPortalMigrationResult> | null = null;

function nextDelayMs(attempts: number, status: MigrationStatus): number {
  if (status === "conflict") return 24 * 60 * 60_000;
  const delays = [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000];
  return delays[Math.min(Math.max(0, attempts - 1), delays.length - 1)];
}

async function readStoredMigration(): Promise<StoredMigration | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredMigration>;
    if (parsed.version !== 1 || typeof parsed.attempts !== "number" || typeof parsed.nextAttemptAt !== "number") return null;
    if (!["completed", "pending", "conflict", "unavailable"].includes(String(parsed.status))) return null;
    return parsed as StoredMigration;
  } catch {
    return null;
  }
}

async function writeStoredMigration(next: StoredMigration): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function hasLegacyData(servers: ServerProfile[]) {
  return servers.some((server) => Boolean(server.serverUrl || server.m3uUrl || server.serverCode));
}

function outcomeFor(response: PortalMigrationResponse): LegacyPortalMigrationResult {
  if (response.registered && response.matching_identity && response.active && response.migration_state === "verified") {
    return { status: "completed", message: null, codeAccessEnforced: true };
  }
  return {
    status: "pending",
    message: response.migration_state === "removed"
      ? "Este dispositivo foi removido no Portal. Procure o responsável."
      : "Migração cadastrada como pendente no Portal. Solicite a regularização ao responsável.",
    codeAccessEnforced: false,
  };
}

/**
 * Enrolls an installation identity without uploading local playlists,
 * credential fields, history, favorites, or content URLs. Completion is
 * recorded only after the Portal confirms the exact MAC/key pairing.
 */
async function execute(servers: ServerProfile[]): Promise<LegacyPortalMigrationResult> {
  if (!hasLegacyData(servers)) return { status: "skipped", message: null, codeAccessEnforced: null };

  const previous = await readStoredMigration();
  if (previous?.status === "completed") return { status: "completed", message: null, codeAccessEnforced: true };
  if (previous && previous.nextAttemptAt > Date.now()) {
    return { status: previous.status, message: null, codeAccessEnforced: previous.status === "completed" ? true : false };
  }

  const identity = await getDeviceIdentity();
  try {
    const response = await requestPortal<PortalMigrationResponse>("legacy-device-migrate", {
      mac: identity.macAddress,
      device_key: identity.deviceKey,
      name: Constants.deviceName ?? undefined,
      platform: Platform.OS,
      app_version: Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? undefined,
    });
    const payload = response.payload ?? {};
    const attempts = (previous?.attempts ?? 0) + 1;

    if (response.status === 409) {
      const record: StoredMigration = { version: 1, status: "conflict", attempts, nextAttemptAt: Date.now() + nextDelayMs(attempts, "conflict") };
      await writeStoredMigration(record);
      return { status: "conflict", message: "A identidade deste dispositivo já está vinculada a outra chave. Solicite a redefinição ao responsável.", codeAccessEnforced: false };
    }
    if (!response.ok) {
      const record: StoredMigration = { version: 1, status: "unavailable", attempts, nextAttemptAt: Date.now() + nextDelayMs(attempts, "unavailable") };
      await writeStoredMigration(record);
      return { status: "unavailable", message: portalServiceMessage(response.status, response.retryAfterSeconds, payload.message ?? "Não foi possível concluir a migração agora."), codeAccessEnforced: false };
    }

    const result = outcomeFor(payload);
    const record: StoredMigration = {
      version: 1,
      status: result.status === "completed" ? "completed" : "pending",
      attempts,
      nextAttemptAt: result.status === "completed" ? Number.MAX_SAFE_INTEGER : Date.now() + nextDelayMs(attempts, "pending"),
      ...(result.status === "completed" ? { completedAt: new Date().toISOString() } : {}),
    };
    await writeStoredMigration(record);
    return result;
  } catch {
    const attempts = (previous?.attempts ?? 0) + 1;
    await writeStoredMigration({ version: 1, status: "unavailable", attempts, nextAttemptAt: Date.now() + nextDelayMs(attempts, "unavailable") });
    return { status: "unavailable", message: "Portal indisponível. Suas listas locais continuam disponíveis.", codeAccessEnforced: false };
  }
}

/** Singleton entry point: safe on app resume and never overlaps network calls. */
export function migrateLegacyPortalInstallation(servers: ServerProfile[]): Promise<LegacyPortalMigrationResult> {
  if (!inFlight) {
    inFlight = execute(servers)
      .catch(() => ({ status: "unavailable" as const, message: "Não foi possível iniciar a migração agora.", codeAccessEnforced: false }))
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}
