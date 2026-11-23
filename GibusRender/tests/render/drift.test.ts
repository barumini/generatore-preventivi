import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { featheredAlpha } from "@/lib/render/mask";
import { polygonToMask } from "@/lib/render/mask";
import { sceneDrift } from "@/lib/render/drift";
import { DRIFT_ALTERED_THRESHOLD, isSceneAltered } from "@/lib/render/scene-check";

const W = 400;
const H = 300;

/** Foto sintetica con strutture (strisce e gradiente) per rendere visibile uno spostamento. */
function scene(shiftX = 0, noise = 0, innerBlack = false): Buffer {
  const raw = Buffer.alloc(W * H * 3);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = x - shiftX;
      const stripe = Math.floor(sx / 20) % 2 ? 60 : 0;
      const base = (sx / W) * 120 + (y / H) * 60 + stripe;
      const inside = innerBlack && x > 150 && x < 250 && y > 100 && y < 200;
      for (let c = 0; c < 3; c++) {
        const v = inside ? 0 : base + c * 20 + noise * rnd();
        raw[(y * W + x) * 3 + c] = Math.max(0, Math.min(255, v));
      }
    }
  }
  return raw;
}
const toPng = (raw: Buffer) => sharp(raw, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();

async function alpha() {
  const poly = [
    { x: 0.375, y: 0.33 },
    { x: 0.625, y: 0.33 },
    { x: 0.625, y: 0.67 },
    { x: 0.375, y: 0.67 },
  ];
  return featheredAlpha(await polygonToMask(poly, W, H), W, H);
}

describe("sceneDrift", () => {
  it("immagini identiche → 0", async () => {
    const img = await toPng(scene());
    expect(await sceneDrift(img, img, await alpha(), W, H)).toBeCloseTo(0, 5);
  });

  it("una differenza solo dentro la sagoma non conta", async () => {
    const a = await toPng(scene());
    const b = await toPng(scene(0, 0, true));
    expect(await sceneDrift(a, b, await alpha(), W, H)).toBeCloseTo(0, 5);
  });

  it("una scena spostata fuori dalla sagoma supera la soglia di 'scena alterata'", async () => {
    const a = await toPng(scene());
    const b = await toPng(scene(12));
    const d = await sceneDrift(a, b, await alpha(), W, H);
    expect(d).toBeGreaterThan(DRIFT_ALTERED_THRESHOLD);
    expect(isSceneAltered(d)).toBe(true);
  });

  it("un leggero rumore di rigenerazione resta sotto la soglia", async () => {
    const a = await toPng(scene());
    const b = await toPng(scene(0, 6));
    const d = await sceneDrift(a, b, await alpha(), W, H);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(DRIFT_ALTERED_THRESHOLD);
    expect(isSceneAltered(d)).toBe(false);
  });

  it("senza punteggio (null/undefined) la scena non è segnalata", () => {
    expect(isSceneAltered(null)).toBe(false);
    expect(isSceneAltered(undefined)).toBe(false);
  });
});
