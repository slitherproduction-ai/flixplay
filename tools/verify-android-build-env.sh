#!/usr/bin/env bash
set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache_root="${ELVANOQ_BUILD_CACHE:-$project_root/.build-cache}"
java_home="${JAVA_HOME:-$cache_root/jdk-17}"
android_sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-${ELVANOQ_ANDROID_SDK:-$project_root/.build-cache/android-sdk}}}"

[[ -x "$java_home/bin/javac" ]] || { echo "JDK 17 incompleto: $java_home" >&2; exit 1; }
[[ -d "$android_sdk_root/platforms/android-36" ]] || { echo "SDK Platform 36 ausente: $android_sdk_root" >&2; exit 1; }
[[ -d "$android_sdk_root/build-tools/36.0.0" ]] || { echo "Build Tools 36.0.0 ausente: $android_sdk_root" >&2; exit 1; }
[[ -f "$android_sdk_root/ndk/27.1.12297006/source.properties" ]] || { echo "NDK 27.1.12297006 ausente ou incompleto: $android_sdk_root" >&2; exit 1; }
[[ -x "$android_sdk_root/cmake/3.22.1/bin/cmake" ]] || { echo "CMake 3.22.1 ausente: $android_sdk_root" >&2; exit 1; }
[[ -x "$android_sdk_root/platform-tools/adb" ]] || { echo "Platform Tools ausente: $android_sdk_root" >&2; exit 1; }
[[ -d "$project_root/node_modules" ]] || { echo "Dependências Node ausentes; execute npm ci." >&2; exit 1; }
[[ -d "$cache_root/gradle-offline/caches/modules-2" ]] || { echo "Cache Gradle ausente: $cache_root/gradle-offline" >&2; exit 1; }
[[ -d "$cache_root/local-maven" ]] || { echo "Repositório Maven local ausente: $cache_root/local-maven" >&2; exit 1; }

if ! (
  cd "$project_root/android"
  JAVA_HOME="$java_home" \
  ANDROID_HOME="$android_sdk_root" \
  ANDROID_SDK_ROOT="$android_sdk_root" \
  GRADLE_USER_HOME="$cache_root/gradle-offline" \
  ELVANOQ_LOCAL_MAVEN_REPOSITORY="$cache_root/local-maven" \
  ./gradlew --offline --no-daemon --max-workers=2 -Dorg.gradle.parallel=false \
    --init-script "$project_root/tools/gradle-offline-init.gradle" help >/dev/null
); then
  echo "Cache Gradle incompleto ou incompatível com este projeto. A compilação offline foi bloqueada antes de gerar um APK parcial." >&2
  exit 1
fi

echo "Ambiente Android pronto"
echo "JDK: $java_home"
echo "SDK: $android_sdk_root"
echo "NDK: $android_sdk_root/ndk/27.1.12297006"
echo "CMake: $android_sdk_root/cmake/3.22.1"
echo "Gradle cache: $cache_root/gradle-offline"
echo "Resolução Gradle offline: validada"
