import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Platform, StyleSheet, View } from "react-native";
import { TVFocusable } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { Colors } from "@/constants/theme";

/**
 * Janela de confirmação do app (2.17.59), no lugar do `Alert.alert` do
 * Android: cartão pequeno e discreto, título curto, texto em uma ou duas
 * linhas e botões finos alinhados à direita. Mesma assinatura do Alert, para
 * trocar sem mudar a lógica de quem chama.
 *
 * - O botão "cancel" fecha também com o Voltar.
 * - Com uma ação "destructive", o foco começa em Cancelar (evita apagar por engano).
 * - Uma janela por vez: as seguintes esperam na fila.
 */
export type DialogButton = { text: string; style?: "default" | "cancel" | "destructive"; onPress?: () => void };
type DialogRequest = { id: number; title: string; message?: string; buttons: DialogButton[] };

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

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => close(cancel)}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Animated.View accessibilityViewIsModal accessibilityRole="alert" style={[styles.card, { transform: [{ translateY: lift }] }]}>
          <AppText style={styles.title}>{current.title}</AppText>
          {current.message ? <AppText style={styles.message}>{current.message}</AppText> : null}
          <View style={styles.actions}>
            {ordered.map((button, index) => {
              const destructive = button.style === "destructive";
              const isCancel = button.style === "cancel";
              const primary = !isCancel && !destructive && index === ordered.length - 1;
              return (
                <TVFocusable
                  key={`${current.id}-${button.text}`}
                  accessibilityRole="button"
                  accessibilityLabel={button.text}
                  hasTVPreferredFocus={Platform.isTV && button === preferred}
                  onPress={() => close(button)}
                  focusStyle={primary ? styles.primaryFocused : styles.ghostFocused}
                  style={({ pressed }) => [styles.button, primary ? styles.primary : styles.ghost, pressed && styles.pressed]}
                >
                  <AppText style={[styles.buttonText, primary && styles.primaryText, destructive && styles.destructiveText, isCancel && styles.cancelText]}>{button.text}</AppText>
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
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(3,6,12,0.68)" },
  card: {
    width: "100%",
    maxWidth: 360,
    paddingTop: 20,
    paddingHorizontal: 22,
    paddingBottom: 16,
    borderRadius: 18,
    backgroundColor: "#0F1626",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 15, lineHeight: 20, letterSpacing: -0.2, color: Colors.text },
  message: { marginTop: 6, fontSize: 12, lineHeight: 18, color: Colors.muted },
  actions: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 6, marginTop: 18 },
  button: { minHeight: 34, minWidth: 72, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, borderRadius: 17, borderWidth: 1.5, borderColor: "transparent" },
  ghost: { backgroundColor: "transparent" },
  primary: { backgroundColor: "#F4F8FF" },
  pressed: { opacity: 0.7 },
  ghostFocused: { borderWidth: 1.5, borderColor: "rgba(244,248,255,0.9)", backgroundColor: "rgba(255,255,255,0.08)", transform: [] },
  primaryFocused: { borderWidth: 1.5, borderColor: Colors.blueBright, transform: [] },
  buttonText: { fontFamily: "Inter_600SemiBold", fontSize: 12.5, color: Colors.text },
  primaryText: { color: Colors.background },
  cancelText: { color: Colors.muted },
  destructiveText: { color: "#FF8A8A" },
});
