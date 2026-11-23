import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { featheredAlpha, polygonToMask } from "@/lib/render/mask";

const square = [
  { x: 0.25, y: 0.25 },
  { x: 0.75, y: 0.25 },
  { x: 0.75, y: 0.75 },
  { x: 0.25, y: 0.75 },
];
const W = 400;
const H = 400;

async function rawMask(png: Buffer) {
  const { data, info } = await sharp(png)
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(info.width).toBe(W);
  expect(info.height).toBe(H);
  expect(info.channels).toBe(1);
  return data;
}

describe("polygonToMask", () => {
  it("è un PNG binario con la sagoma allargata di dilationPx", async () => {
    const png = await polygonToMask(square, W, H);
    expect((await sharp(png).metadata()).format).toBe("png");
    const m = await rawMask(png);
    const at = (x: number, y: number) => m[y * W + x];
    expect(at(200, 200)).toBe(255);
    expect(at(5, 5)).toBe(0);
    expect(at(95, 200)).toBe(255); // 5 px fuori dal quadrato, dentro gli 8 px
    expect(at(85, 200)).toBe(0); // 15 px fuori: oltre l'allargamento
    expect(new Set(m)).toEqual(new Set([0, 255])); // bordo netto
  });
});

describe("featheredAlpha", () => {
  it("255 nel nucleo, 0 fuori dalla maschera, rampa solo nella fascia", async () => {
    const png = await polygonToMask(square, W, H);
    const m = await rawMask(png);
    const a = await featheredAlpha(png, W, H);
    expect(a.length).toBe(W * H);
    const at = (x: number, y: number) => a[y * W + x];
    expect(at(200, 200)).toBe(255);
    expect(at(5, 5)).toBe(0);
    let leaks = 0;
    let insideNot255 = 0;
    let ramp = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (m[i] === 0 && a[i] !== 0) leaks++;
        const inPolygon = x >= 100 && x < 300 && y >= 100 && y < 300;
        if (inPolygon && a[i] !== 255) insideNot255++;
        if (a[i] > 0 && a[i] < 255) ramp++;
      }
    }
    expect(leaks).toBe(0);
    expect(insideNot255).toBe(0);
    expect(ramp).toBeGreaterThan(0); // c'è davvero una sfumatura
  });

  it("la rampa è larga circa metà dell'allargamento", async () => {
    const png = await polygonToMask(square, W, H);
    const a = await featheredAlpha(png, W, H);
    // riga centrale: il bordo esterno della maschera è a x≈92, la rampa finisce entro x≈96
    const row = Array.from(a.subarray(200 * W, 200 * W + 110));
    const firstNonZero = row.findIndex((v) => v > 0);
    const first255 = row.indexOf(255);
    expect(first255 - firstNonZero).toBeGreaterThanOrEqual(3);
    expect(first255 - firstNonZero).toBeLessThanOrEqual(5);
  });
});

describe("sagoma che tocca il bordo della foto", () => {
  it("l'alfa resta 255 sul bordo del fotogramma", async () => {
    const pts = [
      { x: 0, y: 0.5 },
      { x: 0.6, y: 0.5 },
      { x: 0.6, y: 1 },
      { x: 0, y: 1 },
    ];
    const png = await polygonToMask(pts, W, H);
    const a = await featheredAlpha(png, W, H);
    for (let y = 200; y < H; y++) expect(a[y * W + 0]).toBe(255); // bordo sinistro
    for (let x = 0; x < 240; x++) expect(a[(H - 1) * W + x]).toBe(255); // bordo inferiore
  });
});
