# Matching ImageMagick WASM to its source and rebuilding it

**Summary date** 2026-11-19

[Engineering notes](../../../../README.md#engineering-notes) · [简体中文](../../../zh-CN/technical-notes/imagemagick-wasm-rebuild/README.md)

## Project problem

Watermark uses precompiled ImageMagick WASM from an npm dependency. Replacing a statically linked library takes the native module, build scripts and original static dependencies as well as the JavaScript wrapper. The source bundle needs to trace back to the binary shipped in the HTML.

## Implementation decisions

- **Record which source matches the binary.** The app uses the Q8 wasm32 binary and JavaScript glue from `@imagemagick/magick-wasm@0.0.46`. Upstream calls this target `x86`. The rebuild guide records the native package, static dependency and Emscripten versions. The revision list pins the wrapper, native module, ImageMagick, dependency build scripts and individual static libraries to commits. [Rebuild guide](../../../../third-party/imagemagick/README.md) · [Pinned revisions](../../../../third-party/imagemagick/revisions.tsv)
- **Assemble archives from the revision list.** The packer downloads each source snapshot by commit, checks that the archive is readable and verifies that the archive root matches the expected commit. The extraction script places ImageMagick and the static libraries in the locations expected by the upstream native and dependency builds. [Source packer](../../../../scripts/pack-imagemagick-source.mjs) · [Extraction script](../../../../third-party/imagemagick/extract.sh)
- **Build the native module and npm wrapper separately.** In the documented Emscripten environment, build the upstream `x86` and `x64` outputs in separate source trees. The wrapper build needs both glue modules. The source snapshots lack `.git`, which the upstream output-copy step reads. The rebuild guide applies the needed glue transformation and arranges the outputs before packaging the native API and wrapper locally. [Rebuild and replacement steps](../../../../third-party/imagemagick/README.md)

## Verification and limits

The release workflow records the archive and HTML digests in `SHA256SUMS`. To check a replacement, install the locally built wrapper in the matching Watermark version, run the unit tests, rebuild the HTML and exercise a JPEG export as the guide describes. The checksum covers download integrity and the export check covers integration behavior. Establishing that a rebuild produces an identical binary takes a separate byte comparison. [Release verification](../../../../.github/workflows/release.yml) · [JPEG export scenario](../../../../tests/browser/smoke.mjs)
