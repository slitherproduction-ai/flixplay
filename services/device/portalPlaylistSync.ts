import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { ServerProfile } from "@/store/types";
import type { DeviceIdentity } from "./deviceIdentity";

// This is a publishable Supabase key only. Playlist credentials are returned
// exclusively by the Edge Function after it verifies the device MAC and key.
const PORTAL_FUNCTION_URL = "https://xrrgjssvdqvtrqhxpask.supabase.co/functions/v1/portal-control";
const PORTAL_PUBLISHABLE_KEY = "sb_publishable_zTZ9IwqmgdIcQfvsy_Qz0w_ZwIOa1kl";
const PORTAL_LINK_KEY_STORAGE = "elvanoq-portal-link-key-v1";
const REQUEST_TIMEOUT_MS = 8_000;

type PortalPlaylist = {
  name: string;
  kind: "m3u" | "xtream";
  credentials: {
    url?: string;
    host?: string;
    username?: string;
    password?: string;
  };
  updated_at?: string;
};

type PortalSyncResponse = {
  registered?: boolean;
  active?: boolean;
  display_name?: string | null;
  playlist?: PortalPlaylist | null;
  message?: string;
};

export type PortalPlaylistSyncResult =
  | { state: "synced"; server: ServerProfile; displayName: string | null }
  | { state: "no-playlist"; displayName: string | null }
  | { state: "inactive"; displayName: string | null }
  | { state: "link-required"; message: string }
  | { state: "unavailable"; message: string };

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

async function readLinkKey(): Promise<string | null> {
  if (Platform.OS === "android" && !__DEV__) {
    try {
      return await SecureStore.getItemAsync(PORTAL_LINK_KEY_STORAGE);
    } catch {
      // Offline lists remain usable if Android Keystore is temporarily unavailable.
    }
  }
  return AsyncStorage.getItem(PORTAL_LINK_KEY_STORAGE);
}

async function writeLinkKey(value: string): Promise<void> {
  if (Platform.OS === "android" && !__DEV__) {
    try {
      await SecureStore.setItemAsync(PORTAL_LINK_KEY_STORAGE, value);
      return;
    } catch {
      // Use the app sandbox only as a fallback; this never changes the local device identity.
    }
  }
  await AsyncStorage.setItem(PORTAL_LINK_KEY_STORAGE, value);
}

export async function clearPortalLinkKey(): Promise<void> {
  if (Platform.OS === "android" && !__DEV__) {
    try {
      await SecureStore.deleteItemAsync(PORTAL_LINK_KEY_STORAGE);
      return;
    } catch {
      // Fall through to the non-sensitive fallback storage.
    }
  }
  await AsyncStorage.removeItem(PORTAL_LINK_KEY_STORAGE);
}

/** Returns a manually linked Portal key, never the device's local key. */
export async function getStoredPortalLinkKey(): Promise<string | null> {
  const key = await readLinkKey();
  return key?.trim() || null;
}

function profileFromPlaylist(identity: DeviceIdentity, playlist: PortalPlaylist): ServerProfile | null {
  const id = `portal-${identity.macAddress.replace(/[^0-9A-F]/gi, "").toLowerCase()}`;
  const portalPlaylistId = identity.macAddress;
  const name = playlist.name.trim().slice(0, 100);
  if (!name) return null;

  if (playlist.kind === "m3u") {
    if (!isHttpUrl(playlist.credentials.url)) return null;
    return {
      id,
      name,
      serverUrl: playlist.credentials.url,
      username: "",
      password: "",
      isActive: false,
      expiryDate: "Não informado",
      maxConnections: null,
      activeConnections: null,
      format: "M3U8",
      sourceType: "m3u",
      m3uUrl: playlist.credentials.url,
      addedAt: new Date().toISOString(),
      portalPlaylistId,
      portalManaged: true,
      portalUpdatedAt: playlist.updated_at,
    };
  }

  const { host, username, password } = playlist.credentials;
  if (!isHttpUrl(host) || typeof username !== "string" || !username.trim() || typeof password !== "string" || !password) return null;
  return {
    id,
    name,
    serverUrl: host,
    username,
    password,
    isActive: false,
    expiryDate: "Não informado",
    maxConnections: null,
    activeConnections: null,
    format: null,
    sourceType: "xtream",
    addedAt: new Date().toISOString(),
    portalPlaylistId,
    portalManaged: true,
    portalUpdatedAt: playlist.updated_at,
  };
}

/**
 * Requests the one playlist associated with this device. Supplying a key is
 * explicit: the stored Portal key is tried first, then the app's local key.
 * The local identity is never overwritten by a Portal-generated key.
 */
export async function syncPortalPlaylist(
  identity: DeviceIdentity,
  explicitPortalKey?: string,
): Promise<PortalPlaylistSyncResult> {
  const manualKey = explicitPortalKey?.trim();
  const storedKey = manualKey || await getStoredPortalLinkKey();
  const deviceKey = storedKey || identity.deviceKey;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(PORTAL_FUNCTION_URL, {
      method: "POST",
      headers: { apikey: PORTAL_PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "playlist-sync", mac: identity.macAddress, device_key: deviceKey }),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as PortalSyncResponse;

    if (response.status === 403 || response.status === 404) {
      return { state: "link-required", message: "Informe no aplicativo a chave usada ou gerada no Portal para vincular este dispositivo." };
    }
    if (!response.ok) {
      return { state: "unavailable", message: payload.message || "Não foi possível sincronizar agora." };
    }
    if (!payload.registered) {
      return { state: "link-required", message: "Este dispositivo ainda não está vinculado no Portal." };
    }
    if (!payload.active) {
      return { state: "inactive", displayName: typeof payload.display_name === "string" ? payload.display_name : null };
    }

    // Persist only a key deliberately supplied by the user and only after the
    // server authenticated it. This avoids silently replacing the app key.
    if (manualKey) await writeLinkKey(manualKey);

    if (!payload.playlist) {
      return { state: "no-playlist", displayName: typeof payload.display_name === "string" ? payload.display_name : null };
    }
    const server = profileFromPlaylist(identity, payload.playlist);
    if (!server) {
      return { state: "unavailable", message: "A lista recebida do Portal está incompleta. Atualize-a no Portal e tente novamente." };
    }
    return { state: "synced", server, displayName: typeof payload.display_name === "string" ? payload.display_name : null };
  } catch {
    return { state: "unavailable", message: "Portal indisponível. Suas listas salvas continuam disponíveis offline." };
  } finally {
    clearTimeout(timeout);
  }
}
