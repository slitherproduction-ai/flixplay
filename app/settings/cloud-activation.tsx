import React, { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { TVFocusable } from '@/components/tv-focusable';
import { Colors } from '@/constants/theme';
import { LicenseClient, type DevicePlatform } from '@/packages/elvanoq-license-client/src';
import { LICENSE_OBSERVER_ENABLED, loadDeviceCredentials, storeDeviceCredentials } from '@/services/license-observer';

type PairingState = { code: string; expiresAt: string } | null;

/** Staging only: never gates IPTV login or playback. */
export default function CloudActivationScreen() {
  const router = useRouter();
  const [pairing, setPairing] = useState<PairingState>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('A vinculação é opcional e não altera o funcionamento do aplicativo.');

  const enabled = LICENSE_OBSERVER_ENABLED && Platform.OS === 'android';

  async function generateCode() {
    if (!enabled || busy) return;
    const endpoint = process.env.EXPO_PUBLIC_ELVANOQ_LICENSE_API_URL;
    if (!endpoint) { setMessage('Servidor de licenciamento não configurado.'); return; }
    setBusy(true);
    setPairing(null);
    try {
      const client = new LicenseClient(endpoint);
      let credentials = await loadDeviceCredentials();
      if (!credentials) {
        const platform: DevicePlatform = Platform.isTV ? 'ANDROID_TV' : 'ANDROID';
        const device = await client.register(platform, 'ELVANOQ Play');
        credentials = { deviceId: device.deviceId, deviceSecret: device.deviceSecret };
        await storeDeviceCredentials(credentials);
      }
      const next = await client.startPairing(credentials);
      if (Date.parse(next.expiresAt) <= Date.now()) throw new Error('Código expirado');
      setPairing({ code: next.pairingCode, expiresAt: next.expiresAt });
      setMessage('No portal do ELVANOQ Cloud, acesse sua conta e informe o código abaixo.');
    } catch {
      setMessage('Não foi possível criar o código. Verifique a conexão e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ELVANOQ CLOUD · TESTES</Text>
        <Text style={styles.title}>Vincular dispositivo</Text>
        <Text style={styles.description}>Gerencie futuramente sua licença e os dispositivos associados à sua conta.</Text>
        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>CÓDIGO DE VINCULAÇÃO</Text>
          <Text selectable style={styles.code}>{pairing?.code ?? '— — — — — — — —'}</Text>
          <Text style={styles.expiry}>{pairing ? 'Válido até ' + new Date(pairing.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Gere um código para iniciar'}</Text>
        </View>
        <Text style={styles.message} accessibilityLiveRegion="polite">{enabled ? message : 'Função indisponível nesta versão. O aplicativo continua funcionando normalmente.'}</Text>
        {busy ? <ActivityIndicator color={Colors.blueBright} style={styles.loader}/> : null}
        <View style={styles.buttons}>
          <TVFocusable accessibilityRole="button" hasTVPreferredFocus disabled={!enabled || busy} onPress={() => { void generateCode(); }} style={[styles.primary, (!enabled || busy) && styles.disabled]}>
            <Text style={styles.primaryText}>{pairing ? 'Gerar novo código' : 'Gerar código'}</Text>
          </TVFocusable>
          <TVFocusable accessibilityRole="button" onPress={() => router.back()} style={styles.secondary}>
            <Text style={styles.secondaryText}>Voltar ao aplicativo</Text>
          </TVFocusable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, minHeight: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, padding: 24 },
  card: { width: '100%', maxWidth: 680, backgroundColor: Colors.backgroundRaised, borderColor: Colors.border, borderWidth: 1, borderRadius: 24, padding: 30, gap: 16 },
  eyebrow: { color: Colors.blueBright, fontSize: 12, letterSpacing: 2, fontWeight: '700' },
  title: { color: Colors.text, fontSize: 30, fontWeight: '700' },
  description: { color: Colors.muted, fontSize: 15, lineHeight: 23 },
  codeContainer: { marginTop: 8, borderRadius: 16, backgroundColor: Colors.background, borderColor: Colors.borderStrong, borderWidth: 1, padding: 20, alignItems: 'center', gap: 12 },
  codeLabel: { color: Colors.muted, fontSize: 12, letterSpacing: 1.5 },
  code: { color: Colors.white, fontSize: 32, letterSpacing: 5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  expiry: { color: Colors.muted, fontSize: 13 },
  message: { color: Colors.muted, fontSize: 14, minHeight: 40, lineHeight: 21 },
  loader: { marginVertical: 6 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  primary: { paddingHorizontal: 24, paddingVertical: 15, borderRadius: 14, backgroundColor: Colors.blue, minWidth: 180, alignItems: 'center' },
  disabled: { opacity: 0.45 },
  primaryText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  secondary: { paddingHorizontal: 24, paddingVertical: 15, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, minWidth: 180, alignItems: 'center' },
  secondaryText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
});
