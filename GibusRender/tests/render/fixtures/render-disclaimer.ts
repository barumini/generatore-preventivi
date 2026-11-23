// Eseguito in un processo separato da disclaimer-font.test.ts, con pango forzato
// sul backend fontconfig e una configurazione senza font di sistema (come su Vercel).
// Scrive su stdout il JPEG con la dicitura, in base64.
import sharp from "sharp";
import { addDisclaimer } from "../../../src/lib/render/image";

async function main() {
  const [w, h] = [Number(process.argv[2]), Number(process.argv[3])];
  const base = await sharp({ create: { width: w, height: h, channels: 3, background: { r: 60, g: 60, b: 60 } } })
    .png()
    .toBuffer();
  process.stdout.write((await addDisclaimer(base, w, h)).toString("base64"));
}

void main();
