#!/usr/bin/env bash
set -Eeuo pipefail

# Prevent a release from being built from a partially restored checkout.  This
# intentionally validates product behaviour markers as well as version fields;
# an APK build must stop before Gradle runs when an approved Fire TV safeguard
# is missing.
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  echo "Preflight de release falhou: $*" >&2
  exit 1
}

package_version="$(node -p "require('$project_root/package.json').version")"
app_version="$(node -e "console.log(require('$project_root/app.json').expo.version)")"
gradle_version="$(sed -nE 's/^[[:space:]]*versionName[[:space:]]+"([^"]+)".*/\1/p' "$project_root/android/app/build.gradle" | head -n1)"
app_code="$(node -e "console.log(require('$project_root/app.json').expo.android.versionCode)")"
gradle_code="$(sed -nE 's/^[[:space:]]*versionCode[[:space:]]+([0-9]+).*/\1/p' "$project_root/android/app/build.gradle" | head -n1)"
constant_version="$(sed -nE 's/^[[:space:]]*version:[[:space:]]*"([^"]+)".*/\1/p' "$project_root/constants/app.ts" | head -n1)"

[[ -n "$package_version" && "$package_version" == "$app_version" && "$package_version" == "$gradle_version" && "$package_version" == "$constant_version" ]] \
  || fail "versões divergentes (package=$package_version, app=$app_version, gradle=$gradle_version, constants=$constant_version)."
[[ -n "$app_code" && "$app_code" == "$gradle_code" ]] \
  || fail "versionCode divergente (app=$app_code, gradle=$gradle_code)."

require_marker() {
  local file="$1" marker="$2" label="$3"
  rg -Fq "$marker" "$project_root/$file" || fail "ajuste crítico ausente: $label ($file)."
}

require_marker 'app/(tabs)/live.tsx' 'function TvCategoryPanel' 'painel de categorias no modo TV'
require_marker 'app/(tabs)/live.tsx' 'function TvChannelPreview' 'preview de canal no modo TV'
require_marker 'app/(tabs)/live.tsx' 'setPreviewChannelId(null);' 'descarregamento do preview ao sair da aba'
require_marker 'app/(tabs)/live.tsx' 'tvChannelTitle: { fontSize: 12' 'fonte de 12 px na lista de canais TV'
require_marker 'app/(tabs)/live.tsx' 'tvProgramTitle: { fontSize: 10' 'fonte de 10 px no EPG TV'
require_marker 'hooks/useEpgPreload.ts' 'const EPG_PRELOAD_CONCURRENCY = 2;' 'limite de concorrência do EPG para Fire TV'
require_marker 'store/useAppStore.ts' 'updateChannelEpgBatch:' 'atualização de EPG em lote'
require_marker 'app/(tabs)/_layout.tsx' 'freezeOnBlur: tvMode' 'congelamento de abas inativas no modo TV'
require_marker 'components/tv-side-navigation.tsx' 'Every available destination remains visible' 'visibilidade do menu lateral com foco'
require_marker 'hooks/use-catalog-pagination.ts' 'const PAGE_SIZE = 80;' 'paginação do catálogo'

echo "Baseline aprovada: ELVANOQ $package_version (build $app_code)"
