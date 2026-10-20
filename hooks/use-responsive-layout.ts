import { useWindowDimensions } from "react-native";
import { useTVMode } from "@/hooks/use-tv-mode";

/**
 * Shared responsive classification for handset, tablet and TV layouts.
 * Android reports dimensions in dp, so the 600 dp short-side threshold keeps
 * phones (including large handsets) out of the tablet composition.
 */
export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const tvMode = useTVMode();
  const shortSide = Math.min(width, height);
  const isTablet = !tvMode && shortSide >= 600;
  const isTabletLandscape = isTablet && width >= height;
  const isTabletPortrait = isTablet && !isTabletLandscape;

  return {
    width,
    height,
    tvMode,
    isTablet,
    isTabletLandscape,
    isTabletPortrait,
    /** Safe content gutters for mobile/tablet; TV has its own rail spacing. */
    contentPadding: isTabletLandscape ? 36 : isTablet ? 28 : 20,
    /** Prevent phone-oriented forms and copy from becoming excessively wide. */
    contentMaxWidth: isTabletLandscape ? 1180 : isTablet ? 860 : undefined,
  };
}
