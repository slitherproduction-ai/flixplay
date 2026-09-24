export type PlayerUiLayer =
  | "hidden"
  | "osd"
  | "quick-zapping"
  | "epg"
  | "cast"
  | "exit-confirmation";

export type PlayerUiEvent =
  | { type: "SHOW_OSD" }
  | { type: "AUTO_HIDE" }
  | { type: "HIDE" }
  | { type: "OPEN_QUICK_ZAPPING" }
  | { type: "OPEN_EPG" }
  | { type: "OPEN_CAST" }
  | { type: "REQUEST_EXIT" }
  | { type: "CANCEL_EXIT" }
  | { type: "BACK" };

/**
 * Single source of truth for every player overlay. Returning one layer (rather
 * than a set of booleans) makes overlapping OSD, EPG and zapping impossible.
 */
export function reducePlayerUi(
  state: PlayerUiLayer,
  event: PlayerUiEvent,
): PlayerUiLayer {
  switch (event.type) {
    case "SHOW_OSD":
      return "osd";
    case "OPEN_QUICK_ZAPPING":
      return "quick-zapping";
    case "OPEN_EPG":
      return "epg";
    case "OPEN_CAST":
      return "cast";
    case "REQUEST_EXIT":
      return "exit-confirmation";
    case "AUTO_HIDE":
      return state === "osd" ? "hidden" : state;
    case "HIDE":
    case "CANCEL_EXIT":
      return "hidden";
    case "BACK":
      return state === "hidden" ? "exit-confirmation" : "hidden";
    default:
      return state;
  }
}
