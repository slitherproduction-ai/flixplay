import {
  getIntroSkipTarget,
  getNextEpisodeCountdown,
  readIntroEndSeconds,
} from "@/features/player/EpisodeAutomation";

describe("EpisodeAutomation", () => {
  it("uses only an explicit provider intro marker", () => {
    expect(readIntroEndSeconds({ intro_end_seconds: "83" })).toBe(83);
    expect(readIntroEndSeconds({ introEndSeconds: 91 })).toBe(91);
    expect(readIntroEndSeconds({ duration_secs: 1_800 })).toBeNull();
  });

  it("does not show a skip action after the explicit marker", () => {
    expect(getIntroSkipTarget(20, 1_200, 83)).toBe(83);
    expect(getIntroSkipTarget(83, 1_200, 83)).toBeNull();
    expect(getIntroSkipTarget(20, 1_200, null)).toBeNull();
  });

  it("starts the controlled next-episode countdown only in the final window", () => {
    expect(getNextEpisodeCountdown(93.2, 100, true)).toBeNull();
    expect(getNextEpisodeCountdown(94.1, 100, true)).toBe(6);
    expect(getNextEpisodeCountdown(98.4, 100, true)).toBe(2);
    expect(getNextEpisodeCountdown(98.4, 100, false)).toBeNull();
  });
});
