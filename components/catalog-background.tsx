import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { BRAND } from "@/constants/brand";

/**
 * Fundo das telas de catálogo (Início, Filmes, Séries).
 *
 * Na TV, no celular e no tablet: azul-marinho da marca com uma luz suave no
 * topo, só degradê. Sai a arte com o logo e os anéis (TV) e a imagem de tela
 * cheia do celular — nada para decodificar atrás das listas, o que alivia a
 * memória em aparelhos de entrada. A cor de cada título vem das capas e do
 * destaque, não do fundo.
 */
export function CatalogBackground() {
  return (
    <View pointerEvents="none" accessibilityElementsHidden style={[StyleSheet.absoluteFill, styles.base]}>
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

const styles = StyleSheet.create({
  base: { backgroundColor: BRAND.colors.background },
});
