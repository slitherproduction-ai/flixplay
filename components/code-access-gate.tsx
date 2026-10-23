import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Modal, Platform, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors, Radii } from "@/constants/theme";
import { AppText } from "@/components/ui";
import { TVFocusable } from "@/components/tv-focusable";
import { useAppStore } from "@/store/useAppStore";
import { getDeviceIdentity } from "@/services/device/deviceIdentity";
import { CodeDeviceAccessError, revalidateCodeDevice, revalidatePortalManagedDevice } from "@/services/device/codeDeviceAccess";
import { createPixOrder, getPixConfig, getPixOrder, type PixConfig, type PixOrder } from "@/services/payments/paghiper";

const RECHECK_MS = 5 * 60_000;
const NETWORK_GRACE_MS = 15 * 60_000;
const PIX_POLL_MS = 15_000;

function money(cents: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }
function date(value: string | null) { return value ? new Date(value).toLocaleString("pt-BR") : "Não informado"; }
function isPending(status: string) { return ["pending", "processing", "creating", "unknown"].includes(status); }

export function CodeAccessGate() {
  const router = useRouter(); const insets = useSafeAreaInsets();
  const activeServerId = useAppStore((state) => state.activeServerId);
  const activeServer = useAppStore((state) => state.servers.find((item) => item.id === activeServerId));
  const access = useAppStore((state) => state.accessControl);
  const setAccess = useAppStore((state) => state.setCodeAccessSnapshot);
  const setActiveServer = useAppStore((state) => state.setActiveServer);
  const [checking, setChecking] = useState(false); const [notice, setNotice] = useState<string | null>(null);
  const isConfirmedCodeProfile = activeServer?.sourceType === "xtream-code" && activeServer.portalMigrationState === "confirmed" && Boolean(activeServer.serverCode);
  const isPortalManagedProfile = activeServer?.portalManaged === true;
  const requiresPortalAccess = isConfirmedCodeProfile || isPortalManagedProfile;
  const [verificationNote, setVerificationNote] = useState<string | null>(null);
  const lastGranted = useRef<number | null>(null); const inFlight = useRef(false);
  const [paymentOpen, setPaymentOpen] = useState(false); const [config, setConfig] = useState<PixConfig | null>(null); const [order, setOrder] = useState<PixOrder | null>(null);
  const [payerName, setPayerName] = useState(""); const [payerEmail, setPayerEmail] = useState(""); const [payerDocument, setPayerDocument] = useState(""); const [consent, setConsent] = useState(false); const [paymentError, setPaymentError] = useState<string | null>(null); const [issuing, setIssuing] = useState(false);

  const recheck = useCallback(async () => {
    if (!activeServer || !requiresPortalAccess || inFlight.current) return;
    inFlight.current = true; setChecking(true); setNotice(null);
    try {
      const identity = await getDeviceIdentity();
      const snapshot = isPortalManagedProfile
        ? await revalidatePortalManagedDevice(identity)
        : await revalidateCodeDevice(identity, activeServer.serverCode!);
      setAccess(snapshot);
      if (snapshot.state === "granted") lastGranted.current = Date.now();
    } catch (error) {
      if (error instanceof CodeDeviceAccessError && error.reason !== "network") {
        setAccess({ state: "blocked", canPlay: false, canConnect: false, paymentRequired: false, reason: error.reason, message: error.message, accessUntil: null, licenseUntil: null, licenseStatus: null, individualAccess: null, macAddress: "", checkedAt: new Date().toISOString() });
      } else if (lastGranted.current && Date.now() - lastGranted.current <= NETWORK_GRACE_MS) {
        setNotice("Não foi possível atualizar o acesso. O uso segue temporariamente disponível enquanto tentamos novamente.");
      } else {
        // Network failure is not an expiration or payment denial. Keep the
        // reason explicit and suspend playback only after the bounded grace.
        const identity = await getDeviceIdentity().catch(() => null);
        setAccess({ state: "unavailable", canPlay: false, canConnect: false, paymentRequired: false, reason: "network", message: "Não foi possível verificar o acesso agora. Verifique sua conexão antes de continuar.", accessUntil: null, licenseUntil: null, licenseStatus: null, individualAccess: null, macAddress: identity?.macAddress ?? "", checkedAt: new Date().toISOString() });
      }
    } finally { inFlight.current = false; setChecking(false); }
  }, [activeServer, isPortalManagedProfile, requiresPortalAccess, setAccess]);

  useEffect(() => {
    // A profile restored from an older app is kept online while its Portal
    // identity is migrated. Enforcement starts only after the Portal confirms
    // the same MAC/key pairing; this prevents an upgrade from creating a trial.
    if (!activeServer || !requiresPortalAccess) {
      setAccess(null);
      return;
    }
    void recheck();
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => { if (!timer) timer = setInterval(() => void recheck(), RECHECK_MS); };
    const stop = () => { if (timer) { clearInterval(timer); timer = undefined; } };
    start(); const sub = AppState.addEventListener("change", (state) => { if (state === "active") void recheck(); else stop(); });
    return () => { stop(); sub.remove(); };
  }, [activeServer?.id, requiresPortalAccess, recheck, setAccess]);

  useEffect(() => {
    if (!paymentOpen || !order || !isPending(order.status)) return;
    const timer = setInterval(() => {
      void getPixOrder(order.id, order.mac).then(async (next) => {
        setOrder(next);
        if (["paid", "completed"].includes(next.status)) await recheck();
      }).catch(() => undefined);
    }, PIX_POLL_MS);
    return () => clearInterval(timer);
  }, [order, paymentOpen, recheck]);

  const verifyAgain = useCallback(async () => {
    setVerificationNote(null);
    await recheck();
    const snapshot = useAppStore.getState().accessControl.snapshot;
    if (snapshot?.state !== "granted") {
      setVerificationNote(snapshot?.message ?? "A verificação foi concluída, mas o acesso continua restrito.");
    }
  }, [recheck]);

  const returnToLogin = useCallback(() => {
    // Keep the saved connection intact, but clear the active code session first.
    // Otherwise this global gate would immediately cover the login route again.
    setPaymentOpen(false);
    setNotice(null);
    setVerificationNote(null);
    setActiveServer("");
    setAccess(null);
    router.replace("/login");
  }, [router, setAccess, setActiveServer]);

  const openPayment = useCallback(async () => {
    setPaymentError(null); setPaymentOpen(true);
    try { setConfig(await getPixConfig()); } catch (error) { setPaymentError(error instanceof Error ? error.message : "Não foi possível consultar o Pix."); }
  }, []);
  const issuePix = useCallback(async () => {
    const mac = access.snapshot?.macAddress; if (!mac) return;
    setIssuing(true); setPaymentError(null);
    try { setOrder(await createPixOrder({ mac, payerName, payerEmail, payerCpfCnpj: payerDocument, consent })); }
    catch (error) { setPaymentError(error instanceof Error ? error.message : "Não foi possível emitir o Pix."); }
    finally { setIssuing(false); }
  }, [access.snapshot?.macAddress, consent, payerDocument, payerEmail, payerName]);

  const blocked = access.isBlocked && access.snapshot;
  return <>
    {notice ? <View pointerEvents="none" style={styles.notice}><AppText style={styles.noticeText}>{notice}</AppText></View> : null}
    <Modal visible={!!blocked} transparent={false} animationType="fade" onRequestClose={returnToLogin}>
      <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.card}>
          <View style={styles.icon}><Ionicons name="lock-closed" size={28} color={Colors.blueBright} /></View>
          <AppText style={styles.title}>Acesso restrito</AppText>
          <AppText style={styles.copy}>{blocked.message ?? "Este dispositivo não está autorizado para este código."}</AppText>
          <View style={styles.info}><AppText style={styles.infoLabel}>MAC</AppText><AppText style={styles.infoValue}>{blocked.macAddress || "Não disponível"}</AppText><AppText style={styles.infoLabel}>LICENÇA</AppText><AppText style={styles.infoValue}>{blocked.licenseStatus ?? "Restrita"} · até {date(blocked.licenseUntil ?? blocked.accessUntil)}</AppText></View>
          {blocked.paymentRequired ? <TVFocusable accessibilityRole="button" onPress={() => void openPayment()} style={styles.primary}><Ionicons name="qr-code-outline" size={19} color={Colors.background} /><AppText style={styles.primaryText}>Gerar ou consultar Pix</AppText></TVFocusable> : <AppText style={styles.help}>Pagamento não libera dispositivos suspensos ou removidos. Procure o responsável.</AppText>}
          <TVFocusable accessibilityRole="button" disabled={checking} onPress={() => void verifyAgain()} style={styles.secondary}><Ionicons name="refresh" size={17} color={Colors.blueBright} /><AppText style={styles.secondaryText}>{checking ? "Verificando…" : "Verificar novamente"}</AppText></TVFocusable>
          {verificationNote ? <AppText style={styles.verifyNote}>{verificationNote}</AppText> : null}
          <TVFocusable accessibilityRole="button" onPress={returnToLogin} style={styles.back}><AppText style={styles.backText}>Voltar para login</AppText></TVFocusable>
        </View>
      </View>
    </Modal>
    <Modal visible={paymentOpen} transparent animationType="slide" onRequestClose={() => setPaymentOpen(false)}>
      <View style={styles.overlay}><View style={styles.paymentCard}>
        <AppText style={styles.title}>Pagamento Pix</AppText>
        {order ? <><AppText style={styles.copy}>Estado: {order.status} · {money(order.amountCents)}</AppText>
          {order.qrcodeBase64 ? <Image source={{ uri: `data:image/png;base64,${order.qrcodeBase64}` }} style={styles.qr} contentFit="contain" /> : null}
          <AppText selectable style={styles.emv}>{order.emv ?? "Código Pix ainda não disponível"}</AppText>
          <AppText style={styles.help}>MAC: {order.mac} · Vencimento: {date(order.expiresAt ?? order.dueDate)}</AppText>
          {access.snapshot?.state === "granted" ? <TVFocusable onPress={() => setPaymentOpen(false)} style={styles.primary}><AppText style={styles.primaryText}>Continuar</AppText></TVFocusable> : <TVFocusable onPress={() => void recheck()} style={styles.secondary}><AppText style={styles.secondaryText}>Já paguei, verificar acesso</AppText></TVFocusable>}</> : <>
          <AppText style={styles.copy}>{config?.enabled ? `Valor anual: ${money(config.amountCents)}` : "Consultando disponibilidade do Pix…"}</AppText>
          <TextInput value={payerName} onChangeText={setPayerName} placeholder="Nome completo" placeholderTextColor={Colors.subtle} style={styles.input} /><TextInput value={payerEmail} onChangeText={setPayerEmail} placeholder="E-mail" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={Colors.subtle} style={styles.input} /><TextInput value={payerDocument} onChangeText={setPayerDocument} placeholder="CPF ou CNPJ" keyboardType="numeric" placeholderTextColor={Colors.subtle} style={styles.input} />
          <TVFocusable onPress={() => setConsent((value) => !value)} style={styles.consent}><Ionicons name={consent ? "checkbox" : "square-outline"} size={20} color={Colors.blueBright} /><AppText style={styles.help}>Autorizo o envio destes dados à PagHiper para emitir o Pix.</AppText></TVFocusable>
          {paymentError ? <AppText style={styles.error}>{paymentError}</AppText> : null}
          <TVFocusable disabled={!config?.enabled || !payerName || !payerEmail || !payerDocument || !consent || issuing} onPress={() => void issuePix()} style={styles.primary}><AppText style={styles.primaryText}>{issuing ? "Emitindo…" : "Gerar Pix"}</AppText></TVFocusable></>}
        <TVFocusable onPress={() => setPaymentOpen(false)} style={styles.back}><AppText style={styles.backText}>Fechar</AppText></TVFocusable>
      </View></View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({ screen:{ flex:1, backgroundColor:Colors.background, justifyContent:"center", paddingHorizontal:22 }, card:{ maxWidth:520, width:"100%", alignSelf:"center", alignItems:"center", gap:14, padding:28, borderRadius:Radii.large, backgroundColor:"#101827", borderWidth:1, borderColor:Colors.border }, icon:{ width:60,height:60,borderRadius:30,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(34,211,238,0.12)" }, title:{ fontSize:23,fontFamily:"Inter_700Bold",color:Colors.text,textAlign:"center" }, copy:{ fontSize:14,lineHeight:21,color:Colors.muted,textAlign:"center" }, info:{ width:"100%",gap:3,padding:14,borderRadius:12,backgroundColor:"rgba(255,255,255,0.05)" }, infoLabel:{ fontSize:10,letterSpacing:1,color:Colors.subtle },infoValue:{ fontSize:13,color:Colors.text,marginBottom:6 },primary:{ minHeight:50,width:"100%",borderRadius:13,backgroundColor:Colors.white,flexDirection:"row",gap:8,alignItems:"center",justifyContent:"center",paddingHorizontal:14 },primaryText:{ color:Colors.background,fontFamily:"Inter_700Bold",fontSize:14 },secondary:{ minHeight:46,width:"100%",borderRadius:13,borderWidth:1,borderColor:Colors.border,flexDirection:"row",gap:8,alignItems:"center",justifyContent:"center" },secondaryText:{ color:Colors.blueBright,fontFamily:"Inter_600SemiBold",fontSize:13 },back:{ padding:10 },backText:{ color:Colors.muted,fontSize:13 },help:{ color:Colors.muted,fontSize:12,lineHeight:17,textAlign:"center" },overlay:{ flex:1,backgroundColor:"rgba(0,0,0,0.72)",justifyContent:"center",padding:20 },paymentCard:{ maxWidth:520,width:"100%",alignSelf:"center",gap:12,padding:24,borderRadius:Radii.large,backgroundColor:Colors.background },input:{ minHeight:48,borderWidth:1,borderColor:Colors.border,borderRadius:11,color:Colors.text,paddingHorizontal:12 },consent:{ flexDirection:"row",gap:9,alignItems:"flex-start",paddingVertical:4 },qr:{ width:210,height:210,alignSelf:"center",backgroundColor:Colors.white },emv:{ color:Colors.blueBright,fontSize:11,textAlign:"center" },error:{ color:Colors.red,fontSize:12,textAlign:"center" },notice:{ position:"absolute",top:58,left:18,right:18,zIndex:30,padding:12,borderRadius:10,backgroundColor:"#5b4520" },noticeText:{ color:Colors.white,fontSize:12,textAlign:"center" },verifyNote:{ color:Colors.muted,fontSize:11,lineHeight:16,textAlign:"center" } });
