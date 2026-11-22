import { CONNECTION_MESSAGES, type ConnectionVerdict } from "@/services/connectionDiagnosis";

/**
 * Janela "A lista não abriu" (canvas "ELVANOQ Play TV", tela 4): o motivo em
 * título, o que foi verificado (internet, endereço, conexão ou conta) e o que
 * fazer. Montada a partir das mensagens que o app já produz
 * (connectionDiagnosis, listAccess e o leitor do Xtream), sem nova consulta.
 */

export type ListProblemKind =
  | ConnectionVerdict
  | "expired"
  | "blocked"
  | "refused"
  | "denied"
  | "serverDown"
  | "invalid"
  | "unknown";

export type CheckState = "ok" | "fail" | "unknown";
export type ListCheck = { label: string; detail: string; state: CheckState };

export type ListProblem = {
  kind: ListProblemKind;
  title: string;
  message: string;
  advice: string;
  checks: ListCheck[];
  /** Ação principal: tentar de novo ou corrigir os dados. */
  primary: "retry" | "edit";
};

const ok = (label: string, detail: string): ListCheck => ({ label, detail, state: "ok" });
const fail = (label: string, detail: string): ListCheck => ({ label, detail, state: "fail" });
const unknown = (label: string, detail: string): ListCheck => ({ label, detail, state: "unknown" });

const INTERNET_OK = ok("Internet", "Aparelho online");
const ADDRESS_OK = ok("Endereço", "Existe no DNS público");
const SERVER_OK = ok("Servidor", "Respondeu");

const CONNECTION: Record<ConnectionVerdict, Omit<ListProblem, "kind">> = {
  dnsBlocked: {
    title: "Bloqueio provável da operadora",
    message: "O endereço do servidor existe, mas o DNS da sua internet não o encontrou. Costuma ser bloqueio da operadora.",
    advice: "Troque o DNS do aparelho ou do roteador (por exemplo 1.1.1.1 ou 8.8.8.8). Se não resolver, fale com a sua revenda.",
    checks: [INTERNET_OK, ADDRESS_OK, fail("DNS da internet", "Não encontrou o servidor")],
    primary: "retry",
  },
  unreachable: {
    title: "O servidor não respondeu",
    message: "O endereço do servidor existe, mas a conexão não abriu. Ele pode estar fora do ar ou bloqueado pela operadora.",
    advice: "Tente mais tarde. Se continuar, troque o DNS do aparelho ou do roteador (1.1.1.1 ou 8.8.8.8) ou fale com a sua revenda.",
    checks: [INTERNET_OK, ADDRESS_OK, fail("Conexão", "Sem resposta do servidor")],
    primary: "retry",
  },
  notFound: {
    title: "Endereço do servidor não existe",
    message: "O nome do servidor da lista não foi encontrado em nenhum DNS. O endereço pode estar errado ou ter sido desativado.",
    advice: "Confira o endereço com a sua revenda e edite os dados da lista.",
    checks: [INTERNET_OK, fail("Endereço", "Não existe"), unknown("Conexão", "Não testada")],
    primary: "edit",
  },
  offline: {
    title: "Aparelho sem internet",
    message: "Nem o servidor da lista nem o DNS público responderam.",
    advice: "Confira o Wi-Fi ou o cabo de rede e tente de novo.",
    checks: [fail("Internet", "Sem conexão"), unknown("Endereço", "Não testado"), unknown("Conexão", "Não testada")],
    primary: "retry",
  },
};

/** Motivo estruturado a partir da mensagem de erro já exibida pelo app. */
export function listProblemFromMessage(raw: string | null | undefined): ListProblem {
  const message = String(raw ?? "").trim();
  for (const verdict of Object.keys(CONNECTION_MESSAGES) as ConnectionVerdict[]) {
    if (message.includes(CONNECTION_MESSAGES[verdict])) return { kind: verdict, ...CONNECTION[verdict] };
  }
  const lower = message.toLowerCase();

  const expired = /a lista venceu(?: em ([0-9]{1,4}(?:[./-][0-9]{1,4}){2}))?/i.exec(message);
  if (expired || lower.includes("conta expirada")) {
    return {
      kind: "expired",
      title: "A lista venceu",
      message: expired?.[1] ? `A conta desta lista venceu em ${expired[1]}.` : "A conta desta lista está vencida no servidor.",
      advice: "Fale com a sua revenda para renovar. Depois, é só tentar de novo.",
      checks: [INTERNET_OK, SERVER_OK, fail("Conta", "Vencida")],
      primary: "retry",
    };
  }
  if (lower.includes("bloqueada no servidor") || lower.includes("conta desativada")) {
    return {
      kind: "blocked",
      title: "A lista está bloqueada",
      message: "O servidor respondeu, mas a conta desta lista está bloqueada ou desativada.",
      advice: "Fale com a sua revenda.",
      checks: [INTERNET_OK, SERVER_OK, fail("Conta", "Bloqueada")],
      primary: "retry",
    };
  }
  if (lower.includes("recusou o usuário e a senha") || lower.includes("usuário ou senha incorretos")) {
    return {
      kind: "refused",
      title: "Usuário ou senha recusados",
      message: "O servidor respondeu, mas não aceitou o usuário e a senha desta lista.",
      advice: "Confira os dados da lista. Se estiverem certos, fale com a sua revenda.",
      checks: [INTERNET_OK, SERVER_OK, fail("Conta", "Dados recusados")],
      primary: "edit",
    };
  }
  const http = /\(HTTP (\d{3})\)/.exec(message);
  if (http && (http[1] === "401" || http[1] === "403")) {
    return {
      kind: "denied",
      title: "O servidor recusou o acesso",
      message: `O servidor respondeu, mas recusou o acesso (HTTP ${http[1]}).`,
      advice: "Confira o usuário e a senha da lista ou fale com a sua revenda.",
      checks: [INTERNET_OK, SERVER_OK, fail("Acesso", `Recusado (HTTP ${http[1]})`)],
      primary: "edit",
    };
  }
  if (http && Number(http[1]) >= 500) {
    return {
      kind: "serverDown",
      title: "Servidor fora do ar",
      message: `O servidor da lista está fora do ar ou sobrecarregado (HTTP ${http[1]}).`,
      advice: "Tente novamente em alguns minutos. Se continuar, fale com a sua revenda.",
      checks: [INTERNET_OK, ok("Endereço", "Encontrado"), fail("Servidor", `Erro HTTP ${http[1]}`)],
      primary: "retry",
    };
  }
  if (lower.includes("não é uma lista") || lower.includes("resposta vazia")) {
    return {
      kind: "invalid",
      title: "A resposta não é uma lista",
      message: "O endereço respondeu, mas não com uma lista IPTV. O endereço ou a porta podem estar errados.",
      advice: "Confira o endereço do servidor com a sua revenda.",
      checks: [INTERNET_OK, ok("Endereço", "Respondeu"), fail("Lista", "Resposta inválida")],
      primary: "edit",
    };
  }
  return {
    kind: "unknown",
    title: "Não foi possível conectar",
    message: message || "A lista não respondeu como esperado.",
    advice: "Confira os dados da lista e tente de novo. Se continuar, fale com a sua revenda.",
    checks: [],
    primary: "retry",
  };
}
