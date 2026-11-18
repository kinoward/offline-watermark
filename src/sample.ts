// A local, original screenprint provides a light and dark surface for the watermark.
const canvas = document.querySelector<HTMLCanvasElement>('#photo-sample')!;
const ctx = canvas.getContext('2d')!;
const { width, height } = canvas;
let seed = 9135;
const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);

const sky = ctx.createLinearGradient(0, 0, 0, height);
sky.addColorStop(0, '#c89a70');
sky.addColorStop(.8, '#f4d5a6');
ctx.fillStyle = sky;
ctx.fillRect(0, 0, width, height);
ctx.fillStyle = '#ffe8b5';
ctx.beginPath();
ctx.arc(width * .68, height * .29, height * .154, 0, Math.PI * 2);
ctx.fill();

function ridge(x: number, layer: number) {
  const offset = layer * 7.13;
  const undulation = Math.sin(x * 9.2 + offset) + .5 * Math.sin(x * 15 - offset)
    + .28 * Math.sin(x * 43 + offset) + .14 * Math.sin(x * 83 - offset)
    + .06 * Math.sin(173 * x + offset) + .025 * Math.sin(341 * x - offset);
  const profile = [0.52, .62, .73, .9, 1.04][layer];
  return height * (profile + undulation * (.043 + layer * .008) -
    .17 * Math.exp(-Math.pow((x - (.29 + .09 * layer)) / .19, 2)));
}
const layers = ['#b5a08b', '#9d8878', '#807973', '#5e6563', '#363f40'];
for (const [layer, color] of layers.entries()) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= width; x++) ctx.lineTo(x, ridge(x / width, layer));
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.clip();
  for (let x = -140; x < width + 140; x += 1.6 + random() * 1.7) {
    const y = ridge(x / width, layer);
    const side = ridge((x + 2) / width, layer) - y;
    ctx.strokeStyle = side < 0 ? 'rgba(255,231,190,.13)' : 'rgba(50,43,41,.12)';
    ctx.lineWidth = .6 + random();
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    for (let t = 0; t < height; t += 8) {
      ctx.lineTo(x + .32 * t * Math.tanh(side) + 6 * Math.sin(t / 35 + x / 80), y + t);
    }
    ctx.stroke();
  }
  ctx.restore();
}
const image = ctx.getImageData(0, 0, width, height);
for (let i = 0; i < image.data.length; i += 4) {
  const grain = (random() - .5) * 18;
  for (let channel = 0; channel < 3; channel++) image.data[i + channel] += grain;
}
ctx.putImageData(image, 0, 0);
