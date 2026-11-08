import type { ContentType } from "@/store/types";

export type StreamPreference = "auto" | "hls" | "ts";

type UrlParts = {
  path: string;
  suffix: string;
};

function splitUrlSuffix(value: string): UrlParts {
  const queryIndex = value.indexOf("?");
  const hashIndex = value.indexOf("#");
  const indexes = [queryIndex, hashIndex].filter((index) => index >= 0);
  const suffixIndex = indexes.length > 0 ? Math.min(...indexes) : value.length;
  return {
    path: value.slice(0, suffixIndex),
    suffix: value.slice(suffixIndex),
  };
}

function replaceLiveExtension(url: string, extension: "m3u8" | "ts"): string {
  const { path, suffix } = splitUrlSuffix(url);
  const base = path.replace(/\.(?:m3u8|ts)$/i, "");
  return `${base}.${extension}${suffix}`;
}

function encodeSegment(value: string): string {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* já era texto puro */ }
  return encodeURIComponent(decoded);
}

/**
 * Xtream: usuário e senha vão no caminho do vídeo. Alguns painéis só aceitam o
 * texto puro (padrão do Android), outros só o codificado (padrão da Roku e da
 * LG). Quando a senha tem @, +, #, espaço etc., a versão codificada entra como
 * última tentativa.
 */
export function withEncodedCredentialVariant(urls: string[]): string[] {
  const variants: string[] = [];
  for (const url of urls) {
    const { path, suffix } = splitUrlSuffix(url);
    const match = /^(.*\/(?:live|movie|series|timeshift)\/)([^/]+)\/([^/]+)(\/.+)$/i.exec(path);
    if (!match) continue;
    const encoded = `${match[1]}${encodeSegment(match[2])}/${encodeSegment(match[3])}${match[4]}${suffix}`;
    if (encoded !== url) variants.push(encoded);
  }
  return [...new Set([...urls, ...variants])];
}

export function buildFallbackUrls(
  url: string,
  contentType: ContentType,
  preference: StreamPreference = "auto",
): string[] {
  const cleanUrl = url.trim();
  if (!cleanUrl) return [];
  if (contentType !== "live") return withEncodedCredentialVariant([cleanUrl]);

  const { path } = splitUrlSuffix(cleanUrl);
  const hls = replaceLiveExtension(cleanUrl, "m3u8");
  const ts = replaceLiveExtension(cleanUrl, "ts");
  const ordered = preference === "hls"
    ? [hls, ts, cleanUrl]
    : preference === "ts"
      ? [ts, hls, cleanUrl]
      : /\.m3u8$/i.test(path)
        ? [cleanUrl, ts]
        : /\.ts$/i.test(path)
          ? [cleanUrl, hls]
          : [hls, ts, cleanUrl];

  return withEncodedCredentialVariant([...new Set(ordered)]);
}

