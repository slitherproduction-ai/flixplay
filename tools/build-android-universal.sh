#!/usr/bin/env bash
set -Eeuo pipefail

# Reproducible local Android build. The cache folder can be kept alongside the
# source checkout, so dependency downloads happen only on the first build in a
# persistent workspace.
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache_root="${ELVANOQ_BUILD_CACHE:-$project_root/.build-cache}"
java_home="${JAVA_HOME:-$cache_root/jdk-17}"
android_sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-${ELVANOQ_ANDROID_SDK:-$project_root/android-sdk}}}"
node_home="${ELVANOQ_NODE_HOME:-$cache_root/node}"
export PATH="$node_home/bin:$PATH"
app_version="$(node -p "require('$project_root/package.json').version")"
apk_name="ELVANOQ-v${app_version}-universal.apk"

# Expo reads .env during bundling, but validating it here avoids publishing an
# APK where the TMDB section silently has no credentials.
if [[ -f "$project_root/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$project_root/.env"
  set +a
fi

tmdb_access_token="${EXPO_PUBLIC_TMDB_ACCESS_TOKEN:-}"
if [[ ${#tmdb_access_token} -lt 21 ]]; then
  echo "EXPO_PUBLIC_TMDB_ACCESS_TOKEN não configurado." >&2
  echo "Copie .env.example para .env e informe o token de leitura do TMDB antes do build." >&2
  exit 1
fi

if [[ ! -x "$java_home/bin/javac" ]]; then
  echo "JDK 17 com javac não encontrado em: $java_home" >&2
  echo "Defina JAVA_HOME para um JDK completo antes de continuar." >&2
  exit 1
fi

export JAVA_HOME="$java_home"
export PATH="$node_home/bin:$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="$android_sdk_root"
export ANDROID_SDK_ROOT="$android_sdk_root"
export NODE_ENV="${NODE_ENV:-production}"
export CI="${CI:-1}"
export EXPO_NO_TELEMETRY="${EXPO_NO_TELEMETRY:-1}"
export GRADLE_USER_HOME="$cache_root/gradle"
export npm_config_cache="$cache_root/npm"

mkdir -p "$GRADLE_USER_HOME" "$npm_config_cache"

if [[ ! -d "$ANDROID_HOME/platforms/android-36" || ! -d "$ANDROID_HOME/build-tools/36.0.0" ]]; then
  echo "Android SDK 36 não encontrado em: $ANDROID_HOME" >&2
  echo "Prepare o SDK antes do build: platforms;android-36 e build-tools;36.0.0." >&2
  exit 1
fi

ndk_properties="$ANDROID_HOME/ndk/27.1.12297006/source.properties"
if [[ ! -f "$ndk_properties" ]]; then
  echo "NDK 27.1.12297006 não encontrado ou incompleto em: $ANDROID_HOME/ndk/27.1.12297006" >&2
  echo "Execute ./tools/verify-android-build-env.sh depois de preparar o ambiente." >&2
  exit 1
fi

cd "$project_root"
"$project_root/tools/verify-release-baseline.sh"

if [[ ! -d node_modules ]]; then
  npm ci
fi

"$project_root/tools/prepare-android-offline-compat.sh"
export ELVANOQ_OFFLINE_MAVEN="$("$project_root/tools/prepare-offline-maven-repo.sh")"

if [[ ! -d android ]]; then
  npx expo prebuild --platform android --no-install
fi

# Keep Android Studio/Gradle resolution deterministic for local builds. This
# generated file is intentionally ignored by source checkpoints.
printf 'sdk.dir=%s\n' "${ANDROID_HOME//\\/\\\\}" > "$project_root/android/local.properties"

cd android
# The ELVANOQ build kit persists every Android/Gradle artifact required for a
# release.  Offline mode makes the build deterministic and avoids repository
# checks when the local cache already contains the resolved dependencies.
gradle_network_mode=(--offline)
if [[ "${ELVANOQ_BUILD_ONLINE:-0}" == "1" ]]; then
  # Explicit one-time recovery path. It is only used to restore missing
  # runtime artifacts to the persistent kit; normal release builds stay offline.
  gradle_network_mode=()
  # Some hosted shells inject a browser-only proxy into GRADLE_OPTS. Rebuild
  # Java's proxy settings from HTTPS_PROXY only for the explicit cache-recovery
  # pass, keeping normal release builds isolated and offline.
  unset GRADLE_OPTS
  if [[ "${HTTPS_PROXY:-}" =~ ^http://([^:/]+):([0-9]+)$ ]]; then
    proxy_host="${BASH_REMATCH[1]}"
    proxy_port="${BASH_REMATCH[2]}"
    export GRADLE_OPTS="-Dhttp.proxyHost=$proxy_host -Dhttp.proxyPort=$proxy_port -Dhttps.proxyHost=$proxy_host -Dhttps.proxyPort=$proxy_port"
  fi
  echo "Sincronizando artefatos Android ausentes para o kit persistente..."
fi

./gradlew "${gradle_network_mode[@]}" --no-daemon --max-workers=2 -Dorg.gradle.parallel=false \
  --init-script "$project_root/tools/gradle-offline-init.gradle" assembleRelease

mkdir -p "$project_root/release"
cp app/build/outputs/apk/release/app-release.apk "$project_root/release/$apk_name"
echo "APK universal criado em: release/$apk_name"
