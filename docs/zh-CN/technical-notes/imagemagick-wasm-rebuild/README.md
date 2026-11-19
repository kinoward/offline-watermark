# ImageMagick WASM 的源码对应与重建

**总结日期** 2026-11-19

[技术沉淀目录](../../../../README.zh-CN.md#技术沉淀) · [English](../../../en/technical-notes/imagemagick-wasm-rebuild/README.md)

## 项目问题

Watermark 通过 npm 依赖使用预编译的 ImageMagick WASM。若要替换其中一个静态库，仅拿到 JavaScript 包装器的源码还缺少原生模块、构建脚本和原构建使用的静态依赖。源码包需要能追溯到随 HTML 分发的二进制。

## 实现决策

- **记录二进制和源码的对应关系。** 应用使用 `@imagemagick/magick-wasm@0.0.46` 的 Q8 wasm32 和配套的 JavaScript 胶水代码，上游将这一目标称为 `x86`。重建指南记录原生包、静态依赖版本和 Emscripten 版本。修订清单固定包装器、原生模块、ImageMagick、依赖构建脚本以及各静态库的提交。[重建指南](../../../../third-party/imagemagick/README.md) · [固定修订清单](../../../../third-party/imagemagick/revisions.tsv)
- **用修订清单组织归档。** 打包脚本按提交下载源码，检查归档可读且顶层目录匹配预期提交。解包脚本把静态库和 ImageMagick 分别放回依赖构建和原生构建预期的目录，供上游脚本使用。[源码打包](../../../../scripts/pack-imagemagick-source.mjs) · [解包脚本](../../../../third-party/imagemagick/extract.sh)
- **分开构建原生模块和 npm 包装器。** 按项目记录的 Emscripten 环境，在独立源码树构建上游的 `x86` 和 `x64` 两组产物，包装器构建需要两组胶水模块。源码快照没有 `.git`，而上游拷贝产物的步骤会读取 Git 元数据。因此按重建指南执行所需的胶水代码改写和文件整理，再打包本地原生接口和包装器。[重建和替换步骤](../../../../third-party/imagemagick/README.md)

## 验证与边界

发版时将源码包和 HTML 的摘要一并写入 `SHA256SUMS`。替换模块时，按指南在匹配的 Watermark 版本安装本地包装器，跑单测、重新构建 HTML，并实际检查 JPEG 导出。附件摘要验证下载字节，导出检查验证替换后的模块能在应用中工作。重建结果的二进制一致性需要另行逐字节比较。[发版校验](../../../../.github/workflows/release.yml) · [JPEG 导出用例](../../../../tests/browser/smoke.mjs)
