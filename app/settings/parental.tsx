import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, IconButton } from "@/components/ui";
import { TVFocusable } from "@/components/tv-focusable";
import { Colors, Radii } from "@/constants/theme";
import {
  clearParentalPin,
  getParentalPinStatus,
  setParentalPin,
  verifyParentalPin,
} from "@/services/security/parentalControl";

type Mode = "setup" | "change" | "remove";

export default function ParentalSettingsScreen() {
  const router = useRouter();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("setup");
  const [currentPin, setCurrentPin] = useState("");
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const status = await getParentalPinStatus();
      setConfigured(status.configured);
      setMode(status.configured ? "change" : "setup");
      setMessage("");
    } catch (error) {
      setConfigured(false);
      setMessage(error instanceof Error ? error.message : "Não foi possível acessar o armazenamento seguro.");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const submit = useCallback(async () => {
    if (busy) return;
    setMessage("");
    if (mode !== "setup") {
      try {
        const result = await verifyParentalPin(currentPin);
        if (!result.success) {
          setMessage(result.lockedUntil > Date.now() ? "PIN temporariamente bloqueado. Tente novamente mais tarde." : "PIN atual incorreto.");
          return;
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Não foi possível validar o PIN.");
        return;
      }
    }
    if (mode === "remove") {
      setBusy(true);
      try {
        await clearParentalPin(currentPin);
        setCurrentPin("");
        await refresh();
      } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível remover o PIN."); }
      finally { setBusy(false); }
      return;
    }
    if (pin !== confirmation) { setMessage("A confirmação do novo PIN não corresponde."); return; }
    setBusy(true);
    try {
      await setParentalPin(pin);
      setCurrentPin(""); setPin(""); setConfirmation("");
      await refresh();
      Alert.alert("Controle parental", "PIN salvo com segurança neste dispositivo.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível salvar o PIN."); }
    finally { setBusy(false); }
  }, [busy, confirmation, currentPin, mode, pin, refresh]);

  const requiresCurrent = configured && mode !== "setup";
  return <View style={styles.screen}>
    <View style={styles.header}><IconButton icon="close" label="Voltar" onPress={() => router.back()} /><View><AppText style={styles.kicker}>SEGURANÇA</AppText><AppText style={styles.title}>Controle parental</AppText></View></View>
    <View style={styles.card}>
      <AppText style={styles.body}>O PIN é armazenado somente no cofre seguro do Android. Sem PIN válido, alterações de proteção não são permitidas.</AppText>
      {configured === null ? <AppText style={styles.body}>Verificando armazenamento seguro…</AppText> : null}
      {requiresCurrent ? <PinField label="PIN atual" value={currentPin} onChange={setCurrentPin} /> : null}
      {mode !== "remove" ? <><PinField label="Novo PIN (4 a 8 números)" value={pin} onChange={setPin} /><PinField label="Confirmar novo PIN" value={confirmation} onChange={setConfirmation} /></> : null}
      {message ? <AppText style={styles.error}>{message}</AppText> : null}
      <TVFocusable disabled={busy || configured === null} onPress={() => void submit()} style={styles.primary}><AppText style={styles.primaryText}>{mode === "remove" ? "Remover PIN" : configured ? "Alterar PIN" : "Criar PIN"}</AppText></TVFocusable>
      {configured && mode !== "remove" ? <TVFocusable disabled={busy} onPress={() => setMode("remove")} style={styles.secondary}><AppText style={styles.secondaryText}>Remover PIN</AppText></TVFocusable> : null}
      {configured && mode === "remove" ? <TVFocusable disabled={busy} onPress={() => setMode("change")} style={styles.secondary}><AppText style={styles.secondaryText}>Cancelar</AppText></TVFocusable> : null}
    </View>
  </View>;
}

function PinField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <View style={styles.field}><AppText style={styles.label}>{label}</AppText><TextInput value={value} onChangeText={onChange} keyboardType="number-pad" secureTextEntry maxLength={8} accessibilityLabel={label} style={styles.input} /></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: Colors.background, padding: 20, gap: 24 }, header: { flexDirection: "row", alignItems: "center", gap: 14 }, kicker: { color: Colors.blueBright, fontSize: 10, letterSpacing: 1.2 }, title: { color: Colors.text, fontSize: 22, fontWeight: "700" }, card: { gap: 16, padding: 18, borderRadius: Radii.large, backgroundColor: Colors.glassSoft, borderWidth: 1, borderColor: Colors.border }, body: { color: Colors.muted, lineHeight: 20 }, field: { gap: 7 }, label: { color: Colors.text, fontSize: 13, fontWeight: "600" }, input: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, color: Colors.text, paddingHorizontal: 14, fontSize: 18, backgroundColor: "rgba(7,9,14,0.45)" }, primary: { minHeight: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: Colors.blue }, primaryText: { color: Colors.white, fontSize: 15, fontWeight: "700" }, secondary: { minHeight: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border }, secondaryText: { color: Colors.text, fontSize: 14, fontWeight: "700" }, error: { color: "#FF8B91", lineHeight: 19 } });
