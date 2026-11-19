import { messageError } from './messages.ts';
import { inspectJpeg, restoreJpegMetadata, type JpegMetadata } from './jpeg-metadata.ts';
import { createJpegOverlay, type MarkOptions } from './layout.ts';
import { unpackWasm } from './offline-gzip.ts';

type Codec = typeof import('@imagemagick/magick-wasm');
let codecPromise: Promise<Codec> | undefined;

function loadCodec(takeWasmGzip: () => ArrayBuffer | undefined): Promise<Codec> {
  const sourcePromise = import.meta.env.WATERMARK_OFFLINE
    ? unpackWasm(takeWasmGzip()).then((bytes) => new Uint8Array(bytes))
    : import('@imagemagick/magick-wasm/magick.wasm?url&no-inline')
      .then(({ default: url }) => new URL(url, self.location.href));
  return Promise.all([import('@imagemagick/magick-wasm'), sourcePromise]).then(async ([codec, source]) => {
    await codec.initializeImageMagick(source);
    return codec;
  });
}

export function applyJpegOverlay(
  codec: Codec,
  input: ArrayBuffer,
  overlay: ArrayBuffer,
  quality: number,
  source: JpegMetadata,
  clearExif = false,
): ArrayBuffer {
  const { ColorSpace, CompositeOperator, ImageMagick, Interlace, MagickFormat } = codec;
  const encoded = ImageMagick.read(new Uint8Array(input), MagickFormat.Jpeg, (image) => {
    ImageMagick.read(new Uint8Array(overlay), MagickFormat.Png, (mark) => {
      image.composite(mark, CompositeOperator.Over);
    });

    if (clearExif && source.exif) {
      // Apply orientation to the composited pixels before removing its tag.
      image.autoOrient();
      image.removeProfile('exif');
    }

    if (source.componentCount === 1) {
      image.colorSpace = ColorSpace.Gray;
    } else {
      // A JPEG can carry an RGB sampling grid even if all its pixels are gray.
      image.settings.colorType = codec.ColorType.TrueColor;
    }
    image.settings.interlace = source.progressive ? Interlace.Jpeg : Interlace.NoInterlace;
    image.settings.setDefine('jpeg:sampling-factor', source.sampling);
    image.quality = quality;
    return image.write(MagickFormat.Jpeg, (bytes) => bytes.slice().buffer as ArrayBuffer);
  });
  return restoreJpegMetadata(encoded, source, clearExif);
}

export async function watermarkJpeg(
  input: ArrayBuffer,
  options: MarkOptions,
  takeWasmGzip: () => ArrayBuffer | undefined,
): Promise<ArrayBuffer> {
  const source = inspectJpeg(input);
  if (source.width * source.height > 50_000_000) {
    throw messageError('imageTooLarge');
  }

  const [codec, overlay] = await Promise.all([
    codecPromise ??= loadCodec(takeWasmGzip),
    createJpegOverlay(source.width, source.height, source.orientation, options),
  ]);
  return applyJpegOverlay(codec, input, overlay, options.quality, source, options.clearExif);
}
