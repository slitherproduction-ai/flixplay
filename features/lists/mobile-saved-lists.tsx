import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/ui";
import { tr } from "@/core/i18n";
import { hasDate, initials, isExpired, origin, RenameDialog } from "@/features/lists/tv-saved-lists";
import { tf, TV, TvEyebrow } from "@/features/tv/tv-kit";
import type { ServerProfile } from "@/store/types";

/**
 * Listas salvas no celular e no tablet (canvas "ELVANOQ Play", tela M3):
 * um cartão por lista; tocar usa a lista; Atualizar (lista em uso),
 * Renomear e Excluir no próprio cartão.
 */
type Props = {
  servers: ServerProfile[];
  activeSyncedAt: string | null;
  onSelect: (server: ServerProfile) => void;
  onRefresh: (server: ServerProfile) => void;
  onRename: (server: ServerProfile, name: string) => void;
  onDelete: (id: string, name: string) => void;
  onAdd: () => void;
  onClose: () => void;
  onManagePortal: () => void;
  onLinkPortal?: () => void;
};

const TONES = {
  blue: { bg: "#0A2A66", fg: "#7FC0FF" },
  teal: { bg: "#0F3B3F", fg: "#4FE3F5" },
  amber: { bg: "#3A2A0B", fg: TV.warning },
} as const;

function agoShort(iso: string | null): string {
  const at = Date.parse(iso ?? "");
  if (!Number.isFinite(at)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (minutes < 2) return tr("atualizado agora");
  if (minutes < 60) return tf("atualizado há {0} min", minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return tf("atualizado há {0} h", hours);
  const days = Math.round(hours / 24);
  return days === 1 ? tr("atualizado há 1 dia") : tf("atualizado há {0} dias", days);
}

export function MobileSavedLists({ servers, activeSyncedAt, onSelect, onRefresh, onRename, onDelete, onAdd, onClose, onManagePortal, onLinkPortal }: Props) {
  const insets = useSafeAreaInsets();
  const [renaming, setRenaming] = useState<ServerProfile | null>(null);
  const count = servers.length;
  const subtitle = count === 1 ? tr("1 lista neste aparelho · toque numa lista para usar") : tf("{0} listas neste aparelho · toque numa lista para usar", count);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.column}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <TvEyebrow>SUAS LISTAS</TvEyebrow>
            <AppText style={styles.title}>Listas salvas</AppText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose} hitSlop={8} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Ionicons name="close" size={18} color={TV.text} />
          </Pressable>
        </View>
        <AppText style={styles.subtitle}>{subtitle}</AppText>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {servers.map((server) => (
            <ListCard
              key={server.id}
              server={server}
              syncedAt={server.isActive ? activeSyncedAt : null}
              onSelect={() => onSelect(server)}
              onRefresh={() => onRefresh(server)}
              onRename={() => setRenaming(server)}
              onDelete={() => onDelete(server.id, server.name)}
            />
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Adicionar lista" onPress={onAdd} style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
            <View style={styles.addIcon}><Ionicons name="add" size={20} color="#4FA3FF" /></View>
            <View style={styles.addText}>
              <AppText style={styles.addTitle}>Adicionar lista</AppText>
              <AppText style={styles.addSub}>Código, Host ou pelo Portal</AppText>
            </View>
          </Pressable>
        </ScrollView>

        <View style={styles.bottom}>
          {onLinkPortal ? (
            <Pressable accessibilityRole="button" onPress={onLinkPortal} style={({ pressed }) => [styles.portal, styles.portalHalf, pressed && styles.pressed]}>
              <Ionicons name="key-outline" size={16} color={TV.accent} />
              <AppText style={styles.portalText}>Vincular chave</AppText>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="link" onPress={onManagePortal} style={({ pressed }) => [styles.portal, onLinkPortal && styles.portalHalf, pressed && styles.pressed]}>
            <Ionicons name="open-outline" size={16} color={TV.accent} />
            <AppText style={styles.portalText}>Gerenciar no Portal</AppText>
          </Pressable>
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

function ListCard({ server, syncedAt, onSelect, onRefresh, onRename, onDelete }: {
  server: ServerProfile; syncedAt: string | null; onSelect: () => void; onRefresh: () => void; onRename: () => void; onDelete: () => void;
}) {
  const expired = isExpired(server);
  const tone = expired ? TONES.amber : server.portalManaged || server.sourceType === "m3u" ? TONES.teal : TONES.blue;
  const ago = server.isActive ? agoShort(syncedAt) : "";
  const vence = hasDate(server.expiryDate) ? tf("Vence em {0}", server.expiryDate) : "";
  const meta = [vence, ago].filter(Boolean).join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tf(server.isActive ? "Lista {0}, em uso" : "Usar a lista {0}", server.name)}
      onPress={onSelect}
      style={({ pressed }) => [styles.card, server.isActive && styles.cardActive, pressed && styles.pressed]}
    >
      <View style={styles.cardHead}>
        <View style={[styles.mono, { backgroundColor: tone.bg }]}>
          <AppText style={[styles.monoText, { color: tone.fg }]}>{initials(server.name)}</AppText>
        </View>
        <View style={styles.cardNames}>
          <AppText numberOfLines={1} style={styles.cardName}>{server.name}</AppText>
          <AppText numberOfLines={1} style={styles.cardOrigin}>{origin(server)}</AppText>
        </View>
        {server.isActive ? (
          <View style={styles.inUse}>
            <View style={styles.inUseDot} />
            <AppText style={styles.inUseText}>Em uso</AppText>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={TV.dim} />
        )}
      </View>
      <View style={styles.cardFoot}>
        {expired ? (
          <View style={styles.expired}>
            <Ionicons name="alert-circle-outline" size={14} color={TV.warning} />
            <AppText numberOfLines={1} style={styles.expiredText}>{hasDate(server.expiryDate) ? tf("Venceu em {0}", server.expiryDate) : tr("Vencida")}</AppText>
          </View>
        ) : (
          <AppText numberOfLines={1} style={styles.meta}>{meta}</AppText>
        )}
        <View style={styles.actions}>
          {server.isActive ? <IconButton icon="refresh" label="Atualizar catálogo" onPress={onRefresh} /> : null}
          <IconButton icon="create-outline" label="Renomear lista" onPress={onRename} />
          <IconButton icon="trash-outline" label="Excluir lista" onPress={onDelete} danger />
        </View>
      </View>
    </Pressable>
  );
}

function IconButton({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={({ pressed }) => [styles.iconBtn, danger && styles.iconBtnDanger, pressed && styles.pressed]}>
      <Ionicons name={icon} size={16} color={danger ? TV.danger : TV.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TV.bg, paddingHorizontal: 20, alignItems: "center" },
  column: { flex: 1, width: "100%", maxWidth: 560 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerText: { gap: 4 },
  title: { fontFamily: TV.bold, fontSize: 28, lineHeight: 33, letterSpacing: -0.5, color: TV.text },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(17, 27, 45, 0.9)", borderWidth: 1, borderColor: "rgba(136, 148, 168, 0.3)", alignItems: "center", justifyContent: "center" },
  subtitle: { marginTop: 8, fontFamily: TV.regular, fontSize: 14, lineHeight: 20, color: TV.muted },
  scroll: { flex: 1, marginTop: 18 },
  list: { gap: 12, paddingBottom: 16 },
  card: { borderRadius: 18, backgroundColor: TV.surface, borderWidth: 1, borderColor: "rgba(136, 148, 168, 0.18)", padding: 16, gap: 12 },
  cardActive: { borderWidth: 1.5, borderColor: "rgba(22, 199, 132, 0.45)" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  mono: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  monoText: { fontFamily: TV.bold, fontSize: 16 },
  cardNames: { flex: 1, minWidth: 0, gap: 3 },
  cardName: { fontFamily: TV.bold, fontSize: 16, color: TV.text },
  cardOrigin: { fontFamily: TV.regular, fontSize: 12, color: TV.muted },
  inUse: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 7, backgroundColor: "rgba(22, 199, 132, 0.12)" },
  inUseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: TV.success },
  inUseText: { fontFamily: TV.semi, fontSize: 11, color: TV.success },
  cardFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  meta: { flex: 1, fontFamily: TV.regular, fontSize: 12, color: TV.muted },
  expired: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  expiredText: { fontFamily: TV.semi, fontSize: 12, color: TV.warning },
  actions: { flexDirection: "row", gap: 6 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: "rgba(244, 248, 255, 0.2)", alignItems: "center", justifyContent: "center" },
  iconBtnDanger: { borderColor: "rgba(255, 138, 138, 0.4)" },
  add: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(136, 148, 168, 0.4)" },
  addIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(20, 125, 255, 0.16)", alignItems: "center", justifyContent: "center" },
  addText: { gap: 2 },
  addTitle: { fontFamily: TV.bold, fontSize: 15, color: TV.text },
  addSub: { fontFamily: TV.regular, fontSize: 12, color: TV.muted },
  bottom: { flexDirection: "row", gap: 8 },
  portal: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: "rgba(136, 148, 168, 0.35)", backgroundColor: TV.field, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  portalHalf: { flex: 1 },
  portalText: { fontFamily: TV.semi, fontSize: 14, color: TV.text },
  pressed: { opacity: 0.8 },
});
