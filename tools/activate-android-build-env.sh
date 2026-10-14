#!/usr/bin/env bash
# Uso: source tools/activate-android-build-env.sh
# Configura o compilador Android local do projeto sem depender do SDK global.

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo "Use: source tools/activate-android-build-env.sh" >&2
  exit 1
fi

elvanoq_project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export JAVA_HOME="$elvanoq_project_root/.build-cache/jdk-17"
export ANDROID_HOME="$elvanoq_project_root/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export ANDROID_SDK_HOME="$elvanoq_project_root/.build-cache"
export ANDROID_USER_HOME="$elvanoq_project_root/.build-cache/android-user"
export GRADLE_USER_HOME="$elvanoq_project_root/.build-cache/gradle"
export npm_config_cache="$elvanoq_project_root/.build-cache/npm"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

unset elvanoq_project_root
