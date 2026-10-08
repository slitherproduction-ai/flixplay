import { useCallback, useState } from "react";
import { Modal, StyleSheet, TextInput, View } from "react-native";
import { Colors } from "@/constants/theme";
import { verifyParentalPin } from "@/services/security/parentalControl";
import { AppText } from "@/components/ui";
import { TVFocusable } from "@/components/tv-focusable";

interface ParentalGateProps {
  visible: boolean;
  onAuthorized: () => void;
  onClose: () => void;
}

/** Shared PIN gate so every entry point enforces the same secure verification. */
export function ParentalGate({ visible, onAuthorized, onClose }: ParentalGateProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const close = useCallback(() => {
    setPin("");
    setError("");
    onClose();
  }, [onClose]);

  const authorize = useCallback(async () => {
    try {
      const result = await verifyParentalPin(pin);
      if (!result.success) {
        setError(result.lockedUntil > Date.now() ? "PIN temporariamente bloqueado." : "PIN incorreto.");
        return;
      }
      setPin("");
      setError("");
      onAuthorized();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível validar o PIN.");
    }
  }, [onAuthorized, pin]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <AppText style={styles.title}>Conteúdo protegido</AppText>
          <AppText style={styles.body}>Informe o PIN parental para continuar.</AppText>
          <TextInput
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
            autoFocus
            style={styles.input}
            accessibilityLabel="PIN parental"
          />
          <AppText style={styles.error}>{error}</AppText>
          <View style={styles.actions}>
            <TVFocusable onPress={close} style={styles.cancel}><AppText style={styles.cancelText}>Cancelar</AppText></TVFocusable>
            <TVFocusable onPress={() => void authorize()} style={styles.confirm}><AppText style={styles.confirmText}>Continuar</AppText></TVFocusable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.72)" },
  dialog: { width: "100%", maxWidth: 420, gap: 12, padding: 22, borderRadius: 18, backgroundColor: Colors.backgroundRaised, borderWidth: 1, borderColor: Colors.border },
  title: { color: Colors.text, fontSize: 20, fontWeight: "700" },
  body: { color: Colors.muted, lineHeight: 20 },
  input: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, color: Colors.text, paddingHorizontal: 14, fontSize: 18 },
  error: { color: "#FF8B91", minHeight: 18 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  cancel: { minWidth: 104, minHeight: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  cancelText: { color: Colors.text, fontWeight: "600" },
  confirm: { minWidth: 114, minHeight: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: Colors.blue },
  confirmText: { color: Colors.white, fontWeight: "700" },
});
