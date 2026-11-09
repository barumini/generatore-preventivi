import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  addDisclaimer,
  composite,
  compositeRaw,
  fromProviderSize,
  normalizePhoto,
  pickProviderSize,
  toProviderSize,
} from "@/lib/render/image";
import { featheredAlpha, polygonToMask } from "@/lib/render/mask";

const solid = (width: number, height: number, r = 120, g = 130, b = 140) =>
  sharp({ create: { width, height, channels: 3, background: { r, g, b } } });

describe("normalizePhoto", () => {
  it("applica la rotazione EXIF (orientation 6) e toglie i metadati", async () => {
    const input = await solid(400, 300).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    expect((await sharp(input).metadata()).orientation).toBe(6);
    const out = await normalizePhoto(input);
    expect(out.width).toBe(300);
    expect(out.height).toBe(400);
    const meta = await sharp(out.jpeg).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(300);
    expect(meta.height).toBe(400);
    expect(meta.orientation).toBeUndefined();
    expect(meta.exif).toBeUndefined();
    expect(meta.chromaSubsampling).toBe("4:4:4");
  });

  it("porta il lato lungo a 3000 px", async () => {
    const input = await solid(6000, 4000).jpeg().toBuffer();
    const out = await normalizePhoto(input);
    expect(out).toMatchObject({ width: 3000, height: 2000 });
  });

  it("non ingrandisce le foto piccole", async () => {
    const out = await normalizePhoto(await solid(800, 600).png().toBuffer());
    expect(out).toMatchObject({ width: 800, height: 600 });
    expect((await sharp(out.jpeg).metadata()).format).toBe("jpeg");
  });
});

describe("pickProviderSize", () => {
  const supported = [
    { width: 1024, height: 1024 },
    { width: 1536, height: 1024 },
    { width: 1024, height: 1536 },
  ];
  it("sceglie le proporzioni più vicine", () => {
    expect(pickProviderSize(4000, 3000, supported)).toEqual({ width: 1536, height: 1024 });
    expect(pickProviderSize(3000, 4000, supported)).toEqual({ width: 1024, height: 1536 });
    expect(pickProviderSize(1000, 1000, supported)).toEqual({ width: 1024, height: 1024 });
  });
});

describe("toProviderSize / fromProviderSize", () => {
  it("ridimensiona con fit fill in andata e ritorno", async () => {
    const img = await solid(4000, 3000).jpeg().toBuffer();
    const p = await toProviderSize(img, { width: 1536, height: 1024 });
    const pm = await sharp(p).metadata();
    expect([pm.format, pm.width, pm.height]).toEqual(["png", 1536, 1024]);
    const back = await fromProviderSize(p, 4000, 3000);
    const bm = await sharp(back).metadata();
    expect([bm.width, bm.height]).toEqual([4000, 3000]);
  });
});

describe("composite", () => {
  it("fuori dalla maschera i pixel sono identici all'originale, dentro c'è la generata", async () => {
    const W = 4000;
    const H = 3000;
    const original = await sharp(randomBytes(W * H * 3), { raw: { width: W, height: H, channels: 3 } })
      .jpeg({ quality: 92 })
      .toBuffer();
    const generatedSmall = await solid(1536, 1024, 255, 0, 0).png().toBuffer();
    const generated = await fromProviderSize(generatedSmall, W, H);
    const rect = [
      { x: 0.3, y: 0.3 },
      { x: 0.7, y: 0.3 },
      { x: 0.7, y: 0.7 },
      { x: 0.3, y: 0.7 },
    ];
    const mask = await polygonToMask(rect, W, H);

    const out = await compositeRaw(original, generated, mask, W, H);
    expect(out.length).toBe(W * H * 3);

    const orig = await sharp(original).removeAlpha().raw().toBuffer();
    const m = await sharp(mask).extractChannel(0).raw().toBuffer();
    let outsidePixels = 0;
    let diffs = 0;
    for (let i = 0; i < W * H; i++) {
      if (m[i] !== 0) continue;
      outsidePixels++;
      const j = i * 3;
      if (out[j] !== orig[j] || out[j + 1] !== orig[j + 1] || out[j + 2] !== orig[j + 2]) diffs++;
    }
    expect(outsidePixels).toBeGreaterThan(W * H * 0.5);
    expect(diffs).toBe(0);

    const c = ((H / 2) * W + W / 2) * 3;
    expect([out[c], out[c + 1], out[c + 2]]).toEqual([255, 0, 0]);

    const jpeg = await composite(original, generated, mask, W, H);
    const jm = await sharp(jpeg).metadata();
    expect([jm.format, jm.width, jm.height]).toEqual(["jpeg", W, H]);
  }, 60_000);

  it("rifiuta immagini con dimensioni diverse da quelle attese", async () => {
    const a = await solid(100, 100).png().toBuffer();
    const b = await solid(50, 50).png().toBuffer();
    const mask = await polygonToMask(
      [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.5, y: 0.8 }],
      100,
      100,
    );
    await expect(compositeRaw(a, b, mask, 100, 100)).rejects.toThrow();
  });
});

describe("addDisclaimer", () => {
  it("non cambia le dimensioni e restituisce un JPEG", async () => {
    const jpeg = await solid(1200, 800, 60, 60, 60).jpeg().toBuffer();
    const out = await addDisclaimer(jpeg, 1200, 800);
    const meta = await sharp(out).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 1200, 800]);
    // testo chiaro solo in basso a destra
    const raw = await sharp(out).raw().toBuffer();
    let bottomRight = 0;
    let elsewhere = 0;
    for (let y = 0; y < 800; y++) {
      for (let x = 0; x < 1200; x++) {
        if (raw[(y * 1200 + x) * 3] <= 200) continue;
        if (x > 600 && y > 740) bottomRight++;
        else elsewhere++;
      }
    }
    expect(bottomRight).toBeGreaterThan(100);
    expect(elsewhere).toBe(0);
  });
});

describe("una sola codifica JPEG 4:4:4 e alfa precalcolata", () => {
  const W = 600;
  const H = 400;
  const rect = [
    { x: 0.3, y: 0.3 },
    { x: 0.7, y: 0.3 },
    { x: 0.7, y: 0.7 },
    { x: 0.3, y: 0.7 },
  ];
  const JPEG_OPTS = { quality: 92, chromaSubsampling: "4:4:4" } as const;

  /** Foto liscia sintetica: rumore piccolo ingrandito e sfocato, normalizzata. */
  async function smoothPhoto(w: number, h: number) {
    const small = await sharp(randomBytes(40 * 30 * 3), { raw: { width: 40, height: 30, channels: 3 } })
      .resize(w, h, { fit: "fill", kernel: "cubic" })
      .blur(4)
      .png()
      .toBuffer();
    return (await normalizePhoto(small)).jpeg;
  }

  async function inputs() {
    const original = await smoothPhoto(W, H);
    const generated = await fromProviderSize(await solid(1536, 1024, 255, 0, 0).png().toBuffer(), W, H);
    const mask = await polygonToMask(rect, W, H);
    return { original, generated, mask };
  }

  it("compositeRaw con alfa precalcolata dà lo stesso risultato", async () => {
    const { original, generated, mask } = await inputs();
    const alpha = await featheredAlpha(mask, W, H);
    const a = await compositeRaw(original, generated, mask, W, H);
    const b = await compositeRaw(original, generated, mask, W, H, { alpha });
    expect(b.equals(a)).toBe(true);
    const c = await composite(original, generated, mask, W, H);
    const d = await composite(original, generated, mask, W, H, { alpha });
    expect(d.equals(c)).toBe(true);
  });

  it("composite con dicitura: una sola codifica, dimensioni invariate", async () => {
    const { original, generated, mask } = await inputs();
    const out = await composite(original, generated, mask, W, H, { disclaimer: true });
    const meta = await sharp(out).metadata();
    expect([meta.format, meta.width, meta.height, meta.chromaSubsampling]).toEqual(["jpeg", W, H, "4:4:4"]);
    // byte per byte uguale a UNA codifica del grezzo con dicitura
    const raw = await compositeRaw(original, generated, mask, W, H, { disclaimer: true });
    const once = await sharp(raw, { raw: { width: W, height: H, channels: 3 } }).jpeg(JPEG_OPTS).toBuffer();
    expect(out.equals(once)).toBe(true);
    // la dicitura c'è davvero rispetto al grezzo senza dicitura
    const plain = await compositeRaw(original, generated, mask, W, H);
    expect(raw.equals(plain)).toBe(false);
  });

  it("addDisclaimer codifica una sola volta in JPEG 4:4:4 (anche da PNG)", async () => {
    const png = await solid(W, H, 60, 60, 60).png().toBuffer();
    const out = await addDisclaimer(png, W, H);
    const meta = await sharp(out).metadata();
    expect([meta.format, meta.width, meta.height, meta.chromaSubsampling]).toEqual(["jpeg", W, H, "4:4:4"]);
  });

  it("deriva del JPEG consegnato fuori dalla maschera: errore medio < 1,5 livelli", async () => {
    const { original, generated, mask } = await inputs();
    const out = await composite(original, generated, mask, W, H, { disclaimer: false });
    const dec = await sharp(out).removeAlpha().raw().toBuffer();
    const orig = await sharp(original).removeAlpha().raw().toBuffer();
    const m = await sharp(mask).extractChannel(0).raw().toBuffer();
    // margine di 16 px dalla maschera (blocchi JPEG a cavallo del bordo) e
    // esclusione dell'area in basso a destra della dicitura
    const near = new Uint8Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (m[y * W + x])
          for (let dy = -16; dy <= 16; dy += 16)
            for (let dx = -16; dx <= 16; dx += 16) {
              const yy = y + dy, xx = x + dx;
              if (yy >= 0 && yy < H && xx >= 0 && xx < W) near[yy * W + xx] = 1;
            }
    let sum = 0;
    let n = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (m[i] || near[i] || (x > W / 2 && y > H * 0.9)) continue;
        for (let c = 0; c < 3; c++) sum += Math.abs(dec[i * 3 + c] - orig[i * 3 + c]);
        n += 3;
      }
    expect(n).toBeGreaterThan(W * H * 3 * 0.3);
    expect(sum / n).toBeLessThan(1.5);
  });
});
