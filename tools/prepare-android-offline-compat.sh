#!/usr/bin/env bash
set -Eeuo pipefail

# Some React Native packages declare a private Android/Spotless classpath even
# when consumed by the host app.  In offline mode those redundant classpaths
# trigger downloads of unrelated legacy toolchains.  The patch keeps them only
# for the library's standalone build; the ELVANOQ app already provides AGP and
# Kotlin at the root project.
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
patch_file="$project_root/tools/patches/offline-host-buildscript.patch"
marker='ELVANOQ_OFFLINE_HOST_CLASSPATH'

[[ -d "$project_root/node_modules" ]] || {
  echo "Dependências Node ausentes; não foi possível preparar compatibilidade Android." >&2
  exit 1
}

safe_area="$project_root/node_modules/react-native-safe-area-context/android/build.gradle"
gesture="$project_root/node_modules/react-native-gesture-handler/android/build.gradle"
webview="$project_root/node_modules/react-native-webview/android/build.gradle"

if grep -Fq "$marker" "$safe_area"; then
  grep -Fq 'if (project == rootProject) {' "$gesture" \
    && grep -Fq 'if (project == rootProject) {' "$webview" \
    || { echo "Patch de compatibilidade Android incompleto." >&2; exit 1; }
  exit 0
fi

patch --batch -p1 -d "$project_root" < "$patch_file"
