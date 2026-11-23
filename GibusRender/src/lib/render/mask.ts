import sharp from "sharp";
import { dilationPx, type Point } from "./geometry";

/*
 * Nota: sharp 0.35 espone dilate()/erode(), ma su una maschera bianca su
 * fondo nero si comportano al contrario (dilate restringe il bianco) e usano
 * un nucleo quadrato. Per non dipendere da questo dettaglio usiamo una
 * trasformata della distanza euclidea esatta (Felzenszwalb–Huttenlocher),
 * O(n), che dà sia l'allargamento (circolare) sia la sfumatura lineare.
 */

const INF = 1e20;

/** Trasformata 1D delle distanze al quadrato (in place su f, n elementi). */
function edt1d(
  f: Float64Array,
  n: number,
  d: Float64Array,
  v: Int32Array,
  z: Float64Array,
) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dq = q - v[k];
    d[q] = dq * dq + f[v[k]];
  }
  for (let q = 0; q < n; q++) f[q] = d[q];
}

/**
 * Distanza euclidea al quadrato di ogni pixel dal pixel "seme" più vicino
 * (isSeed[i] === 1). I pixel fuori dall'immagine non sono semi.
 */
function squaredDistance(isSeed: Uint8Array, w: number, h: number): Float64Array {
  const out = new Float64Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = isSeed[i] ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = out[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) out[y * w + x] = f[y];
  }
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) f[x] = out[row + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[row + x] = f[x];
  }
  return out;
}

/** Rasterizza il poligono (coordinate 0..1) in un buffer binario 0/1. */
async function rasterizePolygon(points: Point[], w: number, h: number): Promise<Uint8Array> {
  const pts = points.map((p) => `${p.x * w},${p.y * h}`).join(" ");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="#000"/>` +
    `<polygon points="${pts}" fill="#fff" shape-rendering="crispEdges"/></svg>`;
  const data = await sharp(Buffer.from(svg))
    .resize(w, h, { fit: "fill" })
    .extractChannel(0)
    .raw()
    .toBuffer();
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < bin.length; i++) bin[i] = data[i] >= 128 ? 1 : 0;
  return bin;
}

async function decodeMask(mask: Buffer, w: number, h: number): Promise<Buffer> {
  const { data, info } = await sharp(mask)
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== w || info.height !== h) {
    throw new Error(`Maschera ${info.width}×${info.height}, attesa ${w}×${h}`);
  }
  return data;
}

/**
 * PNG in scala di grigi: 255 dentro la sagoma allargata di dilationPx(w,h)
 * (allargamento circolare), 0 fuori. Bordo netto.
 */
export async function polygonToMask(points: Point[], width: number, height: number): Promise<Buffer> {
  const inside = await rasterizePolygon(points, width, height);
  const r = dilationPx(width, height);
  const dist2 = squaredDistance(inside, width, height);
  const out = Buffer.alloc(width * height);
  for (let i = 0; i < out.length; i++) out[i] = dist2[i] <= r * r ? 255 : 0;
  return sharp(out, { raw: { width, height, channels: 1 } }).png().toBuffer();
}

/**
 * Alfa grezzo a 1 canale ricavato dalla maschera allargata:
 * alfa = 255 · min(1, D / (dilationPx/2)), con D distanza euclidea dal pixel
 * più vicino fuori dalla maschera. Quindi 0 esatto ovunque la maschera è 0,
 * rampa lineare larga metà dell'allargamento sul bordo interno, 255 nel
 * nucleo (che contiene tutta la sagoma originale).
 */
export async function featheredAlpha(mask: Buffer, width: number, height: number): Promise<Buffer> {
  const m = await decodeMask(mask, width, height);
  const outside = new Uint8Array(width * height);
  for (let i = 0; i < outside.length; i++) outside[i] = m[i] >= 128 ? 0 : 1;
  const feather = dilationPx(width, height) / 2;
  const dist2 = squaredDistance(outside, width, height);
  const alpha = Buffer.alloc(width * height);
  for (let i = 0; i < alpha.length; i++) {
    if (outside[i]) continue; // 0 garantito fuori dalla maschera
    const t = Math.sqrt(dist2[i]) / feather;
    alpha[i] = t >= 1 ? 255 : Math.max(1, Math.round(255 * t));
  }
  return alpha;
}
