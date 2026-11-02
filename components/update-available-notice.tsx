import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui";
import { TVFocusable } from "@/components/tv-focusable";
import { Colors, Radii } from "@/constants/theme";
import {
  cancelUpdateDownload,
  downloadAndInstallUpdate,
  checkForPortalUpdate,
  type UpdateCheckResult,
  type UpdateDownloadProgress,
} from "@/services/portalUpdater";
import { logTechnicalError } from "@/services/security/sanitize";
import { useAppStore } from "@/store/useAppStore";

function formatSize(bytes: number | null): string | null {
  return bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : null;
}

/** Keeps the automatic prompt readable; the complete notes remain on demand. */
function releaseHighlights(notes: string | null): string[] {
  if (!notes) return [];
  const lines = notes
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•]\s*/, "").trim())
    .filter((line) => line.length >= 12 && !/^ELVANOQ Play v?\d/i.test(line));
  return Array.from(new Set(lines)).slice(0, 2);
}

/**
 * Global update prompt for direct Android distribution. It intentionally only
 * initiates Android's package installer after a user action.
 */
export function UpdateAvailableNotice() {
  const hydrated = useAppStore((state) => state._hasHydrated);
  const autoUpdate = useAppStore((state) => state.preferences.autoUpdate);
  const hasChecked = useRef(false);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState<UpdateDownloadProgress | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!hydrated || autoUpdate === false || hasChecked.current) return;
    hasChecked.current = true;
    let active = true;
    void checkForPortalUpdate().then((next) => {
      if (!active || next.error || !next.hasUpdate || !next.apkUrl) return;
      setResult(next);
      setVisible(true);
    });
    return () => { active = false; };
  }, [hydrated, autoUpdate]);

  const handleInstall = useCallback(async () => {
    if (!result?.apkUrl || downloading) return;
    setError(null);
    setDownloading(true);
    setProgress(null);
    try {
      await downloadAndInstallUpdate(result.apkUrl, result.apkSize ?? 0, result.apkSha256 ?? "", setProgress);
    } catch (downloadError) {
      logTechnicalError("UpdateNotice/install", downloadError);
      setError(downloadError instanceof Error ? downloadError.message : "Não foi possível baixar a atualização.");
    } finally {
      setDownloading(false);
    }
  }, [downloading, result]);

  const handleCancel = useCallback(() => {
    void cancelUpdateDownload();
  }, []);

  if (!result) return null;

  const progressPercent = progress?.fraction === null || progress?.fraction === undefined
    ? null
    : Math.round(progress.fraction * 100);
  const highlights = releaseHighlights(result.releaseNotes);
  const apkSize = formatSize(result.apkSize);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View accessibilityViewIsModal style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="arrow-up" size={21} color={Colors.blueBright} />
            </View>
            <View style={styles.headerCopy}>
              <AppText style={styles.eyebrow}>ATUALIZAÇÃO DISPONÍVEL</AppText>
              <AppText style={styles.title}>ELVANOQ Play {result.latestVersion}</AppText>
            </View>
          </View>
          <AppText style={styles.body}>Uma experiência mais estável e refinada está pronta para você.</AppText>

          <View style={styles.versionCard}>
            <View style={styles.versionCell}>
              <AppText style={styles.versionLabel}>INSTALADA</AppText>
              <AppText style={styles.versionValue}>{result.currentVersion}</AppText>
            </View>
            <Ionicons name="arrow-forward" size={16} color={Colors.blueBright} />
            <View style={[styles.versionCell, styles.versionCellAvailable]}>
              <AppText style={styles.versionLabel}>NOVA VERSÃO</AppText>
              <AppText style={styles.versionValue}>{result.latestVersion}</AppText>
            </View>
            {apkSize ? <AppText style={styles.sizeBadge}>{apkSize}</AppText> : null}
          </View>

          {highlights.length > 0 ? <View style={styles.highlights}>
            {highlights.map((highlight) => <View key={highlight} style={styles.highlightRow}>
              <View style={styles.highlightDot} />
              <AppText style={styles.highlightText} numberOfLines={2}>{highlight}</AppText>
            </View>)}
          </View> : null}

          {downloading ? (
            <View style={styles.progressArea}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPercent ?? 5}%` }]} />
              </View>
              <AppText style={styles.progressText}>
                {progressPercent === null ? "Baixando atualização…" : `Baixando… ${progressPercent}%`}
              </AppText>
            </View>
          ) : null}

          {result.releaseNotes ? <TVFocusable
            accessibilityLabel={showDetails ? "Ocultar novidades" : "Ver todas as novidades"}
            onPress={() => setShowDetails((current) => !current)}
            style={styles.detailsButton}
          >
            <AppText style={styles.detailsText}>{showDetails ? "Ocultar novidades" : "Ver todas as novidades"}</AppText>
            <Ionicons name={showDetails ? "chevron-up" : "chevron-down"} size={15} color={Colors.blueBright} />
          </TVFocusable> : null}
          {showDetails && result.releaseNotes ? <ScrollView
            style={styles.notes}
            contentContainerStyle={styles.notesContent}
            showsVerticalScrollIndicator={false}
          ><AppText style={styles.notesText}>{result.releaseNotes}</AppText></ScrollView> : null}

          {error ? <AppText style={styles.error}>{error}</AppText> : null}

          <View style={styles.actions}>
            <TVFocusable
              hasTVPreferredFocus
              accessibilityLabel="Baixar e instalar atualização"
              disabled={downloading}
              onPress={handleInstall}
              style={[styles.primary, downloading && styles.disabled]}
            >
              {downloading ? <ActivityIndicator size="small" color={Colors.background} /> : <Ionicons name="download-outline" size={18} color={Colors.background} />}
              <AppText style={styles.primaryText}>{downloading ? "Baixando" : "Atualizar agora"}</AppText>
            </TVFocusable>
            {downloading ? (
              <TVFocusable accessibilityLabel="Cancelar download" onPress={handleCancel} style={styles.secondary}>
                <AppText style={styles.secondaryText}>Cancelar</AppText>
              </TVFocusable>
            ) : null}
            <TVFocusable
              accessibilityLabel="Atualizar mais tarde"
              disabled={downloading}
              onPress={() => setVisible(false)}
              style={styles.secondary}
            >
              <AppText style={styles.secondaryText}>Depois</AppText>
            </TVFocusable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "rgba(0,0,0,0.78)" },
  dialog: { width: "100%", maxWidth: 420, gap: 14, padding: 20, borderRadius: 22, backgroundColor: "#0D1422", borderWidth: 1, borderColor: "rgba(86,217,255,0.28)" },
  header: { flexDirection: "row", alignItems: "center", gap: 11 },
  iconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(34,211,238,0.12)" },
  headerCopy: { flex: 1, gap: 2 },
  eyebrow: { color: Colors.blueBright, fontSize: 10, lineHeight: 14, letterSpacing: 1.1, fontFamily: "Inter_700Bold" },
  title: { color: Colors.text, fontSize: 18, fontFamily: "Inter_700Bold" },
  body: { color: Colors.muted, fontSize: 13, lineHeight: 19 },
  versionCard: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.045)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  versionCell: { flex: 1, gap: 2 },
  versionCellAvailable: { alignItems: "flex-end" },
  versionLabel: { color: Colors.subtle, fontSize: 9, letterSpacing: 0.7, fontFamily: "Inter_600SemiBold" },
  versionValue: { color: Colors.text, fontSize: 14, fontFamily: "Inter_700Bold" },
  sizeBadge: { color: Colors.blueBright, fontSize: 10, fontFamily: "Inter_600SemiBold" },
  highlights: { gap: 8 },
  highlightRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  highlightDot: { width: 5, height: 5, marginTop: 6, borderRadius: 3, backgroundColor: Colors.blueBright },
  highlightText: { flex: 1, color: Colors.muted, fontSize: 12, lineHeight: 18 },
  detailsButton: { alignSelf: "flex-start", minHeight: 30, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 4 },
  detailsText: { color: Colors.blueBright, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  notes: { maxHeight: 180, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.035)" },
  notesContent: { padding: 12 },
  notesText: { color: Colors.muted, fontSize: 11, lineHeight: 17 },
  progressArea: { gap: 7, marginTop: 3 },
  progressTrack: { height: 6, overflow: "hidden", borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)" },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: Colors.blueBright },
  progressText: { color: Colors.blueBright, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  error: { color: "#FF8B91", fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 10, marginTop: 2 },
  primary: { flex: 1, minHeight: 46, borderRadius: 14, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.82)", backgroundColor: Colors.white },
  primaryText: { color: Colors.background, fontSize: 14, fontFamily: "Inter_700Bold" },
  secondary: { minWidth: 88, minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  secondaryText: { color: Colors.text, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  disabled: { opacity: 0.55 },
});
