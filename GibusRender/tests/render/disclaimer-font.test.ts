import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DISCLAIMER_FONT_FILE } from "@/lib/render/image";

const run = promisify(execFile);
let dir: string;

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "gibus-fc-"));
  // Configurazione fontconfig vuota: nessun font di sistema, come nelle funzioni Vercel.
  await fs.writeFile(
    path.join(dir, "fonts.conf"),
    `<?xml version="1.0"?><fontconfig><cachedir>${dir}/cache</cachedir></fontconfig>`,
  );
});

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

/**
 * Riquadro dei pixel chiari (testo bianco) nell'immagine grezza RGB e numero
 * di spazi tra parole: colonne vuote consecutive larghe almeno minGap px.
 */
function measure(raw: Buffer, w: number, h: number, minGap: number) {
  let minX = w, maxX = -1, minY = h, maxY = -1;
  const ink = new Array<number>(w).fill(0);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (raw[(y * w + x) * 3] > 200) {
        ink[x]++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
  let gaps = 0;
  let run = 0;
  for (let x = minX; x <= maxX; x++) {
    if (ink[x] === 0) run++;
    else {
      if (run >= minGap) gaps++;
      run = 0;
    }
  }
  return { minX, maxX, minY, maxY, width: maxX - minX + 1, gaps };
}

describe("dicitura con il font incluso nel repository", () => {
  it("il file del font esiste nel percorso usato a runtime", async () => {
    expect(DISCLAIMER_FONT_FILE).toBe(path.join(process.cwd(), "assets/fonts/Geist-Medium.ttf"));
    await expect(fs.access(DISCLAIMER_FONT_FILE)).resolves.toBeUndefined();
  });

  it("senza font di sistema (fontconfig vuoto) disegna lettere vere in basso a destra", async () => {
    const W = 1200;
    const H = 800;
    const { stdout } = await run(
      process.execPath,
      ["--import", "tsx", "tests/render/fixtures/render-disclaimer.ts", String(W), String(H)],
      {
        cwd: process.cwd(),
        env: { ...process.env, PANGOCAIRO_BACKEND: "fc", FONTCONFIG_FILE: path.join(dir, "fonts.conf") },
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    const raw = await sharp(Buffer.from(stdout, "base64")).raw().toBuffer();
    const fontSize = Math.round(0.02 * H);
    const box = measure(raw, W, H, Math.ceil(fontSize / 4));
    // In basso a destra, dentro l'immagine.
    expect(box.minX).toBeGreaterThan(W / 2);
    expect(box.minY).toBeGreaterThan(H * 0.9);
    expect(box.maxX).toBeLessThan(W);
    expect(box.maxY).toBeLessThan(H);
    // "Immagine a titolo esemplificativo": 4 parole, quindi 3 spazi visibili. Con un font
    // mancante pango disegna 33 riquadri vuoti (tofu) a distanza fissa, senza spazi tra parole.
    expect(box.gaps).toBe(3);
    expect(box.width).toBeGreaterThan(10 * fontSize);
    expect(box.width).toBeLessThan(20 * fontSize);
  }, 30_000);
});
