jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/services/device/deviceIdentity", () => ({
  getDeviceIdentity: jest.fn().mockResolvedValue({ macAddress: "02:11:22:33:44:55", deviceKey: "b".repeat(64) }),
}));
jest.mock("@/services/device/portalClient", () => ({
  requestPortal: jest.fn(),
  portalServiceMessage: jest.fn(() => "Portal indisponível."),
}));

import { migrateLegacyPortalInstallation } from "@/services/device/legacyPortalMigration";
import { requestPortal } from "@/services/device/portalClient";

describe("legacy Portal migration", () => {
  it("confirms only the server-verified identity and never sends playlist credentials", async () => {
    (requestPortal as jest.Mock).mockResolvedValue({
      status: 200,
      ok: true,
      payload: { registered: true, matching_identity: true, active: true, migration_state: "verified" },
      retryAfterSeconds: null,
    });

    const result = await migrateLegacyPortalInstallation([{
      id: "saved", name: "Local", serverUrl: "http://iptv.example.com", username: "secret-user", password: "secret-pass",
      isActive: true, expiryDate: "N/A", maxConnections: null, activeConnections: null, format: null, sourceType: "xtream", addedAt: "2026-01-01T00:00:00.000Z",
    }]);

    expect(result).toMatchObject({ status: "completed", codeAccessEnforced: true });
    expect(requestPortal).toHaveBeenCalledWith("legacy-device-migrate", expect.not.objectContaining({ username: expect.anything(), password: expect.anything(), serverUrl: expect.anything() }));
  });
});
