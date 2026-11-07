import { usePathname } from "expo-router";
import type { ComponentType } from "react";
import { View } from "react-native";
import { Colors } from "@/constants/theme";
import { isTvRouteActive, TV_ROUTES, type TvRoute } from "@/core/navigation/tv-routes";
import { useTVMode } from "@/hooks/use-tv-mode";

/**
 * Na TV, Ao vivo, Filmes e Séries são descarregados quando outra seção
 * principal (Início, Ajustes ou outra aba) fica ativa: as grades, imagens e
 * prévias deixam de ocupar memória em aparelhos de 1 GB. Telas abertas por
 * cima (player, detalhes, busca) não descarregam a seção, para o Voltar
 * encontrar tudo como estava. O catálogo continua na memória do app, então a
 * seção volta a montar sem baixar nada.
 */
export function useTvTabEvicted(href: TvRoute["href"]): boolean {
  const tvMode = useTVMode();
  const pathname = usePathname();
  if (!tvMode) return false;
  const onTabRoute = TV_ROUTES.some((route) => isTvRouteActive(pathname, route.href));
  return onTabRoute && !isTvRouteActive(pathname, href);
}

export function withTvTabEviction<P extends object>(Screen: ComponentType<P>, href: TvRoute["href"]) {
  function EvictableScreen(props: P) {
    const evicted = useTvTabEvicted(href);
    if (evicted) return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
    return <Screen {...props} />;
  }
  EvictableScreen.displayName = `TvTabEviction(${Screen.displayName ?? Screen.name ?? "Screen"})`;
  return EvictableScreen;
}
