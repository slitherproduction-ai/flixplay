import { CONNECTION_MESSAGES } from "@/services/connectionDiagnosis";
import { listProblemFromMessage } from "@/features/login/listProblem";

describe("listProblemFromMessage (janela A lista não abriu)", () => {
  it("bloqueio de DNS: internet e endereço ok, DNS da internet falhou", () => {
    const problem = listProblemFromMessage(CONNECTION_MESSAGES.dnsBlocked);
    expect(problem.kind).toBe("dnsBlocked");
    expect(problem.title).toBe("Bloqueio provável da operadora");
    expect(problem.checks.map((check) => check.state)).toEqual(["ok", "ok", "fail"]);
    expect(problem.primary).toBe("retry");
  });

  it("acha o motivo mesmo dentro de uma mensagem maior (sincronização)", () => {
    expect(listProblemFromMessage(`Canais: ${CONNECTION_MESSAGES.unreachable}`).kind).toBe("unreachable");
  });

  it("endereço inexistente pede para editar os dados", () => {
    expect(listProblemFromMessage(CONNECTION_MESSAGES.notFound).primary).toBe("edit");
    expect(listProblemFromMessage(CONNECTION_MESSAGES.offline).checks[0].state).toBe("fail");
  });

  it("conta vencida com a data, sem ponto duplo", () => {
    const problem = listProblemFromMessage("A lista venceu em 10/11/2026. Fale com a sua revenda para renovar.");
    expect(problem.kind).toBe("expired");
    expect(problem.message).toBe("A conta desta lista venceu em 10/11/2026.");
  });

  it("conta bloqueada, recusada, HTTP e resposta inválida", () => {
    expect(listProblemFromMessage("A lista está bloqueada no servidor. Fale com a sua revenda.").kind).toBe("blocked");
    expect(listProblemFromMessage("Usuário ou senha incorretos. Verifique suas credenciais IPTV.").kind).toBe("refused");
    expect(listProblemFromMessage("O servidor recusou o acesso durante a autenticação (HTTP 403). Confira o usuário e a senha da lista ou fale com a sua revenda.").kind).toBe("denied");
    expect(listProblemFromMessage("O servidor da lista está fora do ar ou sobrecarregado (HTTP 503). Tente novamente em alguns minutos.").kind).toBe("serverDown");
    expect(listProblemFromMessage("O servidor respondeu algo que não é uma lista. Confira o endereço do servidor.").kind).toBe("invalid");
    expect(listProblemFromMessage("Informe o usuário.").kind).toBe("unknown");
  });
});
