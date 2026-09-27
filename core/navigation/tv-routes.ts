import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

export type TvRoute = {
  key: "home" | "live" | "movies" | "series" | "settings";
  label: string;
  href: "/" | "/live" | "/movies" | "/series" | "/settings";
  icon: ComponentProps<typeof Ionicons>["name"];
};

export const TV_ROUTES: readonly TvRoute[] = [
  { key: "home", label: "Início", href: "/", icon: "home-outline" },
  { key: "live", label: "TV ao Vivo", href: "/live", icon: "radio-outline" },
  { key: "movies", label: "Filmes", href: "/movies", icon: "film-outline" },
  { key: "series", label: "Séries", href: "/series", icon: "albums-outline" },
  { key: "settings", label: "Ajustes", href: "/settings", icon: "settings-outline" },
] as const;

export function isTvRouteActive(pathname: string, href: TvRoute["href"]): boolean {
  if (href === "/") return pathname === "/" || pathname === "/index";
  return pathname === href || pathname.startsWith(`${href}/`);
}
