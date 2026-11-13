import { describe, expect, it } from "vitest";
import type { Point } from "@/lib/render/geometry";
import {
  DEFAULT_FOCAL_RATIO,
  alongAxis,
  boxVertices,
  defaultVolume,
  evenPosts,
  orderCorners,
  project,
  projectVolume,
  roundMm,
  solvePose,
  volumeOutline,
  type Pose,
  type RefRect,
  type Vec3,
  type Volume,
} from "@/lib/render/volume";

const W = 1600;
const H = 1200;
const DIAG = Math.hypot(W, H);
const rad = (deg: number) => (deg * Math.PI) / 180;

type M3 = number[][];
const mul = (a: M3, b: M3): M3 =>
  a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
const apply = (m: M3, v: Vec3): Vec3 => [0, 1, 2].map((i) => m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2]) as Vec3;
const transpose = (m: M3): M3 => [0, 1, 2].map((i) => [0, 1, 2].map((j) => m[j][i]));

/** Camera sintetica che guarda `target` da `dist` mm, con imbardata, beccheggio e rollio dati. */
function synth(focalRatio: number, yawDeg: number, pitchDeg: number, rollDeg: number, dist: number, target: Vec3): Pose {
  const [y, p, r] = [rad(yawDeg), rad(pitchDeg), rad(rollDeg)];
  const Ry: M3 = [[Math.cos(y), 0, Math.sin(y)], [0, 1, 0], [-Math.sin(y), 0, Math.cos(y)]];
  const Rx: M3 = [[1, 0, 0], [0, Math.cos(p), -Math.sin(p)], [0, Math.sin(p), Math.cos(p)]];
  const Rz: M3 = [[Math.cos(r), -Math.sin(r), 0], [Math.sin(r), Math.cos(r), 0], [0, 0, 1]];
  // Camera frontale: X mondo → x camera, Y mondo (alto) → −y camera, Z mondo (fuori dal muro) → −z camera.
  const R0: M3 = [[1, 0, 0], [0, -1, 0], [0, 0, -1]];
  const R = mul(mul(mul(Rz, Rx), Ry), R0);
  const forward = apply(transpose(R), [0, 0, 1]);
  const C: Vec3 = [target[0] - dist * forward[0], target[1] - dist * forward[1], target[2] - dist * forward[2]];
  const rc = apply(R, C);
  return { f: focalRatio * DIAG, R, t: [-rc[0], -rc[1], -rc[2]], width: W, height: H };
}

const REF_W = 4000;
const REF_H = 2400;
const refWorld = (base = 0): Vec3[] => [
  [0, base, 0],
  [REF_W, base, 0],
  [REF_W, base + REF_H, 0],
  [0, base + REF_H, 0],
];
function refFrom(pose: Pose, base = 0): RefRect {
  const corners = refWorld(base).map((p) => project(pose, p)!) as [Point, Point, Point, Point];
  return { corners, widthMm: REF_W, heightMm: REF_H, baseMm: base };
}
const pxDist = (a: Point, b: Point) => Math.hypot((a.x - b.x) * W, (a.y - b.y) * H);
const CENTER: Vec3 = [2000, 1200, 0];

describe("project", () => {
  it("proietta al centro il punto guardato e null ciò che sta dietro la camera", () => {
    const pose = synth(0.7, 0, 0, 0, 9000, CENTER);
    const c = project(pose, CENTER)!;
    expect(c.x).toBeCloseTo(0.5, 6);
    expect(c.y).toBeCloseTo(0.5, 6);
    expect(project(pose, [2000, 1200, 20000])).toBeNull();
  });
});

describe("solvePose", () => {
  it("di scorcio ricava focale e posa: un punto fuori dal piano cade entro 1 px", () => {
    const truth = synth(0.7, 25, 5, 0, 9000, CENTER);
    const r = solvePose(refFrom(truth), W, H, null);
    if (!r.ok) throw new Error(r.error);
    expect(r.focalAuto).toBe(true);
    expect(Math.abs(r.focalRatio - 0.7) / 0.7).toBeLessThan(0.02);
    const p: Vec3 = [1000, 500, 3000];
    expect(pxDist(project(r.pose, p)!, project(truth, p)!)).toBeLessThan(1);
  });

  it("regge il rollio della camera", () => {
    const truth = synth(0.7, 25, 5, 4, 9000, CENTER);
    const r = solvePose(refFrom(truth), W, H, null);
    if (!r.ok) throw new Error(r.error);
    const p: Vec3 = [1000, 500, 3000];
    expect(pxDist(project(r.pose, p)!, project(truth, p)!)).toBeLessThan(1);
  });

  it("tiene conto della quota da terra del riquadro", () => {
    const truth = synth(0.7, 25, 5, 0, 9000, CENTER);
    const r = solvePose(refFrom(truth, 300), W, H, null);
    if (!r.ok) throw new Error(r.error);
    const p: Vec3 = [1000, 0, 3000];
    expect(pxDist(project(r.pose, p)!, project(truth, p)!)).toBeLessThan(1);
  });

  it("frontale: usa la focale predefinita, senza NaN, e riproduce gli angoli del riquadro", () => {
    const truth = synth(0.7, 0, 0, 0, 9000, CENTER);
    const ref = refFrom(truth);
    const r = solvePose(ref, W, H, null);
    if (!r.ok) throw new Error(r.error);
    expect(r.focalAuto).toBe(false);
    expect(r.focalRatio).toBe(DEFAULT_FOCAL_RATIO);
    expect(r.pose.R.flat().every(Number.isFinite)).toBe(true);
    refWorld().forEach((p, i) => expect(pxDist(project(r.pose, p)!, ref.corners[i])).toBeLessThan(0.5));
  });

  it("usa la focale manuale così com'è", () => {
    const truth = synth(0.7, 0, 0, 0, 9000, CENTER);
    const ref = refFrom(truth);
    const r = solvePose(ref, W, H, 1.2);
    if (!r.ok) throw new Error(r.error);
    expect(r.focalRatio).toBe(1.2);
    expect(r.focalAuto).toBe(false);
    expect(r.pose.f).toBeCloseTo(1.2 * DIAG, 6);
    refWorld().forEach((p, i) => expect(pxDist(project(r.pose, p)!, ref.corners[i])).toBeLessThan(0.5));
  });

  it("con focale manuale diversa da quella vera il riquadro resta sugli angoli cliccati", () => {
    const truth = synth(0.7, 25, 5, 0, 9000, CENTER);
    const ref = refFrom(truth);
    const r = solvePose(ref, W, H, 1.2);
    if (!r.ok) throw new Error(r.error);
    refWorld().forEach((p, i) => expect(pxDist(project(r.pose, p)!, ref.corners[i])).toBeLessThan(0.5));
  });

  it("clic imprecisi sui lati verticali (resi paralleli) non falsano la profondità", () => {
    // Camera a 1,6 m da terra inclinata in basso di 5°: i lati verticali convergono di pochi pixel.
    const truth = synth(0.62, 22, -5, 0, 11000, [2000, 800, 0]);
    const ref = refFrom(truth);
    // Chi clicca li allinea a occhio: stessa x in alto e in basso.
    const [bl, br, tr, tl] = ref.corners;
    ref.corners = [bl, br, { x: br.x, y: tr.y }, { x: bl.x, y: tl.y }];
    expect(Math.abs(tr.x - br.x) * W).toBeLessThan(8); // la convergenza vera è davvero piccola
    const r = solvePose(ref, W, H, null);
    if (!r.ok) throw new Error(r.error);
    // Il piede anteriore di un volume profondo 3,8 m deve cadere vicino a quello vero.
    for (const p of [[0, 0, 3800], [4000, 0, 3800]] as Vec3[]) {
      expect(pxDist(project(r.pose, p)!, project(truth, p)!)).toBeLessThan(0.015 * DIAG);
    }
  });

  it.each([
    ["muro quasi frontale (3° di scorcio)", 3, 0],
    ["muro a 8° di scorcio", 8, 0],
    ["muro frontale con camera inclinata di 5°", 0, -5],
  ])("clic imprecisi di un pixel su %s: focale predefinita e volume stabile", (_name, yaw, pitch) => {
    const truth = synth(0.6, yaw, pitch, 0, 10000, [2600, 1200, 0]);
    const world: Vec3[] = [[0, 0, 0], [5200, 0, 0], [5200, 2400, 0], [0, 2400, 0]];
    const exact = world.map((p) => project(truth, p)!);
    // Tutte le combinazioni di ±1 px sugli otto valori sarebbero 256: se ne provano alcune, fisse.
    const patterns = [
      [1, -1, -1, 1, 1, 1, -1, -1],
      [-1, 1, 1, -1, -1, -1, 1, 1],
      [1, 1, -1, -1, 1, -1, -1, 1],
      [-1, -1, 1, 1, -1, 1, 1, -1],
      [1, -1, 1, -1, -1, 1, -1, 1],
    ];
    for (const n of patterns) {
      const corners = exact.map((c, i) => ({ x: c.x + n[2 * i] / W, y: c.y + n[2 * i + 1] / H })) as RefRect["corners"];
      const r = solvePose({ corners, widthMm: 5200, heightMm: 2400, baseMm: 0 }, W, H, null);
      if (!r.ok) throw new Error(r.error);
      expect(r.focalAuto).toBe(false);
      expect(r.focalRatio).toBe(DEFAULT_FOCAL_RATIO);
      for (const p of [[600, 0, 3000], [4600, 2500, 3000]] as Vec3[]) {
        expect(pxDist(project(r.pose, p)!, project(truth, p)!)).toBeLessThan(0.02 * DIAG);
      }
    }
  });

  it("rifiuta un riquadro con tre punti allineati", () => {
    const ref: RefRect = {
      corners: [{ x: 0.2, y: 0.8 }, { x: 0.5, y: 0.8 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.3 }],
      widthMm: 4000,
      heightMm: 2400,
      baseMm: 0,
    };
    expect(solvePose(ref, W, H, null)).toEqual({
      ok: false,
      error: "Il riquadro di facciata non è valido: clicca i quattro angoli di un rettangolo",
    });
  });

  it("rifiuta un riquadro incrociato", () => {
    const ref: RefRect = {
      corners: [{ x: 0.2, y: 0.8 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.3 }, { x: 0.8, y: 0.3 }],
      widthMm: 4000,
      heightMm: 2400,
      baseMm: 0,
    };
    const r = solvePose(ref, W, H, null);
    expect(r.ok).toBe(false);
  });

  it("rifiuta un riquadro minuscolo", () => {
    const ref: RefRect = {
      corners: [{ x: 0.5, y: 0.52 }, { x: 0.52, y: 0.52 }, { x: 0.52, y: 0.5 }, { x: 0.5, y: 0.5 }],
      widthMm: 4000,
      heightMm: 2400,
      baseMm: 0,
    };
    expect(solvePose(ref, W, H, null)).toEqual({ ok: false, error: "Il riquadro di facciata è troppo piccolo" });
  });
});

describe("orderCorners", () => {
  it("riordina quattro clic qualsiasi in basso-sx, basso-dx, alto-dx, alto-sx", () => {
    const bl = { x: 0.2, y: 0.8 };
    const br = { x: 0.7, y: 0.75 };
    const tr = { x: 0.7, y: 0.35 };
    const tl = { x: 0.2, y: 0.3 };
    expect(orderCorners([tr, bl, tl, br])).toEqual([bl, br, tr, tl]);
    expect(orderCorners([tl, tr, br, bl])).toEqual([bl, br, tr, tl]);
  });
});

describe("boxVertices", () => {
  it("dà gli otto vertici in mm: quattro a terra e quattro in alto", () => {
    const v = boxVertices(
      { offsetXMm: 500, distanceMm: 0, wallHeightMm: 2800, frontHeightMm: 2500 },
      { widthMm: 4000, depthMm: 3000 },
    );
    expect(v).toHaveLength(8);
    expect(v[0]).toEqual([500, 0, 0]);
    expect(v[2]).toEqual([4500, 0, 3000]);
    expect(v[4]).toEqual([500, 2800, 0]);
    expect(v[6]).toEqual([4500, 2500, 3000]);
  });
});

describe("projectVolume", () => {
  const truth = synth(0.7, 25, 5, 0, 9000, CENTER);
  const dims = { widthMm: 4000, depthMm: 3000 };
  const base = (): Volume => ({
    ref: refFrom(truth),
    focalRatio: null,
    box: { offsetXMm: 0, distanceMm: 0, wallHeightMm: 2800, frontHeightMm: 2500 },
    frontPosts: [0, 0.5, 1],
    rearPosts: [0, 1],
    nudges: null,
  });

  it("proietta vertici, attacco a muro e montanti", () => {
    const pv = projectVolume(base(), dims, W, H);
    if (!pv.ok) throw new Error(pv.error);
    expect(pv.vertices).toHaveLength(8);
    expect(pxDist(pv.vertices[6], project(truth, [4000, 2500, 3000])!)).toBeLessThan(1);
    expect(pv.wallLine).not.toBeNull();
    expect(pxDist(pv.wallLine![0], project(truth, [0, 2800, 0])!)).toBeLessThan(1);
    expect(pxDist(pv.wallLine![1], project(truth, [4000, 2800, 0])!)).toBeLessThan(1);
    // Addossata: i montanti posteriori non esistono.
    expect(pv.posts.map((p) => p.xMm)).toEqual([0, 2000, 4000]);
    expect(pv.posts.every((p) => !p.rear)).toBe(true);
    expect(pxDist(pv.posts[1].foot, project(truth, [2000, 0, 3000])!)).toBeLessThan(1);
    expect(pxDist(pv.posts[1].head, project(truth, [2000, 2500, 3000])!)).toBeLessThan(1);
  });

  it("autoportante: nessun attacco a muro e montanti anche sul retro", () => {
    const v = base();
    v.box.distanceMm = 800;
    const pv = projectVolume(v, dims, W, H);
    if (!pv.ok) throw new Error(pv.error);
    expect(pv.wallLine).toBeNull();
    expect(pv.posts.filter((p) => p.rear)).toHaveLength(2);
    expect(pxDist(pv.posts.find((p) => p.rear)!.head, project(truth, [0, 2800, 800])!)).toBeLessThan(1);
    expect(pxDist(pv.vertices[0], project(truth, [0, 0, 800])!)).toBeLessThan(1);
  });

  it("somma i ritocchi fini ai vertici e li fa seguire ai montanti", () => {
    const plain = projectVolume(base(), dims, W, H);
    const v = base();
    v.nudges = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));
    v.nudges[3] = { x: 0.01, y: 0.02 }; // piede anteriore sinistro
    const pv = projectVolume(v, dims, W, H);
    if (!pv.ok || !plain.ok) throw new Error("proiezione fallita");
    expect(pv.vertices[3].x).toBeCloseTo(plain.vertices[3].x + 0.01, 9);
    expect(pv.vertices[3].y).toBeCloseTo(plain.vertices[3].y + 0.02, 9);
    expect(pv.vertices[2]).toEqual(plain.vertices[2]);
    expect(pv.posts[0].foot.x).toBeCloseTo(plain.posts[0].foot.x + 0.01, 9);
    expect(pv.posts[1].foot.x).toBeCloseTo(plain.posts[1].foot.x + 0.005, 9);
    expect(pv.posts[2].foot.x).toBeCloseTo(plain.posts[2].foot.x, 9);
  });

  it("rifiuta un volume che finisce dietro la fotocamera", () => {
    const v = base();
    const pv = projectVolume(v, { widthMm: 4000, depthMm: 30000 }, W, H);
    expect(pv).toEqual({
      ok: false,
      error: "Il volume finisce dietro la fotocamera: riduci la sporgenza o regola la prospettiva",
    });
  });

  it("segnala il volume che esce dall'inquadratura", () => {
    const inside = projectVolume(base(), dims, W, H);
    const v = base();
    v.box.offsetXMm = 9000;
    const out = projectVolume(v, dims, W, H);
    if (!inside.ok || !out.ok) throw new Error("proiezione fallita");
    expect(inside.outOfFrame).toBe(false);
    expect(out.outOfFrame).toBe(true);
  });

  it("propaga l'errore del riquadro", () => {
    const v = base();
    v.ref.corners = [{ x: 0.5, y: 0.52 }, { x: 0.52, y: 0.52 }, { x: 0.52, y: 0.5 }, { x: 0.5, y: 0.5 }];
    expect(projectVolume(v, dims, W, H)).toEqual({ ok: false, error: "Il riquadro di facciata è troppo piccolo" });
  });
});

describe("alongAxis", () => {
  const pose = synth(0.7, 25, 5, 0, 9000, CENTER);
  it.each([
    ["X", [1, 0, 0] as Vec3],
    ["Y", [0, 1, 0] as Vec3],
    ["Z", [0, 0, 1] as Vec3],
  ])("risale ai mm lungo l'asse %s dal punto sulla foto", (_name, axis) => {
    const origin: Vec3 = [300, 200, 100];
    const p: Vec3 = [origin[0] + axis[0] * 1730, origin[1] + axis[1] * 1730, origin[2] + axis[2] * 1730];
    expect(Math.abs(alongAxis(pose, origin, axis, project(pose, p)!) - 1730)).toBeLessThan(1);
  });

  it("proietta sulla retta un puntatore che non ci cade sopra", () => {
    const origin: Vec3 = [0, 0, 0];
    const on = project(pose, [1730, 0, 0])!;
    const a = project(pose, [0, 0, 0])!;
    // Spostamento perpendicolare alla retta in pixel.
    const dx = (on.x - a.x) * W;
    const dy = (on.y - a.y) * H;
    const len = Math.hypot(dx, dy);
    const off = { x: on.x + ((-dy / len) * 40) / W, y: on.y + ((dx / len) * 40) / H };
    expect(Math.abs(alongAxis(pose, origin, [1, 0, 0], off) - 1730)).toBeLessThan(2);
  });
});

describe("volumeOutline", () => {
  const truth = synth(0.7, 25, 5, 0, 9000, CENTER);
  const vol = (offsetXMm: number): Volume => ({
    ref: refFrom(truth),
    focalRatio: null,
    box: { offsetXMm, distanceMm: 0, wallHeightMm: 2800, frontHeightMm: 2500 },
    frontPosts: [0, 1],
    rearPosts: [],
    nudges: null,
  });
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  it("è un poligono convesso che contiene tutti i vertici", () => {
    const pv = projectVolume(vol(0), { widthMm: 4000, depthMm: 3000 }, W, H);
    if (!pv.ok) throw new Error(pv.error);
    const hull = volumeOutline(pv);
    expect(hull.length).toBeGreaterThanOrEqual(4);
    const signs = hull.map((p, i) => Math.sign(cross(p, hull[(i + 1) % hull.length], hull[(i + 2) % hull.length])));
    expect(new Set(signs.filter((s) => s !== 0)).size).toBe(1);
  });

  it("resta dentro la foto anche se il volume esce dall'inquadratura", () => {
    const pv = projectVolume(vol(5000), { widthMm: 4000, depthMm: 3000 }, W, H);
    if (!pv.ok) throw new Error(pv.error);
    expect(pv.outOfFrame).toBe(true);
    const hull = volumeOutline(pv);
    expect(hull.length).toBeGreaterThanOrEqual(3);
    expect(hull.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)).toBe(true);
  });
});

describe("defaultVolume, evenPosts, roundMm", () => {
  const ref: RefRect = {
    corners: [{ x: 0.2, y: 0.8 }, { x: 0.7, y: 0.8 }, { x: 0.7, y: 0.3 }, { x: 0.2, y: 0.3 }],
    widthMm: 5015,
    heightMm: 2400,
    baseMm: 0,
  };

  it("addossata: centrata sul riquadro, altezze uguali alla totale, due montanti", () => {
    const v = defaultVolume(ref, { widthMm: 4000, depthMm: 3000 }, 2600, false);
    expect(v.box).toEqual({ offsetXMm: 510, distanceMm: 0, wallHeightMm: 2600, frontHeightMm: 2600 });
    expect(v.frontPosts).toEqual([0, 1]);
    expect(v.rearPosts).toEqual([]);
    expect(v.focalRatio).toBeNull();
    expect(v.nudges).toBeNull();
    expect(v.ref).toEqual(ref);
  });

  it("autoportante: staccata di un metro, con montanti posteriori", () => {
    const v = defaultVolume(ref, { widthMm: 4000, depthMm: 3000 }, 2600, true);
    expect(v.box.distanceMm).toBe(1000);
    expect(v.rearPosts).toEqual([0, 1]);
  });

  it("evenPosts distribuisce i montanti", () => {
    expect(evenPosts(0)).toEqual([]);
    expect(evenPosts(1)).toEqual([0.5]);
    expect(evenPosts(3)).toEqual([0, 0.5, 1]);
  });

  it("roundMm arrotonda ai 10 mm", () => {
    expect(roundMm(1234)).toBe(1230);
    expect(roundMm(1235)).toBe(1240);
  });
});
