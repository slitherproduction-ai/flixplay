import { XtreamApiError, type XtreamUserInfo } from "@/services/xtream";
import type { ServerProfile } from "@/store/types";
import { isValidServerCode, normalizeServerCode } from "@/services/device/serverCodeResolver";

export interface DiagInfo {
  testedUrl: string;
  alternateProtocol: "HTTPS" | "HTTP";
  alternateUrl: string;
}

export function checkXtreamAuth(userInfo: XtreamUserInfo | null): userInfo is XtreamUserInfo {
  if (!userInfo) return false;
  const value = userInfo.auth;
  return value === 1 || value === "1" || value === true || (value === undefined && !!userInfo.username);
}

export function buildDiagInfoFromError(error: unknown): DiagInfo | null {
  if (!(error instanceof XtreamApiError) || !error.testedUrl) return null;
  const testedUrl = error.testedUrl;
  const isHttp = testedUrl.startsWith("http://");
  return {
    testedUrl,
    alternateProtocol: isHttp ? "HTTPS" : "HTTP",
    alternateUrl: isHttp
      ? testedUrl.replace("http://", "https://")
      : testedUrl.replace("https://", "http://"),
  };
}

export function normalizeServerUrl(input: string): string {
  let url = input.trim();
  if (!url) return url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) url = `http://${url}`;
  try {
    return new URL(url).origin;
  } catch {
    return url.replace(/\/+$/, "");
  }
}

export function isValidServerUrl(normalised: string): boolean {
  try {
    return Boolean(normalised && new URL(normalised).hostname);
  } catch {
    return false;
  }
}

export function parseExpiryDisplay(expDate: string | null): string {
  if (!expDate) return "Ilimitado";
  const timestamp = Number(expDate);
  return Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp * 1000).toLocaleDateString("pt-BR")
    : "Ilimitado";
}

export function buildProfileUpdate(userInfo: XtreamUserInfo) {
  const formats = Array.isArray(userInfo.allowed_output_formats)
    ? userInfo.allowed_output_formats.map((value) => value.toLowerCase())
    : [];
  const format = formats.includes("m3u8") ? "HLS" : formats.includes("ts") ? "TS" : null;
  return {
    expiryDate: parseExpiryDisplay(userInfo.exp_date ?? null),
    maxConnections: userInfo.max_connections ? Number(userInfo.max_connections) : null,
    activeConnections: userInfo.active_cons ? Number(userInfo.active_cons) : null,
    format: format as ServerProfile["format"],
    status: userInfo.status ?? null,
  };
}

export function getErrorMessage(error: unknown): string {
  return error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "Erro desconhecido. Tente novamente.";
}

export function formatAddedAt(iso?: string): string {
  if (!iso) return "Data desconhecida";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Data inválida" : date.toLocaleDateString("pt-BR");
}

export function maskUsername(value: string): string {
  return value.length <= 2 ? "••" : `${value.slice(0, 1)}${"•".repeat(Math.min(6, value.length - 2))}${value.slice(-1)}`;
}

export function validateLoginFields(host: string, username: string, password: string): string | null {
  if (!isValidServerUrl(normalizeServerUrl(host))) {
    return "Informe o Host / URL do servidor. Exemplos: servidor.exemplo.com, http://192.168.1.1:8080";
  }
  if (!username.trim()) return "Informe o usuário.";
  return password ? null : "Informe a senha.";
}

export function validateCodeLoginFields(code: string, username: string, password: string): string | null {
  if (!isValidServerCode(normalizeServerCode(code))) return "Informe um código de servidor válido.";
  if (!username.trim()) return "Informe o usuário.";
  return password ? null : "Informe a senha.";
}

export function getUserStatusError(status?: string): string | null {
  const value = status?.toLowerCase().trim();
  if (value === "expired") return "Conta expirada. Entre em contato com seu provedor IPTV.";
  if (value === "disabled" || value === "banned" || value === "blocked") return "Conta desativada. Entre em contato com seu provedor IPTV.";
  return null;
}

export function mapConnectError(error: unknown): string {
  const message = getErrorMessage(error);
  return !message || message === "Erro desconhecido. Tente novamente."
    ? "Falha ao conectar. Verifique a URL, usuário e senha."
    : message;
}
