/**
 * DNS alternativo (anti-bloqueio de DNS da operadora).
 *
 * Só PERGUNTA o IP do servidor (Google, Cloudflare ou Portal). A conexão ao
 * servidor IPTV continua saindo do aparelho, com o IP do cliente — pedido do
 * dono do servidor. Nada aqui contata o servidor da lista.
 *
 * Fluxo: o app tenta pelo DNS do sistema; numa falha de rede, o host fica
 * marcado como "usar IP" por 6 h e a chamada é repetida com o IP descoberto
 * (URL com IP + cabeçalho Host original). Só em http:// — em https:// o
 * certificado não bate com o IP.
 */
export type DnsMode = "auto" | "google" | "cloudflare" | "off";
export const DNS_MODE_KEY = "dnsMode";

const PORTAL_DNS_URL = "https://xrrgjssvdqvtrqhxpask.supabase.co/functions/v1/dns-resolve";
const LOOKUP_TIMEOUT_MS = 4000;
const STICKY_MS = 6 * 60 * 60 * 1000;

type Provider = "google" | "cloudflare" | "portal";
type CacheEntry = { ip: string; exp: number; source: Provider };

const cache = new Map<string, CacheEntry>();
const sticky = new Map<string, number>();
const pending = new Map<string, Promise<CacheEntry>>();
let lastUse: { host: string; source: Provider; at: number } | null = null;

export function parseDnsMode(value: unknown): DnsMode {
  return value === "google" || value === "cloudflare" || value === "off" ? value : "auto";
}

// O modo vem das preferências: app/_layout.tsx chama setDnsMode ao abrir e a cada mudança.
// (Sem importar o store aqui, para o serviço continuar testável sem o app.)
let currentMode: DnsMode = "auto";

export function setDnsMode(mode: DnsMode) {
  if (mode !== currentMode && mode === "off") clearDnsCache();
  currentMode = mode;
}

export function readDnsMode(): DnsMode {
  return currentMode;
}

function now() {
  return Date.now();
}

function isIpLiteral(host: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host.startsWith("[");
}

function isBlockedAnswer(ip: string) {
  return !ip || ip === "0.0.0.0" || ip.startsWith("127.");
}

export function parseHttpUrl(url: string): { protocol: string; host: string; port: string; rest: string } | null {
  const m = /^(https?:)\/\/([^/:?#]+)(:\d+)?([\s\S]*)$/i.exec(url || "");
  if (!m) return null;
  return { protocol: m[1].toLowerCase(), host: m[2].toLowerCase(), port: m[3] ?? "", rest: m[4] ?? "" };
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function pickDohAnswer(j: any): { ip: string; ttl: number } | null {
  if (!j || j.Status !== 0 || !Array.isArray(j.Answer)) return null;
  for (const a of j.Answer) {
    if (a?.type === 1 && typeof a.data === "string" && !isBlockedAnswer(a.data)) {
      return { ip: a.data, ttl: Math.max(60, Math.min(Number(a.TTL) || 300, 3600)) };
    }
  }
  return null;
}

async function ask(provider: Provider, host: string): Promise<{ ip: string; ttl: number }> {
  const q = encodeURIComponent(host);
  let r: { ip: string; ttl: number } | null = null;
  if (provider === "google") r = pickDohAnswer(await getJson(`https://8.8.8.8/resolve?type=A&name=${q}`));
  else if (provider === "cloudflare") {
    r = pickDohAnswer(await getJson(`https://1.1.1.1/dns-query?type=A&name=${q}`, { Accept: "application/dns-json" }));
  } else {
    const j = await getJson(`${PORTAL_DNS_URL}?name=${q}`);
    if (Array.isArray(j?.ips) && typeof j.ips[0] === "string" && !isBlockedAnswer(j.ips[0])) {
      r = { ip: j.ips[0], ttl: Number(j.ttl) || 300 };
    }
  }
  if (!r) throw new Error("no answer");
  return r;
}

function providerOrder(mode: DnsMode): Provider[] {
  if (mode === "off") return [];
  if (mode === "auto") return ["google", "cloudflare", "portal"];
  return [mode, "portal"];
}

/** Resolve o host pelo DNS alternativo (com cache pelo TTL). */
export function resolveHost(host: string, mode: DnsMode = readDnsMode()): Promise<CacheEntry> {
  const h = host.toLowerCase();
  if (!h || isIpLiteral(h) || mode === "off") return Promise.reject(new Error("dns off"));
  const hit = cache.get(h);
  if (hit && hit.exp > now()) return Promise.resolve(hit);
  const running = pending.get(h);
  if (running) return running;

  const job = (async () => {
    let lastErr: unknown = null;
    for (const p of providerOrder(mode)) {
      try {
        const r = await ask(p, h);
        const entry: CacheEntry = { ip: r.ip, exp: now() + r.ttl * 1000, source: p };
        cache.set(h, entry);
        return entry;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr ?? new Error("dns failed");
  })();
  pending.set(h, job);
  job.then(() => pending.delete(h), () => pending.delete(h));
  return job;
}

/** O host precisa ir pelo IP? (falhou pelo DNS do sistema há pouco, ou provedor fixo). */
export function shouldUseIp(url: string, mode: DnsMode = readDnsMode()): boolean {
  const u = parseHttpUrl(url);
  if (!u || mode === "off" || u.protocol !== "http:" || isIpLiteral(u.host)) return false;
  if (mode !== "auto") return true;
  return (sticky.get(u.host) ?? 0) > now();
}

export function markDnsFailure(url: string) {
  const u = parseHttpUrl(url);
  if (u) sticky.set(u.host, now() + STICKY_MS);
}

export type DnsRewrite = { url: string; host: string; ip: string; source: Provider };

/** Troca o domínio pelo IP (assíncrono: resolve se preciso). */
export async function rewriteWithIp(url: string, mode: DnsMode = readDnsMode()): Promise<DnsRewrite | null> {
  const u = parseHttpUrl(url);
  if (!u || mode === "off" || u.protocol !== "http:" || isIpLiteral(u.host)) return null;
  const entry = await resolveHost(u.host, mode);
  lastUse = { host: u.host, source: entry.source, at: now() };
  return { url: `${u.protocol}//${entry.ip}${u.port}${u.rest}`, host: u.host + u.port, ip: entry.ip, source: entry.source };
}

/** Versão síncrona para o player: usa só o que já está em cache. */
export function rewriteWithCachedIp(url: string, mode: DnsMode = readDnsMode()): DnsRewrite | null {
  const u = parseHttpUrl(url);
  if (!u || mode === "off" || u.protocol !== "http:" || isIpLiteral(u.host)) return null;
  const hit = cache.get(u.host);
  if (!hit || hit.exp <= now()) return null;
  return { url: `${u.protocol}//${hit.ip}${u.port}${u.rest}`, host: u.host + u.port, ip: hit.ip, source: hit.source };
}

/** Deixa o IP pronto em segundo plano (para o player ter a alternativa sem esperar). */
export function prewarmHost(url: string, mode: DnsMode = readDnsMode()) {
  const u = parseHttpUrl(url);
  if (!u || mode === "off" || u.protocol !== "http:" || isIpLiteral(u.host)) return;
  resolveHost(u.host, mode).catch(() => undefined);
}

/**
 * Lista de endereços para o player. Só muda algo quando o host já precisou do
 * IP (DNS da operadora falhou na API) ou com provedor fixo: aí os endereços
 * pelo IP vêm primeiro e os originais ficam como reserva. Fora isso a lista
 * fica intacta, para não mexer na escolha de formato (HLS/TS) do player.
 */
export function applyDnsToPlaybackUrls(urls: string[], mode: DnsMode = readDnsMode()): { urls: string[]; hostHeader: string | null } {
  if (mode === "off" || !urls.length || !shouldUseIp(urls[0] ?? "", mode)) return { urls, hostHeader: null };
  const rewritten = urls.map((u) => rewriteWithCachedIp(u, mode));
  const viaIp = rewritten.filter((r): r is DnsRewrite => r !== null);
  if (!viaIp.length) return { urls, hostHeader: null };
  const ipUrls = viaIp.map((r) => r.url);
  return { urls: Array.from(new Set([...ipUrls, ...urls])), hostHeader: viaIp[0].host };
}

export function getDnsStatus() {
  return { mode: readDnsMode(), lastUse, cachedHosts: cache.size };
}

export function clearDnsCache() {
  cache.clear();
  sticky.clear();
  lastUse = null;
}
