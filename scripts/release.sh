#!/usr/bin/env bash
set -euo pipefail

tag=${GITHUB_REF_NAME:?}
repo=${GITHUB_REPOSITORY:?}
server=${GITHUB_SERVER_URL:?}
api=${GITHUB_API_URL:?}
bundle=dist-offline
assets=(Watermark.html ImageMagick-WASM-source.tar.gz SHA256SUMS)
stable_tag='^v(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$'
release_url="$server/$repo/releases"

fail() {
  echo "$*" >&2
  exit 1
}

[[ $tag =~ $stable_tag ]] || fail "Expected a stable vX.Y.Z tag, got $tag"

digest() {
  sha256sum "$1" | cut -d ' ' -f 1
}

check_bundle() {
  local dir=$1
  (cd "$dir" && sha256sum "${assets[@]:0:2}") | cmp - "$dir/SHA256SUMS"
}

download_public_bundle() {
  local dir=$1 file
  mkdir -p "$dir"
  for file in "${assets[@]}"; do
    curl --fail --silent --show-error --location --compressed \
      --retry 3 --retry-all-errors --connect-timeout 10 --max-time 180 \
      "$release_url/download/$tag/$file" --output "$dir/$file"
  done
  check_bundle "$dir"
}

restore_public_bundle() {
  local restored=false status
  if [[ ${GITHUB_RUN_ATTEMPT:?} != 1 ]]; then
    status=$(curl --silent --show-error --retry 3 --connect-timeout 10 --max-time 30 \
      --output /dev/null --write-out '%{http_code}' "$api/repos/$repo/releases/tags/$tag")
    case "$status" in
      200)
        download_public_bundle "$bundle"
        restored=true
        ;;
      404) ;;
      *) fail "Could not determine whether $tag has been published (HTTP $status)" ;;
    esac
  fi
  echo "restored=$restored" >> "${GITHUB_OUTPUT:?}"
}

release_rows() {
  gh api --paginate "repos/$repo/releases?per_page=100" \
    --jq '.[] | [.tag_name, .id, .draft, .prerelease] | @tsv'
}

ensure_current() {
  local rows newest
  rows=$(release_rows)
  newest=$(
    {
      printf '%s\n' "$tag"
      printf '%s\n' "$rows" |
        awk -F '\t' -v pattern="$stable_tag" '$3 == "false" && $4 == "false" && $1 ~ pattern {print $1}'
    } | sort -V | tail -1
  )
  [[ $newest == "$tag" ]] || fail "A newer stable version ($newest) is already public"
}

find_release() {
  release_rows | awk -F '\t' -v tag="$tag" '$1 == tag {print $2, $3, $4}'
}

asset_rows() {
  gh api --paginate "repos/$repo/releases/$1/assets?per_page=100" \
    --jq '.[] | [.name, .state, .size, .digest] | @tsv'
}

check_assets() {
  local rows=$1 upload_missing=$2 file remote size expected
  for file in "${assets[@]}"; do
    remote=$(printf '%s\n' "$rows" | awk -F '\t' -v name="$file" '$1 == name {print $2, $3, $4}')
    if [[ -z $remote && $upload_missing == true ]]; then
      gh release upload "$tag" "$bundle/$file" --repo "$repo"
      continue
    fi
    size=$(wc -c < "$bundle/$file" | tr -d '[:space:]')
    expected="uploaded $size sha256:$(digest "$bundle/$file")"
    [[ $remote == "$expected" ]] ||
      fail "Release asset $file is missing or differs from the verified build"
  done
}

publish_release() {
  local release id draft prerelease rows attempt
  ensure_current
  check_bundle "$bundle"
  release=$(find_release)
  if [[ -z $release ]]; then
    gh release create "$tag" --repo "$repo" --verify-tag --draft --latest=false \
      --title "Watermark $tag" --notes-file "docs/releases/$tag.md"
    # GitHub can create the draft before it appears in the release list.
    for ((attempt = 1; attempt <= 10; attempt++)); do
      release=$(find_release)
      [[ -z $release ]] || break
      if (( attempt < 10 )); then sleep 2; fi
    done
    [[ -n $release ]] || fail "The draft for $tag did not become visible in the release API"
  fi
  read -r id draft prerelease <<< "$release"
  [[ $id =~ ^[0-9]+$ && $prerelease == false ]] ||
    fail "Expected one stable release or draft for $tag"
  rows=$(asset_rows "$id")
  check_assets "$rows" "$draft"
  if [[ $draft == true ]]; then
    rows=$(asset_rows "$id")
    check_assets "$rows" false
    gh release edit "$tag" --repo "$repo" --draft=false --latest=false
  fi
}

wait_for_html() {
  local url=$1 output=$2 deadline=$((SECONDS + 120)) start n=0 timeout remaining delay
  while (( SECONDS < deadline )); do
    start=$SECONDS
    n=$((n + 1))
    remaining=$((deadline - start))
    timeout=$((remaining < 8 ? remaining : 8))
    if curl --fail --silent --show-error --location --compressed \
      --max-time "$timeout" --header 'Cache-Control: no-cache' \
      "$url?watermark-check=${GITHUB_RUN_ID:?}-${GITHUB_RUN_ATTEMPT:?}-$n" --output "$output" &&
      [[ $(digest "$output") == "${EXPECTED_HTML_SHA256:?}" ]]; then
      return
    fi
    remaining=$((deadline - SECONDS))
    (( remaining > 0 )) || break
    delay=$((start + 10 - SECONDS))
    if (( delay > 0 )); then
      sleep "$((delay < remaining ? delay : remaining))"
    fi
  done
  fail "Public HTML did not match the build within 120 seconds at $url"
}

case "${1:-}" in
  restore) restore_public_bundle ;;
  guard) ensure_current ;;
  publish) publish_release ;;
  verify)
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    download_public_bundle "$tmp"
    [[ $(digest "$tmp/SHA256SUMS") == "${EXPECTED_MANIFEST_SHA256:?}" ]] ||
      fail "Public SHA256SUMS differs from the build manifest"
    [[ $(digest "$tmp/Watermark.html") == "${EXPECTED_HTML_SHA256:?}" ]] ||
      fail "Public release HTML differs from the build"
    wait_for_html "${PAGE_URL:?}" "$tmp/Pages.html"
    cmp "$tmp/Watermark.html" "$tmp/Pages.html"
    ;;
  promote)
    ensure_current
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    gh release edit "$tag" --repo "$repo" --latest
    wait_for_html "$release_url/latest/download/Watermark.html" "$tmp/Latest.html"
    {
      printf '## Watermark %s\n\n' "$tag"
      printf -- '- Commit \x60%s\x60\n' "${RELEASE_COMMIT:?}"
      printf -- '- HTML size %s bytes\n' "${HTML_BYTES:?}"
      printf -- '- SHA-256 \x60%s\x60\n' "${EXPECTED_HTML_SHA256:?}"
      printf -- '- [Release](%s/tag/%s) · [Latest download](%s/latest/download/Watermark.html) · [Pages](%s)\n' \
        "$release_url" "$tag" "$release_url" "${PAGE_URL:?}"
    } >> "${GITHUB_STEP_SUMMARY:?}"
    ;;
  *) fail "Expected restore, guard, publish, verify or promote" ;;
esac
