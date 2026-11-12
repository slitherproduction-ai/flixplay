import { useEffect, useState } from "react";

import { getSeriesInfo, getVodInfo, pickBackdrop } from "@/services/xtream";
import type { ServerProfile } from "@/store/types";

/**
 * Imagem larga do destaque da Início.
 *
 * As listas do Xtream só trazem a capa vertical (`stream_icon` / `cover`).
 * Esticada para cobrir o destaque, ela aparece ampliada e borrada. Como no
 * Roku (VodInfoService), o destaque pede o get_vod_info / get_series_info só
 * do título que está na tela e usa o `backdrop_path`. O resultado fica em
 * memória (inclusive "sem imagem larga") para não repetir a chamada a cada
 * volta do carrossel. Nada disso vai para o banco do catálogo.
 */
const MAX_ENTRIES = 40;
const cache = new Map<string, string>();

function remember(key: string, url: string) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, url);
}

export function useHeroBackdrop(
  profile: ServerProfile | undefined,
  content: { id: string; type: "movie" | "series" } | null | undefined,
): string {
  const remoteId = content ? content.id.replace(/^(movie|series)-/, "") : "";
  const key = profile && content && remoteId ? `${profile.id}:${content.type}:${remoteId}` : "";
  const [url, setUrl] = useState(() => (key ? cache.get(key) ?? "" : ""));

  useEffect(() => {
    if (!key || !profile || !content) {
      setUrl("");
      return;
    }
    const cached = cache.get(key);
    if (cached !== undefined) {
      setUrl(cached);
      return;
    }
    setUrl("");
    if (profile.sourceType === "m3u") return;
    const controller = new AbortController();
    const request = content.type === "movie"
      ? getVodInfo(profile, remoteId, controller.signal)
      : getSeriesInfo(profile, remoteId, controller.signal);
    request
      .then((body) => {
        const found = pickBackdrop(body);
        remember(key, found);
        if (!controller.signal.aborted) setUrl(found);
      })
      .catch(() => {
        // Sem imagem larga o destaque usa a capa vertical, sem ampliar.
        if (!controller.signal.aborted) remember(key, "");
      });
    return () => controller.abort();
    // `content` muda de identidade a cada render; a chave já a representa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return url;
}
