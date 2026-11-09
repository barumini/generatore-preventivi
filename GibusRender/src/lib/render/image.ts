import sharp from "sharp";
import { featheredAlpha } from "./mask";

/** Unica impostazione di codifica JPEG per tutte le immagini consegnate. */
const JPEG_OPTIONS = { quality: 92, chromaSubsampling: "4:4:4" } as const;
const MAX_LONG_SIDE = 3000;
const DISCLAIMER = "Immagine a titolo esemplificativo";

export type ProviderSize = { width: number; height: number };

/**
 * Rotazione EXIF applicata, metadati rimossi (default di sharp), lato lungo
 * al massimo 3000 px (senza ingrandire), JPEG q92 4:4:4 (stesso
 * sottocampionamento dell'uscita di composite).
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
    .jpeg(JPEG_OPTIONS)
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

export type CompositeOptions = {
  /** Disegna la dicitura sul risultato grezzo, prima dell'unica codifica. */
  disclaimer?: boolean;
  /** Alfa grezzo a 1 canale già calcolato con featheredAlpha: evita di ricalcolare l'EDT. */
  alpha?: Buffer;
};

/** SVG a piena dimensione con la dicitura in basso a destra, bianca con ombra. */
function disclaimerSvg(width: number, height: number): Buffer {
  const fontSize = Math.max(10, Math.round(0.02 * height));
  const margin = Math.round(fontSize * 0.8);
  const shadow = Math.max(1, Math.round(fontSize / 12));
  const x = width - margin;
  const y = height - margin;
  const text = (dx: number, fill: string, extra = "") =>
    `<text x="${x + dx}" y="${y + dx}" font-size="${fontSize}" font-family="Helvetica, Arial, DejaVu Sans, sans-serif" ` +
    `text-anchor="end" fill="${fill}"${extra}>${DISCLAIMER}</text>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      text(shadow, "#000", ' fill-opacity="0.6"') +
      text(0, "#fff") +
      `</svg>`,
  );
}

/** Miscela pura in TypeScript: dove α = 0 i byte dell'originale restano intatti. */
async function blendRaw(
  original: Buffer,
  generated: Buffer,
  mask: Buffer,
  width: number,
  height: number,
  alphaIn?: Buffer,
): Promise<Buffer> {
  if (alphaIn && alphaIn.length !== width * height) {
    throw new Error(`Alfa di ${alphaIn.length} byte, attesi ${width * height}`);
  }
  const [orig, gen, alpha] = await Promise.all([
    decodeRgb(original, width, height, "originale"),
    decodeRgb(generated, width, height, "generata"),
    alphaIn ?? featheredAlpha(mask, width, height),
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

/** Pipeline sharp sul buffer grezzo, con la dicitura sovrapposta se richiesta. */
function rawPipeline(raw: Buffer, width: number, height: number, disclaimer?: boolean) {
  const img = sharp(raw, { raw: { width, height, channels: 3 } });
  return disclaimer
    ? img.composite([{ input: disclaimerSvg(width, height), top: 0, left: 0 }])
    : img;
}

/**
 * original·(1−α) + generated·α su RGB grezzo, con α = opts.alpha oppure
 * featheredAlpha(mask). Dove α = 0 i byte dell'originale decodificato sono
 * copiati tali e quali. Con opts.disclaimer la dicitura viene disegnata sul
 * risultato (e quindi modifica i pixel della sua area).
 */
export async function compositeRaw(
  original: Buffer,
  generated: Buffer,
  mask: Buffer,
  width: number,
  height: number,
  opts: CompositeOptions = {},
): Promise<Buffer> {
  const raw = await blendRaw(original, generated, mask, width, height, opts.alpha);
  if (!opts.disclaimer) return raw;
  return rawPipeline(raw, width, height, true).removeAlpha().raw().toBuffer();
}

/**
 * Ricomposizione consegnata al cliente, con UNA sola codifica JPEG.
 *
 * Garanzia: nel buffer grezzo ricomposto, i pixel fuori dalla maschera
 * allargata (α = 0) sono byte per byte identici all'originale normalizzato
 * decodificato. Il JPEG consegnato differisce da quel buffer solo per l'unica
 * compressione uniforme q92 4:4:4 applicata a tutta l'immagine (stesse
 * impostazioni di normalizePhoto). La dicitura facoltativa è disegnata sul
 * grezzo prima di quell'unica codifica.
 */
export async function composite(
  original: Buffer,
  generated: Buffer,
  mask: Buffer,
  width: number,
  height: number,
  opts: CompositeOptions = {},
): Promise<Buffer> {
  const raw = await blendRaw(original, generated, mask, width, height, opts.alpha);
  return rawPipeline(raw, width, height, opts.disclaimer).jpeg(JPEG_OPTIONS).toBuffer();
}

/**
 * Dicitura per il percorso senza sagoma: decodifica (JPEG o PNG),
 * sovrapposizione e un'unica codifica JPEG q92 4:4:4.
 */
export async function addDisclaimer(img: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp(img)
    .composite([{ input: disclaimerSvg(width, height), top: 0, left: 0 }])
    .jpeg(JPEG_OPTIONS)
    .toBuffer();
}

/** Unica codifica JPEG q92 4:4:4 di un'immagine (percorso senza sagoma né dicitura). */
export async function toJpeg(img: Buffer): Promise<Buffer> {
  return sharp(img).jpeg(JPEG_OPTIONS).toBuffer();
}
