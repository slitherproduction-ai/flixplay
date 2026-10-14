#!/usr/bin/env bash
set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache_root="${ELVANOQ_BUILD_CACHE:-$project_root/.build-cache}"
java_home="${JAVA_HOME:-$cache_root/jdk-17}"
android_sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-${ELVANOQ_ANDROID_SDK:-$project_root/android-sdk}}}"

[[ -x "$java_home/bin/javac" ]] || { echo "JDK 17 incompleto: $java_home" >&2; exit 1; }
[[ -d "$android_sdk_root/platforms/android-36" ]] || { echo "SDK Platform 36 ausente: $android_sdk_root" >&2; exit 1; }
[[ -d "$android_sdk_root/build-tools/36.0.0" ]] || { echo "Build Tools 36.0.0 ausente: $android_sdk_root" >&2; exit 1; }
[[ -d "$android_sdk_root/build-tools/35.0.0" ]] || { echo "Build Tools 35.0.0 ausente: $android_sdk_root" >&2; exit 1; }
[[ -f "$android_sdk_root/ndk/27.1.12297006/source.properties" ]] || { echo "NDK 27.1.12297006 ausente ou incompleto: $android_sdk_root" >&2; exit 1; }
[[ -x "$android_sdk_root/cmake/3.22.1/bin/cmake" ]] || { echo "CMake 3.22.1 ausente: $android_sdk_root" >&2; exit 1; }
[[ -x "$android_sdk_root/platform-tools/adb" ]] || { echo "Platform Tools ausente: $android_sdk_root" >&2; exit 1; }
[[ -d "$project_root/node_modules" ]] || { echo "Dependências Node ausentes; execute npm ci." >&2; exit 1; }
[[ -d "$cache_root/gradle/caches/modules-2" ]] || { echo "Cache Gradle ausente: $cache_root/gradle" >&2; exit 1; }

echo "Ambiente Android pronto"
echo "JDK: $java_home"
echo "SDK: $android_sdk_root"
echo "NDK: $android_sdk_root/ndk/27.1.12297006"
echo "CMake: $android_sdk_root/cmake/3.22.1"
echo "Gradle cache: $cache_root/gradle"
