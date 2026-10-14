import { getTVRemoteEvent } from "@/hooks/use-tv-remote";

describe("TV remote event normalization", () => {
  it("normalizes the Android TV / Fire TV OK and center variants", () => {
    expect(getTVRemoteEvent("enter")).toBe("select");
    expect(getTVRemoteEvent("OK")).toBe("select");
    expect(getTVRemoteEvent("dpad_center")).toBe("select");
    expect(getTVRemoteEvent(undefined, "NumpadEnter")).toBe("select");
  });

  it("keeps D-pad navigation mapped to the player navigation events", () => {
    expect(getTVRemoteEvent("DPAD_UP")).toBe("up");
    expect(getTVRemoteEvent("ArrowDown")).toBe("down");
    expect(getTVRemoteEvent("KEYCODE_UNKNOWN")).toBeNull();
  });
});
