import { useEffect, useRef } from "react";
import { migrateLegacyPortalInstallation } from "@/services/device/legacyPortalMigration";
import { useAppStore } from "@/store/useAppStore";

/**
 * Runs after Zustand has restored the former app-storage snapshot. It never
 * changes a server's endpoint, credentials, selected state or user data.
 */
export function LegacyPortalMigration() {
  const hydrated = useAppStore((state) => state._hasHydrated);
  const servers = useAppStore((state) => state.servers);
  const setServerPortalMigrationStates = useAppStore((state) => state.setServerPortalMigrationStates);
  const started = useRef(false);

  useEffect(() => {
    if (!hydrated || started.current) return;
    started.current = true;

    void migrateLegacyPortalInstallation(servers).then((result) => {
      const codeProfiles = servers.filter((server) => server.sourceType === "xtream-code");
      if (codeProfiles.length === 0 || result.codeAccessEnforced === null) return;
      setServerPortalMigrationStates(
        Object.fromEntries(codeProfiles.map((server) => [
          server.id,
          result.codeAccessEnforced ? "confirmed" : "pending",
        ])),
      );
    });
  }, [hydrated, servers, setServerPortalMigrationStates]);

  return null;
}
