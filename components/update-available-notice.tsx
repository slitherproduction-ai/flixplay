import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui";
import { TVFocusable } from "@/components/tv-focusable";
import { Colors, Radii } from "@/constants/theme";
import {
  checkForGitHubUpdate,
  downloadAndInstallUpdate,
  type UpdateCheckResult,
  type UpdateDownloadProgress,
} from "@/services/githubUpdater";
import { logTechnicalError } from "@/services/security/sanitize";
import { useAppStore } from "@/store/useAppStore";

function formatSize(bytes: number | null): string | null {
  return bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : null;
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

  useEffect(() => {
    if (!hydrated || autoUpdate === false || hasChecked.current) return;
    hasChecked.current = true;
    let active = true;
    void checkForGitHubUpdate().then((next) => {
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
      await downloadAndInstallUpdate(result.apkUrl, result.apkSize, setProgress);
    } catch (downloadError) {
      logTechnicalError("UpdateNotice/install", downloadError);
      setError(downloadError instanceof Error ? downloadError.message : "Não foi possível baixar a atualização.");
    } finally {
      setDownloading(false);
    }
  }, [downloading, result]);

  if (!result) return null;

  const progressPercent = progress?.fraction === null || progress?.fraction === undefined
    ? null
    : Math.round(progress.fraction * 100);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View accessibilityViewIsModal style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.iconWrap}>
            <Ionicons name="arrow-up-circle" size={30} color={Colors.blueBright} />
          </View>
          <AppText style={styles.title}>Nova atualização disponível</AppText>
          <AppText style={styles.body}>
            A versão {result.latestVersion} do ELVANOQ está pronta para instalar.
          </AppText>

          <View style={styles.metaRow}>
            <AppText style={styles.meta}>Atual: {result.currentVersion}</AppText>
            {formatSize(result.apkSize) ? <AppText style={styles.meta}>{formatSize(result.apkSize)}</AppText> : null}
          </View>

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

          {error ? <AppText style={styles.error}>{error}</AppText> : null}

          <View style={styles.actions}>
            <TVFocusable
              hasTVPreferredFocus
              accessibilityLabel="Baixar e instalar atualização"
              disabled={downloading}
              onPress={handleInstall}
              style={[styles.primary, downloading && styles.disabled]}
            >
              {downloading ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="download-outline" size={18} color={Colors.white} />}
              <AppText style={styles.primaryText}>{downloading ? "Baixando" : "Baixar agora"}</AppText>
            </TVFocusable>
            <TVFocusable
              accessibilityLabel="Atualizar mais tarde"
              disabled={downloading}
              onPress={() => setVisible(false)}
              style={styles.secondary}
            >
              <AppText style={styles.secondaryText}>Mais tarde</AppText>
            </TVFocusable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.72)" },
  dialog: { width: "100%", maxWidth: 460, gap: 12, padding: 24, borderRadius: Radii.large, backgroundColor: Colors.backgroundRaised, borderWidth: 1, borderColor: "rgba(34,211,238,0.42)" },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(34,211,238,0.10)" },
  title: { color: Colors.text, fontSize: 21, fontFamily: "Inter_700Bold" },
  body: { color: Colors.muted, fontSize: 14, lineHeight: 21 },
  metaRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  meta: { color: Colors.subtle, fontSize: 12 },
  progressArea: { gap: 7, marginTop: 3 },
  progressTrack: { height: 6, overflow: "hidden", borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)" },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: Colors.blueBright },
  progressText: { color: Colors.blueBright, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  error: { color: "#FF8B91", fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  primary: { flex: 1, minHeight: 48, borderRadius: 24, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.blue },
  primaryText: { color: Colors.white, fontSize: 14, fontFamily: "Inter_700Bold" },
  secondary: { minWidth: 116, minHeight: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  secondaryText: { color: Colors.text, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  disabled: { opacity: 0.55 },
});
