import type { DeviceIdentity } from "./deviceIdentity";

// The publishable key only identifies the public Supabase client; privileged
// Portal operations remain inside the Edge Function and use its service role.
const PORTAL_FUNCTION_URL = "https://xrrgjssvdqvtrqhxpask.supabase.co/functions/v1/portal-control";
const PORTAL_PUBLISHABLE_KEY = "sb_publishable_zTZ9IwqmgdIcQfvsy_Qz0w_ZwIOa1kl";
const REQUEST_TIMEOUT_MS = 8_000;

export type PortalDeviceStatus =
  | { state: "linked"; displayName: string | null }
  | { state: "inactive"; displayName: string | null }
  | { state: "pending" }
  | { state: "unavailable" };

type PortalResponse = {
  registered?: boolean;
  active?: boolean;
  display_name?: string | null;
};

/**
 * Confirms whether this locally generated app identity was linked in the
 * ELVANOQ Play Portal. This endpoint never activates trials, creates charges
 * or changes a device record.
 */
export async function getPortalDeviceStatus(identity: DeviceIdentity): Promise<PortalDeviceStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(PORTAL_FUNCTION_URL, {
      method: "POST",
      headers: {
        apikey: PORTAL_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "device-status",
        mac: identity.macAddress,
        device_key: identity.deviceKey,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return { state: "unavailable" };
    const payload = (await response.json()) as PortalResponse;
    if (!payload.registered) return { state: "pending" };
    return {
      state: payload.active ? "linked" : "inactive",
      displayName: typeof payload.display_name === "string" ? payload.display_name : null,
    };
  } catch {
    // The Portal must never delay or prevent entry to the IPTV app.
    return { state: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}
