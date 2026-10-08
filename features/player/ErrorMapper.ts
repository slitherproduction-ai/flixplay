export type PlayerErrorKind = "network" | "timeout" | "format" | "server" | "unknown";

export type PlayerErrorInfo = {
  kind: PlayerErrorKind;
  message: string;
};

function readTechnicalMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const direct = (error as { message?: unknown }).message;
    if (typeof direct === "string") return direct;
    const nested = (error as { error?: { message?: unknown } }).error?.message;
    if (typeof nested === "string") return nested;
  }
  return "";
}

export function mapPlayerError(error: unknown): PlayerErrorInfo {
  const technical = readTechnicalMessage(error).toLocaleLowerCase("en-US");
  if (/timeout|timed out|tempo limite/.test(technical)) {
    return { kind: "timeout", message: "O servidor demorou demais para responder. Tente novamente." };
  }
  if (/network|internet|connection|host|dns|socket|offline/.test(technical)) {
    return { kind: "network", message: "Não foi possível conectar ao stream. Verifique a internet e o servidor." };
  }
  if (/codec|decoder|format|container|unsupported|mime/.test(technical)) {
    return { kind: "format", message: "Este formato de vídeo não é compatível com o dispositivo." };
  }
  if (/http|response|status|server|403|404|410|5\d\d/.test(technical)) {
    return { kind: "server", message: "O servidor recusou ou encerrou a reprodução deste conteúdo." };
  }
  return { kind: "unknown", message: "O stream não pôde ser reproduzido." };
}
