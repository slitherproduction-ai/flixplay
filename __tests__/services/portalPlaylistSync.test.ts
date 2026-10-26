jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/device/portalClient", () => ({
  requestPortal: jest.fn(),
  portalServiceMessage: jest.fn(() => "Portal temporariamente indisponível."),
}));

import { syncPortalPlaylist } from "@/services/device/portalPlaylistSync";
import { requestPortal } from "@/services/device/portalClient";

const identity = { macAddress: "02:11:22:33:44:55", deviceKey: "a".repeat(64) };
const portalRequest = requestPortal as jest.Mock;

describe("portal playlist sync", () => {
  beforeEach(() => jest.clearAllMocks());

  it("keeps a local list intact when a null playlist carries an explicit license block", async () => {
    portalRequest.mockResolvedValue({
      status: 200,
      ok: true,
      payload: {
        registered: true,
        active: true,
        playlist: null,
        license: { can_play: false, payment_required: true },
        code_access: { can_connect: false, payment_required: true },
      },
      retryAfterSeconds: null,
    });

    await expect(syncPortalPlaylist(identity)).resolves.toMatchObject({ state: "blocked" });
  });

  it("preserves M3U as M3U and binds it only to the current device", async () => {
    portalRequest.mockResolvedValue({
      status: 200,
      ok: true,
      payload: {
        registered: true,
        active: true,
        playlist: { name: "Minha M3U", kind: "m3u", credentials: { url: "http://iptv.example.com/list.m3u" } },
        license: { can_play: true, status: "active" },
        code_access: { can_connect: true },
      },
      retryAfterSeconds: null,
    });

    await expect(syncPortalPlaylist(identity)).resolves.toMatchObject({
      state: "synced",
      server: { sourceType: "m3u", m3uUrl: "http://iptv.example.com/list.m3u", portalManaged: true },
    });
  });

  it("requires an explicit key when the Portal denies the binding", async () => {
    portalRequest.mockResolvedValue({ status: 403, ok: false, payload: {}, retryAfterSeconds: null });
    await expect(syncPortalPlaylist(identity)).resolves.toMatchObject({ state: "link-required" });
  });
});
