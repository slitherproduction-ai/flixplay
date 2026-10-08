import { authenticateXtream } from "@/services/xtream";
import type { ServerProfile } from "@/store/types";

const profile: ServerProfile = {
  id: "test", name: "Teste", serverUrl: "https://provider.test", username: "user", password: "pass",
  isActive: true, expiryDate: "", maxConnections: null, activeConnections: null, format: null,
};

describe("Xtream gateway diagnostics", () => {
  it("does not misclassify a TLS gateway failure as invalid credentials", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue(new Response("TLS handshake failure", { status: 502 }));
    await expect(authenticateXtream(profile)).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("TLS/SSL"),
    });
    globalThis.fetch = originalFetch;
  });
});
