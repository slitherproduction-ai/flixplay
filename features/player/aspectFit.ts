/**
 * Formato "Automático" do player (padrão): enche a tela quando o formato do
 * vídeo é parecido com o da tela — até ~15% de diferença (1,85:1 e 2:1 numa TV
 * 16:9) o corte nas bordas é pequeno e as faixas somem. Formatos bem
 * diferentes (cinema 2,39:1, 4:3) ficam inteiros com faixas pretas, para não
 * cortar parte importante da imagem. "Zoom / Cobrir" no menu enche sempre.
 */
export const AUTO_COVER_TOLERANCE = 0.15;

export function autoContentFit(videoAspect: number | null, screenAspect: number): "contain" | "cover" {
  if (!videoAspect || !Number.isFinite(videoAspect) || videoAspect <= 0 || !(screenAspect > 0)) return "contain";
  return Math.abs(videoAspect / screenAspect - 1) <= AUTO_COVER_TOLERANCE ? "cover" : "contain";
}
