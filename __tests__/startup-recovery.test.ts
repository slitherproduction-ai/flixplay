import { getStartupScreen } from "@/core/startup/recovery";

describe("startup recovery gate", () => {
  it("keeps the normal startup screen while hydration is pending", () => {
    expect(getStartupScreen({ hydrated: false, timedOut: false, secureStorageStatus: "migration-pending" })).toBe("loading");
  });

  it("continues to the app only after a healthy hydration", () => {
    expect(getStartupScreen({ hydrated: true, timedOut: false, secureStorageStatus: "ready" })).toBe("ready");
  });

  it("shows recovery when the secure vault fails", () => {
    expect(getStartupScreen({ hydrated: true, timedOut: false, secureStorageStatus: "failed" })).toBe("recovery");
  });

  it("shows recovery when hydration times out", () => {
    expect(getStartupScreen({ hydrated: false, timedOut: true, secureStorageStatus: "migration-pending" })).toBe("recovery");
  });
});
