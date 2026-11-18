# Test fixtures / 测试样本

- The three JPEGs use synthetic color or grayscale pixels encoded with `cjpeg`. The progressive 4:2:2 fixture has EXIF orientation 6, different EXIF and JFIF densities, and the [CC0 sRGB-v4 ICC profile](https://github.com/saucecontrol/Compact-ICC-Profiles/blob/master/profiles/sRGB-v4.icc).
- `proof.mjs` creates a three-page PDF with mixed page sizes, crop offsets, rotation, an embedded image and searchable lines. It uses Watermark’s synthetic coastline artwork.
- `encrypted.pdf` and `signed.pdf` were derived from a one-page synthetic PDF with the text “Watermark QA sample”. pypdf encrypted the first file with AES-256 and the public fixture password `watermark-test-fixture`. pyHanko signed the second with a temporary self-signed certificate named “Watermark Test Fixture”.

照片夹具由程序生成像素，再通过 `cjpeg` 编码。多页 PDF 由 `proof.mjs` 生成，覆盖页面尺寸、裁切偏移、旋转、内嵌图片和可搜索文本。两个拒绝样本分别含真实的 AES-256 加密和用于测试的自签名。
