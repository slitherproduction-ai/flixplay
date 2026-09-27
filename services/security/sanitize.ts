const SENSITIVE_QUERY_KEYS = /^(username|user|password|pass|token|auth)$/i;

export function sanitizeUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SENSITIVE_QUERY_KEYS.test(key)) parsed.searchParams.set(key, "***");
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

export function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/https?:\/\/[^\s"']+/gi, (url) => sanitizeUrl(url))
    .replace(/(username|password|token)=([^&\s]+)/gi, "$1=***");
}

export function logTechnicalError(scope: string, error: unknown): void {
  if (__DEV__) console.error(`[${scope}] ${sanitizeError(error)}`);
}
