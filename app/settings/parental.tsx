import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { AUTO_ADULT_PREFERENCE, countBlocked, isAdultCategoryName, resolveCategoryBlocked } from "@/features/parental/adult-categories";
import { useRouter } from "expo-router";
import { AppText } from "@/components/ui";
import { TVFocusable } from "@/components/tv-focusable";
import { Group, GroupLabel, GroupRow, PremiumBackdrop, PremiumButton, PremiumHeading, PremiumTopBar, premium, usePremiumContentStyle } from "@/components/premium-screen";
import { Colors } from "@/constants/theme";
import { useTVMode } from "@/hooks/use-tv-mode";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useAppStore } from "@/store/useAppStore";
import type { ParentalCategoryKind } from "@/store/types";
const SECURE_STORAGE_TIMEOUT_MS = 5_000;
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
  const autoAdultPref = useAppStore((s) => s.preferences[AUTO_ADULT_PREFERENCE]);
  const setPreference = useAppStore((s) => s.setPreference);
  const autoAdult = autoAdultPref !== false;
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
    setConfigured(null);
    try {
      const status = await Promise.race([
        getParentalPinStatus(),
        new Promise<never>((_, reject) => setTimeout(
          () => reject(new Error("O armazenamento seguro demorou para responder.")),
          SECURE_STORAGE_TIMEOUT_MS,
        )),
      ]);
      setConfigured(status.configured); setMode(null); setUnlocked(false); setMessage(""); setAccessPin("");
    } catch (error) { setConfigured(false); setMessage(error instanceof Error ? error.message : "Não foi possível acessar o armazenamento seguro."); }
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
  const tvMode = useTVMode();
  const { isTablet } = useResponsiveLayout();
  const contentStyle = usePremiumContentStyle({ tvMode, wide: isTablet }, 760);
  const totalBlocked = useMemo(
    () => countBlocked(blocked.live, live, autoAdult) + countBlocked(blocked.movies, movies, autoAdult) + countBlocked(blocked.series, series, autoAdult),
    [autoAdult, blocked, live, movies, series],
  );

  return <View style={premium.screen}>
    <PremiumBackdrop />
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={contentStyle}>
      <PremiumTopBar title="Controle parental" onBack={() => router.back()} />
      <PremiumHeading
        icon={unlocked ? "lock-open-outline" : "shield-checkmark-outline"}
        title="Controle parental"
        subtitle={unlocked
          ? (totalBlocked ? `${totalBlocked} categoria${totalBlocked === 1 ? "" : "s"} protegida${totalBlocked === 1 ? "" : "s"} por PIN` : "Nenhuma categoria protegida ainda")
          : "Proteja categorias com um PIN guardado no cofre seguro deste aparelho."}
      />

      {configured === null ? <View style={styles.statusRow}><ActivityIndicator size="small" color={Colors.blueBright} /><AppText style={styles.statusText}>Verificando armazenamento seguro…</AppText></View> : null}

      {configured === false ? <View style={premium.card}>
        <AppText style={styles.cardTitle}>Armazenamento seguro indisponível</AppText>
        <AppText style={styles.body}>{message || "Não foi possível preparar o controle parental neste momento."}</AppText>
        <PremiumButton label="Tentar novamente" icon="refresh" hasTVPreferredFocus disabled={busy} onPress={() => void refresh()} />
      </View> : null}

      {editingPin ? <View style={premium.card}>
        <AppText style={styles.cardTitle}>{mode === "remove" ? "Restaurar PIN padrão" : "Alterar PIN"}</AppText>
        <AppText style={styles.body}>{mode === "remove" ? "Confirme o PIN atual para restaurar o código padrão 0000." : "Confirme o PIN atual e informe o novo código, de 4 a 8 números."}</AppText>
        <PinField label="PIN atual" value={currentPin} onChange={setCurrentPin} />
        {mode !== "remove" ? <><PinField label="Novo PIN" value={pin} onChange={setPin} /><PinField label="Confirmar novo PIN" value={confirmation} onChange={setConfirmation} /></> : null}
        {message ? <ErrorBox text={message} /> : null}
        <View style={[styles.actions, (isTablet || tvMode) && styles.actionsWide]}>
          <PremiumButton label={mode === "remove" ? "Restaurar PIN 0000" : "Salvar novo PIN"} icon={mode === "remove" ? "refresh" : "checkmark"} loading={busy} disabled={configured === null} onPress={() => void submitPin()} style={styles.actionButton} />
          <PremiumButton label="Cancelar" variant="secondary" disabled={busy} onPress={() => { setMode(null); setMessage(""); }} style={styles.actionButton} />
        </View>
      </View> : null}

      {configured && mode === null && !unlocked ? <View style={premium.card}>
        <AppText style={styles.cardTitle}>Desbloquear controles</AppText>
        <AppText style={styles.body}>No primeiro acesso, use o PIN padrão 0000. Depois, escolha as categorias a proteger.</AppText>
        <PinField label="PIN parental" value={accessPin} onChange={setAccessPin} onSubmit={() => void unlockControls()} />
        {message ? <ErrorBox text={message} /> : null}
        <PremiumButton label="Acessar controles" icon="lock-open-outline" hasTVPreferredFocus loading={busy} onPress={() => void unlockControls()} />
      </View> : null}

      {configured && mode === null && unlocked ? <>
        <GroupLabel title="PROTEÇÃO AUTOMÁTICA" />
        <Group>
          <GroupRow
            icon="sparkles-outline"
            title="Proteger conteúdo adulto"
            subtitle="Categorias com nomes como Adultos, XXX ou +18 pedem o PIN sem você marcar uma a uma"
            accessibilityRole="switch"
            accessibilityState={{ checked: autoAdult }}
            onPress={() => setPreference(AUTO_ADULT_PREFERENCE, !autoAdult)}
            right={<Switch focusable={false} pointerEvents="none" value={autoAdult} trackColor={{ false: "#293246", true: Colors.blue }} thumbColor={Colors.white} />}
          />
        </Group>

        <GroupLabel title="CATEGORIAS PROTEGIDAS" />
        <AppText style={styles.groupHint}>Toque em uma área e use o cadeado de cada categoria. Assistir a elas vai pedir o PIN.</AppText>
        {(Object.keys(META) as ParentalCategoryKind[]).map((kind) => <CategorySection key={kind} kind={kind} categories={groups[kind]} blockedIds={blocked[kind]} autoAdult={autoAdult} expanded={expanded === kind} onExpand={() => setExpanded((value) => value === kind ? null : kind)} onToggle={(id) => toggleCategoryBlocked(kind, id)} />)}

        <GroupLabel title="PIN" />
        <Group>
          <GroupRow icon="key-outline" title="Alterar PIN" subtitle="Definir um novo código de 4 a 8 números" onPress={() => enterMode("change")} />
          <GroupRow icon="refresh-outline" iconColor={Colors.amber} title="Restaurar PIN padrão" subtitle="Volta para 0000" onPress={() => enterMode("remove")} divider />
          <GroupRow icon="lock-closed-outline" title="Bloquear controles" subtitle="Pede o PIN para alterar de novo" onPress={() => setUnlocked(false)} divider />
        </Group>
      </> : null}
    </ScrollView>
  </View>;
}

function CategorySection({ kind, categories, blockedIds, autoAdult, expanded, onExpand, onToggle }: { kind: ParentalCategoryKind; categories: Category[]; blockedIds: string[]; autoAdult: boolean; expanded: boolean; onExpand: () => void; onToggle: (id: string) => void }) {
  const meta = META[kind]; const count = countBlocked(blockedIds, categories, autoAdult);
  return <Group>
    <GroupRow
      icon={meta.icon}
      title={meta.title}
      subtitle={categories.length ? `${meta.subtitle} · ${count} bloqueada${count === 1 ? "" : "s"}` : "Sincronize o catálogo para exibir categorias"}
      accessibilityState={{ expanded }}
      onPress={onExpand}
      right={<Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={17} color={Colors.muted} />}
    />
    {expanded ? categories.map((category) => {
      const locked = resolveCategoryBlocked(blockedIds, category.id, category.name, autoAdult);
      const automatic = locked && !blockedIds.includes(category.id) && isAdultCategoryName(category.name);
      return <TVFocusable key={category.id} accessibilityRole="switch" accessibilityState={{ checked: locked }} accessibilityLabel={`${locked ? "Desbloquear" : "Bloquear"} ${category.name}`} onPress={() => onToggle(category.id)} focusStyle={premium.rowFocused} style={[styles.category, premium.dividerTop, locked && styles.categoryLocked]}>
        <Ionicons name={locked ? "lock-closed" : "lock-open-outline"} size={16} color={locked ? Colors.amber : Colors.subtle} />
        <AppText numberOfLines={1} style={styles.categoryName}>{category.name}</AppText>
        <View style={[styles.statusPill, locked && styles.statusPillLocked]}><AppText style={[styles.statusPillText, locked && styles.statusPillTextLocked]}>{automatic ? "Automática" : locked ? "Bloqueada" : "Livre"}</AppText></View>
      </TVFocusable>;
    }) : null}
  </Group>;
}

function ErrorBox({ text }: { text: string }) {
  return <View style={premium.error} accessibilityLiveRegion="polite"><Ionicons name="alert-circle-outline" size={17} color="#FF8B91" /><AppText style={premium.errorText}>{text}</AppText></View>;
}

function PinField({ label, value, onChange, onSubmit }: { label: string; value: string; onChange: (value: string) => void; onSubmit?: () => void }) {
  return <View style={styles.field}><AppText style={premium.fieldLabel}>{label}</AppText><TextInput value={value} onChangeText={(text) => onChange(text.replace(/\D/g, ""))} onSubmitEditing={onSubmit} keyboardType="number-pad" secureTextEntry maxLength={8} placeholder="••••" placeholderTextColor={Colors.subtle} accessibilityLabel={label} style={[premium.input, styles.pinInput]} /></View>;
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12 },
  statusText: { fontSize: 13, color: Colors.muted },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.text },
  body: { marginTop: -6, fontSize: 13, lineHeight: 19, color: Colors.muted },
  field: { gap: 7 },
  pinInput: { fontSize: 20, letterSpacing: 6 },
  actions: { gap: 8 },
  actionsWide: { flexDirection: "row" },
  actionButton: { flexGrow: 1 },
  groupHint: { marginTop: -10, paddingHorizontal: 4, fontSize: 12, lineHeight: 17, color: Colors.subtle },
  category: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  categoryLocked: { backgroundColor: "rgba(245,184,64,0.06)" },
  categoryName: { flex: 1, fontSize: 14, color: Colors.text },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)" },
  statusPillLocked: { backgroundColor: "rgba(245,184,64,0.14)" },
  statusPillText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.muted },
  statusPillTextLocked: { color: Colors.amber },
});
