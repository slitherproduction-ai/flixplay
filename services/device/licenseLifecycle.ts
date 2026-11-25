import * as SecureStore from "expo-secure-store";
import type { CodeAccessSnapshot } from "./codeDeviceAccess";
const KEY = "elvanoq-lifecycle-grant-v1";
export const OFFLINE_GRACE_MS = 24 * 60 * 60_000;
let writes: Promise<void> = Promise.resolve();
export async function saveLifecycleGrant(scope: string, snapshot: CodeAccessSnapshot | null) {
  writes = writes.then(async () => {
  try {
    if (!snapshot || snapshot.state !== "granted" || !snapshot.canPlay || !snapshot.canConnect) { await SecureStore.deleteItemAsync(KEY); return; }
    await SecureStore.setItemAsync(KEY, JSON.stringify({ scope, at: Date.now(), snapshot }));
  } catch { /* Storage unavailable: never invent an authorization. */ }
  });
  await writes;
}
export async function readLifecycleGrant(scope: string): Promise<CodeAccessSnapshot | null> {
  await writes;
  try {
    const saved = JSON.parse(await SecureStore.getItemAsync(KEY) || "null");
    const age = Date.now() - Number(saved?.at);
    const snapshot = saved?.snapshot as CodeAccessSnapshot | undefined;
    const expiry = snapshot?.licenseUntil || snapshot?.accessUntil;
    if (saved?.scope !== scope || !Number.isFinite(age) || age < 0 || age > OFFLINE_GRACE_MS || snapshot?.state !== "granted" || !snapshot.canPlay || !snapshot.canConnect || (expiry && (!Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= Date.now()))) return null;
    return snapshot;
  } catch { return null; }
}
