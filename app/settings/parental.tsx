import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, IconButton } from "@/components/ui";
import { TVFocusable } from "@/components/tv-focusable";
import { Colors, Radii } from "@/constants/theme";
import { useAppStore } from "@/store/useAppStore";
import type { ParentalCategoryKind } from "@/store/types";
import { clearParentalPin, getParentalPinStatus, setParentalPin, verifyParentalPin } from "@/services/security/parentalControl";

type PinMode = "change" | "remove" | null;
type Category = { id: string; name: string };
const META: Record<ParentalCategoryKind, { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }> = {
  live: { title: "Canais", subtitle: "Categorias de TV ao vivo", icon: "tv-outline" },
  movies: { title: "Filmes", subtitle: "Categorias de filmes", icon: "film-outline" },
  series: { title: "Séries", subtitle: "Categorias de séries", icon: "albums-outline" },
};

export default function ParentalSettingsScreen() {
  const router = useRouter();
  const live = useAppStore((s) => s.contentCache.liveCategories);
  const movies = useAppStore((s) => s.contentCache.vodCategories);
  const series = useAppStore((s) => s.contentCache.seriesCategories);
  const blocked = useAppStore((s) => s.blockedCategoryIds);
  const toggleCategoryBlocked = useAppStore((s) => s.toggleCategoryBlocked);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [mode, setMode] = useState<PinMode>(null);
  const [accessPin, setAccessPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [expanded, setExpanded] = useState<ParentalCategoryKind | null>(null);
  const groups = useMemo(() => ({ live, movies, series }), [live, movies, series]);

  const refresh = useCallback(async () => {
    try {
      const status = await getParentalPinStatus();
      setConfigured(status.configured); setMode(null); setUnlocked(false); setMessage(""); setAccessPin("");
    } catch (error) { setConfigured(null); setMessage(error instanceof Error ? error.message : "Não foi possível acessar o armazenamento seguro."); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => void refresh(), 0); return () => clearTimeout(timer); }, [refresh]);

  const unlockControls = useCallback(async () => {
    if (busy) return; setBusy(true); setMessage("");
    try {
      const result = await verifyParentalPin(accessPin);
      if (!result.success) { setMessage(result.lockedUntil > Date.now() ? "PIN temporariamente bloqueado. Tente novamente mais tarde." : "PIN incorreto."); return; }
      setAccessPin(""); setUnlocked(true); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível validar o PIN."); }
    finally { setBusy(false); }
  }, [accessPin, busy]);

  const submitPin = useCallback(async () => {
    if (busy || !mode) return; setMessage("");
    try { const result = await verifyParentalPin(currentPin); if (!result.success) { setMessage(result.lockedUntil > Date.now() ? "PIN temporariamente bloqueado. Tente novamente mais tarde." : "PIN atual incorreto."); return; } }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível validar o PIN."); return; }
    if (mode === "remove") {
      setBusy(true); try { const result = await clearParentalPin(currentPin); if (!result.success) { setMessage("PIN atual incorreto."); return; } setCurrentPin(""); await refresh(); Alert.alert("Controle parental", "PIN restaurado para o padrão 0000."); } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível restaurar o PIN padrão."); } finally { setBusy(false); } return;
    }
    if (pin !== confirmation) { setMessage("A confirmação do novo PIN não corresponde."); return; }
    setBusy(true);
    try { await setParentalPin(pin); setCurrentPin(""); setPin(""); setConfirmation(""); setConfigured(true); setMode(null); setUnlocked(true); Alert.alert("Controle parental", "PIN salvo com segurança neste dispositivo."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível salvar o PIN."); }
    finally { setBusy(false); }
  }, [busy, confirmation, currentPin, mode, pin, refresh]);
  const enterMode = useCallback((next: "change" | "remove") => { setCurrentPin(""); setPin(""); setConfirmation(""); setMessage(""); setMode(next); }, []);

  const editingPin = mode === "change" || mode === "remove";
  return <View style={styles.screen}>
    <View style={styles.header}><IconButton icon="close" label="Voltar" onPress={() => router.back()} /><View><AppText style={styles.kicker}>SEGURANÇA</AppText><AppText style={styles.title}>Controle parental</AppText></View></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {configured === null ? <AppText style={styles.body}>Verificando armazenamento seguro…</AppText> : null}
      {editingPin ? <View style={styles.card}>
        <AppText style={styles.cardTitle}>{mode === "remove" ? "Restaurar PIN padrão" : "Alterar PIN"}</AppText>
        <AppText style={styles.body}>{mode === "remove" ? "Confirme o PIN atual para restaurar o código padrão 0000." : "Confirme o PIN atual e informe o novo código. O PIN fica protegido no cofre seguro do Android."}</AppText>
        <PinField label="PIN atual" value={currentPin} onChange={setCurrentPin} />
        {mode !== "remove" ? <><PinField label="Novo PIN (4 a 8 números)" value={pin} onChange={setPin} /><PinField label="Confirmar novo PIN" value={confirmation} onChange={setConfirmation} /></> : null}
        {message ? <AppText style={styles.error}>{message}</AppText> : null}
        <TVFocusable disabled={busy || configured === null} onPress={() => void submitPin()} style={styles.primary}><AppText style={styles.primaryText}>{mode === "remove" ? "Restaurar PIN 0000" : "Salvar novo PIN"}</AppText></TVFocusable>
        <TVFocusable disabled={busy} onPress={() => { setMode(null); setMessage(""); }} style={styles.secondary}><AppText style={styles.secondaryText}>Cancelar</AppText></TVFocusable>
      </View> : null}
      {configured && mode === null && !unlocked ? <View style={styles.card}>
        <View style={styles.lockHeader}><Ionicons name="shield-checkmark-outline" size={24} color={Colors.blueBright} /><View style={styles.copy}><AppText style={styles.cardTitle}>Desbloquear controles</AppText><AppText style={styles.body}>No primeiro acesso, informe o PIN padrão 0000. Após confirmar, escolha as categorias a proteger.</AppText></View></View>
        <PinField label="PIN parental (padrão: 0000)" value={accessPin} onChange={setAccessPin} />
        {message ? <AppText style={styles.error}>{message}</AppText> : null}
        <TVFocusable disabled={busy} onPress={() => void unlockControls()} style={styles.primary}><AppText style={styles.primaryText}>Acessar controles</AppText></TVFocusable>
      </View> : null}
      {configured && mode === null && unlocked ? <>
        <View style={styles.intro}><AppText style={styles.cardTitle}>Categorias protegidas</AppText><AppText style={styles.body}>Abra uma área e use o cadeado ao lado de cada categoria. A reprodução desses conteúdos exigirá o PIN.</AppText></View>
        {(Object.keys(META) as ParentalCategoryKind[]).map((kind) => <CategorySection key={kind} kind={kind} categories={groups[kind]} blockedIds={blocked[kind]} expanded={expanded === kind} onExpand={() => setExpanded((value) => value === kind ? null : kind)} onToggle={(id) => toggleCategoryBlocked(kind, id)} />)}
        <View style={styles.management}><TVFocusable onPress={() => enterMode("change")} style={styles.managementButton}><Ionicons name="key-outline" size={17} color={Colors.text} /><AppText style={styles.secondaryText}>Alterar PIN</AppText></TVFocusable><TVFocusable onPress={() => enterMode("remove")} style={styles.managementButton}><Ionicons name="refresh-outline" size={17} color={Colors.amber} /><AppText style={[styles.secondaryText, { color: Colors.amber }]}>Restaurar PIN</AppText></TVFocusable></View>
        <TVFocusable onPress={() => setUnlocked(false)} style={styles.secondary}><AppText style={styles.secondaryText}>Bloquear controles</AppText></TVFocusable>
      </> : null}
    </ScrollView>
  </View>;
}

function CategorySection({ kind, categories, blockedIds, expanded, onExpand, onToggle }: { kind: ParentalCategoryKind; categories: Category[]; blockedIds: string[]; expanded: boolean; onExpand: () => void; onToggle: (id: string) => void }) {
  const meta = META[kind]; const count = blockedIds.length;
  return <View style={styles.section}><TVFocusable onPress={onExpand} accessibilityRole="button" accessibilityState={{ expanded }} style={styles.sectionHeader}><Ionicons name={meta.icon} size={20} color={Colors.blueBright} /><View style={styles.copy}><AppText style={styles.sectionTitle}>{meta.title}</AppText><AppText style={styles.sectionSub}>{categories.length ? `${meta.subtitle} · ${count} bloqueada${count === 1 ? "" : "s"}` : "Sincronize o catálogo para exibir categorias"}</AppText></View><Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={19} color={Colors.muted} /></TVFocusable>{expanded ? <View style={styles.list}>{categories.map((category) => { const locked = blockedIds.includes(category.id); return <TVFocusable key={category.id} accessibilityRole="switch" accessibilityState={{ checked: locked }} accessibilityLabel={`${locked ? "Desbloquear" : "Bloquear"} ${category.name}`} onPress={() => onToggle(category.id)} style={[styles.category, locked && styles.categoryLocked]}><Ionicons name={locked ? "lock-closed" : "lock-open-outline"} size={18} color={locked ? Colors.amber : Colors.muted} /><AppText numberOfLines={1} style={styles.categoryName}>{category.name}</AppText><AppText style={[styles.status, locked && styles.statusLocked]}>{locked ? "Bloqueada" : "Livre"}</AppText></TVFocusable>; })}</View> : null}</View>;
}
function PinField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <View style={styles.field}><AppText style={styles.label}>{label}</AppText><TextInput value={value} onChangeText={onChange} keyboardType="number-pad" secureTextEntry maxLength={8} accessibilityLabel={label} style={styles.input} /></View>; }
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: Colors.background, padding: 20, gap: 18 }, header: { flexDirection: "row", alignItems: "center", gap: 14 }, content: { width: "100%", maxWidth: 900, alignSelf: "center", gap: 14, paddingBottom: 44 }, kicker: { color: Colors.blueBright, fontSize: 10, letterSpacing: 1.2 }, title: { color: Colors.text, fontSize: 22, fontWeight: "700" }, card: { gap: 16, padding: 18, borderRadius: Radii.large, backgroundColor: Colors.glassSoft, borderWidth: 1, borderColor: Colors.border }, cardTitle: { color: Colors.text, fontSize: 18, fontWeight: "700" }, body: { color: Colors.muted, lineHeight: 20 }, lockHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start" }, copy: { flex: 1, gap: 3 }, field: { gap: 7 }, label: { color: Colors.text, fontSize: 13, fontWeight: "600" }, input: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, color: Colors.text, paddingHorizontal: 14, fontSize: 18, backgroundColor: "rgba(7,9,14,0.45)" }, primary: { minHeight: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.82)", backgroundColor: Colors.white }, primaryText: { color: Colors.background, fontSize: 15, fontWeight: "700" }, secondary: { minHeight: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border }, secondaryText: { color: Colors.text, fontSize: 14, fontWeight: "700" }, error: { color: "#FF8B91", lineHeight: 19 }, intro: { gap: 5, paddingHorizontal: 2, paddingTop: 4 }, section: { borderRadius: 16, overflow: "hidden", backgroundColor: Colors.glassSoft, borderWidth: 1, borderColor: Colors.border }, sectionHeader: { minHeight: 68, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }, sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: "700" }, sectionSub: { color: Colors.muted, fontSize: 12 }, list: { borderTopWidth: 1, borderTopColor: Colors.border }, category: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }, categoryLocked: { backgroundColor: "rgba(245,184,64,0.08)" }, categoryName: { flex: 1, color: Colors.text, fontSize: 14 }, status: { color: Colors.muted, fontSize: 12, fontWeight: "600" }, statusLocked: { color: Colors.amber }, management: { flexDirection: "row", gap: 10 }, managementButton: { flex: 1, minHeight: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", gap: 8, flexDirection: "row", borderWidth: 1, borderColor: Colors.border } });
