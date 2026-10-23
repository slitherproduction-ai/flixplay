/**
 * Public web origin of ELVANOQ Play.
 *
 * This is deliberately separate from the Supabase Edge Function URLs and from
 * IPTV provider hosts. Changing the Portal website must never alter an API
 * endpoint or the protocol selected for a playlist.
 */
export const PORTAL_ORIGIN = "https://elvanoqplay.app";

export type PortalQuery = Record<string, string | number | boolean | null | undefined>;

/** Builds a Portal URL while preserving a relative path and safely encoding query values. */
export function buildPortalUrl(path = "/", query?: PortalQuery): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined) params.set(key, String(value));
  }

  const search = params.toString();
  return `${PORTAL_ORIGIN}${normalizedPath}${search ? `?${search}` : ""}`;
}

/**
 * Known Portal destinations used by the client. Paths remain explicit so the
 * website origin can be changed once without touching navigation call sites.
 */
export const PORTAL_LINKS = {
  deviceAndPlaylists: buildPortalUrl("/"),
  renewal: buildPortalUrl("/ativacao/"),
} as const;
