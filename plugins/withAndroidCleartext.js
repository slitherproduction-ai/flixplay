/**
 * Expo config plugin: Android Network Security Config
 *
 * Sets android:usesCleartextTraffic="true" and injects a
 * network_security_config.xml that permits cleartext HTTP for all domains
 * and trusts both system and user-installed CA certificates.
 * Required for Android 9+ (API 28+) to allow plain HTTP connections to IPTV
 * servers (e.g. http://flixplay.sbs) without CLEARTEXT_NOT_PERMITTED errors.
 */
const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </base-config>
</network-security-config>`;

/**
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
function withAndroidCleartext(config) {
  // 1. Add android:networkSecurityConfig and android:usesCleartextTraffic to <application>
  config = withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application[0];
    if (!application.$) application.$ = {};
    application.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    application.$["android:usesCleartextTraffic"] = "true";
    return cfg;
  });

  // 2. Write res/xml/network_security_config.xml into the generated Android project
  config = withDangerousMod(config, [
    "android",
    (cfg) => {
      const xmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "xml"
      );
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(xmlDir, "network_security_config.xml"),
        NETWORK_SECURITY_CONFIG
      );
      return cfg;
    },
  ]);

  return config;
}

module.exports = withAndroidCleartext;
