import Constants from "expo-constants";
import { Platform } from "react-native";
import type { DeviceIdentity } from "@/services/device/deviceIdentity";
import { PortalRequestError, portalServiceMessage, requestPortal } from "./portalClient";

export type AccessState = "idle" | "checking" | "granted" | "blocked" | "unavailable";

export interface CodeAccessSnapshot {
  state: AccessState;
  canPlay: boolean;
  canConnect: boolean;
  paymentRequired: boolean;
  reason: string | null;
  message: string | null;
  accessUntil: string | null;
  licenseUntil: string | null;
  licenseStatus: string | null;
  individualAccess: boolean | null;
  macAddress: string;
  checkedAt: string;
}

export class CodeDeviceAccessError extends Error {
  constructor(public readonly reason: "identity-conflict" | "not-found" | "network" | "invalid-response", message: string) {
    super(message);
    this.name = "CodeDeviceAccessError";
  }
}

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeReason(reason: string | null, fallback: string | null): string | null {
  if (reason === "device_suspended") return "Este dispositivo está suspenso. Procure o responsável.";
  if (reason === "device_removed") return "Este dispositivo foi removido. Procure o responsável.";
  if (reason === "code_expired") return "O código de acesso expirou para este dispositivo.";
  if (reason === "code_revoked" || reason === "code_inactive") return "O código de acesso foi bloqueado ou revogado.";
  if (reason === "license_required") return "Este dispositivo precisa de uma licença ativa.";
  return fallback;
}

function snapshotFrom(
  payload: RecordValue,
  identity: DeviceIdentity,
  fallbackMessage: string | null = null,
  requiresCodeAccess = true,
): CodeAccessSnapshot {
  const license = asRecord(payload.license);
  const codeAccess = asRecord(payload.code_access);
  const canPlay = bool(license?.can_play) ?? false;
  // A Portal-managed M3U/Xtream list without a server code uses its individual license.
  const canConnect = bool(codeAccess?.can_connect) ?? !requiresCodeAccess;
  const paymentRequired = bool(license?.payment_required) ?? bool(codeAccess?.payment_required) ?? false;
  const reason = text(codeAccess?.reason) ?? text(license?.reason);
  const allowed = canPlay && canConnect;
  return {
    state: allowed ? "granted" : "blocked",
    canPlay,
    canConnect,
    paymentRequired,
    reason,
    message: normalizeReason(reason, text(payload.message) ?? fallbackMessage),
    accessUntil: text(codeAccess?.access_until),
    licenseUntil: text(license?.expires_at) ?? text(license?.access_until) ?? text(codeAccess?.access_until),
    licenseStatus: text(license?.status),
    individualAccess: bool(codeAccess?.individual_access),
    macAddress: identity.macAddress,
    checkedAt: new Date().toISOString(),
  };
}

function devicePayload(identity: DeviceIdentity, code: string) {
  return {
    mac: identity.macAddress,
    device_key: identity.deviceKey,
    code,
    name: Constants.deviceName ?? undefined,
    platform: Platform.OS,
    app_version: Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? undefined,
  };
}

/** Registers this installation without ever sending IPTV credentials. */
export async function registerCodeDevice(identity: DeviceIdentity, code: string): Promise<CodeAccessSnapshot> {
  let response;
  try {
    response = await requestPortal<RecordValue>("code-device-register", devicePayload(identity, code));
  } catch (error) {
    if (error instanceof PortalRequestError) throw new CodeDeviceAccessError("network", error.message);
    throw error;
  }
  if (response.status === 409) throw new CodeDeviceAccessError("identity-conflict", "Este MAC já está vinculado a outra chave. Solicite uma vinculação explícita ao responsável.");
  if (response.status === 404) throw new CodeDeviceAccessError("not-found", "Código de servidor não encontrado.");
  if (!response.payload) throw new CodeDeviceAccessError("invalid-response", "A resposta de acesso é inválida.");
  if (!response.ok) {
    return snapshotFrom(response.payload, identity, portalServiceMessage(response.status, response.retryAfterSeconds, "Não foi possível registrar este dispositivo."));
  }
  return snapshotFrom(response.payload, identity);
}

/** Rechecks access bound to this exact MAC/key pair. HTTP 403 is parsed, not assumed. */
export async function resolveCodeDeviceAccess(identity: DeviceIdentity, code: string): Promise<CodeAccessSnapshot> {
  let response;
  try {
    response = await requestPortal<RecordValue>("server-code-resolve", { code, mac: identity.macAddress, device_key: identity.deviceKey });
  } catch (error) {
    if (error instanceof PortalRequestError) throw new CodeDeviceAccessError("network", error.message);
    throw error;
  }
  if (response.status === 404) throw new CodeDeviceAccessError("not-found", "Código de servidor não encontrado.");
  if (response.status === 409) throw new CodeDeviceAccessError("identity-conflict", "Este MAC já está vinculado a outra chave. Solicite uma vinculação explícita ao responsável.");
  if (!response.payload) throw new CodeDeviceAccessError("invalid-response", "A resposta de acesso é inválida.");
  if (response.status === 403 || response.status === 200) return snapshotFrom(response.payload, identity);
  throw new CodeDeviceAccessError("network", portalServiceMessage(response.status, response.retryAfterSeconds, "Não foi possível consultar o acesso agora."));
}

/** Server authorization is valid only when both license and code rules allow it. */
export async function revalidateCodeDevice(identity: DeviceIdentity, code: string): Promise<CodeAccessSnapshot> {
  const registered = await registerCodeDevice(identity, code);
  if (!registered.canPlay || !registered.canConnect) return registered;
  return resolveCodeDeviceAccess(identity, code);
}

/** Revalidates a Portal-managed M3U/Xtream list without re-registering its code. */
export async function revalidatePortalManagedDevice(identity: DeviceIdentity): Promise<CodeAccessSnapshot> {
  let response;
  try {
    response = await requestPortal<RecordValue>("license-status", { mac: identity.macAddress, device_key: identity.deviceKey });
  } catch (error) {
    if (error instanceof PortalRequestError) throw new CodeDeviceAccessError("network", error.message);
    throw error;
  }
  if (response.status === 409) throw new CodeDeviceAccessError("identity-conflict", "Este MAC já está vinculado a outra chave. Solicite uma vinculação explícita ao responsável.");
  if (response.status === 404) throw new CodeDeviceAccessError("not-found", "Este dispositivo não foi encontrado no Portal.");
  if (!response.payload) throw new CodeDeviceAccessError("invalid-response", "A resposta de licença é inválida.");
  if (response.status === 200 || response.status === 403) return snapshotFrom(response.payload, identity, null, false);
  // Rate limiting and service failures are network failures, never an inferred expiry.
  throw new CodeDeviceAccessError("network", portalServiceMessage(response.status, response.retryAfterSeconds, "Não foi possível consultar a licença agora."));
}
