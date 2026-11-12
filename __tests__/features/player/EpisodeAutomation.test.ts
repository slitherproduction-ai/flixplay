import {
  playedToTheEnd,
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

describe("playedToTheEnd", () => {
  it("não conta como fim um vídeo que nunca andou (arquivo vazio do servidor)", () => {
    expect(playedToTheEnd(false, 0, 0)).toBe(false);
    expect(playedToTheEnd(false, 0, 2700)).toBe(false);
  });
  it("não conta como fim um vídeo cortado no meio", () => {
    expect(playedToTheEnd(true, 600, 2700)).toBe(false);
  });
  it("conta como fim perto do final", () => {
    expect(playedToTheEnd(true, 2698, 2700)).toBe(true);
    expect(playedToTheEnd(true, 2440, 2700)).toBe(true);
  });
});
