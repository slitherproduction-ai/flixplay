/**
 * Keeps release APKs focused on real Android devices.
 * x86 and x86_64 are emulator-oriented ABIs and add about 50 MB to a
 * universal package without benefiting phones, Android TV or Fire TV.
 */
const { withGradleProperties } = require("@expo/config-plugins");

const DEVICE_ABIS = "armeabi-v7a,arm64-v8a";

function withAndroidArmArchitectures(config) {
  return withGradleProperties(config, (cfg) => {
    const architectureProperty = cfg.modResults.find(
      (item) => item.type === "property" && item.key === "reactNativeArchitectures",
    );

    if (architectureProperty) {
      architectureProperty.value = DEVICE_ABIS;
    } else {
      cfg.modResults.push({
        type: "property",
        key: "reactNativeArchitectures",
        value: DEVICE_ABIS,
      });
    }
    return cfg;
  });
}

module.exports = withAndroidArmArchitectures;
