/**
 * Expo config plugin: Android TV / Fire OS compatibility + PiP support
 *
 * Fixes that allow the APK to install on FireStick (Fire OS 6/7/8) and
 * Android TV without the "App not installed" / INSTALL_FAILED_* errors:
 *
 *  1. <uses-feature required="false"> for every hardware feature absent on TV.
 *     Without this, PackageInstaller blocks installation on touch-screen-less
 *     devices because standard Android permissions imply hardware dependencies.
 *
 *  2. android:banner MUST NOT be set to @mipmap/ic_launcher.
 *     In modern Expo, ic_launcher is an adaptive icon (XML file). Fire OS
 *     AssetManager cannot inflate an XML adaptive icon as a banner drawable;
 *     it crashes during APK parsing → "App not installed".
 *     We do NOT set android:banner here at all — Fire OS accepts the app
 *     without a dedicated banner and shows the launcher icon instead.
 *
 *  3. LEANBACK_LAUNCHER intent-filter must be a *separate* intent-filter from
 *     LAUNCHER. The app.json "intentFilters" field APPENDS to the existing
 *     MAIN+LAUNCHER filter, creating a duplicate LAUNCHER entry that causes
 *     Fire OS PackageInstaller to reject the APK.
 *     We handle LEANBACK_LAUNCHER entirely in this plugin and remove
 *     intentFilters from app.json.
 */
const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Every feature here will be written as android:required="false".
 * This tells the installer: "I can handle devices that lack this hardware."
 * Without it, a feature implied by any declared permission blocks install on TV.
 */
const TV_FEATURES = [
  // Fire OS / Android TV have no touchscreen — the #1 install blocker
  { name: "android.hardware.touchscreen" },
  // Leanback (required="false") → same APK installs on phones AND TV/FireStick
  { name: "android.software.leanback" },
  // D-pad / remote navigation
  { name: "android.hardware.faketouch" },
  // Absent on every TV box
  { name: "android.hardware.telephony" },
  { name: "android.hardware.camera" },
  // autofocus is implicitly required when CAMERA permission is declared
  { name: "android.hardware.camera.autofocus" },
  { name: "android.hardware.microphone" },
  // Bluetooth remote controls on Fire TV — present but must not be "required"
  { name: "android.hardware.bluetooth" },
  // Wi-Fi is present on Fire TV but we must not gate on specific capabilities
  { name: "android.hardware.wifi" },
  // Location / GPS absent on Fire TV devices
  { name: "android.hardware.location" },
  { name: "android.hardware.location.gps" },
  { name: "android.hardware.location.network" },
  // NFC absent on all TV devices
  { name: "android.hardware.nfc" },
];

/**
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
function withAndroidTV(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Overlay permission is not used by FlixPlay and can cause compatibility
    // or review issues on Fire OS. Expo may add it during prebuild, so remove
    // it explicitly from the generated manifest.
    if (manifest["uses-permission"]) {
      manifest["uses-permission"] = manifest["uses-permission"].filter(
        (permission) =>
          permission.$?.["android:name"] !==
          "android.permission.SYSTEM_ALERT_WINDOW",
      );
    }

    // ── 1. <uses-feature> declarations ──────────────────────────────────────
    if (!manifest["uses-feature"]) {
      manifest["uses-feature"] = [];
    }

    for (const feat of TV_FEATURES) {
      // De-duplicate: remove any pre-existing entry so we control the value
      manifest["uses-feature"] = manifest["uses-feature"].filter(
        (f) => f.$?.["android:name"] !== feat.name,
      );
      manifest["uses-feature"].push({
        $: {
          "android:name": feat.name,
          "android:required": "false",
        },
      });
    }

    // ── 2. Application-level attributes ─────────────────────────────────────
    const application = manifest.application?.[0];
    if (application?.$) {
      // Hardware-accelerated rendering is required for smooth video playback
      application.$["android:hardwareAccelerated"] = "true";
      // Large heap helps with multi-stream buffering and EPG parsing
      application.$["android:largeHeap"] = "true";

      // ⚠ Do NOT set android:banner here.
      //   @mipmap/ic_launcher is an adaptive icon XML — Fire OS AssetManager
      //   cannot inflate it as a banner drawable and rejects the APK.
      //   Expo does not auto-process app.json "android.banner" in SDK 57, so
      //   we intentionally leave android:banner unset; Fire OS will fall back
      //   to displaying the launcher icon in the TV launcher grid.
    }

    // ── 3. MainActivity: PiP attributes + LEANBACK_LAUNCHER intent-filter ───
    if (application?.activity) {
      const mainActivity = application.activity.find(
        (a) =>
          a.$?.["android:name"] === ".MainActivity" ||
          a.$?.["android:name"]?.endsWith("MainActivity"),
      );

      if (mainActivity) {
        // PiP: enable system Picture-in-Picture (YouTube-style overlay)
        mainActivity.$["android:supportsPictureInPicture"] = "true";
        // configChanges: prevent Activity restart on PiP transition or TV
        // orientation/uiMode changes — keeps the video stream alive
        mainActivity.$["android:configChanges"] =
          "keyboard|keyboardHidden|orientation|screenSize|smallestScreenSize|screenLayout|uiMode|navigation";
        // Allow multi-window and PiP mode
        mainActivity.$["android:resizeableActivity"] = "true";
        // Prevent screen from sleeping during media playback
        mainActivity.$["android:keepScreenOn"] = "true";
        // Required so TV launchers can start the activity
        mainActivity.$["android:exported"] = "true";

        // ── LEANBACK_LAUNCHER intent-filter ─────────────────────────────────
        // Amazon Fire TV / Android TV launcher looks for LEANBACK_LAUNCHER.
        // It MUST be a separate <intent-filter> from the phone LAUNCHER one.
        // Combining them causes duplicate LAUNCHER entries → Fire OS rejects
        // the APK during PackageInstaller verification.
        if (!mainActivity["intent-filter"]) {
          mainActivity["intent-filter"] = [];
        }

        const alreadyHasLeanback = mainActivity["intent-filter"].some((filter) =>
          filter.category?.some(
            (cat) =>
              cat.$?.["android:name"] === "android.intent.category.LEANBACK_LAUNCHER",
          ),
        );

        if (!alreadyHasLeanback) {
          mainActivity["intent-filter"].push({
            action: [
              { $: { "android:name": "android.intent.action.MAIN" } },
            ],
            category: [
              { $: { "android:name": "android.intent.category.LEANBACK_LAUNCHER" } },
            ],
          });
        }
      }
    }

    return cfg;
  });
}

module.exports = withAndroidTV;
