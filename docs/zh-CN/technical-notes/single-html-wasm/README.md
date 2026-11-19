# 单 HTML 打包与 WASM 按需加载

**总结日期** 2026-11-19

[技术沉淀目录](../../../../README.zh-CN.md#技术沉淀) · [English](../../../en/technical-notes/single-html-wasm/README.md)

## 项目问题

Watermark 的在线版和离线版共用一个 HTML。离线版从 `file://` 打开时，Worker 与编解码器也要能启动。v1.0.0 先将两份 WASM 各自转为 Base64 Data URL 放进对应的 Worker 脚本，再对整个脚本做 gzip 和 Base64。WASM 经过两层文本编码，加载任一 Worker 时还要解开包含二进制数据的整段脚本。[v1.0.0 构建脚本](https://github.com/kinoward/offline-watermark/blob/v1.0.0/scripts/build-offline.mjs)

## 实现决策

- **分别压缩四份资源。** 构建脚本内联 Vite 生成的页面 JS 和 CSS。两个 Worker 脚本、ImageMagick WASM 和 PDFium WASM 各自先 gzip 再 Base64，以数据块写入 HTML。离线构建提前移除 PDFium 的 WASM URL 回退，避免 Vite 在脚本里再嵌入一份。构建时将压缩后的 WASM 解码、解压并与原始字节比较，也检查构建块是否仍有外部依赖。[离线构建脚本](../../../../scripts/build-offline.mjs)
- **按需启动并传入字节。** 页面在需要时解包脚本，用 Blob URL 创建经典 Worker。首个 JPEG 请求将压缩的 ImageMagick WASM 通过 transferable 送入处理 Worker，首个画布预览请求则将 PDFium WASM 送入页面渲染 Worker。PDF 写入由 pdf-lib 完成，可以先于这两份 WASM 的加载。JPEG Worker 先保存收到的压缩数据，等输入检查通过并开始初始化编解码器时才取用。[Worker 加载器](../../../../src/processor-client-offline.ts) · [处理 Worker](../../../../src/processor.ts)
- **给解压器传字节流。** WebKit 中，从本地文件启动的 Worker 曾遇到 Blob 流读取失败。项目将压缩字节直接放入 `ReadableStream`，再交给 `DecompressionStream('gzip')`，让解包过程走同一条字节流路径。[解包实现](../../../../src/offline-gzip.ts) · [Compression Standard](https://compression.spec.whatwg.org/)

## 验证与边界

浏览器回归测试先移走 ImageMagick 数据块并完成 PDF 预览和导出，以确认 PDF 路径无需加载它。测试再放回数据块，用同一个导出 Worker 处理一个无效 JPEG 并检查报错，随后成功导出有效 JPEG，以确认首次请求失败后压缩数据仍可用于下一次请求。[回归测试提交](https://github.com/kinoward/offline-watermark/commit/0cac5ce)

公开下载的原始 `Watermark.html` 从 **15,372,733 字节**降到 **12,080,093 字节**，减少 **21.42%**。对比使用两次发布附件的字节数。HTTP 传输体积还取决于服务器的内容编码，实际首次处理耗时还取决于浏览器、设备与输入文件。[v1.0.0 附件](https://github.com/kinoward/offline-watermark/releases/tag/v1.0.0) · [v1.0.3 附件](https://github.com/kinoward/offline-watermark/releases/tag/v1.0.3)
