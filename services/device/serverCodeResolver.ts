import type { DeviceIdentity } from "@/services/device/deviceIdentity";
import { PortalRequestError, portalServiceMessage, requestPortal, type PortalRecord } from "./portalClient";

export type ServerCodeResolveFailure = "invalid-code" | "not-found" | "identity-conflict" | "timeout" | "unavailable" | "invalid-response";

export class ServerCodeResolveError extends Error {
  constructor(public readonly reason: ServerCodeResolveFailure, message: string) {
    super(message);
    this.name = "ServerCodeResolveError";
  }
}

export interface ResolvedServerCode {
  code: string;
  host: string;
  updatedAt: string | null;
}

export function normalizeServerCode(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidServerCode(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{2,31}$/.test(value);
}

function normalizeResolvedHost(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value.trim());
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname || parsed.username || parsed.password) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/** Resolves only a Portal server code; IPTV credentials never enter this request. */
export async function resolveServerCode(input: string, identity?: DeviceIdentity): Promise<ResolvedServerCode> {
  const code = normalizeServerCode(input);
  if (!isValidServerCode(code)) throw new ServerCodeResolveError("invalid-code", "Informe um código de servidor válido.");

  try {
    const response = await requestPortal<PortalRecord>("server-code-resolve", {
      code,
      ...(identity ? { mac: identity.macAddress, device_key: identity.deviceKey } : {}),
    });
    const payload = response.payload;
    if (response.status === 400) throw new ServerCodeResolveError("invalid-code", "O código informado não é válido.");
    if (response.status === 404) throw new ServerCodeResolveError("not-found", "Código não encontrado ou desativado. Verifique com seu administrador.");
    if (response.status === 403) throw new ServerCodeResolveError("identity-conflict", "Este dispositivo não está autorizado para consultar este código.");
    if (!response.ok) {
      throw new ServerCodeResolveError(
        "unavailable",
        portalServiceMessage(response.status, response.retryAfterSeconds, "Não foi possível consultar o servidor agora. Tente novamente."),
      );
    }

    const server = payload?.server;
    if (!server || typeof server !== "object") throw new ServerCodeResolveError("invalid-response", "A resposta do servidor é inválida. Tente novamente.");
    const record = server as Record<string, unknown>;
    const resolvedCode = normalizeServerCode(typeof record.code === "string" ? record.code : "");
    const host = normalizeResolvedHost(record.host);
    if (resolvedCode !== code || !host) throw new ServerCodeResolveError("invalid-response", "A resposta do servidor é inválida. Tente novamente.");
    return { code: resolvedCode, host, updatedAt: typeof record.updated_at === "string" ? record.updated_at : null };
  } catch (error) {
    if (error instanceof ServerCodeResolveError) throw error;
    if (error instanceof PortalRequestError) {
      throw new ServerCodeResolveError(error.reason === "timeout" ? "timeout" : "unavailable", error.message);
    }
    throw new ServerCodeResolveError("unavailable", "Não foi possível consultar o servidor agora. Verifique sua conexão e tente novamente.");
  }
}
