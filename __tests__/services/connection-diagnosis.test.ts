import { CONNECTION_MESSAGES, decideVerdict } from "@/services/connectionDiagnosis";

describe("connectionDiagnosis", () => {
  it("o aparelho não encontra, mas o DNS público encontra: bloqueio de DNS", () => {
    expect(decideVerdict({ resolved: false, connect: "skipped" }, "exists")).toBe("dnsBlocked");
  });
  it("ninguém encontra: endereço não existe", () => {
    expect(decideVerdict({ resolved: false, connect: "skipped" }, "missing")).toBe("notFound");
  });
  it("nem o DNS público responde: sem internet", () => {
    expect(decideVerdict({ resolved: false, connect: "skipped" }, "unavailable")).toBe("offline");
  });
  it("encontra mas não conecta: servidor não responde", () => {
    expect(decideVerdict({ resolved: true, connect: "timeout" }, "exists")).toBe("unreachable");
    expect(decideVerdict({ resolved: true, connect: "refused" }, "exists")).toBe("unreachable");
  });
  it("conexão abre: sem conclusão (fica o erro original)", () => {
    expect(decideVerdict({ resolved: true, connect: "ok" }, "exists")).toBeNull();
  });
  it("sem módulo nativo, só o DNS público", () => {
    expect(decideVerdict(null, "missing")).toBe("notFound");
    expect(decideVerdict(null, "exists")).toBe("unreachable");
    expect(CONNECTION_MESSAGES.dnsBlocked).toMatch(/DNS/);
  });
});
