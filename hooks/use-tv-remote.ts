import { useEffect } from "react";
import { DeviceEventEmitter, Platform } from "react-native";

export type TVRemoteEvent =
  | "up" | "down" | "left" | "right" | "select" | "back"
  | "channelUp" | "channelDown"
  | "red" | "green" | "yellow" | "blue"
  | `digit${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;
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
  enter: "select",
  NumpadEnter: "select",
  Select: "select",
  OK: "select",
  Ok: "select",
  DPAD_CENTER: "select",
  dpad_center: "select",
  center: "select",
  " ": "select",
  Escape: "back",
  Back: "back",
  GoBack: "back",
  Backspace: "back",
  ChannelUp: "channelUp",
  MediaTrackPrevious: "channelUp",
  ChannelDown: "channelDown",
  MediaTrackNext: "channelDown",
  ColorF0Red: "red",
  ColorF1Green: "green",
  ColorF2Yellow: "yellow",
  ColorF3Blue: "blue",
  Red: "red",
  Green: "green",
  Yellow: "yellow",
  Blue: "blue",
};

for (let digit = 0; digit <= 9; digit += 1) {
  const event = `digit${digit}` as TVRemoteEvent;
  KEY_EVENT_MAP[String(digit)] = event;
  KEY_EVENT_MAP[`Digit${digit}`] = event;
  KEY_EVENT_MAP[`Numpad${digit}`] = event;
}

export function getTVRemoteEvent(key?: string, code?: string): TVRemoteEvent | null {
  const candidates = [key, code].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    const normalized = candidate.trim();
    const mapped = KEY_EVENT_MAP[normalized]
      ?? KEY_EVENT_MAP[normalized.toUpperCase()]
      ?? KEY_EVENT_MAP[normalized.toLowerCase()];
    if (mapped) return mapped;
  }
  return null;
}

export function useTVRemote(onEvent: (event: TVRemoteEvent) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let lastNativeKey = "";
    let lastNativeAt = 0;
    const nativeSubscription = Platform.OS === "android"
      ? DeviceEventEmitter.addListener("ELVANOQ_REMOTE_KEY", (payload: { key?: string; code?: string; eventType?: string; timestamp?: number }) => {
          // Native TV implementations differ: some report "select", others
          // use Android's KEYCODE_DPAD_CENTER/"enter" spelling.  Normalize at
          // this boundary so the player always receives the same event.
          const remoteEvent = getTVRemoteEvent(payload?.key ?? payload?.eventType, payload?.code)
            ?? (payload?.key as TVRemoteEvent | undefined);
          const now = Number(payload?.timestamp) || Date.now();
          if (!remoteEvent || (remoteEvent === lastNativeKey && now - lastNativeAt < 90)) return;
          lastNativeKey = remoteEvent;
          lastNativeAt = now;
          onEvent(remoteEvent);
        })
      : undefined;

    if (Platform.OS !== "web" || typeof window === "undefined") {
      return () => nativeSubscription?.remove();
    }

    const handleKeyDown = (event: { key: string; code: string; preventDefault: () => void }) => {
      const remoteEvent = getTVRemoteEvent(event.key, event.code);
      if (!remoteEvent) return;
      event.preventDefault();
      onEvent(remoteEvent);
    };

    window.addEventListener("keydown", handleKeyDown as unknown as EventListener);
    return () => {
      nativeSubscription?.remove();
      window.removeEventListener("keydown", handleKeyDown as unknown as EventListener);
    };
  }, [enabled, onEvent]);
}
