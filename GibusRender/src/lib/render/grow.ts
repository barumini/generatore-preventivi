import sharp from "sharp";

/**
 * Crescita adattiva dell'area di ricomposizione.
 *
 * Il modello usa la sagoma solo come indicazione e spesso disegna la pergola più
 * larga: tenere solo ciò che sta dentro la sagoma la lascerebbe "a metà". Qui si
 * confronta l'immagine generata con la foto e si allarga l'area accettata alle
 * zone che il modello ha cambiato e che sono attaccate alla sagoma (la pergola
 * che esce, le ombre sul muro), entro un tetto di distanza. Il resto della foto
 * resta quello originale.
 */
export const GROW_CONFIG = {
  /** Larghezza di lavoro: il confronto si fa a risoluzione ridotta. */
  workWidth: 320,
  blurSigma: 1.2,
  /** Differenza media (0–255) oltre cui un pixel è considerato cambiato dal modello. */
  diffThreshold: 24,
  /** Chiusura dei piccoli buchi nella zona cambiata (px di lavoro). */
  bridgePx: 2,
  /** Distanza massima di crescita dalla sagoma, come frazione della larghezza di lavoro. */
  reachFraction: 0.25,
  /** Margine aggiunto attorno alla zona cresciuta (px di lavoro). */
  marginPx: 2,
  /** Sotto questa frazione dell'immagine non si considera crescita. */
  minAddedRatio: 0.0015,
  /** Fascia (px di lavoro) subito fuori dall'area cresciuta in cui cercare altro cambiato. */
  truncatedRingPx: 3,
  /** Differenza oltre cui un cambiamento è "forte" (struttura scura sul muro, non un'ombra). */
  truncatedDiffThreshold: 55,
  /** Frazione dell'immagine con cambiamenti forti nella fascia oltre la quale la struttura risulta tagliata. */
  truncatedMinRatio: 0.002,
};
export type GrowConfig = typeof GROW_CONFIG;

/**
 * Condizioni per accettare la crescita (taratura del 2026-11-10 su foto reale):
 * varianti buone con sagoma stretta: scarto 8–14 prima e crescita 5–9%;
 * scene rifatte: scarto 27–47 prima e crescita 15–35%. Oltre questi limiti il
 * cambiamento è troppo esteso per essere "la pergola che esce" e la maschera non cresce.
 */
export const GROW_LIMITS = {
  /** Punteggio di scena (con la maschera originale) oltre cui non si fa crescere. */
  maxPreDrift: 22,
  /** Crescita massima accettata, come frazione dell'immagine. */
  maxAddedRatio: 0.14,
} as const;

export type GrowResult = {
  /** PNG in scala di grigi, 255 dentro l'area (sempre ⊇ della maschera in ingresso). */
  mask: Buffer;
  /** true se l'area è stata allargata. */
  grown: boolean;
  /** Frazione dell'immagine aggiunta all'area. */
  addedRatio: number;
  /** true se, anche dopo la crescita, restano cambiamenti forti subito fuori: pergola probabilmente tagliata. */
  truncated: boolean;
  /** Frazione dell'immagine con cambiamenti forti subito fuori dall'area (per la taratura). */
  beyondRatio: number;
};

/** Dilatazione quadrata separabile di raggio r su una bitmap 0/1. */
function dilate(bin: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return bin.slice();
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r) && !v; k++) v = bin[y * w + k];
      tmp[y * w + x] = v;
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r) && !v; k++) v = tmp[k * w + x];
      out[y * w + x] = v;
    }
  }
  return out;
}

async function workRgb(img: Buffer, w: number, h: number, blurSigma: number): Promise<Buffer> {
  return sharp(img)
    .removeAlpha()
    .resize(w, h, { fit: "fill", kernel: "linear" })
    .blur(blurSigma)
    .toColourspace("srgb")
    .raw()
    .toBuffer();
}

export async function growMask(
  original: Buffer,
  generated: Buffer,
  mask: Buffer,
  width: number,
  height: number,
  cfg: GrowConfig = GROW_CONFIG,
): Promise<GrowResult> {
  const w = Math.min(cfg.workWidth, width);
  const h = Math.max(1, Math.round((height / width) * w));
  const [a, b, m] = await Promise.all([
    workRgb(original, w, h, cfg.blurSigma),
    workRgb(generated, w, h, cfg.blurSigma),
    sharp(mask).resize(w, h, { fit: "fill", kernel: "nearest" }).extractChannel(0).raw().toBuffer(),
  ]);

  const n = w * h;
  const inside = new Uint8Array(n);
  const changed = new Uint8Array(n);
  const strong = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    inside[i] = m[i] >= 128 ? 1 : 0;
    const o = i * 3;
    const d = (Math.abs(a[o] - b[o]) + Math.abs(a[o + 1] - b[o + 1]) + Math.abs(a[o + 2] - b[o + 2])) / 3;
    changed[i] = d > cfg.diffThreshold ? 1 : 0;
    strong[i] = d > cfg.truncatedDiffThreshold ? 1 : 0;
  }
  const passable = dilate(changed, w, h, cfg.bridgePx);

  // Visita in ampiezza dalla maschera, attraverso le sole zone cambiate, entro il tetto di distanza.
  const reach = Math.max(1, Math.round(cfg.reachFraction * w));
  const depth = new Int16Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    if (inside[i]) {
      depth[i] = 0;
      queue[tail++] = i;
    }
  }
  let added = 0;
  while (head < tail) {
    const i = queue[head++];
    const d = depth[i];
    if (d >= reach) continue;
    const x = i % w;
    const y = (i - x) / w;
    const neighbours = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of neighbours) {
      if (j < 0 || depth[j] >= 0 || !passable[j]) continue;
      depth[j] = d + 1;
      queue[tail++] = j;
      added++;
    }
  }

  if (added / n < cfg.minAddedRatio) {
    return { mask, grown: false, addedRatio: 0, truncated: false, beyondRatio: 0 };
  }

  const visited = new Uint8Array(n);
  for (let i = 0; i < n; i++) visited[i] = depth[i] >= 0 ? 1 : 0;
  const region = dilate(visited, w, h, cfg.marginPx);

  // Pergola tagliata: zone cambiate subito fuori dall'area cresciuta.
  const ring = dilate(region, w, h, cfg.truncatedRingPx);
  let beyond = 0;
  for (let i = 0; i < n; i++) if (ring[i] && !region[i] && strong[i]) beyond++;
  const truncated = beyond / n > cfg.truncatedMinRatio;

  // Riporta l'area alla risoluzione della foto e unisci alla maschera originale.
  const up = await sharp(Buffer.from(region.map((v) => (v ? 255 : 0))), { raw: { width: w, height: h, channels: 1 } })
    .resize(width, height, { fit: "fill", kernel: "linear" })
    .extractChannel(0)
    .raw()
    .toBuffer();
  const base = await sharp(mask).extractChannel(0).raw().toBuffer();
  const out = Buffer.alloc(width * height);
  for (let i = 0; i < out.length; i++) out[i] = base[i] >= 128 || up[i] >= 128 ? 255 : 0;

  return {
    mask: await sharp(out, { raw: { width, height, channels: 1 } }).png().toBuffer(),
    grown: true,
    addedRatio: added / n,
    truncated,
    beyondRatio: beyond / n,
  };
}
