import Constants from "expo-constants";
import { Platform } from "react-native";
import type { DeviceIdentity } from "@/services/device/deviceIdentity";

const PORTAL_URL = "https://xrrgjssvdqvtrqhxpask.supabase.co/functions/v1/portal-control";
const PUBLIC_KEY = "sb_publishable_zTZ9IwqmgdIcQfvsy_Qz0w_ZwIOa1kl";
const REQUEST_TIMEOUT_MS = 8_000;

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

function snapshotFrom(payload: RecordValue, identity: DeviceIdentity, fallbackMessage: string | null = null): CodeAccessSnapshot {
  const license = asRecord(payload.license);
  const codeAccess = asRecord(payload.code_access);
  const canPlay = bool(license?.can_play) ?? false;
  const canConnect = bool(codeAccess?.can_connect) ?? false;
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

async function request(action: string, body: RecordValue): Promise<{ status: number; payload: RecordValue | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(PORTAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: PUBLIC_KEY },
      body: JSON.stringify({ action, ...body }),
      signal: controller.signal,
    });
    const raw: unknown = await response.json().catch(() => null);
    return { status: response.status, payload: asRecord(raw) };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new CodeDeviceAccessError("network", "A consulta de acesso demorou demais. Verifique sua conexão.");
    }
    throw new CodeDeviceAccessError("network", "Não foi possível consultar o acesso agora. Verifique sua conexão.");
  } finally {
    clearTimeout(timeout);
  }
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
  const response = await request("code-device-register", devicePayload(identity, code));
  if (response.status === 409) throw new CodeDeviceAccessError("identity-conflict", "Este MAC já está vinculado a outra chave. Solicite uma vinculação explícita ao responsável.");
  if (response.status === 404) throw new CodeDeviceAccessError("not-found", "Código de servidor não encontrado.");
  if (!response.payload) throw new CodeDeviceAccessError("invalid-response", "A resposta de acesso é inválida.");
  if (!response.status.toString().startsWith("2")) {
    return snapshotFrom(response.payload, identity, "Não foi possível registrar este dispositivo.");
  }
  return snapshotFrom(response.payload, identity);
}

/** Rechecks access bound to this exact MAC/key pair. HTTP 403 is parsed, not assumed. */
export async function resolveCodeDeviceAccess(identity: DeviceIdentity, code: string): Promise<CodeAccessSnapshot> {
  const response = await request("server-code-resolve", { code, mac: identity.macAddress, device_key: identity.deviceKey });
  if (response.status === 404) throw new CodeDeviceAccessError("not-found", "Código de servidor não encontrado.");
  if (response.status === 409) throw new CodeDeviceAccessError("identity-conflict", "Este MAC já está vinculado a outra chave. Solicite uma vinculação explícita ao responsável.");
  if (!response.payload) throw new CodeDeviceAccessError("invalid-response", "A resposta de acesso é inválida.");
  if (response.status === 403 || response.status === 200) return snapshotFrom(response.payload, identity);
  throw new CodeDeviceAccessError("network", "Não foi possível consultar o acesso agora.");
}

/** Server authorization is valid only when both license and code rules allow it. */
export async function revalidateCodeDevice(identity: DeviceIdentity, code: string): Promise<CodeAccessSnapshot> {
  const registered = await registerCodeDevice(identity, code);
  if (!registered.canPlay || !registered.canConnect) return registered;
  return resolveCodeDeviceAccess(identity, code);
}
