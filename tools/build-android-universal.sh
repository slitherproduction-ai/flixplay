#!/usr/bin/env bash
set -Eeuo pipefail

# Reproducible local Android build. The cache folder can be kept alongside the
# source checkout, so dependency downloads happen only on the first build in a
# persistent workspace.
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache_root="${ELVANOQ_BUILD_CACHE:-$project_root/.build-cache}"
java_home="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
apk_name="ELVANOQ-v2.17.0-universal.apk"

if [[ ! -x "$java_home/bin/javac" ]]; then
  echo "JDK 17 com javac não encontrado em: $java_home" >&2
  echo "Defina JAVA_HOME para um JDK completo antes de continuar." >&2
  exit 1
fi

export JAVA_HOME="$java_home"
export PATH="$JAVA_HOME/bin:$PATH"
export NODE_ENV="${NODE_ENV:-production}"
export GRADLE_USER_HOME="$cache_root/gradle"
export npm_config_cache="$cache_root/npm"

mkdir -p "$GRADLE_USER_HOME" "$npm_config_cache"

cd "$project_root"
if [[ ! -d node_modules ]]; then
  npm ci
fi

if [[ ! -d android ]]; then
  npx expo prebuild --platform android --no-install
fi

cd android
./gradlew --no-daemon assembleRelease

mkdir -p "$project_root/release"
cp app/build/outputs/apk/release/app-release.apk "$project_root/release/$apk_name"
echo "APK universal criado em: release/$apk_name"
