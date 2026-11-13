// Geometria del volume 3D di posizionamento.
// Modulo puro (niente Prisma, sharp o React): lo usano sia l'editor nel browser sia il server.
//
// Mondo, in mm: origine a terra sotto l'angolo in basso a sinistra del riquadro di
// facciata; X lungo il muro verso destra, Y verso l'alto, Z fuori dal muro verso chi
// fotografa. Camera a foro stenopeico: x a destra, y in basso, z in avanti, punto
// principale al centro della foto, una sola incognita interna (la focale).
import type { Point } from "./geometry";

export type Vec3 = [number, number, number];

/** Rettangolo reale sulla facciata. Angoli: basso-sx, basso-dx, alto-dx, alto-sx. */
export type RefRect = {
  corners: [Point, Point, Point, Point];
  widthMm: number;
  heightMm: number;
  /** Quota da terra del lato basso. */
  baseMm: number;
};

export type VolumeBox = {
  /** Scostamento lungo il muro dell'estremo sinistro, dall'origine. */
  offsetXMm: number;
  /** Distanza dal muro (0 = addossato). */
  distanceMm: number;
  wallHeightMm: number;
  frontHeightMm: number;
};

export type Volume = {
  ref: RefRect;
  /** null = focale automatica; altrimenti rapporto focale / diagonale della foto. */
  focalRatio: number | null;
  box: VolumeBox;
  /** Montanti anteriori, come frazioni 0..1 della larghezza. */
  frontPosts: number[];
  /** Montanti posteriori (solo volumi staccati dal muro). */
  rearPosts: number[];
  /** Ritocchi fini: scostamento 0..1 per ciascuno degli 8 vertici, o null. */
  nudges: Point[] | null;
};

export type VolumeDims = { widthMm: number; depthMm: number };

export type Pose = {
  /** Focale in pixel. */
  f: number;
  /**
   * Mondo → camera, per righe. Le prime due colonne (assi del muro) vengono dall'omografia
   * del riquadro così com'è, perché la facciata resti esattamente sui punti cliccati anche
   * con una focale scelta a mano; la terza (la sporgenza) è la normale unitaria al muro.
   * È una rotazione vera solo quando la focale è quella giusta.
   */
  R: number[][];
  t: Vec3;
  width: number;
  height: number;
};

export type Post = { foot: Point; head: Point; xMm: number; rear: boolean };

export type ProjectedVolume = {
  pose: Pose;
  /** Rapporto focale / diagonale effettivamente usato. */
  focalRatio: number;
  /** true se la focale è stata ricavata dal riquadro (né predefinita né manuale). */
  focalAuto: boolean;
  /** 0-3 a terra (muro-sx, muro-dx, fronte-dx, fronte-sx), 4-7 in alto nello stesso ordine. */
  vertices: Point[];
  posts: Post[];
  /** Linea di attacco a muro; null se il volume è staccato dal muro. */
  wallLine: [Point, Point] | null;
  outOfFrame: boolean;
};

/** Equivalente a un 26 mm su pieno formato: l'obiettivo principale di un telefono. */
export const DEFAULT_FOCAL_RATIO = 0.6;
export const FOCAL_RATIO_MIN = 0.3;
export const FOCAL_RATIO_MAX = 2.5;
export const MAX_POSTS = 6;

export const REF_INVALID = "Il riquadro di facciata non è valido: clicca i quattro angoli di un rettangolo";
export const REF_TOO_SMALL = "Il riquadro di facciata è troppo piccolo";
export const VOLUME_BEHIND =
  "Il volume finisce dietro la fotocamera: riduci la sporgenza o regola la prospettiva";

/** Lato minimo del riquadro, come frazione del lato corto della foto. */
const MIN_REF_SIDE = 0.05;
/** Sotto questa "fuga" (in unità normalizzate) il riquadro è considerato frontale. */
const FRONTAL_EPS = 0.02;
/** Distanza minima dal piano della camera (mm) per considerare visibile un punto. */
const NEAR_MM = 1;

/** Colori del volume, gli stessi nell'interfaccia, nell'immagine-guida e nella legenda del prompt. */
export const VOLUME_COLORS = { wall: "#ff3b30", post: "#2f7bff", edge: "#ffffff" } as const;

/** Spigoli del volume come coppie di indici dei vertici: a terra, in alto, verticali. */
export const VOLUME_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

export const roundMm = (v: number) => Math.round(v / 10) * 10;

const cross2 = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a: Vec3): Vec3 => scale(a, 1 / norm(a));
const toCam = (pose: Pose, p: Vec3): Vec3 => [
  dot(pose.R[0] as Vec3, p) + pose.t[0],
  dot(pose.R[1] as Vec3, p) + pose.t[1],
  dot(pose.R[2] as Vec3, p) + pose.t[2],
];

/**
 * Riordina quattro clic qualsiasi in basso-sx, basso-dx, alto-dx, alto-sx:
 * giro attorno al baricentro, partendo dal lato più in basso nella foto.
 */
export function orderCorners(pts: Point[]): [Point, Point, Point, Point] {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  // Angolo decrescente con y verso il basso = senso antiorario a schermo (BL → BR → TR → TL).
  const ring = [...pts].sort((a, b) => Math.atan2(b.y - cy, b.x - cx) - Math.atan2(a.y - cy, a.x - cx));
  let start = 0;
  let lowest = -Infinity;
  for (let i = 0; i < ring.length; i++) {
    const mid = (ring[i].y + ring[(i + 1) % ring.length].y) / 2;
    if (mid > lowest) {
      lowest = mid;
      start = i;
    }
  }
  return [0, 1, 2, 3].map((k) => ring[(start + k) % ring.length]) as [Point, Point, Point, Point];
}

/** Risolve A·x = b (n×n) con eliminazione di Gauss e pivot parziale; null se singolare. */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-12) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const k = M[r][col] / M[col][col];
      if (k === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= k * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / M[i][i]);
}

/**
 * Posa della camera dal riquadro di facciata. Con `focalRatio` null la focale si ricava
 * dall'ortogonalità dei lati del riquadro; se il riquadro è quasi frontale (o la stima
 * esce dall'intervallo plausibile) si usa quella predefinita.
 */
export function solvePose(
  ref: RefRect,
  photoW: number,
  photoH: number,
  focalRatio: number | null,
): { ok: true; pose: Pose; focalRatio: number; focalAuto: boolean } | { ok: false; error: string } {
  const c = ref.corners;
  const valid =
    Array.isArray(c) &&
    c.length === 4 &&
    c.every((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)) &&
    ref.widthMm > 0 &&
    ref.heightMm > 0 &&
    Number.isFinite(ref.baseMm);
  if (!valid) return { ok: false, error: REF_INVALID };

  // In pixel: convesso e percorso in senso antiorario a schermo (facciata vista da davanti).
  const px = c.map((p) => ({ x: p.x * photoW, y: p.y * photoH }));
  const minArea = 1e-4 * photoW * photoH;
  for (let i = 0; i < 4; i++) {
    if (cross2(px[i], px[(i + 1) % 4], px[(i + 2) % 4]) > -minArea) return { ok: false, error: REF_INVALID };
  }
  const sides = px.map((p, i) => Math.hypot(px[(i + 1) % 4].x - p.x, px[(i + 1) % 4].y - p.y));
  if (Math.min(...sides) < MIN_REF_SIDE * Math.min(photoW, photoH)) return { ok: false, error: REF_TOO_SMALL };

  // Unità di lavoro: foto in diagonali (centrata), mondo in larghezze del riquadro.
  const diag = Math.hypot(photoW, photoH);
  const u = ref.widthMm;
  const img = px.map((p) => ({ x: (p.x - photoW / 2) / diag, y: (p.y - photoH / 2) / diag }));
  const y0 = ref.baseMm / u;
  const y1 = (ref.baseMm + ref.heightMm) / u;
  const world = [
    [0, y0],
    [1, y0],
    [1, y1],
    [0, y1],
  ];
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [X, Y] = world[i];
    const { x, y } = img[i];
    A.push([X, Y, 1, 0, 0, 0, -x * X, -x * Y]);
    b.push(x);
    A.push([0, 0, 0, X, Y, 1, -y * X, -y * Y]);
    b.push(y);
  }
  const h = solveLinear(A, b);
  if (!h || h.some((v) => !Number.isFinite(v))) return { ok: false, error: REF_INVALID };
  const h1: Vec3 = [h[0], h[3], h[6]];
  const h2: Vec3 = [h[1], h[4], h[7]];
  const h3: Vec3 = [h[2], h[5], 1];

  // La fuga delle linee orizzontali del muro (h1z) è un dato robusto; la convergenza dei lati
  // verticali (h2z) vale pochi pixel e dipende dalla precisione dei clic. Con un muro visto
  // di scorcio, quindi, la componente in profondità dell'asse verticale non si legge
  // dall'omografia: si ricava imponendo che sia perpendicolare alla direzione del muro.
  const oblique = Math.abs(h1[2]) >= FRONTAL_EPS;
  const hh1 = h1[0] * h1[0] + h1[1] * h1[1];
  const hh2 = h2[0] * h2[0] + h2[1] * h2[1];
  const h12 = h1[0] * h2[0] + h1[1] * h2[1];

  let ratio = focalRatio ?? DEFAULT_FOCAL_RATIO;
  let focalAuto = false;
  if (focalRatio === null) {
    // Focale dalle proporzioni reali del riquadro: i due assi devono avere la stessa lunghezza.
    let f2 = NaN;
    if (oblique) {
      // Con u = 1/f²: (h12²/h1z²)·u² + (hh2 − hh1)·u − h1z² = 0, radice positiva.
      const z2 = h1[2] * h1[2];
      const qa = (h12 * h12) / z2;
      const qb = hh2 - hh1;
      const inv = qa > 1e-12 ? (-qb + Math.sqrt(qb * qb + 4 * qa * z2)) / (2 * qa) : z2 / qb;
      f2 = 1 / inv;
    } else if (Math.abs(h2[2]) >= FRONTAL_EPS) {
      // Muro frontale ma camera molto inclinata: resta la convergenza delle verticali.
      f2 = (hh1 - hh2) / (h2[2] * h2[2] - h1[2] * h1[2]);
    }
    const est = Math.sqrt(f2);
    if (Number.isFinite(est) && est >= FOCAL_RATIO_MIN && est <= FOCAL_RATIO_MAX) {
      ratio = est;
      focalAuto = true;
    }
  }

  const f = ratio;
  const a1: Vec3 = [h1[0] / f, h1[1] / f, h1[2]];
  const a2: Vec3 = [h2[0] / f, h2[1] / f, h2[2]];
  // Asse verticale corretto (vedi sopra); la facciata continua a usare a2 così com'è.
  const up: Vec3 = oblique ? [a2[0], a2[1], -(a1[0] * a2[0] + a1[1] * a2[1]) / a1[2]] : a2;
  const n1 = norm(a1);
  const n2 = norm(up);
  const normal = cross(a1, up);
  if (!(n1 > 0) || !(n2 > 0) || !(norm(normal) > 1e-12)) return { ok: false, error: REF_INVALID };
  const s = 2 / (n1 + n2);
  const r3 = unit(normal);
  const r1 = scale(a1, s);
  const r2 = scale(a2, s);
  const t: Vec3 = [(h3[0] / f) * s * u, (h3[1] / f) * s * u, s * u];
  const pose: Pose = {
    f: ratio * diag,
    R: [0, 1, 2].map((i) => [r1[i], r2[i], r3[i]]),
    t,
    width: photoW,
    height: photoH,
  };
  if (![...pose.R.flat(), ...t].every(Number.isFinite)) return { ok: false, error: REF_INVALID };
  return { ok: true, pose, focalRatio: ratio, focalAuto };
}

/** Proietta un punto del mondo sulla foto (coordinate 0..1); null se è dietro la camera. */
export function project(pose: Pose, p: Vec3): Point | null {
  const c = toCam(pose, p);
  if (!(c[2] > NEAR_MM)) return null;
  return {
    x: ((pose.f * c[0]) / c[2] + pose.width / 2) / pose.width,
    y: ((pose.f * c[1]) / c[2] + pose.height / 2) / pose.height,
  };
}

/** Gli otto vertici in mm: 0-3 a terra (muro-sx, muro-dx, fronte-dx, fronte-sx), 4-7 in alto. */
export function boxVertices(box: VolumeBox, dims: VolumeDims): Vec3[] {
  const x0 = box.offsetXMm;
  const x1 = x0 + dims.widthMm;
  const z0 = box.distanceMm;
  const z1 = z0 + dims.depthMm;
  return [
    [x0, 0, z0],
    [x1, 0, z0],
    [x1, 0, z1],
    [x0, 0, z1],
    [x0, box.wallHeightMm, z0],
    [x1, box.wallHeightMm, z0],
    [x1, box.frontHeightMm, z1],
    [x0, box.frontHeightMm, z1],
  ];
}

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const plus = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const ZERO: Point = { x: 0, y: 0 };

export function projectVolume(
  v: Volume,
  dims: VolumeDims,
  photoW: number,
  photoH: number,
): ({ ok: true } & ProjectedVolume) | { ok: false; error: string } {
  const solved = solvePose(v.ref, photoW, photoH, v.focalRatio);
  if (!solved.ok) return solved;
  const { pose } = solved;
  const nudge = (i: number) => v.nudges?.[i] ?? ZERO;

  const world = boxVertices(v.box, dims);
  const vertices: Point[] = [];
  for (let i = 0; i < world.length; i++) {
    const p = project(pose, world[i]);
    if (!p) return { ok: false, error: VOLUME_BEHIND };
    vertices.push(plus(p, nudge(i)));
  }

  const x0 = v.box.offsetXMm;
  const z0 = v.box.distanceMm;
  const z1 = z0 + dims.depthMm;
  const posts: Post[] = [];
  const rows: { ts: number[]; z: number; top: number; rear: boolean; left: number; right: number }[] = [
    { ts: v.frontPosts, z: z1, top: v.box.frontHeightMm, rear: false, left: 3, right: 2 },
  ];
  if (v.box.distanceMm > 0) {
    rows.push({ ts: v.rearPosts, z: z0, top: v.box.wallHeightMm, rear: true, left: 0, right: 1 });
  }
  for (const row of rows) {
    for (const t of row.ts) {
      const x = x0 + t * dims.widthMm;
      const foot = project(pose, [x, 0, row.z]);
      const head = project(pose, [x, row.top, row.z]);
      if (!foot || !head) return { ok: false, error: VOLUME_BEHIND };
      posts.push({
        // I ritocchi dei vertici si propagano ai montanti in proporzione alla posizione.
        foot: plus(foot, lerp(nudge(row.left), nudge(row.right), t)),
        head: plus(head, lerp(nudge(row.left + 4), nudge(row.right + 4), t)),
        xMm: Math.round(t * dims.widthMm),
        rear: row.rear,
      });
    }
  }

  return {
    ok: true,
    pose,
    focalRatio: solved.focalRatio,
    focalAuto: solved.focalAuto,
    vertices,
    posts,
    wallLine: v.box.distanceMm > 0 ? null : [vertices[4], vertices[5]],
    outOfFrame: vertices.some((p) => p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1),
  };
}

/** Involucro convesso (catena monotona di Andrew). */
function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const half = (list: Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross2(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half(pts.reverse())];
}

/** Ritaglio di un poligono convesso sul quadrato 0..1 (Sutherland–Hodgman). */
function clipToUnit(poly: Point[]): Point[] {
  const edges: { inside: (p: Point) => boolean; cut: (a: Point, b: Point) => Point }[] = [
    { inside: (p) => p.x >= 0, cut: (a, b) => lerp(a, b, (0 - a.x) / (b.x - a.x)) },
    { inside: (p) => p.x <= 1, cut: (a, b) => lerp(a, b, (1 - a.x) / (b.x - a.x)) },
    { inside: (p) => p.y >= 0, cut: (a, b) => lerp(a, b, (0 - a.y) / (b.y - a.y)) },
    { inside: (p) => p.y <= 1, cut: (a, b) => lerp(a, b, (1 - a.y) / (b.y - a.y)) },
  ];
  let out = poly;
  for (const e of edges) {
    const next: Point[] = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      const b = out[(i + 1) % out.length];
      if (e.inside(a)) next.push(a);
      if (e.inside(a) !== e.inside(b)) next.push(e.cut(a, b));
    }
    out = next;
  }
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return out.map((p) => ({ x: clamp(p.x), y: clamp(p.y) }));
}

/** Sagoma dell'ingombro: involucro convesso di vertici e montanti, ritagliato sulla foto. */
export function volumeOutline(pv: ProjectedVolume): Point[] {
  const pts = [...pv.vertices, ...pv.posts.flatMap((p) => [p.foot, p.head])];
  return clipToUnit(convexHull(pts));
}

/**
 * Millimetri lungo una retta del mondo (origine + s·asse) del punto più vicino al
 * puntatore sulla foto: serve al trascinamento vincolato delle maniglie.
 */
export function alongAxis(pose: Pose, origin: Vec3, axis: Vec3, pointer: Point): number {
  const oc = toCam(pose, origin);
  const dc: Vec3 = [dot(pose.R[0] as Vec3, axis), dot(pose.R[1] as Vec3, axis), dot(pose.R[2] as Vec3, axis)];
  // Punto omogeneo (pixel centrati) lungo la retta: a + s·b.
  const a: Vec3 = [pose.f * oc[0], pose.f * oc[1], oc[2]];
  const b: Vec3 = [pose.f * dc[0], pose.f * dc[1], dc[2]];
  const q = { x: pointer.x * pose.width - pose.width / 2, y: pointer.y * pose.height - pose.height / 2 };

  // Retta in foto per due punti visibili, poi piede della perpendicolare dal puntatore.
  const at = (s: number) => ({ x: (a[0] + s * b[0]) / (a[2] + s * b[2]), y: (a[1] + s * b[1]) / (a[2] + s * b[2]) });
  const step = a[2] + 1000 * b[2] > NEAR_MM ? 1000 : -1000;
  const p0 = at(0);
  const p1 = at(step);
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len2 = dx * dx + dy * dy;
  if (!(len2 > 1e-12)) return 0; // la retta punta verso la camera: non si può trascinare
  const k = ((q.x - p0.x) * dx + (q.y - p0.y) * dy) / len2;
  const foot = { x: p0.x + k * dx, y: p0.y + k * dy };

  // Risalita proiettiva sull'asse immagine meglio condizionato.
  const denX = b[0] - foot.x * b[2];
  const denY = b[1] - foot.y * b[2];
  const s = Math.abs(denX) >= Math.abs(denY) ? (foot.x * a[2] - a[0]) / denX : (foot.y * a[2] - a[1]) / denY;
  return Number.isFinite(s) ? s : 0;
}

/** Montanti equidistanti: 0 → nessuno, 1 → al centro, n → da un estremo all'altro. */
export function evenPosts(count: number): number[] {
  const n = Math.min(MAX_POSTS, Math.max(0, Math.round(count)));
  if (n === 0) return [];
  if (n === 1) return [0.5];
  return Array.from({ length: n }, (_, i) => i / (n - 1));
}

/** Volume iniziale: centrato sul riquadro, altezze pari alla totale, montanti agli angoli. */
export function defaultVolume(
  ref: RefRect,
  dims: VolumeDims,
  totalHeightMm: number,
  freestanding: boolean,
): Volume {
  return {
    ref,
    focalRatio: null,
    box: {
      offsetXMm: roundMm((ref.widthMm - dims.widthMm) / 2),
      distanceMm: freestanding ? 1000 : 0,
      wallHeightMm: totalHeightMm,
      frontHeightMm: totalHeightMm,
    },
    frontPosts: [0, 1],
    rearPosts: freestanding ? [0, 1] : [],
    nudges: null,
  };
}
