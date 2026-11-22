import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { FocusHalo, TV, TvEyebrow } from "@/features/tv/tv-kit";
import type { ListCheck, ListProblem } from "@/features/login/listProblem";

/**
 * "A lista não abriu" (canvas "ELVANOQ Play TV", tela 4): motivo, o que foi
 * verificado, o que fazer e as saídas (tentar de novo, editar dados, outra
 * lista). Usada no login, nas listas salvas e quando a lista em uso não abre.
 */
type Props = {
  problem: ListProblem | null;
  onRetry?: () => void;
  onEdit?: () => void;
  onOtherList?: () => void;
  onClose: () => void;
};

type Action = { key: string; label: string; onPress: () => void; primary: boolean };

export function ListProblemDialog({ problem, onRetry, onEdit, onOtherList, onClose }: Props) {
  const { width } = useWindowDimensions();
  if (!problem) return null;
  const run = (fn?: () => void) => () => { onClose(); fn?.(); };
  const retry: Action | null = onRetry ? { key: "retry", label: "Tentar de novo", onPress: run(onRetry), primary: problem.primary === "retry" } : null;
  const edit: Action | null = onEdit ? { key: "edit", label: "Editar dados", onPress: run(onEdit), primary: problem.primary === "edit" } : null;
  const other: Action | null = onOtherList ? { key: "other", label: "Outra lista", onPress: run(onOtherList), primary: false } : null;
  const actions = (problem.primary === "edit" ? [edit, retry, other] : [retry, edit, other]).filter(Boolean) as Action[];
  if (actions.length && !actions.some((action) => action.primary)) actions[0].primary = true;
  if (!actions.length) actions.push({ key: "close", label: "Fechar", onPress: onClose, primary: true });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.center} bounces={false}>
          <View accessibilityViewIsModal accessibilityRole="alert" style={[styles.card, { width: Math.min(560, width - 32) }]}>
            <View style={styles.head}>
              <View style={styles.iconBox}>
                <Ionicons name="warning-outline" size={24} color={TV.warning} />
              </View>
              <View style={styles.headText}>
                <TvEyebrow color={TV.warning}>A LISTA NÃO ABRIU</TvEyebrow>
                <AppText style={styles.title}>{problem.title}</AppText>
                <AppText style={styles.message}>{problem.message}</AppText>
              </View>
            </View>

            {problem.checks.length ? (
              <View style={styles.checks}>
                {problem.checks.map((check) => <Check key={check.label} check={check} />)}
              </View>
            ) : null}

            <View style={styles.advice}>
              <AppText style={styles.adviceTitle}>O que fazer</AppText>
              <AppText style={styles.adviceText}>{problem.advice}</AppText>
            </View>

            <View style={styles.actions}>
              {actions.map((action, index) => <ActionButton key={action.key} action={action} preferred={index === 0} />)}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function ActionButton({ action, preferred }: { action: Action; preferred: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <TVFocusable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      hasTVPreferredFocus={preferred}
      onPress={action.onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={action.primary ? styles.primary : styles.secondary}
      focusStyle={action.primary ? styles.primaryFocus : styles.secondaryFocus}
    >
      {focused && action.primary ? <FocusHalo radius={10} /> : null}
      <AppText style={action.primary ? styles.primaryText : styles.secondaryText}>{action.label}</AppText>
    </TVFocusable>
  );
}

function Check({ check }: { check: ListCheck }) {
  const color = check.state === "ok" ? TV.success : check.state === "fail" ? TV.danger : TV.muted;
  const icon = check.state === "ok" ? "checkmark" : check.state === "fail" ? "close" : "remove";
  return (
    <View style={styles.check}>
      <View style={styles.checkHead}>
        <Ionicons name={icon} size={11} color={color} />
        <AppText style={[styles.checkLabel, { color }]}>{check.label}</AppText>
      </View>
      <AppText style={styles.checkDetail}>{check.detail}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(4, 7, 13, 0.93)" },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingVertical: 24 },
  card: { borderRadius: 18, backgroundColor: TV.surface, borderWidth: 0.5, borderColor: TV.cardBorder, padding: 32, gap: 18 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  iconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(245, 184, 61, 0.14)", alignItems: "center", justifyContent: "center" },
  headText: { flex: 1, gap: 6 },
  title: { fontFamily: TV.bold, fontSize: 23, lineHeight: 27, letterSpacing: -0.4, color: TV.text },
  message: { fontFamily: TV.regular, fontSize: 12, lineHeight: 18, color: TV.soft },
  checks: { flexDirection: "row", gap: 8 },
  check: { flex: 1, borderRadius: 10, backgroundColor: "#141F33", padding: 12, gap: 5 },
  checkHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  checkLabel: { fontFamily: TV.semi, fontSize: 9.5, lineHeight: 13 },
  checkDetail: { fontFamily: TV.regular, fontSize: 10, lineHeight: 14, color: TV.muted },
  advice: { borderRadius: 10, backgroundColor: "rgba(20, 125, 255, 0.1)", borderWidth: 0.5, borderColor: "rgba(20, 125, 255, 0.3)", paddingVertical: 13, paddingHorizontal: 15, gap: 4 },
  adviceTitle: { fontFamily: TV.bold, fontSize: 10.5, lineHeight: 14, color: TV.text },
  adviceText: { fontFamily: TV.regular, fontSize: 10.5, lineHeight: 16, color: TV.soft },
  actions: { flexDirection: "row", gap: 8 },
  primary: { flex: 1.3, height: 40, borderRadius: 10, backgroundColor: TV.text, borderWidth: 1.5, borderColor: TV.text, alignItems: "center", justifyContent: "center" },
  primaryFocus: { borderColor: TV.ring, transform: [] },
  primaryText: { fontFamily: TV.bold, fontSize: 12, color: TV.bg },
  secondary: { flex: 1, height: 40, borderRadius: 10, backgroundColor: "#141F33", borderWidth: 0.75, borderColor: "rgba(136, 148, 168, 0.35)", alignItems: "center", justifyContent: "center" },
  secondaryFocus: { borderWidth: 1.5, borderColor: TV.ring, backgroundColor: TV.surfaceHigh, transform: [] },
  secondaryText: { fontFamily: TV.semi, fontSize: 12, color: TV.text },
});
