import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { guideSvg, renderGuide } from "@/lib/render/guide";
import type { ProjectedVolume } from "@/lib/render/volume";

const W = 400;
const H = 300;

/** Volume già proiettato, scritto a mano: attacco a muro orizzontale a y = 0.3, due montanti. */
function projected(over: Partial<ProjectedVolume> = {}): ProjectedVolume {
  const vertices = [
    { x: 0.3, y: 0.6 }, { x: 0.7, y: 0.6 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 },
    { x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.8, y: 0.2 }, { x: 0.2, y: 0.2 },
  ];
  return {
    pose: { f: 1, R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], t: [0, 0, 1], width: W, height: H },
    focalRatio: 0.6,
    focalAuto: false,
    vertices,
    posts: [
      { foot: vertices[3], head: vertices[7], xMm: 0, rear: false },
      { foot: vertices[2], head: vertices[6], xMm: 4000, rear: false },
    ],
    wallLine: [vertices[4], vertices[5]],
    outOfFrame: false,
    ...over,
  };
}

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe("guideSvg", () => {
  it("disegna attacco a muro rosso, un tratto blu per montante e i dodici spigoli tratteggiati", () => {
    const svg = guideSvg(projected(), W, H);
    expect(count(svg, /stroke="#ff3b30"/g)).toBe(1);
    expect(count(svg, /stroke="#2f7bff"/g)).toBe(2);
    expect(count(svg, /stroke-dasharray/g)).toBe(12);
  });

  it("senza attacco a muro non c'è il tratto rosso", () => {
    expect(guideSvg(projected({ wallLine: null }), W, H)).not.toContain("#ff3b30");
  });

  it("lo spessore dei tratti segue la diagonale della foto, con un minimo di 3 px", () => {
    expect(guideSvg(projected(), W, H)).toContain('stroke-width="3"');
    expect(guideSvg(projected(), 4000, 3000)).toContain('stroke-width="30"');
  });
});

describe("renderGuide", () => {
  it("disegna il volume sulla foto senza toccare il resto", async () => {
    const photo = await sharp({ create: { width: W, height: H, channels: 3, background: { r: 128, g: 128, b: 128 } } })
      .jpeg()
      .toBuffer();
    const out = await renderGuide(photo, projected(), W, H);
    const meta = await sharp(out).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["png", W, H]);
    const { data } = await sharp(out).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => [...data.subarray((y * W + x) * 3, (y * W + x) * 3 + 3)];
    // Metà della linea d'attacco: x = 0.5·W, y = 0.3·H.
    const [r, g] = px(200, 90);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(110);
    // Lontano dal volume la foto è intatta.
    for (const v of px(20, 280)) expect(Math.abs(v - 128)).toBeLessThanOrEqual(3);
  });
});
