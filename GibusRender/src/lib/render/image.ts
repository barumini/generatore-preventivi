import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import { featheredAlpha } from "./mask";

/** Unica impostazione di codifica JPEG per tutte le immagini consegnate. */
const JPEG_OPTIONS = { quality: 92, chromaSubsampling: "4:4:4" } as const;
const MAX_LONG_SIDE = 3000;
const DISCLAIMER = "Immagine a titolo esemplificativo";

/**
 * Font della dicitura, incluso nel repository (Geist, SIL OFL 1.1): le funzioni
 * Vercel non hanno font di sistema. Va incluso nel bundle con
 * outputFileTracingIncludes in next.config.ts.
 */
export const DISCLAIMER_FONT_FILE = path.join(process.cwd(), "assets/fonts/Geist-Medium.ttf");
const DISCLAIMER_FONT_FAMILY = "Geist Medium";

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

/** Testo della dicitura come PNG RGBA (sfondo trasparente), reso con il font incluso. */
async function disclaimerText(color: string, opacity: number, fontSize: number, maxWidth: number) {
  const { data, info } = await sharp({
    text: {
      text: `<span foreground="${color}" alpha="${Math.round(opacity * 100)}%">${DISCLAIMER}</span>`,
      font: `${DISCLAIMER_FONT_FAMILY} ${fontSize}`,
      fontfile: DISCLAIMER_FONT_FILE,
      rgba: true,
      dpi: 72, // a 72 dpi i punti del font coincidono con i pixel
      width: maxWidth,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { input: data, width: info.width, height: info.height };
}

/** Sovrapposizioni della dicitura in basso a destra: ombra nera sfumata e testo bianco. */
async function disclaimerOverlays(width: number, height: number): Promise<OverlayOptions[]> {
  const fontSize = Math.max(10, Math.round(0.02 * height));
  const margin = Math.round(fontSize * 0.8);
  const shadow = Math.max(1, Math.round(fontSize / 12));
  const maxWidth = Math.max(1, width - 2 * margin - shadow);
  const [shade, text] = await Promise.all([
    disclaimerText("#000000", 0.6, fontSize, maxWidth),
    disclaimerText("#ffffff", 1, fontSize, maxWidth),
  ]);
  const left = Math.max(0, width - margin - shadow - text.width);
  const top = Math.max(0, height - margin - shadow - text.height);
  return [
    {
      input: shade.input,
      left: Math.min(left + shadow, width - shade.width),
      top: Math.min(top + shadow, height - shade.height),
    },
    { input: text.input, left, top },
  ];
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
async function rawPipeline(raw: Buffer, width: number, height: number, disclaimer?: boolean) {
  const img = sharp(raw, { raw: { width, height, channels: 3 } });
  return disclaimer ? img.composite(await disclaimerOverlays(width, height)) : img;
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
  return (await rawPipeline(raw, width, height, true)).removeAlpha().raw().toBuffer();
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
  return (await rawPipeline(raw, width, height, opts.disclaimer)).jpeg(JPEG_OPTIONS).toBuffer();
}

/**
 * Dicitura per il percorso senza sagoma: decodifica (JPEG o PNG),
 * sovrapposizione e un'unica codifica JPEG q92 4:4:4.
 */
export async function addDisclaimer(img: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp(img)
    .composite(await disclaimerOverlays(width, height))
    .jpeg(JPEG_OPTIONS)
    .toBuffer();
}

/** Unica codifica JPEG q92 4:4:4 di un'immagine (percorso senza sagoma né dicitura). */
export async function toJpeg(img: Buffer): Promise<Buffer> {
  return sharp(img).jpeg(JPEG_OPTIONS).toBuffer();
}
