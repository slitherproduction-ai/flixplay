import { Image } from "expo-image";
import { StyleSheet, type ImageStyle, type StyleProp } from "react-native";
import { BrandAssets } from "@/constants/brand";

export function BrandLogo({
  variant = "wordmark",
  style,
  accessibilityLabel = "ELVANOQ",
}: {
  variant?: "logo" | "wordmark" | "symbol";
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <Image
      source={BrandAssets[variant]}
      contentFit="contain"
      style={[styles.base, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    />
  );
}

const styles = StyleSheet.create({
  base: { width: 180, height: 54 },
});
