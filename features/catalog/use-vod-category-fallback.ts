import { useCallback, useRef, useState } from "react";
import { catalogDatabase } from "@/data/database/catalogDatabase";
import { useAppStore } from "@/store/useAppStore";
import { getVodStreams, mapVodStreamToMovie, type XtreamCategory } from "@/services/xtream";
import { logTechnicalError } from "@/services/security/sanitize";

export type VodCategory = { id: string; name: string };

/**
 * Alguns painéis Xtream devolvem o catálogo VOD global sem `category_id` em
 * parte dos itens, embora `get_vod_streams&category_id=…` funcione. Quando o
 * usuário abre uma categoria que chegou vazia, buscamos somente aquele grupo.
 * A resposta é incorporada ao cache atual — nunca troca a lista inteira.
 */
export function useVodCategoryFallback() {
  const activeServerId = useAppStore((state) => state.activeServerId);
  const activeProfile = useAppStore((state) => state.servers.find((server) => server.id === state.activeServerId));
  const setContentCache = useAppStore((state) => state.setContentCache);
  const [loadingCategoryId, setLoadingCategoryId] = useState<string | null>(null);
  const attempted = useRef(new Set<string>());

  const loadCategory = useCallback(async (category: VodCategory) => {
    const profile = activeProfile;
    if (!profile || !activeServerId || profile.sourceType === "m3u" || !category.id) return;

    const current = useAppStore.getState().contentCache.vodMovies;
    if (current.some((movie) => movie.categoryId === category.id)) return;

    const requestKey = `${profile.id}:${category.id}`;
    if (attempted.current.has(requestKey)) return;
    attempted.current.add(requestKey);
    setLoadingCategoryId(category.id);

    try {
      if (useAppStore.getState().contentCache.vodRevision) {
        const existing = await catalogDatabase.tvPage(profile.id, "vodMovies", { categoryId: category.id, category: category.name }, 0, 1);
        if (existing.length || useAppStore.getState().activeServerId !== profile.id) return;
      }
      const streams = await getVodStreams(profile, category.id);
      // A lista ativa pode mudar enquanto a categoria é buscada.
      if (useAppStore.getState().activeServerId !== profile.id) return;

      const xtreamCategory: XtreamCategory = {
        category_id: category.id,
        category_name: category.name,
        parent_id: 0,
      };
      // A chamada foi limitada pelo próprio category_id. Forçamos essa
      // associação porque os painéis afetados omitem ou erram o campo no JSON.
      const fetched = streams.map((stream) => ({
        ...mapVodStreamToMovie(stream, xtreamCategory, profile),
        categoryId: category.id,
        genre: category.name,
      }));
      if (fetched.length === 0) return;

      if (useAppStore.getState().contentCache.vodRevision) {
        await catalogDatabase.upsert(profile.id, "vodMovies", fetched);
        if (useAppStore.getState().activeServerId === profile.id) setContentCache({ vodRevision: Date.now() });
        return;
      }
      const byId = new Map(useAppStore.getState().contentCache.vodMovies.map((movie) => [movie.id, movie]));
      for (const movie of fetched) byId.set(movie.id, movie);
      setContentCache({ vodMovies: Array.from(byId.values()) });
      // A versão nativa sem `upsert` continua funcional nesta sessão; nas
      // versões que o oferecem, a recuperação também sobrevive à reabertura.
      await catalogDatabase.upsert(profile.id, "vodMovies", fetched);
    } catch (error) {
      // Não expõe URL, usuário ou senha do provedor nos diagnósticos.
      logTechnicalError("Catalog/vod-category", error);
      // Falhas transitórias podem ser tentadas de novo ao voltar à categoria.
      attempted.current.delete(requestKey);
    } finally {
      if (useAppStore.getState().activeServerId === profile.id) setLoadingCategoryId((currentId) => currentId === category.id ? null : currentId);
    }
  }, [activeProfile, activeServerId, setContentCache]);

  return { loadingCategoryId, loadCategory };
}
