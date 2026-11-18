# ImageMagick WASM source and rebuilding / ImageMagick WASM 源码与重建

Watermark uses the Q8 wasm32 (upstream calls it x86) binary and its JavaScript glue from `@imagemagick/magick-wasm@0.0.46`. The native package is `@dlemstra/magick-native@2026.1101.825`. The upstream build uses ImageMagick **7.1.2-35**, static dependencies **2026.10.31.2057**, and Emscripten **6.0.6**. The locked binary's SHA-256 is `9d4d47d8cce4317c8dd2c05a57d896d71d99af454ac5d2ab51b43058cee417ae`.

Watermark 使用 `@imagemagick/magick-wasm@0.0.46` 中的 Q8 wasm32（上游名为 x86）二进制及 JavaScript 胶水代码。它对应的原生包、ImageMagick、静态依赖和 Emscripten 版本见上文。发行附件中的 `archives/` 包含包装器、原生模块、ImageMagick、静态库以及构建脚本的源码。每个归档固定到 [revisions.tsv](revisions.tsv) 中的提交。

The release archive contains the source snapshots listed in [revisions.tsv](revisions.tsv), including the upstream build scripts and the libraries from the pinned [WASM dependency build](https://github.com/ImageMagick/Dependencies/blob/8889f5cd9f0e0c1937a89350d95078d28a647a41/.github/build/wasm-x86/build.sh). It includes libde265, GLib, libheif, liblqr and LibRaw under their respective upstream terms. Refer to the accompanying [third-party notices](https://github.com/kinoward/offline-watermark/blob/v1.0.0/THIRD_PARTY.md).

## Rebuild and replace the module / 重建并替换模块

1. Download the release’s source archive and extract it. Run `bash ImageMagick-WASM-source/extract.sh ./magick-sources` to lay out the archives. Make any desired library changes inside `magick-sources/Dependencies/Dependencies/`. 下载并解包发行附件，运行同一命令展开源码，然后在上述目录修改库代码。
2. Use a fresh `emscripten/emsdk:6.0.6` Linux environment and separately extracted source tree for each architecture. Mount that tree at `/sources`. This keeps both the static libraries and the configured build trees separate. Copy the second build’s `publish/wasm/files/x64/` output into the same folder in the x86 tree. The upstream wrapper build needs both glue modules. 在独立解包的源码目录和 Emscripten 环境中分别构建 x86 和 x64，将 x64 的对应产物目录复制回 x86 树，再构建包装器。

   ```bash
   arch=x86  # Run again with x64 in a fresh environment
   export LC_ALL=en_US.UTF-8
   cd /sources/Dependencies
   "./.github/build/wasm-$arch/install.sh"
   "./.github/build/wasm-$arch/build.sh"

   native=/sources/Magick.Native
   cd "$native/build/wasm-$arch"
   ./install.build-tools.sh
   cd "$native/src/ImageMagick/ImageMagick"
   ../../../build/shared/build.imagemagick.sh wasm "$arch" Q8
   cd "$native/src/Magick.Native"
   ../../build/shared/build.native.sh wasm "$arch" Q8

   out="$native/publish/wasm/files/$arch"
   mkdir -p "$out"
   cp Q8/magick.wasm "$out/"
   # The upstream copy script also reads Git metadata. Use its glue
   # transformation with source archives, which contain no .git directory.
   sed 's#magick.wasm",import.meta.url#data:text/plain;base64,"#' Q8/magick.js > "$out/magick.js"
   {
     cat "$native/src/ImageMagick/ImageMagick/LICENSE"
     printf '\n'
     cat /tmp/dependencies/license/*.txt
   } > "$out/NOTICE"
   ```

3. With Node.js 26, generate and pack the native API, then build the wrapper using that local package. 使用 Node.js 26 生成原生接口，打包后用本地包重新构建包装器。Here `magick-sources` is the directory created in step 1.

   ```bash
   cd magick-sources
   magick_sources="$PWD"
   cd Magick.Native/src/wasm-file-creator
   npm ci
   npm run build
   npm run create-wasm-files

   cd "$magick_sources/Magick.Native/publish/wasm"
   bash publish.sh --version 2026.1101.825
   native_tar="$PWD/files/dlemstra-magick-native-2026.1101.825.tgz"

   cd "$magick_sources/magick-wasm"
   npm pkg set "devDependencies.@dlemstra/magick-native=file:$native_tar"
   npm install --ignore-scripts
   node npm-postinstall.mjs
   npm run build
   npm pack --ignore-scripts
   ```

4. Check out the matching Watermark release. Run `npm ci`, then `npm install --no-save /path/to/imagemagick-magick-wasm-0.0.46.tgz` with the wrapper you just built. Update the copied notices if you changed bundled libraries. Run `npm test` and `npm run build:offline -- dist-offline/Watermark.html`, then check a JPEG export in the new HTML. 切换到对应的 Watermark 标签，在本地安装新包装器，更新变更库的声明，重新生成单 HTML 并检查 JPEG 导出。The app loads the module from the local npm package and includes the corresponding glue and WASM together.

[Upstream native build](https://github.com/dlemstra/Magick.Native/blob/ce236bfba506817317517c3d6113b5566ecd03cd/.github/workflows/main.yml) · [Matching app release](https://github.com/kinoward/offline-watermark/releases/tag/v1.0.0)
