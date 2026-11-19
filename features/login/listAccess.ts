import { appLocale } from "@/core/i18n";
import { CONNECTION_MESSAGES } from "@/services/connectionDiagnosis";
import { authenticateXtream, XtreamApiError, type XtreamUserInfo } from "@/services/xtream";
import type { ServerProfile } from "@/store/types";

/**
 * Motivo de a lista não carregar, dito ao usuário com o que fazer.
 *
 * Quando a sincronização falha, uma consulta curta à conta (player_api sem
 * ação) diz se a lista venceu, foi bloqueada ou se o usuário foi recusado. Sem
 * um desses motivos, fica a mensagem do erro de rede ou do servidor. Mesmas
 * mensagens no Roku, LG e Samsung.
 */
export function describeAccountProblem(userInfo: XtreamUserInfo | null | undefined): string | null {
  if (!userInfo) return null;
  const auth = userInfo.auth;
  const status = String(userInfo.status ?? "").toLowerCase().trim();
  if (status === "expired") {
    const until = expiryLabel(userInfo.exp_date);
    return until
      ? `A lista venceu em ${until}. Fale com a sua revenda para renovar.`
      : "A lista venceu. Fale com a sua revenda para renovar.";
  }
  if (status === "banned" || status === "disabled" || status === "blocked") {
    return "A lista está bloqueada no servidor. Fale com a sua revenda.";
  }
  if (auth === 0 || auth === "0" || auth === false) {
    return "A lista recusou o usuário e a senha. Confira os dados da lista ou fale com a sua revenda.";
  }
  return null;
}

function expiryLabel(expDate: unknown): string | null {
  const seconds = Number(expDate);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toLocaleDateString(appLocale());
}

/** Consulta a conta da lista e devolve o motivo, ou null (motivo desconhecido). */
export async function explainListAccess(profile: ServerProfile): Promise<string | null> {
  if (profile.sourceType === "m3u") return null;
  try {
    const result = await authenticateXtream(profile);
    return describeAccountProblem(result.user_info);
  } catch (error) {
    // Sem resposta do servidor: o diagnóstico de conexão já explica o motivo.
    const message = error instanceof XtreamApiError ? error.message : "";
    return (Object.values(CONNECTION_MESSAGES) as string[]).includes(message) ? message : null;
  }
}
