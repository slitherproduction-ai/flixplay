import * as SecureStore from "expo-secure-store";

const PAYMENTS_URL = "https://xrrgjssvdqvtrqhxpask.supabase.co/functions/v1/paghiper-payments";
const PUBLIC_KEY = "sb_publishable_zTZ9IwqmgdIcQfvsy_Qz0w_ZwIOa1kl";
const TIMEOUT_MS = 15_000;
const SESSION_PREFIX = "elvanoq.pix.pending.";

export interface PixConfig { enabled: boolean; amountCents: number; }
export interface PixOrder {
  id: string; mac: string; status: string; amountCents: number; emv: string | null;
  qrcodeBase64: string | null; dueDate: string | null; expiresAt: string | null;
  appliedAt: string | null; licenseUntil: string | null;
}
interface StoredSession { orderId: string; paymentAccess: string; }

export class PixError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = "PixError"; }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function asOrder(value: unknown): PixOrder {
  const order = record(value);
  if (!order || typeof order.id !== "string" || typeof order.mac !== "string" || typeof order.status !== "string" || typeof order.amount_cents !== "number") {
    throw new PixError(502, "A resposta da cobrança é inválida.");
  }
  return { id: order.id, mac: order.mac, status: order.status, amountCents: order.amount_cents,
    emv: typeof order.emv === "string" ? order.emv : null, qrcodeBase64: typeof order.qrcode_base64 === "string" ? order.qrcode_base64 : null,
    dueDate: typeof order.due_date === "string" ? order.due_date : null, expiresAt: typeof order.expires_at === "string" ? order.expires_at : null,
    appliedAt: typeof order.applied_at === "string" ? order.applied_at : null, licenseUntil: typeof order.license_until === "string" ? order.license_until : null };
}
async function call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(PAYMENTS_URL, { method: "POST", headers: { "Content-Type": "application/json", apikey: PUBLIC_KEY }, body: JSON.stringify(body), signal: controller.signal });
    const payload = record(await response.json().catch(() => null));
    if (!response.ok) throw new PixError(response.status, typeof payload?.message === "string" ? payload.message : "Não foi possível processar a cobrança.");
    if (!payload) throw new PixError(502, "A resposta da cobrança é inválida.");
    return payload;
  } catch (error) {
    if (error instanceof PixError) throw error;
    throw new PixError(0, "Não foi possível consultar o Pix agora. Verifique sua conexão.");
  } finally { clearTimeout(timeout); }
}
function key(mac: string) { return SESSION_PREFIX + mac.replace(/[^0-9a-f]/gi, "").toUpperCase(); }
export async function getPixConfig(): Promise<PixConfig> {
  const payload = await call({ action: "config" });
  return { enabled: payload.enabled === true, amountCents: typeof payload.amount_cents === "number" ? payload.amount_cents : 0 };
}
function randomPaymentAccess(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new PixError(0, "Não foi possível iniciar uma sessão de pagamento segura neste dispositivo.");
  const bytes = new Uint8Array(32); cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function getPendingPixOrder(mac: string): Promise<PixOrder | null> {
  const raw = await SecureStore.getItemAsync(key(mac)); if (!raw) return null;
  try { const saved = JSON.parse(raw) as StoredSession; if (!saved.orderId || !saved.paymentAccess) return null; return await getPixOrder(saved.orderId, mac, saved.paymentAccess); }
  catch { return null; }
}
export async function createPixOrder(input: { mac: string; payerName: string; payerEmail: string; payerCpfCnpj: string; consent: boolean }): Promise<PixOrder> {
  // Keep an existing pending payment: never create a duplicate after an ambiguous attempt.
  const pending = await getPendingPixOrder(input.mac); if (pending && ["pending", "processing", "creating", "unknown"].includes(pending.status)) return pending;
  const paymentAccess = randomPaymentAccess();
  const payload = await call({ action: "create", mac: input.mac, payment_access: paymentAccess, payer_name: input.payerName, payer_email: input.payerEmail, payer_cpf_cnpj: input.payerCpfCnpj, consent: input.consent });
  const order = asOrder(payload.order);
  await SecureStore.setItemAsync(key(input.mac), JSON.stringify({ orderId: order.id, paymentAccess } satisfies StoredSession));
  return order;
}
export async function getPixOrder(orderId: string, mac: string, paymentAccess?: string): Promise<PixOrder> {
  let access = paymentAccess;
  if (!access) { const raw = await SecureStore.getItemAsync(key(mac)); if (raw) access = (JSON.parse(raw) as StoredSession).paymentAccess; }
  if (!access) throw new PixError(409, "A sessão desta cobrança não está disponível neste dispositivo.");
  const payload = await call({ action: "status", order_id: orderId, mac, payment_access: access });
  return asOrder(payload.order);
}
