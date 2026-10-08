import { Linking, Platform } from "react-native";

/**
 * Opens a stream in a compatible installed Android player. URLs are never
 * logged; callers receive a generic error suitable for the interface.
 */
export async function openInExternalPlayer(streamUrl: string): Promise<void> {
  if (Platform.OS !== "android") throw new Error("Player externo disponível somente no Android.");
  if (!/^https?:\/\//i.test(streamUrl)) throw new Error("Não foi possível abrir este stream no player externo.");

  const intentUrl = `intent:${streamUrl.replace(/^https?:/, "")}`
    + "#Intent;action=android.intent.action.VIEW;type=video/*;end";
  const supported = await Linking.canOpenURL(intentUrl);
  if (!supported) throw new Error("Nenhum player externo compatível está instalado.");
  await Linking.openURL(intentUrl);
}
