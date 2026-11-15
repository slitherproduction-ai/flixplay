import { Image, type ImageProps } from "expo-image";
import { useEffect, useMemo, useState } from "react";

/**
 * Imagem com reserva para as artes do TMDB.
 *
 * Em algumas redes e TVs o servidor de imagens do TMDB (image.tmdb.org)
 * não responde, enquanto a API (sinopse, nota, elenco) funciona. Sem reserva,
 * o destaque e os Detalhes ficavam sem imagem. Aqui cada endereço do TMDB ganha
 * um segundo servidor do próprio TMDB (media.themoviedb.org, o mesmo arquivo)
 * e, por fim, a imagem da lista. A troca só acontece quando a anterior falha:
 * quem carrega de primeira não baixa nada a mais.
 */
const TMDB_HOST = /^https?:\/\/image\.tmdb\.org\//i;
const TMDB_MIRROR = "https://media.themoviedb.org/";

export function imageCandidates(...urls: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const url of urls) {
    if (!url) continue;
    if (!out.includes(url)) out.push(url);
    if (TMDB_HOST.test(url)) {
      const mirror = url.replace(TMDB_HOST, TMDB_MIRROR);
      if (!out.includes(mirror)) out.push(mirror);
    }
  }
  return out;
}

type FallbackImageProps = Omit<ImageProps, "source"> & {
  /** Endereços em ordem de preferência (já no tamanho certo). */
  sources: string[];
};

export function FallbackImage({ sources, onError, ...rest }: FallbackImageProps) {
  const key = sources.join("|");
  const [index, setIndex] = useState(0);
  useEffect(() => { setIndex(0); }, [key]);
  const uri = sources[index] ?? "";
  const source = useMemo(() => (uri ? { uri } : null), [uri]);
  return (
    <Image
      {...rest}
      source={source}
      onError={(event) => {
        if (index + 1 < sources.length) setIndex(index + 1);
        onError?.(event);
      }}
    />
  );
}
