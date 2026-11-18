# 构建与分发

[首页](../../README.zh-CN.md) · [English](../en/verification.md) · [技术选型](architecture.md) · [测试指南](../../tests/README.zh-CN.md)

## 从干净的克隆构建

使用 Vite 支持的 Node.js 发行线，最低版本为 22.18。在仓库根目录安装锁定的依赖，然后构建离线文件。

```sh
npm ci
npm run build:offline -- dist-offline/Watermark.html
```

构建命令会检查应用类型，内联页面和 Worker，并核对所需资源是否都已嵌入。用浏览器直接打开 `dist-offline/Watermark.html` 即可。[离线构建脚本](../../scripts/build-offline.mjs) · [单文件构建原理](architecture.md#让构建结果可以通过-file-打开)

## 验证覆盖范围

测试指南列出了日常改动对应的检查、发版时覆盖的浏览器，以及 v1.0.0 的验证记录。[Watermark 测试指南](../../tests/README.zh-CN.md)

## 核对公开版本

为 `main` 上的提交推送 `v*` 版本标签会启动发行流程。工作流核对包版本，构建并测试 HTML，再打包对应的 ImageMagick 源码。GitHub Releases 提供已通过测试的 `Watermark.html`，Pages 将同一份文件以 `index.html` 发布。Pages 部署环境允许发行标签部署。[发行工作流](../../.github/workflows/release.yml) · [ImageMagick 源码与重建](../../third-party/imagemagick/README.md) · [校验公开下载](../../tests/README.zh-CN.md#校验公开下载)
