import { deviceTier, type DeviceTier } from "@/services/deviceProfile";

/**
 * Tamanho de imagem pedido ao TMDB conforme o uso e o aparelho.
 *
 * Os provedores costumam mandar capas do TMDB em "original" ou w600–w1280.
 * Numa grade de TV o pôster ocupa ~150–200 px: baixar e decodificar 1280 px
 * gasta rede e, principalmente, memória — no Fire TV Stick (900 MB) a soma
 * das capas era parte do que levava o sistema a fechar o app. Endereços que
 * não são do TMDB passam sem mudança.
 */
export type ImageRole = "poster" | "backdrop" | "still";

const SIZES: Record<ImageRole, Record<DeviceTier, string>> = {
  poster: { low: "w185", standard: "w342", high: "w500" },
  backdrop: { low: "w780", standard: "w1280", high: "w1280" },
  still: { low: "w185", standard: "w300", high: "w300" },
};

const TMDB_SIZE = /(image\.tmdb\.org\/t\/p\/)(original|w\d+(?:_and_h\d+_[a-z0-9_]+)?)(\/)/i;

export function sizedImage(url: string | null | undefined, role: ImageRole, tier: DeviceTier = deviceTier): string {
  if (!url) return "";
  return url.replace(TMDB_SIZE, `$1${SIZES[role][tier]}$3`);
}
