import {
  clearRememberedTvFocus,
  getRememberedTvFocus,
  hasRememberedTvFocus,
  rememberTvFocus,
} from "@/core/navigation/tv-focus-memory";
import { isTvRouteActive } from "@/core/navigation/tv-routes";

describe("TV focus memory", () => {
  afterEach(() => clearRememberedTvFocus());

  it("remembers the exact item and index per screen scope", () => {
    rememberTvFocus("movies-grid", "movie-42", 11);
    expect(hasRememberedTvFocus("movies-grid")).toBe(true);
    expect(getRememberedTvFocus("movies-grid")).toMatchObject({ itemId: "movie-42", itemIndex: 11 });
    expect(getRememberedTvFocus("series-grid")).toBeUndefined();
  });

  it("clears one scope without affecting another", () => {
    rememberTvFocus("movies-grid", "movie-1");
    rememberTvFocus("series-grid", "series-1");
    clearRememberedTvFocus("movies-grid");
    expect(getRememberedTvFocus("movies-grid")).toBeUndefined();
    expect(getRememberedTvFocus("series-grid")?.itemId).toBe("series-1");
  });
});

describe("TV route selection", () => {
  it("selects Home only for the root route", () => {
    expect(isTvRouteActive("/", "/")).toBe(true);
    expect(isTvRouteActive("/movies", "/")).toBe(false);
  });

  it("keeps a section active for nested paths", () => {
    expect(isTvRouteActive("/series/123", "/series")).toBe(true);
    expect(isTvRouteActive("/live", "/movies")).toBe(false);
  });
});
