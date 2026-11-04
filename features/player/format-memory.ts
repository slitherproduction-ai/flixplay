import type { StreamPreference } from "@/features/player/StreamResolver";

/**
 * Lembra, por lista (servidor), qual formato ao vivo abriu de fato (HLS ou TS).
 * Com a preferência em "Auto", o próximo canal já começa pelo formato que
 * funcionou, sem esperar o erro do formato errado. Fica na preferência
 * `liveFormat:<serverId>`.
 */
export function formatMemoryKey(serverId: string | null | undefined): string | null {
  return serverId ? `liveFormat:${serverId}` : null;
}

export function detectLiveFormat(url: string | undefined): "hls" | "ts" | null {
  if (!url) return null;
  const path = url.split(/[?#]/)[0] ?? "";
  if (/\.m3u8$/i.test(path)) return "hls";
  if (/\.ts$/i.test(path)) return "ts";
  return null;
}

/** Preferência efetiva: a escolha do usuário vence; em "Auto", usa o formato lembrado. */
export function effectiveStreamPreference(preference: StreamPreference, remembered: unknown): StreamPreference {
  if (preference !== "auto") return preference;
  return remembered === "hls" || remembered === "ts" ? remembered : "auto";
}
