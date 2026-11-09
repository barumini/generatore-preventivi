import sharp from "sharp";

export async function png(width: number, height: number, rgb: [number, number, number] = [120, 130, 140]) {
  return sharp({ create: { width, height, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } })
    .png()
    .toBuffer();
}

/** Maschera nel formato dell'app: bianco = area da modificare (metà sinistra), nero fuori. */
export async function leftHalfMask(width: number, height: number) {
  const raw = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width / 2; x++) raw[y * width + x] = 255;
  return sharp(raw, { raw: { width, height, channels: 1 } }).png().toBuffer();
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function fileBytes(v: FormDataEntryValue | null): Promise<Buffer> {
  if (!v || typeof v === "string") throw new Error("atteso un file");
  return Buffer.from(await v.arrayBuffer());
}
