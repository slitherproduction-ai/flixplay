import { reducePlayerUi, type PlayerUiLayer } from "@/store/playerUiState";

describe("player UI state machine", () => {
  it.each([
    ["OPEN_QUICK_ZAPPING", "quick-zapping"],
    ["OPEN_EPG", "epg"],
    ["OPEN_CAST", "cast"],
    ["SHOW_OSD", "osd"],
  ] as const)("keeps exactly one layer for %s", (type, expected) => {
    expect(reducePlayerUi("osd", { type })).toBe(expected);
  });

  it("auto-hides only the OSD", () => {
    expect(reducePlayerUi("osd", { type: "AUTO_HIDE" })).toBe("hidden");
    expect(reducePlayerUi("epg", { type: "AUTO_HIDE" })).toBe("epg");
  });

  it("closes the active layer before asking to leave", () => {
    const active: PlayerUiLayer[] = ["osd", "quick-zapping", "epg", "cast"];
    active.forEach((layer) => {
      expect(reducePlayerUi(layer, { type: "BACK" })).toBe("hidden");
    });
    expect(reducePlayerUi("hidden", { type: "BACK" })).toBe("exit-confirmation");
  });
});
