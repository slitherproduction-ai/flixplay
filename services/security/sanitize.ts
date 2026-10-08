const SENSITIVE_KEYS = /^(username|user|password|pass|passwd|pwd|token|auth|authorization|access[_-]?token|refresh[_-]?token|api[_-]?key|secret|pin|cookie|set-cookie|session|sessionid)$/i;
const SENSITIVE_ASSIGNMENT = /\b(username|user|password|pass|passwd|pwd|token|auth|authorization|access[_-]?token|refresh[_-]?token|api[_-]?key|secret|pin|cookie|set-cookie|session|sessionid)\b(\s*[=:]\s*)([^\s,;&}\]]+)/gi;

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
    return parsed.toString().replace(SENSITIVE_ASSIGNMENT, "$1$2***");
  } catch {
    return "[URL removida]";
  }
}

export function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/https?:\/\/[^\s"']+/gi, (url) => sanitizeUrl(url))
    .replace(/\b(Authorization)\s*:\s*(?:Bearer|Basic)\s+[^\s,;]+/gi, "$1: ***")
    .replace(SENSITIVE_ASSIGNMENT, "$1$2***")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer ***")
    .replace(/\bBasic\s+[A-Za-z0-9+/=]+/gi, "Basic ***");
}

export function logTechnicalError(scope: string, error: unknown): void {
  if (__DEV__) console.error(`[${scope}] ${sanitizeError(error)}`);
}
