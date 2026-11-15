import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { BRAND } from "@/constants/brand";
import { useTVMode } from "@/hooks/use-tv-mode";

const mobileBackground = require("@/assets/images/brand/ELVANOQ_background_mobile.png");

/**
 * Fundo das telas de catálogo (Início, Filmes, Séries).
 *
 * Na TV sai a arte com o logo e os anéis no centro, que ficava atrás das
 * grades e disputava atenção com os pôsteres: fica o azul-marinho da marca
 * com uma luz suave no topo. É só um degradê — sem imagem para decodificar,
 * o que também alivia a memória no Fire TV Stick. A cor de cada título vem
 * das capas e do destaque, não do fundo.
 */
export function CatalogBackground() {
  const tvMode = useTVMode();
  if (tvMode) {
    return (
      <View pointerEvents="none" accessibilityElementsHidden style={[StyleSheet.absoluteFill, styles.tvBase]}>
        <LinearGradient
          colors={["#0F1A31", "rgba(15,26,49,0.35)", BRAND.colors.background]}
          locations={[0, 0.32, 0.7]}
          start={{ x: 0.85, y: 0 }}
          end={{ x: 0.35, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }
  return (
    <View pointerEvents="none" accessibilityElementsHidden style={StyleSheet.absoluteFill}>
      <Image source={mobileBackground} contentFit="cover" style={StyleSheet.absoluteFill} />
      <View style={styles.veil} />
      <View style={styles.bottomFade} />
    </View>
  );
}

const styles = StyleSheet.create({
  tvBase: { backgroundColor: BRAND.colors.background },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(4, 9, 18, 0.62)" },
  bottomFade: { position: "absolute", right: 0, bottom: 0, left: 0, height: "54%", backgroundColor: "rgba(4, 9, 18, 0.68)" },
});
