import sharp from "sharp";
import { featheredAlpha } from "./mask";

const JPEG_QUALITY = 92;
const MAX_LONG_SIDE = 3000;
const DISCLAIMER = "Immagine a titolo esemplificativo";

export type ProviderSize = { width: number; height: number };

/**
 * Rotazione EXIF applicata, metadati rimossi (default di sharp), lato lungo
 * al massimo 3000 px (senza ingrandire), JPEG q92.
 */
export async function normalizePhoto(
  input: Buffer,
): Promise<{ jpeg: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input)
    .autoOrient()
    .resize({
      width: MAX_LONG_SIDE,
      height: MAX_LONG_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer({ resolveWithObject: true });
  return { jpeg: data, width: info.width, height: info.height };
}

/** Dimensione supportata con le proporzioni più vicine a w×h. */
export function pickProviderSize(w: number, h: number, supported: ProviderSize[]): ProviderSize {
  if (supported.length === 0) throw new Error("Nessuna dimensione supportata");
  const target = Math.log(w / h);
  let best = supported[0];
  let bestDiff = Infinity;
  for (const s of supported) {
    const diff = Math.abs(Math.log(s.width / s.height) - target);
    if (diff < bestDiff) {
      best = s;
      bestDiff = diff;
    }
  }
  return best;
}

export async function toProviderSize(img: Buffer, size: ProviderSize): Promise<Buffer> {
  return sharp(img).resize(size.width, size.height, { fit: "fill" }).png().toBuffer();
}

export async function fromProviderSize(img: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp(img).resize(width, height, { fit: "fill" }).png().toBuffer();
}

/** Decodifica in RGB grezzo a 3 canali, verificando le dimensioni. */
async function decodeRgb(img: Buffer, w: number, h: number, label: string): Promise<Buffer> {
  let { data, info } = await sharp(img).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) {
    ({ data, info } = await sharp(img)
      .removeAlpha()
      .toColourspace("srgb")
      .raw()
      .toBuffer({ resolveWithObject: true }));
  }
  if (info.width !== w || info.height !== h || info.channels !== 3) {
    throw new Error(
      `Immagine ${label} ${info.width}×${info.height}×${info.channels}, attesa ${w}×${h}×3`,
    );
  }
  return data;
}

/**
 * original·(1−α) + generated·α su RGB grezzo, con α da featheredAlpha(mask).
 * Dove α = 0 (fuori dalla maschera allargata) i byte dell'originale decodificato
 * vengono copiati tali e quali: nessun pixel della casa cambia.
 */
export async function compositeRaw(
  original: Buffer,
  generated: Buffer,
  mask: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  const [orig, gen, alpha] = await Promise.all([
    decodeRgb(original, width, height, "originale"),
    decodeRgb(generated, width, height, "generata"),
    featheredAlpha(mask, width, height),
  ]);
  const out = Buffer.from(orig); // copia: partiamo dall'originale esatto
  for (let i = 0, j = 0; i < alpha.length; i++, j += 3) {
    const a = alpha[i];
    if (a === 0) continue;
    if (a === 255) {
      out[j] = gen[j];
      out[j + 1] = gen[j + 1];
      out[j + 2] = gen[j + 2];
      continue;
    }
    const b = 255 - a;
    out[j] = Math.round((orig[j] * b + gen[j] * a) / 255);
    out[j + 1] = Math.round((orig[j + 1] * b + gen[j + 1] * a) / 255);
    out[j + 2] = Math.round((orig[j + 2] * b + gen[j + 2] * a) / 255);
  }
  return out;
}

/** Come compositeRaw, codificato in JPEG q92. */
export async function composite(
  original: Buffer,
  generated: Buffer,
  mask: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  const raw = await compositeRaw(original, generated, mask, width, height);
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

/**
 * Dicitura in basso a destra, bianca con ombra, alta il 2% della foto.
 * Usa composite di sharp: qui non serve l'identità dei pixel.
 */
export async function addDisclaimer(jpeg: Buffer, width: number, height: number): Promise<Buffer> {
  const fontSize = Math.max(10, Math.round(0.02 * height));
  const margin = Math.round(fontSize * 0.8);
  const shadow = Math.max(1, Math.round(fontSize / 12));
  const x = width - margin;
  const y = height - margin;
  const text = (dx: number, fill: string, extra = "") =>
    `<text x="${x + dx}" y="${y + dx}" font-size="${fontSize}" font-family="Helvetica, Arial, DejaVu Sans, sans-serif" ` +
    `text-anchor="end" fill="${fill}"${extra}>${DISCLAIMER}</text>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    text(shadow, "#000", ' fill-opacity="0.6"') +
    text(0, "#fff") +
    `</svg>`;
  return sharp(jpeg)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}
