// Logica pura del ritaglio delle immagini di riferimento (usata nel browser).

/** Lato minimo (px dell'immagine) perché un trascinamento conti come ritaglio e non come clic. */
export const MIN_CROP_PX = 16;

export type Pt = { x: number; y: number };
export type CropRect = { left: number; top: number; width: number; height: number };

/**
 * Rettangolo di ritaglio (in pixel dell'immagine) tra due punti, qualunque sia la
 * direzione del trascinamento, limitato ai bordi; null se è troppo piccolo.
 */
export function cropRectFromPoints(a: Pt, b: Pt, imgW: number, imgH: number): CropRect | null {
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));
  const x0 = Math.round(clamp(Math.min(a.x, b.x), imgW));
  const x1 = Math.round(clamp(Math.max(a.x, b.x), imgW));
  const y0 = Math.round(clamp(Math.min(a.y, b.y), imgH));
  const y1 = Math.round(clamp(Math.max(a.y, b.y), imgH));
  const width = x1 - x0;
  const height = y1 - y0;
  if (width < MIN_CROP_PX || height < MIN_CROP_PX) return null;
  return { left: x0, top: y0, width, height };
}

/** Dimensioni d'uscita: lato lungo al massimo `maxSide`, proporzioni mantenute, mai ingrandita. */
export function cropOutputSize(w: number, h: number, maxSide = 2000): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}
