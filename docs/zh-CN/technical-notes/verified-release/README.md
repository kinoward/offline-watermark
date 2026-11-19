# 单产物发版与公开字节校验

**总结日期** 2026-11-19

[技术沉淀目录](../../../../README.zh-CN.md#技术沉淀) · [English](../../../en/technical-notes/verified-release/README.md)

## 项目问题

GitHub Release 和 Pages 是两个分发入口。分别构建或只验证部署任务的结果，无法证明下载内容与测试过的 HTML 一致。HTML 文件头还标有对应源码包的发布地址，因此 Pages 切到新版之前，版本化 Release 必须已经可公开下载。

## 实现决策

1. **只构建一次。** 工作流验证带注释的稳定版本标签、npm 版本和提交与 `main` 的关系。构建并测试 `Watermark.html`，生成源码包与 `SHA256SUMS`，将 HTML 原样复制为 Pages 的 `index.html`，用 `cmp` 核对。下游通过构建作业输出取得对应的产物名称和摘要。[发版工作流](../../../../.github/workflows/release.yml)
2. **先公开版本化 Release。** 创建或续用草稿，补齐缺失的附件，按上传状态、文件大小和 SHA-256 校验三个预期附件。附件摘要不符时停止。草稿公开时保留原有 Latest 指向，然后部署已经核对过的 Pages 产物。[发版脚本](../../../../scripts/release.sh) · [Release 附件 API](https://docs.github.com/en/rest/releases/assets#list-release-assets)
3. **从公开地址验证，再更新 Latest。** 无凭据下载版本化附件，对比构建时的清单摘要和 HTML 摘要。用 `curl --compressed` 得到解开 HTTP 内容编码后的页面字节，再做 SHA-256 和 `cmp` 核对。通过后更新 Latest，并检查 Latest 下载响应。Pages 和 Latest 的公开检查用有界轮询处理 CDN 刷新延迟。[公开校验与更新脚本](../../../../scripts/release.sh)

## 验证与边界

v1.0.3 首次运行时构建已通过，发布步骤创建草稿后立即查询列表，草稿尚未可见。重跑失败作业时，流程复用了成功构建的输出，最终完成发布与校验。后续提交 `c091345` 为创建草稿后的查询加上有界轮询，这一修复位于 `main`，晚于 v1.0.3 标签。[首次尝试](https://github.com/kinoward/offline-watermark/actions/runs/44477208386/attempts/1) · [成功重跑](https://github.com/kinoward/offline-watermark/actions/runs/44477208386/attempts/2) · [草稿轮询修复](https://github.com/kinoward/offline-watermark/commit/c091345)

产物名称带构建尝试号，并由成功的构建作业输出。GitHub 重跑保留原始提交和未重跑作业的输出，因此下游可继续使用原产物。已过七天保留期且同版本 Release 已公开时，可重跑整个流程，从版本化附件取回并核验原始文件。若 Latest 更新后的下载校验失败，指向已经更新，重跑失败作业会再次执行更新与下载校验。发布、部署和更新 Latest 都会检查是否已有更新的稳定版本公开，避免重跑旧标签时回退线上版本。[重跑规则](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs) · [构建与恢复说明](../../verification.md#核对公开版本)
