import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PLACEMENT_THRESHOLD, isMisplaced, placementOffset } from "@/lib/render/placement";

const W = 400;
const H = 300;
/** Ingombro del volume: x 0.25–0.75, y 0.3–0.7. */
const OUTLINE = [
  { x: 0.25, y: 0.3 },
  { x: 0.75, y: 0.3 },
  { x: 0.75, y: 0.7 },
  { x: 0.25, y: 0.7 },
];

const grey = () =>
  sharp({ create: { width: W, height: H, channels: 3, background: { r: 150, g: 150, b: 150 } } }).png().toBuffer();

/** Foto grigia con un rettangolo scuro (la "pergola" generata) nelle frazioni indicate. */
async function withRect(x0: number, y0: number, x1: number, y1: number): Promise<Buffer> {
  const rect = await sharp({
    create: {
      width: Math.round((x1 - x0) * W),
      height: Math.round((y1 - y0) * H),
      channels: 3,
      background: { r: 30, g: 30, b: 30 },
    },
  })
    .png()
    .toBuffer();
  return sharp(await grey())
    .composite([{ input: rect, left: Math.round(x0 * W), top: Math.round(y0 * H) }])
    .png()
    .toBuffer();
}

describe("placementOffset", () => {
  it("prodotto dentro il volume: scostamento quasi nullo", async () => {
    const offset = await placementOffset(await grey(), await withRect(0.25, 0.3, 0.75, 0.7), OUTLINE, W, H);
    expect(offset).not.toBeNull();
    expect(offset!).toBeLessThan(0.05);
    expect(isMisplaced(offset)).toBe(false);
  });

  it("prodotto spostato di mezza larghezza: scostamento circa 0,5, fuori posto", async () => {
    const offset = await placementOffset(await grey(), await withRect(0.5, 0.3, 1, 0.7), OUTLINE, W, H);
    expect(offset!).toBeGreaterThan(0.42);
    expect(offset!).toBeLessThan(0.58);
    expect(isMisplaced(offset)).toBe(true);
  });

  it("prodotto grande il doppio: fuori posto", async () => {
    const offset = await placementOffset(await grey(), await withRect(0, 0.1, 1, 0.9), OUTLINE, W, H);
    expect(isMisplaced(offset)).toBe(true);
  });

  it("prodotto grande la metà: fuori posto", async () => {
    const offset = await placementOffset(await grey(), await withRect(0.375, 0.4, 0.625, 0.6), OUTLINE, W, H);
    expect(isMisplaced(offset)).toBe(true);
  });

  it("nessun cambiamento: null (niente da confrontare)", async () => {
    expect(await placementOffset(await grey(), await grey(), OUTLINE, W, H)).toBeNull();
  });

  it("qualche pixel cambiato lontano non sposta la misura", async () => {
    const speck = await sharp({ create: { width: 3, height: 3, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .png()
      .toBuffer();
    const result = await sharp(await withRect(0.25, 0.3, 0.75, 0.7))
      .composite([{ input: speck, left: 5, top: 5 }])
      .png()
      .toBuffer();
    expect((await placementOffset(await grey(), result, OUTLINE, W, H))!).toBeLessThan(0.05);
  });
});

describe("isMisplaced", () => {
  it("usa la soglia e ignora i valori mancanti", () => {
    expect(PLACEMENT_THRESHOLD).toBe(0.25);
    expect(isMisplaced(0.26)).toBe(true);
    expect(isMisplaced(0.25)).toBe(false);
    expect(isMisplaced(null)).toBe(false);
    expect(isMisplaced(undefined)).toBe(false);
  });
});
