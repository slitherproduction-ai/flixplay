import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Animated, Easing, Modal, Platform, StyleSheet, View } from "react-native";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { Colors } from "@/constants/theme";

/**
 * Janela de confirmação do app, no lugar do `Alert.alert` do Android. Desde a
 * 2.17.69 segue o padrão do "Sair deste conteúdo?" do player (redesign):
 * ícone ciano, título e texto centralizados e botões em pílula — Cancelar
 * escuro à esquerda, a ação principal em pílula clara à direita. Mesma
 * assinatura do Alert, para trocar sem mudar a lógica de quem chama.
 *
 * - O botão "cancel" fecha também com o Voltar.
 * - Com uma ação "destructive", o foco começa em Cancelar (evita apagar por engano).
 * - Uma janela por vez: as seguintes esperam na fila.
 */
export type DialogButton = { text: string; style?: "default" | "cancel" | "destructive"; onPress?: () => void };
type DialogRequest = { id: number; title: string; message?: string; buttons: DialogButton[] };

type IoniconName = keyof typeof Ionicons.glyphMap;

/** Ícone pelo assunto da janela: sair, excluir, erro ou aviso. */
function iconFor(request: DialogRequest): IoniconName {
  const title = request.title.toLocaleLowerCase("pt-BR");
  if (title.startsWith("sair")) return "exit-outline";
  if (/(falha|não foi possível|inválid|erro)/.test(title)) return "alert-circle-outline";
  if (/(excluir|remover|apagar|limpar)/.test(title) && request.buttons.some((b) => b.style === "destructive")) return "trash-outline";
  if (request.buttons.length <= 1) return "checkmark-circle-outline";
  return "help-circle-outline";
}

let nextId = 1;
const queue: DialogRequest[] = [];
let notify: (() => void) | null = null;

export function showDialog(title: string, message?: string, buttons?: DialogButton[]): void {
  queue.push({ id: nextId++, title, message, buttons: buttons?.length ? buttons : [{ text: "OK" }] });
  notify?.();
}

export function AppDialogHost() {
  const [current, setCurrent] = useState<DialogRequest | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    const pull = () => setCurrent((value) => value ?? queue.shift() ?? null);
    notify = pull;
    pull();
    return () => { if (notify === pull) notify = null; };
  }, []);

  useEffect(() => {
    if (!current) return;
    opacity.setValue(0);
    lift.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [current, lift, opacity]);

  if (!current) return null;
  const close = (button?: DialogButton) => {
    setCurrent(queue.shift() ?? null);
    // Depois de fechar: a ação pode abrir outra janela ou navegar.
    if (button?.onPress) setTimeout(button.onPress, 0);
  };
  const cancel = current.buttons.find((button) => button.style === "cancel");
  const hasDestructive = current.buttons.some((button) => button.style === "destructive");
  // Ordem visual: Cancelar primeiro, a ação principal por último (à direita).
  const ordered = [...current.buttons].sort((a, b) => Number(b.style === "cancel") - Number(a.style === "cancel"));
  const preferred = hasDestructive && cancel ? cancel : ordered[ordered.length - 1];

  const icon = iconFor(current);
  const single = ordered.length === 1;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => close(cancel)}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Animated.View accessibilityViewIsModal accessibilityRole="alert" style={[styles.card, { transform: [{ translateY: lift }] }]}>
          <Ionicons name={icon} size={30} color={Colors.blueBright} />
          <AppText style={styles.title}>{current.title}</AppText>
          {current.message ? <AppText style={styles.message}>{current.message}</AppText> : null}
          <View style={styles.actions}>
            {ordered.map((button, index) => {
              const destructive = button.style === "destructive";
              const isCancel = button.style === "cancel";
              const primary = !isCancel && index === ordered.length - 1;
              return (
                <TVFocusable
                  key={`${current.id}-${button.text}`}
                  accessibilityRole="button"
                  accessibilityLabel={button.text}
                  hasTVPreferredFocus={Platform.isTV && button === preferred}
                  onPress={() => close(button)}
                  focusStyle={primary ? styles.primaryFocused : styles.ghostFocused}
                  style={({ pressed }) => [
                    styles.button,
                    primary ? styles.primary : styles.ghost,
                    !primary && !single && styles.grow,
                    single && styles.grow,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppText numberOfLines={1} style={[styles.buttonText, primary && styles.primaryText, primary && destructive && styles.destructiveText]}>{button.text}</AppText>
                </TVFocusable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(3,6,12,0.72)" },
  card: {
    width: "100%",
    maxWidth: 430,
    alignItems: "center",
    gap: 12,
    padding: 24,
    borderRadius: 22,
    backgroundColor: "#0E1524",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 21, lineHeight: 27, letterSpacing: -0.3, color: Colors.text, textAlign: "center" },
  message: { fontSize: 13, lineHeight: 19, color: Colors.muted, textAlign: "center" },
  actions: { width: "100%", flexDirection: "row", gap: 12, marginTop: 8 },
  button: { minHeight: 46, minWidth: 92, alignItems: "center", justifyContent: "center", paddingHorizontal: 22, borderRadius: 23, borderWidth: 1.5, borderColor: "transparent" },
  grow: { flex: 1 },
  ghost: { backgroundColor: "#1A2438" },
  primary: { backgroundColor: "#F4F8FF" },
  pressed: { opacity: 0.75 },
  ghostFocused: { borderColor: "rgba(244,248,255,0.95)", backgroundColor: "#24314A", transform: [] },
  primaryFocused: { borderColor: Colors.blueBright, transform: [] },
  buttonText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  primaryText: { fontFamily: "Inter_700Bold", color: "#070B14" },
  destructiveText: { color: "#C62828" },
});
