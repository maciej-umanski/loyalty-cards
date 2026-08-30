import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../public/icons/icon.svg', import.meta.url));
const outDir = fileURLToPath(new URL('../public/icons/', import.meta.url));

await mkdir(outDir, { recursive: true });

const jobs = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['apple-touch-icon.png', 180, false],
  ['icon-maskable-512.png', 512, true]
];

for (const [name, size, maskable] of jobs) {
  let img;
  if (maskable) {
    // Pad the artwork so masked shapes don't crop it (safe zone = 80%).
    const pad = Math.round(size * 0.06);
    const inner = size - pad * 2;
    img = sharp(source, { density: 600 })
      .resize(inner, inner)
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 99, g: 102, b: 241 } });
  } else {
    img = sharp(source, { density: 600 }).resize(size, size);
  }
  await img.png().toFile(`${outDir}/${name}`);
  console.log(`generated ${name}`);
}
