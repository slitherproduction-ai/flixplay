import { create } from "zustand";

/**
 * Título em foco nas fileiras da Início (TV).
 *
 * Como no Roku, o destaque passa a mostrar o pôster em que o usuário parou.
 * Fica fora do store principal: só o carrossel do destaque assina, então a
 * troca não redesenha as fileiras. A troca espera o usuário parar sobre o
 * pôster (HERO_FOCUS_DELAY_MS): rolar rápido não dispara busca de imagem.
 */
export const HERO_FOCUS_DELAY_MS = 300;

export type HeroFocusItem = {
  id: string;
  type: "movie" | "series";
};

type HeroFocusState<T extends HeroFocusItem> = {
  item: T | null;
  setItem: (item: T | null) => void;
};

export function createHeroFocusStore<T extends HeroFocusItem>() {
  return create<HeroFocusState<T>>((set, get) => ({
    item: null,
    setItem: (item) => {
      const current = get().item;
      if (current === item || (current && item && current.id === item.id && current.type === item.type)) return;
      set({ item });
    },
  }));
}
