import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { growMask } from "@/lib/render/grow";
import { polygonToMask } from "@/lib/render/mask";

const W = 400;
const H = 300;

type Paint = { x0: number; x1: number; y0: number; y1: number; value: number };

/** Scena sintetica con texture; `paints` sovrappone rettangoli (la "pergola"). */
function scene(paints: Paint[] = [], noise = 0): Buffer {
  const raw = Buffer.alloc(W * H * 3);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const base = 90 + (x / W) * 80 + (y / H) * 40 + (Math.floor(x / 25) % 2 ? 12 : 0);
      for (let c = 0; c < 3; c++) {
        let v = base + c * 10 + noise * rnd();
        for (const p of paints) if (x >= p.x0 && x < p.x1 && y >= p.y0 && y < p.y1) v = p.value;
        raw[(y * W + x) * 3 + c] = Math.max(0, Math.min(255, v));
      }
    }
  }
  return raw;
}
const png = (raw: Buffer) => sharp(raw, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();

/** Sagoma rettangolare x 150..250, y 100..200 (maschera allargata dal modulo). */
async function mask() {
  const poly = [
    { x: 150 / W, y: 100 / H },
    { x: 250 / W, y: 100 / H },
    { x: 250 / W, y: 200 / H },
    { x: 150 / W, y: 200 / H },
  ];
  return polygonToMask(poly, W, H);
}
/** Maschera PNG → un byte per pixel (sharp la decodifica a 3 canali: se ne tiene uno). */
const gray = (maskPng: Buffer) => sharp(maskPng).extractChannel(0).raw().toBuffer();
async function pixel(maskPng: Buffer, x: number, y: number) {
  return (await gray(maskPng))[y * W + x];
}

const original = () => png(scene());

describe("growMask", () => {
  it("allarga la maschera alla parte di pergola che esce dalla sagoma (connessa ad essa)", async () => {
    const m = await mask();
    const generated = await png(scene([{ x0: 150, x1: 300, y0: 100, y1: 200, value: 20 }]));
    const r = await growMask(await original(), generated, m, W, H);
    expect(r.grown).toBe(true);
    expect(await pixel(r.mask, 285, 150)).toBe(255); // la parte che usciva è ora inclusa
    expect(await pixel(r.mask, 350, 150)).toBe(0); // più in là, scena invariata
    expect(r.addedRatio).toBeGreaterThan(0);
    expect(r.truncated).toBe(false);
  });

  it("mantiene sempre tutta la maschera originale", async () => {
    const m = await mask();
    const generated = await png(scene([{ x0: 150, x1: 300, y0: 100, y1: 200, value: 20 }]));
    const r = await growMask(await original(), generated, m, W, H);
    const before = await gray(m);
    const after = await gray(r.mask);
    for (let i = 0; i < before.length; i++) if (before[i] === 255) expect(after[i]).toBe(255);
  });

  it("senza differenze fuori dalla sagoma la maschera resta invariata", async () => {
    const m = await mask();
    const generated = await png(scene([{ x0: 160, x1: 240, y0: 110, y1: 190, value: 20 }])); // tutto dentro
    const r = await growMask(await original(), generated, m, W, H);
    expect(r.grown).toBe(false);
    expect(r.addedRatio).toBe(0);
    expect(Buffer.compare(await sharp(r.mask).raw().toBuffer(), await sharp(m).raw().toBuffer())).toBe(0);
  });

  it("il rumore di rigenerazione non fa crescere la maschera", async () => {
    const m = await mask();
    const generated = await png(scene([{ x0: 160, x1: 240, y0: 110, y1: 190, value: 20 }], 8));
    const r = await growMask(await original(), generated, m, W, H);
    expect(r.grown).toBe(false);
  });

  it("la crescita ha un tetto: una struttura che arriva molto più in là resta troncata e viene segnalata", async () => {
    const m = await mask();
    const generated = await png(scene([{ x0: 150, x1: 395, y0: 100, y1: 200, value: 20 }]));
    const r = await growMask(await original(), generated, m, W, H);
    expect(r.grown).toBe(true);
    expect(await pixel(r.mask, 390, 150)).toBe(0);
    expect(r.truncated).toBe(true);
  });

  it("non aggiunge zone cambiate lontane e non connesse alla sagoma", async () => {
    const m = await mask();
    const generated = await png(
      scene([
        { x0: 150, x1: 280, y0: 100, y1: 200, value: 20 },
        { x0: 40, x1: 90, y0: 20, y1: 60, value: 240 }, // blob lontano
      ]),
    );
    const r = await growMask(await original(), generated, m, W, H);
    expect(await pixel(r.mask, 270, 150)).toBe(255);
    expect(await pixel(r.mask, 60, 40)).toBe(0);
  });
});
