import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Animated, BackHandler, Easing, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/ui";
import { PORTAL_ORIGIN } from "@/constants/portal";
import { tr } from "@/core/i18n";
import { logTechnicalError } from "@/services/security/sanitize";
import { tf, TV, TvEyebrow } from "@/features/tv/tv-kit";
import type { ConnectProgress, ConnectPhase, TvLoginMethod } from "@/features/login/tv-login-form";

/**
 * Login do celular e do tablet por código do servidor e por Xtream (Host),
 * no desenho do canvas "ELVANOQ Play" (telas M1 e M2). A tela de ativação
 * (escolha do método) continua a mesma; esta é a tela que vem depois dela.
 */

type Field = "code" | "host" | "username" | "password" | null;

type Props = {
  method: TvLoginMethod;
  onMethod: (method: TvLoginMethod) => void;
  serverCode: string;
  onServerCode: (value: string) => void;
  host: string;
  onHost: (value: string) => void;
  username: string;
  onUsername: (value: string) => void;
  password: string;
  onPassword: (value: string) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
  loading: boolean;
  progress: ConnectProgress;
  onConnect: () => void;
  onCancel: () => void;
  onBack: () => void;
  savedCount: number;
  onOpenSaved: () => void;
  refs: {
    code: RefObject<TextInput | null>;
    host: RefObject<TextInput | null>;
    username: RefObject<TextInput | null>;
    password: RefObject<TextInput | null>;
  };
};

const WORDMARK = require("@/assets/images/brand/ELVANOQ_wordmark_white_transparent.png");
const BACKDROP = require("@/assets/images/brand/ELVANOQ_login_mobile_backdrop_v5.jpg");
const PHASE_PERCENT: Record<ConnectPhase, number> = { idle: 0, server: 25, account: 55, catalog: 80 };

export function MobileLoginForm(props: Props) {
  const { method, loading, progress } = props;
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState<Field>(null);
  const code = method === "xtream-code";
  const percent = PHASE_PERCENT[progress.phase];

  // Voltar do Android: cancela a conexão ou volta à ativação.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (loading) props.onCancel();
      else props.onBack();
      return true;
    });
    return () => sub.remove();
  }, [loading, props]);

  const field = (name: Exclude<Field, null>) => ({
    focused: focused === name,
    onFocus: () => setFocused(name),
    onBlur: () => setFocused((current) => (current === name ? null : current)),
  });

  const openPortal = () => {
    void Linking.openURL(`${PORTAL_ORIGIN}/adicionar-lista/`).catch((error) => logTechnicalError("Login/openPortal", error));
  };

  return (
    <View style={styles.screen}>
      <Image source={BACKDROP} contentFit="cover" contentPosition="top" style={StyleSheet.absoluteFill} />
      <View style={styles.veil} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
        >
          <View style={styles.column}>
            <View style={styles.header}>
              <Image source={WORDMARK} contentFit="contain" contentPosition="left" accessibilityLabel="ELVANOQ Play" style={styles.logo} />
              {loading ? (
                <Pressable accessibilityRole="button" onPress={props.onCancel} hitSlop={12} style={styles.cancel}>
                  <AppText style={styles.cancelText}>Cancelar</AppText>
                </Pressable>
              ) : props.savedCount > 0 ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Abrir listas salvas" onPress={props.onOpenSaved} style={({ pressed }) => [styles.savedPill, pressed && styles.pressed]}>
                  <Ionicons name="list" size={15} color={TV.accent} />
                  <AppText style={styles.savedPillText}>{tf("Listas salvas · {0}", props.savedCount)}</AppText>
                </Pressable>
              ) : null}
            </View>

            <TvEyebrow style={{ marginTop: code ? 32 : 26 }}>CONECTAR LISTA</TvEyebrow>
            <AppText style={styles.title}>{code ? "Entre com o código do seu servidor" : "Dados do servidor Xtream"}</AppText>
            {code ? <AppText style={styles.subtitle}>Use o código, o usuário e a senha que a sua revenda enviou.</AppText> : null}

            <View accessibilityRole="tablist" style={[styles.tabs, { marginTop: code ? 22 : 18 }, loading && { opacity: 0.6 }]}>
              <Tab label="Código do servidor" active={code} disabled={loading} onPress={() => props.onMethod("xtream-code")} />
              <Tab label="Xtream por Host" active={!code} disabled={loading} onPress={() => props.onMethod("xtream")} />
            </View>

            {code ? (
              <View style={styles.fieldsCode}>
                <Input {...field("code")} inputRef={props.refs.code} icon="key-outline" label="CÓDIGO DO SERVIDOR" value={props.serverCode} onChangeText={props.onServerCode} placeholder="Ex.: pfast" strong editable={!loading} onSubmitEditing={() => props.refs.username.current?.focus()} />
                <Input {...field("username")} inputRef={props.refs.username} icon="person-outline" label="USUÁRIO" value={props.username} onChangeText={props.onUsername} placeholder="Seu usuário" editable={!loading} onSubmitEditing={() => props.refs.password.current?.focus()} />
                <Input {...field("password")} inputRef={props.refs.password} icon="lock-closed-outline" label="SENHA" value={props.password} onChangeText={props.onPassword} placeholder="Sua senha" secure={!props.showPassword} editable={!loading} onSubmitEditing={props.onConnect}
                  trailing={<EyeButton shown={props.showPassword} onPress={props.onTogglePassword} />} />
                <ConnectButton loading={loading} percent={percent} onPress={props.onConnect} />
              </View>
            ) : (
              <View style={styles.fieldsHost}>
                <Input {...field("host")} inputRef={props.refs.host} label="SERVIDOR" value={props.host} onChangeText={props.onHost} placeholder="Ex.: http://servidor.com:8080" compact keyboardType="url" editable={!loading} onSubmitEditing={() => props.refs.username.current?.focus()}
                  trailing={<ProtocolChip host={props.host} />} />
                <View style={styles.pair}>
                  <Input {...field("username")} inputRef={props.refs.username} label="USUÁRIO" value={props.username} onChangeText={props.onUsername} placeholder="Seu usuário" compact style={styles.half} editable={!loading} onSubmitEditing={() => props.refs.password.current?.focus()} />
                  <Input {...field("password")} inputRef={props.refs.password} label="SENHA" value={props.password} onChangeText={props.onPassword} placeholder="Sua senha" secure={!props.showPassword} compact style={styles.half} editable={!loading} onSubmitEditing={props.onConnect} />
                </View>
                <ConnectButton loading={loading} percent={percent} onPress={props.onConnect} />
              </View>
            )}

            {loading ? (
              <StepsCard progress={progress} />
            ) : code ? (
              <Pressable accessibilityRole="link" accessibilityLabel="Cadastrar pelo Portal" onPress={openPortal} style={({ pressed }) => [styles.portalCard, pressed && styles.pressed]}>
                <View style={styles.portalIcon}><Ionicons name="open-outline" size={20} color={TV.accent} /></View>
                <View style={styles.portalText}>
                  <AppText style={styles.portalTitle}>Cadastrar pelo Portal</AppText>
                  <AppText style={styles.portalBody}>A lista aparece sozinha em Listas salvas.</AppText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={TV.dim} />
              </Pressable>
            ) : null}

            <View style={styles.footer}>
              {loading ? (
                <AppText style={styles.footerText}>Se algo falhar, o app mostra o motivo e o que fazer.</AppText>
              ) : (
                <>
                  <Ionicons name="lock-closed-outline" size={13} color={TV.dim} />
                  <AppText style={styles.footerText}>Os dados ficam só neste aparelho</AppText>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Tab({ label, active, disabled, onPress }: { label: string; active: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} disabled={disabled} onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <AppText style={[styles.tabText, active && styles.tabTextActive]}>{label}</AppText>
    </Pressable>
  );
}

type InputProps = {
  inputRef: RefObject<TextInput | null>;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  secure?: boolean;
  strong?: boolean;
  compact?: boolean;
  editable?: boolean;
  keyboardType?: "default" | "url";
  trailing?: ReactNode;
  onSubmitEditing?: () => void;
  style?: StyleProp<ViewStyle>;
};

function Input({ inputRef, icon, label, value, onChangeText, placeholder, focused, onFocus, onBlur, secure, strong, compact, editable = true, keyboardType, trailing, onSubmitEditing, style }: InputProps) {
  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={[compact ? styles.inputCompact : styles.input, focused && styles.inputFocused, style]}>
      {icon ? <Ionicons name={icon} size={20} color={focused ? TV.accent : TV.dim} /> : null}
      <View style={styles.inputBody}>
        <AppText style={styles.inputLabel}>{label}</AppText>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={tr(placeholder)}
          placeholderTextColor={TV.dim}
          secureTextEntry={secure}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
          keyboardType={keyboardType === "url" ? "url" : "default"}
          returnKeyType="next"
          onSubmitEditing={onSubmitEditing}
          onFocus={onFocus}
          onBlur={onBlur}
          accessibilityLabel={label}
          style={[styles.inputText, strong && styles.inputStrong, compact && styles.inputTextCompact]}
        />
      </View>
      {trailing}
    </Pressable>
  );
}

function EyeButton({ shown, onPress }: { shown: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={shown ? "Ocultar senha" : "Mostrar senha"} onPress={onPress} hitSlop={6} style={styles.eye}>
      <Ionicons name={shown ? "eye-off-outline" : "eye-outline"} size={20} color={TV.muted} />
    </Pressable>
  );
}

function ProtocolChip({ host }: { host: string }) {
  const value = host.trim().toLowerCase();
  if (!value) return null;
  const https = value.startsWith("https://");
  return (
    <View style={[styles.proto, !https && styles.protoPlain]}>
      <AppText style={[styles.protoText, !https && { color: TV.muted }]}>{https ? "HTTPS" : "HTTP"}</AppText>
    </View>
  );
}

function ConnectButton({ loading, percent, onPress }: { loading: boolean; percent: number; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Conectar" accessibilityState={{ busy: loading }} disabled={loading} onPress={onPress} style={({ pressed }) => [styles.connect, loading && styles.connectBusy, pressed && styles.pressed]}>
      {loading ? (
        <>
          <View style={[styles.connectFill, { width: `${percent}%` }]} />
          <AppText style={styles.connectBusyText}>{tf("Conectando… {0}%", percent)}</AppText>
        </>
      ) : (
        <>
          <AppText style={styles.connectText}>Conectar</AppText>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </>
      )}
    </Pressable>
  );
}

type StepState = "done" | "active" | "pending";

function StepsCard({ progress }: { progress: ConnectProgress }) {
  const order: ConnectPhase[] = ["server", "account", "catalog"];
  const at = order.indexOf(progress.phase);
  const state = (index: number): StepState => (at < 0 ? "pending" : index < at ? "done" : index === at ? "active" : "pending");
  const seconds = progress.serverMs != null ? (progress.serverMs / 1000).toFixed(1).replace(".", ",") : null;
  const expiry = progress.expiry && progress.expiry !== "Ilimitado" && progress.expiry !== "Não informado"
    ? tf("Vence em {0}", progress.expiry)
    : progress.expiry === "Ilimitado" ? tr("Sem vencimento") : "";
  const screens = progress.screens ? tf(progress.screens === 1 ? "{0} tela" : "{0} telas", progress.screens) : "";
  const accountDetail = [expiry, screens].filter(Boolean).join(" · ");
  return (
    <View style={styles.steps}>
      <View style={styles.stepsHead}>
        <TvEyebrow>CONEXÃO</TvEyebrow>
        <AppText style={styles.stepsTitle}>Preparando sua lista</AppText>
      </View>
      <Step state={state(0)} title="Servidor encontrado" detail={state(0) === "done" && seconds ? tf("Respondeu em {0} s", seconds) : state(0) === "active" ? "Procurando o servidor…" : ""} />
      <Step state={state(1)} title="Conta ativa" detail={state(1) === "done" ? accountDetail : state(1) === "active" ? "Conferindo a conta…" : ""} />
      <Step state={state(2)} title="Carregando o catálogo" detail={state(2) === "active" ? "Canais, filmes e séries" : ""} bar={state(2) === "active"} />
      <Step state="pending" title="Abrir o Início" />
    </View>
  );
}

function Step({ state, title, detail, bar }: { state: StepState; title: string; detail?: string; bar?: boolean }) {
  return (
    <View style={styles.step}>
      {state === "done" ? (
        <View style={styles.stepDone}><Ionicons name="checkmark" size={14} color={TV.bg} /></View>
      ) : state === "active" ? (
        <View style={styles.stepActive}><View style={styles.stepDot} /></View>
      ) : (
        <View style={styles.stepPending} />
      )}
      <View style={styles.stepBody}>
        <AppText style={[styles.stepTitle, state === "pending" && { color: TV.muted }]}>{title}</AppText>
        {detail ? <AppText style={styles.stepDetail}>{detail}</AppText> : null}
        {bar ? <LoadingBar /> : null}
      </View>
    </View>
  );
}

function LoadingBar() {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [x]);
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-110, 300] }) }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg },
  flex: { flex: 1 },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(7, 11, 20, 0.88)" },
  content: { flexGrow: 1, paddingHorizontal: 20, alignItems: "center" },
  column: { flex: 1, width: "100%", maxWidth: 480 },
  header: { height: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { width: 78, height: 26 },
  savedPill: { height: 32, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: TV.field, borderWidth: 1, borderColor: "rgba(136, 148, 168, 0.3)" },
  savedPillText: { fontFamily: TV.semi, fontSize: 13, color: TV.text },
  cancel: { height: 32, justifyContent: "center" },
  cancelText: { fontFamily: TV.regular, fontSize: 13, color: TV.muted },
  title: { marginTop: 8, fontFamily: TV.bold, fontSize: 30, lineHeight: 35, letterSpacing: -0.6, color: TV.text },
  subtitle: { marginTop: 8, fontFamily: TV.regular, fontSize: 15, lineHeight: 22, color: TV.muted },
  tabs: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 14, backgroundColor: TV.field },
  tab: { flex: 1, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: TV.text },
  tabText: { fontFamily: TV.medium, fontSize: 14, color: TV.muted },
  tabTextActive: { fontFamily: TV.semi, color: TV.bg },
  fieldsCode: { gap: 10, marginTop: 18 },
  fieldsHost: { gap: 8, marginTop: 16 },
  pair: { flexDirection: "row", gap: 8 },
  half: { flex: 1 },
  input: { height: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: "transparent", backgroundColor: TV.field },
  inputCompact: { height: 56, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: "transparent", backgroundColor: TV.field },
  inputFocused: { backgroundColor: TV.surfaceHigh, borderColor: TV.accent },
  inputBody: { flex: 1, gap: 2 },
  inputLabel: { fontFamily: TV.semi, fontSize: 10, lineHeight: 13, letterSpacing: 1, color: TV.muted },
  inputText: { padding: 0, margin: 0, fontFamily: TV.regular, fontSize: 16, lineHeight: 21, color: TV.text },
  inputStrong: { fontFamily: TV.semi, fontSize: 17 },
  inputTextCompact: { fontFamily: TV.medium, fontSize: 15, lineHeight: 20 },
  eye: { width: 44, height: 44, marginRight: -8, alignItems: "center", justifyContent: "center" },
  proto: { paddingVertical: 4, paddingHorizontal: 7, borderRadius: 6, backgroundColor: "rgba(22, 199, 132, 0.12)" },
  protoPlain: { backgroundColor: "rgba(136, 148, 168, 0.14)" },
  protoText: { fontFamily: TV.bold, fontSize: 10, letterSpacing: 0.6, color: TV.success },
  connect: { height: 54, marginTop: 6, borderRadius: 14, backgroundColor: TV.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, overflow: "hidden" },
  connectBusy: { backgroundColor: TV.surfaceHigh, borderWidth: 1.5, borderColor: TV.primary },
  connectFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "rgba(20, 125, 255, 0.35)" },
  connectText: { fontFamily: TV.bold, fontSize: 16, color: "#FFFFFF" },
  connectBusyText: { fontFamily: TV.bold, fontSize: 15, color: TV.text },
  portalCard: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: TV.card, borderWidth: 1, borderColor: TV.cardBorder },
  portalIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(0, 215, 255, 0.14)", alignItems: "center", justifyContent: "center" },
  portalText: { flex: 1, gap: 2 },
  portalTitle: { fontFamily: TV.semi, fontSize: 14, color: TV.text },
  portalBody: { fontFamily: TV.regular, fontSize: 12, lineHeight: 16, color: TV.muted },
  steps: { marginTop: 16, gap: 12, padding: 18, borderRadius: 18, backgroundColor: "rgba(13, 20, 34, 0.94)", borderWidth: 1, borderColor: TV.cardBorder },
  stepsHead: { gap: 4, marginBottom: 2 },
  stepsTitle: { fontFamily: TV.bold, fontSize: 18, color: TV.text },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepDone: { width: 24, height: 24, borderRadius: 12, backgroundColor: TV.success, alignItems: "center", justifyContent: "center" },
  stepActive: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: TV.primary, alignItems: "center", justifyContent: "center" },
  stepDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: TV.primary },
  stepPending: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "rgba(136, 148, 168, 0.4)" },
  stepBody: { flex: 1, gap: 1, minHeight: 24, justifyContent: "center" },
  stepTitle: { fontFamily: TV.semi, fontSize: 14, color: TV.text },
  stepDetail: { fontFamily: TV.regular, fontSize: 12, color: TV.muted },
  bar: { marginTop: 5, height: 4, borderRadius: 2, backgroundColor: "rgba(136, 148, 168, 0.22)", overflow: "hidden" },
  barFill: { width: 110, height: 4, borderRadius: 2, backgroundColor: TV.primary },
  footer: { marginTop: "auto", paddingTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  footerText: { fontFamily: TV.regular, fontSize: 12, color: TV.muted, textAlign: "center" },
  pressed: { opacity: 0.8 },
});
