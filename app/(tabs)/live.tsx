import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { channels } from "@/data/demo";
import { Colors, Radii, Type } from "@/constants/theme";
import { AppText, Chip, GlassCard, IconButton, SearchField, ScreenState, SectionHeader } from "@/components/ui";
import { useScreenLoad } from "@/hooks/useScreenLoad";
import { useAppStore } from "@/store/useAppStore";

const categories = ["Todos", "Abertos", "Esportes HD", "Notícias", "Filmes & Séries", "Infantil", "Documentários"];

export default function LiveScreen() {
  const router = useRouter();
  const { loading, error, retry } = useScreenLoad("a programação ao vivo");
  const [category, setCategory] = useState("Todos");
  const [query, setQuery] = useState("");
  const favoriteIds = useAppStore((state) => state.favoriteIds);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);

  const filteredChannels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return channels.filter((channel) => {
      const matchesCategory = category === "Todos" || channel.categoryName === category;
      const matchesQuery = !normalizedQuery || `${channel.name} ${channel.currentEpg.title}`.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const handleChannel = useCallback((channelId: string) => {
    const channel = channels.find((item) => item.id === channelId);
    if (!channel) return;
    router.push({ pathname: "/player", params: { id: channel.id, title: channel.name, type: "live", streamUrl: channel.streamUrl } });
  }, [router]);

  const handleGuide = useCallback((channelId: string) => {
    const channel = channels.find((item) => item.id === channelId);
    if (!channel) return;
    Alert.alert(channel.name, `${channel.currentEpg.title} · ${channel.currentEpg.start}–${channel.currentEpg.end}\nA seguir: ${channel.nextProgram}`);
  }, []);

  const handleFavorite = useCallback((channelId: string) => {
    toggleFavorite(channelId);
  }, [toggleFavorite]);

  return (
    <View style={styles.screen}>
      <View style={styles.ambient} />
      <ScreenState loading={loading} error={error} retry={retry}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <AppText style={styles.kicker}>AO VIVO AGORA</AppText>
              <AppText style={Type.display}>TV ao Vivo</AppText>
              <AppText style={styles.headerSubtitle}>Sua programação em tempo real</AppText>
            </View>
            <IconButton icon="tv-outline" label="Transmitir para uma tela" onPress={() => Alert.alert("Transmitir", "Nenhum dispositivo encontrado nesta rede.")} />
          </View>

          <SearchField value={query} onChangeText={setQuery} placeholder="Buscar canal ou programa" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroller} contentContainerStyle={styles.categoryContent}>
            {categories.map((item) => <Chip key={item} label={item} selected={category === item} onPress={() => setCategory(item)} />)}
          </ScrollView>

          <SectionHeader title="Canais disponíveis" subtitle={`${filteredChannels.length} canais · EPG atualizado agora`} />
          <View style={styles.list}>
            {filteredChannels.map((channel) => {
              const isFavorite = favoriteIds.includes(channel.id);
              return (
                <GlassCard key={channel.id} style={styles.channelCard} intensity={18}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${channel.name}`} onPress={() => handleChannel(channel.id)} onLongPress={() => handleGuide(channel.id)} style={styles.channelPressable}>
                    <View style={styles.channelImage}>
                      <Image source={{ uri: channel.logo }} contentFit="cover" style={StyleSheet.absoluteFill} />
                      <View style={styles.imageVeil} />
                      <AppText style={styles.channelInitials}>{channel.name.slice(0, 3).toUpperCase()}</AppText>
                    </View>
                    <View style={styles.channelDetails}>
                      <View style={styles.channelTitleRow}>
                        <AppText style={styles.channelNumber}>{channel.number}</AppText>
                        <AppText style={styles.channelTitle}>{channel.name}</AppText>
                        <View style={styles.liveBadge}><View style={styles.liveDot} /><AppText style={styles.liveText}>AO VIVO</AppText></View>
                      </View>
                      <AppText style={styles.programTitle}>{channel.currentEpg.title}</AppText>
                      <View style={styles.programTimes}><AppText style={styles.programTime}>{channel.currentEpg.start}</AppText><View style={styles.programTrack}><View style={[styles.programFill, { width: `${channel.currentEpg.progress}%` }]} /></View><AppText style={styles.programTime}>{channel.currentEpg.end}</AppText></View>
                      <AppText numberOfLines={1} style={styles.nextProgram}>A seguir · {channel.nextProgram}</AppText>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={isFavorite ? `Remover ${channel.name} dos favoritos` : `Favoritar ${channel.name}`} onPress={() => handleFavorite(channel.id)} hitSlop={8} style={styles.favoriteButton}>
                      <Ionicons name={isFavorite ? "star" : "star-outline"} size={20} color={isFavorite ? Colors.amber : Colors.muted} />
                    </Pressable>
                  </Pressable>
                </GlassCard>
              );
            })}
          </View>
          {filteredChannels.length === 0 ? <View style={styles.empty}><Ionicons name="search-outline" size={28} color={Colors.subtle} /><AppText style={styles.emptyTitle}>Nenhum canal encontrado</AppText><AppText style={styles.emptyBody}>Tente outra categoria ou ajuste a busca.</AppText></View> : null}
          <AppText style={styles.guideHint}><Ionicons name="hand-left-outline" size={13} color={Colors.subtle} /> Toque para assistir · pressione e segure para abrir o EPG completo</AppText>
        </ScrollView>
      </ScreenState>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  ambient: { position: "absolute", top: -120, right: -110, width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(16, 185, 129, 0.07)" },
  content: { gap: 18, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 35 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  headerCopy: { flex: 1, gap: 4 },
  kicker: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 1.2, color: Colors.green },
  headerSubtitle: { fontSize: 13, color: Colors.muted },
  categoryScroller: { flexGrow: 0, marginHorizontal: -20 },
  categoryContent: { gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
  list: { gap: 10 },
  channelCard: { minHeight: 116, borderRadius: Radii.medium },
  channelPressable: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: 11 },
  channelImage: { width: 80, height: 88, overflow: "hidden", alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: Colors.backgroundRaised },
  imageVeil: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(8, 12, 22, 0.45)" },
  channelInitials: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.white },
  channelDetails: { flex: 1, gap: 6 },
  channelTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  channelNumber: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.subtle },
  channelTitle: { flexShrink: 1, fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.text },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, backgroundColor: "rgba(229, 9, 20, 0.14)" },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.red },
  liveText: { fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.4, color: "#FF6870" },
  programTitle: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.text },
  programTimes: { flexDirection: "row", alignItems: "center", gap: 6 },
  programTime: { fontVariant: ["tabular-nums"], fontSize: 9, color: Colors.subtle },
  programTrack: { flex: 1, height: 3, overflow: "hidden", borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)" },
  programFill: { height: "100%", borderRadius: 2, backgroundColor: Colors.green },
  nextProgram: { fontSize: 10, color: Colors.subtle },
  favoriteButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "rgba(255,255,255,0.06)" },
  empty: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 44, borderRadius: Radii.medium, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glassSoft },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.text },
  emptyBody: { fontSize: 13, color: Colors.muted },
  guideHint: { alignSelf: "center", fontSize: 11, color: Colors.subtle },
});
