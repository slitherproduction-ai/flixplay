/**
 * Idioma do aplicativo (Português / English / Automático).
 *
 * Os textos continuam escritos em português no código; o inglês vem do
 * dicionário `en.ts`, cuja chave é o próprio texto em português. Com o app em
 * português nada é traduzido (custo zero). Em inglês, `tr()` procura o texto
 * exato e, se não achar, os modelos com partes variáveis ("Versão {0}").
 * Sem tradução, o texto em português aparece como está.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager, NativeModules, Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { EN } from "./en";

export type LanguagePreference = "auto" | "pt" | "en";
export type AppLanguage = "pt" | "en";

function deviceLanguage(): AppLanguage {
  let locale = "";
  try {
    const constants = (I18nManager as unknown as { getConstants?: () => { localeIdentifier?: string } }).getConstants?.();
    locale = constants?.localeIdentifier ?? "";
  } catch {
    locale = "";
  }
  if (!locale && Platform.OS === "android") locale = NativeModules.I18nManager?.localeIdentifier ?? "";
  if (!locale) {
    try {
      locale = Intl.DateTimeFormat().resolvedOptions().locale ?? "";
    } catch {
      locale = "";
    }
  }
  return /^pt/i.test(locale) ? "pt" : locale ? "en" : "pt";
}

interface LanguageState {
  preference: LanguagePreference;
  language: AppLanguage;
  setPreference: (preference: LanguagePreference) => void;
}

function resolve(preference: LanguagePreference): AppLanguage {
  return preference === "auto" ? deviceLanguage() : preference;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      preference: "auto",
      language: resolve("auto"),
      setPreference: (preference) => {
        current = resolve(preference);
        set({ preference, language: current });
      },
    }),
    {
      name: "elvanoq-language",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ preference: state.preference }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        current = resolve(state.preference);
        useLanguageStore.setState({ language: current });
      },
    },
  ),
);

let current: AppLanguage = useLanguageStore.getState().language;

/** Idioma em uso agora (fora de componentes). */
export function appLanguage(): AppLanguage {
  return current;
}

/** Locale para datas e números. */
export function appLocale(): string {
  return current === "en" ? "en-US" : "pt-BR";
}

/** Idioma em uso, com nova renderização quando muda. */
export function useAppLanguage(): AppLanguage {
  return useLanguageStore((state) => state.language);
}

// Modelos com partes variáveis: "Versão {0}" → /^Versão (.+?)$/.
interface Pattern { regex: RegExp; en: string }
const exact = new Map<string, string>();
const buckets = new Map<string, Pattern[]>();
const tailBuckets = new Map<string, Pattern[]>();

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

for (const [rawPt, en] of Object.entries(EN)) {
  const pt = normalize(rawPt);
  if (!/\{\d+\}/.test(pt)) {
    exact.set(pt, en);
    continue;
  }
  const source = "^" + pt.split(/(\{\d+\})/).map((part) => (/^\{\d+\}$/.test(part) ? "([\\s\\S]*?)" : escape(part))).join("") + "$";
  const pattern = { regex: new RegExp(source), en };
  const head = pt.split(/\{\d+\}/)[0].trim().split(" ")[0];
  if (head) {
    const list = buckets.get(head) ?? [];
    list.push(pattern);
    buckets.set(head, list);
  } else {
    const tail = pt.split(/\{\d+\}/).filter(Boolean).pop()?.trim().split(" ")[0] ?? "";
    const list = tailBuckets.get(tail) ?? [];
    list.push(pattern);
    tailBuckets.set(tail, list);
  }
}

// Modelos mais específicos (mais texto fixo) primeiro: "Temporada {0} • {1}
// episódio{2}" antes de "Temporada {0}".
const literalLength = (pattern: Pattern) => pattern.regex.source.replace(/\(\[\\s\\S\]\*\?\)/g, "").length;
for (const list of [...buckets.values(), ...tailBuckets.values()]) list.sort((a, b) => literalLength(b) - literalLength(a));

function fill(template: string, groups: string[]) {
  return template.replace(/\{(\d+)\}/g, (_, index) => translateText(groups[Number(index)] ?? ""));
}

function translateText(text: string): string {
  const trimmed = normalize(text);
  if (!trimmed) return text;
  const lead = /^\s*/.exec(text)?.[0] ?? "";
  const trail = /\s*$/.exec(text)?.[0] ?? "";
  const wrap = (value: string) => lead + value + trail;
  const hit = exact.get(trimmed);
  if (hit !== undefined) return wrap(hit);
  const first = trimmed.split(" ")[0];
  for (const pattern of buckets.get(first) ?? []) {
    const match = pattern.regex.exec(trimmed);
    if (match) return wrap(fill(pattern.en, match.slice(1)));
  }
  for (const [tail, list] of tailBuckets) {
    if (tail && !trimmed.includes(tail)) continue;
    for (const pattern of list) {
      const match = pattern.regex.exec(trimmed);
      if (match) return wrap(fill(pattern.en, match.slice(1)));
    }
  }
  return text;
}

/** Traduz um texto escrito em português para o idioma em uso. */
export function tr(text: string): string;
export function tr(text: string | null | undefined): string | null | undefined;
export function tr(text: string | null | undefined) {
  if (current === "pt" || !text) return text;
  return translateText(text);
}

/** Traduz os filhos de um texto (strings soltas ou em lista). */
export function trChildren<T>(children: T): T {
  if (current === "pt") return children;
  if (typeof children === "string") return tr(children) as unknown as T;
  if (Array.isArray(children)) return children.map((child) => (typeof child === "string" ? tr(child) : child)) as unknown as T;
  return children;
}
