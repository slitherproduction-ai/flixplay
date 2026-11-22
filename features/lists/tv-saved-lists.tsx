import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Modal, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { TVFocusable, type TVFocusableHandle } from "@/components/tv-focusable";
import { AppText } from "@/components/ui";
import { tr } from "@/core/i18n";
import { maskUsername } from "@/features/login/loginValidation";
import { FocusHalo, kit, tf, TV, TvEyebrow, TvHeader, TvKeyHint } from "@/features/tv/tv-kit";
import type { ServerProfile } from "@/store/types";

/**
 * Listas salvas na TV (canvas "ELVANOQ Play TV", tela 3): um cartão por
 * lista com origem, usuário mascarado, situação (em uso, vence em, venceu) e,
 * no cartão em foco, as ações Usar, Atualizar, Renomear e Excluir.
 */
type Props = {
  servers: ServerProfile[];
  /** Última atualização do catálogo da lista em uso (ISO). */
  activeSyncedAt: string | null;
  onSelect: (server: ServerProfile) => void;
  onRefresh: (server: ServerProfile) => void;
  onRename: (server: ServerProfile, name: string) => void;
  onDelete: (id: string, name: string) => void;
  onAdd: () => void;
  onClose: () => void;
  onManagePortal: () => void;
  /** Só quando o aparelho ainda espera o vínculo com o Portal. */
  onLinkPortal?: () => void;
};

type Tone = "blue" | "teal" | "amber";
const TONES: Record<Tone, { bg: string; fg: string }> = {
  blue: { bg: "#0A2A66", fg: "#7FC0FF" },
  teal: { bg: "#0F3B3F", fg: "#4FE3F5" },
  amber: { bg: "#3A2A0B", fg: TV.warning },
};

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => /[A-Za-z0-9À-ÿ]/.test(word));
  const letters = words.length > 1
    ? `${words[0][0]}${words[words.length - 1][0]}`
    : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

function hasDate(value?: string | null): value is string {
  return Boolean(value && value !== "Ilimitado" && value !== "Não informado");
}

function isExpired(server: ServerProfile): boolean {
  if (String(server.status ?? "").toLowerCase() === "expired") return true;
  return typeof server.expiresAt === "number" && server.expiresAt > 0 && server.expiresAt < Date.now();
}

function origin(server: ServerProfile): string {
  if (server.portalManaged) return `${tr("Recebida do Portal")} · ${server.sourceType === "m3u" ? "M3U" : "Xtream"}`;
  const kind = server.sourceType === "xtream-code" ? tr("Código do servidor") : server.sourceType === "m3u" ? "M3U" : tr("Xtream por Host");
  return server.username ? `${kind} · ${maskUsername(server.username)}` : kind;
}

function updatedAgo(iso: string | null): string {
  const at = Date.parse(iso ?? "");
  if (!Number.isFinite(at)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (minutes < 2) return tr("Catálogo atualizado agora");
  if (minutes < 60) return tf("Catálogo atualizado há {0} min", minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return tf("Catálogo atualizado há {0} h", hours);
  const days = Math.round(hours / 24);
  return days === 1 ? tr("Catálogo atualizado há 1 dia") : tf("Catálogo atualizado há {0} dias", days);
}

export function TvSavedLists({ servers, activeSyncedAt, onSelect, onRefresh, onRename, onDelete, onAdd, onClose, onManagePortal, onLinkPortal }: Props) {
  const [within, setWithin] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<ServerProfile | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preferredId = (servers.find((server) => server.isActive) ?? servers[0])?.id;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { onClose(); return true; });
    return () => sub.remove();
  }, [onClose]);
  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  const enter = (id: string) => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setWithin(id);
  };
  const leave = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    // O foco passa do cartão para uma ação dele: espera o próximo foco.
    blurTimer.current = setTimeout(() => setWithin(null), 60);
  };

  const count = servers.length;
  const subtitle = count === 1
    ? tr("1 lista neste aparelho · a lista em uso abre direto no Início")
    : tf("{0} listas neste aparelho · a lista em uso abre direto no Início", count);

  return (
    <View style={styles.screen}>
      <View style={styles.page}>
        <TvHeader />
        <View style={styles.top}>
          <View style={styles.topText}>
            <TvEyebrow>SUAS LISTAS</TvEyebrow>
            <AppText style={styles.title}>Listas salvas</AppText>
            <AppText style={styles.subtitle}>{subtitle}</AppText>
          </View>
          <View style={styles.topActions}>
            {onLinkPortal ? <HeaderButton icon="key-outline" label="Vincular chave" onPress={onLinkPortal} /> : null}
            <HeaderButton icon="open-outline" label="Gerenciar no Portal" onPress={onManagePortal} />
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {servers.map((server) => (
            <ListCard
              key={server.id}
              server={server}
              open={within === server.id}
              preferred={server.id === preferredId}
              syncedAt={server.isActive ? activeSyncedAt : null}
              onEnter={enter(server.id)}
              onLeave={leave}
              onSelect={() => onSelect(server)}
              onRefresh={() => onRefresh(server)}
              onRename={() => setRenaming(server)}
              onDelete={() => onDelete(server.id, server.name)}
            />
          ))}
          <AddCard onPress={onAdd} preferred={!preferredId} />
        </ScrollView>

        <View style={styles.footer}>
          <TvKeyHint keyLabel="OK" label="Usar lista" />
          <TvKeyHint keyLabel="▼" label="Ações" />
          <TvKeyHint keyLabel="Voltar" label="Fechar" />
        </View>
      </View>

      <RenameDialog
        server={renaming}
        onCancel={() => setRenaming(null)}
        onSave={(name) => {
          if (renaming) onRename(renaming, name);
          setRenaming(null);
        }}
      />
    </View>
  );
}

function HeaderButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <TVFocusable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.headerBtn} focusStyle={[kit.ringFocus, { backgroundColor: TV.surfaceHigh }]}>
      <Ionicons name={icon} size={12} color={TV.accent} />
      <AppText style={styles.headerBtnText}>{label}</AppText>
    </TVFocusable>
  );
}

type CardProps = {
  server: ServerProfile;
  open: boolean;
  preferred: boolean;
  syncedAt: string | null;
  onEnter: () => void;
  onLeave: () => void;
  onSelect: () => void;
  onRefresh: () => void;
  onRename: () => void;
  onDelete: () => void;
};

function ListCard({ server, open, preferred, syncedAt, onEnter, onLeave, onSelect, onRefresh, onRename, onDelete }: CardProps) {
  const expired = isExpired(server);
  const tone: Tone = expired ? "amber" : server.portalManaged || server.sourceType === "m3u" ? "teal" : "blue";
  const colors = TONES[tone];
  const updated = useMemo(() => updatedAgo(syncedAt), [syncedAt]);
  const footnote = expired ? tr("Fale com a sua revenda para renovar") : server.isActive ? updated : "";

  return (
    <View style={styles.cell}>
      <View style={[styles.card, server.isActive && !open && styles.cardActive, open && styles.cardOpen]}>
        {open ? <FocusHalo radius={14} /> : null}
        <TVFocusable
          accessibilityRole="button"
          accessibilityLabel={tf(server.isActive ? "Lista {0}, em uso" : "Usar a lista {0}", server.name)}
          hasTVPreferredFocus={preferred}
          onPress={onSelect}
          onFocus={onEnter}
          onBlur={onLeave}
          style={styles.cardMain}
          focusStyle={styles.cardMainFocus}
        >
          <View style={styles.cardHead}>
            <View style={[styles.mono, { backgroundColor: colors.bg }]}>
              <AppText style={[styles.monoText, { color: colors.fg }]}>{initials(server.name)}</AppText>
            </View>
            <View style={styles.cardNames}>
              <AppText numberOfLines={1} style={styles.cardName}>{server.name}</AppText>
              <AppText numberOfLines={1} style={[styles.cardOrigin, open && { color: TV.soft }]}>{origin(server)}</AppText>
            </View>
          </View>
          <View style={styles.pills}>
            {server.isActive ? (
              <View style={[styles.pill, styles.pillUse]}>
                <View style={styles.pillDot} />
                <AppText style={[styles.pillText, styles.pillUseText]}>Em uso</AppText>
              </View>
            ) : null}
            {expired ? (
              <View style={[styles.pill, styles.pillWarn]}>
                <Ionicons name="alert-circle-outline" size={9} color={TV.warning} />
                <AppText style={[styles.pillText, styles.pillWarnText]}>{hasDate(server.expiryDate) ? tf("Venceu em {0}", server.expiryDate) : tr("Vencida")}</AppText>
              </View>
            ) : hasDate(server.expiryDate) ? (
              <View style={[styles.pill, open && { backgroundColor: "rgba(244, 248, 255, 0.1)" }]}>
                <AppText style={styles.pillText}>{tf("Vence em {0}", server.expiryDate)}</AppText>
              </View>
            ) : null}
          </View>
        </TVFocusable>

        {open ? (
          <View style={styles.cardActions}>
            <TVFocusable accessibilityRole="button" accessibilityLabel={server.isActive ? "Abrir lista" : "Usar esta lista"} onPress={onSelect} onFocus={onEnter} onBlur={onLeave} style={styles.useBtn} focusStyle={styles.useBtnFocus}>
              <AppText style={styles.useBtnText}>{server.isActive ? "Abrir lista" : "Usar esta lista"}</AppText>
            </TVFocusable>
            <IconAction icon="refresh" label="Atualizar catálogo" onPress={onRefresh} onFocus={onEnter} onBlur={onLeave} />
            <IconAction icon="create-outline" label="Renomear lista" onPress={onRename} onFocus={onEnter} onBlur={onLeave} />
            <IconAction icon="trash-outline" label="Excluir lista" onPress={onDelete} onFocus={onEnter} onBlur={onLeave} danger />
          </View>
        ) : footnote ? (
          <AppText numberOfLines={1} style={styles.footnote}>{footnote}</AppText>
        ) : null}
      </View>
    </View>
  );
}

function IconAction({ icon, label, onPress, onFocus, onBlur, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; onFocus: () => void; onBlur: () => void; danger?: boolean }) {
  return (
    <TVFocusable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      style={[styles.iconBtn, danger && styles.iconBtnDanger]}
      focusStyle={[kit.ringFocus, { backgroundColor: danger ? "rgba(255, 138, 138, 0.14)" : "rgba(244, 248, 255, 0.12)" }]}
    >
      <Ionicons name={icon} size={13} color={danger ? TV.danger : TV.text} />
    </TVFocusable>
  );
}

function AddCard({ onPress, preferred }: { onPress: () => void; preferred: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.cell}>
      <TVFocusable
        accessibilityRole="button"
        accessibilityLabel="Adicionar lista"
        hasTVPreferredFocus={preferred}
        onPress={onPress}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.addCard, focused && styles.addCardFocus]}
        focusStyle={{ transform: [] }}
      >
        <View style={styles.addIcon}><Ionicons name="add" size={18} color="#4FA3FF" /></View>
        <View style={styles.addText}>
          <AppText style={styles.addTitle}>Adicionar lista</AppText>
          <AppText style={styles.addSub}>Código, Host ou pelo celular</AppText>
        </View>
      </TVFocusable>
    </View>
  );
}

function RenameDialog({ server, onCancel, onSave }: { server: ServerProfile | null; onCancel: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  const [focused, setFocused] = useState(false);
  const saveRef = useRef<TVFocusableHandle>(null);
  useEffect(() => { setName(server?.name ?? ""); }, [server]);
  if (!server) return null;
  const clean = name.trim();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.renameOverlay}>
        <View style={styles.renameCard}>
          <TvEyebrow>RENOMEAR</TvEyebrow>
          <AppText style={styles.renameTitle}>Nome da lista</AppText>
          <View style={[styles.renameField, focused && styles.renameFieldFocus]}>
            {focused ? <FocusHalo radius={10} /> : null}
            <TextInput
              value={name}
              onChangeText={setName}
              autoFocus
              {...{ hasTVPreferredFocus: true }}
              maxLength={40}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={() => saveRef.current?.focus()}
              placeholder={tr("Minha lista")}
              placeholderTextColor={TV.dim}
              accessibilityLabel="Nome da lista"
              style={styles.renameInput}
            />
          </View>
          <View style={styles.renameActions}>
            <TVFocusable accessibilityRole="button" accessibilityLabel="Cancelar" onPress={onCancel} style={styles.renameCancel} focusStyle={[kit.ringFocus, { backgroundColor: TV.surfaceHigh }]}>
              <AppText style={styles.renameCancelText}>Cancelar</AppText>
            </TVFocusable>
            <TVFocusable ref={saveRef} accessibilityRole="button" accessibilityLabel="Salvar" disabled={!clean} onPress={() => onSave(clean)} style={[styles.renameSave, !clean && { opacity: 0.5 }]} focusStyle={kit.ringFocus}>
              <AppText style={styles.renameSaveText}>Salvar</AppText>
            </TVFocusable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg },
  page: { flex: 1, paddingTop: TV.padTop, paddingHorizontal: TV.padX, paddingBottom: TV.padBottom },
  top: { marginTop: 26, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  topText: { gap: 6 },
  title: { fontFamily: TV.bold, fontSize: 30, lineHeight: 34, letterSpacing: -0.6, color: TV.text },
  subtitle: { fontFamily: TV.regular, fontSize: 12, lineHeight: 17, color: TV.muted },
  topActions: { flexDirection: "row", gap: 8 },
  headerBtn: { height: 36, paddingHorizontal: 15, borderRadius: 9, borderWidth: 0.75, borderColor: "rgba(136, 148, 168, 0.35)", backgroundColor: TV.field, flexDirection: "row", alignItems: "center", gap: 6 },
  headerBtnText: { fontFamily: TV.semi, fontSize: 11, color: TV.text },
  scroll: { flex: 1, marginTop: 16, marginHorizontal: -8 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingTop: 6, paddingBottom: 12, rowGap: 16 },
  cell: { width: "33.333%", paddingHorizontal: 8, position: "relative" },
  card: { height: 164, borderRadius: 14, backgroundColor: TV.surface, borderWidth: 0.75, borderColor: "rgba(136, 148, 168, 0.18)", padding: 18 },
  cardMain: { gap: 11, borderWidth: 0, borderColor: "transparent" },
  cardMainFocus: { borderWidth: 0, transform: [] },
  cardActive: { borderColor: "rgba(22, 199, 132, 0.45)" },
  cardOpen: { backgroundColor: TV.surfaceHigh, borderWidth: 1.5, borderColor: TV.ring, padding: 17 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 11 },
  mono: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  monoText: { fontFamily: TV.bold, fontSize: 15 },
  cardNames: { flex: 1, gap: 4 },
  cardName: { fontFamily: TV.bold, fontSize: 15, lineHeight: 19, letterSpacing: -0.2, color: TV.text },
  cardOrigin: { fontFamily: TV.regular, fontSize: 10, lineHeight: 13, color: TV.muted },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 7, borderRadius: 5, backgroundColor: "rgba(136, 148, 168, 0.14)" },
  pillText: { fontFamily: TV.regular, fontSize: 9, lineHeight: 12, color: TV.soft },
  pillUse: { backgroundColor: "rgba(22, 199, 132, 0.12)" },
  pillUseText: { fontFamily: TV.semi, color: TV.success },
  pillDot: { width: 4.5, height: 4.5, borderRadius: 2.5, backgroundColor: TV.success },
  pillWarn: { backgroundColor: "rgba(245, 184, 61, 0.12)" },
  pillWarnText: { fontFamily: TV.semi, color: TV.warning },
  footnote: { marginTop: "auto", fontFamily: TV.regular, fontSize: 9.5, lineHeight: 14, color: TV.muted },
  cardActions: { marginTop: "auto", flexDirection: "row", gap: 6 },
  useBtn: { flex: 1, height: 32, borderRadius: 8, backgroundColor: TV.text, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: TV.text },
  useBtnFocus: { borderColor: TV.accent, transform: [] },
  useBtnText: { fontFamily: TV.bold, fontSize: 10.5, color: TV.bg },
  iconBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 0.75, borderColor: "rgba(244, 248, 255, 0.25)", alignItems: "center", justifyContent: "center" },
  iconBtnDanger: { borderColor: "rgba(255, 138, 138, 0.4)" },
  addCard: { height: 100, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(136, 148, 168, 0.4)", padding: 18, flexDirection: "row", alignItems: "center", gap: 12 },
  addCardFocus: { borderStyle: "solid", borderWidth: 1.5, borderColor: TV.ring, backgroundColor: TV.surfaceHigh },
  addIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(20, 125, 255, 0.16)", alignItems: "center", justifyContent: "center" },
  addText: { gap: 4 },
  addTitle: { fontFamily: TV.bold, fontSize: 14, color: TV.text },
  addSub: { fontFamily: TV.regular, fontSize: 10, color: TV.muted },
  footer: { height: 24, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 20 },
  renameOverlay: { flex: 1, backgroundColor: "rgba(4, 7, 13, 0.9)", alignItems: "center", justifyContent: "center" },
  renameCard: { width: 420, borderRadius: 18, backgroundColor: TV.surface, borderWidth: 0.5, borderColor: TV.cardBorder, padding: 28, gap: 12 },
  renameTitle: { fontFamily: TV.bold, fontSize: 20, lineHeight: 24, color: TV.text },
  renameField: { height: 46, borderRadius: 10, borderWidth: 1.5, borderColor: "transparent", backgroundColor: TV.field, paddingHorizontal: 14, justifyContent: "center" },
  renameFieldFocus: { borderColor: TV.ring, backgroundColor: TV.surfaceHigh },
  renameInput: { padding: 0, fontFamily: TV.medium, fontSize: 15, color: TV.text },
  renameActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  renameCancel: { flex: 1, height: 40, borderRadius: 10, backgroundColor: "#141F33", borderWidth: 0.75, borderColor: "rgba(136, 148, 168, 0.35)", alignItems: "center", justifyContent: "center" },
  renameCancelText: { fontFamily: TV.semi, fontSize: 12, color: TV.text },
  renameSave: { flex: 1.3, height: 40, borderRadius: 10, backgroundColor: TV.text, borderWidth: 1.5, borderColor: TV.text, alignItems: "center", justifyContent: "center" },
  renameSaveText: { fontFamily: TV.bold, fontSize: 12, color: TV.bg },
});
