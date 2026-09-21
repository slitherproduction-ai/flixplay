import { useEffect } from "react";
import { Platform } from "react-native";

export type TVRemoteEvent = "up" | "down" | "left" | "right" | "select" | "back";
export type TVKeyDownEvent = { nativeEvent: { key: string; code: string } };

const KEY_EVENT_MAP: Record<string, TVRemoteEvent> = {
  ArrowUp: "up",
  DPAD_UP: "up",
  Up: "up",
  ArrowDown: "down",
  DPAD_DOWN: "down",
  Down: "down",
  ArrowLeft: "left",
  DPAD_LEFT: "left",
  Left: "left",
  ArrowRight: "right",
  DPAD_RIGHT: "right",
  Right: "right",
  Enter: "select",
  Select: "select",
  DPAD_CENTER: "select",
  " ": "select",
  Escape: "back",
  Back: "back",
  GoBack: "back",
  Backspace: "back",
};

export function getTVRemoteEvent(key?: string, code?: string): TVRemoteEvent | null {
  return (key ? KEY_EVENT_MAP[key] : undefined) ?? (code ? KEY_EVENT_MAP[code] : undefined) ?? null;
}

export function useTVRemote(onEvent: (event: TVRemoteEvent) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS !== "web" || typeof window === "undefined") return;

    const handleKeyDown = (event: { key: string; code: string; preventDefault: () => void }) => {
      const remoteEvent = getTVRemoteEvent(event.key, event.code);
      if (!remoteEvent) return;
      event.preventDefault();
      onEvent(remoteEvent);
    };

    window.addEventListener("keydown", handleKeyDown as unknown as EventListener);
    return () => window.removeEventListener("keydown", handleKeyDown as unknown as EventListener);
  }, [enabled, onEvent]);
}
