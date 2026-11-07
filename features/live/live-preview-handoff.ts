import type { VideoPlayer } from "expo-video";

/**
 * Passagem da prévia do guia da TV para o player em tela cheia, e de volta.
 *
 * O mesmo player nativo que já toca o canal na prévia é usado pelo player em
 * tela cheia: o canal abre na hora, sem recarregar, e ao apertar Voltar a
 * prévia continua do ponto em que está. Também evita dois decodificadores de
 * vídeo ativos ao mesmo tempo, o que pesa em TVs e Fire Sticks simples.
 */

type PreviewEntry = { player: VideoPlayer; channelId: string; streamUrl: string };

let preview: PreviewEntry | null = null;
let claimedChannelId: string | null = null;
/** Canal que o player em tela cheia devolveu (pode ter mudado com canal +/-). */
let returnedChannelId: string | null = null;

/** A prévia avisa qual canal o player dela está tocando. */
export function registerPreview(entry: PreviewEntry | null) {
  preview = entry;
}

/** Chamado antes de abrir o player: reserva a prévia se ela já toca este canal. */
export function claimPreviewFor(channelId: string): boolean {
  if (preview && preview.channelId === channelId) {
    claimedChannelId = channelId;
    returnedChannelId = channelId;
    return true;
  }
  claimedChannelId = null;
  return false;
}

/** O player em tela cheia pega o player da prévia reservado para este canal. */
export function takeClaimedPreview(channelId: string): VideoPlayer | null {
  if (!preview || claimedChannelId !== channelId || preview.channelId !== channelId) return null;
  return preview.player;
}

/** A prévia está emprestada ao player em tela cheia: não pode pausar nem soltar a fonte. */
export function isPreviewClaimed(): boolean {
  return claimedChannelId !== null;
}

/** Canal +/- em tela cheia: o player emprestado passa a tocar outro canal. */
export function notifyFullscreenChannel(channelId: string, streamUrl: string) {
  if (claimedChannelId === null || !preview) return;
  preview = { ...preview, channelId, streamUrl };
  claimedChannelId = channelId;
  returnedChannelId = channelId;
}

/** O player em tela cheia devolve a prévia ao sair, informando o canal que ficou tocando. */
export function releasePreview() {
  claimedChannelId = null;
}

/** A tela do ao vivo consulta (uma vez) o canal devolvido, para manter a seleção nele. */
export function consumeReturnedChannel(): string | null {
  const value = returnedChannelId;
  returnedChannelId = null;
  return value;
}

/** O player da prévia ainda toca este canal (nada a recarregar). */
export function previewStillPlaying(player: VideoPlayer, channelId: string): boolean {
  return preview?.player === player && preview.channelId === channelId;
}
