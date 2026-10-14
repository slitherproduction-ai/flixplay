import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { Colors } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";

type CatalogHeroItem = {
  id: string;
  title: string;
  poster: string;
  backdrop: string;
  plot: string;
  year: number;
  genre: string;
  rating: number;
};

export function CatalogHero({
  item,
  kind,
  tvMode,
  onPress,
}: {
  item?: CatalogHeroItem;
  kind: "Filme" | "Série";
  tvMode: boolean;
  onPress: () => void;
}) {
  if (!item) return null;
  return (
    <View style={[styles.wrap, tvMode && styles.tvWrap]}>
      <Image source={{ uri: item.backdrop || item.poster }} contentFit="cover" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["rgba(3,7,14,0.94)", "rgba(3,7,14,0.42)", "rgba(3,7,14,0.12)"]}
        locations={[0, 0.46, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["transparent", "rgba(3,7,14,0.94)"]}
        locations={[0.38, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.copy, tvMode && styles.tvCopy]}>
        <AppText style={styles.kicker}>{kind.toUpperCase()} EM DESTAQUE</AppText>
        <AppText numberOfLines={2} style={[styles.title, tvMode && styles.tvTitle]}>{item.title}</AppText>
        <AppText style={styles.meta}>
          {item.year > 0 ? item.year : "Ano não informado"} · {item.genre || kind} · ★ {item.rating > 0 ? item.rating.toFixed(1) : "–"}
        </AppText>
        {item.plot ? <AppText numberOfLines={tvMode ? 3 : 2} style={styles.plot}>{item.plot}</AppText> : null}
        <TVFocusable accessibilityRole="button" accessibilityLabel={`Abrir ${item.title}`} onPress={onPress} focusStyle={styles.actionFocused} style={styles.action}>
          <Ionicons name="play" size={16} color={Colors.background} />
          <AppText style={styles.actionText}>Ver detalhes</AppText>
        </TVFocusable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 238, overflow: "hidden", marginBottom: 22, borderRadius: 22, backgroundColor: Colors.backgroundRaised },
  tvWrap: { height: 404, marginHorizontal: -46, marginBottom: 28, borderRadius: 0 },
  copy: { position: "absolute", left: 22, bottom: 22, width: "65%", gap: 8 },
  tvCopy: { left: 86, bottom: 54, width: "38%", gap: 11 },
  kicker: { color: Colors.blueBright, fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.5 },
  title: { color: Colors.text, fontFamily: "Inter_700Bold", fontSize: 30, lineHeight: 35, letterSpacing: -0.8 },
  tvTitle: { fontSize: 44, lineHeight: 50, letterSpacing: -1.1 },
  meta: { color: "rgba(238,245,255,0.86)", fontFamily: "Inter_500Medium", fontSize: 12 },
  plot: { color: "rgba(238,245,255,0.82)", fontSize: 13, lineHeight: 19 },
  action: { alignSelf: "flex-start", minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3, paddingHorizontal: 17, borderRadius: 10, backgroundColor: Colors.white },
  actionFocused: { backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.blueBright, opacity: 1, transform: [{ scale: 1.025 }] },
  actionText: { color: Colors.background, fontFamily: "Inter_700Bold", fontSize: 13 },
});
