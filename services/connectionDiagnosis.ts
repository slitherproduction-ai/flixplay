import { NativeModules, Platform } from "react-native";

/**
 * Por que a lista não abre (2.17.77): separa os casos que exigem ações
 * diferentes do usuário. Só roda quando a conexão com o servidor da lista
 * falha; quem não tem problema não percebe nada.
 *
 * - DNS do aparelho: o módulo nativo pergunta ao sistema se o nome existe e
 *   tenta abrir a conexão na porta da lista (sem enviar usuário nem senha).
 * - DNS público (dns.google, por HTTPS): confirma se o nome existe de fato.
 *
 * Resultados:
 * - dnsBlocked: o aparelho não encontra o servidor, mas ele existe — bloqueio
 *   do DNS da operadora, do roteador ou da TV.
 * - notFound: o nome não existe — endereço errado ou desativado.
 * - unreachable: o nome existe, mas o servidor não responde — fora do ar ou
 *   bloqueado pela operadora (endereço IP).
 * - offline: nem o DNS público responde — aparelho sem internet.
 *
 * Mesmas mensagens no Roku, LG e Samsung (lá, sem o DNS do aparelho, o texto
 * diz "provável").
 */
export type ConnectionVerdict = "dnsBlocked" | "notFound" | "unreachable" | "offline";

export const CONNECTION_MESSAGES: Record<ConnectionVerdict, string> = {
  dnsBlocked: "O DNS da sua internet não encontrou o servidor da lista, mas ele existe. Provável bloqueio da operadora. Troque o DNS do aparelho ou do roteador (por exemplo 1.1.1.1 ou 8.8.8.8) e tente de novo.",
  notFound: "O endereço do servidor da lista não existe. Confira o endereço com a sua revenda.",
  unreachable: "O servidor da lista não respondeu. Ele pode estar fora do ar ou bloqueado pela operadora. Tente mais tarde ou fale com a sua revenda.",
  offline: "Este aparelho está sem internet. Confira o Wi-Fi ou o cabo e tente de novo.",
};

type Probe = { resolved: boolean; connect: "ok" | "timeout" | "refused" | "error" | "skipped" };
type NativeProbe = { probeHost?: (host: string, port: number, timeoutMs: number) => Promise<Probe> };
type PublicDns = "exists" | "missing" | "unavailable";

const native = (Platform.OS === "android" ? NativeModules.ElvanoqDeviceProfile : undefined) as NativeProbe | undefined;
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; verdict: ConnectionVerdict | null }>();
let lastResult: { at: number; verdict: ConnectionVerdict | null; host: string } | null = null;

function isIpAddress(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

async function publicDns(host: string, timeoutMs = 5_000): Promise<PublicDns> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`, {
      headers: { Accept: "application/dns-json" },
      signal: controller.signal,
    });
    if (!response.ok) return "unavailable";
    const body = (await response.json()) as { Status?: number; Answer?: unknown[] };
    if (body.Status === 3) return "missing";
    if (body.Status === 0) return Array.isArray(body.Answer) && body.Answer.length > 0 ? "exists" : "missing";
    return "unavailable";
  } catch {
    return "unavailable";
  } finally {
    clearTimeout(timer);
  }
}

/** Regra de decisão (testável sem rede). */
export function decideVerdict(probe: Probe | null, dns: PublicDns): ConnectionVerdict | null {
  if (probe) {
    if (!probe.resolved) {
      if (dns === "exists") return "dnsBlocked";
      if (dns === "missing") return "notFound";
      return "offline";
    }
    if (probe.connect === "ok") return null;
    return dns === "unavailable" ? "offline" : "unreachable";
  }
  // Sem o DNS do aparelho (iOS/web): só o DNS público.
  if (dns === "missing") return "notFound";
  if (dns === "unavailable") return "offline";
  return "unreachable";
}

/** Diagnóstico de uma falha de conexão com o servidor da lista; null = sem conclusão. */
export async function diagnoseListConnection(serverUrl: string): Promise<{ verdict: ConnectionVerdict; message: string } | null> {
  let host = "";
  let port = 80;
  try {
    const parsed = new URL(serverUrl);
    host = parsed.hostname;
    port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
  } catch {
    return null;
  }
  if (!host) return null;
  const cached = cache.get(host);
  let verdict: ConnectionVerdict | null;
  if (cached && Date.now() - cached.at < CACHE_MS) {
    verdict = cached.verdict;
  } else {
    const ip = isIpAddress(host);
    const [probe, dns] = await Promise.all([
      native?.probeHost ? native.probeHost(host, port, 4_000).catch(() => null) : Promise.resolve(null),
      ip ? Promise.resolve<PublicDns>("exists") : publicDns(host),
    ]);
    verdict = decideVerdict(probe, dns);
    cache.set(host, { at: Date.now(), verdict });
  }
  lastResult = { at: Date.now(), verdict, host };
  return verdict ? { verdict, message: CONNECTION_MESSAGES[verdict] } : null;
}

/** Último diagnóstico, para a tela Diagnóstico (sem endereço). */
export function lastConnectionDiagnosis(): { at: number; verdict: ConnectionVerdict | null } | null {
  return lastResult ? { at: lastResult.at, verdict: lastResult.verdict } : null;
}

export const VERDICT_LABELS: Record<ConnectionVerdict, string> = {
  dnsBlocked: "Bloqueio de DNS provável",
  notFound: "Endereço não existe",
  unreachable: "Servidor não responde",
  offline: "Sem internet",
};
