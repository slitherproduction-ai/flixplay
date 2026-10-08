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

export function buildFallbackUrls(
  url: string,
  contentType: ContentType,
  preference: StreamPreference = "auto",
): string[] {
  const cleanUrl = url.trim();
  if (!cleanUrl) return [];
  if (contentType !== "live") return [cleanUrl];

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

  return [...new Set(ordered)];
}
