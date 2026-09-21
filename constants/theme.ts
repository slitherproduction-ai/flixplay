import { Platform, type TextStyle, type ViewStyle } from "react-native";

export const Colors = {
  background: "#07090E",
  backgroundRaised: "#0D111A",
  glass: "rgba(22, 28, 45, 0.78)",
  glassSoft: "rgba(26, 33, 50, 0.58)",
  glassStrong: "rgba(33, 41, 60, 0.9)",
  border: "rgba(255, 255, 255, 0.12)",
  borderStrong: "rgba(255, 255, 255, 0.2)",
  text: "#F8FAFC",
  muted: "#94A3B8",
  subtle: "#64748B",
  blue: "#3B82F6",
  blueBright: "#60A5FA",
  red: "#E50914",
  green: "#10B981",
  amber: "#F59E0B",
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
