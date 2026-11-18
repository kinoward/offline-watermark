import { messageError } from './messages.ts';
import { inspectJpeg, restoreJpegMetadata, type JpegMetadata } from './jpeg-metadata.ts';
import { createJpegOverlay, type MarkOptions } from './layout.ts';
import { decodeBase64 } from './base64.ts';

type Codec = typeof import('@imagemagick/magick-wasm');
let codecPromise: Promise<Codec> | undefined;

function loadCodec(): Promise<Codec> {
  codecPromise ??= Promise.all([
    import('@imagemagick/magick-wasm'),
    import('@imagemagick/magick-wasm/magick.wasm?url&no-inline'),
  ]).then(async ([codec, { default: url }]) => {
    // The ImageMagick URL loader only accepts HTTP(S); feed it bytes in the offline build.
    const prefix = 'data:application/wasm;base64,';
    const source = url.startsWith(prefix)
      ? decodeBase64(url.slice(prefix.length))
      : new URL(url, self.location.href);
    await codec.initializeImageMagick(source);
    return codec;
  });
  return codecPromise;
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

export async function watermarkJpeg(input: ArrayBuffer, options: MarkOptions): Promise<ArrayBuffer> {
  const source = inspectJpeg(input);
  if (source.width * source.height > 50_000_000) {
    throw messageError('imageTooLarge');
  }

  const [codec, overlay] = await Promise.all([
    loadCodec(),
    createJpegOverlay(source.width, source.height, source.orientation, options),
  ]);
  return applyJpegOverlay(codec, input, overlay, options.quality, source, options.clearExif);
}
