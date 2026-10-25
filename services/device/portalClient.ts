/**
 * Shared, public client for the Portal control Edge Function.
 *
 * The key below is publishable only. Privileged decisions, playlist
 * credentials and license mutations remain exclusively in the Edge Function.
 * Keeping this transport in one place prevents Android clients from drifting
 * when the Portal endpoint, timeout or HTTP handling changes.
 */
export const PORTAL_CONTROL_URL = "https://xrrgjssvdqvtrqhxpask.supabase.co/functions/v1/portal-control";
export const PORTAL_PUBLISHABLE_KEY = "sb_publishable_zTZ9IwqmgdIcQfvsy_Qz0w_ZwIOa1kl";
export const PORTAL_REQUEST_TIMEOUT_MS = 8_000;

export type PortalRecord = Record<string, unknown>;

export type PortalRequestResult<T extends object = PortalRecord> = {
  status: number;
  ok: boolean;
  payload: T | null;
  retryAfterSeconds: number | null;
};

export class PortalRequestError extends Error {
  constructor(
    public readonly reason: "timeout" | "network",
    message: string,
  ) {
    super(message);
    this.name = "PortalRequestError";
  }
}

function asRecord(value: unknown): PortalRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as PortalRecord
    : null;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) && seconds >= 0 && seconds <= 86_400 ? seconds : null;
}

/**
 * Makes one bounded request. Non-2xx responses are returned to the caller so
 * each authorization flow can apply its own explicit 403/404 policy. Network
 * and timeout failures are never converted into an access denial.
 */
export async function requestPortal<T extends object = PortalRecord>(
  action: string,
  body: PortalRecord = {},
): Promise<PortalRequestResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PORTAL_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(PORTAL_CONTROL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: PORTAL_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action, ...body }),
      signal: controller.signal,
    });
    const raw: unknown = await response.json().catch(() => null);
    return {
      status: response.status,
      ok: response.ok,
      payload: asRecord(raw) as T | null,
      retryAfterSeconds: parseRetryAfter(response.headers?.get?.("retry-after") ?? null),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new PortalRequestError("timeout", "A consulta ao Portal demorou demais. Verifique sua conexão e tente novamente.");
    }
    throw new PortalRequestError("network", "Não foi possível consultar o Portal agora. Verifique sua conexão e tente novamente.");
  } finally {
    clearTimeout(timeout);
  }
}

export function portalServiceMessage(status: number, retryAfterSeconds: number | null, fallback: string): string {
  if (status === 429) {
    return retryAfterSeconds && retryAfterSeconds > 0
      ? `Muitas tentativas. Tente novamente em cerca de ${Math.ceil(retryAfterSeconds / 60)} min.`
      : "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }
  if (status === 502 || status === 503 || status === 504) {
    return "Portal temporariamente indisponível. Tente novamente em instantes.";
  }
  return fallback;
}
