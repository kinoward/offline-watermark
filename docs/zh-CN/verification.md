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

等 CI 通过后，为 `main` 上的提交推送带注释的 `vX.Y.Z` 标签。标签、npm 版本和双语发行说明须一致。工作流只构建一份 HTML，从磁盘和本地 HTTP 运行浏览器检查，然后发布带版本号的 Release、对应的 ImageMagick 源码包和校验和。Pages 部署同一份 HTML，公开文件核对通过后，Release 才标为 Latest。[发行工作流](../../.github/workflows/release.yml) · [校验公开下载](../../tests/README.zh-CN.md#校验公开下载)

使用 **Re-run failed jobs** 可从失败处继续，构建产物保留七天。已经公开的版本及验证过的附件会被复用。如果产物已过期而带版本号的 Release 已公开，重跑整个工作流会取回该 Release 的文件，核验后再部署。[ImageMagick 源码与重建](../../third-party/imagemagick/README.md)
