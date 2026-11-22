import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Animated, BackHandler, Easing, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { TVFocusable, type TVFocusableHandle } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { PORTAL_ORIGIN } from "@/constants/portal";
import { tr } from "@/core/i18n";
import type { DeviceIdentity } from "@/services/device/deviceIdentity";
import { FocusHalo, kit, tf, TV, TV_BACKDROP, TvEyebrow, TvHeader, TvKeyHint } from "@/features/tv/tv-kit";

/**
 * Login da TV por código do servidor e por Xtream (Host), no desenho do
 * canvas "ELVANOQ Play TV" (telas 1 e 2). A tela de ativação (escolha do
 * método) continua a mesma; esta é a tela que vem depois dela.
 */

export type TvLoginMethod = "xtream-code" | "xtream";
export type ConnectPhase = "idle" | "server" | "account" | "catalog";
export type ConnectProgress = {
  phase: ConnectPhase;
  /** Tempo de resposta do servidor, em ms. */
  serverMs?: number;
  /** Vencimento já formatado ("10/12/2026") ou "Ilimitado". */
  expiry?: string | null;
  screens?: number | null;
};

type Field = "code" | "host" | "username" | "password" | "listName" | null;

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
  listName: string;
  onListName: (value: string) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
  loading: boolean;
  progress: ConnectProgress;
  onConnect: () => void;
  onCancel: () => void;
  onBack: () => void;
  savedCount: number;
  onOpenSaved: () => void;
  identity: DeviceIdentity | null;
  refs: {
    code: RefObject<TextInput | null>;
    host: RefObject<TextInput | null>;
    username: RefObject<TextInput | null>;
    password: RefObject<TextInput | null>;
    listName: RefObject<TextInput | null>;
    connect: RefObject<TVFocusableHandle | null>;
  };
};

const PORTAL_QR = require("@/assets/images/brand/ELVANOQ_portal_qr.png");
const PORTAL_FORM = `${PORTAL_ORIGIN.replace(/^https?:\/\//, "")}/adicionar-lista`;
const PHASE_PERCENT: Record<ConnectPhase, number> = { idle: 0, server: 25, account: 55, catalog: 80 };

export function TvLoginForm(props: Props) {
  const { method, loading, progress } = props;
  const [focused, setFocused] = useState<Field>(null);
  const code = method === "xtream-code";

  // Voltar: cancela a conexão em andamento ou volta à ativação.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (loading) props.onCancel();
      else props.onBack();
      return true;
    });
    return () => sub.remove();
  }, [loading, props]);

  const percent = PHASE_PERCENT[progress.phase];
  const fieldProps = (name: Exclude<Field, null>) => ({
    focused: focused === name,
    onFocus: () => setFocused(name),
    onBlur: () => setFocused((current) => (current === name ? null : current)),
  });

  return (
    <View style={styles.screen}>
      <Image source={TV_BACKDROP} contentFit="cover" style={StyleSheet.absoluteFill} />
      <View style={styles.veil} />
      <View style={styles.page}>
        <TvHeader />

        <View style={styles.columns}>
          <View style={styles.left}>
            <TvEyebrow>CONECTAR LISTA</TvEyebrow>
            <AppText style={styles.title}>{code ? "Entre com o código\ndo seu servidor" : "Dados do servidor\nXtream"}</AppText>
            {code ? <AppText style={styles.subtitle}>Use o código, o usuário e a senha que a sua revenda enviou.</AppText> : null}

            <View accessibilityRole="tablist" style={[styles.tabs, { marginTop: code ? 20 : 18 }]}>
              <Tab label="Código do servidor" active={code} onPress={() => props.onMethod("xtream-code")} disabled={loading} />
              <Tab label="Xtream por Host" active={!code} onPress={() => props.onMethod("xtream")} disabled={loading} />
            </View>

            {code ? (
              <View style={styles.fieldsCode}>
                <TvField
                  {...fieldProps("code")}
                  inputRef={props.refs.code}
                  icon="key-outline"
                  label="CÓDIGO DO SERVIDOR"
                  value={props.serverCode}
                  onChangeText={props.onServerCode}
                  placeholder="Ex.: pfast"
                  strong
                  hasTVPreferredFocus
                  onSubmitEditing={() => props.refs.username.current?.focus()}
                  trailing={focused === "code" ? <View style={styles.okChip}><AppText style={styles.okChipText}>OK para editar</AppText></View> : null}
                />
                <TvField
                  {...fieldProps("username")}
                  inputRef={props.refs.username}
                  icon="person-outline"
                  label="USUÁRIO"
                  value={props.username}
                  onChangeText={props.onUsername}
                  placeholder="Seu usuário"
                  onSubmitEditing={() => props.refs.password.current?.focus()}
                />
                <TvField
                  {...fieldProps("password")}
                  inputRef={props.refs.password}
                  icon="lock-closed-outline"
                  label="SENHA"
                  value={props.password}
                  onChangeText={props.onPassword}
                  placeholder="Sua senha"
                  secure={!props.showPassword}
                  onSubmitEditing={props.onConnect}
                  trailing={<ShowPassword shown={props.showPassword} onPress={props.onTogglePassword} />}
                />
                <ConnectButton {...props} percent={percent} />
              </View>
            ) : (
              <View style={styles.fieldsHost}>
                <TvField
                  {...fieldProps("host")}
                  inputRef={props.refs.host}
                  icon="globe-outline"
                  label="SERVIDOR"
                  value={props.host}
                  onChangeText={props.onHost}
                  placeholder="Ex.: http://servidor.com:8080"
                  compact
                  hasTVPreferredFocus
                  keyboardType="url"
                  onSubmitEditing={() => props.refs.username.current?.focus()}
                  trailing={<ProtocolChip host={props.host} />}
                />
                <View style={styles.pair}>
                  <TvField
                    {...fieldProps("username")}
                    inputRef={props.refs.username}
                    label="USUÁRIO"
                    value={props.username}
                    onChangeText={props.onUsername}
                    placeholder="Seu usuário"
                    compact
                    style={styles.half}
                    onSubmitEditing={() => props.refs.password.current?.focus()}
                  />
                  <TvField
                    {...fieldProps("password")}
                    inputRef={props.refs.password}
                    label="SENHA"
                    value={props.password}
                    onChangeText={props.onPassword}
                    placeholder="Sua senha"
                    secure={!props.showPassword}
                    compact
                    style={styles.half}
                    onSubmitEditing={() => props.refs.listName.current?.focus()}
                  />
                </View>
                <TvField
                  {...fieldProps("listName")}
                  inputRef={props.refs.listName}
                  label="NOME DA LISTA"
                  note="· opcional"
                  value={props.listName}
                  onChangeText={props.onListName}
                  placeholder="Minha lista"
                  compact
                  onSubmitEditing={props.onConnect}
                />
                <ConnectButton {...props} percent={percent} />
              </View>
            )}
          </View>

          <View style={styles.aside}>
            {code && !loading
              ? <PhoneCard identity={props.identity} />
              : <StepsCard progress={progress} loading={loading} />}
          </View>
        </View>

        <View style={styles.footer}>
          {loading ? (
            <TvKeyHint keyLabel="Voltar" label="Cancelar" />
          ) : (
            <>
              <TvKeyHint keyLabel="OK" label="Editar campo" />
              <TvKeyHint keyLabel="▲ ▼" label="Próximo campo" />
              <TvKeyHint keyLabel="Voltar" label="Ativação" />
            </>
          )}
          <View style={styles.footerRight}>
            {loading || props.savedCount === 0 ? (
              <AppText style={kit.hintText}>Os dados ficam só neste aparelho</AppText>
            ) : (
              <>
                <AppText style={kit.hintText}>{props.savedCount === 1 ? tr("1 lista salva") : tf("{0} listas salvas", props.savedCount)}  ·  </AppText>
                <TVFocusable accessibilityRole="link" accessibilityLabel="Abrir listas salvas" onPress={props.onOpenSaved} style={styles.footerLink} focusStyle={kit.ringFocus}>
                  <AppText style={styles.footerLinkText}>Abrir</AppText>
                </TVFocusable>
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function Tab({ label, active, onPress, disabled }: { label: string; active: boolean; onPress: () => void; disabled: boolean }) {
  return (
    <TVFocusable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
      focusStyle={[kit.ringFocus, !active && { backgroundColor: TV.surfaceHigh }]}
    >
      <AppText style={[styles.tabText, active && styles.tabTextActive]}>{label}</AppText>
    </TVFocusable>
  );
}

type FieldProps = {
  inputRef: RefObject<TextInput | null>;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  note?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  secure?: boolean;
  strong?: boolean;
  compact?: boolean;
  trailing?: ReactNode;
  hasTVPreferredFocus?: boolean;
  keyboardType?: "default" | "url";
  onSubmitEditing?: () => void;
  style?: StyleProp<ViewStyle>;
};

function TvField({ inputRef, icon, label, note, value, onChangeText, placeholder, focused, onFocus, onBlur, secure, strong, compact, trailing, hasTVPreferredFocus, keyboardType, onSubmitEditing, style }: FieldProps) {
  return (
    <View style={[compact ? styles.fieldCompact : styles.field, focused ? styles.fieldFocused : null, style]}>
      {focused ? <FocusHalo radius={10} /> : null}
      {icon ? <Ionicons name={icon} size={15} color={focused ? TV.accent : TV.dim} /> : null}
      <View style={styles.fieldBody}>
        <AppText style={styles.fieldLabel}>
          {label}{note ? <AppText style={styles.fieldNote}> {note}</AppText> : null}
        </AppText>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={tr(placeholder)}
          placeholderTextColor={TV.dim}
          secureTextEntry={secure}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={keyboardType === "url" ? "url" : "default"}
          returnKeyType="next"
          onSubmitEditing={onSubmitEditing}
          onFocus={onFocus}
          onBlur={onBlur}
          {...(hasTVPreferredFocus ? { hasTVPreferredFocus: true } : {})}
          accessibilityLabel={label}
          style={[styles.input, strong && styles.inputStrong, compact && styles.inputCompact]}
        />
      </View>
      {trailing}
    </View>
  );
}

function ShowPassword({ shown, onPress }: { shown: boolean; onPress: () => void }) {
  return (
    <TVFocusable accessibilityRole="button" accessibilityLabel={shown ? "Ocultar senha" : "Mostrar senha"} onPress={onPress} style={styles.showBtn} focusStyle={kit.ringFocus}>
      <Ionicons name={shown ? "eye-off-outline" : "eye-outline"} size={12} color={TV.muted} />
      <AppText style={styles.showText}>{shown ? "Ocultar" : "Mostrar"}</AppText>
    </TVFocusable>
  );
}

function ProtocolChip({ host }: { host: string }) {
  const value = host.trim().toLowerCase();
  if (!value) return null;
  const https = value.startsWith("https://");
  return (
    <View style={[styles.protoChip, !https && styles.protoChipPlain]}>
      <AppText style={[styles.protoText, !https && styles.protoTextPlain]}>{https ? "HTTPS" : "HTTP"}</AppText>
    </View>
  );
}

function ConnectButton({ loading, onConnect, refs, percent }: Props & { percent: number }) {
  return (
    <TVFocusable
      ref={refs.connect}
      accessibilityRole="button"
      accessibilityLabel="Conectar"
      accessibilityState={{ busy: loading }}
      onPress={loading ? undefined : onConnect}
      style={[styles.connect, loading && styles.connectBusy]}
      focusStyle={loading ? null : styles.connectFocus}
    >
      {loading ? (
        <>
          <View style={[styles.connectFill, { width: `${percent}%` }]} />
          <AppText style={styles.connectBusyText}>{tf("Conectando… {0}%", percent)}</AppText>
        </>
      ) : (
        <>
          <AppText style={styles.connectText}>Conectar</AppText>
          <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
        </>
      )}
    </TVFocusable>
  );
}

function PhoneCard({ identity }: { identity: DeviceIdentity | null }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <TvEyebrow>MAIS RÁPIDO</TvEyebrow>
        <AppText style={styles.cardTitle}>Digite pelo celular</AppText>
        <AppText style={styles.cardBody}>Sem controle remoto: os dados chegam na TV e ela conecta sozinha.</AppText>
      </View>
      <View style={styles.phoneRow}>
        <View style={styles.qr}>
          <Image source={PORTAL_QR} contentFit="contain" accessibilityLabel={tf("QR code para {0}", PORTAL_FORM)} style={styles.qrImage} />
        </View>
        <View style={styles.phoneSteps}>
          {["Aponte a câmera", "Informe MAC e chave", "A TV conecta"].map((label, index) => (
            <View key={label} style={styles.phoneStep}>
              <View style={styles.stepBadge}><AppText style={styles.stepBadgeText}>{index + 1}</AppText></View>
              <AppText style={styles.phoneStepText}>{label}</AppText>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.cardFoot}>
        <View style={styles.cardFootRow}>
          <AppText style={styles.cardFootText}>{PORTAL_FORM}</AppText>
          <View style={styles.waiting}>
            <View style={styles.waitingDot} />
            <AppText style={styles.waitingText}>Aguardando</AppText>
          </View>
        </View>
        {identity ? (
          <AppText style={styles.identity}>
            MAC <AppText style={styles.identityValue}>{identity.macAddress}</AppText>
            {"   ·   "}Chave <AppText style={styles.identityValue}>{identity.deviceKey}</AppText>
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

type StepState = "done" | "active" | "pending";

function StepsCard({ progress, loading }: { progress: ConnectProgress; loading: boolean }) {
  const order: ConnectPhase[] = ["server", "account", "catalog"];
  const at = loading ? order.indexOf(progress.phase) : -1;
  const state = (index: number): StepState => (at < 0 ? "pending" : index < at ? "done" : index === at ? "active" : "pending");
  const seconds = progress.serverMs != null ? (progress.serverMs / 1000).toFixed(1).replace(".", ",") : null;
  const expiry = progress.expiry && progress.expiry !== "Ilimitado" && progress.expiry !== "Não informado"
    ? tf("Vence em {0}", progress.expiry)
    : progress.expiry === "Ilimitado" ? tr("Sem vencimento") : "";
  const screens = progress.screens ? tf(progress.screens === 1 ? "{0} tela" : "{0} telas", progress.screens) : "";
  const accountDetail = [expiry, screens].filter(Boolean).join(" · ");

  return (
    <View style={[styles.card, styles.stepsCard]}>
      <View style={styles.cardHead}>
        <TvEyebrow>CONEXÃO</TvEyebrow>
        <AppText style={styles.cardTitle}>{loading ? "Preparando sua lista" : "O que acontece ao conectar"}</AppText>
      </View>
      <View style={styles.steps}>
        <Step state={state(0)} title="Servidor encontrado" detail={state(0) === "done" && seconds ? tf("Respondeu em {0} s", seconds) : state(0) === "active" ? "Procurando o servidor…" : ""} />
        <Step state={state(1)} title="Conta ativa" detail={state(1) === "done" ? accountDetail : state(1) === "active" ? "Conferindo a conta…" : ""} />
        <Step state={state(2)} title="Carregando o catálogo" detail={state(2) === "active" ? "Canais, filmes e séries" : ""} bar={state(2) === "active"} />
        <Step state="pending" title="Abrir o Início" muted />
      </View>
      <AppText style={styles.stepsFoot}>Se algo falhar, a TV mostra o motivo e o que fazer.</AppText>
    </View>
  );
}

function Step({ state, title, detail, bar, muted }: { state: StepState; title: string; detail?: string; bar?: boolean; muted?: boolean }) {
  return (
    <View style={styles.step}>
      {state === "done" ? (
        <View style={styles.stepDone}><Ionicons name="checkmark" size={13} color={TV.bg} /></View>
      ) : state === "active" ? (
        <View style={styles.stepActive}><View style={styles.stepActiveDot} /></View>
      ) : (
        <View style={styles.stepPending} />
      )}
      <View style={styles.stepBody}>
        <AppText style={[styles.stepTitle, (muted || state === "pending") && { color: TV.muted }]}>{title}</AppText>
        {detail ? <AppText style={styles.stepDetail}>{detail}</AppText> : null}
        {bar ? <LoadingBar /> : null}
      </View>
    </View>
  );
}

/** Barra contínua enquanto o catálogo abre (o tempo depende da lista). */
function LoadingBar() {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [x]);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-90, 220] });
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, { transform: [{ translateX }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(7, 11, 20, 0.86)" },
  page: { flex: 1, paddingTop: TV.padTop, paddingHorizontal: TV.padX, paddingBottom: TV.padBottom },
  columns: { flex: 1, flexDirection: "row", gap: 48, marginTop: 28 },
  left: { width: 430 },
  title: { marginTop: 7, fontFamily: TV.bold, fontSize: 30, lineHeight: 34, letterSpacing: -0.6, color: TV.text },
  subtitle: { marginTop: 8, width: 380, fontFamily: TV.regular, fontSize: 12, lineHeight: 17, color: TV.muted },
  tabs: { flexDirection: "row", gap: 4, padding: 3, width: 280, borderRadius: 9, backgroundColor: "rgba(17, 27, 45, 0.8)" },
  tab: { flex: 1, height: 30, borderRadius: 6.5, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "transparent" },
  tabActive: { backgroundColor: TV.text },
  tabText: { fontFamily: TV.medium, fontSize: 11, color: TV.muted },
  tabTextActive: { fontFamily: TV.semi, color: TV.bg },
  fieldsCode: { gap: 9, marginTop: 16 },
  fieldsHost: { gap: 8, marginTop: 15 },
  pair: { flexDirection: "row", gap: 8 },
  half: { flex: 1 },
  field: { height: 48, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: "transparent", backgroundColor: TV.field },
  fieldCompact: { height: 44, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1.5, borderColor: "transparent", backgroundColor: TV.field },
  fieldFocused: { backgroundColor: TV.surfaceHigh, borderColor: TV.ring },
  fieldBody: { flex: 1, gap: 2 },
  fieldLabel: { fontFamily: TV.semi, fontSize: 8.5, lineHeight: 11, letterSpacing: 0.8, color: TV.muted },
  fieldNote: { fontFamily: TV.medium, letterSpacing: 0.2 },
  input: { padding: 0, margin: 0, fontFamily: TV.regular, fontSize: 15, lineHeight: 19, color: TV.text },
  inputStrong: { fontFamily: TV.semi, fontSize: 16, lineHeight: 20 },
  inputCompact: { fontFamily: TV.medium, fontSize: 14.5, lineHeight: 18 },
  okChip: { paddingVertical: 4, paddingHorizontal: 7, borderRadius: 5, backgroundColor: TV.glow },
  okChipText: { fontFamily: TV.regular, fontSize: 9, lineHeight: 12, color: TV.muted },
  showBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 6, borderWidth: 1.5, borderColor: "transparent" },
  showText: { fontFamily: TV.regular, fontSize: 9.5, lineHeight: 13, color: TV.muted },
  protoChip: { paddingVertical: 3.5, paddingHorizontal: 6, borderRadius: 4.5, backgroundColor: "rgba(22, 199, 132, 0.12)" },
  protoChipPlain: { backgroundColor: "rgba(136, 148, 168, 0.14)" },
  protoText: { fontFamily: TV.bold, fontSize: 8.5, lineHeight: 11, letterSpacing: 0.5, color: TV.success },
  protoTextPlain: { color: TV.muted },
  connect: { height: 46, marginTop: 5, borderRadius: 10, backgroundColor: TV.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, overflow: "hidden", borderWidth: 1.5, borderColor: "transparent" },
  connectFocus: { borderColor: TV.ring, transform: [] },
  connectText: { fontFamily: TV.bold, fontSize: 14, color: "#FFFFFF" },
  connectBusy: { backgroundColor: TV.surfaceHigh, borderColor: TV.ring },
  connectFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "rgba(20, 125, 255, 0.35)" },
  connectBusyText: { fontFamily: TV.bold, fontSize: 13.5, color: TV.text },
  aside: { flex: 1, alignItems: "flex-end", justifyContent: "center" },
  card: { width: 310, borderRadius: 16, backgroundColor: TV.card, borderWidth: 0.5, borderColor: TV.cardBorder, padding: 24, gap: 15 },
  stepsCard: { gap: 17 },
  cardHead: { gap: 5 },
  cardTitle: { fontFamily: TV.bold, fontSize: 19, lineHeight: 23, letterSpacing: -0.3, color: TV.text },
  cardBody: { fontFamily: TV.regular, fontSize: 11, lineHeight: 16, color: TV.muted },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  qr: { width: 118, height: 118, borderRadius: 11, backgroundColor: "#FFFFFF", padding: 9, alignItems: "center", justifyContent: "center" },
  qrImage: { width: "100%", height: "100%" },
  phoneSteps: { gap: 11, flex: 1 },
  phoneStep: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0, 215, 255, 0.14)", alignItems: "center", justifyContent: "center" },
  stepBadgeText: { fontFamily: TV.bold, fontSize: 9.5, lineHeight: 12, color: TV.accent },
  phoneStepText: { flexShrink: 1, fontFamily: TV.regular, fontSize: 10.5, lineHeight: 14, color: TV.text },
  cardFoot: { paddingTop: 12, borderTopWidth: 0.5, borderTopColor: TV.divider, gap: 6 },
  cardFootRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardFootText: { fontFamily: TV.regular, fontSize: 10, lineHeight: 13, color: TV.muted },
  waiting: { flexDirection: "row", alignItems: "center", gap: 5 },
  waitingDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: TV.success },
  waitingText: { fontFamily: TV.regular, fontSize: 9.5, lineHeight: 13, color: TV.success },
  identity: { fontFamily: TV.regular, fontSize: 9.5, lineHeight: 13, color: TV.muted },
  identityValue: { fontFamily: TV.semi, color: TV.text },
  steps: { gap: 14 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepDone: { width: 22, height: 22, borderRadius: 11, backgroundColor: TV.success, alignItems: "center", justifyContent: "center" },
  stepActive: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: TV.primary, alignItems: "center", justifyContent: "center" },
  stepActiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: TV.primary },
  stepPending: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "rgba(136, 148, 168, 0.4)" },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: { fontFamily: TV.semi, fontSize: 12, lineHeight: 16, color: TV.text },
  stepDetail: { fontFamily: TV.regular, fontSize: 10, lineHeight: 14, color: TV.muted },
  bar: { marginTop: 3, width: 220, height: 4, borderRadius: 2, backgroundColor: "rgba(136, 148, 168, 0.22)", overflow: "hidden" },
  barFill: { width: 90, height: 4, borderRadius: 2, backgroundColor: TV.primary },
  stepsFoot: { paddingTop: 12, borderTopWidth: 0.5, borderTopColor: TV.divider, fontFamily: TV.regular, fontSize: 10, lineHeight: 15, color: TV.muted },
  footer: { height: 24, flexDirection: "row", alignItems: "center", gap: 20 },
  footerRight: { marginLeft: "auto", flexDirection: "row", alignItems: "center" },
  footerLink: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, borderWidth: 1.5, borderColor: "transparent" },
  footerLinkText: { fontFamily: TV.regular, fontSize: 9.5, lineHeight: 13, color: TV.accent },
});
