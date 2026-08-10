import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'public/logos/press-dark');

const LOGOS = [
  ['faena.png', 'dark'],
  ['maxim.png', 'light'],
  ['the-midway.png', 'light'],
  ['hereticon.png', 'light'],
  ['the-loom.png', 'dark'],
  ['111-minna.png', 'dark'],
  ['dantes-inferno-gpt.png', 'dark'],
  ['fire-gpt.png', 'dark'],
  ['discourse.png', 'dark'],
  ['sanai-gpt.png', 'dark'],
  ['mobilecoin-gpt.png', 'dark'],
];

await fs.mkdir(OUTPUT_DIR, { recursive: true });

for (const [filename, sourceTone] of LOGOS) {
  const input = path.join(ROOT, 'public/logos', filename);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let offset = 0; offset < data.length; offset += info.channels) {
    const luminance = (data[offset] * 0.2126)
      + (data[offset + 1] * 0.7152)
      + (data[offset + 2] * 0.0722);
    const sourceAlpha = data[offset + 3] / 255;
    const contrast = sourceTone === 'dark'
      ? luminance / 255
      : 1 - (luminance / 255);
    const normalized = sourceTone === 'dark'
      ? Math.max(0, Math.min(1, (contrast - 0.23) / 0.5))
      : Math.max(0, Math.min(1, (contrast - 0.12) / 0.76));
    const alpha = Math.round(Math.pow(normalized, 0.42) * 255 * sourceAlpha);

    data[offset] = 43;
    data[offset + 1] = 33;
    data[offset + 2] = 27;
    data[offset + 3] = alpha;
  }

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .trim({ background: { r: 43, g: 33, b: 27, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true })
    .toFile(path.join(OUTPUT_DIR, filename));
}

console.log(`Normalized ${LOGOS.length} press logos into ${OUTPUT_DIR}`);
