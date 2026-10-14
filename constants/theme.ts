import { Platform, type TextStyle, type ViewStyle } from "react-native";
import { BRAND } from "@/constants/brand";

export const Colors = {
  background: BRAND.colors.background,
  backgroundRaised: BRAND.colors.surface,
  glass: "rgba(13, 20, 34, 0.52)",
  glassSoft: "rgba(17, 27, 45, 0.42)",
  glassStrong: "rgba(17, 27, 45, 0.74)",
  border: BRAND.colors.border,
  borderStrong: "rgba(0, 215, 255, 0.32)",
  text: BRAND.colors.textPrimary,
  muted: BRAND.colors.textSecondary,
  subtle: "#63728A",
  blue: BRAND.colors.primary,
  blueBright: BRAND.colors.accent,
  red: BRAND.colors.error,
  green: BRAND.colors.success,
  amber: BRAND.colors.warning,
  white: "#FFFFFF",
  black: "#000000",
};

export const Radii = {
  small: 12,
  medium: 18,
  large: 24,
  pill: 999,
};

export const Shadows = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.32,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
    },
    android: { elevation: 8 },
    default: { boxShadow: "0 14px 30px rgba(0, 0, 0, 0.28)" },
  }) ?? {},
};

export const Type = {
  display: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: Colors.text,
  } satisfies TextStyle,
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: Colors.text,
  } satisfies TextStyle,
  section: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    lineHeight: 23,
    color: Colors.text,
  } satisfies TextStyle,
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: Colors.muted,
  } satisfies TextStyle,
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 16,
    color: Colors.muted,
  } satisfies TextStyle,
  micro: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.7,
    color: Colors.muted,
    textTransform: "uppercase",
  } satisfies TextStyle,
};

export const imageUrl = (id: string, width = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`;
