import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { useTVMode } from "@/hooks/use-tv-mode";

const mobileBackground = require("@/assets/images/brand/ELVANOQ_background_mobile.png");
const tvBackground = require("@/assets/images/brand/ELVANOQ_background_tv.png");

/** Non-interactive ambient artwork shared by Home, Movies and Series. */
export function CatalogBackground() {
  const tvMode = useTVMode();
  return (
    <View pointerEvents="none" accessibilityElementsHidden style={StyleSheet.absoluteFill}>
      <Image source={tvMode ? tvBackground : mobileBackground} contentFit="cover" style={StyleSheet.absoluteFill} />
      <View style={styles.veil} />
      <View style={styles.bottomFade} />
    </View>
  );
}

const styles = StyleSheet.create({
  veil: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(4, 9, 18, 0.62)" },
  bottomFade: { position: "absolute", right: 0, bottom: 0, left: 0, height: "54%", backgroundColor: "rgba(4, 9, 18, 0.68)" },
});
