import type { ImageSourcePropType } from "react-native";

export const BRAND = {
  name: "ELVANOQ",
  tagline: "Sua mídia. Sua experiência.",
  taglineInternational: "Your media. Your experience.",
  colors: {
    background: "#070B14",
    surface: "#0D1422",
    surfaceAlt: "#111B2D",
    deepBlue: "#0A2A66",
    primary: "#147DFF",
    accent: "#00D7FF",
    textPrimary: "#F4F8FF",
    textSecondary: "#8894A8",
    border: "rgba(136,148,168,0.25)",
    success: "#16C784",
    warning: "#F5B83D",
    error: "#FF5C72",
  },
} as const;

export const BrandAssets: Record<"icon" | "foreground" | "background" | "logo" | "wordmark" | "symbol" | "splash", ImageSourcePropType> = {
  icon: require("@/assets/images/brand/ELVANOQ_app_icon_v2.png"),
  foreground: require("@/assets/images/brand/ELVANOQ_adaptive_foreground_v2.png"),
  background: require("@/assets/images/brand/ELVANOQ_adaptive_background_v2.png"),
  logo: require("@/assets/images/brand/ELVANOQ_logo_transparent.png"),
  wordmark: require("@/assets/images/brand/ELVANOQ_wordmark_white_transparent.png"),
  symbol: require("@/assets/images/brand/ELVANOQ_adaptive_foreground_v2.png"),
  splash: require("@/assets/images/brand/ELVANOQ_splash_mobile_v2.png"),
};
