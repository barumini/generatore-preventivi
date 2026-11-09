/** Coordinate normalizzate 0..1 rispetto alla foto normalizzata. */
export type Point = { x: number; y: number };

export type ScaleLine = { a: Point; b: Point; lengthMm: number };

/** Area minima della sagoma: 0,1% della foto. */
const MIN_AREA = 0.001;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Area (in frazione di foto) del poligono, formula di Gauss. */
function polygonArea(points: Point[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}

export function validatePolygon(
  points: Point[],
): { ok: true; points: Point[] } | { ok: false; error: string } {
  if (!Array.isArray(points) || points.length < 3) {
    return { ok: false, error: "La sagoma deve avere almeno 3 punti" };
  }
  if (points.some((p) => !Number.isFinite(p?.x) || !Number.isFinite(p?.y))) {
    return { ok: false, error: "La sagoma contiene coordinate non valide" };
  }
  const clamped = points.map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }));
  if (polygonArea(clamped) <= MIN_AREA) {
    return { ok: false, error: "La sagoma è troppo piccola" };
  }
  return { ok: true, points: clamped };
}

/** Allargamento della maschera: 2% della diagonale, minimo 8 px. */
export function dilationPx(width: number, height: number): number {
  return Math.max(8, Math.round(0.02 * Math.hypot(width, height)));
}
