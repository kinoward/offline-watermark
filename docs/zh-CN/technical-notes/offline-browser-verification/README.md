# 单文件的离线与托管验证

**总结日期** 2026-11-19

[技术沉淀目录](../../../../README.zh-CN.md#技术沉淀) · [English](../../../en/technical-notes/offline-browser-verification/README.md)

## 项目问题

页面能打开，只验证了初始资源。JPEG 编解码、PDF 画布渲染和下载在交互之后才发生。开发服务器还可能替浏览器补上漏打包的资源，因此检查必须使用交付的 HTML，并且走到实际导出。

## 实现决策

- **用同一文件测试两个入口。** Chromium、Firefox 和 WebKit 分别通过 `file://` 打开成品。本地 HTTP 入口只在环回地址提供这份 HTML，找不到的路径返回 404，然后在 Chromium 中复用同一套用例。[本地 HTTP 测试入口](../../../../tests/browser/hosted.mjs) · [发版工作流](../../../../.github/workflows/release.yml)
- **请求尝试本身也算失败。** Playwright 在导航前给浏览器上下文安装 HTTP(S) 与 WebSocket 路由，记录并阻断意外请求，测试结束后断言记录为空。上下文设置 `serviceWorkers: 'block'`，避免 Service Worker 截获请求后绕过路由断言。HTTP 模式只放行目标 URL 的主文档导航，因而也允许刷新同一文档。[拦截和断言](../../../../tests/browser/smoke.mjs) · [Playwright 请求拦截](https://playwright.dev/docs/api/class-browsercontext#browser-context-route)

## 验证与边界

桌面用例下载 JPEG 并检查元数据，还会重新导入成品。模拟触屏用例生成并下载多页 PDF，核对原始内容流，并用 PDFium 从导出件提取正文。测试同时检查页面错误。安装依赖和浏览器后，可在仓库根目录对同一次构建运行以下两条检查。[测试环境与覆盖范围](../../../../tests/README.zh-CN.md#本地运行)

```sh
npm run test:browser -- dist-offline/Watermark.html
node tests/browser/hosted.mjs dist-offline/Watermark.html
```

结论覆盖这些用例中观察到的 HTTP(S) 与 WebSocket 请求。Playwright WebKit 和模拟触屏视口分别提供引擎和布局覆盖。真实线上交付的字节一致性由公开下载校验负责。[单产物发版与公开字节校验](../verified-release/README.md)
