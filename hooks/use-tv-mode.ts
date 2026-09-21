import { Platform } from "react-native";
import { useAppStore } from "@/store/useAppStore";

export function useTVMode() {
  const forcedTvMode = useAppStore((state) => state.preferences.tvModeEnabled === true);
  return Platform.isTV || forcedTvMode;
}
