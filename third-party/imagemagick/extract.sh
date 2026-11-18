#!/usr/bin/env bash
set -euo pipefail

archive_root="$(cd "$(dirname "$0")" && pwd)"
destination="$(mkdir -p "${1:?Usage: extract.sh EMPTY-FOLDER}" && cd "$1" && pwd)"

if [[ -n "$(ls -A "$destination")" ]]; then
  echo "Use an empty destination folder." >&2
  exit 1
fi

while IFS=$'\t' read -r repo revision; do
  name="${repo##*/}"
  case "$name" in
    Magick.Native|magick-wasm|Dependencies)
      path="$destination/$name"
      ;;
    ImageMagick)
      path="$destination/Magick.Native/src/ImageMagick/ImageMagick"
      ;;
    *)
      path="$destination/Dependencies/Dependencies/$name"
      ;;
  esac
  mkdir -p "$path"
  tar -xzf "$archive_root/archives/$name.tar.gz" --strip-components=1 -C "$path"
done < "$archive_root/revisions.tsv"
