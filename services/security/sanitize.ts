const SENSITIVE_KEYS =
  /^(username|user|password|pass|passwd|pwd|token|auth|authorization|access[_-]?token|refresh[_-]?token|api[_-]?key|secret|pin|cookie|set-cookie|session|sessionid)$/i;

const SENSITIVE_ASSIGNMENT =
  /\b(username|user|password|pass|passwd|pwd|token|auth|authorization|access[_-]?token|refresh[_-]?token|api[_-]?key|secret|pin|cookie|set-cookie|session|sessionid)\b(\s*[=:]\s*)([^\s,;&}\]]+)/gi;

export function sanitizeUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SENSITIVE_KEYS.test(key)) parsed.searchParams.set(key, "***");
    }
    parsed.pathname = parsed.pathname.replace(
      /\/(live|movie|series)\/[^/]+\/[^/]+\//i,
      "/$1/***/***/",
    );
    return parsed.toString();
  } catch {
    return "[URL removida]";
  }
}

function describeUnknown(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    // Status do player e dados de diagnóstico chegam como objetos: sem isso o
    // registro mostrava só "[object Object]".
    try { return JSON.stringify(error); } catch { return String(error); }
  }
  return String(error);
}

export function sanitizeError(error: unknown): string {
  const message = describeUnknown(error);
  return message
    .replace(/https?:\/\/[^\s"']+/gi, (url) => sanitizeUrl(url))
    .replace(/\b(Authorization)\s*:\s*(?:Bearer|Basic)\s+[^\s,;]+/gi, "$1: ***")
    .replace(SENSITIVE_ASSIGNMENT, "$1$2***")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer ***")
    .replace(/\bBasic\s+[A-Za-z0-9+/=]+/gi, "Basic ***");
}

export type TechnicalLogEntry = { at: number; scope: string; message: string; count: number };
type TechnicalLogListener = (entry: TechnicalLogEntry) => void;
const technicalLogListeners = new Set<TechnicalLogListener>();

/** Registro técnico do aparelho (Diagnóstico → Desempenho): sempre sanitizado. */
export function onTechnicalLog(listener: TechnicalLogListener): () => void {
  technicalLogListeners.add(listener);
  return () => { technicalLogListeners.delete(listener); };
}

function emitTechnicalLog(scope: string, message: string): void {
  if (technicalLogListeners.size === 0) return;
  const entry: TechnicalLogEntry = { at: Date.now(), scope, message: message.slice(0, 160), count: 1 };
  technicalLogListeners.forEach((listener) => { try { listener(entry); } catch { /* opcional */ } });
}

export function logTechnicalError(scope: string, error: unknown): void {
  const message = sanitizeError(error);
  if (__DEV__) console.error(`[${scope}] ${message}`);
  emitTechnicalLog(scope, message);
}

/** Marco técnico (início/fim de etapa), para saber onde o app parou. */
export function logTechnicalEvent(scope: string, message: string): void {
  emitTechnicalLog(scope, sanitizeError(message));
}
