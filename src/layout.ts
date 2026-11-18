export type MarkOptions = {
  text: string;
  opacity: number;
  quality: number;
  clearExif: boolean;
  size: number;
  density: number;
};

export type Tile = {
  png: ArrayBuffer;
  width: number;
  height: number;
};

const angle = -Math.PI / 6;
const family = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const font = (size: number) => `600 ${size}px ${family}`;

function makeTile(options: MarkOptions, shortSide: number, scale: number) {
  const lines = options.text.replace(/\r\n?/g, '\n').split('\n');
  const metrics = new OffscreenCanvas(1, 1).getContext('2d')!;
  let size = shortSide * 0.046;
  metrics.font = font(size);
  let textWidth = Math.max(1, ...lines.map((line) => metrics.measureText(line).width));
  if (textWidth > shortSide * 0.58) {
    size *= shortSide * 0.58 / textWidth;
    metrics.font = font(size);
    textWidth = Math.max(...lines.map((line) => metrics.measureText(line).width));
  }

  const lineHeight = size * 1.32;
  const contentWidth = textWidth + size * 0.55;
  const contentHeight = lineHeight * lines.length + size * 0.18;
  const width = contentWidth * Math.cos(angle) + contentHeight * Math.abs(Math.sin(angle));
  const height = contentHeight * Math.cos(angle) + contentWidth * Math.abs(Math.sin(angle));
  // Scale the whole tile after fitting its text so long lines also respond to size.
  const multiplier = Math.min(options.size, shortSide * 0.9 / Math.max(width, height));
  const tileWidth = width * multiplier;
  const tileHeight = height * multiplier;
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.ceil(tileWidth * scale)), Math.max(1, Math.ceil(tileHeight * scale)),
  );
  const ctx = canvas.getContext('2d')!;
  ctx.scale(canvas.width / width, canvas.height / height);
  ctx.translate(width / 2, height / 2);
  ctx.rotate(angle);
  ctx.font = font(size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = options.opacity;
  ctx.fillStyle = '#35353a';
  lines.forEach((line, row) => {
    ctx.fillText(line, 0, (row - (lines.length - 1) / 2) * lineHeight);
  });
  return { canvas, width: tileWidth, height: tileHeight };
}

export async function createTile(options: MarkOptions, shortSide: number, scale = 1): Promise<Tile> {
  const { canvas, width, height } = makeTile(options, shortSide, scale);
  return { png: await canvasPng(canvas), width, height };
}

async function canvasPng(canvas: OffscreenCanvas): Promise<ArrayBuffer> {
  const png = await canvas.convertToBlob({ type: 'image/png' });
  try {
    return await png.arrayBuffer();
  } catch (error) {
    if (self.location.origin !== 'null' || !(error instanceof DOMException) ||
        error.name !== 'NotReadableError') throw error;
    // WebKit cannot read a canvas Blob created by a worker on file://.
    const { default: upng } = await import('@pdf-lib/upng');
    const { width, height } = canvas;
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, width, height);
    return upng.encode([data.buffer], width, height, 0);
  }
}

export function* tilePositions(width: number, height: number, tile: Pick<Tile, 'width' | 'height'>, density: number) {
  const gap = Math.min(width, height) * 0.085 / density;
  const stepX = tile.width + gap;
  const stepY = tile.height * 0.75 + gap;
  for (let row = 0, y = -tile.height * 0.18; y < height; row++, y += stepY) {
    const start = (row % 2 ? stepX / 2 : 0) - tile.width * 0.24 - stepX;
    for (let x = start; x < width; x += stepX) {
      if (x + tile.width > 0) yield { x, y };
    }
  }
}

export function paintPattern(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number, height: number, options: MarkOptions) {
  const tile = makeTile(options, Math.min(width, height), 1);
  for (const { x, y } of tilePositions(width, height, tile, options.density)) {
    ctx.drawImage(tile.canvas, x, y, tile.width, tile.height);
  }
}

// Draw the visually oriented pattern through the inverse EXIF transform, so the
// JPEG can keep its stored dimensions and its original orientation tag.
export async function createJpegOverlay(width: number, height: number, orientation: number,
  options: MarkOptions): Promise<ArrayBuffer> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  const transforms: Record<number, [number, number, number, number, number, number]> = {
    1: [1, 0, 0, 1, 0, 0],
    2: [-1, 0, 0, 1, width, 0],
    3: [-1, 0, 0, -1, width, height],
    4: [1, 0, 0, -1, 0, height],
    5: [0, 1, 1, 0, 0, 0],
    6: [0, -1, 1, 0, 0, height],
    7: [0, -1, -1, 0, width, height],
    8: [0, 1, -1, 0, width, 0],
  };
  ctx.setTransform(...transforms[orientation]);
  paintPattern(ctx, orientation >= 5 ? height : width, orientation >= 5 ? width : height, options);
  return canvasPng(canvas);
}
