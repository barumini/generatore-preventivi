// Controllo di posizione: quanto il prodotto generato si discosta dal volume 3D.
// Solo lato server (sharp); la soglia e isMisplaced sono usate anche dall'interfaccia
// tramite variant-list, quindi qui niente che il browser non possa importare a runtime.
import sharp from "sharp";
import type { Point } from "./geometry";
import { isMisplaced, PLACEMENT_THRESHOLD } from "./placement-threshold";

export { isMisplaced, PLACEMENT_THRESHOLD };

export const PLACEMENT_CONFIG = {
  /** Larghezza di lavoro: il confronto si fa a risoluzione ridotta, come per la crescita adattiva. */
  workWidth: 320,
  blurSigma: 1.2,
  /** Differenza media (0–255) oltre cui un pixel è considerato cambiato dal modello. */
  diffThreshold: 24,
  /** Sotto questa frazione di pixel cambiati non c'è nulla da confrontare. */
  minChangedRatio: 0.002,
  /** Percentili che delimitano l'ingombro della zona cambiata (scartano i pixel isolati). */
  lowPercentile: 0.02,
  highPercentile: 0.98,
};

async function workRgb(img: Buffer, w: number, h: number, blurSigma: number): Promise<Buffer> {
  return sharp(img)
    .removeAlpha()
    .resize(w, h, { fit: "fill", kernel: "linear" })
    .blur(blurSigma)
    .toColourspace("srgb")
    .raw()
    .toBuffer();
}

/** Estremi (in frazione 0..1 dell'asse) tra i due percentili di un istogramma di conteggi. */
function percentileRange(hist: Uint32Array, total: number, low: number, high: number): [number, number] {
  let acc = 0;
  let first = 0;
  let last = hist.length - 1;
  let foundFirst = false;
  for (let i = 0; i < hist.length; i++) {
    acc += hist[i];
    if (!foundFirst && acc >= low * total) {
      first = i;
      foundFirst = true;
    }
    if (acc >= high * total) {
      last = i;
      break;
    }
  }
  return [first / hist.length, (last + 1) / hist.length];
}

/**
 * Scostamento massimo, sui quattro lati, tra il riquadro d'ingombro della zona che il
 * modello ha cambiato e quello del volume, in frazione della dimensione corrispondente
 * del volume. `result` è l'immagine finale ricomposta. null se non è cambiato quasi nulla.
 */
export async function placementOffset(
  original: Buffer,
  result: Buffer,
  outline: Point[],
  width: number,
  height: number,
  cfg = PLACEMENT_CONFIG,
): Promise<number | null> {
  if (outline.length < 3) return null;
  const w = Math.min(cfg.workWidth, width);
  const h = Math.max(1, Math.round((height / width) * w));
  const [a, b] = await Promise.all([workRgb(original, w, h, cfg.blurSigma), workRgb(result, w, h, cfg.blurSigma)]);

  const cols = new Uint32Array(w);
  const rows = new Uint32Array(h);
  let changed = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      const d = (Math.abs(a[o] - b[o]) + Math.abs(a[o + 1] - b[o + 1]) + Math.abs(a[o + 2] - b[o + 2])) / 3;
      if (d > cfg.diffThreshold) {
        cols[x]++;
        rows[y]++;
        changed++;
      }
    }
  }
  if (changed / (w * h) < cfg.minChangedRatio) return null;

  const [left, right] = percentileRange(cols, changed, cfg.lowPercentile, cfg.highPercentile);
  const [top, bottom] = percentileRange(rows, changed, cfg.lowPercentile, cfg.highPercentile);
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  const box = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  const bw = box.right - box.left;
  const bh = box.bottom - box.top;
  if (!(bw > 0) || !(bh > 0)) return null;
  return Math.max(
    Math.abs(left - box.left) / bw,
    Math.abs(right - box.right) / bw,
    Math.abs(top - box.top) / bh,
    Math.abs(bottom - box.bottom) / bh,
  );
}
