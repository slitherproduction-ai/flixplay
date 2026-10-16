#!/usr/bin/env bash
set -Eeuo pipefail

# Converts the small set of Gradle plugin artifacts with incomplete marker
# metadata into a deterministic local Maven repository.  Files are copied only
# from the persisted Gradle cache; this script never contacts a repository.
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache_root="${ELVANOQ_BUILD_CACHE:-$project_root/.build-cache}"
cache_modules="$cache_root/gradle/caches/modules-2/files-2.1"
repo_root="$cache_root/offline-maven"

publish() {
  local cache_group="$1" maven_group="$2" artifact="$3" version="$4"
  local source_dir="$cache_modules/$cache_group/$artifact/$version"
  local target_dir="$repo_root/$maven_group/$artifact/$version"

  [[ -d "$source_dir" ]] || {
    echo "Artefato offline ausente: $cache_group:$artifact:$version" >&2
    exit 1
  }
  mkdir -p "$target_dir"
  find "$source_dir" -type f -exec cp -f {} "$target_dir/" \;
}

publish org.gradle.toolchains org/gradle/toolchains foojay-resolver 1.0.0
publish com.diffplug.spotless com/diffplug/spotless spotless-plugin-gradle 8.1.0
publish com.diffplug.spotless com/diffplug/spotless spotless-lib 4.1.0
publish com.diffplug.spotless com/diffplug/spotless spotless-lib-extra 4.1.0

printf '%s\n' "$repo_root"
