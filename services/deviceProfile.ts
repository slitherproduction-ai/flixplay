import { NativeModules, Platform } from "react-native";

/**
 * Perfil do aparelho para ajustar o app ao que ele aguenta.
 * - "low": até 1,5 GB de RAM ou marcado pelo sistema como de pouca memória
 *   (TCL, Fire TV Lite/Stick antigos, TV box de 1 GB);
 * - "high": 3 GB ou mais (Shield, Chromecast 4K, Fire TV Cube, celulares atuais);
 * - "standard": o resto, e qualquer aparelho em que o módulo nativo falte.
 */
export type DeviceTier = "low" | "standard" | "high";

type NativeDeviceProfile = {
  totalMemMb?: number;
  lowRam?: boolean;
  isTv?: boolean;
  setKeepScreenOn?: (enabled: boolean) => void;
  exitApp?: () => void;
  getConstants?: () => { totalMemMb?: number; lowRam?: boolean; isTv?: boolean };
};

const native = (Platform.OS === "android" ? NativeModules.ElvanoqDeviceProfile : undefined) as NativeDeviceProfile | undefined;

function readConstants(): { totalMemMb: number; lowRam: boolean; isTv: boolean } {
  try {
    const constants = native?.getConstants?.() ?? native ?? {};
    return {
      totalMemMb: Number(constants.totalMemMb) || 0,
      lowRam: constants.lowRam === true,
      isTv: constants.isTv === true,
    };
  } catch {
    return { totalMemMb: 0, lowRam: false, isTv: false };
  }
}

const constants = readConstants();

export function classifyDevice(totalMemMb: number, lowRam: boolean): DeviceTier {
  if (lowRam || (totalMemMb > 0 && totalMemMb <= 1600)) return "low";
  if (totalMemMb >= 2900) return "high";
  return "standard";
}

export const deviceTier: DeviceTier = classifyDevice(constants.totalMemMb, constants.lowRam);
export const isAndroidTvDevice = constants.isTv;

export type PlayerBufferProfile = {
  preferredForwardBufferDuration: number;
  minBufferForPlayback: number;
  maxBufferBytes: number;
};

/** Buffer do player por perfil: menos memória em aparelho fraco, mais folga em aparelho forte. */
export function playerBufferProfile(live: boolean, tvMode: boolean, tier: DeviceTier = deviceTier): PlayerBufferProfile {
  const MB = 1024 * 1024;
  if (tier === "low") {
    return { preferredForwardBufferDuration: live ? 10 : 20, minBufferForPlayback: 2, maxBufferBytes: 32 * MB };
  }
  if (tier === "high") {
    return { preferredForwardBufferDuration: live ? 30 : 60, minBufferForPlayback: 2, maxBufferBytes: (tvMode ? 96 : 128) * MB };
  }
  // Valores usados até a 2.17.32.
  return { preferredForwardBufferDuration: live ? 15 : 30, minBufferForPlayback: 2, maxBufferBytes: (tvMode ? 48 : 64) * MB };
}

/** Largura do pôster pedida ao TMDB conforme o aparelho. */
export function posterWidthForTier(tier: DeviceTier = deviceTier): "w185" | "w342" | "w500" {
  return tier === "low" ? "w185" : tier === "high" ? "w500" : "w342";
}

/**
 * Tela ligada: na TV fica sempre ligada (como antes); no celular só enquanto
 * o vídeo toca, para a tela apagar normalmente nos menus.
 */
export function setPlaybackKeepAwake(enabled: boolean): void {
  try {
    native?.setKeepScreenOn?.(isAndroidTvDevice ? true : enabled);
  } catch {
    // Sem o módulo nativo: o sistema decide.
  }
}

export function applyStartupKeepAwake(): void {
  if (isAndroidTvDevice) setPlaybackKeepAwake(true);
}

/**
 * Encerra o app por completo (Android), como no Roku: fecha a tela, sai dos
 * recentes e termina o processo. Sem o módulo nativo, só fecha a tela.
 */
export function exitAppCompletely(fallback: () => void): void {
  if (native?.exitApp) {
    try {
      native.exitApp();
      return;
    } catch {
      // segue para o fallback
    }
  }
  fallback();
}
