import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoPlayer } from "expo-video";
import { logTechnicalEvent } from "@/services/security/sanitize";
import { useAppStore } from "@/store/useAppStore";
import type { Preferences } from "@/store/types";

/**
 * Tela preta com som (vídeo andando sem imagem).
 *
 * No Android o expo-video deixa a superfície do vídeo invisível até receber o
 * aviso de "primeiro quadro", e esse aviso só sai quando o tamanho da
 * superfície bate com o do vídeo. Em alguns aparelhos e canais (proporção de
 * pixel diferente, troca de canal com outra resolução) o aviso não sai e a
 * imagem nunca aparece, embora o som toque.
 *
 * Correção automática: se o vídeo anda {@link NO_PICTURE_SECONDS} s sem o
 * primeiro quadro, a vista do vídeo é recriada com a cortina do próprio
 * ExoPlayer (`useExoShutter`), que mostra a imagem assim que o primeiro
 * quadro é desenhado. O aparelho fica marcado e as próximas reproduções já
 * abrem assim. O modo "Compatível" (manual) também troca a superfície por
 * TextureView, para TVs em que a imagem sai quebrada.
 */
export type VideoMode = "auto" | "compatible";

export const VIDEO_MODE_KEY = "videoMode";
/** Aparelho em que a correção automática já foi necessária. */
export const VIDEO_AUTO_FIX_KEY = "videoAutoFix";
const NO_PICTURE_SECONDS = 5;

export function readVideoMode(preferences: Preferences): VideoMode {
  return preferences[VIDEO_MODE_KEY] === "compatible" ? "compatible" : "auto";
}

type VideoViewHealingProps = {
  key: string;
  surfaceType: "surfaceView" | "textureView";
  useExoShutter: boolean;
  onFirstFrameRender: () => void;
};

export function useVideoHealing(
  player: VideoPlayer,
  options: { mode: VideoMode; autoFix: boolean; initiallyRendered: boolean },
): VideoViewHealingProps {
  const [healed, setHealed] = useState(false);
  const compatible = options.mode === "compatible";
  const shutter = compatible || options.autoFix || healed;
  // Prévia do guia: o vídeo já chega com imagem, sem novo aviso de 1º quadro.
  const firstFrameRef = useRef(options.initiallyRendered);
  const hasVideoRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const activeRef = useRef(shutter);
  activeRef.current = shutter;

  useEffect(() => {
    try { hasVideoRef.current = (player.availableVideoTracks?.length ?? 0) > 0; } catch { /* ainda carregando */ }
    const subs = [
      // Cada troca de fonte (canal, formato, reconexão) espera um novo 1º quadro.
      player.addListener("sourceChange", () => {
        firstFrameRef.current = false;
        hasVideoRef.current = false;
        startTimeRef.current = null;
      }),
      player.addListener("sourceLoad", (payload) => {
        hasVideoRef.current = (payload.availableVideoTracks?.length ?? 0) > 0;
      }),
      player.addListener("timeUpdate", (payload) => {
        // Só vídeo com faixa de imagem, tocando e ainda sem 1º quadro.
        if (activeRef.current || firstFrameRef.current || !hasVideoRef.current) return;
        let playing = false;
        try { playing = player.playing; } catch { /* segue */ }
        if (!playing) return;
        const time = payload.currentTime;
        if (startTimeRef.current === null || time < startTimeRef.current) {
          startTimeRef.current = time;
          return;
        }
        if (time - startTimeRef.current < NO_PICTURE_SECONDS) return;
        activeRef.current = true;
        logTechnicalEvent("Player", `vídeo andando sem imagem por ${NO_PICTURE_SECONDS} s: modo de vídeo ajustado`);
        useAppStore.getState().setPreference(VIDEO_AUTO_FIX_KEY, true);
        setHealed(true);
      }),
    ];
    return () => { for (const sub of subs) sub.remove(); };
  }, [player]);

  const onFirstFrameRender = useCallback(() => { firstFrameRef.current = true; }, []);

  return {
    // A superfície não pode mudar com a vista montada: a chave recria a vista
    // (o player continua o mesmo, sem recarregar o vídeo).
    key: `${compatible ? "texture" : "surface"}-${shutter ? "shutter" : "plain"}`,
    surfaceType: compatible ? "textureView" : "surfaceView",
    useExoShutter: shutter,
    onFirstFrameRender,
  };
}
