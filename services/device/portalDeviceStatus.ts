import type { DeviceIdentity } from "./deviceIdentity";
import { requestPortal } from "./portalClient";

export type PortalDeviceStatus =
  | { state: "linked"; displayName: string | null }
  | { state: "inactive"; displayName: string | null }
  | { state: "pending" }
  | { state: "migration-pending"; displayName: string | null }
  | { state: "unavailable" };

type PortalResponse = {
  registered?: boolean;
  active?: boolean;
  display_name?: string | null;
  migration_state?: string | null;
};

/**
 * Confirms whether this locally generated app identity was linked in the
 * ELVANOQ Play Portal. This endpoint never activates trials, creates charges
 * or changes a device record.
 */
export async function getPortalDeviceStatus(identity: DeviceIdentity): Promise<PortalDeviceStatus> {
  try {
    const response = await requestPortal<PortalResponse>("device-status", {
      mac: identity.macAddress,
      device_key: identity.deviceKey,
    });

    if (!response.ok) return { state: "unavailable" };
    const payload = response.payload ?? {};
    if (!payload.registered) return { state: "pending" };
    if (payload.migration_state === "pending_review") {
      return { state: "migration-pending", displayName: typeof payload.display_name === "string" ? payload.display_name : null };
    }
    return {
      state: payload.active ? "linked" : "inactive",
      displayName: typeof payload.display_name === "string" ? payload.display_name : null,
    };
  } catch {
    // The Portal must never delay or prevent entry to the IPTV app.
    return { state: "unavailable" };
  }
}
